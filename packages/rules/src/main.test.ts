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
  periodProgress,
  pushAlertPlan,
  qiForPoints,
  questDeadlineAlerts,
  questQiRatio,
  replay,
  staleTasks,
  taxForecast,
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
    const total = (members: number[]) => members.reduce((sum, w) => sum + qiForPoints(w), 0) * questQiRatio(members);
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
    expect(whole).toBeCloseTo(57.5, 9);
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

  it("pays a quest of two mids the same as one hard task, not more", () => {
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
    expect(asQuest).toBeCloseTo(20, 9);
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
    expect(done.qi).toBeCloseTo(14, 9); // curve(4 + 2 points) = 14 > 8 + 3
    expect(done.main.quests.q!.bonusQi).toBeCloseTo(3, 9);
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

  it("prorates partial periods, rounding down", () => {
    const s = replay([created, interview(), recurring("r", T0 + 3 * DAY, 3, "week")], RULES_V1, T0 + 7 * DAY);
    expect(s.main.taxPaid.main.ticks).toBe(1); // 4 of 7 days active: 3 x 4/7 = 1.7, rounded down
  });

  it("still charges what was owed when a task is archived before its period ends", () => {
    const s = replay(
      [created, interview(), recurring("r", T0, 3, "week"), ev("MainTaskArchived", T0 + 6 * DAY + 12 * H, { taskId: "r" })],
      RULES_V1,
      T0 + 7 * DAY,
    );
    expect(s.main.taxPaid.main.ticks).toBe(2); // 3 x 6.5/7 = 2.8, rounded down
  });

  it("lets nightly archive-and-restore dodge a daily task under floor rounding, but not under fractional", () => {
    const schedule = { kind: "recurring" as const, count: 1, per: "day" as const };
    const evs: GameEvent[] = [created, interview(), recurring("r", T0, 1, "day")];
    for (let d = 0; d < 5; d++) {
      evs.push(ev("MainTaskArchived", T0 + d * DAY + 23 * H, { taskId: "r" }));
      evs.push(ev("MainTaskRestored", T0 + (d + 1) * DAY + H, { taskId: "r", schedule }));
    }
    const floor = replay(evs, RULES_V1, T0 + 6 * DAY);
    expect(floor.main.taxPaid.main.ticks).toBe(0); // the open gap reported with part 1
    const fractional = replay(evs, withRules({ tax: { ...RULES_V1.main.tax, partialPeriods: "fractional" } }), T0 + 6 * DAY);
    expect(fractional.main.taxPaid.main.ticks).toBeCloseTo(2 * (23 / 24) + 4 * (22 / 24), 9);
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
