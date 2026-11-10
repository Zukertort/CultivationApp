/**
 * Main path, part 1: tasks, quests, repetition decay, expiry and extensions,
 * the procrastination tax on all three paths, and Qi deviation.
 *
 * Settled rules live in docs/design.md, Rulings 18-58. The only random
 * outcome is a completed quest's item roll, which the server rolls and stores
 * in the event; expiry, ticks, idle tax, debt, deviation and quest bonuses are
 * all derived from time and the event log.
 */
import type { Difficulty, Effort, EventOf, MainQuestDrop, Period, TaskSchedule } from "@cultivation/schema";
import { RULES_V1, type MainPath, type Realm, type RepetitionRules, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { addPotion, chargeTax, earnGold, earnQi, mainQiMultiplier, potionKind, trainingGoldMultiplier } from "./economy.js";
import { violate } from "./errors.js";
import { DAY, MINUTE, localDay, nextLocalMidnight } from "./time.js";

export const DIFFICULTIES: readonly Difficulty[] = ["trivial", "easy", "mid", "hard", "deadly"];
export const MAIN_PATHS: readonly MainPath[] = ["main", "body", "soul"];
const HOUR = 60 * MINUTE;

// ---- State ------------------------------------------------------------------

/** A one-time deadline (a task outside a quest, or a quest). */
export interface Due {
  deadline: number;
  definedAt: number;
  /** Original duration, which caps the extension. */
  originalMs: number;
  extended: boolean;
}

export interface PeriodTally {
  key: number;
  done: number;
  /** Time in this period the task was active (not resting, not archived, inside its dates). */
  activeMs: number;
}

export interface MainTask {
  name: string;
  /** Normalized name: the repetition lineage. */
  key: string;
  difficulty: Difficulty;
  effort: Effort;
  definedAt: number;
  questId: string | null;
  status: "open" | "completed" | "cancelled" | "archived";
  /** One-time tasks outside a quest. Quest members use the quest's. */
  due: Due | null;
  /** Recurring tasks only. */
  recurring: { count: number; per: Period; endsAt: number | null; activeFrom: number; period: PeriodTally } | null;
  completedAt: number | null;
  completions: number;
  /** Qi paid before multipliers (decay and taper included): the quest bonus input. */
  paidBaseQi: number;
  /** "Work on this task today" (ruling 49): the last local day used, and total uses. */
  workedOn: { day: number; uses: number };
  /** When this task was restored from archived, for the integrity flag (ruling 48). */
  restoredAt: number[];
  /** When the task was last archived (a same-day new version takes over its count; ruling 55). */
  archivedAt: number | null;
}

export interface MainQuest {
  name: string;
  due: Due;
  taskIds: string[];
  /** A member was cancelled: the quest pays no bonus. */
  forfeited: boolean;
  completedAt: number | null;
  bonusQi: number;
}

export interface Lineage {
  difficulty: Difficulty;
  firstCompletedAt: number | null;
  /** Decay age: active time since the first paying completion. */
  ageMs: number;
  paidDay: number;
  paidToday: number;
  /** The lineage's recurring task, if any; while it is archived or ended, the age pauses. */
  recurringTaskId: string | null;
}

/** A completed quest's item roll with no recorded outcome yet; the server rolls it on sync. */
export interface PendingQuestRoll {
  eventId: string;
  at: number;
  questId: string;
  /** Item chance from the quest's effort when it completed. */
  chance: number;
}

/** Integrity log entries (ruling 48): shown to the cultivator, never penalized. */
export interface IntegrityFlag {
  at: number;
  code: "archive_churn";
  taskId: string;
}

export interface PathClock {
  startedAt: number | null;
  /** Time without activity, rest excluded. */
  idleMs: number;
  lastActivityAt: number | null;
}

export interface MainState {
  realm: Realm;
  interview: { answeredAt: number; interests: { main: string; body: string; soul: string } } | null;
  tasks: Record<string, MainTask>;
  quests: Record<string, MainQuest>;
  lineages: Record<string, Lineage>;
  paths: Record<MainPath, PathClock>;
  /** The current local day: any rest in it, any active recurring task in it. */
  day: { rested: boolean; hadRecurring: boolean };
  debt: { qi: number; gold: number };
  deviation: { since: number; windowStart: number; done: number } | null;
  /** Totals for the simulator and the integrity view. */
  taxPaid: Record<MainPath, { qi: number; gold: number; ticks: number; idleDays: number }>;
  deviationsEntered: number;
  comebacks: number;
  /** Active time (rest excluded) since the last Main completion; null before the first (ruling 56). */
  sinceCompletionMs: number | null;
  /** Cosmetic: local days in a row without Main idle, rest days paused (ruling 57). */
  streak: { current: number; best: number };
  flags: IntegrityFlag[];
  pendingRolls: Record<string, PendingQuestRoll>;
  /** Local day of the last earned quest roll, and quest rolls earned that day (daily cap). */
  rollDay: number;
  rollsToday: number;
  drops: Record<MainQuestDrop, number>;
  /** Main Qi and gold earned from tasks and quest bonuses, bonuses included, before any debt repayment. */
  earned: { qi: number; gold: number };
}

export function initialMain(): MainState {
  const clock = (): PathClock => ({ startedAt: null, idleMs: 0, lastActivityAt: null });
  const paid = () => ({ qi: 0, gold: 0, ticks: 0, idleDays: 0 });
  return {
    realm: "qi_condensation",
    interview: null,
    tasks: {},
    quests: {},
    lineages: {},
    paths: { main: clock(), body: clock(), soul: clock() },
    day: { rested: false, hadRecurring: false },
    debt: { qi: 0, gold: 0 },
    deviation: null,
    taxPaid: { main: paid(), body: paid(), soul: paid() },
    deviationsEntered: 0,
    comebacks: 0,
    sinceCompletionMs: null,
    streak: { current: 0, best: 0 },
    flags: [],
    pendingRolls: {},
    rollDay: -1,
    rollsToday: 0,
    drops: { none: 0, gain_potion: 0, legendary_potion: 0 },
    earned: { qi: 0, gold: 0 },
  };
}

// ---- Math -------------------------------------------------------------------

/** Lowercase, punctuation and extra spaces removed: "Math  exercise." and "math exercise" are one lineage. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function workPoints(difficulty: Difficulty, effort: Effort, rules: RulesConfig = RULES_V1): number {
  return rules.main.difficultyPoints[difficulty] * rules.main.effortWeight[effort];
}

/** The convex Qi curve (ruling 38): piecewise linear through the anchors, extended with the last slope. */
export function qiForPoints(w: number, rules: RulesConfig = RULES_V1): number {
  const c = rules.main.qiCurve;
  if (w <= 0) return 0;
  for (let i = 1; i < c.length; i++) {
    const [x0, y0] = c[i - 1]!;
    const [x1, y1] = c[i]!;
    if (w <= x1) return y0 + ((w - x0) * (y1 - y0)) / (x1 - x0);
  }
  const [xa, ya] = c[c.length - 2]!;
  const [xb, yb] = c[c.length - 1]!;
  return yb + ((w - xb) * (yb - ya)) / (xb - xa);
}

export function goldForPoints(w: number, rules: RulesConfig = RULES_V1): number {
  return w * rules.main.goldPerPoint;
}

/** Age-based decay: full value for `fullValueWeeks` of active time, then a weekly step down to the floor. */
export function decayMultiplier(ageMs: number, r: RepetitionRules): number {
  const fullMs = r.fullValueWeeks * 7 * DAY;
  if (ageMs < fullMs) return 1;
  const steps = Math.floor((ageMs - fullMs) / (7 * DAY)) + 1;
  return Math.max(r.floor, 1 - r.weeklyLoss * steps);
}

/** Piecewise linear through [x, y] anchors, flat before the first and past the last. */
function interpolate(anchors: readonly (readonly [number, number])[], x: number): number {
  const first = anchors[0]!;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1]!;
    const [x1, y1] = anchors[i]!;
    if (x <= x1) return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
  }
  return anchors[anchors.length - 1]![1];
}

