import { describe, expect, it } from "vitest";
import { OATH_TEXT, REPENT_OATH, TRIBULATION_OATH, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  GEAR_REALMS,
  RULES_V1,
  RuleViolation,
  advanceTo,
  applyEvent,
  armorAtRisk,
  armorCare,
  armorReduction,
  armorRiskAlerts,
  bestStashArmor,
  failureQiLoss,
  gearAlerts,
  gearWarnings,
  itemValue,
  mainQiMultiplier,
  pushAlertPlan,
  qiMultiplier,
  repairPrice,
  replay,
  sellPrice,
  stash,
  tribulationDeletePrice,
  unarmoredLoss,
  weaponQiBonus,
  wornItem,
  type CultivatorState,
  type GearItem,
} from "./index.js";

// Day 0 = Monday 2026-11-02 00:00 in Buenos Aires (UTC-3).
const T0 = Date.UTC(2026, 10, 2, 3);
const H = 60 * 60 * 1000;
let seq = 0;
const ev = <T extends GameEvent["type"]>(type: T, at: number, rest: Omit<Extract<GameEvent, { type: T }>, "id" | "userId" | "at" | "type">, id = `g${++seq}`) =>
  ({ id, userId: "u1", at, type, ...rest }) as unknown as GameEvent;

const created = ev("CultivatorCreated", T0, { name: "Ricardo", tzOffsetMinutes: -180, oath: OATH_TEXT });
/** `n` overrides from Qi Condensation: 4 reach Foundation, 8 Core Formation, 12 Nascent Soul. */
const climb = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ev("RealmOverride", T0 + from + i, { class: "monk" }));
const repent = (at: number) => ev("Repented", at, { oath: REPENT_OATH, faked: [] });
const buy = (slot: "armor" | "weapon", at: number, id: string) => ev("GearBought", at, { slot }, id);
const equip = (itemId: string, at: number) => ev("GearEquipped", at, { itemId });
const unequip = (slot: "armor" | "weapon", at: number) => ev("GearUnequipped", at, { slot });
const sell = (itemId: string, at: number) => ev("GearSold", at, { itemId });
const repair = (itemId: string, at: number) => ev("GearRepaired", at, { itemId });

const WHITE = "robe:foundation_establishment";
const YELLOW = "robe:core_formation";
const BLUE = "robe:nascent_soul";

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
const foundation = () => replay([created, ...climb(4)]);
const damageOf = (s: CultivatorState, id: string) => s.gear.items[id]?.damageBp;

describe("robes and slots (rulings 137-139)", () => {
  it("wears ordinary clothes in Qi Condensation: no gear and nothing to buy (ruling 140)", () => {
    const s = rich(replay([created]));
    expect(s.gear.items).toEqual({});
    expect(code(() => applyEvent(s, buy("armor", T0 + H, "a")))).toBe("gear_before_foundation");
  });

  it("gives the white robe on entering Foundation, worn", () => {
    const s = foundation();
    expect(wornItem(s, "armor")).toMatchObject({ id: WHITE, kind: "robe", realm: "foundation_establishment", damageBp: 0 });
    expect(s.gear.robesGranted).toEqual(["foundation_establishment"]);
  });

  it("puts a new realm's robe in the stash when armor is worn: a breakthrough doesn't change worn gear (ruling 138)", () => {
    let s = replay([created, ...climb(8)]);
    expect(wornItem(s, "armor")?.id).toBe(WHITE);
    expect(stash(s).map((i) => i.id)).toEqual([YELLOW]);
    s = apply(s, equip(YELLOW, T0 + H));
    expect(wornItem(s, "armor")?.id).toBe(YELLOW);
    expect(stash(s).map((i) => i.id)).toEqual([WHITE]);
    // Lower-realm gear can be worn.
    s = apply(s, equip(WHITE, T0 + 2 * H));
    expect(wornItem(s, "armor")?.id).toBe(WHITE);
    expect(code(() => applyEvent(s, equip(WHITE, T0 + 3 * H)))).toBe("already_worn");
    expect(code(() => applyEvent(s, equip("nope", T0 + 3 * H)))).toBe("unknown_gear");
  });

  it("moves higher-realm gear to the stash after a repent, can't wear it, and never gives that robe again (exploit)", () => {
    let s = replay([created, ...climb(12)]);
    s = apply(s, equip(BLUE, T0 + H));
    s = apply(s, repent(T0 + 2 * H));
    expect(s.main.realm).toBe("core_formation");
    expect(wornItem(s, "armor")).toBeNull();
    expect(stash(s).map((i) => i.id)).toContain(BLUE);
    expect(code(() => applyEvent(s, equip(BLUE, T0 + 3 * H)))).toBe("gear_realm_too_high");
    // Back into Nascent Soul: no second blue robe.
    s = apply(s, ...climb(4, 3 * H));
    expect(s.main.realm).toBe("nascent_soul");
    expect(Object.keys(s.gear.items).filter((id) => id === BLUE)).toHaveLength(1);
    expect(s.gear.robesGranted).toEqual(["foundation_establishment", "core_formation", "nascent_soul"]);
  });
});

