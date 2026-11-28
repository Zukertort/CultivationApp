import { describe, expect, it } from "vitest";
import { REPENT_OATH, parseEvent, type GameEvent } from "@cultivation/schema";
import { RULES_V1, advanceTo, applyEvent, legendaryItems, replay } from "@cultivation/rules";
import { SCENARIOS, type ScenarioContext } from "./scenarios.js";

const HOUR = 60 * 60 * 1000;

/** Starts across every weekday and a month boundary: the engine's weeks and months depend on the start. */
const OFFSETS = [0, 1, 2, 3, 4, 5, 6, 15, 30];

/** Today's local midnight `offset` days after Wednesday 2026-12-30, the day before a month ends (Buenos Aires by default). */
function ctxFor(offset: number, tzOffsetMinutes = -180): ScenarioContext {
  return { today: Date.UTC(2026, 11, 30 + offset) - tzOffsetMinutes * 60_000, tzOffsetMinutes, userId: "device-user" };
}

describe("scenarios", () => {
  it("have unique ids", () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  for (const sc of SCENARIOS) {
    describe(sc.id, () => {
      const offsets = sc.heavy ? [0, 3, 15] : OFFSETS;
      for (const offset of offsets) {
        it(`builds a valid log and holds (start offset ${offset})`, () => {
          const ctx = ctxFor(offset);
          const now = ctx.today + 10 * HOUR;
          const log = sc.build(ctx);
          // Real events: they parse, carry the device's user id, never go back in time and end before now.
          for (const e of log) {
            expect(parseEvent(e)).toEqual(e);
            expect(e.userId).toBe("device-user");
          }
          expect(new Set(log.map((e) => e.id)).size).toBe(log.length);
          for (let i = 1; i < log.length; i++) expect(log[i]!.at).toBeGreaterThanOrEqual(log[i - 1]!.at);
          if (log.length > 0) expect(log.at(-1)!.at).toBeLessThan(ctx.today);
          // Replaying the log gives the state the scenario claims.
          const replayed = replay(log, RULES_V1);
          const state = replayed.created ? advanceTo(replayed, now, RULES_V1) : replayed;
          expect(sc.check(state, now)).toEqual([]);
        });
      }
    });
  }

  it("builds the same log for the same start (deterministic)", () => {
    const sc = SCENARIOS.find((s) => s.id === "core-mid")!;
    expect(sc.build(ctxFor(2))).toEqual(sc.build(ctxFor(2)));
  });

  it("follows the device's timezone", () => {
    const sc = SCENARIOS.find((s) => s.id === "due-tomorrow")!;
    const ctx = ctxFor(0, 60);
    const log = sc.build(ctx);
    expect(log[0]).toMatchObject({ type: "CultivatorCreated", tzOffsetMinutes: 60 });
    const state = advanceTo(replay(log, RULES_V1), ctx.today + 10 * HOUR, RULES_V1);
    expect(sc.check(state, ctx.today + 10 * HOUR)).toEqual([]);
  });

  it("legendary-repent: a repent removes the breakthrough's worn legendary and keeps the class one (rulings 103, 179)", () => {
    const sc = SCENARIOS.find((s) => s.id === "legendary-repent")!;
    const ctx = ctxFor(0);
    const now = ctx.today + 10 * HOUR;
    const s = advanceTo(replay(sc.build(ctx), RULES_V1), now, RULES_V1);
    const fromStep = legendaryItems(s).find((i) => i.source?.kind === "step")!;
    const fromClass = legendaryItems(s).find((i) => i.source?.kind === "class")!;
    expect(fromStep.realm).toBe("nascent_soul");
    expect(fromClass.realm).toBe("core_formation");
    const faked = Object.entries(s.tribulations.items).find(([, t]) => t.realm === "core_formation" && t.status === "passed" && t.closedAt === null)![0];
    const repent = { id: "r1", userId: "device-user", at: now, type: "Repented", oath: REPENT_OATH, faked: [faked] } as GameEvent;
    const after = applyEvent(s, repent, RULES_V1);
    expect(after.main.realm).toBe("core_formation");
    expect(legendaryItems(after).map((i) => i.id)).toEqual([fromClass.id]);
    expect(after.gear.lost.at(-1)).toMatchObject({ reason: "repent", item: { id: fromStep.id } });
  });
});
