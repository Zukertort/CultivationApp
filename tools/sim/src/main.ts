/**
 * Main path simulator (part 1): tasks, quests, repetition decay, quest item
 * drops and the procrastination tax. Runs synthetic cultivators through the real rules
 * engine and reports what Main pays per month, what the tax takes, and
 * whether splitting or bundling work ever pays more than doing it whole.
 *
 * Every persona answers the interview on day 0 (all three tax clocks start).
 * Unless noted, each also trains Body twice a week and practices Soul twice a
 * week, so only Main differs between personas.
 *
 * Output: a summary on stdout and weekly CSV rows in tools/sim/out/.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { OATH_TEXT, type Difficulty, type Effort, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  advanceTo,
  applyEvent,
  initialState,
  pendingQuestRolls,
  questBonusCap,
  questDropOutcome,
  workDays,
  type CultivatorState,
  type RulesConfig,
} from "@cultivation/rules";

const T0 = Date.UTC(2026, 10, 2, 3); // Monday 00:00 in Buenos Aires
const HOUR = 60 * 60 * 1000;
const WEEKS = 52;
const MONTHS = WEEKS / (52 / 12);

let seq = 0;

/** Seeded PRNG (mulberry32) standing in for the server's secure RNG, so runs are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Runner {
  private roll = rng(7);
  s: CultivatorState;
  rows: string[] = [];
  deviationWeeks = 0;
  firstDeviationWeek: number | null = null;
  constructor(readonly rules: RulesConfig) {
    this.s = initialState(rules);
  }
  private queue: GameEvent[] = [];
  /** Queue an event; each day's events are applied in time order by flush(). */
  ev(type: GameEvent["type"], at: number, rest: object): void {
    this.queue.push({ id: `main${++seq}`, userId: "sim", at, type, ...rest } as GameEvent);
  }
  flush(): void {
    const events = this.queue.sort((a, b) => a.at - b.at);
    this.queue = [];
    for (const e of events) this.s = applyEvent(this.s, e, this.rules);
    // Completions are logged offline; the server rolls each completed quest's item when the day syncs.
    for (const p of pendingQuestRolls(this.s)) {
      const drop = questDropOutcome(p.chance, this.roll());
      this.s = applyEvent(this.s, { id: `main${++seq}`, userId: "sim", at: this.s.clock, type: "MainQuestDropRolled", eventId: p.eventId, drop }, this.rules);
    }
  }
  at(day: number, hour: number): number {
    return T0 + day * DAY + hour * HOUR;
  }
  once(taskId: string, name: string, day: number, hour: number, difficulty: Difficulty, effort: Effort, daysToDeadline: number): void {
    const at = this.at(day, hour);
    this.ev("MainTaskDefined", at, { taskId, name, difficulty, effort, schedule: { kind: "once", deadline: at + daysToDeadline * DAY } });
  }
  daily(taskId: string, name: string, day: number, difficulty: Difficulty, effort: Effort = "session", replaces?: string): void {
    this.ev("MainTaskDefined", this.at(day, 7), {
      taskId,
      name,
      difficulty,
      effort,
      schedule: { kind: "recurring", count: 1, per: "day" },
      ...(replaces === undefined ? {} : { replaces }),
    });
  }
  quest(questId: string, day: number, hour: number, tasks: [string, string, Difficulty, Effort][]): void {
    const at = this.at(day, hour);
    this.ev("MainQuestDefined", at, {
      questId,
      name: questId,
      deadline: at + DAY,
      tasks: tasks.map(([taskId, name, difficulty, effort]) => ({ taskId, name, difficulty, effort })),
    });
  }
  done(taskId: string, day: number, hour: number): void {
    this.ev("MainTaskCompleted", this.at(day, hour), { taskId });
  }
  work(taskId: string, day: number, hour: number): void {
    this.ev("MainTaskWorkedOn", this.at(day, hour), { taskId });
  }
}

interface Persona {
  label: string;
  /** Main habits for one day. */
  plan: (r: Runner, day: number) => void;
  /** Days on which the cultivator does nothing at all (no Body or Soul either). */
  away?: (day: number) => boolean;
  rules?: RulesConfig;
}

/** Monthly version suffix: "Study v1", "Study v2", ... (leveling up every 4 weeks). */
const v = (day: number) => Math.floor(day / 28) + 1;

/**
 * A 1-a-day recurring task, replaced by a new version every 4 weeks unless
 * `stagnant`. The new version is linked to the old one (ruling 55), so it
 * takes over the day's count; `unlinked` archives the old one instead.
 */
