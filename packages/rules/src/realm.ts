/**
 * Main path, part 3: realms and levels, Step 1 (Qi Condensation, Foundation
 * Establishment, Core Formation, Nascent Soul; then Spirit Realm, where
 * progression stops until Step 2 is built).
 *
 * Settled rules live in docs/design.md, Rulings 73-86. Level-ups and
 * breakthroughs are derived: once a step's conditions hold, its Qi threshold
 * is spent from the balance and the cultivator advances, with no event. The
 * only random outcome is each step's legendary-item roll, which the server
 * appends as a BreakthroughRolled event.
 */
import type { EventOf } from "@cultivation/schema";
import { RULES_V1, type MainPath, type Realm, type RulesConfig, type StepOneRealm } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { violate } from "./errors.js";
import { DAY } from "./time.js";
import type { Tribulation } from "./tribulation.js";

export const LEVELS = ["early", "mid", "late", "great_circle"] as const;
export type Level = (typeof LEVELS)[number];

const NEXT_REALM: Partial<Record<Realm, Realm>> = {
  qi_condensation: "foundation_establishment",
  foundation_establishment: "core_formation",
  core_formation: "nascent_soul",
  nascent_soul: "spirit_realm",
};

// ---- State ------------------------------------------------------------------

export interface ProgressStep {
  /** Numbered from 1; a legendary roll names its step. */
  step: number;
  at: number;
  kind: "level" | "breakthrough" | "override" | "restart";
  realm: Realm;
  level: Level | null;
  qiSpent: number;
  /** Fast track: Foundation's threshold was waived (ruling 76). */
  waived: boolean;
}

/** A level-up or breakthrough's legendary roll with no recorded outcome yet; the server rolls it. */
export interface PendingBreakthroughRoll {
  step: number;
  at: number;
  chance: number;
}

export interface ProgressState {
  /** The level within the realm; null in Nascent Soul and Spirit Realm, which have none. The realm is `main.realm`. */
  level: Level | null;
  areas: Record<MainPath, string | null>;
  /** Discipline epoch: a Main change starts a new one; tribulations declared under an older one never count (ruling 77). */
  epoch: number;
  /** When the current realm was entered (or restarted). */
  enteredAt: number;
  /** End of Foundation: the cultivator chose to form a core (ruling 74). */
  coreChosen: boolean;
  /** Nascent Soul's sealed set (ruling 79). */
  sealedAt: number | null;
  sealedSet: string[];
  steps: ProgressStep[];
  pendingRolls: Record<string, PendingBreakthroughRoll>;
  legendaryRolls: { none: number; legendary: number };
}

export function initialProgress(): ProgressState {
  return {
    level: "early",
    areas: { main: null, body: null, soul: null },
    epoch: 0,
    enteredAt: 0,
    coreChosen: false,
    sealedAt: null,
    sealedSet: [],
    steps: [],
    pendingRolls: {},
    legendaryRolls: { none: 0, legendary: 0 },
  };
}

// ---- Tribulation sets -------------------------------------------------------

function inCurrentRealm(s: CultivatorState, t: Tribulation): boolean {
  return t.realm === s.main.realm && t.epoch === s.progress.epoch;
}

/** Foundation's counted tribulations: the first three passed, in passing order (ruling 76). */
export function foundationPasses(s: CultivatorState): Tribulation[] {
  return Object.values(s.tribulations.items)
    .filter((t) => t.realm === "foundation_establishment" && t.epoch === s.progress.epoch && t.status === "passed")
    .sort((a, b) => a.passedAt! - b.passedAt!)
    .slice(0, 3);
}

/** Core Formation's set: declared in it under the current discipline, deleted ones left out (ruling 78). */
export function coreSet(s: CultivatorState): Tribulation[] {
  return Object.values(s.tribulations.items).filter((t) => t.realm === "core_formation" && t.epoch === s.progress.epoch && t.status !== "deleted");
}

/** The share of Core Formation's set passed, or null while the set is below the minimum. */
export function coreShare(s: CultivatorState, rules: RulesConfig = RULES_V1): number | null {
  const set = coreSet(s);
  if (set.length < rules.realms.coreMinSet) return null;
  return set.filter((t) => t.status === "passed").length / set.length;
}

/** Nascent Soul's sealed set, deleted ones left out (ruling 79). */
function sealedSet(s: CultivatorState): Tribulation[] {
  return s.progress.sealedSet.map((id) => s.tribulations.items[id]!).filter((t) => t.status !== "deleted");
}