describe("shop, stash and selling (rulings 137, 140)", () => {
  it("buys the current realm's gear: worn if the slot is empty, else into the stash", () => {
    let s = rich(foundation(), 0, 500);
    s = apply(s, buy("weapon", T0 + H, "w1"), buy("armor", T0 + 2 * H, "a1"));
    expect(s.gold).toBe(500 - 100 - 80);
    expect(wornItem(s, "weapon")).toMatchObject({ id: "w1", kind: "shop", realm: "foundation_establishment" });
    expect(wornItem(s, "armor")?.id).toBe(WHITE);
    expect(stash(s).map((i) => i.id)).toEqual(["a1"]);
    expect(code(() => applyEvent(rich(s, 0, 79), buy("armor", T0 + 3 * H, "a2")))).toBe("insufficient_gold");
  });

  it("sells only from the stash, for 70% of the value less damage; buying to sell always loses gold (exploit)", () => {
    let s = rich(foundation(), 0, 200);
    s = apply(s, buy("weapon", T0 + H, "w1"));
    expect(code(() => applyEvent(s, sell("w1", T0 + 2 * H)))).toBe("gear_worn");
    s = apply(s, unequip("weapon", T0 + 2 * H), sell("w1", T0 + 3 * H));
    expect(s.gold).toBeCloseTo(200 - 100 + 70);
    expect(s.gear.items.w1).toBeUndefined();
    const legendary: GearItem = { id: "l", slot: "weapon", kind: "legendary", realm: "core_formation", damageBp: 2500, obtainedAt: 0 };
    expect(itemValue(legendary)).toBe(400);
    expect(sellPrice(legendary)).toBeCloseTo(0.7 * 400 * 0.75);
    expect(code(() => applyEvent(s, unequip("weapon", T0 + 4 * H)))).toBe("slot_empty");
  });

  it("free robes can't be sold, so breakthroughs don't mint gold (exploit)", () => {
    const s = apply(replay([created, ...climb(8)]), unequip("armor", T0 + H));
    expect(sellPrice(s.gear.items[YELLOW]!)).toBe(0);
    expect(code(() => applyEvent(s, sell(YELLOW, T0 + 2 * H)))).toBe("robe_not_sellable");
    expect(code(() => applyEvent(s, sell(WHITE, T0 + 2 * H)))).toBe("robe_not_sellable");
  });

  it("no item sells for more than it costs, in any realm, kind or slot (exploit)", () => {
    for (const realm of GEAR_REALMS) {
      for (const slot of ["armor", "weapon"] as const) {
        for (const kind of ["robe", "shop", "legendary"] as const) {
          const item: GearItem = { id: "i", slot, kind, realm, damageBp: 0, obtainedAt: 0 };
          // Shop gear is what can be bought; legendary gear only drops, and selling it is its value.
          if (kind === "shop") expect(sellPrice(item)).toBeLessThan(RULES_V1.gear.shopGold[slot][realm]);
          expect(sellPrice(item)).toBeLessThanOrEqual(0.7 * itemValue(item));
        }
      }
    }
  });
});