/** Days of work in a set of tasks: the sum of their effort weights over one day's weight. */
export function workDays(efforts: readonly Effort[], rules: RulesConfig = RULES_V1): number {
  return efforts.reduce((sum, e) => sum + rules.main.effortWeight[e], 0) / rules.main.dayWeight;
}

/** The quest bonus cap for this much work (ruling 51). */
export function questBonusCap(days: number, rules: RulesConfig = RULES_V1): number {
  return interpolate(rules.main.questBonusCap, days);
}

/** A completed quest's item chance for this much work (ruling 52). */
export function questDropChance(days: number, rules: RulesConfig = RULES_V1): number {
  return interpolate(rules.main.questDrops.chance, days);
}

/**
 * Map a uniform number u in [0, 1) to a quest's item roll: an item below the
 * chance, its potion kind by where u landed (ruling 58). The server draws u
 * from a secure RNG and stores the outcome in the completing event (or in a
 * MainQuestDropRolled on sync).
 */
export function questDropOutcome(chance: number, u: number, rules: RulesConfig = RULES_V1): MainQuestDrop {
  if (!(u >= 0 && u < 1)) throw new RangeError("u must be in [0, 1)");
  if (u >= chance) return "none";
  return potionKind(u / chance, rules) === "gain" ? "gain_potion" : "legendary_potion";
}

// ---- Periods ----------------------------------------------------------------

