import { describe, expect, it } from "vitest";
import { OATH_TEXT, type GameEvent } from "@cultivation/schema";
import { DAY, pushAlertPlan as fullPlan, replay, type CultivatorState, type HeartDemon } from "./index.js";

/** The plan without the daily reminder, which fills every day with no other push (ruling 128). */
const pushAlertPlan = (s: CultivatorState, now: number) => fullPlan(s, now).filter((a) => a.kind !== "daily_reminder");

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
      frozenUntil: null,
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

describe("daily reminder and quiet hours (rulings 128, 129)", () => {
  const H = 60 * 60 * 1000;
  const MIN = 60 * 1000;
  const reminders = (s: CultivatorState, now = T0) => fullPlan(s, now).filter((a) => a.kind === "daily_reminder");

  it("reminds at 9:00 on each day with no other push, at the chosen time once set, and never during rest", () => {
    const s = replay([created]);
    const plain = reminders(s);
    expect(plain[0]!.at).toBe(T0 + 9 * H);
    expect(plain).toHaveLength(14); // the horizon's 14 days
    const evening = replay([created, ev("DailyReminderSet", T0, { minutes: 20 * 60 + 30 })]);
    expect(reminders(evening)[0]!.at).toBe(T0 + 20.5 * H);
    const resting = replay([created, ev("RestStarted", T0, { kind: "closed_door", until: T0 + 2.5 * DAY })]);
    expect(reminders(resting)[0]!.at).toBe(T0 + 3 * DAY + 9 * H); // day 2 holds the return-date push
    // A day with another push gets no reminder.
    const busy = withDemons([64.5]);
    const alertDay = Math.floor((fullPlan(busy, T0).find((a) => a.kind !== "daily_reminder")!.at - T0) / DAY);
    expect(reminders(busy).some((a) => Math.floor((a.at - T0) / DAY) === alertDay)).toBe(false);
  });

  it("moves alerts inside quiet hours to just before they start, across midnight too, never dropping them", () => {
    const night = replay([created, ev("QuietHoursSet", T0, { quiet: { start: 22 * 60, end: 7 * 60 } }), ev("DailyReminderSet", T0, { minutes: 6 * 60 })]);
    const r = reminders(night);
    expect(r).toHaveLength(14);
    expect(r[0]).toMatchObject({ at: T0, movedForQuiet: true }); // its window began before now: it goes out now
    expect(r[1]).toMatchObject({ at: T0 + 22 * H - MIN, movedForQuiet: true }); // day 1's 6:00, moved to day 0's 21:59
    const noon = replay([created, ev("QuietHoursSet", T0, { quiet: { start: 12 * 60, end: 14 * 60 } }), ev("DailyReminderSet", T0, { minutes: 13 * 60 })]);
    expect(reminders(noon)[0]!.at).toBe(T0 + 12 * H - MIN);
    const off = replay([created, ev("QuietHoursSet", T0, { quiet: { start: 12 * 60, end: 14 * 60 } }), ev("QuietHoursSet", T0, { quiet: null }), ev("DailyReminderSet", T0, { minutes: 13 * 60 })]);
    expect(reminders(off)[0]!.at).toBe(T0 + 13 * H);
  });
});