/** Nascent Soul tribulations that would be sealed now: declared in it, not yet passed or deleted. */
function unsealedCandidates(s: CultivatorState): string[] {
  return Object.entries(s.tribulations.items)
    .filter(([, t]) => t.realm === "nascent_soul" && t.epoch === s.progress.epoch && (t.status === "open" || t.status === "failed"))
    .map(([id]) => id);
}

/**
 * Whether passing this tribulation now counts toward the current realm's
 * breakthrough: only those earn item rolls (ruling 82). Checked before the
 * claim is applied.
 */
export function countsTowardRealm(s: CultivatorState, tribulationId: string): boolean {
  const t = s.tribulations.items[tribulationId];
  if (!t || !inCurrentRealm(s, t)) return false;
  switch (s.main.realm) {
    case "foundation_establishment":
      return foundationPasses(s).length < 3;
    case "core_formation":
      return t.status !== "deleted";
    case "nascent_soul":
      return s.progress.sealedAt !== null && s.progress.sealedSet.includes(tribulationId);
    default:
      return false;
  }
}

// ---- The next step ----------------------------------------------------------

export interface NextStep {
  kind: "level" | "breakthrough";
  /** The Qi threshold, before any waiver. */
  qi: number;
  /** Fast track: Foundation's threshold is waived (ruling 76). */
  waived: boolean;
  /** Everything but the Qi holds (areas decided, tribulations passed, choice made, set sealed). */
  ready: boolean;
  /** What's still missing besides Qi, for the character screen. */
  missing: "areas" | "tribulations" | "choice" | "seal" | null;
}

/** The next level-up or breakthrough from the current realm and level; null in Spirit Realm. */
export function nextStep(s: CultivatorState, rules: RulesConfig = RULES_V1): NextStep | null {
  const r = rules.realms;
  const p = s.progress;
  const realm = s.main.realm;
  const i = p.level === null ? -1 : LEVELS.indexOf(p.level);
  const step = (kind: NextStep["kind"], qi: number, ready: boolean, missing: NextStep["missing"], waived = false): NextStep => ({
    kind,
    qi,
    waived,
    ready,
    missing: ready ? null : missing,
  });
  switch (realm) {
    case "qi_condensation": {
      const decided = Object.values(p.areas).filter((a) => a !== null).length;
      if (i < 3) return step("level", r.levelQi.qi_condensation, decided >= i + 1, "areas");
      return step("breakthrough", r.breakthroughQi.qi_condensation, decided === 3, "areas");
    }
    case "foundation_establishment": {
      const passes = foundationPasses(s);
      if (i < 3) return step("level", r.levelQi.foundation_establishment, passes.length >= i + 1, "tribulations", (passes[i]?.evidence ?? 0) > 0);
      const allWithEvidence = passes.length === 3 && passes.every((t) => t.evidence > 0);
      return step("breakthrough", r.breakthroughQi.foundation_establishment, p.coreChosen, "choice", allWithEvidence);
    }
    case "core_formation": {
      const share = coreShare(s, rules) ?? 0;
      if (i < 3) return step("level", r.levelQi.core_formation, share >= r.coreShares[i]! - 1e-9, "tribulations");
      return step("breakthrough", r.breakthroughQi.core_formation, share >= 1 - 1e-9, "tribulations");
    }
    case "nascent_soul": {
      if (p.sealedAt === null) return step("breakthrough", r.breakthroughQi.nascent_soul, false, "seal");
      const set = sealedSet(s);
      const done = set.length > 0 && set.every((t) => t.status === "passed" && t.passedAt! >= p.sealedAt!);
      return step("breakthrough", r.breakthroughQi.nascent_soul, done, "tribulations");
    }
    default:
      return null;
  }
}

/**
 * The Qi threshold a tribulation failure is measured against (ruling 80):
 * the next step's, or the next one that costs Qi (Qi Condensation's levels
 * are free, so its breakthrough). Spirit Realm keeps the flat failure cost
 * until Step 2 is built.
 */
function failureThreshold(s: CultivatorState, rules: RulesConfig): number | null {
  const next = nextStep(s, rules);
  if (!next) return null;
  if (next.qi > 0) return next.qi;
  return rules.realms.breakthroughQi[s.main.realm as StepOneRealm] ?? null;
}

/**
 * The Qi a tribulation failure takes (ruling 80): 25% of the current
 * threshold, and down to 75% of it when the balance would stay above that, so
 * a failure always means extra work. Floored at the balance by the caller.
 */
export function failureQiLoss(s: CultivatorState, rules: RulesConfig = RULES_V1): number {
  const t = failureThreshold(s, rules);
  if (t === null) return rules.tribulations.failure.qi;
  const share = rules.realms.failureShare;
  return Math.max(share * t, s.qi - (1 - share) * t);
}

