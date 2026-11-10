import { describe, expect, it } from "vitest";
import { OATH_TEXT, parseEvent } from "./index.js";

describe("parseEvent", () => {
  it("accepts a valid event", () => {
    const e = parseEvent({
      id: "e1",
      userId: "u1",
      at: 0,
      type: "CultivatorCreated",
      name: "Ricardo",
      tzOffsetMinutes: -180,
      oath: OATH_TEXT,
    });
    expect(e.type).toBe("CultivatorCreated");
  });

  it("rejects a wrong oath", () => {
    expect(() =>
      parseEvent({
        id: "e1",
        userId: "u1",
        at: 0,
        type: "CultivatorCreated",
        name: "Ricardo",
        tzOffsetMinutes: -180,
        oath: "I promise, mostly.",
      }),
    ).toThrow();
  });

  it("rejects an unknown event type", () => {
    expect(() => parseEvent({ id: "e1", userId: "u1", at: 0, type: "GoldMinted", amount: 1e9 })).toThrow();
  });

  it("rejects an unknown roulette prize", () => {
    expect(() => parseEvent({ id: "e1", userId: "u1", at: 0, type: "RouletteSpun", prize: "wings" })).toThrow();
  });

  it("accepts a heart demon with no negative tasks and defaults them to []", () => {
    const e = parseEvent({
      id: "e1",
      userId: "u1",
      at: 0,
      type: "HeartDemonCreated",
      demonId: "d1",
      name: "Doomscrolling at night",
      positiveTasks: [{ taskId: "t1", name: "Journal before bed" }],
    });
    expect(e.type === "HeartDemonCreated" && e.negativeTasks).toEqual([]);
  });

  it("rejects a heart demon with no positive task", () => {
    expect(() =>
      parseEvent({ id: "e1", userId: "u1", at: 0, type: "HeartDemonCreated", demonId: "d1", name: "Anger", positiveTasks: [] }),
    ).toThrow();
  });

  it("requires a userId on soul events", () => {
    expect(() => parseEvent({ id: "e1", at: 0, type: "SoulTaskLogged", taskId: "t1" })).toThrow();
  });

  it("accepts a stored drop outcome and rejects an unknown one", () => {
    const e = { id: "e1", userId: "u1", at: 0, type: "SoulTaskLogged", taskId: "t1" };
    expect(parseEvent({ ...e, drop: "lose_gold" }).type).toBe("SoulTaskLogged");
    expect(() => parseEvent({ ...e, drop: "wings" })).toThrow();
  });

  it("accepts a SoulDropRolled with at least one outcome", () => {
    const r = { id: "e2", userId: "u1", at: 0, type: "SoulDropRolled", eventId: "e1" };
    expect(parseEvent({ ...r, drops: ["gold", "none"] }).type).toBe("SoulDropRolled");
    expect(() => parseEvent({ ...r, drops: [] })).toThrow();
  });

  it("requires a soul quest to link at least two demons", () => {
    const q = { id: "e1", userId: "u1", at: 0, type: "SoulQuestDefined", questId: "q1", name: "Meditate" };
    expect(() => parseEvent({ ...q, demonIds: ["d1"] })).toThrow();
    expect(parseEvent({ ...q, demonIds: ["d1", "d2"] }).type).toBe("SoulQuestDefined");
  });

  const task = { id: "e1", userId: "u1", at: 0, type: "MainTaskDefined", taskId: "t1", name: "Math exercise", difficulty: "mid", effort: "session" };

  it("accepts one-time and recurring Main tasks", () => {
    expect(parseEvent({ ...task, schedule: { kind: "once", deadline: 1000 } }).type).toBe("MainTaskDefined");
    expect(parseEvent({ ...task, schedule: { kind: "recurring", count: 3, per: "week" } }).type).toBe("MainTaskDefined");
  });

  it("caps recurring tasks at 2 a day", () => {
    expect(() => parseEvent({ ...task, schedule: { kind: "recurring", count: 3, per: "day" } })).toThrow();
    expect(() => parseEvent({ ...task, schedule: { kind: "recurring", count: 15, per: "week" } })).toThrow();
    expect(() => parseEvent({ ...task, schedule: { kind: "recurring", count: 0, per: "month" } })).toThrow();
  });

  it("rejects unknown difficulties and efforts, and a one-time task without a deadline", () => {
    expect(() => parseEvent({ ...task, difficulty: "legendary", schedule: { kind: "once", deadline: 1 } })).toThrow();
    expect(() => parseEvent({ ...task, effort: "forever", schedule: { kind: "once", deadline: 1 } })).toThrow();
    expect(() => parseEvent({ ...task, schedule: { kind: "once" } })).toThrow();
  });

  it("requires a Main quest to bundle 2 to 10 tasks", () => {
    const member = { taskId: "t", name: "Read", difficulty: "easy", effort: "quick" };
    const q = { id: "e1", userId: "u1", at: 0, type: "MainQuestDefined", questId: "q1", name: "Exam prep", deadline: 1000 };
    expect(() => parseEvent({ ...q, tasks: [member] })).toThrow();
    expect(parseEvent({ ...q, tasks: [member, { ...member, taskId: "t2" }] }).type).toBe("MainQuestDefined");
    expect(() => parseEvent({ ...q, tasks: Array.from({ length: 11 }, (_, i) => ({ ...member, taskId: "t" + i })) })).toThrow();
  });

  it("accepts milestones with their own deadline, yearly tasks, work-on and quest drops", () => {
    const member = { taskId: "t", name: "Read", difficulty: "easy", effort: "project" };
    const q = { id: "e1", userId: "u1", at: 0, type: "MainQuestDefined", questId: "q1", name: "Thesis", deadline: 1000 };
    expect(parseEvent({ ...q, tasks: [{ ...member, deadline: 500 }, { ...member, taskId: "t2" }] }).type).toBe("MainQuestDefined");
    expect(parseEvent({ ...task, schedule: { kind: "recurring", count: 12, per: "year" } }).type).toBe("MainTaskDefined");
    expect(() => parseEvent({ ...task, schedule: { kind: "recurring", count: 733, per: "year" } })).toThrow();
    expect(parseEvent({ id: "e1", userId: "u1", at: 0, type: "MainTaskWorkedOn", taskId: "t1" }).type).toBe("MainTaskWorkedOn");
    expect(parseEvent({ id: "e1", userId: "u1", at: 0, type: "MainTaskCompleted", taskId: "t1", questDrop: "item" }).type).toBe("MainTaskCompleted");
    expect(() => parseEvent({ id: "e1", userId: "u1", at: 0, type: "MainTaskCompleted", taskId: "t1", questDrop: "legendary" })).toThrow();
    expect(parseEvent({ id: "e2", userId: "u1", at: 0, type: "MainQuestDropRolled", eventId: "e1", drop: "none" }).type).toBe("MainQuestDropRolled");
  });

  it("accepts the interview with undecided interests", () => {
    const e = { id: "e1", userId: "u1", at: 0, type: "InterviewAnswered", interests: { main: "Mathematics", body: "", soul: "" } };
    expect(parseEvent(e).type).toBe("InterviewAnswered");
  });
});