describe("stats (rulings 138, 142, 143)", () => {
  it("keeps the ladder robe(R) < shop(R) < robe(R+1) < legendary(R) < shop(R+1), for armor Qi and gold, and weapons", () => {
    const a = RULES_V1.gear.armor;
    const w = RULES_V1.gear.weapon;
    for (const stat of ["qi", "gold"] as const) {
      const ladder = GEAR_REALMS.flatMap((r, i) => {
        const next = GEAR_REALMS[i + 1];
        return [a.robe[r][stat], a.shop[r][stat], ...(next ? [a.robe[next][stat], a.legendary[r][stat]] : [a.legendary[r][stat]])];
      });
      // Each realm's robe appears twice (as the next realm's robe and then its own); drop the repeats.
      const steps = ladder.filter((v, i) => i === 0 || i % 4 !== 0);
      for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]!);
    }
    GEAR_REALMS.forEach((r, i) => {
      expect(w.legendary[r]).toBeGreaterThan(w.shop[r]);
      const next = GEAR_REALMS[i + 1];
      if (next) expect(w.legendary[r]).toBeLessThan(w.shop[next]);
    });
    // Armor never takes the whole failure gold.
    for (const r of GEAR_REALMS) expect(a.legendary[r].gold).toBeLessThan(RULES_V1.tribulations.failure.gold);
  });

  it("adds a worn weapon to the additive Qi pool, Main and every other Qi gain", () => {
    let s = rich(foundation(), 0, 500);
    expect(qiMultiplier(s)).toBe(1);
    s = apply(s, buy("weapon", T0 + H, "w1"));
    expect(weaponQiBonus(s)).toBe(0.02);
    expect(qiMultiplier(s)).toBeCloseTo(1.02);
    expect(mainQiMultiplier(s)).toBeCloseTo(1.02);
    s = apply(s, unequip("weapon", T0 + 2 * H));
    expect(qiMultiplier(s)).toBe(1);
  });
});

