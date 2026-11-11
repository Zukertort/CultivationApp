/**
 * Main path, part 3: realms and levels, Step 1 (Qi Condensation, Foundation
 * Establishment, Core Formation, Nascent Soul; then Spirit Realm, where
 * progression stops until Step 2 is built).
 *
 * Settled rules live in docs/design.md, Rulings 73-97. Level-ups and
 * breakthroughs are derived: once a step's conditions hold, its Qi threshold
 * is spent from the balance and the cultivator advances, with no event. The
 * only random outcome is each step's legendary-item roll, which the server
 * appends as a BreakthroughRolled event.
 *
 * Every tribulation counts toward the realm it was declared in (ruling 89):
 * where one couldn't count, declaring or claiming it is rejected, and
 * tribulations left behind by a breakthrough or a discipline change are
 * closed at no cost.
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

/** What each Step 1 realm's tribulations are for, shown on the declaration screen (ruling 87). */
export const REALM_TRIBULATION_PURPOSE: Record<StepOneRealm, string> = {
  qi_condensation: "No tribulations: choosing your three areas is this realm's tribulation.",
  foundation_establishment:
    "Explore and start practicing. Set goals you can reach with your current abilities; they may span different fields.",
  core_formation: "Become a professional: exams, certifications, courses, research, consistent practice.",
  nascent_soul:
    "Become an expert: tangible achievements others recognize, such as publications, teaching at a recognized institution, or becoming a reference in your field. It takes years and needs some luck.",
};

// ---- State ------------------------------------------------------------------

export interface ProgressStep {
  /** Numbered from 1; a legendary roll names its step. */
  step: number;
  at: number;
  kind: "level" | "breakthrough" | "override" | "restart";
  /** The realm and level reached. */
  realm: Realm;
  level: Level | null;
  qiSpent: number;
  /** Fast track: Foundation's threshold was waived (ruling 76). */
  waived: boolean;
  /** A breakthrough's consumed tribulations, for the hall of fame (ruling 96). */
  tribulations: string[];
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

type Entry = [id: string, t: Tribulation];

function entries(s: CultivatorState, realm: Realm): Entry[] {
  return Object.entries(s.tribulations.items).filter(([, t]) => t.realm === realm);
}

const live = ([, t]: Entry) => t.closedAt === null && t.status !== "deleted";
const ids = (list: Entry[]) => list.map(([id]) => id);

/** Foundation's counted tribulations: the first three passed, in passing order (ruling 76). Never wiped (ruling 90). */
function foundationEntries(s: CultivatorState): Entry[] {
  return entries(s, "foundation_establishment")
    .filter(([, t]) => t.status === "passed")
    .sort(([, a], [, b]) => a.passedAt! - b.passedAt!)
    .slice(0, 3);
}

export function foundationPasses(s: CultivatorState): Tribulation[] {
  return foundationEntries(s).map(([, t]) => t);
}

/** Core Formation's set: declared in it under the current discipline, deleted ones left out (rulings 78, 91). */
function coreEntries(s: CultivatorState): Entry[] {
  return entries(s, "core_formation").filter(live);
}

export function coreSet(s: CultivatorState): Tribulation[] {
  return coreEntries(s).map(([, t]) => t);
}

/** The share of Core Formation's set passed, or null while the set is below the minimum. */
export function coreShare(s: CultivatorState, rules: RulesConfig = RULES_V1): number | null {
  const set = coreSet(s);
  if (set.length < rules.realms.coreMinSet) return null;
  return set.filter((t) => t.status === "passed").length / set.length;
}

/** Nascent Soul's sealed set, deleted ones left out (ruling 79). */
function sealedEntries(s: CultivatorState): Entry[] {
  return s.progress.sealedSet.map((id): Entry => [id, s.tribulations.items[id]!]).filter(live);
}

/** Nascent Soul tribulations that would be sealed now: every open or failed one (claims wait for the seal; ruling 89). */
function unsealedCandidates(s: CultivatorState): string[] {
  return ids(entries(s, "nascent_soul").filter((e) => live(e) && (e[1].status === "open" || e[1].status === "failed")));
}

/** Close tribulations at no cost (rulings 89, 91): open and failed ones become "closed"; passed ones stay passed, in the record. */
function close(s: CultivatorState, list: Entry[], at: number): void {
  for (const entry of list) {
    if (!live(entry)) continue;
    const t = entry[1];
    t.closedAt = at;
    if (t.status === "open" || t.status === "failed") {
      t.status = "closed";
      t.due = null;
    }
  }
}

/** Open or failed tribulations of a realm, which can no longer count once it is complete or left. */
function leftovers(s: CultivatorState, realm: Realm): Entry[] {
  return entries(s, realm).filter((e) => live(e) && (e[1].status === "open" || e[1].status === "failed"));
}

/**
 * Whether a tribulation can be declared now (ruling 89): never in Qi
 * Condensation, in a complete Foundation, after Nascent Soul's set is sealed,
 * or in Spirit Realm until Step 2.
 */
export function checkDeclarable(s: CultivatorState): void {
  switch (s.main.realm) {
    case "qi_condensation":
      violate("no_tribulations_here", "Qi Condensation has no tribulations: choosing your three areas is its tribulation");
    case "foundation_establishment":
      if (foundationPasses(s).length >= 3) violate("foundation_complete", "Foundation's three tribulations are already passed");
      return;
    case "nascent_soul":
      if (s.progress.sealedAt !== null) violate("set_sealed", "Nascent Soul's set is sealed; nothing added now would count");
      return;
    case "core_formation":
      return;
    default:
      violate("not_built", "tribulations in Spirit Realm come with Step 2");
  }
}

/** Whether a tribulation can be claimed now: Nascent Soul's only after the seal (rulings 79, 89). */
export function checkClaimable(s: CultivatorState, t: Tribulation): void {
  if (t.realm === "nascent_soul" && s.progress.sealedAt === null) violate("not_sealed", "Nascent Soul's claims count once the set is sealed");
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
      const set = sealedEntries(s);
      // At least one passed tribulation (ruling 95): a set emptied by deletions never transcends.
      const done = set.length > 0 && set.every(([, t]) => t.status === "passed");
      return step("breakthrough", r.breakthroughQi.nascent_soul, done, "tribulations");
    }
    default:
      return null;
  }
}

