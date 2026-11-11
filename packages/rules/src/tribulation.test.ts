import { describe, expect, it } from "vitest";
import { OATH_TEXT, TRIBULATION_OATH, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  RuleViolation,
  advanceTo,
  applyEvent,
  pendingTribulationRolls,
  pushAlertPlan,
  replay,
  tribulationDeletePrice,
  tribulationDropOutcome,
  tribulationEditPrice,
  tribulationStatus,
  type CultivatorState,
} from "./index.js";

// Day 0 = Monday 2026-11-02 00:00 in Buenos Aires (UTC-3).
const T0 = Date.UTC(2026, 10, 2, 3);
const H = 60 * 60 * 1000;
let seq = 0;
const ev = <T extends GameEvent["type"]>(type: T, at: number, rest: Omit<Extract<GameEvent, { type: T }>, "id" | "userId" | "at" | "type">) =>
  ({ id: `t${++seq}`, userId: "u1", at, type, ...rest }) as unknown as GameEvent;

const created = ev("CultivatorCreated", T0, { name: "Ricardo", tzOffsetMinutes: -180, oath: OATH_TEXT });
const interview = ev("InterviewAnswered", T0, { interests: { main: "Mathematics", body: "BJJ", soul: "" } });
// Tribulations exist from Foundation on (ruling 89); overrides reach early Core Formation, whose next threshold is 550 Qi.
const toCore = Array.from({ length: 8 }, (_, i) => ev("RealmOverride", T0 + i + 1, { class: "monk" }));
const start = [created, ...toCore];
/** Declared at day 0 08:00 with a 10-day span: the last quarter starts at day 7 20:00. */
const DECLARED = T0 + 8 * H;
const DEADLINE = DECLARED + 10 * DAY;
const declare = (tribulationId = "x", at = DECLARED, deadline = DEADLINE) =>
  ev("TribulationDeclared", at, { tribulationId, title: "Pass the exam", criteria: "Score at least 80 on the final exam", deadline });
const claim = (at: number, tribulationId = "x", extra: object = {}) =>
  ev("TribulationClaimed", at, { tribulationId, oath: TRIBULATION_OATH, llmReview: "skipped", ...extra });
const edit = (at: number, criteria = "Score at least 70", tribulationId = "x") => ev("TribulationEdited", at, { tribulationId, criteria });
const del = (at: number, tribulationId = "x") => ev("TribulationDeleted", at, { tribulationId });
const reschedule = (at: number, deadline: number, tribulationId = "x") => ev("TribulationRescheduled", at, { tribulationId, deadline });

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof RuleViolation) return e.code;
    throw e;
  }
  return undefined;
}

const apply = (s: CultivatorState, ...events: GameEvent[]) => events.reduce((acc, e) => applyEvent(acc, e), s);
const rich = (s: CultivatorState, qi = 1000, gold = 1000): CultivatorState => ({ ...s, qi, gold });
const base = () => rich(replay([...start, declare()]));

describe("declaring (rulings 64, 66)", () => {
  it("records the realm and takes deadlines from 24 hours to 365 days out", () => {
    const s = replay([...start, declare()]);
    expect(s.tribulations.items.x).toMatchObject({ realm: "core_formation", status: "open", failures: 0, closedAt: null });
    const at = T0 + H;
    expect(code(() => replay([...start, declare("y", at, at + 24 * H - 1)]))).toBe("deadline_too_soon");
    expect(code(() => replay([...start, declare("y", at, at + 24 * H)]))).toBeUndefined();
    expect(code(() => replay([...start, declare("y", at, at + 365 * DAY + 1)]))).toBe("deadline_too_far");
    expect(code(() => applyEvent(s, declare("x", T0 + 9 * H)))).toBe("duplicate_tribulation");
  });

  it("costs nothing to add in Step 1, and allows any number open", () => {
    const s = replay([...start, ...Array.from({ length: 5 }, (_, i) => declare(`t${i}`))]);
    expect(Object.keys(s.tribulations.items)).toHaveLength(5);
    expect(s.qi).toBe(0);
  });
});