// ---- Advancing --------------------------------------------------------------

function record(s: CultivatorState, at: number, kind: ProgressStep["kind"], qiSpent: number, waived: boolean): ProgressStep {
  const p = s.progress;
  const entry: ProgressStep = { step: p.steps.length + 1, at, kind, realm: s.main.realm, level: p.level, qiSpent, waived };
  p.steps.push(entry);
  return entry;
}

/** Move to the next level, or break through into the next realm. */
function moveOn(s: CultivatorState, kind: NextStep["kind"], at: number): void {
  const p = s.progress;
  if (kind === "level") {
    p.level = LEVELS[LEVELS.indexOf(p.level!) + 1]!;
    return;
  }
  const next = NEXT_REALM[s.main.realm]!;
  s.main.realm = next;
  p.level = next === "nascent_soul" || next === "spirit_realm" ? null : "early";
  p.enteredAt = at;
  p.coreChosen = false;
  p.sealedAt = null;
  p.sealedSet = [];
}

/**
 * Every level-up and breakthrough earns one legendary-item roll (ruling 83):
 * the tier's breakthrough chance (the Lion's 2%) plus one halo ticket, used
 * up, if one is active. A roll with no chance at all is skipped.
 */
function earnLegendaryRoll(s: CultivatorState, step: number, at: number, rules: RulesConfig): void {
  let chance = rules.tiers[s.companion.tier].breakthroughLegendaryChance;
  const tickets = s.haloTickets.filter((t) => at < t.expiresAt).sort((a, b) => a.expiresAt - b.expiresAt);
  if (tickets.length > 0) {
    chance += rules.halo.legendaryBonus;
    s.haloTickets.splice(s.haloTickets.indexOf(tickets[0]!), 1);
  }
  if (chance > 0) s.progress.pendingRolls[String(step)] = { step, at, chance };
}

/**
 * Take every step whose conditions and Qi hold, spending each threshold
 * (rulings 74, 76). Called after every event; a step that waits for Qi
 * ("passed, waiting for Qi") happens at the event that brings the Qi.
 */
export function advanceProgress(s: CultivatorState, at: number, rules: RulesConfig): void {
  for (let guard = 0; guard < 32; guard++) {
    const next = nextStep(s, rules);
    if (!next || !next.ready) return;
    const cost = next.waived ? 0 : next.qi;
    if (s.qi < cost) return;
    s.qi -= cost;
    moveOn(s, next.kind, at);
    const entry = record(s, at, next.kind, cost, next.waived);
    earnLegendaryRoll(s, entry.step, at, rules);
  }
}

/** At each midnight: a Nascent Soul set left unsealed at the end of its window is sealed as it stands (ruling 79). */
export function progressMidnight(s: CultivatorState, midnight: number, rules: RulesConfig): void {
  const p = s.progress;
  if (s.main.realm !== "nascent_soul" || p.sealedAt !== null) return;
  if (midnight < p.enteredAt + rules.realms.sealWithinDays * DAY) return;
  const set = unsealedCandidates(s);
  if (set.length > 0) {
    p.sealedAt = midnight;
    p.sealedSet = set;
  } else {
    // Nothing declared yet: the window starts again.
    p.enteredAt = midnight;
  }
}

// ---- Handlers ---------------------------------------------------------------

function payQi(s: CultivatorState, qi: number): void {
  if (s.qi < qi) violate("insufficient_qi", `this costs ${qi} Qi`);
  s.qi -= qi;
}

/** A Main change restarts Foundation (ruling 77) or Core Formation, under a new discipline epoch. */
function restart(s: CultivatorState, realm: Realm, at: number): void {
  const p = s.progress;
  s.main.realm = realm;
  p.level = "early";
  p.epoch += 1;
  p.enteredAt = at;
  p.coreChosen = false;
  p.sealedAt = null;
  p.sealedSet = [];
  record(s, at, "restart", 0, false);
}

export function onAreaDecided(s: CultivatorState, e: EventOf<"AreaDecided">, rules: RulesConfig): void {
  if (s.main.interview === null) violate("interview_first", "answer the Qi Condensation interview first");
  const p = s.progress;
  const prev = p.areas[e.path];
  if (prev === e.choice) violate("area_unchanged", "this area already has that choice");
  const prices = rules.realms.prices;
  if (prev !== null) {
    const realm = s.main.realm;
    if (e.path !== "main" || realm === "qi_condensation") {
      payQi(s, prices.areaChangeQi);
    } else if (realm === "foundation_establishment") {
      // Free only at the end of Foundation, as the alternative to forming a core (rulings 74, 77).
      const endOfFoundation = p.level === "great_circle" && foundationPasses(s).length === 3 && !p.coreChosen;
      if (!endOfFoundation) payQi(s, prices.foundationSwitchQi);
      restart(s, "foundation_establishment", e.at);
    } else if (realm === "core_formation" || realm === "nascent_soul") {
      payQi(s, prices.coreChangeQi);
      restart(s, "core_formation", e.at);
    } else {
      violate("not_built", "changing discipline in Spirit Realm comes with Step 2");
    }
  }
  p.areas[e.path] = e.choice;
}