describe("failures with gear (rulings 142, 147, 148)", () => {
  const declare = (at = T0 + H, deadline = T0 + H + 2 * DAY) =>
    ev("TribulationDeclared", at, { tribulationId: "x", title: "Pass the exam", criteria: "Score at least 80", deadline });

  it("worn armor lowers the Qi and gold a failure takes, and takes the failure's 20% damage", () => {
    const s = advanceTo(apply(rich(foundation(), 100, 100), declare()), T0 + 3 * DAY + 1);
    // Foundation's next threshold is 250: the loss is 62.5 Qi and 45 gold, less the white robe's 8 and 4.
    expect(s.qi).toBeCloseTo(100 - 54.5);
    expect(s.gold).toBeCloseTo(100 - 41);
    // Two Turtle midnights (5% each), then at the third the failure (20%) and the Turtle again.
    expect(damageOf(s, WHITE)).toBe(500 + 500 + 2000 + 500);
  });

  it("with no armor worn, the full loss applies and the failure damages nothing (ruling 142)", () => {
    const s = advanceTo(apply(rich(foundation(), 100, 100), unequip("armor", T0 + 10), declare()), T0 + 3 * DAY + 1);
    // Days 1 and 2 had no armor, so the companion took Qi and gold instead (ruling 154).
    const day = unarmoredLoss("foundation_establishment", 500);
    expect(s.qi).toBeCloseTo(100 - 62.5 - 2 * day.qi);
    expect(s.gold).toBeCloseTo(100 - 45 - 2 * day.gold);
    // Only day 0's Turtle damage, since the robe was worn that day (ruling 147).
    expect(damageOf(s, WHITE)).toBe(500);
  });

  it("the weapon never takes failure damage", () => {
    const s = advanceTo(apply(rich(foundation(), 100, 500), buy("weapon", T0 + 5, "w1"), unequip("armor", T0 + 10), declare()), T0 + 3 * DAY + 1);
    expect(damageOf(s, "w1")).toBe(0);
  });

  it("the armor worn at the deadline takes the failure: swapping after the deadline doesn't move it (exploit)", () => {
    // The deadline passes at T0 + H + 2 days; a gear event later that day applies the failure first.
    let s = apply(rich(foundation(), 100, 500), buy("armor", T0 + 5, "a1"), declare());
    const deadline = T0 + H + 2 * DAY;
    s = apply(s, equip("a1", deadline + H));
    expect(s.tribulations.items.x!.status).toBe("failed");
    // The white robe took the 20% and its 8 Qi off; the shop armor took nothing from the failure.
    expect(damageOf(s, WHITE)).toBe(500 + 500 + 2000);
    expect(damageOf(s, "a1")).toBe(0);
    expect(s.qi).toBeCloseTo(100 - 54.5);
  });

  it("an armored cultivator ends above the 75% line by the armor's Qi on a failure (ruling 147)", () => {
    // 1,000 Qi at Foundation (threshold 250): the loss brings Qi to 187.5, and the robe keeps 8 more.
    const s = advanceTo(apply(rich(foundation(), 1000, 100), declare()), T0 + 3 * DAY + 1);
    expect(s.qi).toBeCloseTo(187.5 + 8);
    const bare = advanceTo(apply(rich(foundation(), 1000, 100), unequip("armor", T0 + 10), declare()), T0 + 3 * DAY + 1);
    // The failure brings it to 187.5; the companion then takes that night's unarmored loss.
    expect(bare.qi).toBeCloseTo(187.5 - unarmoredLoss("foundation_establishment", 500).qi);
  });

  it("doesn't lower deletions or late edits, which stay above a failure (ruling 93)", () => {
    const s = apply(rich(foundation(), 100, 100), declare());
    const price = tribulationDeletePrice(s, "x", T0 + 2 * H);
    expect(price.qi).toBeCloseTo(failureQiLoss(s) * 1.02);
    const after = apply(s, ev("TribulationDeleted", T0 + 2 * H, { tribulationId: "x" }));
    expect(after.qi).toBeCloseTo(100 - 62.5 * 1.02);
    expect(after.gold).toBeCloseTo(100 - 45 * 1.02);
  });

  it("keeps full effect until the item breaks: damage never weakens a stat", () => {
    const s = foundation();
    const worn = structuredClone(s);
    worn.gear.items[WHITE]!.damageBp = 9900;
    expect(armorReduction(worn)).toEqual(armorReduction(s));
  });
});

