import { describe, expect, it } from "vitest";
import { OATH_TEXT, REPENT_OATH, parseEvent, type GameEvent, CLOSED_DOOR_OATH } from "@cultivation/schema";
import {
  DAY,
  GEAR_REALMS,
  PRICE_REALMS,
  RULES_V1,
  RuleViolation,
  applyEvent,
  potionPrice,
  shopPrice,
  vacationDaysLeft,
  vacationPrice,
  type CultivatorState,
} from "./index.js";
import { strictReplay as replay } from "./test-support.js";

// Day 0 = Monday 2026-11-02 00:00 in Buenos Aires (UTC-3).
const T0 = Date.UTC(2026, 10, 2, 3);
const H = 60 * 60 * 1000;
let seq = 0;
const ev = <T extends GameEvent["type"]>(type: T, at: number, rest: Omit<Extract<GameEvent, { type: T }>, "id" | "userId" | "at" | "type">) =>
  ({ id: `s${++seq}`, userId: "u1", at, type, ...rest }) as unknown as GameEvent;

const created = ev("CultivatorCreated", T0, { name: "Ricardo", tzOffsetMinutes: -180, oath: OATH_TEXT });
const climb = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ev("RealmOverride", T0 + from + i, { class: "monk" }));
const rich = (s: CultivatorState, gold = 1000): CultivatorState => ({ ...s, gold });
const apply = (s: CultivatorState, ...events: GameEvent[]) => events.reduce((acc, e) => applyEvent(acc, e), s);
const vacation = (at: number, days: number) => ev("RestStarted", at, { kind: "vacation", until: at + days * DAY });
const buyPotion = (at: number) => ev("PotionBought", at, { potion: "gain" });

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof RuleViolation) return e.code;
    throw e;
  }
  return undefined;
}

describe("gain potions in the shop (ruling 160)", () => {
  it("sells gain potions at the current realm's price, Qi Condensation included", () => {
    const qc = rich(replay([created]), 100);
    const s = apply(qc, buyPotion(T0 + H));
    expect(s.inventory.gainPotions).toBe(1);
    expect(s.gold).toBe(100 - RULES_V1.potions.gain.gold.qi_condensation);
    expect(s.shopSpent.potions).toBe(RULES_V1.potions.gain.gold.qi_condensation);
    const cf = rich(replay([created, ...climb(8)]));
    expect(potionPrice(cf)).toBe(RULES_V1.potions.gain.gold.core_formation);
    expect(code(() => applyEvent(rich(qc, 1), buyPotion(T0 + H)))).toBe("insufficient_gold");
  });

  it("never prices a gain potion below Foundation's robe", () => {
    const robe = shopPrice("armor", "foundation_establishment", RULES_V1, "robe");
    for (const realm of PRICE_REALMS) expect(RULES_V1.potions.gain.gold[realm]).toBeGreaterThanOrEqual(robe);
  });

  it("never sells legendary potions: gold doesn't buy legendary chance", () => {
    expect(() => parseEvent({ id: "e", userId: "u1", at: T0, type: "PotionBought", potion: "legendary" })).toThrow();
  });

  it("sells nothing while dead: potions, gear, vacations, extensions, class changes; closed-door rest stays free (rulings 150, 164)", () => {
    let s = replay([created, ...climb(12)]);
    for (let i = 0; i < 5; i++) s = apply(s, ev("Repented", T0 + (10 * i + 1) * H, { oath: REPENT_OATH, faked: [] }), ...(i < 4 ? climb(4, (10 * i + 2) * H) : []));
    expect(s.progress.diedAt).not.toBeNull();
    const dead = rich(s);
    const at = T0 + 60 * H;
    expect(code(() => applyEvent(dead, buyPotion(at)))).toBe("dead");
    expect(code(() => applyEvent(dead, ev("GearBought", at, { slot: "armor" })))).toBe("dead");
    expect(code(() => applyEvent(dead, vacation(at, 2)))).toBe("dead");
    expect(code(() => applyEvent(dead, ev("ClassChosen", at, { class: "warrior" })))).toBe("dead");
    // An expired one-time task's extension.
    const withTask = apply(dead, ev("MainTaskDefined", at, { taskId: "t", name: "t", difficulty: "mid", effort: "session", schedule: { kind: "once", deadline: at + 2 * DAY } }));
    expect(code(() => applyEvent(withTask, ev("MainItemExtended", at + 3 * DAY, { item: "task", itemId: "t", until: at + 4 * DAY })))).toBe("dead");
    expect(apply(dead, ev("RestStarted", at, { kind: "closed_door", oath: CLOSED_DOOR_OATH, until: at + 3 * DAY })).rest?.kind).toBe("closed_door");
  });
});