describe("claiming (rulings 68-69, 71)", () => {
  it("passes an open tribulation with the oath, counts as Main activity, and logs a self-reported claim", () => {
    const evs = [created, interview, ...toCore, declare()];
    const idle = replay(evs, RULES_V1, T0 + 5 * DAY);
    const claimed = replay([...evs, claim(T0 + 2 * DAY, "x", { evidence: [{ kind: "link", ref: "https://example.com/grade" }] })], RULES_V1, T0 + 5 * DAY);
    expect(idle.main.taxPaid.main.idleDays).toBe(2);
    expect(claimed.main.taxPaid.main.idleDays).toBe(0);
    expect(tribulationStatus(claimed, "x")).toBe("passed");
    expect(claimed.tribulations.items.x!.evidence).toBe(1);
    expect(claimed.main.flags).toContainEqual({ at: T0 + 2 * DAY, code: "tribulation_claimed", id: "x", detail: "self_reported" });
    // Passing pays no Qi or gold (ruling 68).
    expect(claimed.qi).toBe(0);
    expect(claimed.gold).toBe(0);
  });

  it("accepts a claim up to the deadline and rejects one after it", () => {
    expect(code(() => applyEvent(base(), claim(DEADLINE)))).toBeUndefined();
    expect(code(() => applyEvent(base(), claim(DEADLINE + 1)))).toBe("tribulation_failed");
    expect(code(() => applyEvent(apply(base(), claim(T0 + DAY)), claim(T0 + 2 * DAY)))).toBe("tribulation_passed");
  });

  it("earns one item roll, stored or pending, at most once per 7 days", () => {
    const s = replay([...start, declare("a"), declare("b"), declare("c")]);
    const first = apply(s, claim(T0 + DAY, "a", { drop: "gain_potion" }));
    expect(first.inventory.gainPotions).toBe(1);
    // Six days later: inside the cooldown, so the stored outcome is ignored.
    const second = apply(first, claim(T0 + 7 * DAY, "b", { drop: "gain_potion" }));
    expect(second.inventory.gainPotions).toBe(1);
    // Seven days after the first roll: a new roll, rolled offline and recorded on sync.
    const third = apply(second, claim(T0 + 8 * DAY, "c"));
    const [pending] = pendingTribulationRolls(third);
    expect(pending).toMatchObject({ tribulationId: "c" });
    const rolled = apply(third, ev("TribulationDropRolled", T0 + 8 * DAY + H, { eventId: pending!.eventId, drop: "legendary_potion" }));
    expect(rolled.inventory.legendaryPotions).toBe(1);
    expect(rolled.tribulations.drops).toEqual({ none: 0, gain_potion: 1, legendary_potion: 1 });
    const dup = apply(rolled, ev("TribulationDropRolled", T0 + 8 * DAY + 2 * H, { eventId: pending!.eventId, drop: "gain_potion" }));
    expect(dup.anomalies.map((a) => a.code)).toEqual(["orphan_tribulation_drop_roll"]);
  });

  it("rolls an item at 50%, split 50/50 between potion kinds", () => {
    expect(tribulationDropOutcome(0)).toBe("gain_potion");
    expect(tribulationDropOutcome(0.2499)).toBe("gain_potion");
    expect(tribulationDropOutcome(0.25)).toBe("legendary_potion");
    expect(tribulationDropOutcome(0.4999)).toBe("legendary_potion");
    expect(tribulationDropOutcome(0.5)).toBe("none");
    expect(() => tribulationDropOutcome(1)).toThrow(RangeError);
  });
});