describe("durability (rulings 144, 147)", () => {
  it("the Turtle damages the worn armor 5% a midnight; it warns at 95% and breaks at 100%, lost", () => {
    const s = foundation();
    const day19 = advanceTo(s, T0 + 19 * DAY + 1);
    expect(damageOf(day19, WHITE)).toBe(9500);
    expect(gearWarnings(day19).map((i) => i.id)).toEqual([WHITE]);
    const day20 = advanceTo(day19, T0 + 20 * DAY + 1);
    expect(day20.gear.items[WHITE]).toBeUndefined();
    expect(day20.gear.worn.armor).toBeNull();
    expect(day20.gear.lost).toMatchObject([{ item: { id: WHITE }, reason: "broken" }]);
  });

  it("with no armor worn all day, the companion takes Qi and gold instead, more than the repair would cost (ruling 154)", () => {
    const s = rich(apply(foundation(), unequip("armor", T0 + 10)), 100, 100);
    const after = advanceTo(s, T0 + 2 * DAY + 1);
    const day = unarmoredLoss("foundation_establishment", 500);
    // Day 0 had the robe on; day 1 had none.
    expect(after.qi).toBeCloseTo(100 - day.qi);
    expect(after.gold).toBeCloseTo(100 - day.gold);
    expect(after.gear.unarmored).toMatchObject({ days: 1 });
    // It costs more than repairing that damage on any base armor of the realm.
    for (const realm of GEAR_REALMS) {
      const loss = unarmoredLoss(realm, 500);
      for (const kind of ["robe", "shop"] as const) expect(loss.gold).toBeGreaterThan(repairPrice({ id: "i", slot: "armor", kind, realm, damageBp: 500, obtainedAt: 0 }));
    }
    // Floored at the balances, never debt.
    const broke = advanceTo(rich(s, 0, 0), T0 + 2 * DAY + 1);
    expect([broke.qi, broke.gold, broke.main.debt.qi]).toEqual([0, 0, 0]);
  });

  it("takes nothing in Qi Condensation, at Lion or on rest days without armor (ruling 154)", () => {
    const qc = rich(replay([created]), 100, 100);
    expect(advanceTo(qc, T0 + 5 * DAY + 1).qi).toBe(100);
    const lion = structuredClone(rich(apply(foundation(), unequip("armor", T0 + 10)), 100, 100));
    lion.companion.tier = "lion";
    lion.companion.food = 2500;
    expect(advanceTo(lion, T0 + 5 * DAY + 1).qi).toBe(100);
    const rest = rich(apply(foundation(), unequip("armor", T0 + 10), ev("RestStarted", T0 + H, { kind: "closed_door", until: T0 + 5 * DAY + H })), 100, 100);
    expect(advanceTo(rest, T0 + 6 * DAY + 1).qi).toBe(100);
  });

  it("takes no damage on days with rest, and none at Lion", () => {
    const s = apply(foundation(), ev("RestStarted", T0 + H, { kind: "closed_door", until: T0 + 5 * DAY + H }));
    expect(damageOf(advanceTo(s, T0 + 6 * DAY + 1), WHITE)).toBe(0);
    expect(damageOf(advanceTo(s, T0 + 7 * DAY + 1), WHITE)).toBe(500);
    const lion = structuredClone(foundation());
    lion.companion.tier = "lion";
    lion.companion.food = 2500;
    expect(damageOf(advanceTo(lion, T0 + 3 * DAY + 1), WHITE)).toBe(0);
  });

  it("the companion never damages the weapon or armor left in the stash all day", () => {
    const s = advanceTo(apply(rich(foundation(), 0, 500), buy("weapon", T0 + H, "w1"), buy("armor", T0 + 2 * H, "a1")), T0 + 3 * DAY + 1);
    expect(damageOf(s, WHITE)).toBe(3 * 500);
    expect(damageOf(s, "w1")).toBe(0);
    expect(damageOf(s, "a1")).toBe(0);
  });

  it("taking armor off before midnight doesn't dodge the damage (exploit)", () => {
    let s = apply(foundation(), unequip("armor", T0 + 22 * H));
    s = advanceTo(s, T0 + DAY + 1);
    expect(damageOf(s, WHITE)).toBe(500);
    // Off all the next day: no damage that night.
    s = advanceTo(s, T0 + 2 * DAY + 1);
    expect(damageOf(s, WHITE)).toBe(500);
  });

  it("every armor worn during the day takes the damage: swapping costs damage on each", () => {
    let s = apply(rich(foundation(), 0, 500), buy("armor", T0 + H, "a1"), equip("a1", T0 + 2 * H), equip(WHITE, T0 + 3 * H));
    s = advanceTo(s, T0 + DAY + 1);
    expect(damageOf(s, WHITE)).toBe(500);
    expect(damageOf(s, "a1")).toBe(500);
    // The next day only the white robe is worn.
    s = advanceTo(s, T0 + 2 * DAY + 1);
    expect(damageOf(s, WHITE)).toBe(1000);
    expect(damageOf(s, "a1")).toBe(500);
  });

  it("the weapon wears on each Qi gain it boosts, by the task's effort; its bonus stays whole", () => {
    const task = (taskId: string, effort: "quick" | "session" | "day" | "project", at: number) =>
      ev("MainTaskDefined", at, { taskId, name: taskId, difficulty: "mid", effort, schedule: { kind: "once", deadline: at + 10 * DAY } });
    const done = (taskId: string, at: number) => ev("MainTaskCompleted", at, { taskId });
    let s = apply(rich(foundation(), 0, 500), buy("weapon", T0 + H, "w1"));
    s = apply(s, task("q", "quick", T0 + 2 * H), done("q", T0 + 3 * H));
    expect(damageOf(s, "w1")).toBe(RULES_V1.gear.weaponWearBp.quick);
    s = apply(s, task("p", "project", T0 + 4 * H), done("p", T0 + 5 * H));
    expect(damageOf(s, "w1")).toBe(RULES_V1.gear.weaponWearBp.quick + RULES_V1.gear.weaponWearBp.project);
    expect(weaponQiBonus(s)).toBe(0.02);
    // Without a weapon worn nothing wears.
    const bare = apply(s, unequip("weapon", T0 + 6 * H), task("d", "day", T0 + 7 * H), done("d", T0 + 8 * H));
    expect(damageOf(bare, "w1")).toBe(damageOf(s, "w1"));
  });

  it("other Qi gains (the Lion, soul drops, the roulette) wear the weapon as `other`", () => {
    const lion = structuredClone(apply(rich(foundation(), 0, 500), buy("weapon", T0 + H, "w1")));
    lion.companion.tier = "lion";
    lion.companion.food = 2500;
    const s = apply(lion, ev("CompanionPetted", T0 + 2 * H, {}));
    expect(damageOf(s, "w1")).toBe(RULES_V1.gear.weaponWearBp.other);
  });

  it("repairs fully for 10% of the value prorated by damage; nothing to repair is rejected (ruling 155)", () => {
    let s = rich(advanceTo(foundation(), T0 + 4 * DAY + 1), 0, 100);
    const robe = s.gear.items[WHITE]!;
    expect(robe.damageBp).toBe(2000);
    // The white robe is worth half of Foundation's 80-gold armor.
    expect(repairPrice(robe)).toBeCloseTo(0.1 * 40 * 0.2);
    s = apply(s, repair(WHITE, T0 + 4 * DAY + 2));
    expect(s.gold).toBeCloseTo(100 - 0.8);
    expect(damageOf(s, WHITE)).toBe(0);
    expect(code(() => applyEvent(s, repair(WHITE, T0 + 4 * DAY + 3)))).toBe("nothing_to_repair");
    const broke = structuredClone(s);
    broke.gear.items[WHITE]!.damageBp = 5000;
    expect(code(() => applyEvent(rich(broke, 0, 1), repair(WHITE, T0 + 4 * DAY + 3)))).toBe("insufficient_gold");
    for (const realm of GEAR_REALMS) {
      for (const kind of ["robe", "shop", "legendary"] as const) {
        const item: GearItem = { id: "i", slot: "armor", kind, realm, damageBp: 10_000, obtainedAt: 0 };
        expect(repairPrice(item)).toBeLessThanOrEqual(0.1 * itemValue(item));
      }
    }
  });

  it("pricing rule: a full repair of any item costs less than a failure's Qi and gold in its realm", () => {
    const minFailureQi = { foundation_establishment: 250, core_formation: 550, nascent_soul: 1500, spirit_realm: 1500 } as const;
    for (const realm of GEAR_REALMS) {
      for (const kind of ["robe", "shop", "legendary"] as const) {
        const item: GearItem = { id: "i", slot: "armor", kind, realm, damageBp: 10_000, obtainedAt: 0 };
        const failure = RULES_V1.realms.failureShare * minFailureQi[realm] + RULES_V1.tribulations.failure.gold;
        expect(repairPrice(item)).toBeLessThan(failure);
      }
    }
  });

  it("pushes at the reminder time on the day the armor reaches 95% (ruling 144)", () => {
    const s = structuredClone(foundation());
    s.gear.items[WHITE]!.damageBp = 9000;
    expect(gearAlerts(s, 14 * DAY)).toEqual([{ itemId: WHITE, at: T0 + DAY }]);
    const plan = pushAlertPlan(s, s.clock);
    expect(plan.find((a) => a.kind === "gear_breaking")).toMatchObject({ itemId: WHITE, at: T0 + DAY + 9 * H });
  });
});