export function onCoreFormed(s: CultivatorState): void {
  const p = s.progress;
  const end = s.main.realm === "foundation_establishment" && p.level === "great_circle" && foundationPasses(s).length === 3;
  if (!end) violate("not_end_of_foundation", "a core is formed once Foundation's three tribulations are passed");
  if (p.coreChosen) violate("core_already_chosen", "the core is already chosen");
  p.coreChosen = true;
}

export function onNascentSoulSealed(s: CultivatorState, e: EventOf<"NascentSoulSealed">, rules: RulesConfig): void {
  const p = s.progress;
  if (s.main.realm !== "nascent_soul") violate("not_nascent_soul", "only Nascent Soul's set is sealed");
  if (p.sealedAt !== null) violate("already_sealed", "the set is already sealed");
  if (e.at > p.enteredAt + rules.realms.sealWithinDays * DAY) violate("seal_window_closed", "the set is sealed within 90 days of entering");
  const set = unsealedCandidates(s);
  if (set.length === 0) violate("empty_set", "declare Nascent Soul's tribulations before sealing them");
  p.sealedAt = e.at;
  p.sealedSet = set;
}

/** Advance one level or realm, ignoring Qi and tribulations; free, logged, and with no legendary roll (ruling 84). */
export function onRealmOverride(s: CultivatorState, e: EventOf<"RealmOverride">, rules: RulesConfig): void {
  const next = nextStep(s, rules);
  if (!next) violate("final_realm", "Spirit Realm is the last realm built so far");
  moveOn(s, next.kind, e.at);
  record(s, e.at, "override", 0, false);
  s.main.flags.push({ at: e.at, code: "realm_override", id: String(s.progress.steps.length) });
}

/** Record a pending legendary roll; false when nothing is pending for that step (the caller flags it). */
export function onBreakthroughRolled(s: CultivatorState, e: EventOf<"BreakthroughRolled">): boolean {
  const p = s.progress;
  if (!p.pendingRolls[String(e.step)]) return false;
  delete p.pendingRolls[String(e.step)];
  p.legendaryRolls[e.item] += 1;
  // Until gear exists, a legendary item is stored in the inventory (ruling 83).
  if (e.item === "legendary") s.inventory.legendary += 1;
  return true;
}

/** Map a uniform u in [0, 1) to a step's legendary roll. The server draws u and stores the outcome. */
export function breakthroughRollOutcome(chance: number, u: number): "none" | "legendary" {
  if (!(u >= 0 && u < 1)) throw new RangeError("u must be in [0, 1)");
  return u < chance ? "legendary" : "none";
}

// ---- Projections ------------------------------------------------------------

/** Steps whose legendary roll is still to record, oldest first: what the server rolls. */
export function pendingBreakthroughRolls(state: CultivatorState): PendingBreakthroughRoll[] {
  return Object.values(state.progress.pendingRolls).sort((a, b) => a.step - b.step);
}

export interface RealmStatus {
  realm: Realm;
  level: Level | null;
  next: (NextStep & { waitingForQi: boolean }) | null;
  /** Foundation: counted passes; Core Formation: passed and set size; Nascent Soul: passed and sealed set size. */
  tribulations: { passed: number; total: number } | null;
}

/** Realm, level and the next requirement, for the character screen ("passed, waiting for Qi" included). */
export function realmStatus(state: CultivatorState, rules: RulesConfig = RULES_V1): RealmStatus {
  const next = nextStep(state, rules);
  const realm = state.main.realm;
  let tribulations: RealmStatus["tribulations"] = null;
  if (realm === "foundation_establishment") tribulations = { passed: foundationPasses(state).length, total: 3 };
  if (realm === "core_formation") {
    const set = coreSet(state);
    tribulations = { passed: set.filter((t) => t.status === "passed").length, total: set.length };
  }
  if (realm === "nascent_soul") {
    const set = sealedSet(state);
    tribulations = { passed: set.filter((t) => t.status === "passed").length, total: set.length };
  }
  return {
    realm,
    level: state.progress.level,
    next: next && { ...next, waitingForQi: next.ready && state.qi < (next.waived ? 0 : next.qi) },
    tribulations,
  };
}
