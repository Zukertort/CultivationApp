import { describe, expect, it } from "vitest";
import { OATH_TEXT, type Difficulty, type Effort, type GameEvent, type Period } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  RuleViolation,
  advanceTo,
  applyEvent,
  deviationStatus,
  goldForPoints,
  mainQuestStatus,
  mainTaskStatus,
  pendingQuestRolls,
  periodProgress,
  pushAlertPlan,
  qiForPoints,
  questBonusCap,
  questDeadlineAlerts,
  questDropChance,
  questDropOutcome,
  questQiRatio,
  replay,
  staleTasks,
  taxForecast,
  workDays,
  workPoints,
  type CultivatorState,
  type RulesConfig,
} from "./index.js";

// Day 0 = Monday 2026-11-02 00:00 in Buenos Aires (UTC-3), so local days line up with ISO weeks.
const T0 = Date.UTC(2026, 10, 2, 3);
const H = 60 * 60 * 1000;
let seq = 0;
const ev = <T extends GameEvent["type"]>(type: T, at: number, rest: Omit<Extract<GameEvent, { type: T }>, "id" | "userId" | "at" | "type">) =>
  ({ id: `m${++seq}`, userId: "u1", at, type, ...rest }) as unknown as GameEvent;

const created = ev("CultivatorCreated", T0, { name: "Ricardo", tzOffsetMinutes: -180, oath: OATH_TEXT });
const interview = (at = T0) => ev("InterviewAnswered", at, { interests: { main: "Mathematics", body: "BJJ", soul: "" } });
const once = (taskId: string, at: number, deadline: number, difficulty: Difficulty = "mid", effort: Effort = "session", name = taskId) =>
  ev("MainTaskDefined", at, { taskId, name, difficulty, effort, schedule: { kind: "once", deadline } });
const recurring = (taskId: string, at: number, count: number, per: Period, opts: { difficulty?: Difficulty; effort?: Effort; endsAt?: number; name?: string } = {}) =>
  ev("MainTaskDefined", at, {
    taskId,
    name: opts.name ?? taskId,
    difficulty: opts.difficulty ?? "mid",
    effort: opts.effort ?? "session",
    schedule: { kind: "recurring", count, per, ...(opts.endsAt === undefined ? {} : { endsAt: opts.endsAt }) },
  });
const complete = (taskId: string, at: number) => ev("MainTaskCompleted", at, { taskId });
const quest = (questId: string, at: number, deadline: number, tasks: [string, Difficulty, Effort][]) =>
  ev("MainQuestDefined", at, {
    questId,
    name: questId,
    deadline,
    tasks: tasks.map(([taskId, difficulty, effort]) => ({ taskId, name: taskId, difficulty, effort })),
  });

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof RuleViolation) return e.code;
    throw e;
  }
  return undefined;
}

/** Apply events in order to a state. */
const apply = (s: CultivatorState, ...events: GameEvent[]) => events.reduce((acc, e) => applyEvent(acc, e), s);
const withGold = (s: CultivatorState, gold: number): CultivatorState => ({ ...s, gold });
const withRules = (patch: Partial<RulesConfig["main"]>): RulesConfig => ({ ...RULES_V1, main: { ...RULES_V1.main, ...patch } });

describe("payouts", () => {
  it("prices work as difficulty points x effort weight on a convex Qi curve", () => {
    expect(workPoints("mid", "session")).toBe(4);
    expect(workPoints("hard", "day")).toBe(32);
    expect([1, 2, 4, 8, 16].map((w) => qiForPoints(w))).toEqual([1, 3, 8, 20, 50]);
    expect(qiForPoints(0.25)).toBe(0.25);
    expect(qiForPoints(6)).toBe(14);
    expect(qiForPoints(32)).toBe(110); // the last slope (3.75 per point) continues
    expect(goldForPoints(4)).toBe(5);
  });

  it("pays a mid session 8 Qi and 5 gold, with the tier's gold bonus", () => {
    const s = replay([created, once("a", T0, T0 + DAY), complete("a", T0 + H)]);
    expect(s.qi).toBeCloseTo(8, 9);
    expect(s.gold).toBeCloseTo(5 * 1.01, 9); // Turtle +1% gold on Main gold (ruling 35)
  });

  it("applies the tier's core Qi and gold bonuses to Main, and keeps the tier gold bonus off the roulette", () => {
    let s = replay([created, once("a", T0, T0 + DAY)]);
    s = { ...s, companion: { ...s.companion, tier: "horse", food: 800 }, goldenTickets: 1 };
    s = apply(s, complete("a", T0 + H));
    expect(s.qi).toBeCloseTo(8 * 1.1, 9); // Horse +10% Qi on core tasks
    expect(s.gold).toBeCloseTo(5 * 1.2, 9); // Horse +20% gold
    const spun = apply(s, ev("RouletteSpun", T0 + 2 * H, { prize: "gold" }));
    expect(spun.gold - s.gold).toBeCloseTo(100, 9); // no tier bonus outside Body and Main
  });

  it("applies the pose Qi bonus to every Qi gain", () => {
    let s = replay([
      created,
      ev("SkillDefined", T0, { skillId: "bjj", name: "BJJ", ranks: ["white"] }),
      ev("SkillRankAchieved", T0, { skillId: "bjj", rankIndex: 0 }),
      once("a", T0, T0 + DAY),
      complete("a", T0 + H),
    ]);
    expect(s.qi).toBeCloseTo(8 * 1.01, 9); // Heroic pose +1%
    s = apply({ ...s, goldenTickets: 1 }, ev("RouletteSpun", T0 + 2 * H, { prize: "qi" }));
    expect(s.qi).toBeCloseTo(8 * 1.01 + 50 * 1.01, 9);
  });

  it("tapers simple tasks above the first two realms, Qi only", () => {
    let s = replay([created, once("easy", T0, T0 + DAY, "easy"), once("mid", T0, T0 + DAY, "mid")]);
    s = { ...s, main: { ...s.main, realm: "core_formation" } };
    s = apply(s, complete("easy", T0 + H));
    expect(s.qi).toBeCloseTo(3 * 0.5, 9);
    expect(s.gold).toBeCloseTo(2.5 * 1.01, 9);
    s = apply(s, complete("mid", T0 + 2 * H));
    expect(s.qi).toBeCloseTo(1.5 + 8, 9);
  });
});

