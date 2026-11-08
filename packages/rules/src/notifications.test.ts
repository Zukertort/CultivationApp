import { describe, expect, it } from "vitest";
import { OATH_TEXT, type GameEvent } from "@cultivation/schema";
import { DAY, pushAlertPlan, replay, type CultivatorState, type HeartDemon } from "./index.js";

// Day 0 = Monday 2026-11-02 00:00 in Buenos Aires (UTC-3).
const T0 = Date.UTC(2026, 10, 2, 3);
const ev = (type: string, at: number, rest: object) => ({ id: `n${at}${type}`, userId: "u1", at, type, ...rest }) as unknown as GameEvent;
const created = ev("CultivatorCreated", T0, { name: "R", tzOffsetMinutes: -180, oath: OATH_TEXT });

function withDemons(hps: number[]): CultivatorState {
  const s = replay([created]);
  hps.forEach((hp, i) => {
    const d: HeartDemon = {
      name: `d${i}`,
      positiveTasks: [],
      negativeTasks: [],
      hp,
      defeated: false,
      createdAt: T0,
      idleMs: 3 * DAY, // growing already
      defeats: 0,
      revivals: 0,
    };
    s.soul.demons[`d${i}`] = d;
  });
  s.soul.color = "white";
  return s;
}

describe("push alert plan", () => {
  it("pushes the companion running out and demons nearing a line, soonest first", () => {
    let s = replay([
      created,
      ev("BodyActivityDefined", T0, { activityId: "bjj", name: "BJJ", kind: "routine" }),
      ev("BodyActivityLogged", T0, { activityId: "bjj" }),
    ]);
    // Panda at 400/800 loses 200/week: 5% (40) is reached after 12.6 days.
    expect(pushAlertPlan(s, T0).map((a) => a.kind)).toEqual(["companion_hungry"]);
    s = { ...s, soul: withDemons([64.5]).soul };
    expect(pushAlertPlan(s, T0).map((a) => [a.kind, (a.at - T0) / DAY])).toEqual([
      ["demon_near_violet", 0.5],
      ["companion_hungry", 12.6],
    ]);
  });

  it("keeps at most 3 a day, the most urgent first", () => {
    // Four demons cross 90% and one comes within 5% of 70% on the same day.
    const plan = pushAlertPlan(withDemons([64.5, 89.5, 89.6, 89.7, 89.8]), T0);
    const day0 = plan.filter((a) => a.at < T0 + DAY);
    expect(day0.map((a) => a.kind)).toEqual(["soul_broken", "soul_broken", "soul_broken"]);
    expect(day0.map((a) => a.demonId)).toEqual(["d4", "d3", "d2"]);
  });

  it("only schedules within the horizon and never in the past", () => {
    // A fresh demon at 50%: within 5% of 70% only after 18 days.
    expect(pushAlertPlan(withDemons([50]), T0)).toEqual([]);
    expect(pushAlertPlan(withDemons([64.5]), T0 + DAY)).toEqual([]);
  });
});
