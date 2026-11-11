/**
 * Realm simulator (Main part 3): how long honest cultivators take through
 * the Step 1 realms and levels with the provisional Qi thresholds, how long
 * they wait for Qi, what a failure takes, and what repent cycling costs
 * (rulings 62, 73-109).
 *
 * Every persona answers the interview on day 0 and decides its three areas
 * in the first week. Its income comes from Main tasks (the study, project or
 * milestone habits of the Main simulator), plus Body and Soul twice a week.
 * Its tribulations follow one plan per realm:
 * - Foundation: one 4-week tribulation at a time, passed on day 20.
 * - Core Formation: a set of 6 declared on entry, due every 2 months, each
 *   passed 10 days before its deadline.
 * - Nascent Soul: a set of 4 declared on entry (due at 6, 8, 10 and 12
 *   months), locked on day 30, each passed 10 days before its deadline.
 * The repent cycler repents at every Nascent Soul entry (one Core Formation
 * tribulation marked faked, rescheduled and passed again), and when its
 * avatar dies it completes a revival quest of two week-long projects.
 *
 * Output: a summary on stdout and a CSV row per persona in tools/sim/out/.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { OATH_TEXT, REPENT_OATH, TRIBULATION_OATH, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  RuleViolation,
  applyEvent,
  breakthroughRollOutcome,
  conqueredTribulations,
  initialState,
  pendingBreakthroughRolls,
  pendingTribulationRolls,
  realmStatus,
  tribulationDropOutcome,
  tribulationStatus,
  type CultivatorState,
  type Realm,
} from "@cultivation/rules";

export const T0 = Date.UTC(2026, 10, 2, 3); // Monday 00:00 in Buenos Aires
const HOUR = 60 * 60 * 1000;
const YEARS = 4;
const DAYS = YEARS * 364;
const MONTH = 365.25 / 12;

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

let seq = 0;

export class Cultivator {
  s: CultivatorState = initialState(RULES_V1);
  private roll = rng(23);
  private queue: GameEvent[] = [];
  waitingDays = 0;
  /** Sum of every legendary roll's chance: the expected legendary items, free of seed luck. */
  expectedLegendary = 0;

  at(day: number, hour: number): number {
    return T0 + day * DAY + hour * HOUR;
  }
  private event(type: GameEvent["type"], at: number, rest: object): GameEvent {
    return { id: `realm${++seq}`, userId: "sim", at, type, ...rest } as GameEvent;
  }
  /** Queue a routine event; the day's routine is applied in time order by flush(). */
  ev(type: GameEvent["type"], at: number, rest: object): void {
    this.queue.push(this.event(type, at, rest));
  }
  flush(): void {
    const events = this.queue.sort((a, b) => a.at - b.at);
    this.queue = [];
    for (const e of events) this.apply(e);
  }
  /** Apply at once, then let the server roll whatever the event earned. */
  now(type: GameEvent["type"], at: number, rest: object): boolean {
    try {
      this.apply(this.event(type, at, rest));
      return true;
    } catch (e) {
      if (!(e instanceof RuleViolation)) throw e;
      return false;
    }
  }
  private apply(e: GameEvent): void {
    this.s = applyEvent(this.s, e, RULES_V1);
    for (const p of pendingTribulationRolls(this.s)) {
      this.s = applyEvent(this.s, this.event("TribulationDropRolled", this.s.clock, { eventId: p.eventId, drop: tribulationDropOutcome(this.roll()) }), RULES_V1);
    }
    for (const p of pendingBreakthroughRolls(this.s)) {
      this.expectedLegendary += p.chance;
      this.s = applyEvent(this.s, this.event("BreakthroughRolled", this.s.clock, { step: p.step, item: breakthroughRollOutcome(p.chance, this.roll()) }), RULES_V1);
    }
  }
}

// ---- Income habits ----------------------------------------------------------

export type Income = (c: Cultivator, day: number) => void;

export const version = (day: number) => Math.floor(day / 28) + 1;

/** One mid study a day, a new linked version every 4 weeks (about 276 Main Qi a month). */
export const study: Income = (c, day) => {
  if (day % 28 === 0) {
    const v = version(day);
    c.ev("MainTaskDefined", c.at(day, 7), {
      taskId: `study-${v}`,
      name: `Study v${v}`,
      difficulty: "mid",
      effort: "session",
      schedule: { kind: "recurring", count: 1, per: "day" },
      ...(v > 1 ? { replaces: `study-${v - 1}` } : {}),
    });
  }
  c.ev("MainTaskCompleted", c.at(day, 19), { taskId: `study-${version(day)}` });
};