describe("splitting never pays more (ruling 27)", () => {
  const grid = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256];
  const cuts = [0.1, 0.25, 0.3, 0.5, 0.7, 0.9];

  it("pays one task at least as much as any split into pieces", () => {
    for (const w of grid) {
      for (const a of cuts) {
        for (const b of cuts) {
          // Three pieces: w*a, (w - w*a)*b and the rest.
          const p1 = w * a;
          const p2 = (w - p1) * b;
          const p3 = w - p1 - p2;
          expect(qiForPoints(p1) + qiForPoints(p2) + qiForPoints(p3)).toBeLessThanOrEqual(qiForPoints(w) + 1e-9);
          expect(goldForPoints(p1) + goldForPoints(p2) + goldForPoints(p3)).toBeCloseTo(goldForPoints(w), 9);
        }
      }
    }
  });

  it("never raises a quest's total by splitting a member, and never beats one task of the combined work", () => {
    const total = (members: number[], days = 365) => members.reduce((sum, w) => sum + qiForPoints(w), 0) * questQiRatio(members, days);
    for (const x of grid) {
      for (const y of grid) {
        const members = [x, y];
        const sum = x + y;
        expect(total(members)).toBeLessThanOrEqual(qiForPoints(sum) + 1e-9);
        for (const c of cuts) {
          expect(total([x * c, x - x * c, y])).toBeLessThanOrEqual(total(members) + 1e-9);
        }
      }
    }
  });

  it("closes the count-bonus exploit: splitting a quest's small member gains nothing", () => {
    const pay = (tasks: [string, Difficulty, Effort][]) =>
      replay([created, quest("q", T0, T0 + DAY, tasks), ...tasks.map(([id], i) => complete(id, T0 + (i + 1) * H))]).qi;
    const whole = pay([
      ["deadly", "deadly", "session"],
      ["easy", "easy", "session"],
    ]);
    const split = pay([
      ["deadly", "deadly", "session"],
      ["t1", "trivial", "session"],
      ["t2", "trivial", "session"],
    ]);
    expect(whole).toBeCloseTo(53 * (1 + 0.035 / 2), 9); // half a day of work: the cap, not the curve, binds
    expect(split).toBeLessThanOrEqual(whole + 1e-9);
  });

  it("pays a long task more than the same work logged as sessions", () => {
    const day = replay([created, once("a", T0, T0 + 2 * DAY, "hard", "day"), complete("a", T0 + H)]).qi;
    const ids = ["s1", "s2", "s3", "s4"];
    const sessions = replay([
      created,
      ...ids.map((id) => once(id, T0, T0 + 2 * DAY, "hard", "session")),
      ...ids.map((id, i) => complete(id, T0 + (i + 1) * H)),
    ]).qi;
    expect(day).toBe(110);
    expect(sessions).toBe(80);
  });

  it("pays a same-day quest of two mids a small bonus, below one hard task", () => {
    const hard = replay([created, once("h", T0, T0 + DAY, "hard"), complete("h", T0 + H)]).qi;
    const asQuest = replay([
      created,
      quest("q", T0, T0 + DAY, [
        ["a", "mid", "session"],
        ["b", "mid", "session"],
      ]),
      complete("a", T0 + H),
      complete("b", T0 + 2 * H),
    ]).qi;
    expect(hard).toBe(20);
    expect(asQuest).toBeCloseTo(16 * 1.0175, 9); // 2 sessions = half a day: cap 1.75%
  });
});

