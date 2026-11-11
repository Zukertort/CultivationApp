/**
 * Soul path: heart demons and the soul color they produce.
 *
 * Demon HP is a percentage (0-100). Positive tasks and soul quests damage
 * demons, negative tasks heal them, and after a grace period without a
 * positive task a demon heals on its own. The soul color is evaluated once per
 * local day, at its end, so a demon that crosses 70% during the day can still
 * be pushed back in time. Rest freezes only time-driven changes (demon growth,
 * the end-of-day color evaluation, the Golden clock); the cultivator's own
 * actions still apply at once. See "Rulings" in docs/design.md.
 */
import type { EventOf, SoulDrop, SoulTask } from "@cultivation/schema";
import { GROWTH_COLORS, WEAKENING_COLORS, type RulesConfig, type SoulColor, type SoulDropBand } from "./config.js";
import { potionKind } from "./economy.js";
import { violate } from "./errors.js";
import { DAY } from "./time.js";

/** Float tolerance for HP thresholds (passive growth produces fractions). */
const HP_EPS = 1e-9;

/** Fixed order in which drop bands are laid out on [0, 1). */
export const SOUL_DROP_ORDER: readonly SoulDropBand[] = ["gold", "qi", "item", "legendary", "lose_gold", "lose_qi", "lose_item"];

export interface HeartDemon {
  name: string;
  positiveTasks: SoulTask[];
  negativeTasks: SoulTask[];
  hp: number;
  defeated: boolean;
  createdAt: number;
  /**
   * Time since the last positive task or quest (or creation), not counting
   * rest. Passive growth applies to the part beyond the grace period.
   */
  idleMs: number;
  defeats: number;
  revivals: number;
  /** A soul wearable freezes its growth until then (ruling 118). */
  frozenUntil: number | null;
}

export interface SoulQuest {
  name: string;
  demonIds: string[];
  completedAt: number | null;
}

export type SoulColorReason = "day_end" | "first_demon" | "deletion";

export interface SoulColorChange {
  at: number;
  from: SoulColor;
  to: SoulColor;
  reason: SoulColorReason;
}

export interface DemonHistoryEntry {
  at: number;
  demonId: string;
  kind: "created" | "defeated" | "revived" | "renamed" | "deleted";
}

export interface SoulState {
  color: SoulColor;
  demons: Record<string, HeartDemon>;
  quests: Record<string, SoulQuest>;
  firstDemonAt: number | null;
  lastDemonCreatedAt: number | null;
  lastRevivalAt: number | null;
  /**
   * Golden clock: non-resting time since the Golden condition (every demon
   * defeated, at least 7) first held. Null until then; a revival resets it to
   * null. Golden, Translucent and Rainbow need the condition to hold now and
   * the clock to have run 1 week, 1 month and 1 year.
   */
  goldenClockMs: number | null;
  /**
   * Set when a demon is deleted at a growth color: the soul drops to White and
   * stays there (unless it weakens further) until the next demon is defeated.
   */
  heldAtWhite: boolean;
  /** How many of each drop outcome were recorded. */
  drops: Partial<Record<SoulDrop, number>>;
  /** Drop rolls a task event earned but whose outcome isn't recorded yet, by event id. */
  pendingRolls: Record<string, PendingRoll>;
  /** Local day of the last earned roll, and rolls earned that day (daily cap). */
  rollDay: number;
  rollsToday: number;
  colorHistory: SoulColorChange[];
  demonHistory: DemonHistoryEntry[];
}

export type SoulPolarity = "positive" | "negative";

/**
 * Rolls earned by a task event and not yet recorded. The server rolls them
 * with `soulDropOutcome(color, polarity, u)` and appends a SoulDropRolled.
 */
export interface PendingRoll {
  eventId: string;
  at: number;
  /** The soul color when the task was logged: the roll uses its odds. */
  color: SoulColor;
  polarity: SoulPolarity;
  count: number;
}

export function initialSoul(): SoulState {
  return {
    color: "broken",
    demons: {},
    quests: {},
    firstDemonAt: null,
    lastDemonCreatedAt: null,
    lastRevivalAt: null,
    goldenClockMs: null,
    heldAtWhite: false,
    drops: {},
    pendingRolls: {},
    rollDay: -1,
    rollsToday: 0,
    colorHistory: [],
    demonHistory: [],
  };
}

export function isWeakening(color: SoulColor): boolean {
  return WEAKENING_COLORS.includes(color);
}

