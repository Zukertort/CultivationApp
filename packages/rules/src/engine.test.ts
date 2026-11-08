import { describe, expect, it } from "vitest";
import { OATH_TEXT, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  RuleViolation,
  WEEK,
  activeHaloTickets,
  advanceTo,
  applyEvent,
  companionAlertAt,
  haloVisible,
  pose,
  repetitionMultiplier,
  replay,
  rouletteOutcome,
  type CultivatorState,
} from "./index.js";

// Day 0 = 2026-11-02 00:00 in Buenos Aires (UTC-3), so local days line up with weeks.
const T0 = Date.UTC(2026, 10, 2, 3);
let seq = 0;
const ev = <T extends GameEvent["type"]>(type: T, at: number, rest: Omit<Extract<GameEvent, { type: T }>, "id" | "userId" | "at" | "type">) =>
  ({ id: `e${++seq}`, userId: "u1", at, type, ...rest }) as unknown as GameEvent;

const created = ev("CultivatorCreated", T0, { name: "Ricardo", tzOffsetMinutes: -180, oath: OATH_TEXT });
const defineRoutine = (id: string, at = T0) => ev("BodyActivityDefined", at, { activityId: id, name: id, kind: "routine" });
const defineExercise = (id: string, at = T0) => ev("BodyActivityDefined", at, { activityId: id, name: id, kind: "exercise" });
const log = (id: string, at: number) => ev("BodyActivityLogged", at, { activityId: id });

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof RuleViolation) return e.code;
    throw e;
  }
  return undefined;
}

describe("companion food meter", () => {
  it("starts as a Turtle at 50%", () => {
    const s = replay([created]);
    expect(s.companion.tier).toBe("turtle");
    expect(s.companion.food).toBe(15);
  });

  it("promotes on overflow and starts the new animal at 50%", () => {
    const s = replay([created, defineRoutine("bjj"), log("bjj", T0 + 1000)]);
    expect(s.companion.tier).toBe("panda");
    expect(s.companion.food).toBe(400);
    expect(s.tierHistory).toEqual([{ at: T0 + 1000, from: "turtle", to: "panda", reason: "promoted" }]);
  });

  it("never lets the Turtle leave", () => {
    const s = replay([created], RULES_V1, T0 + 52 * WEEK);
    expect(s.companion.tier).toBe("turtle");
    expect(s.companion.food).toBe(0);
  });

  it("demotes a Panda after 2 weeks without training", () => {
    const s0 = replay([created, defineRoutine("bjj"), log("bjj", T0)]);
    expect(advanceTo(s0, T0 + 2 * WEEK - DAY).companion.tier).toBe("panda");
    const s = advanceTo(s0, T0 + 2 * WEEK + 1);
    expect(s.companion.tier).toBe("turtle");
    expect(s.companion.food).toBeCloseTo(15, 3);
    expect(s.tierHistory.at(-1)?.reason).toBe("demoted");
  });

  it("caps routines that pay out at 2 per local day", () => {
    const evs = [created, defineRoutine("a"), defineRoutine("b"), defineRoutine("c"), log("a", T0 + 1), log("b", T0 + 2), log("c", T0 + 3)];
    const s = replay(evs);
    // Turtle -> Panda (400) on the first, +200 on the second, third ignored.
    expect(s.companion.tier).toBe("panda");
    expect(s.companion.food).toBeCloseTo(600, 3);
    // A new local day resets the cap.
    expect(applyEvent(s, log("c", T0 + DAY)).companion.food).toBeCloseTo(600 - 200 / 7 + 200, 3);
  });

  it("pays a golden ticket per routine while the Lion is full", () => {
    let s: CultivatorState = replay([created, defineRoutine("a"), defineRoutine("b")]);
    s = { ...s, companion: { ...s.companion, tier: "lion", food: 4900 } };
    s = applyEvent(s, log("a", T0 + 10));
    expect(s.companion.food).toBe(5000);
    expect(s.goldenTickets).toBe(1);
    s = applyEvent(s, log("b", T0 + 20));
    expect(s.goldenTickets).toBe(2);
  });
});

describe("repetition decay", () => {
  it("pays full for 3 completions, then loses 15% per completion down to 25%", () => {
    expect([1, 2, 3, 4, 5, 8, 20].map((n) => repetitionMultiplier(n))).toEqual([1, 1, 1, 0.85, 0.7, 0.25, 0.25]);
  });

  it("resets the count when the tier changes", () => {
    const evs: GameEvent[] = [created, defineExercise("squats")];
    for (let i = 0; i < 3; i++) evs.push(log("squats", T0 + i));
    const s = replay(evs);
    // 15 + 10 + 10 (=35 >= 30, promote to Panda at 400, counts reset) + 10
    expect(s.companion.tier).toBe("panda");
    expect(s.companion.completionsInTier).toEqual({ squats: 1 });
    expect(s.companion.food).toBeCloseTo(410, 3);
  });
});