describe("quest bonus and item drops by effort (rulings 51-52)", () => {
  it("scales the bonus cap with the members' days of work, not the deadline", () => {
    expect(workDays(["session", "session"])).toBe(0.5);
    expect(workDays(["project", "project"])).toBe(8);
    expect(questBonusCap(1)).toBeCloseTo(0.035, 9);
    expect(questBonusCap(7)).toBeCloseTo(0.15, 9);
    expect(questBonusCap(365)).toBeCloseTo(0.4, 9);
    expect(questBonusCap(4)).toBeCloseTo(0.035 + (3 / 6) * 0.115, 9);
    expect(questBonusCap(1000)).toBeCloseTo(0.4, 9);
    // The same two tasks pay the same bonus with a near or a far deadline.
    const pay = (deadline: number) =>
      replay([
        created,
        quest("q", T0, deadline, [
          ["a", "mid", "day"],
          ["b", "mid", "day"],
        ]),
        complete("a", T0 + H),
        complete("b", T0 + 2 * H),
      ]).main.quests.q!.bonusQi;
    expect(pay(T0 + 2 * DAY)).toBeCloseTo(pay(T0 + 300 * DAY), 9);
    expect(pay(T0 + 2 * DAY)).toBeCloseTo(100 * (0.035 + (1 / 6) * 0.115), 9); // 2 days of work; the curve alone would give +10%
  });

  it("caps a daily bundle of unrelated sessions at a few percent", () => {
    const tasks: [string, Difficulty, Effort][] = [
      ["read", "mid", "session"],
      ["write", "mid", "session"],
      ["solve", "mid", "session"],
    ];
    const s = replay([created, quest("q", T0, T0 + DAY, tasks), ...tasks.map(([id], i) => complete(id, T0 + (i + 1) * H))]);
    expect(s.qi).toBeCloseTo(24 * (1 + 0.035 * 0.75), 9);
  });

  it("maps the server's roll to an item at the effort band's chance", () => {
    expect(questDropChance(0.5)).toBeCloseTo(0.01, 9);
    expect(questDropChance(7)).toBeCloseTo(0.08, 9);
    expect(questDropOutcome(0.08, 0.079)).toBe("item");
    expect(questDropOutcome(0.08, 0.08)).toBe("none");
    expect(() => questDropOutcome(0.08, 1)).toThrow(RangeError);
  });

  const q2 = (id: string, at: number): GameEvent[] => [
    quest(id, at, at + DAY, [
      [`${id}a`, "mid", "session"],
      [`${id}b`, "easy", "session"],
    ]),
    complete(`${id}a`, at + H),
  ];

  it("applies a stored drop as a potion, and leaves an offline completion pending until the server rolls it", () => {
    const s = replay([created, ...q2("q", T0)]);
    const online = apply(s, ev("MainTaskCompleted", T0 + 2 * H, { taskId: "qb", questDrop: "item" }));
    expect(online.inventory.potions).toBe(1);
    expect(pendingQuestRolls(online)).toEqual([]);
    const offline = apply(s, ev("MainTaskCompleted", T0 + 2 * H, { taskId: "qb" }));
    const [pending] = pendingQuestRolls(offline);
    expect(pending).toMatchObject({ questId: "q", chance: questDropChance(0.5) });
    const rolled = apply(offline, ev("MainQuestDropRolled", T0 + 3 * H, { eventId: pending!.eventId, drop: "item" }));
    expect(rolled.inventory.potions).toBe(1);
    expect(pendingQuestRolls(rolled)).toEqual([]);
    // A second roll for the same event is flagged, never applied.
    const dup = apply(rolled, ev("MainQuestDropRolled", T0 + 4 * H, { eventId: pending!.eventId, drop: "item" }));
    expect(dup.inventory.potions).toBe(1);
    expect(dup.anomalies.map((a) => a.code)).toEqual(["orphan_quest_drop_roll"]);
  });

  it("rolls at most 2 quests a day, and never a forfeited quest", () => {
    const evs: GameEvent[] = [created];
    for (const [id, h] of [["x", 2], ["y", 5], ["z", 8]] as const) {
      evs.push(...q2(id, T0 + h * H), ev("MainTaskCompleted", T0 + (h + 2) * H, { taskId: `${id}b`, questDrop: "item" }));
    }
    const s = replay(evs);
    expect(s.inventory.potions).toBe(2);
    expect(s.main.drops).toEqual({ none: 0, item: 2 });
    const forfeited = replay([created, ...q2("f", T0), ev("MainTaskCancelled", T0 + 2 * H, { taskId: "fb" })]);
    expect(pendingQuestRolls(forfeited)).toEqual([]);
  });
});

describe("repetition decay (rulings 18-19, 37)", () => {
  /** Payout of a 1-a-day "study" task completed every day at 10:00, with optional extra events. */
  function dailyPayouts(days: number, extra: GameEvent[] = []): number[] {
    let s = replay([created, recurring("study", T0, 1, "day")]);
    const events = [...extra];
    const out: number[] = [];
    for (let d = 0; d < days; d++) {
      const at = T0 + d * DAY + 10 * H;
      while (events.length && events[0]!.at <= at) s = apply(s, events.shift()!);
      if (mainTaskStatus(s, "study") !== "open") {
        out.push(NaN);
        continue;
      }
      const before = s.qi;
      s = apply(s, complete("study", at));
      out.push(s.qi - before);
    }
    return out;
  }

  it("pays full value for 4 weeks however often it is done, then -15% a week", () => {
    const p = dailyPayouts(36);
    expect(p.slice(0, 28).every((q) => q === 8)).toBe(true);
    expect(p[28]).toBeCloseTo(6.8, 9);
    expect(p[35]).toBeCloseTo(5.6, 9);
  });

  it("pauses the age during rest", () => {
    const p = dailyPayouts(29, [ev("RestStarted", T0 + 10 * DAY + 12 * H, { kind: "closed_door", until: T0 + 24 * DAY + 12 * H })]);
    expect(p[28]).toBe(8); // 28 days since the first completion, 14 of them resting
  });

  it("pauses the age while archived and resumes it on restore", () => {
    const schedule = { kind: "recurring" as const, count: 1, per: "day" as const };
    const p = dailyPayouts(39, [
      ev("MainTaskArchived", T0 + 10 * DAY + 12 * H, { taskId: "study" }),
      ev("MainTaskRestored", T0 + 20 * DAY + 12 * H, { taskId: "study", schedule }),
    ]);
    expect(p[28]).toBe(8);
    expect(p[38]).toBeCloseTo(6.8, 9);
  });

  it("tracks repetition by name across one-time tasks, ignoring case and punctuation", () => {
    let s = replay([created, once("a", T0, T0 + DAY, "mid", "session", "Math exercise"), complete("a", T0 + H)]);
    s = apply(s, once("b", T0 + 29 * DAY, T0 + 30 * DAY, "mid", "session", "math  EXERCISE."));
    const before = s.qi;
    s = apply(s, complete("b", T0 + 29 * DAY + H));
    expect(s.qi - before).toBeCloseTo(6.8, 9);
    // A new version is a new name and starts fresh (accepted, ruling 22).
    s = apply(s, once("c", T0 + 29 * DAY + H, T0 + 30 * DAY, "mid", "session", "Math exercise II"));
    const v2 = s.qi;
    s = apply(s, complete("c", T0 + 29 * DAY + 2 * H));
    expect(s.qi - v2).toBe(8);
  });

  it("pauses Body decay age during rest too", () => {
    const evs = [
      created,
      ev("BodyActivityDefined", T0, { activityId: "bjj", name: "BJJ", kind: "routine" }),
      ev("BodyActivityLogged", T0 + H, { activityId: "bjj" }),
      ev("RestStarted", T0 + 5 * DAY, { kind: "closed_door", until: T0 + 19 * DAY }),
    ];
    const s = replay(evs, RULES_V1, T0 + 30 * DAY + H);
    expect(s.companion.ageMs.bjj).toBe(16 * DAY);
  });
});

