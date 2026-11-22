import { describe, expect, it } from "vitest";
import { OATH_TEXT, REPENT_OATH, TRIBULATION_OATH, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  GEAR_REALMS,
  RULES_V1,
  RuleViolation,
  advanceTo,
  applyEvent,
  armorReduction,
  failureQiLoss,
  gearAlerts,
  gearWarnings,
  mainQiMultiplier,
  pushAlertPlan,
  qiMultiplier,
  repairPrice,
  replay,
  sellPrice,
  stash,
  tribulationDeletePrice,
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

  it("sells only from the stash, for a share of the shop price less damage; buying to sell always loses gold (exploit)", () => {
    let s = rich(foundation(), 0, 200);
    s = apply(s, buy("weapon", T0 + H, "w1"));
    expect(code(() => applyEvent(s, sell("w1", T0 + 2 * H)))).toBe("gear_worn");
    s = apply(s, unequip("weapon", T0 + 2 * H), sell("w1", T0 + 3 * H));
    expect(s.gold).toBe(200 - 100 + 25);
    expect(s.gear.items.w1).toBeUndefined();
    // The white robe sells for a quarter of half of Foundation's armor price.
    const robe = { ...wornItem(s, "armor")!, damageBp: 2000 };
    expect(sellPrice(robe)).toBeCloseTo(0.25 * 0.5 * 80 * 0.8);
    expect(code(() => applyEvent(s, unequip("weapon", T0 + 4 * H)))).toBe("slot_empty");
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

describe("failures with gear (rulings 142, 144)", () => {
  const declare = (at = T0 + H, deadline = T0 + H + 2 * DAY) =>
    ev("TribulationDeclared", at, { tribulationId: "x", title: "Pass the exam", criteria: "Score at least 80", deadline });

  it("worn armor lowers the Qi and gold a failure takes, and one worn item takes 20% damage", () => {
    const s = advanceTo(apply(rich(foundation(), 100, 100), declare()), T0 + 3 * DAY + 1);
    // Foundation's next threshold is 250: the loss is 62.5 Qi and 45 gold, less the white robe's 8 and 4.
    expect(s.qi).toBeCloseTo(100 - 54.5);
    expect(s.gold).toBeCloseTo(100 - 41);
    // Two Turtle midnights (5% each), then at the third the failure (20%) and the Turtle again.
    expect(damageOf(s, WHITE)).toBe(500 + 500 + 2000 + 500);
  });

  it("with nothing worn, the full loss applies and nothing is damaged (ruling 142)", () => {
    const s = advanceTo(apply(rich(foundation(), 100, 100), unequip("armor", T0 + 10), declare()), T0 + 3 * DAY + 1);
    expect(s.qi).toBeCloseTo(100 - 62.5);
    expect(s.gold).toBeCloseTo(100 - 45);
    expect(damageOf(s, WHITE)).toBe(0);
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

describe("durability (ruling 144)", () => {
  it("the Turtle damages a worn item 5% a midnight; it warns at 95% and breaks at 100%, lost", () => {
    const s = foundation();
    const day19 = advanceTo(s, T0 + 19 * DAY + 1);
    expect(damageOf(day19, WHITE)).toBe(9500);
    expect(gearWarnings(day19).map((i) => i.id)).toEqual([WHITE]);
    const day20 = advanceTo(day19, T0 + 20 * DAY + 1);
    expect(day20.gear.items[WHITE]).toBeUndefined();
    expect(day20.gear.worn.armor).toBeNull();
    expect(day20.gear.lost).toMatchObject([{ item: { id: WHITE }, reason: "broken" }]);
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

  it("only worn gear takes damage, and the pick among worn items is a stable pseudo-random choice", () => {
    const run = (userId: string) => {
      const start = rich(replay([created, ...climb(4)].map((e) => ({ ...e, userId }))), 0, 500);
      const bought = apply(start, ...[buy("weapon", T0 + H, "w1"), buy("armor", T0 + 2 * H, "a1")].map((e) => ({ ...e, userId })));
      return advanceTo(bought, T0 + 12 * DAY + 1);
    };
    /** The worn weapon's damage after each of the first 12 midnights. */
    const daily = (userId: string) => {
      const start = rich(replay([created, ...climb(4)].map((e) => ({ ...e, userId }))), 0, 500);
      const bought = apply(start, { ...buy("weapon", T0 + H, "w1"), userId });
      return Array.from({ length: 12 }, (_, d) => damageOf(advanceTo(bought, T0 + (d + 1) * DAY + 1), "w1"));
    };
    const s = run("u1");
    const again = run("u1");
    expect(damageOf(s, WHITE)! + damageOf(s, "w1")!).toBe(12 * 500);
    expect(damageOf(s, WHITE)).toBeGreaterThan(0);
    expect(damageOf(s, "w1")).toBeGreaterThan(0);
    expect(damageOf(s, "a1")).toBe(0);
    expect(s.gear).toEqual(again.gear);
    // Another cultivator gets other picks.
    expect(daily("u2")).not.toEqual(daily("u1"));
  });

  it("repairs fully for the damage's share of the realm's price; nothing to repair is rejected", () => {
    let s = rich(advanceTo(foundation(), T0 + 4 * DAY + 1), 0, 100);
    const robe = s.gear.items[WHITE]!;
    expect(robe.damageBp).toBe(2000);
    expect(repairPrice(robe)).toBeCloseTo(25 * 0.2);
    s = apply(s, repair(WHITE, T0 + 4 * DAY + 2));
    expect(s.gold).toBeCloseTo(95);
    expect(damageOf(s, WHITE)).toBe(0);
    expect(code(() => applyEvent(s, repair(WHITE, T0 + 4 * DAY + 3)))).toBe("nothing_to_repair");
    const broke = structuredClone(s);
    broke.gear.items[WHITE]!.damageBp = 5000;
    expect(code(() => applyEvent(rich(broke, 0, 12), repair(WHITE, T0 + 4 * DAY + 3)))).toBe("insufficient_gold");
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

  it("pushes at the reminder time on the day an item reaches 95% (ruling 144)", () => {
    const s = structuredClone(foundation());
    s.gear.items[WHITE]!.damageBp = 9000;
    expect(gearAlerts(s, 14 * DAY)).toEqual([{ itemId: WHITE, at: T0 + DAY }]);
    const plan = pushAlertPlan(s, s.clock);
    expect(plan.find((a) => a.kind === "gear_breaking")).toMatchObject({ itemId: WHITE, at: T0 + DAY + 9 * H });
  });
});

describe("repent, death and potions (rulings 141, 145)", () => {
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

  it("death takes worn gear too, leaving ordinary clothes; nothing is sold while dead", () => {
    let s = atNascent();
    for (let i = 0; i < 5; i++) s = apply(s, repent(T0 + (10 * i + 1) * H), ...(i < 4 ? climb(4, (10 * i + 2) * H) : []));
    expect(s.progress.diedAt).not.toBeNull();
    expect(s.gear.items).toEqual({});
    expect(s.gear.worn).toEqual({ armor: null, weapon: null });
    // A death that leaves stash gear (bought after dying) still can't sell it.
    s = apply(rich(s, 0, 500), buy("armor", T0 + 60 * H, "a1"), unequip("armor", T0 + 61 * H));
    expect(code(() => applyEvent(s, sell("a1", T0 + 62 * H)))).toBe("dead");
  });

  it("a held legendary potion adds 5% to the next realm breakthrough's legendary roll and is used up there, not at level-ups", () => {
    let s = structuredClone(replay([created, ev("InterviewAnswered", T0 + 1, { interests: { main: "Math", body: "BJJ", soul: "Calm" } })]));
    s.inventory.legendaryPotions = 2;
    s = apply(s, ...(["main", "body", "soul"] as const).map((path, i) => ev("AreaDecided", T0 + 2 + i, { path, choice: "x" })));
    expect(s.inventory.legendaryPotions).toBe(2);
    s = apply(s, ev("AreasLocked", T0 + H, {}));
    expect(s.main.realm).toBe("foundation_establishment");
    const step = s.progress.steps.at(-1)!;
    expect(step.kind).toBe("breakthrough");
    expect(s.progress.pendingRolls[String(step.step)]?.chance).toBeCloseTo(0.05 + 0.05);
    expect(s.inventory.legendaryPotions).toBe(1);
  });
});