describe("armor at risk before a deadline (ruling 149)", () => {
  const declare = (deadline: number) => ev("TribulationDeclared", T0 + H, { tribulationId: "x", title: "Pass", criteria: "Score 80", deadline });

  it("the avatar's care line from 50% damage, in the app only (ruling 153)", () => {
    const s = structuredClone(foundation());
    s.gear.items[WHITE]!.damageBp = 4900;
    expect(armorCare(s)).toBeNull();
    s.gear.items[WHITE]!.damageBp = 5000;
    expect(armorCare(s)?.id).toBe(WHITE);
    // No push for it: the first gear push is the 95% one, at the 9th Turtle midnight.
    const gearPushes = pushAlertPlan(s, s.clock).filter((a) => a.itemId !== undefined);
    expect(gearPushes.every((a) => a.kind === "gear_breaking" && a.at >= T0 + 9 * DAY)).toBe(true);
  });

  it("warns when the damage plus a failure plus the companion's damage until then would reach 100% (ruling 153)", () => {
    // On the deadline day (due 23:00): one Turtle midnight (5%) plus the failure (20%), so the line is 75%.
    const declared = apply(foundation(), declare(T0 + 2 * DAY + 23 * H));
    const today = structuredClone(advanceTo(declared, T0 + 2 * DAY + H));
    today.gear.items[WHITE]!.damageBp = 7400;
    expect(armorAtRisk(today)).toBeNull();
    today.gear.items[WHITE]!.damageBp = 7500;
    expect(armorAtRisk(today)).toMatchObject({ item: { id: WHITE }, tribulationId: "x" });
    // Two days earlier: three Turtle midnights, so 65%; at Lion it stays 80%.
    const later = structuredClone(declared);
    later.gear.items[WHITE]!.damageBp = 6500;
    expect(armorAtRisk(later)?.deadline).toBe(T0 + 2 * DAY + 23 * H);
    later.companion.tier = "lion";
    later.companion.food = 2500;
    expect(armorAtRisk(later)).toBeNull();
    later.gear.items[WHITE]!.damageBp = 8000;
    expect(armorAtRisk(later)).not.toBeNull();
    // More than 72 hours out: no warning yet.
    const far = structuredClone(apply(foundation(), declare(T0 + 10 * DAY)));
    far.gear.items[WHITE]!.damageBp = 9000;
    expect(armorAtRisk(far)).toBeNull();
  });

  it("pushes 72 hours before a deadline whose failure would break the armor", () => {
    const s = structuredClone(apply(foundation(), declare(T0 + 5 * DAY + 23 * H)));
    // Six Turtle midnights (30%) and the failure (20%): 50% now breaks it at the failure.
    s.gear.items[WHITE]!.damageBp = 5000;
    expect(armorRiskAlerts(s, 14 * DAY)).toEqual([{ itemId: WHITE, tribulationId: "x", at: T0 + 2 * DAY + 23 * H }]);
    expect(pushAlertPlan(s, s.clock).find((a) => a.kind === "armor_at_risk")).toMatchObject({ itemId: WHITE, tribulationId: "x" });
    s.gear.items[WHITE]!.damageBp = 4900;
    expect(armorRiskAlerts(s, 14 * DAY)).toEqual([]);
  });

  it("the one-tap swap picks the best wearable stash armor a failure wouldn't break, never a higher realm's", () => {
    let s = rich(replay([created, ...climb(8)]), 0, 1000);
    // Worn: white robe. Stash: yellow robe (Core Formation, 16 Qi).
    expect(bestStashArmor(s)?.id).toBe(YELLOW);
    s = apply(s, buy("armor", T0 + H, "a1"));
    expect(bestStashArmor(s)?.id).toBe("a1");
    // With nothing due soon, the line is a deadline today: 75% at Turtle.
    const worn = structuredClone(s);
    worn.gear.items.a1!.damageBp = 7500;
    expect(bestStashArmor(worn)?.id).toBe(YELLOW);
    worn.gear.items.a1!.damageBp = 7400;
    expect(bestStashArmor(worn)?.id).toBe("a1");
  });
});