export function isGrowth(color: SoulColor): boolean {
  return GROWTH_COLORS.includes(color);
}

/** Every demon defeated, with at least the Golden minimum. */
export function goldenCondition(soul: SoulState, rules: RulesConfig): boolean {
  const demons = Object.values(soul.demons);
  return demons.length >= rules.soul.growth.goldenMinDemons && demons.every((d) => d.defeated);
}

/**
 * The color the soul would get if evaluated now. Weakening colors take
 * precedence (any single demon is enough), then the growth ladder from the top.
 */
export function evaluateSoulColor(soul: SoulState, rules: RulesConfig): SoulColor {
  const r = rules.soul;
  const demons = Object.values(soul.demons);
  if (demons.length === 0) return "broken";

  const top = Math.max(...demons.map((d) => d.hp));
  if (top > r.weakening.broken) return "broken";
  if (top > r.weakening.black) return "black";
  if (top > r.weakening.violet) return "violet";
  if (soul.heldAtWhite) return "white";

  const g = r.growth;
  if (goldenCondition(soul, rules) && soul.goldenClockMs !== null) {
    const clock = soul.goldenClockMs;
    if (clock >= g.goldenClockDays.rainbow * DAY) return "rainbow";
    if (clock >= g.goldenClockDays.translucent * DAY) return "translucent";
    if (clock >= g.goldenClockDays.golden * DAY) return "golden";
  }
  const created = demons.length;
  const defeated = demons.filter((d) => d.defeated).length;
  if (created >= g.red.created && defeated >= g.red.defeated) return "red";
  if (created >= g.blue.created && defeated >= g.blue.defeated) return "blue";
  if (created >= g.green.created && defeated >= g.green.defeated) return "green";
  return "white";
}

function setColor(soul: SoulState, to: SoulColor, at: number, reason: SoulColorReason): void {
  if (soul.color === to) return;
  soul.colorHistory.push({ at, from: soul.color, to, reason });
  soul.color = to;
}

/** Evaluate the soul color at the end of a local day. The engine skips this during rest. */
export function endOfDay(soul: SoulState, at: number, rules: RulesConfig): void {
  setColor(soul, evaluateSoulColor(soul, rules), at, "day_end");
}

/** Start the Golden clock the first time the condition holds (after any change that can make it hold). */
function syncGoldenClock(soul: SoulState, rules: RulesConfig): void {
  if (soul.goldenClockMs === null && goldenCondition(soul, rules)) soul.goldenClockMs = 0;
}

/** Set a demon's HP, clamped, and apply defeat at 0 and revival at the revive threshold. */
function setHp(soul: SoulState, demonId: string, d: HeartDemon, hp: number, at: number, rules: RulesConfig): void {
  const r = rules.soul;
  d.hp = Math.min(r.maxHp, Math.max(0, hp));
  if (!d.defeated && d.hp <= HP_EPS) {
    d.hp = 0;
    d.defeated = true;
    d.defeats += 1;
    soul.heldAtWhite = false;
    soul.demonHistory.push({ at, demonId, kind: "defeated" });
  } else if (d.defeated && d.hp >= r.reviveHp - HP_EPS) {
    revive(soul, demonId, d, at);
  }
}

function revive(soul: SoulState, demonId: string, d: HeartDemon, at: number): void {
  d.defeated = false;
  d.revivals += 1;
  soul.lastRevivalAt = at;
  soul.goldenClockMs = null;
  soul.demonHistory.push({ at, demonId, kind: "revived" });
}

function attack(soul: SoulState, demonId: string, d: HeartDemon, at: number, rules: RulesConfig): void {
  d.idleMs = 0;
  setHp(soul, demonId, d, d.hp - rules.soul.positiveDamage, at, rules);
}

/**
 * Passive time over [from, to], a stretch with no rest and no day boundary
 * inside it (so the soul color, and with it the growth rate, is constant):
 * the Golden clock runs and demons heal after their grace period.
 */
