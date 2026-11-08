import type { BodyActivityKind, EventOf, Evidence, GameEvent, RoulettePrize } from "@cultivation/schema";
import { RULES_V1, TIERS, type RulesConfig, type Tier } from "./config.js";
import { violate } from "./errors.js";
import { endOfDay, growDemons, initialSoul, onDemonCreated, onDemonDeleted, onDemonRenamed, onSoulTaskLogged, type SoulState } from "./soul.js";
import { DAY, WEEK, localDay, nextLocalMidnight } from "./time.js";

// ---- State --------------------------------------------------------------------

export interface TierChange {
  at: number;
  from: Tier;
  to: Tier;
  reason: "promoted" | "demoted";
}

export interface RestPeriod {
  kind: "vacation" | "closed_door";
  start: number;
  /** Planned end, shortened if RestEnded arrives first. */
  end: number;
}

export interface CultivatorState {
  rulesVersion: string;
  created: boolean;
  name: string;
  tzOffsetMinutes: number;
  /** Last instant the state has been advanced to. Events must not go back in time. */
  clock: number;
  gold: number;
  qi: number;
  companion: {
    tier: Tier;
    food: number;
    /** First paying completion of each activity version (repetition decay). */
    firstCompletedAt: Record<string, number>;
    /** Local day key and routines counted that day (daily cap). */
    routineDay: number;
    routinesToday: number;
  };
  tierHistory: TierChange[];
  activities: Record<string, { name: string; kind: BodyActivityKind }>;
  skills: Record<string, { name: string; ranks: string[]; rank: number | null; evidence: Evidence | null }>;
  /** Timestamps of each skill mastery, in order. */
  masteries: number[];
  haloTickets: { grantedAt: number; expiresAt: number }[];
  rest: RestPeriod | null;
  closedDoorLog: RestPeriod[];
  goldenTickets: number;
  inventory: { potions: number; legendary: number; scales: number; wings: boolean };
  soul: SoulState;
  /** Things that should be impossible (e.g. a second set of wings); flagged, never silently fixed. */
  anomalies: { at: number; code: string }[];
}

export function initialState(rules: RulesConfig = RULES_V1): CultivatorState {
  return {
    rulesVersion: rules.version,
    created: false,
    name: "",
    tzOffsetMinutes: 0,
    clock: 0,
    gold: 0,
    qi: 0,
    companion: {
      tier: "turtle",
      food: rules.tiers.turtle.capacity * rules.tierStartFraction,
      firstCompletedAt: {},
      routineDay: -1,
      routinesToday: 0,
    },
    tierHistory: [],
    activities: {},
    skills: {},
    masteries: [],
    haloTickets: [],
    rest: null,
    closedDoorLog: [],
    goldenTickets: 0,
    inventory: { potions: 0, legendary: 0, scales: 0, wings: false },
    soul: initialSoul(),
    anomalies: [],
  };
}

// ---- Helpers --------------------------------------------------------------------

/**
 * Value multiplier for an activity version that was first completed `ageMs`
 * ago: full value for `fullValueWeeks`, then one step of `weeklyLoss` at the
 * start of each further week, down to `floor`.
 */
export function repetitionMultiplier(ageMs: number, rules: RulesConfig = RULES_V1): number {
  const r = rules.repetition;
  const fullMs = r.fullValueWeeks * WEEK;
  if (ageMs < fullMs) return 1;
  const steps = Math.floor((ageMs - fullMs) / WEEK) + 1;
  return Math.max(r.floor, 1 - r.weeklyLoss * steps);
}

export function goldMultiplier(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  // Additive pool first, then scales and wings multiply the total.
  const pool = 1 + rules.tiers[state.companion.tier].goldBonus;
  const inv = state.inventory;
  const scales = (1 + rules.scales.goldBonusEach) ** inv.scales;
  const wings = inv.wings ? 1 + rules.wings.goldBonus : 1;
  return pool * scales * wings;
}

export function qiMultiplier(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  const inv = state.inventory;
  const scales = (1 + rules.scales.qiBonusEach) ** inv.scales;
  const wings = inv.wings ? 1 + rules.wings.qiBonus : 1;
  return scales * wings;
}

export function masteredCount(state: CultivatorState): number {
  return state.masteries.length;
}

