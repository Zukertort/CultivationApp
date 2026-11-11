/**
 * Main path, part 3: realms and levels, Step 1 (Qi Condensation, Foundation
 * Establishment, Core Formation, Nascent Soul; then Spirit Realm, where
 * progression stops until Step 2 is built).
 *
 * Settled rules live in docs/design.md, Rulings 73-109. Level-ups and
 * breakthroughs are derived: once a step's conditions hold, its Qi threshold
 * is spent from the balance and the cultivator advances, with no event. The
 * only random outcome is each step's legendary-item roll, which the server
 * appends as a BreakthroughRolled event.
 *
 * Every tribulation counts toward the realm it was declared in (ruling 89):
 * where one couldn't count, declaring or claiming it is rejected, and
 * tribulations left behind by a breakthrough, a discipline change or a
 * repent are closed at no cost, in the integrity log.
 */
import type { EventOf } from "@cultivation/schema";
import { RULES_V1, type MainPath, type Realm, type RulesConfig, type StepOneRealm } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { violate } from "./errors.js";
import { workDays } from "./main.js";
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
const PREVIOUS_REALM: Partial<Record<Realm, Realm>> = {
  nascent_soul: "core_formation",
  spirit_realm: "nascent_soul",
};

export interface RealmPurpose {
  purpose: string;
  /** Examples for the tribulation creation screen (ruling 87). */
  good: readonly string[];
  bad: readonly string[];
}

/** What each Step 1 realm's tribulations are for, with examples, shown when declaring one (ruling 87). */
export const REALM_TRIBULATION_PURPOSE: Record<StepOneRealm, RealmPurpose> = {
  qi_condensation: {
    purpose: "No tribulations: choosing your three areas is this realm's tribulation.",
    good: [],
    bad: [],
  },
  foundation_establishment: {
    purpose: "Goals to conquer to discover which field of expertise you will pursue. They may span different fields.",
    good: [],
    bad: [],
  },
  core_formation: {
    purpose: "Tangible achievements to become a professional in the chosen path.",
    good: ["Passing a course", "Earning a credential", "A professional license"],
    bad: ['"Work on task 1" (a task)', '"Complete project 1" (a task or quest)', '"Attend a class" (a task)'],
  },
  nascent_soul: {
    purpose: "Tangible achievements that earn expertise and recognition in the path.",
    good: [
      "Teaching the field at a recognized institution",
      "Building a successful company",
      "Reaching 1 million subscribers for a business",
      "Being cited in the field",
    ],
    bad: ["Earning a credential (Core Formation)", '"Complete project 1" (a task or quest)', '"Attend a class" (a task)'],
  },
};

/** Shown with every realm's purpose (ruling 87). */
export const TRIBULATION_TASKS_NOTE = "In every realm, tasks and quests create the milestones toward a tribulation or help with daily life.";

// ---- State ------------------------------------------------------------------

export interface ProgressStep {
  /** Numbered from 1; a legendary roll names its step. */
  step: number;
  at: number;
  kind: "level" | "breakthrough" | "override" | "restart" | "repent";
  /** The realm and level reached. */
  realm: Realm;
  level: Level | null;
  qiSpent: number;
  /** Fast track: Foundation's threshold was waived (ruling 76). */
  waived: boolean;
  /** A breakthrough's consumed tribulations, for the hall of fame (ruling 96). */
  tribulations: string[];
  /** Its legendary roll came out legendary. */
  legendary: boolean;
  /** Undone by a repent: it leaves the hall of fame and its milestone rolls no more (ruling 103). */
  repented: boolean;
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
  /** When Nascent Soul's set was locked (ruling 79); kept while in Spirit Realm. */
  lockedAt: number | null;
  steps: ProgressStep[];
  pendingRolls: Record<string, PendingBreakthroughRoll>;
  legendaryRolls: { none: number; legendary: number };
  /** Repents per realm left, over the cultivator's lifetime (ruling 104). */
  repents: Record<string, number>;
  /** Milestones ("realm:level") a repent undid: re-reaching them earns no legendary roll (ruling 103). */
  noRoll: string[];
  /** Set while the avatar is dead (ruling 106). */
  diedAt: number | null;
  deaths: number;
}