export function advanceSoul(soul: SoulState, from: number, to: number, rules: RulesConfig): void {
  const p = rules.soul.passive;
  const r = rules.soul;
  const dt = to - from;
  if (soul.goldenClockMs !== null) soul.goldenClockMs += dt;

  const grace = p.graceDays * DAY;
  const hpPerDay = p.hpPerDay * p.colorMultiplier[soul.color];
  for (const [demonId, d] of Object.entries(soul.demons)) {
    const before = d.idleMs;
    d.idleMs = before + dt;
    let growMs = Math.max(0, d.idleMs - grace) - Math.max(0, before - grace);
    // Growth happens in the stretch's tail past the grace; a soul wearable's freeze removes its start (ruling 118).
    if (d.frozenUntil !== null && d.frozenUntil > to - growMs) growMs = Math.max(0, to - Math.max(to - growMs, d.frozenUntil));
    if (growMs <= 0 || hpPerDay <= 0 || d.hp >= r.maxHp) continue;

    const hp0 = d.hp;
    const wasDefeated = d.defeated;
    d.hp = Math.min(r.maxHp, hp0 + (hpPerDay * growMs) / DAY);
    if (wasDefeated && d.hp >= r.reviveHp - HP_EPS) {
      // Revive at the instant the demon crossed the threshold, not at the end of the stretch.
      const growStart = to - growMs;
      const crossAt = Math.min(to, growStart + Math.ceil(((r.reviveHp - hp0) * DAY) / hpPerDay));
      revive(soul, demonId, d, crossAt);
    }
  }
}

// ---- Event handlers -----------------------------------------------------------------

function checkTasks(soul: SoulState, e: EventOf<"HeartDemonCreated" | "HeartDemonRenamed">): void {
  const ids = [...e.positiveTasks, ...e.negativeTasks].map((t) => t.taskId);
  const taken = new Set<string>();
  for (const [demonId, d] of Object.entries(soul.demons)) {
    if (demonId === e.demonId) continue;
    for (const t of [...d.positiveTasks, ...d.negativeTasks]) taken.add(t.taskId);
  }
  const seen = new Set<string>();
  for (const id of ids) {
    // A soul task links to exactly one demon.
    if (seen.has(id) || taken.has(id)) violate("duplicate_task", `soul task ${id} is already linked to a demon`);
    seen.add(id);
  }
}

function getDemon(soul: SoulState, demonId: string): HeartDemon {
  const d = soul.demons[demonId];
  if (!d) violate("unknown_demon", `demon ${demonId} does not exist`);
  return d;
}

export function onDemonCreated(soul: SoulState, e: EventOf<"HeartDemonCreated">, rules: RulesConfig): void {
  const r = rules.soul;
  if (soul.demons[e.demonId]) violate("duplicate_demon", `demon ${e.demonId} already exists`);
  if (soul.lastDemonCreatedAt !== null && e.at - soul.lastDemonCreatedAt < r.newDemonCooldownDays * DAY) {
    violate("demon_weekly_limit", `at most one new demon every ${r.newDemonCooldownDays} days`);
  }
  checkTasks(soul, e);

  const hadDemons = Object.keys(soul.demons).length > 0;
  soul.demons[e.demonId] = {
    name: e.name,
    positiveTasks: e.positiveTasks.map((t) => ({ ...t })),
    negativeTasks: e.negativeTasks.map((t) => ({ ...t })),
    hp: r.startHp,
    defeated: false,
    createdAt: e.at,
    idleMs: 0,
    defeats: 0,
    revivals: 0,
    frozenUntil: null,
  };
  soul.firstDemonAt ??= e.at;
  soul.lastDemonCreatedAt = e.at;
  soul.demonHistory.push({ at: e.at, demonId: e.demonId, kind: "created" });

  // Identifying a demon lifts the soul out of Broken right away, even during rest (an action, not time).
  if (!hadDemons && soul.color === "broken") setColor(soul, "white", e.at, "first_demon");
}

export function onDemonRenamed(soul: SoulState, e: EventOf<"HeartDemonRenamed">, rules: RulesConfig): void {
  const d = getDemon(soul, e.demonId);
  if (d.defeated) violate("demon_defeated_locked", "a defeated demon can't be renamed until it revives");
  checkTasks(soul, e);
  d.name = e.name;
  d.positiveTasks = e.positiveTasks.map((t) => ({ ...t }));
  d.negativeTasks = e.negativeTasks.map((t) => ({ ...t }));
  // A renamed demon is a new fight: below 50% it goes back to 50%; above, it keeps its HP.
  if (d.hp < rules.soul.renameMinHp) d.hp = rules.soul.renameMinHp;
  soul.demonHistory.push({ at: e.at, demonId: e.demonId, kind: "renamed" });
}