function studier(difficulty: Difficulty, names: string[], stagnant = false, unlinked = false) {
  let current: number | null = null;
  return (r: Runner, day: number) => {
    const version = stagnant ? 1 : v(day);
    if (current !== version) {
      for (const n of names) {
        const old = current === null ? undefined : `${n}-${current}`;
        if (old && unlinked) r.ev("MainTaskArchived", r.at(day, 6), { taskId: old });
        r.daily(`${n}-${version}`, `${n} v${version}`, day, difficulty, "session", unlinked ? undefined : old);
      }
      current = version;
    }
    for (const n of names) r.done(`${n}-${version}`, day, 19);
  };
}


const floorRounding: RulesConfig = { ...RULES_V1, main: { ...RULES_V1.main, tax: { ...RULES_V1.main.tax, partialPeriods: "floor" } } };

/** A hard, day-sized project each week, done on Saturday; optionally "worked on" on Tuesday and Thursday. */
function weeklyProject(workOn: boolean) {
  return (r: Runner, d: number) => {
    const w = Math.floor(d / 7);
    if (d % 7 === 0) r.once(`p${w}`, `Project ${w}`, d, 8, "hard", "day", 6.6);
    if (workOn && (d % 7 === 1 || d % 7 === 3)) r.work(`p${w}`, d, 18);
    if (d % 7 === 5) r.done(`p${w}`, d, 15);
  };
}

/**
 * A year goal as one quest of `count` hard, project-sized milestones, one due
 * every `every` days; each is worked on Monday, Wednesday and Friday and done
 * two days before it is due.
 */
function yearGoal(count: number, every: number) {
  return (r: Runner, d: number) => {
    if (d === 0) {
      const start = r.at(0, 8);
      r.ev("MainQuestDefined", start, {
        questId: "goal",
        name: "Year goal",
        deadline: start + count * every * DAY,
        tasks: Array.from({ length: count }, (_, i) => ({
          taskId: `ms${i}`,
          name: `Milestone ${i}`,
          difficulty: "hard",
          effort: "project",
          deadline: start + (i + 1) * every * DAY,
        })),
      });
    }
    const i = Math.floor(d / every);
    if (i >= count) return;
    if (d % every === every - 2) r.done(`ms${i}`, d, 15);
    else if (d % 7 === 0 || d % 7 === 2 || d % 7 === 4) r.work(`ms${i}`, d, 18);
  };
}

/** Archives the daily task at 23:00 and restores it at 01:00; never completes it. */
function dodger(r: Runner, day: number) {
  if (day === 0) r.daily("chore", "Chore", 0, "mid");
  else r.ev("MainTaskRestored", r.at(day, 1), { taskId: "chore", schedule: { kind: "recurring", count: 1, per: "day" } });
  r.ev("MainTaskArchived", r.at(day, 23), { taskId: "chore" });
}