describe("missed deadlines (rulings 65-66)", () => {
  it("fails at the first midnight after the deadline, dated at the deadline, taking Qi down to 75% of the threshold and 45 gold", () => {
    const s = advanceTo(base(), T0 + 11 * DAY - 1);
    expect(tribulationStatus(s, "x")).toBe("failed"); // derived at once
    expect(s.qi).toBe(1000); // not applied yet
    const failed = advanceTo(s, T0 + 11 * DAY);
    expect(failed.tribulations.items.x).toMatchObject({ status: "failed", failedAt: DEADLINE, failures: 1, due: null });
    // The next threshold is 550: the loss is the larger of 137.5 and the 587.5 above 412.5 (ruling 80).
    expect(failed.qi).toBe(412.5);
    expect(failed.gold).toBe(955);
  });

  it("floors the loss at the balances and never makes debt or deviation", () => {
    // No interview, so no tax clock: only the failure touches the balances.
    const s = advanceTo(rich(replay([...start, declare()]), 10, 0), T0 + 11 * DAY);
    expect(s.qi).toBe(0);
    expect(s.tribulations.spent.failures).toEqual({ qi: 10, gold: 0, count: 1 });
    expect(s.main.debt).toEqual({ qi: 0, gold: 0 });
    expect(s.main.deviation).toBeNull();
  });

  it("applies the failure at the next event about the tribulation when that comes first", () => {
    const s = apply(base(), reschedule(DEADLINE + H, DEADLINE + 5 * DAY));
    expect(s.qi).toBe(412.5);
    expect(s.tribulations.items.x).toMatchObject({ status: "open", failures: 1, spanStart: DEADLINE + H });
  });

  it("keeps a failed tribulation without a deadline until rescheduled; each failure costs again", () => {
    let s = advanceTo(base(), T0 + 30 * DAY);
    expect(tribulationStatus(s, "x")).toBe("failed");
    expect(s.qi).toBe(412.5);
    expect(code(() => applyEvent(base(), reschedule(T0 + DAY, T0 + 20 * DAY)))).toBe("not_failed");
    expect(code(() => applyEvent(s, reschedule(T0 + 30 * DAY, T0 + 30 * DAY + H)))).toBe("deadline_too_soon");
    s = apply(s, reschedule(T0 + 30 * DAY, T0 + 40 * DAY));
    s = advanceTo(s, T0 + 41 * DAY);
    expect(s.tribulations.items.x!.failures).toBe(2);
    expect(s.qi).toBe(275); // already at 75%: a quarter of the threshold, 137.5

    s = apply(s, reschedule(T0 + 41 * DAY, T0 + 50 * DAY), claim(T0 + 45 * DAY));
    expect(tribulationStatus(s, "x")).toBe("passed");
  });
});