describe("task model", () => {
  it("needs a new named version to change difficulty", () => {
    const s = replay([created, once("a", T0, T0 + DAY, "mid", "session", "Math"), complete("a", T0 + H)]);
    expect(code(() => applyEvent(s, once("b", T0 + 2 * H, T0 + DAY, "hard", "session", "Math")))).toBe("difficulty_needs_new_version");
    expect(code(() => applyEvent(s, once("b", T0 + 2 * H, T0 + DAY, "hard", "session", "Math II")))).toBeUndefined();
    // Effort belongs to each task, so "Do again" can change it.
    expect(code(() => applyEvent(s, once("b", T0 + 2 * H, T0 + DAY, "mid", "day", "Math")))).toBeUndefined();
  });

  it("allows one open task per name; a completed one-time task can be done again", () => {
    const s = replay([created, once("a", T0, T0 + DAY, "mid", "session", "Math")]);
    expect(code(() => applyEvent(s, once("b", T0 + H, T0 + DAY, "mid", "session", "math.")))).toBe("name_in_use");
    const done = apply(s, complete("a", T0 + H));
    expect(code(() => applyEvent(done, once("b", T0 + 2 * H, T0 + DAY, "mid", "session", "Math")))).toBeUndefined();
  });

  it("makes an archived task's name restore-only, so delete-and-recreate never resets decay", () => {
    const s = replay([created, recurring("r", T0, 1, "day", { name: "Study" }), ev("MainTaskArchived", T0 + H, { taskId: "r" })]);
    expect(code(() => applyEvent(s, recurring("r2", T0 + 2 * H, 1, "day", { name: "study" })))).toBe("task_archived");
    expect(code(() => applyEvent(s, once("o", T0 + 2 * H, T0 + DAY, "mid", "session", "Study")))).toBe("task_archived");
    expect(code(() => applyEvent(s, complete("r", T0 + 2 * H)))).toBe("task_archived");
    const restored = apply(s, ev("MainTaskRestored", T0 + 2 * H, { taskId: "r", schedule: { kind: "recurring", count: 2, per: "week" } }));
    expect(mainTaskStatus(restored, "r")).toBe("open");
    expect(periodProgress(restored, "r")).toMatchObject({ count: 2, per: "week", done: 0 });
  });

  it("treats a recurring task past its end date as archived", () => {
    const s = replay([created, recurring("r", T0, 1, "day", { endsAt: T0 + 3 * DAY })], RULES_V1, T0 + 4 * DAY);
    expect(mainTaskStatus(s, "r")).toBe("ended");
    expect(code(() => applyEvent(s, complete("r", T0 + 4 * DAY)))).toBe("task_ended");
    expect(code(() => applyEvent(s, recurring("x", T0 + 4 * DAY, 1, "day", { name: "r" })))).toBe("task_archived");
  });

  it("validates deadlines and end dates", () => {
    const s = replay([created]);
    expect(code(() => applyEvent(s, once("a", T0 + H, T0 + H)))).toBe("deadline_in_past");
    expect(code(() => applyEvent(s, once("a", T0, T0 + 366 * DAY)))).toBe("deadline_too_far");
    expect(code(() => applyEvent(s, recurring("r", T0 + H, 1, "day", { endsAt: T0 })))).toBe("ends_in_past");
  });

  it("cancels one-time tasks and archives recurring ones, never the other way round", () => {
    const s = replay([created, once("a", T0, T0 + DAY), recurring("r", T0, 1, "day")]);
    expect(code(() => applyEvent(s, ev("MainTaskCancelled", T0 + H, { taskId: "r" })))).toBe("archive_recurring");
    expect(code(() => applyEvent(s, ev("MainTaskArchived", T0 + H, { taskId: "a" })))).toBe("cancel_one_time");
    const cancelled = apply(s, ev("MainTaskCancelled", T0 + H, { taskId: "a" }));
    expect(code(() => applyEvent(cancelled, complete("a", T0 + 2 * H)))).toBe("task_cancelled");
    expect(cancelled.qi).toBe(0);
  });
});

describe("payout caps (rulings 21, 39)", () => {
  it("pays a recurring task at most its frequency per period", () => {
    const s = replay([created, recurring("r", T0, 1, "day"), complete("r", T0 + H), complete("r", T0 + 2 * H)]);
    expect(s.qi).toBe(8);
    expect(s.main.tasks.r!.completions).toBe(2);
  });

  it("caps a weekly task at its count and at 2 a day", () => {
    const s = replay([
      created,
      recurring("r", T0, 3, "week"),
      complete("r", T0 + H),
      complete("r", T0 + 2 * H),
      complete("r", T0 + 3 * H), // third on Monday: over 2 a day
      complete("r", T0 + DAY + H), // Tuesday: third of the week
      complete("r", T0 + 2 * DAY + H), // Wednesday: over 3 a week
    ]);
    expect(s.qi).toBe(24);
  });

  it("pays a name at most twice a day, so creating the same one-time task over and over doesn't pay", () => {
    let s = replay([created]);
    for (let i = 0; i < 4; i++) s = apply(s, once(`t${i}`, T0 + i * H, T0 + DAY, "mid", "session", "Flashcards"), complete(`t${i}`, T0 + i * H + 1));
    expect(s.qi).toBe(16);
  });
});