describe("repent, death and potions (rulings 145, 150, 151)", () => {
  const atNascent = () => replay([created, ...climb(12)]);

  it("repent penalties take stash gear, least valuable first, never worn gear", () => {
    // Worn: the white robe. Stash: the yellow robe (sells for 20) and the blue one (40).
    let s = apply(atNascent(), repent(T0 + H));
    expect(stash(s).map((i) => i.id).sort()).toEqual([YELLOW, BLUE]);
    s = apply(s, ...climb(4, 2 * H), repent(T0 + 3 * H));
    expect(s.gear.items[YELLOW]).toBeUndefined();
    expect(s.gear.items[BLUE]).toBeDefined();
    expect(wornItem(s, "armor")?.id).toBe(WHITE);
    expect(s.gear.lost).toMatchObject([{ item: { id: YELLOW }, reason: "repent" }]);
  });

  it("death takes worn gear too, leaving ordinary clothes; nothing is bought, sold or repaired while dead", () => {
    let s = atNascent();
    for (let i = 0; i < 5; i++) s = apply(s, repent(T0 + (10 * i + 1) * H), ...(i < 4 ? climb(4, (10 * i + 2) * H) : []));
    expect(s.progress.diedAt).not.toBeNull();
    expect(s.gear.items).toEqual({});
    expect(s.gear.worn).toEqual({ armor: null, weapon: null });
    const rich500 = rich(s, 0, 500);
    expect(code(() => applyEvent(rich500, buy("armor", T0 + 60 * H, "a1")))).toBe("dead");
    // Gear held at death is gone, but a state with stash gear still can't sell or repair it.
    const held = structuredClone(rich500);
    held.gear.items.a1 = { id: "a1", slot: "armor", kind: "shop", realm: "foundation_establishment", damageBp: 1000, obtainedAt: 0 };
    expect(code(() => applyEvent(held, sell("a1", T0 + 62 * H)))).toBe("dead");
    expect(code(() => applyEvent(held, repair("a1", T0 + 62 * H)))).toBe("dead");
  });

  it("a drunk legendary potion is armed for the next realm breakthrough's roll (+5%), one at a time; held ones do nothing", () => {
    let s = structuredClone(replay([created, ev("InterviewAnswered", T0 + 1, { interests: { main: "Math", body: "BJJ", soul: "Calm" } })]));
    s.inventory.legendaryPotions = 2;
    s = apply(s, ...(["main", "body"] as const).map((path, i) => ev("AreaDecided", T0 + 2 + i, { path, choice: "x" })));
    s = apply(s, ev("PotionUsed", T0 + 10, { potion: "legendary" }));
    expect(s.inventory).toMatchObject({ legendaryPotions: 1, legendaryPotionArmed: true });
    expect(code(() => applyEvent(s, ev("PotionUsed", T0 + 11, { potion: "legendary" })))).toBe("potion_active");
    s = apply(s, ev("AreaDecided", T0 + 20, { path: "soul", choice: "x" }), ev("AreasLocked", T0 + H, {}));
    expect(s.main.realm).toBe("foundation_establishment");
    const step = s.progress.steps.at(-1)!;
    expect(step.kind).toBe("breakthrough");
    expect(s.progress.pendingRolls[String(step.step)]?.chance).toBeCloseTo(0.05 + 0.05);
    expect(s.inventory).toMatchObject({ legendaryPotions: 1, legendaryPotionArmed: false });
    // Held but not drunk: the next breakthrough gets no bonus.
    const held = replay([created, ...climb(4)]);
    const heldPotion = structuredClone(held);
    heldPotion.inventory.legendaryPotions = 1;
    const a = apply(heldPotion, ...climb(4, 10 * H));
    const b = apply(held, ...climb(4, 10 * H));
    expect(a.inventory.legendaryPotions).toBe(1);
    expect(a.progress.pendingRolls).toEqual(b.progress.pendingRolls);
    expect(code(() => applyEvent(b, ev("PotionUsed", T0 + 20 * H, { potion: "legendary" })))).toBe("no_potion");
  });
});