export function onDemonDeleted(soul: SoulState, e: EventOf<"HeartDemonDeleted">, rules: RulesConfig): void {
  const r = rules.soul;
  const d = getDemon(soul, e.demonId);
  if (d.defeated) violate("demon_defeated_locked", "a defeated demon can't be deleted until it revives");
  if (e.at - d.createdAt < r.deletionLockDays * DAY) {
    violate("demon_deletion_locked", `a demon can't be deleted in its first ${r.deletionLockDays} days`);
  }
  const weakening = isWeakening(soul.color);
  const remaining = Object.keys(soul.demons).length - 1;
  if (weakening && remaining === 0) violate("last_demon_locked", "the last demon can't be deleted while the soul is weakened");

  delete soul.demons[e.demonId];
  soul.demonHistory.push({ at: e.at, demonId: e.demonId, kind: "deleted" });

  if (weakening) {
    // The remaining demons feed on the deletion until the strongest is at 80%.
    const others = Object.entries(soul.demons);
    const top = Math.max(...others.map(([, o]) => o.hp));
    const feed = Math.max(0, r.deletionFeedToHp - top);
    if (feed > 0) for (const [id, o] of others) setHp(soul, id, o, o.hp + feed, e.at, rules);
  } else if (isGrowth(soul.color)) {
    soul.heldAtWhite = true;
    setColor(soul, "white", e.at, "deletion");
  }
  // At White nothing happens now; with no demon left, the day's end turns the soul Broken.
  syncGoldenClock(soul, rules);
}

/** A tagged Main task's Soul credit: one positive task's damage to the demon (ruling 116). */
export function crossCreditAttack(soul: SoulState, demonId: string, at: number, rules: RulesConfig): void {
  attack(soul, demonId, soul.demons[demonId]!, at, rules);
  syncGoldenClock(soul, rules);
}

/** Apply a soul task's HP change. Returns its polarity, which decides the kind of drop roll. */
export function onSoulTaskLogged(soul: SoulState, e: EventOf<"SoulTaskLogged">, rules: RulesConfig): SoulPolarity {
  for (const [demonId, d] of Object.entries(soul.demons)) {
    if (d.positiveTasks.some((t) => t.taskId === e.taskId)) {
      attack(soul, demonId, d, e.at, rules);
      syncGoldenClock(soul, rules);
      return "positive";
    }
    if (d.negativeTasks.some((t) => t.taskId === e.taskId)) {
      setHp(soul, demonId, d, d.hp + rules.soul.negativeHeal, e.at, rules);
      return "negative";
    }
  }
  violate("unknown_task", `soul task ${e.taskId} is not linked to any demon`);
}

export function onQuestDefined(soul: SoulState, e: EventOf<"SoulQuestDefined">): void {
  if (soul.quests[e.questId]) violate("duplicate_quest", `soul quest ${e.questId} already exists`);
  if (new Set(e.demonIds).size !== e.demonIds.length) violate("duplicate_quest_demon", "a quest links each demon once");
  for (const id of e.demonIds) getDemon(soul, id);
  soul.quests[e.questId] = { name: e.name, demonIds: [...e.demonIds], completedAt: null };
}

/**
 * One attack on every linked demon that still exists; a quest completes once.
 * Returns how many demons it hit (it earns one roll per demon, under the daily cap).
 */
export function onQuestCompleted(soul: SoulState, e: EventOf<"SoulQuestCompleted">, rules: RulesConfig): number {
  const q = soul.quests[e.questId];
  if (!q) violate("unknown_quest", `soul quest ${e.questId} does not exist`);
  if (q.completedAt !== null) violate("quest_already_completed", "a soul quest expires when completed");
  const targets = q.demonIds.flatMap((id) => {
    const d = soul.demons[id];
    return d ? [[id, d] as const] : [];
  });
  if (targets.length === 0) violate("quest_no_demons", "every demon linked to this quest was deleted");
  for (const [id, d] of targets) attack(soul, id, d, e.at, rules);
  q.completedAt = e.at;
  syncGoldenClock(soul, rules);
  return targets.length;
}

// ---- Drops --------------------------------------------------------------------------

const GAIN_DROPS: readonly SoulDrop[] = ["gold", "qi", "gain_potion", "legendary_potion", "legendary"];
const GAIN_BANDS: readonly SoulDropBand[] = ["gold", "qi", "item", "legendary"];
const LOSS_DROPS: readonly SoulDrop[] = ["lose_gold", "lose_qi", "lose_item"];

/**
 * Whether a task of this polarity rolls at this color: positive tasks roll for
 * gains at growth colors, negative tasks roll for losses at weakening colors.
 * Anything else (positive at a weakening color, anything at White) rolls nothing.
 */