describe("expiry and the paid extension (ruling 29)", () => {
  const base = () => withGold(replay([created, once("a", T0, T0 + 2 * DAY)]), 100);

  it("rejects completing after the deadline", () => {
    expect(code(() => applyEvent(base(), complete("a", T0 + 2 * DAY + 1)))).toBe("task_expired");
  });

  it("sells one extension after the deadline, within 3 days, no longer than the original duration", () => {
    const s = base();
    const extend = (at: number, until: number) => ev("MainItemExtended", at, { item: "task", itemId: "a", until });
    expect(code(() => applyEvent(s, extend(T0 + DAY, T0 + 3 * DAY)))).toBe("not_expired");
    expect(code(() => applyEvent(s, extend(T0 + 5 * DAY + 1, T0 + 6 * DAY)))).toBe("extension_window_closed");
    expect(code(() => applyEvent(s, extend(T0 + 2 * DAY + H, T0 + 4 * DAY + 1)))).toBe("extension_too_long");
    expect(code(() => applyEvent(withGold(s, 4), extend(T0 + 2 * DAY + H, T0 + 4 * DAY)))).toBe("insufficient_gold");
    const extended = apply(s, extend(T0 + 2 * DAY + H, T0 + 4 * DAY));
    expect(extended.gold).toBe(95);
    expect(mainTaskStatus(extended, "a")).toBe("open");
    const late = advanceTo(extended, T0 + 4 * DAY + H);
    expect(mainTaskStatus(late, "a")).toBe("gone");
    expect(code(() => applyEvent(late, extend(T0 + 4 * DAY + H, T0 + 5 * DAY)))).toBe("extension_used");
    expect(apply(extended, complete("a", T0 + 3 * DAY)).qi).toBe(8);
  });

  it("lets an unpaid item disappear, freeing its name", () => {
    const s = advanceTo(base(), T0 + 5 * DAY + 1);
    expect(mainTaskStatus(s, "a")).toBe("gone");
    expect(code(() => applyEvent(s, once("b", T0 + 5 * DAY + 1, T0 + 6 * DAY, "mid", "session", "a")))).toBeUndefined();
  });

  it("extends a quest with its unfinished tasks, and never a member alone or a recurring task", () => {
    let s = withGold(
      replay([
        created,
        recurring("r", T0, 1, "day"),
        quest("q", T0, T0 + DAY, [
          ["a", "mid", "session"],
          ["b", "easy", "session"],
        ]),
        complete("a", T0 + H),
      ]),
      100,
    );
    const at = T0 + DAY + H;
    expect(code(() => applyEvent(s, ev("MainItemExtended", at, { item: "task", itemId: "b", until: T0 + 2 * DAY })))).toBe("extend_the_quest");
    expect(code(() => applyEvent(s, ev("MainItemExtended", at, { item: "task", itemId: "r", until: T0 + 2 * DAY })))).toBe("no_extension_for_recurring");
    s = apply(s, ev("MainItemExtended", at, { item: "quest", itemId: "q", until: T0 + 2 * DAY }));
    expect(s.gold).toBe(95); // the unfinished easy task's base gold is 2.5, so the minimum price
    s = apply(s, complete("b", T0 + DAY + 2 * H));
    expect(mainQuestStatus(s, "q")).toBe("completed");
  });
});

describe("rest and deadlines (ruling 30)", () => {
  it("keeps deadlines during a vacation", () => {
    const s = apply(withGold(replay([created, once("a", T0, T0 + 2 * DAY)]), 1000), ev("RestStarted", T0 + DAY, { kind: "vacation", until: T0 + 5 * DAY }));
    expect(code(() => applyEvent(s, complete("a", T0 + 3 * DAY)))).toBe("task_expired");
  });

  it("extends deadlines by the days spent in closed-door cultivation", () => {
    const s = replay([created, once("a", T0, T0 + 2 * DAY), ev("RestStarted", T0 + DAY, { kind: "closed_door", until: T0 + 4 * DAY })]);
    expect(code(() => applyEvent(s, complete("a", T0 + 3 * DAY)))).toBeUndefined(); // during the rest
    const after = advanceTo(s, T0 + 4 * DAY);
    expect(after.main.tasks.a!.due!.deadline).toBe(T0 + 5 * DAY);
    expect(code(() => applyEvent(after, complete("a", T0 + 4 * DAY + 12 * H)))).toBeUndefined();
    // Ended early: only the days actually spent inside count.
    const early = apply(s, ev("RestEnded", T0 + 2 * DAY, {}));
    expect(early.main.tasks.a!.due!.deadline).toBe(T0 + 3 * DAY);
  });
});

describe("quests (rulings 26, 45)", () => {
  const twoTasks: [string, Difficulty, Effort][] = [
    ["a", "mid", "session"],
    ["b", "easy", "session"],
  ];

  it("pays the complexity bonus when the last task is completed", () => {
    const s = replay([created, quest("q", T0, T0 + DAY, twoTasks), complete("a", T0 + H)]);
    expect(s.qi).toBe(8);
    const done = apply(s, complete("b", T0 + 2 * H));
    // Half a day of work caps the bonus at 1.75% (the curve alone would give 14 for 8 + 3).
    expect(done.qi).toBeCloseTo(11 * 1.0175, 9);
    expect(done.main.quests.q!.bonusQi).toBeCloseTo(11 * 0.0175, 9);
  });

  it("forfeits the bonus when a member is cancelled", () => {
    const s = replay([
      created,
      quest("q", T0, T0 + DAY, twoTasks),
      complete("a", T0 + H),
      ev("MainTaskCancelled", T0 + 2 * H, { taskId: "b" }),
    ]);
    expect(mainQuestStatus(s, "q")).toBe("completed");
    expect(s.qi).toBe(8);
  });

  it("shares the quest's deadline and rejects duplicate names inside a quest", () => {
    const s = replay([created, quest("q", T0, T0 + DAY, twoTasks)]);
    expect(code(() => applyEvent(s, complete("a", T0 + DAY + 1)))).toBe("task_expired");
    expect(
      code(() =>
        applyEvent(
          replay([created]),
          quest("q2", T0, T0 + DAY, [
            ["x", "mid", "session"],
            ["X.", "mid", "session"],
          ]),
        ),
      ),
    ).toBe("name_in_use");
  });
});