/** A hard, day-sized project each week, worked on Tuesday and Thursday, done on Saturday (about 541 a month). */
export const weeklyProject: Income = (c, day) => {
  const w = Math.floor(day / 7);
  if (day % 7 === 0) {
    const at = c.at(day, 8);
    c.ev("MainTaskDefined", at, { taskId: `p${w}`, name: `Project ${w}`, difficulty: "hard", effort: "day", schedule: { kind: "once", deadline: at + 6.6 * DAY } });
  }
  if (day % 7 === 1 || day % 7 === 3) c.ev("MainTaskWorkedOn", c.at(day, 18), { taskId: `p${w}` });
  if (day % 7 === 5) c.ev("MainTaskCompleted", c.at(day, 15), { taskId: `p${w}` });
};

/** Reference only (ruling 62): a hard, project-sized milestone every week, as a yearly 52-member quest. */
const weeklyMilestones: Income = (c, day) => {
  const year = Math.floor(day / 364);
  const d = day % 364;
  if (d === 0) {
    const start = c.at(day, 8);
    c.ev("MainQuestDefined", start, {
      questId: `goal${year}`,
      name: `Year goal ${year}`,
      deadline: start + 364 * DAY,
      tasks: Array.from({ length: 52 }, (_, i) => ({
        taskId: `ms${year}-${i}`,
        name: `Milestone ${year}-${i}`,
        difficulty: "hard",
        effort: "project",
        deadline: start + (i + 1) * 7 * DAY,
      })),
    });
  }
  const i = Math.floor(d / 7);
  if (d % 7 === 5) c.ev("MainTaskCompleted", c.at(day, 15), { taskId: `ms${year}-${i}` });
  else if (d % 7 === 0 || d % 7 === 2 || d % 7 === 4) c.ev("MainTaskWorkedOn", c.at(day, 18), { taskId: `ms${year}-${i}` });
};

const both: Income = (c, day) => {
  study(c, day);
  weeklyProject(c, day);
};

// ---- Tribulation habits -----------------------------------------------------

export interface Habits {
  /** Lets each tribulation fail once, then reschedules it 21 days out and passes it 10 days later. */
  failFirst?: boolean;
  /** Fast track: Foundation tribulations claimed the day they're declared, with evidence. */
  fastTrack?: boolean;
  /** Switches the Main discipline once, at Foundation's mid level (paying the price; nothing restarts, ruling 90). */
  switchMidFoundation?: boolean;
  /** Declares the fewest tribulations with 1-day deadlines and passes them the next day, so only Qi sets the pace. */
  eager?: boolean;
  /** Repents at every Nascent Soul entry, cycling back through Core Formation's last steps (ruling 104). */
  repentCycle?: boolean;
  /** The eternal student: changes the core discipline at every Nascent Soul entry, climbing Core Formation again (ruling 111). */
  changeDiscipline?: boolean;
}

interface Plan {
  passDay: number;
  failedOnce: boolean;
}