describe("rest freezes the food meter both ways (ruling 167)", () => {
  it("no treats during a rest, so a vacation can't buy tiers; the gold still pays", () => {
    const s = rich(apply(replay([created]), ev("BodyActivityDefined", T0, { activityId: "gym", name: "Gym", kind: "routine" })));
    const resting = apply(s, vacation(T0 + H, 3));
    const food = resting.companion.food;
    const trained = apply(resting, ev("BodyActivityLogged", T0 + 2 * H, { activityId: "gym" }));
    expect(trained.companion.food).toBe(food);
    expect(trained.gold).toBeGreaterThan(resting.gold);
    // After the rest, training feeds again.
    const after = apply(trained, ev("BodyActivityLogged", T0 + 4 * DAY, { activityId: "gym" }));
    expect(after.companion.food).toBeGreaterThan(0);
  });
});

describe("vacations (ruling 161)", () => {
  it("prices a vacation per day by realm", () => {
    const f = rich(replay([created, ...climb(4)]));
    const s = apply(f, vacation(T0 + H, 3));
    expect(s.gold).toBe(1000 - 3 * RULES_V1.rest.vacationGoldPerDay.foundation_establishment);
    expect(vacationPrice(f, 3)).toBe(3 * RULES_V1.rest.vacationGoldPerDay.foundation_establishment);
    expect(s.shopSpent.vacations).toBe(vacationPrice(f, 3));
    // Qi Condensation can take a vacation too.
    const qc = rich(replay([created]));
    expect(apply(qc, vacation(T0 + H, 2)).gold).toBe(1000 - 2 * RULES_V1.rest.vacationGoldPerDay.qi_condensation);
  });

  it("caps a vacation at 14 days (exploit: earning with every punishment frozen)", () => {
    const s = rich(replay([created]), 5000);
    expect(code(() => applyEvent(s, vacation(T0 + H, 15)))).toBe("vacation_too_long");
    expect(apply(s, vacation(T0 + H, 14)).rest).not.toBeNull();
  });

  it("allows at most 30 vacation days in any 91 days; an early end frees the rest", () => {
    let s = rich(replay([created]), 5000);
    s = apply(s, vacation(T0 + H, 14));
    s = apply(s, vacation(T0 + 15 * DAY, 14));
    expect(vacationDaysLeft(s, T0 + 30 * DAY)).toBe(2);
    expect(code(() => applyEvent(s, vacation(T0 + 30 * DAY, 3)))).toBe("vacation_quota");
    s = apply(s, vacation(T0 + 30 * DAY, 2));
    // Once the first one has left the 91-day window, 16 days are used: 14 left.
    expect(vacationDaysLeft(s, T0 + 106 * DAY)).toBe(14);
    // Ended early: only the days taken count.
    let early = rich(replay([created]), 5000);
    early = apply(early, vacation(T0 + H, 14), ev("RestEnded", T0 + H + 2 * DAY, {}));
    expect(vacationDaysLeft(early, T0 + 3 * DAY)).toBe(14);
    expect(vacationDaysLeft(apply(early, vacation(T0 + 3 * DAY, 14), ev("RestEnded", T0 + 10 * DAY, {})), T0 + 11 * DAY)).toBe(14);
  });

  it("keeps closed-door rest on its own quota", () => {
    let s = rich(replay([created]), 5000);
    s = apply(s, vacation(T0 + H, 14), vacation(T0 + 15 * DAY, 14));
    s = apply(s, ev("RestStarted", T0 + 30 * DAY, { kind: "closed_door", oath: CLOSED_DOOR_OATH, until: T0 + 44 * DAY }));
    expect(s.rest?.kind).toBe("closed_door");
  });

  it("prices every shop gear realm", () => {
    for (const realm of GEAR_REALMS) {
      expect(shopPrice("armor", realm, RULES_V1, "robe")).toBe(shopPrice("armor", realm) / 2);
      expect(RULES_V1.rest.vacationGoldPerDay[realm]).toBeGreaterThan(0);
    }
  });
});