describe("procrastination tax (rulings 31-33, 40-44)", () => {
  it("charges nothing before the interview", () => {
    const s = replay([created], RULES_V1, T0 + 30 * DAY);
    expect(s.main.debt).toEqual({ qi: 0, gold: 0 });
  });

  it("charges Main after 3 idle days and Body and Soul at 1/5 after 7, as debt when balances are empty", () => {
    const at = (d: number) => replay([created, interview()], RULES_V1, T0 + d * DAY);
    expect(at(3).main.debt.qi).toBe(0);
    expect(at(4).main.debt.qi).toBe(5);
    const s = at(10);
    expect(s.main.taxPaid.main.idleDays).toBe(7);
    expect(s.main.taxPaid.body.idleDays).toBe(3);
    expect(s.main.debt.qi).toBeCloseTo(35 + 3 + 3, 9);
    expect(s.qi).toBe(0);
  });

  it("starts all three clocks once, at the first interview", () => {
    const s = replay([created, interview(), interview(T0 + 2 * DAY)], RULES_V1, T0 + 4 * DAY);
    expect(s.main.debt.qi).toBe(5);
  });

  it("deducts from balances first and repays debt from gains first", () => {
    let s = withGold(replay([created, interview()]), 3);
    s = advanceTo(s, T0 + 4 * DAY);
    expect(s.gold).toBe(0);
    expect(s.main.debt.gold).toBe(2);
    expect(s.main.debt.qi).toBe(5);
    s = apply(s, once("a", T0 + 4 * DAY, T0 + 5 * DAY), complete("a", T0 + 4 * DAY + H));
    expect(s.main.debt.qi).toBe(0);
    expect(s.qi).toBe(3);
  });

  it("counts Body logging (even over the routine cap) and positive soul tasks as activity, not relapses", () => {
    const evs = [
      created,
      interview(),
      ev("BodyActivityDefined", T0, { activityId: "bjj", name: "BJJ", kind: "routine" }),
      ev("HeartDemonCreated", T0, {
        demonId: "d",
        name: "Doomscrolling",
        positiveTasks: [{ taskId: "pos", name: "Journal" }],
        negativeTasks: [{ taskId: "neg", name: "Phone in bed" }],
      }),
      ev("BodyActivityLogged", T0 + 6 * DAY, { activityId: "bjj" }),
      ev("SoulTaskLogged", T0 + 6 * DAY, { taskId: "neg" }),
    ];
    const s = replay(evs, RULES_V1, T0 + 10 * DAY);
    expect(s.main.taxPaid.body.idleDays).toBe(0);
    expect(s.main.taxPaid.soul.idleDays).toBe(3);
  });

  it("charges each missed occurrence of a recurring task instead of the idle rule", () => {
    const s = replay([created, interview(), recurring("r", T0, 1, "day")], RULES_V1, T0 + 3 * DAY);
    expect(s.main.taxPaid.main.ticks).toBe(3);
    expect(s.main.taxPaid.main.idleDays).toBe(0);
    expect(s.main.debt.qi).toBe(15);
  });

  it("sizes a tick so missing a whole schedule costs about one idle day per day", () => {
    const s = replay([created, interview(), recurring("r", T0, 3, "week"), complete("r", T0 + DAY + H)], RULES_V1, T0 + 7 * DAY);
    expect(s.main.taxPaid.main.ticks).toBe(2);
    expect(s.main.taxPaid.main.qi).toBeCloseTo(2 * 5 * (7 / 3), 9);
    expect(s.qi).toBe(0); // the 8 Qi earned on Tuesday paid part of the tax
    expect(s.main.debt.qi).toBeCloseTo(2 * 5 * (7 / 3) - 8, 9);
  });

  it("doesn't let a one-time task shield Main from the idle rule", () => {
    const s = replay([created, interview(), once("far", T0, T0 + 300 * DAY)], RULES_V1, T0 + 4 * DAY);
    expect(s.main.taxPaid.main.idleDays).toBe(1);
  });

  it("prorates partial periods exactly (ruling 48), or rounding down under the old floor setting", () => {
    const evs = [created, interview(), recurring("r", T0 + 3 * DAY, 3, "week")];
    expect(replay(evs, RULES_V1, T0 + 7 * DAY).main.taxPaid.main.ticks).toBeCloseTo(3 * (4 / 7), 9);
    const floor = withRules({ tax: { ...RULES_V1.main.tax, partialPeriods: "floor" } });
    expect(replay(evs, floor, T0 + 7 * DAY).main.taxPaid.main.ticks).toBe(1);
  });

  it("still charges what was owed when a task is archived before its period ends", () => {
    const s = replay(
      [created, interview(), recurring("r", T0, 3, "week"), ev("MainTaskArchived", T0 + 6 * DAY + 12 * H, { taskId: "r" })],
      RULES_V1,
      T0 + 7 * DAY,
    );
    expect(s.main.taxPaid.main.ticks).toBeCloseTo(3 * (6.5 / 7), 9);
  });

  it("charges nightly archive-and-restore its exact share, and flags the churn in the integrity log (ruling 48)", () => {
    const schedule = { kind: "recurring" as const, count: 1, per: "day" as const };
    const evs: GameEvent[] = [created, interview(), recurring("r", T0, 1, "day")];
    for (let d = 0; d < 5; d++) {
      evs.push(ev("MainTaskArchived", T0 + d * DAY + 23 * H, { taskId: "r" }));
      evs.push(ev("MainTaskRestored", T0 + (d + 1) * DAY + H, { taskId: "r", schedule }));
    }
    const s = replay(evs, RULES_V1, T0 + 6 * DAY);
    expect(s.main.taxPaid.main.ticks).toBeCloseTo(2 * (23 / 24) + 4 * (22 / 24), 9);
    // The third restore within 30 days and each one after it are flagged; archiving itself costs nothing extra.
    expect(s.main.flags.map((f) => [f.code, f.taskId, f.at])).toEqual([3, 4, 5].map((d) => ["archive_churn", "r", T0 + d * DAY + H]));
    const floor = replay(evs, withRules({ tax: { ...RULES_V1.main.tax, partialPeriods: "floor" } }), T0 + 6 * DAY);
    expect(floor.main.taxPaid.main.ticks).toBe(0); // the gap the old setting left open
  });

  it("never taxes a rest day and doesn't count rest toward the grace", () => {
    const s = replay(
      [created, interview(), recurring("r", T0, 1, "day"), ev("RestStarted", T0 + 2 * DAY, { kind: "closed_door", until: T0 + 9 * DAY })],
      RULES_V1,
      T0 + 10 * DAY,
    );
    expect(s.main.taxPaid.main.ticks).toBe(3); // Monday, Tuesday and the day after the rest
    expect(s.main.taxPaid.body.idleDays).toBe(0); // 3 active days so far
  });
});