export function soulRolls(color: SoulColor, polarity: SoulPolarity): boolean {
  return polarity === "positive" ? isGrowth(color) : isWeakening(color);
}

/** Whether an outcome can come from a roll of this polarity ("none" always can). */
export function dropMatchesPolarity(drop: SoulDrop, polarity: SoulPolarity): boolean {
  return drop === "none" || (polarity === "positive" ? GAIN_DROPS : LOSS_DROPS).includes(drop);
}

/**
 * Map a uniform number u in [0, 1) to a drop outcome for a task of this
 * polarity at this color. The server draws u from a secure RNG and stores the
 * outcome, inline on the task event or in a SoulDropRolled appended on sync.
 */
export function soulDropOutcome(color: SoulColor, polarity: SoulPolarity, u: number, rules: RulesConfig): SoulDrop {
  if (!(u >= 0 && u < 1)) throw new RangeError("u must be in [0, 1)");
  if (!soulRolls(color, polarity)) return "none";
  const bp = Math.floor(u * 10_000);
  const odds = rules.soul.drops.oddsBp[color];
  let acc = 0;
  for (const band of SOUL_DROP_ORDER) {
    if (GAIN_BANDS.includes(band) !== (polarity === "positive")) continue;
    const width = odds[band] ?? 0;
    if (bp < acc + width) {
      if (band !== "item") return band;
      // Until gear exists the item band is a potion; where the roll landed in it picks the kind (ruling 58).
      return potionKind((u * 10_000 - acc) / width, rules) === "gain" ? "gain_potion" : "legendary_potion";
    }
    acc += width;
  }
  return "none";
}

/**
 * Rolls earned by a task event: `wanted` (1 for a task, one per demon hit for
 * a quest) if the color rolls for this polarity, limited by the daily cap.
 */
export function earnRolls(soul: SoulState, day: number, polarity: SoulPolarity, wanted: number, rules: RulesConfig): number {
  if (!soulRolls(soul.color, polarity)) return 0;
  if (day !== soul.rollDay) {
    soul.rollDay = day;
    soul.rollsToday = 0;
  }
  const granted = Math.max(0, Math.min(wanted, rules.soul.drops.maxRollsPerDay - soul.rollsToday));
  soul.rollsToday += granted;
  return granted;
}

/**
 * Settle a task event's earned rolls against the outcomes stored on it.
 * Outcomes beyond what the current rules earn are ignored (so a rebalance can
 * lower the cap without breaking old logs); missing ones stay pending until a
 * SoulDropRolled records them. Returns the outcomes to apply.
 */
export function settleRolls(
  soul: SoulState,
  eventId: string,
  at: number,
  polarity: SoulPolarity,
  earned: number,
  stored: readonly SoulDrop[] | undefined,
): SoulDrop[] {
  const outcomes = stored ?? [];
  for (const d of outcomes) {
    if (!dropMatchesPolarity(d, polarity)) violate("drop_wrong_polarity", `a ${polarity} task can't drop ${d}`);
  }
  const applied = outcomes.slice(0, earned);
  if (earned > applied.length) {
    soul.pendingRolls[eventId] = { eventId, at, color: soul.color, polarity, count: earned - applied.length };
  }
  return applied;
}

/**
 * Record the outcomes for a task event's pending rolls. Returns the outcomes
 * to apply, or null when nothing is pending for that event (a duplicate, or a
 * rebalance that no longer earns the roll): the caller flags it as an anomaly.
 */
export function onDropRolled(soul: SoulState, e: EventOf<"SoulDropRolled">): SoulDrop[] | null {
  const p = soul.pendingRolls[e.eventId];
  if (!p) return null;
  for (const d of e.drops) {
    if (!dropMatchesPolarity(d, p.polarity)) violate("drop_wrong_polarity", `a ${p.polarity} task can't drop ${d}`);
  }
  const applied = e.drops.slice(0, p.count);
  p.count -= applied.length;
  if (p.count <= 0) delete soul.pendingRolls[e.eventId];
  return applied;
}

/** Task events with rolls still to record, oldest first: what the server rolls on sync. */
export function pendingSoulRolls(soul: SoulState): PendingRoll[] {
  return Object.values(soul.pendingRolls).sort((a, b) => a.at - b.at);
}

// ---- Queries ------------------------------------------------------------------------

export function demonCounts(soul: SoulState): { created: number; defeated: number } {
  const demons = Object.values(soul.demons);
  return { created: demons.length, defeated: demons.filter((d) => d.defeated).length };
}