export function tribulationPlan(h: Habits) {
  const plans = new Map<string, Plan>();
  let switched = false;
  let revivalDay: number | null = null;
  const declare = (c: Cultivator, id: string, day: number, days: number, passDay: number) => {
    const at = c.at(day, 22);
    if (c.now("TribulationDeclared", at, { tribulationId: id, title: id, criteria: `Pass ${id}`, deadline: at + days * DAY })) {
      plans.set(id, { passDay, failedOnce: false });
    }
  };
  return (c: Cultivator, day: number) => {
    const s = c.s;
    const at = c.at(day, 22);
    const realm = s.main.realm;
    // Areas in the first week.
    const area = ({ 1: "main", 3: "body", 6: "soul" } as Record<number, "main" | "body" | "soul">)[day];
    if (area) c.now("AreaDecided", at, { path: area, choice: `${area} discipline` });

    // Claims and reschedules.
    for (const [id, p] of plans) {
      const status = tribulationStatus(s, id);
      if (status === "failed") {
        p.failedOnce = true;
        p.passDay = day + 10;
        c.now("TribulationRescheduled", at, { tribulationId: id, deadline: at + 21 * DAY });
      } else if (status === "open" && day >= p.passDay && !(h.failFirst && !p.failedOnce)) {
        const evidence = h.fastTrack && realm === "foundation_establishment" ? { evidence: [{ kind: "link", ref: "https://example.com" }] } : {};
        c.now("TribulationClaimed", at, { tribulationId: id, oath: TRIBULATION_OATH, llmReview: "skipped", ...evidence });
      }
    }

    if (h.repentCycle) {
      // Dead: a revival quest of two project-sized tasks (8 days of work), done over two weeks (ruling 106).
      if (c.s.progress.diedAt !== null) {
        if (revivalDay === null) {
          revivalDay = day;
          c.now("MainQuestDefined", at, {
            questId: `revival${day}`,
            name: "Revival",
            deadline: at + 30 * DAY,
            tasks: [1, 2].map((k) => ({ taskId: `revival${day}-${k}`, name: `Revival ${k}`, difficulty: "hard", effort: "project" })),
          });
        } else if (day === revivalDay + 6 || day === revivalDay + 13) {
          c.now("MainTaskCompleted", at, { taskId: `revival${revivalDay}-${day === revivalDay + 6 ? 1 : 2}` });
        }
      } else revivalDay = null;
      if (realm === "nascent_soul") {
        const fake = Object.entries(c.s.tribulations.items).find(([, t]) => t.realm === "core_formation" && t.status === "passed" && t.closedAt === null);
        if (fake && c.now("Repented", at, { oath: REPENT_OATH, faked: [fake[0]] })) return;
      }
    }

    if (h.changeDiscipline && realm === "nascent_soul" && c.now("AreaDecided", at, { path: "main", choice: `discipline ${day}` })) return;

    const open = [...plans.keys()].filter((id) => {
      const t = c.s.tribulations.items[id]!;
      return t.realm === c.s.main.realm && t.closedAt === null && (t.status === "open" || t.status === "failed");
    });
    const status = realmStatus(c.s);
    if (realm === "foundation_establishment") {
      if (h.switchMidFoundation && !switched && status.level === "mid") {
        switched = c.now("AreaDecided", at, { path: "main", choice: "a second discipline" });
        return;
      }
      if (status.level === "great_circle" && status.next?.missing === "choice") c.now("CoreFormed", at, { choice: "main discipline", class: "monk" });
      else if (open.length === 0 && (status.tribulations?.passed ?? 0) < 3) {
        if (h.eager) declare(c, `fe${day}`, day, 1, day + 1);
        else declare(c, `fe${day}`, day, 28, h.fastTrack ? day : day + 20);
      }
    } else if (realm === "core_formation" && (status.tribulations?.total ?? 0) === 0) {
      if (h.eager) for (let k = 1; k <= 5; k++) declare(c, `cf${day}-${k}`, day, 1, day + 1);
      else for (let k = 1; k <= 6; k++) declare(c, `cf${day}-${k}`, day, 60 * k, day + 60 * k - 10);
    } else if (realm === "nascent_soul") {
      if (h.eager && open.length === 0 && c.s.progress.lockedAt === null) {
        declare(c, `ns${day}`, day, 1, day + 1);
        c.now("NascentSoulLocked", at, {});
      } else if (open.length === 0 && c.s.progress.lockedAt === null) for (const m of [6, 8, 10, 12]) declare(c, `ns${day}-${m}`, day, m * 30, day + m * 30 - 10);
      else if (c.s.progress.lockedAt === null && day - Math.floor((c.s.progress.enteredAt - T0) / DAY) >= 30) c.now("NascentSoulLocked", at, {});
    }
  };
}

// ---- Personas ---------------------------------------------------------------

interface Persona {
  label: string;
  income: Income;
  habits: Habits;
}

const PERSONAS: Persona[] = [
  { label: "honest studier (~276 Qi/mo)", income: study, habits: {} },
  { label: "weekly project (~541 Qi/mo)", income: weeklyProject, habits: {} },
  { label: "study + weekly project (~817 Qi/mo)", income: both, habits: {} },
  { label: "studier who fails every tribulation once", income: study, habits: { failFirst: true } },
  { label: "studier who switches foundation at mid", income: study, habits: { switchMidFoundation: true } },
  { label: "studier on the fast track", income: study, habits: { fastTrack: true } },
  { label: "reference: weekly hard milestones (ruling 62)", income: weeklyMilestones, habits: {} },
  { label: "eager studier: tribulations as fast as allowed", income: study, habits: { eager: true } },
  { label: "eager weekly project", income: weeklyProject, habits: { eager: true } },
  { label: "eager study + weekly project", income: both, habits: { eager: true } },
  { label: "eager reference: weekly hard milestones", income: weeklyMilestones, habits: { eager: true } },
  { label: "repent cycler: eager reference, repents at every Nascent Soul entry", income: weeklyMilestones, habits: { eager: true, repentCycle: true } },
  { label: "eternal student: eager reference, changes discipline at every Nascent Soul entry", income: weeklyMilestones, habits: { eager: true, changeDiscipline: true } },
  { label: "eternal student, honest pace: studier, changes discipline at every Nascent Soul entry", income: study, habits: { changeDiscipline: true } },
];