describe("Qi deviation and the comeback quest (ruling 34)", () => {
  const deviated = () => replay([created, interview()], RULES_V1, T0 + 12 * DAY);

  it("starts when debt reaches its cap", () => {
    expect(replay([created, interview()], RULES_V1, T0 + 11 * DAY).main.deviation).toBeNull();
    const s = deviated();
    expect(s.main.debt.qi).toBe(50);
    expect(s.main.deviation?.since).toBe(T0 + 12 * DAY);
  });

  it("clears the state and the debt after 3 tasks rated easy or harder within 3 days", () => {
    const at = T0 + 12 * DAY;
    let s = apply(
      deviated(),
      once("t", at, at + DAY, "trivial"),
      once("a", at, at + 3 * DAY, "easy"),
      once("b", at, at + 3 * DAY, "mid"),
      once("c", at, at + 3 * DAY, "hard"),
      complete("t", at + H),
      complete("a", at + 2 * H),
      complete("b", at + DAY),
    );
    expect(deviationStatus(s)).toMatchObject({ done: 2, needed: 3 }); // the trivial task doesn't count
    s = apply(s, complete("c", at + 2 * DAY + 12 * H));
    expect(s.main.deviation).toBeNull();
    expect(s.main.debt).toEqual({ qi: 0, gold: 0 });
    expect(s.main.comebacks).toBe(1);
  });

  it("starts a new window when one passes", () => {
    const at = T0 + 12 * DAY;
    const s = apply(
      deviated(),
      once("a", at, at + 5 * DAY, "easy"),
      once("b", at, at + 5 * DAY, "easy"),
      once("c", at, at + 5 * DAY, "easy"),
      complete("a", at + H),
      complete("b", at + 2 * H),
      complete("c", at + 3 * DAY + H),
    );
    expect(s.main.deviation).not.toBeNull();
    expect(deviationStatus(s)).toMatchObject({ done: 1, windowEndsAt: at + 6 * DAY });
  });
});

describe("projections", () => {
  it("forecasts the next tax charges", () => {
    const idle = taxForecast(replay([created, interview()]));
    expect(idle.map((c) => [c.path, c.at])).toEqual([
      ["main", T0 + 4 * DAY],
      ["body", T0 + 8 * DAY],
      ["soul", T0 + 8 * DAY],
    ]);
    const withTask = taxForecast(replay([created, interview(), recurring("r", T0, 1, "day")]));
    expect(withTask[0]).toMatchObject({ path: "main", kind: "missed", at: T0 + DAY, qi: 5 });
    expect(withTask.some((c) => c.path === "main" && c.kind === "idle")).toBe(false);
  });

  it("lists stale tasks for the repetition warning", () => {
    const s = replay([created, recurring("r", T0, 1, "day", { name: "Study" }), complete("r", T0 + H)], RULES_V1, T0 + 30 * DAY);
    expect(staleTasks(s)).toEqual([{ taskId: "r", name: "Study", multiplier: 0.85 }]);
  });

  it("pushes quest deadlines at 72, 48, 24 and 1 hour, before every other alert", () => {
    const s = replay([created, quest("q", T0, T0 + 4 * DAY, [["a", "mid", "session"], ["b", "mid", "session"]])]);
    expect(questDeadlineAlerts(s).map((a) => a.hoursLeft)).toEqual([72, 48, 24, 1]);
    const plan = pushAlertPlan(s, T0);
    expect(plan.filter((a) => a.kind === "quest_deadline").map((a) => a.at)).toEqual([T0 + DAY, T0 + 2 * DAY, T0 + 3 * DAY, T0 + 4 * DAY - H]);
  });
});

describe("work on a task today (ruling 49)", () => {
  const work = (taskId: string, at: number) => ev("MainTaskWorkedOn", at, { taskId });

  it("counts as Main activity without paying, so a multi-day project isn't taxed while worked on", () => {
    const evs: GameEvent[] = [created, interview(), once("p", T0, T0 + 20 * DAY, "hard", "project")];
    const idle = replay(evs, RULES_V1, T0 + 10 * DAY);
    expect(idle.main.taxPaid.main.idleDays).toBe(7);
    const worked = replay([...evs, work("p", T0 + 3 * DAY), work("p", T0 + 6 * DAY), work("p", T0 + 9 * DAY)], RULES_V1, T0 + 10 * DAY);
    expect(worked.main.taxPaid.main.idleDays).toBe(0);
    expect(worked.qi).toBe(0);
    expect(worked.gold).toBe(0);
  });

  it("allows it once per task per local day, and only for day or project effort or recurring tasks per week or longer", () => {
    const s = replay([
      created,
      once("d", T0, T0 + 5 * DAY, "mid", "day"),
      once("s", T0, T0 + 5 * DAY, "mid", "session"),
      recurring("daily", T0, 1, "day"),
      recurring("weekly", T0, 1, "week", { effort: "quick" }),
      recurring("yearly", T0, 4, "year"),
    ]);
    const once1 = apply(s, work("d", T0 + H));
    expect(code(() => applyEvent(once1, work("d", T0 + 20 * H)))).toBe("already_worked_today");
    expect(code(() => applyEvent(once1, work("d", T0 + DAY + H)))).toBeUndefined();
    expect(code(() => applyEvent(s, work("s", T0 + H)))).toBe("work_on_not_allowed");
    expect(code(() => applyEvent(s, work("daily", T0 + H)))).toBe("work_on_not_allowed");
    expect(code(() => applyEvent(s, work("weekly", T0 + H)))).toBeUndefined();
    expect(code(() => applyEvent(s, work("yearly", T0 + H)))).toBeUndefined();
  });

  it("caps total uses by effort (day 3, project 30); after that, complete or split", () => {
    let s = replay([created, once("d", T0, T0 + 30 * DAY, "mid", "day")]);
    for (let d = 0; d < 3; d++) s = apply(s, work("d", T0 + d * DAY + H));
    expect(code(() => applyEvent(s, work("d", T0 + 3 * DAY + H)))).toBe("work_on_cap");
    expect(code(() => applyEvent(s, complete("d", T0 + 3 * DAY + H)))).toBeUndefined();
    let p = replay([created, once("p", T0, T0 + 60 * DAY, "mid", "project")]);
    for (let d = 0; d < 30; d++) p = apply(p, work("p", T0 + d * DAY + H));
    expect(code(() => applyEvent(p, work("p", T0 + 30 * DAY + H)))).toBe("work_on_cap");
  });

  it("rejects an expired, completed or archived task", () => {
    const s = replay([created, once("d", T0, T0 + DAY, "mid", "day"), recurring("w", T0, 1, "week"), ev("MainTaskArchived", T0 + H, { taskId: "w" })]);
    expect(code(() => applyEvent(s, work("d", T0 + 2 * DAY)))).toBe("task_expired");
    expect(code(() => applyEvent(s, work("w", T0 + 2 * H)))).toBe("task_archived");
    expect(code(() => applyEvent(apply(s, complete("d", T0 + 2 * H)), work("d", T0 + 3 * H)))).toBe("task_completed");
  });
});