export function pose(state: CultivatorState, rules: RulesConfig = RULES_V1): string {
  const n = masteredCount(state);
  let current = rules.poses[0]?.name ?? "standing";
  for (const p of rules.poses) if (n >= p.minMastered) current = p.name;
  return current;
}

export function haloVisible(state: CultivatorState, now: number, rules: RulesConfig = RULES_V1): boolean {
  const last = state.masteries.at(-1);
  return last !== undefined && now < last + rules.halo.visibleDays * DAY;
}

export function activeHaloTickets(state: CultivatorState, now: number): number {
  return state.haloTickets.filter((t) => now < t.expiresAt).length;
}

/**
 * When the companion's food will fall to `fraction` of its meter, assuming no
 * new activity and no rest. Null for the Turtle (it never leaves) or when it
 * is already below. Used to schedule the "companion hungry" local notification.
 */
export function companionAlertAt(state: CultivatorState, fraction = 0.05, rules: RulesConfig = RULES_V1): number | null {
  const c = state.companion;
  if (c.tier === "turtle") return null;
  const t = rules.tiers[c.tier];
  const target = t.capacity * fraction;
  if (c.food <= target) return null;
  const msPerTreat = WEEK / t.weeklyLoss;
  const restEnd = state.rest ? state.rest.end : state.clock;
  return Math.max(state.clock, restEnd) + Math.ceil((c.food - target) * msPerTreat);
}

function tierIndex(t: Tier): number {
  return TIERS.indexOf(t);
}

function changeTier(s: CultivatorState, to: Tier, at: number, reason: "promoted" | "demoted", rules: RulesConfig) {
  const from = s.companion.tier;
  s.companion.tier = to;
  s.companion.food = rules.tiers[to].capacity * rules.tierStartFraction;
  s.tierHistory.push({ at, from, to, reason });
}

// ---- Time ------------------------------------------------------------------------

/**
 * Move the state forward to `to`: food decays and demons grow continuously,
 * the companion demotes when its meter empties, the soul color is evaluated at
 * each local midnight, and rest pauses food loss and demon growth. Pure
 * function of (state, to, rules); no clock, no randomness.
 */
function advanceMut(s: CultivatorState, to: number, rules: RulesConfig): void {
  if (to < s.clock) violate("out_of_order", `cannot move from ${s.clock} back to ${to}`);
  if (!s.created) {
    s.clock = to;
    return;
  }
  let cur = s.clock;
  while (cur < to) {
    // Stop at every local midnight so the soul color (and with it the demon growth rate) is fixed within a stretch.
    const dayEnd = nextLocalMidnight(cur, s.tzOffsetMinutes);
    let stop = Math.min(to, dayEnd);
    if (s.rest) {
      stop = Math.min(stop, s.rest.end);
    } else {
      advanceCompanion(s, cur, stop, rules);
      growDemons(s.soul, cur, stop, rules);
    }
    cur = stop;
    if (s.rest && cur >= s.rest.end) s.rest = null;
    if (cur === dayEnd) endOfDay(s.soul, cur, rules);
  }
  s.clock = to;
}

/** Food loss over [from, to], a stretch with no rest. */
function advanceCompanion(s: CultivatorState, from: number, to: number, rules: RulesConfig): void {
  let cur = from;
  while (cur < to) {
    const c = s.companion;
    const t = rules.tiers[c.tier];
    const perMs = t.weeklyLoss / WEEK;
    const dt = to - cur;
    if (c.tier === "turtle") {
      c.food = Math.max(0, c.food - perMs * dt);
      cur = to;
      continue;
    }
    const msToEmpty = c.food / perMs;
    if (msToEmpty > dt) {
      c.food -= perMs * dt;
      cur = to;
    } else {
      cur += Math.ceil(msToEmpty);
      const lower = TIERS[tierIndex(c.tier) - 1] as Tier;
      changeTier(s, lower, cur, "demoted", rules);
    }
  }
}

// ---- Event handlers --------------------------------------------------------------

type Handler<T extends GameEvent["type"]> = (s: CultivatorState, e: EventOf<T>, rules: RulesConfig) => void;

const onCreated: Handler<"CultivatorCreated"> = (s, e) => {
  if (s.created) violate("already_created", "cultivator already exists");
  s.created = true;
  s.name = e.name;
  s.tzOffsetMinutes = e.tzOffsetMinutes;
};

