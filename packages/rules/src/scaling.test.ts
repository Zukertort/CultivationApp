import { describe, expect, it } from "vitest";
import { CLOSED_DOOR_OATH, OATH_TEXT, TRIBULATION_OATH, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  GEAR_REALMS,
  RULES_V1,
  addDebt,
  applyEvent,
  completionCost,
  realmFactor,
  repairPrice,
  replay,
  shopPrice,
  unarmoredLoss,
  type CultivatorState,
  type GearItem,
} from "./index.js";

const T0 = Date.UTC(2026, 10, 2, 3);
const H = 60 * 60 * 1000;
let seq = 0;
const ev = <T extends GameEvent["type"]>(type: T, at: number, rest: Omit<Extract<GameEvent, { type: T }>, "id" | "userId" | "at" | "type">) =>
  ({ id: `x${++seq}`, userId: "u1", at, type, ...rest }) as unknown as GameEvent;
const created = ev("CultivatorCreated", T0, { name: "Ricardo", tzOffsetMinutes: -180, oath: OATH_TEXT });
const overrides = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ev("RealmOverride", T0 + from + i, { class: "monk" }));

describe("replay never throws (ruling 168)", () => {
  it("skips events the current rules reject, records each with its reason, and keeps going", () => {
    // A log written under older rules: a Nascent Soul lock in Foundation, a completion with no Qi, armor never held,
    // an event out of order, and a closed-door rest without the oath after the version that requires it.
    const log: GameEvent[] = [
      created,
      ...overrides(4),
      ev("NascentSoulLocked", T0 + H, {}),
      ev("TribulationDeclared", T0 + H, { tribulationId: "t", title: "Exam", criteria: "Pass", deadline: T0 + 20 * DAY }),
      ev("TribulationClaimed", T0 + 2 * H, { tribulationId: "t", oath: TRIBULATION_OATH, llmReview: "skipped" }),
      ev("TribulationCompleted", T0 + 3 * H, { tribulationId: "t" }),
      ev("GearEquipped", T0 + 4 * H, { itemId: "missing" }),
      // Earlier than the last applied event (the claim): skipped events never move the clock.
      ev("BodyActivityDefined", T0 + H + 1, { activityId: "late", name: "Late", kind: "routine" }),
      ev("RestStarted", RULES_V1.rest.closedDoorOathFrom + H, { kind: "closed_door", until: RULES_V1.rest.closedDoorOathFrom + 3 * DAY }),
      ev("BodyActivityDefined", RULES_V1.rest.closedDoorOathFrom + 2 * H, { activityId: "gym", name: "Gym", kind: "routine" }),
    ];
    const s = replay(log);
    const skipped = s.anomalies.filter((a) => a.code === "replay_skipped").map((a) => a.detail!.split(": ")[1]);
    expect(skipped).toEqual(["not_nascent_soul", "insufficient_qi", "unknown_gear", "out_of_order", "oath_required"]);
    // What came after each skip still applied.
    expect(s.main.realm).toBe("foundation_establishment");
    expect(s.tribulations.items.t).toMatchObject({ status: "passed", completedAt: null });
    expect(s.activities.gym).toBeDefined();
    expect(s.rest).toBeNull();
  });
});

describe("closed-door oath (ruling 173)", () => {
  const from = RULES_V1.rest.closedDoorOathFrom;
  it("is required from the version that introduced it; older closed-door events replay without it", () => {
    const old = replay([created, ev("RestStarted", T0 + H, { kind: "closed_door", until: T0 + 3 * DAY })]);
    expect(old.rest?.kind).toBe("closed_door");
    expect(old.anomalies).toEqual([]);
    const now = replay([created]);
    expect(() => applyEvent(now, ev("RestStarted", from + H, { kind: "closed_door", until: from + 3 * DAY }))).toThrow(/oath/);
    expect(applyEvent(now, ev("RestStarted", from + H, { kind: "closed_door", oath: CLOSED_DOOR_OATH, until: from + 3 * DAY })).rest?.kind).toBe("closed_door");
  });

  it("logs closed-door rest started within 3 days of a vacation's end, never penalized; no shared cap", () => {
    const rich = (s: CultivatorState): CultivatorState => ({ ...s, gold: 5000 });
    let s = rich(replay([created]));
    s = applyEvent(s, ev("RestStarted", from, { kind: "vacation", until: from + 14 * DAY }));
    const qi = s.qi;
    const close = applyEvent(s, ev("RestStarted", from + 16 * DAY, { kind: "closed_door", oath: CLOSED_DOOR_OATH, until: from + 30 * DAY }));
    expect(close.main.flags.map((f) => f.code)).toContain("closed_door_after_vacation");
    expect(close.qi).toBe(qi);
    const later = applyEvent(s, ev("RestStarted", from + 18 * DAY, { kind: "closed_door", oath: CLOSED_DOOR_OATH, until: from + 20 * DAY }));
    expect(later.main.flags.map((f) => f.code)).not.toContain("closed_door_after_vacation");
  });
});

describe("realm scaling (rulings 169-172)", () => {
  it("doubles the completion cost per realm from K = 350; none in Qi Condensation or Spirit Realm (until Step 2)", () => {
    expect(completionCost("qi_condensation")).toBe(0);
    expect(completionCost("foundation_establishment")).toBe(350);
    expect(completionCost("core_formation")).toBe(700);
    expect(completionCost("nascent_soul")).toBe(1400);
    expect(completionCost("spirit_realm")).toBe(0);
    expect(GEAR_REALMS.map((r) => realmFactor(r))).toEqual([1, 2, 4, 8]);
  });

  it("doubles one-time gear prices per realm, but keeps repairs and the unarmored loss at Foundation's (fixed share of a flat income)", () => {
    GEAR_REALMS.forEach((realm, i) => {
      expect(shopPrice("armor", realm)).toBe(shopPrice("armor", "foundation_establishment") * 2 ** i);
      expect(shopPrice("weapon", realm)).toBe(shopPrice("weapon", "foundation_establishment") * 2 ** i);
      const worn: GearItem = { id: "i", slot: "armor", kind: "shop", realm, damageBp: 5000, obtainedAt: 0 };
      expect(repairPrice(worn)).toBe(repairPrice({ ...worn, realm: "foundation_establishment" }));
    });
    expect(unarmoredLoss(500).gold).toBeGreaterThan(repairPrice({ id: "i", slot: "armor", kind: "shop", realm: "nascent_soul", damageBp: 500, obtainedAt: 0 }));
  });

  it("scales the debt cap by the realm factor", () => {
    const s = structuredClone(replay([created, ...overrides(12)]));
    expect(s.main.realm).toBe("nascent_soul");
    addDebt(s, 1000, 0, T0 + DAY, RULES_V1, false);
    expect(s.main.debt.qi).toBe(RULES_V1.main.debtCap.qi * 4);
  });
});