export function initialProgress(): ProgressState {
  return {
    level: "early",
    areas: { main: null, body: null, soul: null },
    enteredAt: 0,
    coreChosen: false,
    lockedAt: null,
    steps: [],
    pendingRolls: {},
    legendaryRolls: { none: 0, legendary: 0 },
    repents: {},
    noRoll: [],
    diedAt: null,
    deaths: 0,
  };
}

const milestone = (realm: Realm, level: Level | null) => `${realm}:${level ?? "-"}`;

// ---- Tribulation sets -------------------------------------------------------

type Entry = [id: string, t: Tribulation];

function entries(s: CultivatorState, realm: Realm): Entry[] {
  return Object.entries(s.tribulations.items).filter(([, t]) => t.realm === realm);
}

const live = ([, t]: Entry) => t.closedAt === null && t.status !== "deleted";
const ids = (list: Entry[]) => list.map(([id]) => id);
const passed = (list: Entry[]) => list.filter(([, t]) => t.status === "passed");

/** Foundation's passes in passing order: the first three set its levels; every one counts (rulings 76, 98). */
function foundationEntries(s: CultivatorState): Entry[] {
  return passed(entries(s, "foundation_establishment").filter(live)).sort(([, a], [, b]) => a.passedAt! - b.passedAt!);
}

