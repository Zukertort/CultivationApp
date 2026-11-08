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

  it("requires a soul quest to link at least two demons", () => {
    const q = { id: "e1", userId: "u1", at: 0, type: "SoulQuestDefined", questId: "q1", name: "Meditate" };
    expect(() => parseEvent({ ...q, demonIds: ["d1"] })).toThrow();
    expect(parseEvent({ ...q, demonIds: ["d1", "d2"] }).type).toBe("SoulQuestDefined");
  });
});