/** Local day, ISO week (from Monday), calendar month or calendar year containing `at`. */
export function periodKey(per: Period, at: number, tz: number): number {
  const day = localDay(at, tz);
  if (per === "day") return day;
  if (per === "week") return Math.floor((day + 3) / 7); // day 0 (1970-01-01) was a Thursday
  const d = new Date(day * DAY);
  if (per === "year") return d.getUTCFullYear();
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** Length of a period in days. */
export function periodDays(per: Period, key: number): number {
  if (per === "day") return 1;
  if (per === "week") return 7;
  if (per === "year") return (Date.UTC(key + 1, 0, 1) - Date.UTC(key, 0, 1)) / DAY;
  const y = Math.floor(key / 12);
  const m = key % 12;
  return (Date.UTC(y, m + 1, 1) - Date.UTC(y, m, 1)) / DAY;
}

/** First instant of the period after `key`. */
function periodEnd(per: Period, key: number, tz: number): number {
  let startDay: number;
  if (per === "day") startDay = key + 1;
  else if (per === "week") startDay = (key + 1) * 7 - 3;
  else if (per === "year") startDay = Math.floor(Date.UTC(key + 1, 0, 1) / DAY);
  else startDay = Math.floor(Date.UTC(Math.floor((key + 1) / 12), (key + 1) % 12, 1) / DAY);
  return startDay * DAY - tz * MINUTE;
}

// ---- Status -----------------------------------------------------------------

export type ItemStatus = "open" | "expired" | "gone" | "completed" | "cancelled" | "archived" | "ended";

interface RestLike {
  kind: "vacation" | "closed_door";
  start: number;
  end: number;
}

/** A deadline, pushed back by an ongoing closed-door rest (vacation keeps deadlines; ruling 30). */
export function effectiveDeadline(due: Due, rest: RestLike | null, clock: number): number {
  if (rest?.kind === "closed_door" && due.deadline > rest.start) {
    return due.deadline + Math.max(0, clock - Math.max(rest.start, due.definedAt));
  }
  return due.deadline;
}

function dueStatus(due: Due, rest: RestLike | null, at: number, rules: RulesConfig): "open" | "expired" | "gone" {
  const end = effectiveDeadline(due, rest, at);
  if (at <= end) return "open";
  if (!due.extended && at <= end + rules.main.extension.windowDays * DAY) return "expired";
  return "gone";
}

/** A milestone's own deadline, else the quest's for a quest member. */
function taskDue(m: MainState, t: MainTask): Due | null {
  if (t.due) return t.due;
  if (t.questId !== null) return m.quests[t.questId]?.due ?? null;
  return null;
}

function statusAt(s: CultivatorState, t: MainTask, at: number, rules: RulesConfig): ItemStatus {
  if (t.status !== "open") return t.status;
  if (t.recurring) return t.recurring.endsAt !== null && at >= t.recurring.endsAt ? "ended" : "open";
  const due = taskDue(s.main, t);
  return due ? dueStatus(due, s.rest, at, rules) : "open";
}

export function mainTaskStatus(state: CultivatorState, taskId: string, rules: RulesConfig = RULES_V1): ItemStatus | null {
  const t = state.main.tasks[taskId];
  return t ? statusAt(state, t, state.clock, rules) : null;
}

export function mainQuestStatus(state: CultivatorState, questId: string, rules: RulesConfig = RULES_V1): ItemStatus | null {
  const q = state.main.quests[questId];
  if (!q) return null;
  if (q.completedAt !== null) return "completed";
  return dueStatus(q.due, state.rest, state.clock, rules);
}

// ---- Validation -------------------------------------------------------------

function checkDeadline(deadline: number, at: number, rules: RulesConfig): void {
  if (deadline <= at) violate("deadline_in_past", "the deadline must be in the future");
  if (deadline > at + rules.main.maxDeadlineDays * DAY) violate("deadline_too_far", `deadlines are at most ${rules.main.maxDeadlineDays} days out`);
}

function checkSchedule(schedule: TaskSchedule, at: number, rules: RulesConfig): void {
  if (schedule.kind === "once") checkDeadline(schedule.deadline, at, rules);
  else if (schedule.endsAt !== undefined && schedule.endsAt <= at) violate("ends_in_past", "the end date must be in the future");
}

/**
 * A name can have one open task at a time (ruling 43). An archived or ended
 * recurring task must be restored instead of recreated (ruling 46), so
 * deleting and recreating never resets decay.
 */
function checkName(s: CultivatorState, key: string, difficulty: Difficulty, at: number, rules: RulesConfig, except?: string): void {
  const lineage = s.main.lineages[key];
  if (lineage && lineage.difficulty !== difficulty) {
    violate("difficulty_needs_new_version", "changing a task's difficulty requires a new named version (e.g. \"Math exercise II\")");
  }
  for (const [id, t] of Object.entries(s.main.tasks)) {
    if (id === except || t.key !== key) continue;
    const st = statusAt(s, t, at, rules);
    if (st === "archived" || st === "ended") violate("task_archived", "a task with this name is archived; restore it instead");
    if (st === "open" || st === "expired") violate("name_in_use", "a task with this name is already open");
  }
}

function newDue(deadline: number, at: number): Due {
  return { deadline, definedAt: at, originalMs: deadline - at, extended: false };
}

function recurringOf(schedule: Extract<TaskSchedule, { kind: "recurring" }>, at: number, tz: number): NonNullable<MainTask["recurring"]> {
  return {
    count: schedule.count,
    per: schedule.per,
    endsAt: schedule.endsAt ?? null,
    activeFrom: at,
    period: { key: periodKey(schedule.per, at, tz), done: 0, activeMs: 0 },
  };
}

// ---- Handlers ---------------------------------------------------------------

export function onInterviewAnswered(s: CultivatorState, e: EventOf<"InterviewAnswered">): void {
  const m = s.main;
  m.interview = { answeredAt: e.at, interests: { ...e.interests } };
  // All three tax clocks start at the interview (ruling 44); answering again changes only the interests.
  for (const p of MAIN_PATHS) {
    const c = m.paths[p];
    if (c.startedAt === null) {
      c.startedAt = e.at;
      c.idleMs = 0;
    }
  }
}

/** Activity on a path resets its idle clock (ruling 31). */
export function markActivity(m: MainState, path: MainPath, at: number): void {
  m.paths[path].idleMs = 0;
  m.paths[path].lastActivityAt = at;
}

function addTask(
  s: CultivatorState,
  e: { at: number; taskId: string; name: string; difficulty: Difficulty; effort: Effort },
  schedule: TaskSchedule | null,
  questId: string | null,
): void {
  const key = normalizeName(e.name);
  s.main.lineages[key] ??= { difficulty: e.difficulty, firstCompletedAt: null, ageMs: 0, paidDay: -1, paidToday: 0, recurringTaskId: null };
  const task: MainTask = {
    name: e.name,
    key,
    difficulty: e.difficulty,
    effort: e.effort,
    definedAt: e.at,
    questId,
    status: "open",
    due: schedule?.kind === "once" ? newDue(schedule.deadline, e.at) : null,
    recurring: schedule?.kind === "recurring" ? recurringOf(schedule, e.at, s.tzOffsetMinutes) : null,
    completedAt: null,
    completions: 0,
    paidBaseQi: 0,
    workedOn: { day: -1, uses: 0 },
    restoredAt: [],
    archivedAt: null,
  };
  s.main.tasks[e.taskId] = task;
  if (task.recurring) s.main.lineages[key]!.recurringTaskId = e.taskId;
}

export function onTaskDefined(s: CultivatorState, e: EventOf<"MainTaskDefined">, rules: RulesConfig): void {
  if (s.main.tasks[e.taskId]) violate("duplicate_task", `task ${e.taskId} already exists`);
  checkSchedule(e.schedule, e.at, rules);
  const old = e.replaces === undefined ? null : replacedTask(s, e.replaces, e.at, e.schedule, rules);
  checkName(s, normalizeName(e.name), e.difficulty, e.at, rules);
  addTask(s, e, e.schedule, null);
  if (!old) return;
  if (old.status === "open") {
    old.status = "archived";
    old.archivedAt = e.at;
  }
  // The new version takes over the old one's count for the current period, so leveling up never owes tax (ruling 55).
  const from = old.recurring!;
  const to = s.main.tasks[e.taskId]!.recurring!;
  if (from.per === to.per && from.period.key === to.period.key) {
    to.period = { ...from.period };
    from.period = { key: from.period.key, done: 0, activeMs: 0 };
  }
}

/** The recurring task a new version replaces: open, or archived earlier the same local day. */
function replacedTask(s: CultivatorState, taskId: string, at: number, schedule: TaskSchedule, rules: RulesConfig): MainTask {
  const old = s.main.tasks[taskId];
  if (!old) violate("unknown_task", `task ${taskId} does not exist`);
  if (!old.recurring || schedule.kind !== "recurring") violate("replace_recurring_only", "only a recurring task gets a new version this way");
  const st = statusAt(s, old, at, rules);
  const tz = s.tzOffsetMinutes;
  const sameDay = old.archivedAt !== null && localDay(old.archivedAt, tz) === localDay(at, tz);
  if (st !== "open" && !(st === "archived" && sameDay)) {
    violate("replace_too_late", "a new version takes over a task that is open or was archived the same day");
  }
  return old;
}

export function onMainQuestDefined(s: CultivatorState, e: EventOf<"MainQuestDefined">, rules: RulesConfig): void {
  if (s.main.quests[e.questId]) violate("duplicate_quest", `quest ${e.questId} already exists`);
  checkDeadline(e.deadline, e.at, rules);
  const keys = new Set<string>();
  for (const t of e.tasks) {
    if (s.main.tasks[t.taskId]) violate("duplicate_task", `task ${t.taskId} already exists`);
    const key = normalizeName(t.name);
    if (keys.has(key)) violate("name_in_use", "two tasks in one quest can't share a name");
    keys.add(key);
    checkName(s, key, t.difficulty, e.at, rules);
    // A milestone's deadline is on or before the quest's (ruling 50).
    if (t.deadline !== undefined) {
      if (t.deadline <= e.at) violate("deadline_in_past", "the deadline must be in the future");
      if (t.deadline > e.deadline) violate("milestone_after_quest", "a milestone's deadline is on or before the quest's");
    }
  }
  s.main.quests[e.questId] = {
    name: e.name,
    due: newDue(e.deadline, e.at),
    taskIds: e.tasks.map((t) => t.taskId),
    forfeited: false,
    completedAt: null,
    bonusQi: 0,
  };
  for (const t of e.tasks) {
    addTask(s, { ...t, at: e.at }, t.deadline === undefined ? null : { kind: "once", deadline: t.deadline }, e.questId);
  }
}

export function onTaskCompleted(s: CultivatorState, e: EventOf<"MainTaskCompleted">, rules: RulesConfig): void {
  const m = s.main;
  const t = m.tasks[e.taskId];
  if (!t) violate("unknown_task", `task ${e.taskId} does not exist`);
  const st = statusAt(s, t, e.at, rules);
  if (st === "completed") violate("task_already_completed", "a one-time task completes once");
  if (st === "cancelled") violate("task_cancelled", "this task was cancelled");
  if (st === "archived") violate("task_archived", "restore the task before completing it");
  if (st === "ended") violate("task_ended", "this recurring task has ended");
  if (st === "expired" || st === "gone") violate("task_expired", "the deadline has passed");

  markActivity(m, "main", e.at);
  m.sinceCompletionMs = 0;
  t.completions += 1;
  const lineage = m.lineages[t.key]!;
  const day = localDay(e.at, s.tzOffsetMinutes);
  if (lineage.paidDay !== day) {
    lineage.paidDay = day;
    lineage.paidToday = 0;
  }

  // Caps (ruling 39): the frequency per period, and paying completions per name per day.
  let pays = lineage.paidToday < rules.main.maxPaidPerNamePerDay;
  if (t.recurring) {
    // A completion over either cap neither pays nor counts as an occurrence.
    const p = t.recurring.period;
    pays &&= p.done < t.recurring.count;
    if (pays) p.done += 1;
  } else {
    t.status = "completed";
    t.completedAt = e.at;
  }

  if (pays) {
    lineage.paidToday += 1;
    if (lineage.firstCompletedAt === null) {
      lineage.firstCompletedAt = e.at;
      lineage.ageMs = 0;
    }
    const decay = decayMultiplier(lineage.ageMs, rules.main.repetition);
    const taper = rules.main.simpleDifficulties.includes(t.difficulty) ? rules.main.simpleTaper[m.realm] : 1;
    const w = workPoints(t.difficulty, t.effort, rules);
    const baseQi = qiForPoints(w, rules) * decay * taper;
    t.paidBaseQi += baseQi;
    const qi = baseQi * mainQiMultiplier(s, rules);
    const gold = goldForPoints(w, rules) * decay * trainingGoldMultiplier(s, rules);
    earnQi(s, qi);
    earnGold(s, gold);
    m.earned.qi += qi;
    m.earned.gold += gold;
    if (m.deviation && DIFFICULTIES.indexOf(t.difficulty) >= DIFFICULTIES.indexOf(rules.main.comeback.minDifficulty)) {
      progressComeback(s, e.at, rules);
    }
  }
  if (t.questId !== null) settleQuest(s, t.questId, e, rules);
}

/**
 * When every member is completed or cancelled, the quest completes. With no
 * member cancelled, it pays the bonus and earns one item roll, under the
 * daily roll cap (ruling 52).
 */
function settleQuest(s: CultivatorState, questId: string, e: { id: string; at: number; questDrop?: MainQuestDrop | undefined }, rules: RulesConfig): void {
  const m = s.main;
  const q = m.quests[questId]!;
  if (q.completedAt !== null) return;
  const members = q.taskIds.map((id) => m.tasks[id]!);
  if (members.some((t) => t.status !== "completed" && t.status !== "cancelled")) return;
  q.completedAt = e.at;
  if (q.forfeited) return;
  const days = workDays(
    members.map((t) => t.effort),
    rules,
  );
  // The bonus is the cap for the members' days of work, paid on their own Qi (ruling 54).
  const paid = members.reduce((sum, t) => sum + t.paidBaseQi, 0);
  q.bonusQi = paid * questBonusCap(days, rules);
  const qi = q.bonusQi * mainQiMultiplier(s, rules);
  earnQi(s, qi);
  m.earned.qi += qi;

  const day = localDay(e.at, s.tzOffsetMinutes);
  if (m.rollDay !== day) {
    m.rollDay = day;
    m.rollsToday = 0;
  }
  if (m.rollsToday >= rules.main.questDrops.maxRollsPerDay) return;
  m.rollsToday += 1;
  // An outcome stored without an earned roll (e.g. after a rebalance) is ignored, as for soul drops.
  if (e.questDrop !== undefined) applyQuestDrop(s, e.questDrop);
  else m.pendingRolls[e.id] = { eventId: e.id, at: e.at, questId, chance: questDropChance(days, rules) };
}

/** An item is a potion until gear exists. */
function applyQuestDrop(s: CultivatorState, drop: MainQuestDrop): void {
  s.main.drops[drop] += 1;
  if (drop === "gain_potion") addPotion(s, "gain");
  if (drop === "legendary_potion") addPotion(s, "legendary");
}

/**
 * Record a pending quest roll's outcome. Returns false when nothing is
 * pending for that event (a duplicate, or a rebalance that no longer earns
 * the roll): the caller flags it as an anomaly.
 */
export function onQuestDropRolled(s: CultivatorState, e: EventOf<"MainQuestDropRolled">): boolean {
  const p = s.main.pendingRolls[e.eventId];
  if (!p) return false;
  delete s.main.pendingRolls[e.eventId];
  applyQuestDrop(s, e.drop);
  return true;
}

/** Quest-completing events whose item roll is still to record, oldest first: what the server rolls on sync. */
export function pendingQuestRolls(state: CultivatorState): PendingQuestRoll[] {
  return Object.values(state.main.pendingRolls).sort((a, b) => a.at - b.at);
}

function progressComeback(s: CultivatorState, at: number, rules: RulesConfig): void {
  const m = s.main;
  const d = m.deviation!;
  const c = rules.main.comeback;
  const windowMs = c.windowDays * DAY;
  // A missed window starts the next one (ruling 34).
  while (at >= d.windowStart + windowMs) {
    d.windowStart += windowMs;
    d.done = 0;
  }
  d.done += 1;
  if (d.done >= c.tasks) {
    m.deviation = null;
    m.debt = { qi: 0, gold: 0 };
    m.comebacks += 1;
  }
}

export function onTaskCancelled(s: CultivatorState, e: EventOf<"MainTaskCancelled">, rules: RulesConfig): void {
  const t = s.main.tasks[e.taskId];
  if (!t) violate("unknown_task", `task ${e.taskId} does not exist`);
  if (t.recurring) violate("archive_recurring", "a recurring task is archived, not cancelled");
  const st = statusAt(s, t, e.at, rules);
  if (st === "completed") violate("task_already_completed", "a completed task can't be cancelled");
  if (st === "cancelled") violate("task_cancelled", "this task was already cancelled");
  t.status = "cancelled";
  if (t.questId !== null) {
    s.main.quests[t.questId]!.forfeited = true;
    settleQuest(s, t.questId, e, rules);
  }
}

export function onTaskArchived(s: CultivatorState, e: EventOf<"MainTaskArchived">): void {
  const t = s.main.tasks[e.taskId];
  if (!t) violate("unknown_task", `task ${e.taskId} does not exist`);
  if (!t.recurring) violate("cancel_one_time", "a one-time task is cancelled, not archived");
  if (t.status === "archived") violate("task_archived", "this task is already archived");
  // The period keeps its tally: what was owed until now is still owed at the period's end.
  t.status = "archived";
  t.archivedAt = e.at;
}

export function onTaskRestored(s: CultivatorState, e: EventOf<"MainTaskRestored">, rules: RulesConfig): void {
  const t = s.main.tasks[e.taskId];
  if (!t) violate("unknown_task", `task ${e.taskId} does not exist`);
  const st = statusAt(s, t, e.at, rules);
  if (st !== "archived" && st !== "ended") violate("not_archived", "only an archived or ended task can be restored");
  checkSchedule(e.schedule, e.at, rules);
  checkName(s, t.key, t.difficulty, e.at, rules, e.taskId);
  // Repeated archive-and-restore is flagged in the integrity log; there is no archive tax (ruling 48).
  // Reaching an end date isn't a delete, so restoring an ended task never counts.
  if (st === "archived") {
    const c = rules.main.archiveChurn;
    t.restoredAt = [...t.restoredAt.filter((at) => at > e.at - c.windowDays * DAY), e.at];
    if (t.restoredAt.length >= c.restores) s.main.flags.push({ at: e.at, code: "archive_churn", taskId: e.taskId });
  }
  const lineage = s.main.lineages[t.key]!;
  const old = t.recurring;
  t.status = "open";
  t.archivedAt = null;
  if (e.schedule.kind === "once") {
    if (old) settlePeriod(s, t, e.at, rules);
    t.recurring = null;
    t.due = newDue(e.schedule.deadline, e.at);
    lineage.recurringTaskId = null;
    return;
  }
  const next = recurringOf(e.schedule, e.at, s.tzOffsetMinutes);
  if (old && old.per === next.per && old.count === next.count) next.period = old.period;
  else if (old) settlePeriod(s, t, e.at, rules);
  t.recurring = next;
  t.due = null;
  lineage.recurringTaskId = e.taskId;
}

export function onItemExtended(s: CultivatorState, e: EventOf<"MainItemExtended">, rules: RulesConfig): void {
  const m = s.main;
  let due: Due;
  let points: number;
  if (e.item === "task") {
    const t = m.tasks[e.itemId];
    if (!t) violate("unknown_task", `task ${e.itemId} does not exist`);
    if (t.recurring) violate("no_extension_for_recurring", "recurring tasks never expire");
    if (t.questId !== null && !t.due) violate("extend_the_quest", "extend the quest; its unfinished tasks follow");
    if (t.status !== "open") violate(`task_${t.status}`, `the task is ${t.status}`);
    due = t.due!;
    points = workPoints(t.difficulty, t.effort, rules);
    // A milestone's extension stays on or before its quest's deadline (ruling 50).
    if (t.questId !== null && e.until > effectiveDeadline(m.quests[t.questId]!.due, s.rest, e.at)) {
      violate("milestone_after_quest", "a milestone's deadline is on or before the quest's; extend the quest first");
    }
  } else {
    const q = m.quests[e.itemId];
    if (!q) violate("unknown_quest", `quest ${e.itemId} does not exist`);
    if (q.completedAt !== null) violate("quest_completed", "the quest is completed");
    due = q.due;
    points = q.taskIds
      .map((id) => m.tasks[id]!)
      .filter((t) => t.status === "open")
      .reduce((sum, t) => sum + workPoints(t.difficulty, t.effort, rules), 0);
  }
  const st = dueStatus(due, s.rest, e.at, rules);
  if (st === "open") violate("not_expired", "only an expired task or quest can be extended");
  if (due.extended) violate("extension_used", "a task or quest gets one extension");
  if (st === "gone") violate("extension_window_closed", `the extension can be bought up to ${rules.main.extension.windowDays} days after the deadline`);
  const old = effectiveDeadline(due, s.rest, e.at);
  if (e.until <= e.at) violate("deadline_in_past", "the new deadline must be in the future");
  if (e.until - old > due.originalMs) violate("extension_too_long", "an extension is no longer than the original duration");
  const price = Math.max(rules.main.extension.minPrice, goldForPoints(points, rules));
  if (s.gold < price) violate("insufficient_gold", `the extension costs ${price} gold`);
  s.gold -= price;
  due.deadline = e.until;
  due.extended = true;
}

/**
 * "Work on this task today" (ruling 49): once per task per local day, for
 * one-time tasks of day or project effort (up to a total cap by effort) and
 * recurring tasks per week or longer; pays nothing. It counts as Main activity
 * only if a Main task was completed in the last 14 days, rest excluded
 * (ruling 56); otherwise it is logged but neither counts nor uses up the cap.
 */
export function onTaskWorkedOn(s: CultivatorState, e: EventOf<"MainTaskWorkedOn">, rules: RulesConfig): void {
  const t = s.main.tasks[e.taskId];
  if (!t) violate("unknown_task", `task ${e.taskId} does not exist`);
  const st = statusAt(s, t, e.at, rules);
  if (st !== "open") violate(`task_${st}`, `the task is ${st}`);
  const w = rules.main.workOn;
  const cap = w.capByEffort[t.effort];
  if (t.recurring) {
    if (!(w.recurringPeriods as readonly Period[]).includes(t.recurring.per)) {
      violate("work_on_not_allowed", "only recurring tasks per week or longer can be worked on without completing");
    }
  } else if (cap === undefined) {
    violate("work_on_not_allowed", "only day- or project-sized tasks can be worked on without completing");
  }
  const day = localDay(e.at, s.tzOffsetMinutes);
  if (t.workedOn.day === day) violate("already_worked_today", "a task can be worked on once a day");
  if (!t.recurring && t.workedOn.uses >= cap!) {
    violate("work_on_cap", "this task has used all its work days; complete it or split it into milestones");
  }
  if (!workOnCounts(s, rules)) {
    t.workedOn = { day, uses: t.workedOn.uses };
    return;
  }
  t.workedOn = { day, uses: t.workedOn.uses + 1 };
  markActivity(s.main, "main", e.at);
}

/** Whether "work on" counts as activity now: a Main completion within the window, rest excluded (ruling 56). */
export function workOnCounts(state: CultivatorState, rules: RulesConfig = RULES_V1): boolean {
  const since = state.main.sinceCompletionMs;
  return since !== null && since <= rules.main.workOn.completionWithinDays * DAY;
}

/** Closed-door rest pushes open deadlines back by the time spent inside (ruling 30). */
export function shiftDeadlinesAfterRest(s: CultivatorState, rest: RestLike, end: number): void {
  if (rest.kind !== "closed_door") return;
  const m = s.main;
  const shift = (due: Due) => {
    if (due.deadline > rest.start) due.deadline += Math.max(0, end - Math.max(rest.start, due.definedAt));
  };
  for (const t of Object.values(m.tasks)) if (t.due && t.status === "open") shift(t.due);
  for (const q of Object.values(m.quests)) if (q.completedAt === null) shift(q.due);
}

// ---- Time -------------------------------------------------------------------

/** Over [from, to], a stretch with no rest and no midnight inside: decay ages, active time, idle time. */
export function advanceMain(s: CultivatorState, from: number, to: number): void {
  const m = s.main;
  const dt = to - from;
  for (const lineage of Object.values(m.lineages)) {
    if (lineage.firstCompletedAt === null) continue;
    const t = lineage.recurringTaskId === null ? null : m.tasks[lineage.recurringTaskId];
    if (t?.status === "archived") continue;
    const until = t?.recurring?.endsAt ?? Infinity;
    lineage.ageMs += Math.max(0, Math.min(to, until) - from);
  }
  for (const t of Object.values(m.tasks)) {
    const r = t.recurring;
    if (!r || t.status !== "open") continue;
    const active = Math.max(0, Math.min(to, r.endsAt ?? Infinity) - Math.max(from, r.activeFrom));
    if (active > 0) {
      r.period.activeMs += active;
      m.day.hadRecurring = true;
    }
  }
  for (const p of MAIN_PATHS) if (m.paths[p].startedAt !== null) m.paths[p].idleMs += dt;
  if (m.sinceCompletionMs !== null) m.sinceCompletionMs += dt;
}

function occurrencesOwed(count: number, activeMs: number, periodMs: number, rules: RulesConfig): number {
  const share = (count * activeMs) / periodMs;
  return rules.main.tax.partialPeriods === "floor" ? Math.floor(share + 1e-9) : share;
}

/** Close a recurring task's period: each missed occurrence is one tick (ruling 40). */
function settlePeriod(s: CultivatorState, t: MainTask, at: number, rules: RulesConfig): void {
  const r = t.recurring!;
  const p = r.period;
  const days = periodDays(r.per, p.key);
  const owed = occurrencesOwed(r.count, p.activeMs, days * DAY, rules);
  const missed = Math.max(0, owed - Math.min(p.done, r.count));
  if (missed > 0 && s.main.paths.main.startedAt !== null) {
    const tick = rules.main.tax.main;
    const perTick = days / r.count;
    chargeTax(s, "main", tick.qi * perTick * missed, tick.gold * perTick * missed, at, rules);
    s.main.taxPaid.main.ticks += missed;
  }
  r.period = { key: periodKey(r.per, at, s.tzOffsetMinutes), done: 0, activeMs: 0 };
}

/** At each local midnight: close ended periods, then charge idle tax for the day that just ended (ruling 32). */
export function mainMidnight(s: CultivatorState, midnight: number, rules: RulesConfig): void {
  const m = s.main;
  const tz = s.tzOffsetMinutes;
  for (const t of Object.values(m.tasks)) {
    const r = t.recurring;
    if (r && periodKey(r.per, midnight, tz) !== r.period.key) settlePeriod(s, t, midnight, rules);
  }
  if (!m.day.rested) {
    const tax = rules.main.tax;
    // The cosmetic streak breaks on the idle condition, even when a recurring task replaces the idle tax with ticks (ruling 57).
    const main = m.paths.main;
    if (main.startedAt !== null) {
      m.streak.current = main.idleMs > tax.graceDays.main * DAY ? 0 : m.streak.current + 1;
      m.streak.best = Math.max(m.streak.best, m.streak.current);
    }
    for (const path of MAIN_PATHS) {
      const c = m.paths[path];
      if (c.startedAt === null || c.idleMs <= tax.graceDays[path] * DAY) continue;
      // Active recurring tasks replace Main's idle rule with ticks, so no day is taxed twice (ruling 41).
      if (path === "main" && m.day.hadRecurring) continue;
      const f = path === "main" ? 1 : tax.sideFraction;
      chargeTax(s, path, tax.main.qi * f, tax.main.gold * f, midnight, rules);
      m.taxPaid[path].idleDays += 1;
    }
  }
  m.day = { rested: false, hadRecurring: false };
}

// ---- Projections ------------------------------------------------------------

export interface PeriodProgress {
  done: number;
  count: number;
  per: Period;
  endsAt: number;
}

/** A recurring task's progress in the current period (e.g. 1 of 3 this week). */
export function periodProgress(state: CultivatorState, taskId: string): PeriodProgress | null {
  const r = state.main.tasks[taskId]?.recurring;
  if (!r) return null;
  return { done: r.period.done, count: r.count, per: r.per, endsAt: periodEnd(r.per, r.period.key, state.tzOffsetMinutes) };
}

export interface TaxCharge {
  path: MainPath;
  kind: "idle" | "missed";
  /** When it is charged if nothing changes. */
  at: number;
  qi: number;
  gold: number;
  taskId?: string;
}

/**
 * The next tax charges if nothing more is done and no rest starts: the first
 * idle-day charge per path, and each active recurring task's missed
 * occurrences at its period's end. For the in-app list.
 */
export function taxForecast(state: CultivatorState, rules: RulesConfig = RULES_V1): TaxCharge[] {
  const m = state.main;
  const tax = rules.main.tax;
  const tz = state.tzOffsetMinutes;
  const now = Math.max(state.clock, state.rest?.end ?? state.clock);
  const out: TaxCharge[] = [];
  const hasRecurring = Object.values(m.tasks).some((t) => t.recurring && statusAt(state, t, now, rules) === "open");
  for (const path of MAIN_PATHS) {
    const c = m.paths[path];
    if (c.startedAt === null || (path === "main" && hasRecurring)) continue;
    const crossing = now + Math.max(0, tax.graceDays[path] * DAY - c.idleMs);
    const f = path === "main" ? 1 : tax.sideFraction;
    out.push({ path, kind: "idle", at: nextLocalMidnight(crossing, tz), qi: tax.main.qi * f, gold: tax.main.gold * f });
  }
  if (m.paths.main.startedAt !== null) {
    for (const [taskId, t] of Object.entries(m.tasks)) {
      const r = t.recurring;
      if (!r || statusAt(state, t, now, rules) !== "open") continue;
      const end = periodEnd(r.per, r.period.key, tz);
      const activeMs = r.period.activeMs + Math.max(0, Math.min(end, r.endsAt ?? Infinity) - Math.max(now, r.activeFrom));
      const days = periodDays(r.per, r.period.key);
      const missed = Math.max(0, occurrencesOwed(r.count, activeMs, days * DAY, rules) - Math.min(r.period.done, r.count));
      if (missed > 0) {
        const k = (days / r.count) * missed;
        out.push({ path: "main", kind: "missed", at: end, qi: tax.main.qi * k, gold: tax.main.gold * k, taskId });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export interface DeviationStatus {
  since: number;
  windowEndsAt: number;
  done: number;
  needed: number;
  debt: { qi: number; gold: number };
}

/** Qi deviation and the comeback quest's progress in its current window, or null. */
export function deviationStatus(state: CultivatorState, rules: RulesConfig = RULES_V1): DeviationStatus | null {
  const d = state.main.deviation;
  if (!d) return null;
  const windowMs = rules.main.comeback.windowDays * DAY;
  let start = d.windowStart;
  let done = d.done;
  while (state.clock >= start + windowMs) {
    start += windowMs;
    done = 0;
  }
  return { since: d.since, windowEndsAt: start + windowMs, done, needed: rules.main.comeback.tasks, debt: { ...state.main.debt } };
}

export interface StaleTask {
  taskId: string;
  name: string;
  /** Current payout as a fraction of full value. */
  multiplier: number;
}

/** Open tasks paying less than full value: the avatar's "I need to make it harder" warning. */
export function staleTasks(state: CultivatorState, rules: RulesConfig = RULES_V1): StaleTask[] {
  const out: StaleTask[] = [];
  for (const [taskId, t] of Object.entries(state.main.tasks)) {
    if (statusAt(state, t, state.clock, rules) !== "open") continue;
    const multiplier = decayMultiplier(state.main.lineages[t.key]?.ageMs ?? 0, rules.main.repetition);
    if (multiplier < 1) out.push({ taskId, name: t.name, multiplier });
  }
  return out.sort((a, b) => a.multiplier - b.multiplier);
}

/** Push alerts for open quests at 72, 48, 24 and 1 hour before the deadline. */
export function questDeadlineAlerts(state: CultivatorState, rules: RulesConfig = RULES_V1): { questId: string; at: number; hoursLeft: number }[] {
  const out: { questId: string; at: number; hoursLeft: number }[] = [];
  for (const [questId, q] of Object.entries(state.main.quests)) {
    if (q.completedAt !== null || dueStatus(q.due, state.rest, state.clock, rules) !== "open") continue;
    // During closed-door rest the deadline keeps moving; alerts are projected from where it would stand at the rest's end.
    const deadline = state.rest ? effectiveDeadline(q.due, state.rest, state.rest.end) : q.due.deadline;
    for (const h of rules.main.questDeadlineAlertHours) {
      const at = deadline - h * HOUR;
      if (at >= state.clock) out.push({ questId, at, hoursLeft: h });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}


/** The cosmetic cultivation streak (ruling 57): no rewards attached. */
export function cultivationStreak(state: CultivatorState): { current: number; best: number } {
  return { ...state.main.streak };
}