/** The first three Foundation passes, which set mid, late and great circle. */
export function foundationPasses(s: CultivatorState): Tribulation[] {
  return foundationEntries(s)
    .slice(0, 3)
    .map(([, t]) => t);
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

/** Nascent Soul's set: every live tribulation declared in it, before or after the lock (ruling 79). */
function nascentEntries(s: CultivatorState): Entry[] {
  return entries(s, "nascent_soul").filter(live);
}

export type ClosedReason = "breakthrough" | "discipline_change" | "repent";

/** Close tribulations at no cost, in the integrity log (rulings 89, 91, 102, 108): open and failed ones become "closed"; passed ones stay passed, in the record. */
function close(s: CultivatorState, list: Entry[], at: number, reason: ClosedReason): void {
  for (const entry of list) {
    if (!live(entry)) continue;
    const [id, t] = entry;
    t.closedAt = at;
    if (t.status === "open" || t.status === "failed") {
      t.status = "closed";
      t.due = null;
    }
    s.main.flags.push({ at, code: "tribulation_closed", id, detail: reason });
  }
}

/** Open or failed tribulations of a realm, which can no longer count once it is left. */
function leftovers(s: CultivatorState, realm: Realm): Entry[] {
  return entries(s, realm).filter((e) => live(e) && (e[1].status === "open" || e[1].status === "failed"));
}

/**
 * Whether a tribulation can be declared now (ruling 89): never in Qi
 * Condensation, or in Spirit Realm until Step 2.
 */
export function checkDeclarable(s: CultivatorState): void {
  if (s.main.realm === "qi_condensation") violate("no_tribulations_here", "Qi Condensation has no tribulations: choosing your three areas is its tribulation");
  if (s.main.realm === "spirit_realm") violate("not_built", "tribulations in Spirit Realm come with Step 2");
}

/** Whether a tribulation can be claimed now: Nascent Soul's only once the set is locked (rulings 79, 89). */
export function checkClaimable(s: CultivatorState, t: Tribulation): void {
  if (t.realm === "nascent_soul" && s.main.realm === "nascent_soul" && s.progress.lockedAt === null) {
    violate("not_locked", "Nascent Soul's claims count once the set is locked");
  }
}

/** Before Nascent Soul's lock, its tribulations are edited and deleted for free (ruling 79). */
export function isUnlockedNascent(s: CultivatorState, t: Tribulation): boolean {
  return t.realm === "nascent_soul" && s.main.realm === "nascent_soul" && s.progress.lockedAt === null;
}

// ---- The next step ----------------------------------------------------------

export interface NextStep {
  kind: "level" | "breakthrough";
  /** The Qi threshold, before any waiver. */
  qi: number;
  /** Fast track: Foundation's threshold is waived (ruling 76). */
  waived: boolean;
  /** Everything but the Qi holds (areas decided, tribulations passed, choice made, set locked). */
  ready: boolean;
  /** What's still missing besides Qi, for the character screen. */
  missing: "areas" | "tribulations" | "choice" | "lock" | null;
}

/** The highest Core Formation level its set's share reaches (rulings 78, 102). */
function coreLevel(s: CultivatorState, rules: RulesConfig): Level {
  const share = coreShare(s, rules) ?? 0;
  return LEVELS[rules.realms.coreShares.filter((x) => share >= x - 1e-9).length]!;
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
      if (p.lockedAt === null) return step("breakthrough", r.breakthroughQi.nascent_soul, false, "lock");
      const set = nascentEntries(s);
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
 * Floored at the balance by the caller. Tribulations live in Foundation, Core
 * Formation and Nascent Soul, whose next steps all cost Qi; anywhere else
 * Nascent Soul's threshold stands in.
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
  const entry: ProgressStep = {
    step: p.steps.length + 1,
    at,
    kind,
    realm: s.main.realm,
    level: p.level,
    qiSpent,
    waived,
    tribulations,
    legendary: false,
    repented: false,
  };
  p.steps.push(entry);
  return entry;
}

/** The tribulations a breakthrough out of the current realm consumes (ruling 96). */
function consumed(s: CultivatorState): string[] {
  switch (s.main.realm) {
    case "foundation_establishment":
      return ids(foundationEntries(s));
    case "core_formation":
      return ids(passed(coreEntries(s)));
    case "nascent_soul":
      return ids(nascentEntries(s));
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
  close(s, leftovers(s, s.main.realm), at, "breakthrough");
  const next = NEXT_REALM[s.main.realm]!;
  s.main.realm = next;
  p.level = next === "nascent_soul" || next === "spirit_realm" ? null : "early";
  p.enteredAt = at;
  p.coreChosen = false;
  // Spirit Realm keeps Nascent Soul's lock, in case a repent returns there (ruling 102).
  if (next === "nascent_soul") p.lockedAt = null;
}

/**
 * Every level-up and breakthrough earns one legendary-item roll (rulings 83,
 * 94): a 2% base, plus the tier's breakthrough chance (the Lion's 2%), plus
 * one halo ticket, used up, if one is active (the one expiring first). A
 * milestone a repent undid earns none (ruling 103).
 */
function earnLegendaryRoll(s: CultivatorState, step: ProgressStep, rules: RulesConfig): void {
  if (s.progress.noRoll.includes(milestone(step.realm, step.level))) return;
  let chance = rules.realms.legendaryBaseChance + rules.tiers[s.companion.tier].breakthroughLegendaryChance;
  const tickets = s.haloTickets.filter((t) => step.at < t.expiresAt).sort((a, b) => a.expiresAt - b.expiresAt);
  if (tickets.length > 0) {
    chance += rules.halo.legendaryBonus;
    s.haloTickets.splice(s.haloTickets.indexOf(tickets[0]!), 1);
  }
  if (chance > 0) s.progress.pendingRolls[String(step.step)] = { step: step.step, at: step.at, chance };
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
    const used = next.kind === "breakthrough" ? consumed(s) : [];
    moveOn(s, next.kind, at);
    earnLegendaryRoll(s, record(s, at, next.kind, cost, next.waived, used), rules);
  }
}

/** At each midnight: a Nascent Soul set left unlocked at the end of its window is locked as it stands (ruling 79). */
export function progressMidnight(s: CultivatorState, midnight: number, rules: RulesConfig): void {
  const p = s.progress;
  if (s.main.realm !== "nascent_soul" || p.lockedAt !== null) return;
  if (midnight < p.enteredAt + rules.realms.lockWithinDays * DAY) return;
  if (nascentEntries(s).length > 0) p.lockedAt = midnight;
  // Nothing declared yet: the window starts again.
  else p.enteredAt = midnight;
}

// ---- Death ------------------------------------------------------------------

export interface DeathSnapshot {
  qi: number;
  gold: number;
  goldenTickets: number;
  inventory: CultivatorState["inventory"];
  debt: { qi: number; gold: number };
  pending: string[][];
}

const pendingMaps = (s: CultivatorState) => [s.soul.pendingRolls, s.main.pendingRolls, s.tribulations.pendingRolls, s.progress.pendingRolls];

/** What a dead cultivator holds before an event or a stretch of time; null while alive. */
export function deathSnapshot(s: CultivatorState): DeathSnapshot | null {
  if (s.progress.diedAt === null) return null;
  return {
    qi: s.qi,
    gold: s.gold,
    goldenTickets: s.goldenTickets,
    inventory: { ...s.inventory },
    debt: { ...s.main.debt },
    pending: pendingMaps(s).map((m) => Object.keys(m)),
  };
}

/** While dead, nothing pays Qi, gold or drops (ruling 106): gains since the snapshot are undone, losses stay. */
export function clampWhileDead(s: CultivatorState, before: DeathSnapshot | null): void {
  if (!before) return;
  s.qi = Math.min(s.qi, before.qi);
  s.gold = Math.min(s.gold, before.gold);
  s.goldenTickets = Math.min(s.goldenTickets, before.goldenTickets);
  const inv = s.inventory;
  inv.gainPotions = Math.min(inv.gainPotions, before.inventory.gainPotions);
  inv.legendaryPotions = Math.min(inv.legendaryPotions, before.inventory.legendaryPotions);
  inv.legendary = Math.min(inv.legendary, before.inventory.legendary);
  inv.scales = Math.min(inv.scales, before.inventory.scales);
  inv.wings = inv.wings && before.inventory.wings;
  s.main.debt.qi = Math.max(s.main.debt.qi, before.debt.qi);
  s.main.debt.gold = Math.max(s.main.debt.gold, before.debt.gold);
  pendingMaps(s).forEach((m, i) => {
    for (const key of Object.keys(m)) if (!before.pending[i]!.includes(key)) delete m[key];
  });
}

/**
 * Revival (ruling 106): a quest defined after death, completed with no member
 * cancelled or failed, holding at least a week of work (ruling 51's week band).
 */
export function checkRevival(s: CultivatorState, at: number, rules: RulesConfig): void {
  const p = s.progress;
  if (p.diedAt === null) return;
  const m = s.main;
  const revived = Object.entries(m.quests).find(
    ([, q]) =>
      q.due.definedAt >= p.diedAt! &&
      q.completedAt !== null &&
      !q.forfeited &&
      workDays(
        q.taskIds.map((id) => m.tasks[id]!.effort),
        rules,
      ) >=
        rules.realms.repent.revivalWorkDays - 1e-9,
  );
  if (!revived) return;
  p.diedAt = null;
  m.flags.push({ at, code: "revived", id: revived[0] });
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
  close(s, [...entries(s, "core_formation"), ...entries(s, "nascent_soul")], at, "discipline_change");
  s.main.realm = "core_formation";
  p.level = "early";
  p.enteredAt = at;
  p.lockedAt = null;
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

export function onNascentSoulLocked(s: CultivatorState, e: EventOf<"NascentSoulLocked">, rules: RulesConfig): void {
  const p = s.progress;
  if (s.main.realm !== "nascent_soul") violate("not_nascent_soul", "only Nascent Soul's set is locked");
  if (p.lockedAt !== null) violate("already_locked", "the set is already locked");
  if (e.at > p.enteredAt + rules.realms.lockWithinDays * DAY) violate("lock_window_closed", "the set is locked within 90 days of entering");
  if (nascentEntries(s).length === 0) violate("empty_set", "declare Nascent Soul's tribulations before locking them");
  p.lockedAt = e.at;
}

/** Advance one level or realm, ignoring Qi and tribulations; free, logged, and with no legendary roll (ruling 84). */
export function onRealmOverride(s: CultivatorState, e: EventOf<"RealmOverride">, rules: RulesConfig): void {
  const next = nextStep(s, rules);
  if (!next) violate("final_realm", "Spirit Realm is the last realm built so far");
  moveOn(s, next.kind, e.at);
  record(s, e.at, "override", 0, false);
  s.main.flags.push({ at: e.at, code: "realm_override", id: String(s.progress.steps.length) });
}

/** The index of the step that last entered `realm` (a breakthrough, override or restart; not a repent), or -1. */
function entryIndex(steps: ProgressStep[], realm: Realm): number {
  for (let i = steps.length - 1; i >= 0; i--) {
    const x = steps[i]!;
    if (x.realm !== realm || x.kind === "repent") continue;
    if (x.kind === "restart" || i === 0 || steps[i - 1]!.realm !== realm) return i;
  }
  return -1;
}

/** Take up to `n` inventory items, least valuable first (ruling 104); "all" empties the inventory. */
function loseItems(s: CultivatorState, n: number | "all"): number {
  const inv = s.inventory;
  let left = n === "all" ? Infinity : n;
  let lost = 0;
  const take = (key: "gainPotions" | "legendaryPotions" | "scales" | "legendary") => {
    const k = Math.min(inv[key], left);
    inv[key] -= k;
    left -= k;
    lost += k;
  };
  take("gainPotions");
  take("legendaryPotions");
  take("scales");
  take("legendary");
  if (inv.wings && left > 0) {
    inv.wings = false;
    lost += 1;
  }
  return lost;
}

/**
 * Repent (rulings 101-107): from Nascent Soul upward, admit that tribulations
 * of the previous realm were faked. They become failed at no cost; the
 * cultivator drops to the previous realm at the level its remaining passes
 * reach; the realm left closes its tribulations and resets its lock; the
 * undone steps' legendary items are removed and their milestones roll no
 * more; and each repent in the same realm escalates the penalty, the fifth
 * killing the avatar.
 */
export function onRepented(s: CultivatorState, e: EventOf<"Repented">, rules: RulesConfig): void {
  const p = s.progress;
  const realm = s.main.realm;
  const prev = PREVIOUS_REALM[realm];
  if (!prev) violate("repent_not_available", "repenting is available from Nascent Soul upward");
  const entryAt = entryIndex(p.steps, realm);
  const entry = p.steps[entryAt];
  const faked = [...new Set(e.faked)];
  if (faked.length === 0 && entry?.kind !== "override") violate("repent_needs_tribulations", "mark at least one faked tribulation of the previous realm");
  for (const id of faked) {
    const t = s.tribulations.items[id];
    if (!t || t.realm !== prev || t.status !== "passed" || t.closedAt !== null) violate("not_repentable", `tribulation ${id} isn't a passed tribulation of the previous realm`);
  }

  // The faked ones fail at no cost and need a new date.
  for (const id of faked) {
    const t = s.tribulations.items[id]!;
    t.status = "failed";
    t.failedAt = e.at;
    t.passedAt = null;
    t.due = null;
    s.main.flags.push({ at: e.at, code: "tribulation_faked", id });
  }

  // The realm left closes its tribulations and its lock (ruling 102).
  close(s, entries(s, realm), e.at, "repent");
  if (realm === "nascent_soul") p.lockedAt = null;

  // Drop to the previous realm, at the level its remaining passes reach (ruling 102; the second exception to ruling 85).
  s.main.realm = prev;
  p.level = prev === "core_formation" ? coreLevel(s, rules) : null;
  p.enteredAt = e.at;
  const newIndex = p.level === null ? -1 : LEVELS.indexOf(p.level);

  // Undo the breakthrough into the realm left and the previous realm's level-ups above the new level.
  const prevEntry = entryIndex(p.steps, prev);
  const undone = p.steps.filter(
    (x, i) =>
      !x.repented &&
      (i === entryAt || (i > prevEntry && i < entryAt && x.realm === prev && x.level !== null && LEVELS.indexOf(x.level) > newIndex)),
  );
  let legendary = 0;
  for (const x of undone) {
    x.repented = true;
    // Only milestones that earned a roll lose it; an override never rolled.
    const key = milestone(x.realm, x.level);
    if (x.kind !== "override" && !p.noRoll.includes(key)) p.noRoll.push(key);
    delete p.pendingRolls[String(x.step)];
    if (x.legendary) legendary += 1;
  }
  s.inventory.legendary -= Math.min(s.inventory.legendary, legendary);
  record(s, e.at, "repent", 0, false);

  // Escalation, counted per realm left over the lifetime (ruling 104).
  const count = (p.repents[realm] ?? 0) + 1;
  p.repents[realm] = count;
  const r = rules.realms.repent;
  const penalty = r.penalties[Math.min(count, r.penalties.length) - 1]!;
  loseItems(s, penalty.items);
  s.gold -= s.gold * penalty.gold;
  s.qi -= s.qi * penalty.qi;
  s.main.flags.push({ at: e.at, code: "repented", id: realm, detail: String(count) });
  if (count > r.cyclingFlagAfter) s.main.flags.push({ at: e.at, code: "repent_cycling", id: realm, detail: String(count) });
  if (penalty.death && p.diedAt === null) {
    p.diedAt = e.at;
    p.deaths += 1;
    s.main.flags.push({ at: e.at, code: "died", id: realm, detail: String(count) });
  }
}

/** Record a pending legendary roll; false when nothing is pending for that step (the caller flags it). */
export function onBreakthroughRolled(s: CultivatorState, e: EventOf<"BreakthroughRolled">): boolean {
  const p = s.progress;
  if (!p.pendingRolls[String(e.step)]) return false;
  delete p.pendingRolls[String(e.step)];
  p.legendaryRolls[e.item] += 1;
  // Until gear exists, a legendary item is stored in the inventory (ruling 83).
  if (e.item === "legendary") {
    s.inventory.legendary += 1;
    const step = p.steps[e.step - 1];
    if (step) step.legendary = true;
  }
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
 * oldest first, optionally for one realm; a repented breakthrough's leave it
 * (ruling 107). The Spirit Realm spirit quotes a `nascent_soul` entry.
 */
export function conqueredTribulations(state: CultivatorState, realm?: Realm): ConqueredTribulation[] {
  const out: ConqueredTribulation[] = [];
  for (const step of state.progress.steps) {
    if (step.repented) continue;
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
  /** Foundation: passes toward great circle (of 3); Core Formation and Nascent Soul: passed and set size. */
  tribulations: { passed: number; total: number } | null;
  dead: boolean;
}

/** Realm, level and the next requirement, for the character screen ("passed, waiting for Qi" included). */
export function realmStatus(state: CultivatorState, rules: RulesConfig = RULES_V1): RealmStatus {
  const next = nextStep(state, rules);
  const realm = state.main.realm;
  const count = (list: Entry[]) => ({ passed: passed(list).length, total: list.length });
  let tribulations: RealmStatus["tribulations"] = null;
  if (realm === "foundation_establishment") tribulations = { passed: foundationPasses(state).length, total: 3 };
  if (realm === "core_formation") tribulations = count(coreEntries(state));
  if (realm === "nascent_soul") tribulations = count(nascentEntries(state));
  return {
    realm,
    level: state.progress.level,
    next: next && { ...next, waitingForQi: next.ready && state.qi < (next.waived ? 0 : next.qi) },
    tribulations,
    dead: state.progress.diedAt !== null,
  };
}