const REALM_ORDER: Realm[] = ["foundation_establishment", "core_formation", "nascent_soul", "spirit_realm"];

function simulate(p: Persona) {
  const c = new Cultivator();
  c.now("CultivatorCreated", T0, { name: "sim", tzOffsetMinutes: -180, oath: OATH_TEXT });
  c.now("InterviewAnswered", T0, { interests: { main: "Mathematics", body: "Gym", soul: "Calm" } });
  c.now("BodyActivityDefined", T0, { activityId: "gym-1", name: "Gym v1", kind: "routine" });
  c.now("HeartDemonCreated", T0, { demonId: "d", name: "Impatience", positiveTasks: [{ taskId: "breathe", name: "Breathe" }], negativeTasks: [] });
  const plan = tribulationPlan(p.habits);
  let day = 0;
  for (; day < DAYS && c.s.main.realm !== "spirit_realm"; day++) {
    p.income(c, day);
    if (day > 0 && day % 28 === 0) c.ev("BodyActivityDefined", c.at(day, 6), { activityId: `gym-${version(day)}`, name: `Gym v${version(day)}`, kind: "routine" });
    if (day % 7 === 1 || day % 7 === 4) c.ev("BodyActivityLogged", c.at(day, 20), { activityId: `gym-${version(day)}` });
    if (day % 7 === 2 || day % 7 === 6) c.ev("SoulTaskLogged", c.at(day, 21), { taskId: "breathe" });
    c.flush();
    plan(c, day);
    if (realmStatus(c.s).next?.waitingForQi) c.waitingDays += 1;
  }
  const steps = c.s.progress.steps;
  const monthOf = (realm: Realm) => {
    const step = steps.find((x) => x.kind !== "restart" && x.realm === realm && x.level !== "mid" && x.level !== "late" && x.level !== "great_circle");
    return step ? ((step.at - T0) / DAY / MONTH).toFixed(1) : "—";
  };
  return {
    label: p.label,
    reached: REALM_ORDER.map(monthOf),
    end: `${c.s.main.realm}${c.s.progress.level ? ` ${c.s.progress.level}` : ""}`,
    waitingMonths: (c.waitingDays / MONTH).toFixed(1),
    qiSpent: steps.reduce((sum, x) => sum + x.qiSpent, 0),
    failures: c.s.tribulations.spent.failures.count,
    failureQi: c.s.tribulations.spent.failures.qi,
    largestFailure: c.s.tribulations.largestFailureQi,
    tribulationRolls: c.s.tribulations.drops.none + c.s.tribulations.drops.gain_potion + c.s.tribulations.drops.legendary_potion,
    legendaryRolls: c.s.progress.legendaryRolls.none + c.s.progress.legendaryRolls.legendary,
    legendaryItems: c.s.progress.legendaryRolls.legendary,
    expectedPerYear: c.expectedLegendary / (day / 364),
    conquered: conqueredTribulations(c.s).length,
    repents: Object.values(c.s.progress.repents).reduce((a, b) => a + b, 0),
    deaths: c.s.progress.deaths,
    cyclingFlags: c.s.main.flags.filter((f) => f.code === "repent_cycling").length,
  };
}

export function runRealmScenarios(outDir: string): void {
  const header = [
    "persona",
    "Foundation (month)",
    "Core Formation",
    "Nascent Soul",
    "Spirit Realm",
    `end (${YEARS} years max)`,
    "months waiting for Qi",
    "Qi spent on steps",
    "failures",
    "Qi lost to failures",
    "largest single failure",
    "tribulation item rolls",
    "legendary rolls",
    "legendary items",
    "expected legendary items/yr",
    "conquered tribulations",
    "repents",
    "deaths",
    "cycling flags",
  ];
  const rows = PERSONAS.map(simulate).map((r) => [
    r.label,
    ...r.reached,
    r.end,
    r.waitingMonths,
    String(Math.round(r.qiSpent)),
    String(r.failures),
    String(Math.round(r.failureQi)),
    String(Math.round(r.largestFailure)),
    String(r.tribulationRolls),
    String(r.legendaryRolls),
    String(r.legendaryItems),
    r.expectedPerYear.toFixed(2),
    String(r.conquered),
    String(r.repents),
    String(r.deaths),
    String(r.cyclingFlags),
  ]);
  console.log(`\nRealms: month each realm was reached, Qi waits and failure losses (up to ${YEARS} years)\n`);
  console.log(header.join("\t"));
  for (const r of rows) console.log(r.join("\t"));
  writeFileSync(join(outDir, "realms.csv"), [header.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(","))].join("\n"));
}