describe("rest", () => {
  it("pauses food decay during closed-door cultivation", () => {
    const s0 = replay([created, defineRoutine("bjj"), log("bjj", T0)]);
    const resting = applyEvent(s0, ev("RestStarted", T0 + DAY, { kind: "closed_door", until: T0 + 11 * DAY }));
    const after = advanceTo(resting, T0 + 11 * DAY);
    expect(after.companion.food).toBeCloseTo(400 - 200 / 7, 6);
    expect(after.rest).toBeNull();
  });

  it("caps closed-door cultivation at 14 days per period and 30 per window", () => {
    const s0 = replay([created]);
    expect(code(() => applyEvent(s0, ev("RestStarted", T0, { kind: "closed_door", until: T0 + 15 * DAY })))).toBe("closed_door_too_long");
    let s = applyEvent(s0, ev("RestStarted", T0, { kind: "closed_door", until: T0 + 14 * DAY }));
    s = applyEvent(s, ev("RestStarted", T0 + 20 * DAY, { kind: "closed_door", until: T0 + 34 * DAY }));
    expect(code(() => applyEvent(s, ev("RestStarted", T0 + 40 * DAY, { kind: "closed_door", until: T0 + 43 * DAY })))).toBe("closed_door_quota");
  });

  it("charges gold for vacations", () => {
    const s0 = replay([created]);
    expect(code(() => applyEvent(s0, ev("RestStarted", T0, { kind: "vacation", until: T0 + 3 * DAY })))).toBe("insufficient_gold");
    const rich = { ...s0, gold: 100 };
    expect(applyEvent(rich, ev("RestStarted", T0, { kind: "vacation", until: T0 + 3 * DAY })).gold).toBe(40);
  });
});

describe("skills, poses and halo", () => {
  const defineSkill = (id: string) => ev("SkillDefined", T0, { skillId: id, name: id, ranks: ["white", "blue"] });
  const rank = (id: string, i: number, at = T0 + DAY) => ev("SkillRankAchieved", at, { skillId: id, rankIndex: i });

  it("counts mastery at the top rank, grants a halo ticket and never loses ranks", () => {
    const s = replay([created, defineSkill("bjj"), rank("bjj", 0), rank("bjj", 1)]);
    expect(pose(s)).toBe("heroic");
    expect(haloVisible(s, T0 + 20 * DAY)).toBe(true);
    expect(haloVisible(s, T0 + 32 * DAY)).toBe(false);
    expect(activeHaloTickets(s, T0 + 80 * DAY)).toBe(1);
    expect(activeHaloTickets(s, T0 + 92 * DAY)).toBe(0);
    expect(code(() => applyEvent(s, rank("bjj", 0, T0 + 2 * DAY)))).toBe("rank_never_lost");
  });

  it("reaches Warrior at 3 masteries", () => {
    const evs: GameEvent[] = [created];
    for (const id of ["a", "b", "c"]) evs.push(defineSkill(id));
    for (const id of ["a", "b", "c"]) evs.push(rank(id, 1));
    expect(pose(replay(evs))).toBe("warrior");
  });
});

describe("roulette", () => {
  it("maps u to prizes by basis points", () => {
    expect(rouletteOutcome(0)).toBe("gold");
    expect(rouletteOutcome(0.4999)).toBe("gold");
    expect(rouletteOutcome(0.5)).toBe("qi");
    expect(rouletteOutcome(0.8)).toBe("potion");
    expect(rouletteOutcome(0.98)).toBe("legendary");
    expect(rouletteOutcome(0.999)).toBe("scale");
    expect(rouletteOutcome(0.99999)).toBe("scale");
  });

  it("needs a ticket, and nine scales form the wings", () => {
    let s = replay([created]);
    expect(code(() => applyEvent(s, ev("RouletteSpun", T0 + 1, { prize: "gold" })))).toBe("no_golden_ticket");
    s = { ...s, goldenTickets: 9 };
    for (let i = 0; i < 9; i++) s = applyEvent(s, ev("RouletteSpun", T0 + 1 + i, { prize: "scale" }));
    expect(s.inventory).toMatchObject({ scales: 0, wings: true });
  });
});

describe("determinism and ordering", () => {
  it("replays to identical state", () => {
    const evs = [created, defineRoutine("bjj"), log("bjj", T0 + DAY), log("bjj", T0 + 3 * DAY)];
    expect(replay(evs, RULES_V1, T0 + 30 * DAY)).toEqual(replay(evs, RULES_V1, T0 + 30 * DAY));
  });

  it("rejects events that go back in time or come before creation", () => {
    const s = replay([created, defineRoutine("bjj"), log("bjj", T0 + DAY)]);
    expect(code(() => applyEvent(s, log("bjj", T0)))).toBe("out_of_order");
    expect(code(() => replay([defineRoutine("bjj")]))).toBe("not_created");
  });

  it("schedules the hungry-companion alert", () => {
    const s = replay([created, defineRoutine("bjj"), log("bjj", T0)]);
    // Panda at 400, alert at 5% = 40 treats -> 360 treats at 200/week.
    expect(companionAlertAt(s)).toBe(T0 + Math.ceil((360 * WEEK) / 200));
  });
});