const onActivityDefined: Handler<"BodyActivityDefined"> = (s, e) => {
  if (s.activities[e.activityId]) violate("duplicate_activity", `activity ${e.activityId} already defined`);
  s.activities[e.activityId] = { name: e.name, kind: e.kind };
};

const onActivityLogged: Handler<"BodyActivityLogged"> = (s, e, rules) => {
  const activity = s.activities[e.activityId];
  if (!activity) violate("unknown_activity", `activity ${e.activityId} is not defined`);
  const c = s.companion;

  if (activity.kind === "routine") {
    const day = localDay(e.at, s.tzOffsetMinutes);
    if (day !== c.routineDay) {
      c.routineDay = day;
      c.routinesToday = 0;
    }
    // Over the daily cap the routine is still a fact, but it pays nothing.
    if (c.routinesToday >= rules.routinesPerDayCap) return;
    c.routinesToday += 1;
  }

  const first = (c.firstCompletedAt[e.activityId] ??= e.at);
  const rep = repetitionMultiplier(e.at - first, rules);

  // Gold uses the multiplier of the tier the activity was done in.
  s.gold += rules.gold[activity.kind] * rep * goldMultiplier(s, rules);

  c.food += rules.treats[activity.kind] * rep;
  while (c.tier !== "lion" && c.food >= rules.tiers[c.tier].capacity) {
    const higher = TIERS[tierIndex(c.tier) + 1] as Tier;
    changeTier(s, higher, e.at, "promoted", rules);
  }
  if (c.tier === "lion") {
    const cap = rules.tiers.lion.capacity;
    if (c.food >= cap) {
      c.food = cap;
      if (activity.kind === "routine") s.goldenTickets += 1;
    }
  }
};

const onSkillDefined: Handler<"SkillDefined"> = (s, e) => {
  if (s.skills[e.skillId]) violate("duplicate_skill", `skill ${e.skillId} already defined`);
  s.skills[e.skillId] = { name: e.name, ranks: [...e.ranks], rank: null, evidence: null };
};

const onRankAchieved: Handler<"SkillRankAchieved"> = (s, e, rules) => {
  const skill = s.skills[e.skillId];
  if (!skill) violate("unknown_skill", `skill ${e.skillId} is not defined`);
  if (e.rankIndex >= skill.ranks.length) violate("rank_out_of_range", `skill has ${skill.ranks.length} ranks`);
  const current = skill.rank ?? -1;
  if (e.rankIndex < current) violate("rank_never_lost", "ranks are never lost; a lower rank cannot be recorded");
  if (e.rankIndex === current) {
    // Same rank: only the evidence can be updated (e.g. a better video).
    if (!e.evidence) violate("rank_not_higher", "same rank recorded without new evidence");
    skill.evidence = e.evidence;
    return;
  }
  skill.rank = e.rankIndex;
  skill.evidence = e.evidence ?? null;
  if (e.rankIndex === skill.ranks.length - 1) {
    s.masteries.push(e.at);
    s.haloTickets.push({ grantedAt: e.at, expiresAt: e.at + rules.halo.ticketDays * DAY });
  }
};

const onRestStarted: Handler<"RestStarted"> = (s, e, rules) => {
  if (s.rest) violate("already_resting", "a rest period is already active");
  if (e.until <= e.at) violate("rest_ends_before_start", "rest must end after it starts");
  const days = Math.ceil((e.until - e.at) / DAY);

  if (e.kind === "vacation") {
    const cost = days * rules.rest.vacationGoldPerDay;
    if (s.gold < cost) violate("insufficient_gold", `vacation costs ${cost} gold`);
    s.gold -= cost;
  } else {
    const r = rules.rest;
    if (days > r.closedDoorMaxDays) violate("closed_door_too_long", `closed-door cultivation is capped at ${r.closedDoorMaxDays} days`);
    const windowStart = e.at - r.closedDoorWindowDays * DAY;
    const used = s.closedDoorLog.reduce((sum, p) => sum + Math.max(0, p.end - Math.max(p.start, windowStart)), 0);
    if (used + (e.until - e.at) > r.closedDoorMaxDaysPerWindow * DAY) {
      violate("closed_door_quota", `at most ${r.closedDoorMaxDaysPerWindow} closed-door days per ${r.closedDoorWindowDays} days`);
    }
  }
  const period: RestPeriod = { kind: e.kind, start: e.at, end: e.until };
  s.rest = period;
  if (e.kind === "closed_door") s.closedDoorLog.push({ ...period });
};