describe("editing and deleting (ruling 67)", () => {
  it("edits free within the first hour, 20 Qi in the first three quarters, and a failure's loss in the last quarter (ruling 93)", () => {
    expect(tribulationEditPrice(base(), "x", DECLARED + H)).toEqual({ qi: 0, gold: 0, kind: "free" });
    expect(tribulationEditPrice(base(), "x", DECLARED + H + 1)).toEqual({ qi: 20, gold: 0, kind: "early" });
    expect(tribulationEditPrice(base(), "x", DECLARED + 7.5 * DAY - 1).kind).toBe("early");
    expect(tribulationEditPrice(base(), "x", DECLARED + 7.5 * DAY)).toEqual({ qi: 587.5, gold: 45, kind: "late" });
    const s = apply(base(), edit(DECLARED + 30 * 60 * 1000), edit(DECLARED + DAY), edit(DECLARED + 8 * DAY));
    expect(s.qi).toBe(412.5); // 20, then the 567.5 above 412.5
    expect(s.gold).toBe(1000 - 45);
    expect(s.tribulations.items.x!.criteria).toBe("Score at least 70");
    expect(s.main.flags.filter((f) => f.code !== "realm_override").map((f) => [f.code, f.detail])).toEqual([
      ["tribulation_edited", "free"],
      ["tribulation_edited", "early"],
      ["tribulation_edited", "late"],
    ]);
  });

  it("measures the last quarter from the reschedule, and charges 20 Qi to edit a failed tribulation", () => {
    let s = advanceTo(base(), T0 + 12 * DAY);
    expect(tribulationEditPrice(s, "x", T0 + 12 * DAY)).toEqual({ qi: 20, gold: 0, kind: "failed" });
    s = apply(s, reschedule(T0 + 12 * DAY, T0 + 20 * DAY));
    expect(tribulationEditPrice(s, "x", T0 + 17 * DAY)).toMatchObject({ kind: "early" });
    expect(tribulationEditPrice(s, "x", T0 + 18 * DAY)).toMatchObject({ kind: "late" });
  });

  it("rejects an early edit it can't afford, an empty edit, and any change to a passed tribulation", () => {
    const poor = rich(replay([...start, declare()]), 19, 0);
    expect(code(() => applyEvent(poor, edit(DECLARED + DAY)))).toBe("insufficient_qi");
    // A late edit is taken like a failure, floored and never rejected, but the tribulation stays open (ruling 100).
    const late = apply(rich(replay([...start, declare()]), 100, 10), edit(DECLARED + 8 * DAY));
    expect([late.qi, late.gold]).toEqual([0, 0]);
    expect(late.tribulations.items.x).toMatchObject({ status: "open", failures: 0, due: { deadline: DEADLINE } });
    expect(code(() => applyEvent(base(), ev("TribulationEdited", DECLARED + DAY, { tribulationId: "x" })))).toBe("nothing_to_edit");
    const passed = apply(base(), claim(T0 + DAY));
    expect(code(() => applyEvent(passed, edit(T0 + 2 * DAY)))).toBe("tribulation_passed");
    // Deleting a passed tribulation of the current realm admits it was faked (ruling 126).
    expect(applyEvent(passed, del(T0 + 2 * DAY)).main.flags.map((f) => f.code)).toContain("tribulation_faked");
  });

  it("deletes an open tribulation for a failure's loss plus 2%, and a failed one for 40 Qi (ruling 93)", () => {
    expect(tribulationDeletePrice(base(), "x", T0 + DAY)).toEqual({ qi: 587.5 * 1.02, gold: 45 * 1.02, kind: "open" });
    const s = apply(base(), del(T0 + DAY));
    expect(s.qi).toBeCloseTo(1000 - 587.5 * 1.02, 9);
    expect(s.gold).toBeCloseTo(1000 - 45 * 1.02, 9);
    expect(tribulationStatus(s, "x")).toBe("deleted");
    expect(s.main.flags).toContainEqual({ at: T0 + DAY, code: "tribulation_deleted", id: "x", detail: "open" });
    expect(code(() => applyEvent(s, claim(T0 + 2 * DAY)))).toBe("tribulation_deleted");
    // A failed one: the failure was already paid.
    const failed = apply(advanceTo(base(), T0 + 12 * DAY), del(T0 + 12 * DAY));
    expect(failed.qi).toBe(1000 - 587.5 - 40);
    expect(failed.gold).toBe(1000 - 45);
    expect(code(() => applyEvent(advanceTo(rich(replay([...start, declare()]), 30), T0 + 12 * DAY), del(T0 + 12 * DAY)))).toBe("insufficient_qi");
    // An open one is never rejected: like a failure, the loss is floored at the balances.
    const poor = apply(rich(replay([...start, declare()]), 97, 10), del(T0 + DAY));
    expect([poor.qi, poor.gold, tribulationStatus(poor, "x")]).toEqual([0, 0, "deleted"]);
  });

  it("makes deleting an open tribulation cost more than failing it, with savings or without", () => {
    for (const qi of [300, 1000, 5000]) {
      const deleted = apply(rich(replay([...start, declare()]), qi), del(T0 + DAY));
      const failed = advanceTo(rich(replay([...start, declare()]), qi), T0 + 11 * DAY);
      expect(deleted.qi).toBeLessThan(failed.qi);
      expect(deleted.gold).toBeLessThan(failed.gold);
    }
  });
});