/**
 * The Qi a tribulation failure takes (ruling 80, for every tribulation; ruling
 * 92): 25% of the next step's threshold, and down to 75% of it when the
 * balance would stay above that, so a failure always means extra work.
 * Floored at the balance by the caller. Tribulations exist only in
 * Foundation, Core Formation and Nascent Soul, whose next steps all cost Qi;
 * anywhere else Nascent Soul's threshold stands in.
 */
export function failureQiLoss(s: CultivatorState, rules: RulesConfig = RULES_V1): number {
  const next = nextStep(s, rules);
  const t = next && next.qi > 0 ? next.qi : rules.realms.breakthroughQi.nascent_soul;
  const share = rules.realms.failureShare;
  return Math.max(share * t, s.qi - (1 - share) * t);
}

// ---- Advancing --------------------------------------------------------------

function record(s: CultivatorState, at: number, kind: ProgressStep["kind"], qiSpent: number, waived: boolean, tribulations: string[] = []): ProgressStep {
  const p = s.progress;
  const entry: ProgressStep = { step: p.steps.length + 1, at, kind, realm: s.main.realm, level: p.level, qiSpent, waived, tribulations };
  p.steps.push(entry);
  return entry;
}

/** The tribulations a breakthrough out of the current realm consumes (ruling 96). */
function consumed(s: CultivatorState): string[] {
  switch (s.main.realm) {
    case "foundation_establishment":
      return ids(foundationEntries(s));
    case "core_formation":
      return ids(coreEntries(s).filter(([, t]) => t.status === "passed"));
    case "nascent_soul":
      return ids(sealedEntries(s));
    default:
      return [];
  }
}

/** Move to the next level, or break through into the next realm, closing what the old realm left open. */
function moveOn(s: CultivatorState, kind: NextStep["kind"], at: number): void {
  const p = s.progress;
  if (kind === "level") {
    p.level = LEVELS[LEVELS.indexOf(p.level!) + 1]!;
    return;
  }
  close(s, leftovers(s, s.main.realm), at);
  const next = NEXT_REALM[s.main.realm]!;
  s.main.realm = next;
  p.level = next === "nascent_soul" || next === "spirit_realm" ? null : "early";
  p.enteredAt = at;
  p.coreChosen = false;
  p.sealedAt = null;
  p.sealedSet = [];
}

/**
 * Every level-up and breakthrough earns one legendary-item roll (rulings 83,
 * 94): a 2% base, plus the tier's breakthrough chance (the Lion's 2%), plus
 * one halo ticket, used up, if one is active (the one expiring first).
 */
