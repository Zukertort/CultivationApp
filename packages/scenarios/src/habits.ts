/**
 * Persona habits shared by the simulator and the dev scenarios: Main income
 * (study, weekly projects, milestones) and the tribulation plan per realm.
 *
 * Every persona answers the interview on day 0 and decides its three areas
 * in the first week. Its tribulations follow one plan per realm:
 * - Foundation: one 4-week tribulation at a time, passed on day 20.
 * - Core Formation: a set of 6 declared on entry, due every 2 months, each
 *   passed 10 days before its deadline.
 * - Nascent Soul: a set of 4 declared on entry (due at 6, 8, 10 and 12
 *   months), locked on day 30, each passed 10 days before its deadline.
 * The repent cycler repents at every Nascent Soul entry (one Core Formation
 * tribulation marked faked, rescheduled and passed again), and when its
 * avatar dies it completes a revival quest of two week-long projects.
 */
import { OATH_TEXT, REPENT_OATH, TRIBULATION_OATH, type ClassId } from "@cultivation/schema";
import { DAY, awaitingCompletion, realmStatus, tribulationStatus } from "@cultivation/rules";
import type { Cultivator } from "./cultivator.js";

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
export const weeklyMilestones: Income = (c, day) => {
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

export const both: Income = (c, day) => {
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
  /** The class chosen with CoreFormed at the end of Foundation (default monk). */
  class?: ClassId;
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
    // All three decided: lock them and break through (ruling 133).
    if (realm === "qi_condensation" && Object.values(s.progress.areas).every((a) => a !== null)) c.now("AreasLocked", at, {});

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

    // Complete the claims the balance covers, oldest first: completing is a purchase (ruling 169).
    for (const a of awaitingCompletion(c.s)) if (a.ready) c.now("TribulationCompleted", at, { tribulationId: a.tribulationId });

    // The realm as it stands now: a claim or completion may have broken through today (the old plan read it at the
    // start of the day and declared Core Formation's set in Nascent Soul).
    const now = c.s.main.realm;
    const open = [...plans.keys()].filter((id) => {
      const t = c.s.tribulations.items[id]!;
      return t.realm === c.s.main.realm && t.closedAt === null && (t.status === "open" || t.status === "failed");
    });
    const status = realmStatus(c.s);
    if (now === "foundation_establishment") {
      if (h.switchMidFoundation && !switched && status.level === "mid") {
        switched = c.now("AreaDecided", at, { path: "main", choice: "a second discipline" });
        return;
      }
      if (status.level === "great_circle" && status.next?.missing === "choice") c.now("CoreFormed", at, { choice: "main discipline", class: h.class ?? "monk" });
      // Completed and awaiting claims both fill Foundation's three (ruling 169).
      else if (open.length === 0 && (status.tribulations?.passed ?? 0) + (status.tribulations?.awaiting ?? 0) < 3) {
        if (h.eager) declare(c, `fe${day}`, day, 1, day + 1);
        else declare(c, `fe${day}`, day, 28, h.fastTrack ? day : day + 20);
      }
    } else if (now === "core_formation" && (status.tribulations?.total ?? 0) === 0) {
      if (h.eager) for (let k = 1; k <= 5; k++) declare(c, `cf${day}-${k}`, day, 1, day + 1);
      else for (let k = 1; k <= 6; k++) declare(c, `cf${day}-${k}`, day, 60 * k, day + 60 * k - 10);
    } else if (now === "nascent_soul") {
      if (h.eager && open.length === 0 && c.s.progress.lockedAt === null) {
        declare(c, `ns${day}`, day, 1, day + 1);
        c.now("NascentSoulLocked", at, {});
      } else if (open.length === 0 && c.s.progress.lockedAt === null) for (const m of [6, 8, 10, 12]) declare(c, `ns${day}-${m}`, day, m * 30, day + m * 30 - 10);
      else if (c.s.progress.lockedAt === null && day - c.dayOf(c.s.progress.enteredAt) >= 30) c.now("NascentSoulLocked", at, {});
    }
  };
}


// ---- A whole day ------------------------------------------------------------

export interface Setup {
  name?: string;
  tzOffsetMinutes?: number;
  /** Creates the heart demon "Impatience" with a breathing practice (default true). */
  demon?: boolean;
}

/**
 * The realm simulator's cultivator on day 0: created, interviewed, one gym
 * routine and one heart demon with a breathing practice.
 */
export function setupBasic(c: Cultivator, o: Setup = {}): void {
  const at = c.at(0, 0);
  c.now("CultivatorCreated", at, { name: o.name ?? "sim", tzOffsetMinutes: o.tzOffsetMinutes ?? -180, oath: OATH_TEXT });
  c.now("InterviewAnswered", at, { interests: { main: "Mathematics", body: "Gym", soul: "Calm" } });
  c.now("BodyActivityDefined", at, { activityId: "gym-1", name: "Gym v1", kind: "routine" });
  if (o.demon ?? true) c.now("HeartDemonCreated", at, { demonId: "d", name: "Impatience", positiveTasks: [{ taskId: "breathe", name: "Breathe" }], negativeTasks: [] });
}

export interface Routine {
  income: Income;
  /** Days of the week (day % 7) with a gym session; default 1 and 4. */
  gym?: readonly number[];
  /** Days of the week with the breathing practice; default 2 and 6. */
  breathe?: readonly number[];
}

/** One day of the realm simulator's routine: income, gym (a new version every 4 weeks), breathing, then the queued events in time order. */
export function routineDay(c: Cultivator, r: Routine, day: number): void {
  r.income(c, day);
  if (day > 0 && day % 28 === 0) c.ev("BodyActivityDefined", c.at(day, 6), { activityId: `gym-${version(day)}`, name: `Gym v${version(day)}`, kind: "routine" });
  if ((r.gym ?? [1, 4]).includes(day % 7)) c.ev("BodyActivityLogged", c.at(day, 20), { activityId: `gym-${version(day)}` });
  if ((r.breathe ?? [2, 6]).includes(day % 7)) c.ev("SoulTaskLogged", c.at(day, 21), { taskId: "breathe" });
  c.flush();
}
