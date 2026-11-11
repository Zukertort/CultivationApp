/**
 * Main path, part 2: tribulations. A tribulation is a specific, checkable
 * result with a deadline, written before starting. Its criteria are locked:
 * edits and deletions cost Qi (and gold late in the attempt), a missed
 * deadline fails it and takes Qi and gold, and a sworn claim passes it.
 *
 * Settled rules live in docs/design.md, Rulings 64-72 and 80-97. Which
 * tribulations a breakthrough needs is decided in realm.ts (part 3). The only random
 * outcome is a passed tribulation's item roll, rolled by the server and
 * stored in the event.
 */
import type { EventOf, MainQuestDrop } from "@cultivation/schema";
import { RULES_V1, type Realm, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { addPotion, potionKind } from "./economy.js";
import { violate } from "./errors.js";
import { effectiveDeadline, markActivity, type Due } from "./main.js";
import { checkClaimable, checkDeclarable, failureQiLoss } from "./realm.js";
import { DAY, MINUTE } from "./time.js";

const HOUR = 60 * MINUTE;

// ---- State ------------------------------------------------------------------

/** "closed": left open or failed by a breakthrough or a discipline change, at no cost (rulings 89, 91). */
export type TribulationStatus = "open" | "passed" | "failed" | "deleted" | "closed";

export interface Tribulation {
  title: string;
  criteria: string;
  /** The realm it was declared in; it counts toward that realm's breakthrough (ruling 89). */
  realm: Realm;
  /** When a breakthrough or a discipline change closed it; a passed one keeps its status (rulings 89, 91). */
  closedAt: number | null;
  declaredAt: number;
  /** Start of the current attempt: the declaration or the last reschedule. Edit prices use it (ruling 67). */
  spanStart: number;
  /** The current attempt's deadline; null while failed and not rescheduled. */
  due: Due | null;
  status: TribulationStatus;
  failures: number;
  /** When the last failure happened: the attempt's effective deadline. */
  failedAt: number | null;
  passedAt: number | null;
  edits: number;
  /** Evidence references attached to the claim. */
  evidence: number;
}

export interface PendingTribulationRoll {
  eventId: string;
  at: number;
  tribulationId: string;
}

interface Cost {
  qi: number;
  gold: number;
  count: number;
}

export interface TribulationState {
  items: Record<string, Tribulation>;
  /** When the last item roll was earned (one per `cooldownDays`; ruling 68). */
  lastRollAt: number | null;
  pendingRolls: Record<string, PendingTribulationRoll>;
  drops: Record<MainQuestDrop, number>;
  /** What failures, edits and deletions actually took (failures are floored at the balances). */
  spent: { failures: Cost; edits: Cost; deletions: Cost };
  /** The largest Qi a single failure took, for the simulator and the integrity view (ruling 80). */
  largestFailureQi: number;
}

export function initialTribulations(): TribulationState {
  const cost = (): Cost => ({ qi: 0, gold: 0, count: 0 });
  return {
    items: {},
    lastRollAt: null,
    pendingRolls: {},
    drops: { none: 0, gain_potion: 0, legendary_potion: 0 },
    spent: { failures: cost(), edits: cost(), deletions: cost() },
    largestFailureQi: 0,
  };
}

// ---- Helpers ----------------------------------------------------------------

function checkDeadline(deadline: number, at: number, rules: RulesConfig): void {
  const r = rules.tribulations;
  if (deadline < at + r.minDeadlineHours * HOUR) violate("deadline_too_soon", `a tribulation's deadline is at least ${r.minDeadlineHours} hours out`);
  if (deadline > at + r.maxDeadlineDays * DAY) violate("deadline_too_far", `a tribulation's deadline is at most ${r.maxDeadlineDays} days out`);
}

function get(s: CultivatorState, tribulationId: string): Tribulation {
  const t = s.tribulations.items[tribulationId];
  if (!t) violate("unknown_tribulation", `tribulation ${tribulationId} does not exist`);
  return t;
}

/** The status at `at`: an open tribulation past its effective deadline has failed, even before the failure is applied. */
function statusAt(s: CultivatorState, t: Tribulation, at: number): TribulationStatus {
  if (t.status === "open" && t.due && at > effectiveDeadline(t.due, s.rest, at)) return "failed";
  return t.status;
}

/**
 * Apply a missed deadline (ruling 66): the tribulation fails, dated at its
 * effective deadline, and the failure cost is taken from the balances,
 * floored at 0, never as debt (ruling 65). The Qi part is measured against
 * the current level's threshold (ruling 80). Called at each midnight and
 * before any event about the tribulation.
 */
function settleFailure(s: CultivatorState, t: Tribulation, at: number, rules: RulesConfig): void {
  if (t.status !== "open" || !t.due) return;
  const deadline = effectiveDeadline(t.due, s.rest, at);
  if (at <= deadline) return;
  t.status = "failed";
  t.failedAt = deadline;
  t.failures += 1;
  t.due = null;
  const taken = take(s, failureQiLoss(s, rules), rules.tribulations.failure.gold, s.tribulations.spent.failures);
  s.tribulations.largestFailureQi = Math.max(s.tribulations.largestFailureQi, taken.qi);
}

/** Take a loss from the balances, floored at 0, never as debt (rulings 65, 93). */
function take(s: CultivatorState, qi: number, gold: number, into: Cost): { qi: number; gold: number } {
  const taken = { qi: Math.min(s.qi, qi), gold: Math.min(s.gold, gold) };
  s.qi -= taken.qi;
  s.gold -= taken.gold;
  into.qi += taken.qi;
  into.gold += taken.gold;
  into.count += 1;
  return taken;
}

/** Take a price from the balances, or reject the change when they can't cover it (ruling 67). */
function pay(s: CultivatorState, qi: number, gold: number, into: Cost): void {
  if (s.qi < qi) violate("insufficient_qi", `this costs ${qi} Qi`);
  if (s.gold < gold) violate("insufficient_gold", `this costs ${gold} gold`);
  s.qi -= qi;
  s.gold -= gold;
  into.qi += qi;
  into.gold += gold;
  into.count += 1;
}

export interface TribulationPrice {
  qi: number;
  gold: number;
  /** Which price applies: free within the first hour, early, late (last quarter), or for a failed tribulation. */
  kind: "free" | "early" | "late" | "failed";
}

/** What editing a tribulation costs at `at` (ruling 67, Step 1 prices). For the app and the handler. */
export function tribulationEditPrice(state: CultivatorState, tribulationId: string, at: number, rules: RulesConfig = RULES_V1): TribulationPrice {
  const t = get(state, tribulationId);
  const r = rules.tribulations;
  if (at - t.declaredAt <= r.freeEditMinutes * MINUTE) return { qi: 0, gold: 0, kind: "free" };
  if (statusAt(state, t, at) === "failed" || !t.due) return { qi: r.editQi, gold: 0, kind: "failed" };
  const span = effectiveDeadline(t.due, state.rest, at) - t.spanStart;
  if (at - t.spanStart < r.lateEditFrom * span) return { qi: r.editQi, gold: 0, kind: "early" };
  // The last quarter costs a failure (ruling 93).
  return { qi: failureQiLoss(state, rules), gold: r.failure.gold, kind: "late" };
}

/**
 * What deleting a tribulation costs at `at` (ruling 93): an open one, the
 * failure loss plus 2% in Qi and gold, taken like a failure (floored at the
 * balances, never rejected); a failed one, 40 Qi, since the failure was
 * already paid.
 */
export function tribulationDeletePrice(
  state: CultivatorState,
  tribulationId: string,
  at: number,
  rules: RulesConfig = RULES_V1,
): { qi: number; gold: number; kind: "open" | "failed" } {
  const t = get(state, tribulationId);
  const r = rules.tribulations;
  if (statusAt(state, t, at) === "failed") return { qi: r.deleteFailedQi, gold: 0, kind: "failed" };
  const k = 1 + r.deleteOpenExtra;
  return { qi: failureQiLoss(state, rules) * k, gold: r.failure.gold * k, kind: "open" };
}

function checkChangeable(t: Tribulation): void {
  if (t.status === "passed") violate("tribulation_passed", "a passed tribulation can't be changed");
  if (t.status === "deleted") violate("tribulation_deleted", "this tribulation was deleted");
  if (t.status === "closed") violate("tribulation_closed", "this tribulation was closed");
}

// ---- Handlers ---------------------------------------------------------------

export function onTribulationDeclared(s: CultivatorState, e: EventOf<"TribulationDeclared">, rules: RulesConfig): void {
  if (s.tribulations.items[e.tribulationId]) violate("duplicate_tribulation", `tribulation ${e.tribulationId} already exists`);
  checkDeclarable(s);
  checkDeadline(e.deadline, e.at, rules);
  // Adding is free in Step 1 (ruling 67); Step 2+ prices come with Step 2.
  s.tribulations.items[e.tribulationId] = {
    title: e.title,
    criteria: e.criteria,
    realm: s.main.realm,
    closedAt: null,
    declaredAt: e.at,
    spanStart: e.at,
    due: { deadline: e.deadline, definedAt: e.at, originalMs: e.deadline - e.at, extended: false },
    status: "open",
    failures: 0,
    failedAt: null,
    passedAt: null,
    edits: 0,
    evidence: 0,
  };
}

export function onTribulationEdited(s: CultivatorState, e: EventOf<"TribulationEdited">, rules: RulesConfig): void {
  const t = get(s, e.tribulationId);
  settleFailure(s, t, e.at, rules);
  checkChangeable(t);
  if (e.title === undefined && e.criteria === undefined) violate("nothing_to_edit", "an edit changes the title or the criteria");
  const price = tribulationEditPrice(s, e.tribulationId, e.at, rules);
  pay(s, price.qi, price.gold, s.tribulations.spent.edits);
  if (e.title !== undefined) t.title = e.title;
  if (e.criteria !== undefined) t.criteria = e.criteria;
  t.edits += 1;
  s.main.flags.push({ at: e.at, code: "tribulation_edited", id: e.tribulationId, detail: price.kind });
}

export function onTribulationDeleted(s: CultivatorState, e: EventOf<"TribulationDeleted">, rules: RulesConfig): void {
  const t = get(s, e.tribulationId);
  settleFailure(s, t, e.at, rules);
  checkChangeable(t);
  const price = tribulationDeletePrice(s, e.tribulationId, e.at, rules);
  if (price.kind === "failed") pay(s, price.qi, price.gold, s.tribulations.spent.deletions);
  else take(s, price.qi, price.gold, s.tribulations.spent.deletions);
  t.status = "deleted";
  t.due = null;
  s.main.flags.push({ at: e.at, code: "tribulation_deleted", id: e.tribulationId });
}

export function onTribulationRescheduled(s: CultivatorState, e: EventOf<"TribulationRescheduled">, rules: RulesConfig): void {
  const t = get(s, e.tribulationId);
  settleFailure(s, t, e.at, rules);
  checkChangeable(t);
  if (t.status !== "failed") violate("not_failed", "only a failed tribulation gets a new deadline; there are no extensions");
  checkDeadline(e.deadline, e.at, rules);
  t.status = "open";
  t.spanStart = e.at;
  t.due = { deadline: e.deadline, definedAt: e.at, originalMs: e.deadline - e.at, extended: false };
}

/**
 * A sworn claim passes an open tribulation (ruling 69): it counts as Main
 * activity and earns one item roll, at most one per 7 days (rulings 68, 82;
 * every tribulation counts toward its realm, ruling 89). A Foundation claim
 * with evidence is logged as fast track (ruling 76).
 */
export function onTribulationClaimed(s: CultivatorState, e: EventOf<"TribulationClaimed">, rules: RulesConfig): void {
  const t = get(s, e.tribulationId);
  settleFailure(s, t, e.at, rules);
  checkChangeable(t);
  if (t.status === "failed") violate("tribulation_failed", "the deadline has passed; set a new one to try again");
  checkClaimable(s, t);
  t.status = "passed";
  t.passedAt = e.at;
  t.due = null;
  t.evidence = e.evidence?.length ?? 0;
  markActivity(s.main, "main", e.at);
  s.main.flags.push({ at: e.at, code: "tribulation_claimed", id: e.tribulationId, detail: e.llmReview === "done" ? "reviewed" : "self_reported" });
  if (t.realm === "foundation_establishment" && t.evidence > 0) s.main.flags.push({ at: e.at, code: "fast_track_claim", id: e.tribulationId });

  const tr = s.tribulations;
  const cooldown = rules.tribulations.item.cooldownDays * DAY;
  if (tr.lastRollAt !== null && e.at - tr.lastRollAt < cooldown) return;
  tr.lastRollAt = e.at;
  // An outcome stored without an earned roll (e.g. inside the cooldown) is ignored, as for other drops.
  if (e.drop !== undefined) applyDrop(s, e.drop);
  else tr.pendingRolls[e.id] = { eventId: e.id, at: e.at, tribulationId: e.tribulationId };
}

function applyDrop(s: CultivatorState, drop: MainQuestDrop): void {
  s.tribulations.drops[drop] += 1;
  if (drop === "gain_potion") addPotion(s, "gain");
  if (drop === "legendary_potion") addPotion(s, "legendary");
}

/** Record a pending claim roll's outcome; false when nothing is pending for that event (the caller flags it). */
export function onTribulationDropRolled(s: CultivatorState, e: EventOf<"TribulationDropRolled">): boolean {
  const p = s.tribulations.pendingRolls[e.eventId];
  if (!p) return false;
  delete s.tribulations.pendingRolls[e.eventId];
  applyDrop(s, e.drop);
  return true;
}

/**
 * Map a uniform number u in [0, 1) to a passed tribulation's item roll: an
 * item below the chance, its potion kind by where u landed (ruling 68). The
 * server draws u and stores the outcome.
 */
export function tribulationDropOutcome(u: number, rules: RulesConfig = RULES_V1): MainQuestDrop {
  if (!(u >= 0 && u < 1)) throw new RangeError("u must be in [0, 1)");
  const chance = rules.tribulations.item.chance;
  if (u >= chance) return "none";
  return potionKind(u / chance, rules) === "gain" ? "gain_potion" : "legendary_potion";
}

// ---- Time -------------------------------------------------------------------

/** At each local midnight: apply missed deadlines (ruling 66). */
export function tribulationMidnight(s: CultivatorState, midnight: number, rules: RulesConfig): void {
  for (const t of Object.values(s.tribulations.items)) settleFailure(s, t, midnight, rules);
}

/** Closed-door rest pushes open tribulation deadlines back by the time spent inside (ruling 70); vacation keeps them. */
export function shiftTribulationsAfterRest(s: CultivatorState, rest: { kind: "vacation" | "closed_door"; start: number }, end: number): void {
  if (rest.kind !== "closed_door") return;
  for (const t of Object.values(s.tribulations.items)) {
    const due = t.due;
    if (t.status !== "open" || !due || due.deadline < rest.start) continue;
    due.deadline += Math.max(0, end - Math.max(rest.start, due.definedAt));
  }
}

/** Closed-door rest started close to an open tribulation's deadline is logged, never penalized (ruling 86). */
export function flagRestNearDeadlines(s: CultivatorState, at: number, rules: RulesConfig): void {
  const window = rules.realms.closedDoorFlagHours * HOUR;
  for (const [id, t] of Object.entries(s.tribulations.items)) {
    if (statusAt(s, t, at) !== "open" || !t.due) continue;
    const left = t.due.deadline - at;
    if (left >= 0 && left <= window) s.main.flags.push({ at, code: "rest_near_tribulation", id });
  }
}

// ---- Projections ------------------------------------------------------------

export function tribulationStatus(state: CultivatorState, tribulationId: string): TribulationStatus | null {
  const t = state.tribulations.items[tribulationId];
  return t ? statusAt(state, t, state.clock) : null;
}

/** Claims whose item roll is still to record, oldest first: what the server rolls on sync. */
export function pendingTribulationRolls(state: CultivatorState): PendingTribulationRoll[] {
  return Object.values(state.tribulations.pendingRolls).sort((a, b) => a.at - b.at);
}

/** Push alerts for open tribulations at 72, 48, 24 and 1 hour before the deadline. */
export function tribulationDeadlineAlerts(state: CultivatorState, rules: RulesConfig = RULES_V1): { tribulationId: string; at: number; hoursLeft: number }[] {
  const out: { tribulationId: string; at: number; hoursLeft: number }[] = [];
  for (const [tribulationId, t] of Object.entries(state.tribulations.items)) {
    if (statusAt(state, t, state.clock) !== "open" || !t.due) continue;
    // During closed-door rest the deadline keeps moving; alerts are projected from where it would stand at the rest's end.
    const deadline = state.rest ? effectiveDeadline(t.due, state.rest, state.rest.end) : t.due.deadline;
    for (const h of rules.tribulations.alertHours) {
      const at = deadline - h * HOUR;
      if (at >= state.clock) out.push({ tribulationId, at, hoursLeft: h });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