describe("milestones and the year period (ruling 50)", () => {
  const milestones = (deadlines: (number | undefined)[]) =>
    ev("MainQuestDefined", T0, {
      questId: "q",
      name: "Thesis",
      deadline: T0 + 90 * DAY,
      tasks: deadlines.map((deadline, i) => ({ taskId: `m${i}`, name: `Milestone ${i}`, difficulty: "hard" as const, effort: "project" as const, ...(deadline === undefined ? {} : { deadline }) })),
    });

  it("gives a member its own deadline, on or before the quest's", () => {
    const s = replay([created, milestones([T0 + 30 * DAY, T0 + 60 * DAY, undefined])]);
    expect(code(() => applyEvent(s, complete("m0", T0 + 31 * DAY)))).toBe("task_expired");
    expect(code(() => applyEvent(s, complete("m1", T0 + 31 * DAY)))).toBeUndefined();
    expect(code(() => applyEvent(s, complete("m2", T0 + 89 * DAY)))).toBeUndefined();
    expect(code(() => applyEvent(replay([created]), milestones([T0 + 91 * DAY, undefined])))).toBe("milestone_after_quest");
    expect(code(() => applyEvent(replay([created]), milestones([T0, undefined])))).toBe("deadline_in_past");
  });

  it("extends an expired milestone on its own, but not past the quest's deadline", () => {
    const s = withGold(advanceTo(replay([created, milestones([T0 + 30 * DAY, undefined])]), T0 + 31 * DAY), 500);
    const extend = (until: number) => ev("MainItemExtended", T0 + 31 * DAY, { item: "task", itemId: "m0", until });
    expect(code(() => applyEvent(s, extend(T0 + 50 * DAY)))).toBeUndefined();
    const short = withGold(advanceTo(replay([created, ev("MainQuestDefined", T0, { questId: "q", name: "Q", deadline: T0 + 40 * DAY, tasks: [
      { taskId: "m0", name: "A", difficulty: "hard", effort: "project", deadline: T0 + 30 * DAY },
      { taskId: "m1", name: "B", difficulty: "hard", effort: "project" },
    ] })]), T0 + 31 * DAY), 500);
    expect(code(() => applyEvent(short, extend(T0 + 41 * DAY)))).toBe("milestone_after_quest");
    expect(code(() => applyEvent(s, ev("MainItemExtended", T0 + 31 * DAY, { item: "task", itemId: "m1", until: T0 + 100 * DAY })))).toBe("extend_the_quest");
  });

  it("shifts a milestone's deadline with closed-door rest, like any one-time deadline", () => {
    const s = replay([created, milestones([T0 + 30 * DAY, undefined]), ev("RestStarted", T0 + DAY, { kind: "closed_door", until: T0 + 4 * DAY })], RULES_V1, T0 + 5 * DAY);
    expect(s.main.tasks.m0!.due!.deadline).toBe(T0 + 33 * DAY);
    expect(s.main.quests.q!.due.deadline).toBe(T0 + 93 * DAY);
  });

  it("runs a yearly recurring task on the calendar year, ticking what was missed", () => {
    // Defined on 2 Nov 2026: 60 of 365 days remain, so 12 per year owes 12 x 60/365 by New Year.
    const s = replay([created, interview(), recurring("y", T0, 12, "year"), complete("y", T0 + DAY)], RULES_V1, Date.UTC(2027, 0, 1, 3) + H);
    expect(s.main.taxPaid.main.ticks).toBeCloseTo(12 * (60 / 365) - 1, 9);
    expect(periodProgress(s, "y")).toMatchObject({ done: 0, count: 12, per: "year", endsAt: Date.UTC(2028, 0, 1, 3) });
  });

  it("never flags restoring a task that reached its end date", () => {
    const schedule = { kind: "recurring" as const, count: 1, per: "week" as const, endsAt: T0 + 7 * DAY };
    const evs: GameEvent[] = [created, recurring("r", T0, 1, "week", { endsAt: T0 + DAY })];
    for (let d = 1; d <= 4; d++) evs.push(ev("MainTaskRestored", T0 + d * DAY + H, { taskId: "r", schedule: { ...schedule, endsAt: T0 + (d + 1) * DAY } }));
    expect(replay(evs).main.flags).toEqual([]);
  });
});
