/**
 * Soul path: heart demons and the soul color they produce.
 *
 * Demon HP is a percentage (0-100). Positive tasks damage a demon, negative
 * tasks heal it, and after a grace period without a positive task it heals on
 * its own. The soul color is evaluated once per local day, at its end, so a
 * demon that crosses 70% during the day can still be pushed back in time.
 */
import type { EventOf, SoulTask } from "@cultivation/schema";
import { GROWTH_COLORS, WEAKENING_COLORS, type RulesConfig, type SoulColor } from "./config.js";
import { violate } from "./errors.js";
import { DAY } from "./time.js";

/** Float tolerance for HP thresholds (passive growth produces fractions). */
const HP_EPS = 1e-9;

export interface HeartDemon {
  name: string;
  positiveTasks: SoulTask[];
  negativeTasks: SoulTask[];
  hp: number;
  defeated: boolean;
  createdAt: number;
  /**
   * Time since the last positive task (or creation), not counting rest.
   * Passive growth applies to the part beyond the grace period.
   */
  idleMs: number;
  defeats: number;
  revivals: number;
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
  firstDemonAt: number | null;
  lastDemonCreatedAt: number | null;
  /** Last time any defeated demon revived; resets the Golden, Translucent and Rainbow clocks. */
  lastRevivalAt: number | null;
  /**
   * Set when a demon is deleted at a growth color: the soul drops to White and
   * stays there (unless it weakens further) until the next demon is defeated.
   */
  heldAtWhite: boolean;
  colorHistory: SoulColorChange[];
  demonHistory: DemonHistoryEntry[];
}

export function initialSoul(): SoulState {
  return {
    color: "broken",
    demons: {},
    firstDemonAt: null,
    lastDemonCreatedAt: null,
    lastRevivalAt: null,
    heldAtWhite: false,
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

/**
 * The color the soul would get if evaluated at `at`. Weakening colors take
 * precedence (any single demon is enough), then the growth ladder from the top.
 */
export function evaluateSoulColor(soul: SoulState, at: number, rules: RulesConfig): SoulColor {
  const r = rules.soul;
  const demons = Object.values(soul.demons);
  if (demons.length === 0) return "broken";

  const top = Math.max(...demons.map((d) => d.hp));
  if (top > r.weakening.broken) return "broken";
  if (top > r.weakening.black) return "black";
  if (top > r.weakening.violet) return "violet";
  if (soul.heldAtWhite) return "white";

  const created = demons.length;
  const defeated = demons.filter((d) => d.defeated).length;
  const g = r.growth;
  if (defeated === created && created >= g.goldenMinDemons) {
    // With no revival yet, the clock runs from the first demon ever identified.
    const since = at - (soul.lastRevivalAt ?? soul.firstDemonAt ?? at);
    if (since >= g.noRevivalDays.rainbow * DAY) return "rainbow";
    if (since >= g.noRevivalDays.translucent * DAY) return "translucent";
    if (since >= g.noRevivalDays.golden * DAY) return "golden";
  }
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

/** Evaluate the soul color at the end of a local day. */
export function endOfDay(soul: SoulState, at: number, rules: RulesConfig): void {
  setColor(soul, evaluateSoulColor(soul, at, rules), at, "day_end");
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
  soul.demonHistory.push({ at, demonId, kind: "revived" });
}

/**
 * Passive growth over [from, to], a stretch with no rest and no day boundary
 * inside it (so the soul color, and with it the rate, is constant).
 */
export function growDemons(soul: SoulState, from: number, to: number, rules: RulesConfig): void {
  const p = rules.soul.passive;
  const r = rules.soul;
  const grace = p.graceDays * DAY;
  const hpPerDay = p.hpPerDay * p.colorMultiplier[soul.color];
  const dt = to - from;
  for (const [demonId, d] of Object.entries(soul.demons)) {
    const before = d.idleMs;
    d.idleMs = before + dt;
    const growMs = Math.max(0, d.idleMs - grace) - Math.max(0, before - grace);
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
  };
  soul.firstDemonAt ??= e.at;
  soul.lastDemonCreatedAt = e.at;
  soul.demonHistory.push({ at: e.at, demonId: e.demonId, kind: "created" });

  // Identifying a demon lifts the soul out of Broken right away.
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
}

export function onSoulTaskLogged(soul: SoulState, e: EventOf<"SoulTaskLogged">, rules: RulesConfig): void {
  for (const [demonId, d] of Object.entries(soul.demons)) {
    if (d.positiveTasks.some((t) => t.taskId === e.taskId)) {
      d.idleMs = 0;
      setHp(soul, demonId, d, d.hp - rules.soul.positiveDamage, e.at, rules);
      return;
    }
    if (d.negativeTasks.some((t) => t.taskId === e.taskId)) {
      setHp(soul, demonId, d, d.hp + rules.soul.negativeHeal, e.at, rules);
      return;
    }
  }
  violate("unknown_task", `soul task ${e.taskId} is not linked to any demon`);
}

// ---- Queries ------------------------------------------------------------------------

export function demonCounts(soul: SoulState): { created: number; defeated: number } {
  const demons = Object.values(soul.demons);
  return { created: demons.length, defeated: demons.filter((d) => d.defeated).length };
}