describe("rest (ruling 70)", () => {
  it("keeps the deadline during a vacation", () => {
    const s = apply(base(), ev("RestStarted", T0 + 8 * DAY, { kind: "vacation", until: T0 + 13 * DAY }));
    expect(code(() => applyEvent(s, claim(DEADLINE + H)))).toBe("tribulation_failed");
    expect(advanceTo(s, T0 + 12 * DAY).tribulations.items.x!.status).toBe("failed");
  });

  it("pushes the deadline back by the days spent in closed-door cultivation", () => {
    const s = apply(base(), ev("RestStarted", T0 + 8 * DAY, { kind: "closed_door", until: T0 + 12 * DAY }));
    expect(code(() => applyEvent(s, claim(DEADLINE + H)))).toBeUndefined(); // during the rest
    const after = advanceTo(s, T0 + 12 * DAY);
    expect(after.tribulations.items.x!.due!.deadline).toBe(DEADLINE + 4 * DAY);
    expect(tribulationStatus(advanceTo(after, DEADLINE + 4 * DAY), "x")).toBe("open");
    const early = apply(s, ev("RestEnded", T0 + 9 * DAY, {}));
    expect(early.tribulations.items.x!.due!.deadline).toBe(DEADLINE + DAY);
  });

  it("extends a deadline even when the rest starts at the deadline itself, the last moment a claim is allowed", () => {
    const s = apply(base(), ev("RestStarted", DEADLINE, { kind: "closed_door", until: DEADLINE + 2 * DAY }));
    const after = advanceTo(s, DEADLINE + 2 * DAY);
    expect(after.tribulations.items.x!.due!.deadline).toBe(DEADLINE + 2 * DAY);
    expect(tribulationStatus(after, "x")).toBe("open");
  });
});

describe("push alerts (rulings 69-70)", () => {
  it("pushes at 72, 48, 24 and 1 hour left, ahead of every other alert", () => {
    const s = replay([...start, declare("x", T0 + 8 * H, T0 + 8 * H + 5 * DAY)]);
    const plan = pushAlertPlan(s, T0 + 8 * H);
    expect(plan.filter((a) => a.kind === "tribulation_deadline").map((a) => a.hoursLeft)).toEqual([72, 48, 24, 1]);
    // A day with 4 alerts keeps the tribulation's (at most 3 a day, most urgent first).
    const crowded = replay([
      ...start,
      declare("x", T0 + 8 * H, T0 + 20 * H + 3 * DAY),
      ...["a", "b", "c"].map((id) =>
        ev("MainQuestDefined", T0 + 8 * H, {
          questId: id,
          name: id,
          deadline: T0 + 20 * H + 3 * DAY,
          tasks: [
            { taskId: `${id}1`, name: `${id}1`, difficulty: "mid", effort: "session" },
            { taskId: `${id}2`, name: `${id}2`, difficulty: "mid", effort: "session" },
          ],
        }),
      ),
    ]);
    const day3 = pushAlertPlan(crowded, T0 + 8 * H).filter((a) => a.hoursLeft === 1);
    expect(day3.map((a) => a.kind)).toEqual(["tribulation_deadline", "quest_deadline", "quest_deadline"]);
  });

  it("mutes everything but tribulation deadlines on vacation, and everything on closed-door rest, then pushes the return date", () => {
    const quests = (id: string) =>
      ev("MainQuestDefined", T0 + 8 * H, {
        questId: id,
        name: id,
        deadline: T0 + 8 * H + 4 * DAY,
        tasks: [
          { taskId: `${id}1`, name: `${id}1`, difficulty: "mid", effort: "session" },
          { taskId: `${id}2`, name: `${id}2`, difficulty: "mid", effort: "session" },
        ],
      });
    const s = rich(replay([...start, declare("x", T0 + 8 * H, T0 + 8 * H + 4 * DAY), quests("q")]));
    const vacation = apply(s, ev("RestStarted", T0 + 9 * H, { kind: "vacation", until: T0 + 10 * DAY }));
    const vplan = pushAlertPlan(vacation, T0 + 9 * H).filter((a) => a.kind !== "daily_reminder");
    expect(new Set(vplan.map((a) => a.kind))).toEqual(new Set(["tribulation_deadline", "rest_ending"]));
    expect(vplan.at(-1)).toMatchObject({ kind: "rest_ending", at: T0 + 10 * DAY });
    const closed = apply(s, ev("RestStarted", T0 + 9 * H, { kind: "closed_door", until: T0 + 10 * DAY }));
    // Inside the rest only the return date pushes; the deadlines it pushed back alert after it.
    const cplan = pushAlertPlan(closed, T0 + 9 * H).filter((a) => a.kind !== "daily_reminder");
    expect(cplan.filter((a) => a.at <= T0 + 10 * DAY).map((a) => a.kind)).toEqual(["rest_ending"]);
    expect(cplan.some((a) => a.kind === "tribulation_deadline" && a.at > T0 + 10 * DAY)).toBe(true);
  });
});
