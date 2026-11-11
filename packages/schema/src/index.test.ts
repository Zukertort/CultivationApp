import { describe, expect, it } from "vitest";
import { OATH_TEXT, TRIBULATION_OATH, parseEvent } from "./index.js";

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

  it("requires a Main quest to bundle 2 to 52 tasks", () => {
    const member = { taskId: "t", name: "Read", difficulty: "easy", effort: "quick" };
    const q = { id: "e1", userId: "u1", at: 0, type: "MainQuestDefined", questId: "q1", name: "Exam prep", deadline: 1000 };
    expect(() => parseEvent({ ...q, tasks: [member] })).toThrow();
    expect(parseEvent({ ...q, tasks: [member, { ...member, taskId: "t2" }] }).type).toBe("MainQuestDefined");
    expect(parseEvent({ ...q, tasks: Array.from({ length: 52 }, (_, i) => ({ ...member, taskId: "t" + i })) }).type).toBe("MainQuestDefined");
    expect(() => parseEvent({ ...q, tasks: Array.from({ length: 53 }, (_, i) => ({ ...member, taskId: "t" + i })) })).toThrow();
  });

  it("accepts milestones with their own deadline, yearly tasks, work-on and quest drops", () => {
    const member = { taskId: "t", name: "Read", difficulty: "easy", effort: "project" };
    const q = { id: "e1", userId: "u1", at: 0, type: "MainQuestDefined", questId: "q1", name: "Thesis", deadline: 1000 };
    expect(parseEvent({ ...q, tasks: [{ ...member, deadline: 500 }, { ...member, taskId: "t2" }] }).type).toBe("MainQuestDefined");
    expect(parseEvent({ ...task, schedule: { kind: "recurring", count: 12, per: "year" } }).type).toBe("MainTaskDefined");
    expect(() => parseEvent({ ...task, schedule: { kind: "recurring", count: 733, per: "year" } })).toThrow();
    expect(parseEvent({ id: "e1", userId: "u1", at: 0, type: "MainTaskWorkedOn", taskId: "t1" }).type).toBe("MainTaskWorkedOn");
    expect(parseEvent({ id: "e1", userId: "u1", at: 0, type: "MainTaskCompleted", taskId: "t1", questDrop: "legendary_potion" }).type).toBe("MainTaskCompleted");
    expect(() => parseEvent({ id: "e1", userId: "u1", at: 0, type: "MainTaskCompleted", taskId: "t1", questDrop: "item" })).toThrow();
    expect(parseEvent({ id: "e2", userId: "u1", at: 0, type: "MainQuestDropRolled", eventId: "e1", drop: "none" }).type).toBe("MainQuestDropRolled");
    expect(parseEvent({ ...task, schedule: { kind: "recurring", count: 1, per: "day" }, replaces: "t0" }).type).toBe("MainTaskDefined");
  });

  it("accepts drinking a gain potion and potion outcomes of both kinds", () => {
    const base = { id: "e1", userId: "u1", at: 0 };
    expect(parseEvent({ ...base, type: "PotionUsed", potion: "gain" }).type).toBe("PotionUsed");
    expect(() => parseEvent({ ...base, type: "PotionUsed", potion: "legendary" })).toThrow();
    expect(parseEvent({ ...base, type: "RouletteSpun", prize: "legendary_potion" }).type).toBe("RouletteSpun");
    expect(() => parseEvent({ ...base, type: "RouletteSpun", prize: "potion" })).toThrow();
    expect(parseEvent({ ...base, type: "SoulTaskLogged", taskId: "t", drop: "gain_potion" }).type).toBe("SoulTaskLogged");
  });

  it("accepts the interview with undecided interests", () => {
    const e = { id: "e1", userId: "u1", at: 0, type: "InterviewAnswered", interests: { main: "Mathematics", body: "", soul: "" } };
    expect(parseEvent(e).type).toBe("InterviewAnswered");
  });
});

describe("tribulation events", () => {
  const base = { id: "e1", userId: "u1", at: 0, tribulationId: "t1" };

  it("accepts a declaration and rejects empty criteria", () => {
    const d = { ...base, type: "TribulationDeclared", title: "Pass the exam", criteria: "Score at least 80", deadline: 1000 };
    expect(parseEvent(d).type).toBe("TribulationDeclared");
    expect(() => parseEvent({ ...d, criteria: "" })).toThrow();
  });

  it("requires the exact claim oath and an LLM review marker, with optional evidence and drop", () => {
    const c = { ...base, type: "TribulationClaimed", oath: TRIBULATION_OATH, llmReview: "skipped" };
    expect(parseEvent(c).type).toBe("TribulationClaimed");
    expect(parseEvent({ ...c, evidence: [{ kind: "file", ref: "uploads/grade.pdf" }], drop: "gain_potion" }).type).toBe("TribulationClaimed");
    expect(() => parseEvent({ ...c, oath: "I passed" })).toThrow();
    expect(() => parseEvent({ ...c, llmReview: undefined })).toThrow();
    expect(() => parseEvent({ ...c, evidence: [{ kind: "video", ref: "x" }] })).toThrow();
  });

  it("accepts edits, deletions, reschedules and drop rolls", () => {
    expect(parseEvent({ ...base, type: "TribulationEdited", criteria: "Score at least 70" }).type).toBe("TribulationEdited");
    expect(parseEvent({ ...base, type: "TribulationDeleted" }).type).toBe("TribulationDeleted");
    expect(parseEvent({ ...base, type: "TribulationRescheduled", deadline: 5000 }).type).toBe("TribulationRescheduled");
    expect(parseEvent({ id: "e2", userId: "u1", at: 0, type: "TribulationDropRolled", eventId: "e1", drop: "none" }).type).toBe("TribulationDropRolled");
  });
});

describe("realm events", () => {
  const base = { id: "e1", userId: "u1", at: 0 };

  it("accepts area decisions for the three paths only", () => {
    expect(parseEvent({ ...base, type: "AreaDecided", path: "body", choice: "BJJ" }).type).toBe("AreaDecided");
    expect(() => parseEvent({ ...base, type: "AreaDecided", path: "class", choice: "Hybrid" })).toThrow();
    expect(() => parseEvent({ ...base, type: "AreaDecided", path: "main", choice: "" })).toThrow();
  });

  it("accepts the core choice, the lock, the override, a repent and a breakthrough roll", () => {
    const oath = "I acknowledge that at least one of my tribulations was faked and I solemnly swear I will not do it again.";
    expect(parseEvent({ ...base, type: "Repented", oath, faked: ["t1"] }).type).toBe("Repented");
    expect(() => parseEvent({ ...base, type: "Repented", oath: "sorry", faked: ["t1"] })).toThrow();
    for (const type of ["NascentSoulLocked", "RealmOverride"]) expect(parseEvent({ ...base, type }).type).toBe(type);
    expect(parseEvent({ ...base, type: "CoreFormed", choice: "Mathematics" }).type).toBe("CoreFormed");
    expect(() => parseEvent({ ...base, type: "CoreFormed" })).toThrow(); // the core discipline is picked with it
    expect(parseEvent({ ...base, type: "BreakthroughRolled", step: 3, item: "legendary" }).type).toBe("BreakthroughRolled");
    expect(() => parseEvent({ ...base, type: "BreakthroughRolled", step: 0, item: "none" })).toThrow();
  });
});