const PERSONAS: Persona[] = [
  { label: "daily studier, mid, levels up monthly", plan: studier("mid", ["Study"]) },
  { label: "same, new version not linked (archived)", plan: studier("mid", ["Study"], false, true) },
  { label: "daily studier, mid, never levels up", plan: studier("mid", ["Study"], true) },
  { label: "rates everything deadly", plan: studier("deadly", ["Study"]) },
  { label: "splitter: same work as 2 easy tasks", plan: studier("easy", ["Study A", "Study B"]) },
  {
    label: "splitter: 2 easy tasks as a daily quest",
    plan: (r, d) => {
      const ver = v(d);
      r.quest(`q${d}`, d, 7, [
        [`a${d}`, `Study A v${ver}`, "easy", "session"],
        [`b${d}`, `Study B v${ver}`, "easy", "session"],
      ]);
      r.done(`a${d}`, d, 18);
      r.done(`b${d}`, d, 19);
    },
  },
  { label: "3 mid tasks a day, separately", plan: studier("mid", ["Read", "Write", "Solve"]) },
  {
    label: "3 mid tasks a day, as a quest",
    plan: (r, d) => {
      const ver = v(d);
      const names = ["Read", "Write", "Solve"];
      r.quest(`q${d}`, d, 7, names.map((n) => [`${n}${d}`, `${n} v${ver}`, "mid", "session"] as [string, string, Difficulty, Effort]));
      names.forEach((n, i) => r.done(`${n}${d}`, d, 17 + i));
    },
  },
  { label: "weekly project, hard, a day's work", plan: weeklyProject(false) },
  { label: "weekly project, worked on Tue and Thu", plan: weeklyProject(true) },
  { label: "year goal: 10 milestones (5-weekly)", plan: yearGoal(10, 35) },
  { label: "year goal: 52 weekly milestones", plan: yearGoal(52, 7) },
  {
    label: "fake project: far deadline, only 'works on' it",
    plan: (r, d) => {
      if (d === 0) r.once("fake", "Fake project", 0, 8, "hard", "project", 364);
      if (d % 3 === 0 && d / 3 < 30) r.work("fake", d, 18); // 30 uses, the project cap
    },
  },
  {
    label: "project worked on for 6 weeks, then abandoned",
    plan: ((study) => (r: Runner, d: number) => {
      if (d === 0) r.once("abandoned", "Abandoned project", 0, 8, "hard", "project", 60);
      if (d < 42 && d % 3 === 0) r.work("abandoned", d, 18);
      if (d === 42) r.ev("MainTaskCancelled", r.at(d, 18), { taskId: "abandoned" });
      if (d >= 42) study(r, d);
    })(studier("mid", ["Study"])),
  },
  {
    label: "fake projects renewed every 90 days + a trivial task every 13 days",
    plan: (r, d) => {
      const n = Math.floor(d / 90);
      if (d % 90 === 0) r.once(`fake${n}`, `Fake project ${n}`, d, 8, "hard", "project", 364 - d > 100 ? 120 : 364 - d);
      if (d % 3 === 0) r.work(`fake${n}`, d, 18);
      if (d % 13 === 0) {
        r.once(`token${d}`, `Token ${d}`, d, 9, "trivial", "quick", 1);
        r.done(`token${d}`, d, 10);
      }
    },
  },
  {
    label: "trivial spammer, 10 quick tasks a day",
    plan: (r, d) => {
      for (let i = 0; i < 10; i++) {
        r.once(`t${d}-${i}`, `Spam ${d}-${i}`, d, 8 + i, "trivial", "quick", 1);
        r.done(`t${d}-${i}`, d, 8 + i + 0.5);
      }
    },
  },
  {
    label: "procrastinator: skips 1 week in 4",
    plan: ((study) => (r: Runner, d: number) => {
      if (Math.floor(d / 7) % 4 !== 3) study(r, d);
    })(studier("mid", ["Study"])),
  },
  {
    label: "honest skipper: daily task, never done",
    plan: (r, d) => {
      if (d === 0) r.daily("chore", "Chore", 0, "mid");
    },
  },
  { label: "archive dodger (old floor rounding)", plan: dodger, rules: floorRounding },
  { label: "archive dodger (fractional, ruling 48)", plan: dodger },
  {
    label: "quitter: 8 weeks on, 8 off, comes back",
    away: (d) => d >= 56 && d < 112,
    plan: ((study) => (r: Runner, d: number) => {
      if (d >= 56 && d < 112) return;
      if (d === 112) {
        for (const [i, n] of ["Comeback A", "Comeback B", "Comeback C"].entries()) {
          r.once(`cb${i}`, n, d, 8, "easy", "session", 5);
        }
      }
      if (d >= 112 && d < 115) r.done(`cb${d - 112}`, d, 10);
      study(r, d);
    })(studier("mid", ["Study"])),
  },
];

interface MainRun {
  persona: Persona;
  final: CultivatorState;
  firstDeviationWeek: number | null;
  deviationWeeks: number;
}

function simulate(p: Persona): MainRun {
  const r = new Runner(p.rules ?? RULES_V1);
  r.ev("CultivatorCreated", T0, { name: "sim", tzOffsetMinutes: -180, oath: OATH_TEXT });
  r.ev("InterviewAnswered", T0, { interests: { main: "Mathematics", body: "Gym", soul: "Calm" } });
  r.ev("BodyActivityDefined", T0, { activityId: "gym-1", name: "Gym v1", kind: "routine" });
  r.ev("HeartDemonCreated", T0, { demonId: "d", name: "Impatience", positiveTasks: [{ taskId: "breathe", name: "Breathe" }], negativeTasks: [] });

  for (let day = 0; day < WEEKS * 7; day++) {
    const away = p.away?.(day) ?? false;
    // Drink a gain potion as soon as one is stored and none is active (ruling 58).
    const inv = r.s.inventory;
    if (!away && inv.gainPotions > 0 && (inv.gainPotionUntil ?? 0) <= r.at(day, 6)) r.ev("PotionUsed", r.at(day, 6), { potion: "gain" });
    p.plan(r, day);
    if (!away) {
      // Body twice a week (leveling up monthly), Soul twice a week.
      if (day > 0 && day % 28 === 0) r.ev("BodyActivityDefined", r.at(day, 6), { activityId: `gym-${v(day)}`, name: `Gym v${v(day)}`, kind: "routine" });
      if (day % 7 === 1 || day % 7 === 4) r.ev("BodyActivityLogged", r.at(day, 20), { activityId: `gym-${v(day)}` });
      if (day % 7 === 2 || day % 7 === 6) r.ev("SoulTaskLogged", r.at(day, 21), { taskId: "breathe" });
    }
    r.flush();
    if (day % 7 === 6) {
      r.s = advanceTo(r.s, T0 + (day + 1) * DAY, r.rules);
      const m = r.s.main;
      const week = (day + 1) / 7;
      if (m.deviation) {
        r.deviationWeeks += 1;
        r.firstDeviationWeek ??= week;
      }
      r.rows.push(
        [week, m.earned.qi.toFixed(1), m.earned.gold.toFixed(1), r.s.qi.toFixed(1), r.s.gold.toFixed(1), m.taxPaid.main.qi.toFixed(1), m.debt.qi.toFixed(1), m.deviation ? 1 : 0].join(","),
      );
    }
  }
  const slug = p.label.split(/[^a-z0-9]+/i).filter(Boolean).join("-").toLowerCase();
  writeFileSync(join(outDirOf(), `main-${slug}.csv`), ["week,main_qi_earned,main_gold_earned,qi,gold,main_tax_qi,debt_qi,deviation", ...r.rows].join("\n"));
  return { persona: p, final: r.s, firstDeviationWeek: r.firstDeviationWeek, deviationWeeks: r.deviationWeeks };
}