const onRestEnded: Handler<"RestEnded"> = (s, e) => {
  if (!s.rest) violate("not_resting", "no active rest period");
  if (s.rest.kind === "closed_door") {
    const log = s.closedDoorLog.at(-1);
    if (log) log.end = e.at;
  }
  s.rest = null;
};

const onRouletteSpun: Handler<"RouletteSpun"> = (s, e, rules) => {
  if (s.goldenTickets < 1) violate("no_golden_ticket", "a golden ticket is required");
  s.goldenTickets -= 1;
  const inv = s.inventory;
  switch (e.prize) {
    case "gold":
      s.gold += rules.roulette.goldPrize * goldMultiplier(s, rules);
      break;
    case "qi":
      s.qi += rules.roulette.qiPrize * qiMultiplier(s, rules);
      break;
    case "potion":
      inv.potions += 1;
      break;
    case "legendary":
      inv.legendary += 1;
      break;
    case "scale":
      inv.scales += 1;
      if (inv.scales >= rules.scales.forWings) {
        if (inv.wings) s.anomalies.push({ at: e.at, code: "second_wings" });
        else inv.wings = true;
        inv.scales -= rules.scales.forWings;
      }
      break;
  }
};

const handlers: { [T in GameEvent["type"]]: Handler<T> } = {
  CultivatorCreated: onCreated,
  BodyActivityDefined: onActivityDefined,
  BodyActivityLogged: onActivityLogged,
  SkillDefined: onSkillDefined,
  SkillRankAchieved: onRankAchieved,
  RestStarted: onRestStarted,
  RestEnded: onRestEnded,
  RouletteSpun: onRouletteSpun,
  HeartDemonCreated: (s, e, rules) => onDemonCreated(s.soul, e, rules),
  HeartDemonRenamed: (s, e, rules) => onDemonRenamed(s.soul, e, rules),
  HeartDemonDeleted: (s, e, rules) => onDemonDeleted(s.soul, e, rules),
  SoulTaskLogged: (s, e, rules) => onSoulTaskLogged(s.soul, e, rules),
};

// ---- Public API ---------------------------------------------------------------------

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function applyMut(s: CultivatorState, e: GameEvent, rules: RulesConfig): void {
  if (!s.created) {
    if (e.type !== "CultivatorCreated") violate("not_created", "the cultivator must be created first");
    // The game clock starts at creation; nothing decays before the cultivator exists.
    s.clock = e.at;
  }
  advanceMut(s, e.at, rules);
  (handlers[e.type] as Handler<typeof e.type>)(s, e as never, rules);
}

/** Apply one event. Throws RuleViolation if the event breaks a rule; the input state is untouched. */
export function applyEvent(state: CultivatorState, event: GameEvent, rules: RulesConfig = RULES_V1): CultivatorState {
  const s = clone(state);
  applyMut(s, event, rules);
  return s;
}

/** Advance the state to `to` with no new events (food decay, demotions, rest ending). */
export function advanceTo(state: CultivatorState, to: number, rules: RulesConfig = RULES_V1): CultivatorState {
  const s = clone(state);
  advanceMut(s, to, rules);
  return s;
}

/** Rebuild state from a full event log, optionally advancing to `until` afterwards. */
export function replay(events: readonly GameEvent[], rules: RulesConfig = RULES_V1, until?: number): CultivatorState {
  const s = initialState(rules);
  for (const e of events) applyMut(s, e, rules);
  if (until !== undefined) advanceMut(s, until, rules);
  return s;
}

/**
 * Map a uniform number u in [0, 1) to a roulette prize. The server draws u
 * from a secure RNG and stores the resulting prize in the RouletteSpun event.
 */
export function rouletteOutcome(u: number, rules: RulesConfig = RULES_V1): RoulettePrize {
  if (!(u >= 0 && u < 1)) throw new RangeError("u must be in [0, 1)");
  const bp = Math.floor(u * 10_000);
  const odds = rules.roulette.oddsBp;
  const order: RoulettePrize[] = ["gold", "qi", "potion", "legendary", "scale"];
  let acc = 0;
  for (const prize of order) {
    acc += odds[prize];
    if (bp < acc) return prize;
  }
  return "gold";
}