function earnLegendaryRoll(s: CultivatorState, step: number, at: number, rules: RulesConfig): void {
  let chance = rules.realms.legendaryBaseChance + rules.tiers[s.companion.tier].breakthroughLegendaryChance;
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
  // Foundation's third pass completes its set: the rest can't count, so they close (ruling 89).
  if (s.main.realm === "foundation_establishment" && foundationPasses(s).length >= 3) close(s, leftovers(s, "foundation_establishment"), at);
  for (let guard = 0; guard < 32; guard++) {
    const next = nextStep(s, rules);
    if (!next || !next.ready) return;
    const cost = next.waived ? 0 : next.qi;
    if (s.qi < cost) return;
    s.qi -= cost;
    const used = next.kind === "breakthrough" ? consumed(s) : [];
    moveOn(s, next.kind, at);
    const entry = record(s, at, next.kind, cost, next.waived, used);
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

/**
 * A core discipline change (ruling 91): the old discipline's Core Formation
 * and Nascent Soul tribulations close at no cost, passed ones staying in the
 * record, and the cultivator returns to early Core Formation.
 */
function changeCoreDiscipline(s: CultivatorState, at: number): void {
  const p = s.progress;
  close(s, [...entries(s, "core_formation"), ...entries(s, "nascent_soul")], at);
  s.main.realm = "core_formation";
  p.level = "early";
  p.enteredAt = at;
  p.sealedAt = null;
  p.sealedSet = [];
  record(s, at, "restart", 0, false);
}

/**
 * Decide or change an area (rulings 75, 88, 90, 91). Changes are free until
 * Qi Condensation's breakthrough locks all three; then Body and Soul cost Qi,
 * a Main change costs Qi in Foundation (nothing restarts), and from Core
 * Formation on it is a core discipline change.
 */
export function onAreaDecided(s: CultivatorState, e: EventOf<"AreaDecided">, rules: RulesConfig): void {
  if (s.main.interview === null) violate("interview_first", "answer the Qi Condensation interview first");
  const p = s.progress;
  const prev = p.areas[e.path];
  if (prev === e.choice) violate("area_unchanged", "this area already has that choice");
  const prices = rules.realms.prices;
  const realm = s.main.realm;
  if (prev !== null && realm !== "qi_condensation") {
    if (e.path !== "main") payQi(s, prices.areaChangeQi);
    else if (realm === "foundation_establishment") payQi(s, prices.foundationSwitchQi);
    else if (realm === "core_formation" || realm === "nascent_soul") {
      payQi(s, prices.coreChangeQi);
      changeCoreDiscipline(s, e.at);
    } else violate("not_built", "changing discipline in Spirit Realm comes with Step 2");
  }
  p.areas[e.path] = e.choice;
}

/** The end-of-Foundation choice (rulings 74, 90): form a core in the chosen discipline, picked for free. */
export function onCoreFormed(s: CultivatorState, e: EventOf<"CoreFormed">): void {
  const p = s.progress;
  const end = s.main.realm === "foundation_establishment" && p.level === "great_circle" && foundationPasses(s).length === 3;
  if (!end) violate("not_end_of_foundation", "a core is formed once Foundation's three tribulations are passed");
  if (p.coreChosen) violate("core_already_chosen", "the core is already chosen");
  p.coreChosen = true;
  p.areas.main = e.choice;
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

export interface ConqueredTribulation {
  tribulationId: string;
  title: string;
  criteria: string;
  /** The realm it was declared in and broken through. */
  realm: Realm;
  passedAt: number;
  evidence: number;
  /** The breakthrough that consumed it. */
  step: number;
  brokeThroughAt: number;
}

/**
 * The hall of fame (ruling 96): every tribulation a breakthrough consumed,
 * oldest first, optionally for one realm. The Spirit Realm spirit quotes a
 * `nascent_soul` entry.
 */
export function conqueredTribulations(state: CultivatorState, realm?: Realm): ConqueredTribulation[] {
  const out: ConqueredTribulation[] = [];
  for (const step of state.progress.steps) {
    for (const id of step.tribulations) {
      const t = state.tribulations.items[id]!;
      if (realm !== undefined && t.realm !== realm) continue;
      out.push({ tribulationId: id, title: t.title, criteria: t.criteria, realm: t.realm, passedAt: t.passedAt!, evidence: t.evidence, step: step.step, brokeThroughAt: step.at });
    }
  }
  return out;
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
  const passed = (list: Entry[]) => ({ passed: list.filter(([, t]) => t.status === "passed").length, total: list.length });
  let tribulations: RealmStatus["tribulations"] = null;
  if (realm === "foundation_establishment") tribulations = { passed: foundationPasses(state).length, total: 3 };
  if (realm === "core_formation") tribulations = passed(coreEntries(state));
  if (realm === "nascent_soul") tribulations = passed(sealedEntries(state));
  return {
    realm,
    level: state.progress.level,
    next: next && { ...next, waitingForQi: next.ready && state.qi < (next.waived ? 0 : next.qi) },
    tribulations,
  };
}