let OUT = "";
const outDirOf = () => OUT;

export function runMainScenarios(outDir: string): void {
  OUT = outDir;
  const runs = PERSONAS.map(simulate);
  const n = (x: number, d = 0) => x.toFixed(d);

  console.log(`\nMain: earnings and tax per persona (${WEEKS} weeks; per month = /${n(MONTHS, 1)})\n`);
  console.log(
    ["persona", "Main Qi/mo", "Main gold/mo", "tax Qi main", "tax Qi body", "tax Qi soul", "ticks", "idle days", "1st deviation wk", "weeks in deviation", "comebacks", "end debt Qi", "postponed days cancelled", "postponed days charged", "quest rolls", "gain potions", "legendary potions", "churn flags", "best streak"].join("\t"),
  );
  for (const r of runs) {
    const m = r.final.main;
    console.log(
      [
        r.persona.label,
        n(m.earned.qi / MONTHS),
        n(m.earned.gold / MONTHS),
        n(m.taxPaid.main.qi),
        n(m.taxPaid.body.qi),
        n(m.taxPaid.soul.qi),
        n(m.taxPaid.main.ticks, 1),
        m.taxPaid.main.idleDays,
        r.firstDeviationWeek ?? "—",
        r.deviationWeeks,
        m.comebacks,
        n(m.debt.qi),
        m.postponed.cancelled.days,
        m.postponed.charged.days,
        m.drops.none + m.drops.gain_potion + m.drops.legendary_potion,
        m.drops.gain_potion,
        m.drops.legendary_potion,
        m.flags.length,
        m.streak.best,
      ].join("\t"),
    );
  }

  const qi = (label: string) => runs.find((r) => r.persona.label === label)!.final.main.earned.qi;
  const base = qi("daily studier, mid, levels up monthly");
  console.log(`\nMain: the same work done differently, relative to the daily studier (1.00 = same Qi; must never exceed 1.00 for splits)\n`);
  for (const label of ["splitter: same work as 2 easy tasks", "splitter: 2 easy tasks as a daily quest", "daily studier, mid, never levels up", "rates everything deadly"]) {
    console.log(`${label}\t${(qi(label) / base).toFixed(2)}`);
  }
  const sep = qi("3 mid tasks a day, separately");
  console.log(`3 mid tasks as a quest vs separately\t${(qi("3 mid tasks a day, as a quest") / sep).toFixed(2)}`);

  // What a quest's bonus pays (the cap for the members' days of work; rulings 51 and 54).
  console.log(`\nMain: the last completed quest's bonus\n`);
  for (const r of runs) {
    const m = r.final.main;
    const q = Object.values(m.quests)
      .filter((x) => x.completedAt !== null && !x.forfeited)
      .at(-1);
    if (!q) continue;
    const members = q.taskIds.map((id) => m.tasks[id]!);
    const paid = members.reduce((sum, t) => sum + t.paidBaseQi, 0);
    const days = workDays(members.map((t) => t.effort));
    console.log(`${r.persona.label}\t${n(days, 2)} days of work\tbonus ${n((100 * q.bonusQi) / paid, 1)}% (cap ${n(100 * questBonusCap(days), 1)}%)\t${n(q.bonusQi)} Qi`);
  }
}

