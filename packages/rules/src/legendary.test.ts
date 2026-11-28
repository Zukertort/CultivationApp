/**
 * Legendary items (Roadmap part 4; rulings 176-180): legendary gear from
 * level-ups and breakthroughs, the Unique class roll, the roulette and
 * Rainbow soul drops; the 365-day cap on the repeatable sources; repents,
 * death and selling; legendary class wearables.
 */
import { describe, expect, it } from "vitest";
import { OATH_TEXT, REPENT_OATH, TRIBULATION_OATH, parseEvent, type ClassId, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  GEAR_REALMS,
  LEGENDARY_NAMES,
  RULES_V1,
  RuleViolation,
  applyEvent,
  breakthroughRollSlot,
  classDropRoll,
  goldMultiplier,
  itemValue,
  rouletteSlot,
  soulDropSlot,
  legendaryCapEndsAt,
  legendaryItems,
  legendaryName,
  legendarySlot,
  legendarySlotOutcome,
  pendingBreakthroughRolls,
  repairPrice,
  sellPrice,
  shopPrice,
  stash,
  wearableLegendaryOutcome,
  wornItem,
  type CultivatorState,
} from "./index.js";
import { strictReplay as replay } from "./test-support.js";

// Day 0 = Monday 2026-11-02 00:00 in Buenos Aires (UTC-3).
const T0 = Date.UTC(2026, 10, 2, 3);
const H = 60 * 60 * 1000;
let seq = 0;
const ev = <T extends GameEvent["type"]>(type: T, at: number, rest: Omit<Extract<GameEvent, { type: T }>, "id" | "userId" | "at" | "type">, id = `L${++seq}`) =>
  ({ id, userId: "u1", at, type, ...rest }) as unknown as GameEvent;

const created = ev("CultivatorCreated", T0, { name: "Ricardo", tzOffsetMinutes: -180, oath: OATH_TEXT });
const interview = ev("InterviewAnswered", T0, { interests: { main: "Mathematics", body: "BJJ", soul: "Calm" } });
const decide = (path: "main" | "body" | "soul", choice: string, at = T0 + H) => ev("AreaDecided", at, { path, choice });
const overrides = (n: number, cls: ClassId = "monk") => Array.from({ length: n }, (_, i) => ev("RealmOverride", T0 + i + 1, { class: cls }));
const declare = (id: string, at: number, days = 300) => ev("TribulationDeclared", at, { tribulationId: id, title: id, criteria: `Pass ${id}`, deadline: at + days * DAY });
const claim = (id: string, at: number, extra: object = {}) => ev("TribulationClaimed", at, { tribulationId: id, oath: TRIBULATION_OATH, llmReview: "skipped", ...extra } as never);
const complete = (id: string, at: number) => ev("TribulationCompleted", at, { tribulationId: id });
const rolled = (step: number, at: number, slot?: "armor" | "weapon", id?: string) => ev("BreakthroughRolled", at, { step, item: "legendary", ...(slot ? { slot } : {}) }, id);
const spin = (at: number, slot?: "armor" | "weapon", id?: string) => ev("RouletteSpun", at, { prize: "legendary", ...(slot ? { slot } : {}) } as never, id);
const repent = (at: number, faked: string[]) => ev("Repented", at, { oath: REPENT_OATH, faked });
const sell = (itemId: string, at: number) => ev("GearSold", at, { itemId });
const unequip = (slot: "armor" | "weapon", at: number) => ev("GearUnequipped", at, { slot });
const wear = (wearable: "soul" | "pet_keep" | "pet_halo", at: number, legendary = false, demonId?: string) =>
  ev("WearableUsed", at, { wearable, ...(legendary ? { legendary: true } : {}), ...(demonId ? { demonId } : {}) } as never);

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
const rich = (s: CultivatorState, qi = 10_000, gold = 1000): CultivatorState => ({ ...s, qi, gold });
const lastStep = (s: CultivatorState) => s.progress.steps.at(-1)!.step;
const legendaryIds = (s: CultivatorState) => legendaryItems(s).map((i) => i.id);

/** Qi Condensation, mid: one area decided, its level-up's roll pending (2%). */
const qcMid = () => replay([created, interview, decide("main", "Mathematics")]);
/** Just broken through into Foundation by the lock: the white robe worn, the breakthrough's roll pending (5%). */
const foundation = () => apply(replay([created, interview, decide("main", "Mathematics"), decide("body", "BJJ"), decide("soul", "Calm")]), ev("AreasLocked", T0 + 2 * H, {}));
/** Core Formation by override, five tribulations passed and completed: Nascent Soul entered by a breakthrough. */
function honestNascent(): CultivatorState {
  let s = rich(replay([created, interview, ...overrides(8)]));
  const set = ["a", "b", "c", "d", "e"];
  for (const id of set) s = apply(s, declare(id, T0 + H));
  return apply(s, ...set.flatMap((id, k) => [claim(id, T0 + (1 + k) * DAY), complete(id, T0 + (1 + k) * DAY)]));
}
/** At Lion with golden tickets, in Foundation. */
const withTickets = (s: CultivatorState, n: number): CultivatorState => ({ ...s, goldenTickets: n });
/** Rainbow soul with a demon whose positive task is "d+". */
const rainbow = (): CultivatorState => {
  const s = apply(foundation(), ev("HeartDemonCreated", T0 + 3 * H, { demonId: "d", name: "Doubt", positiveTasks: [{ taskId: "d+", name: "Journal" }], negativeTasks: [] }));
  return { ...s, soul: { ...s.soul, color: "rainbow" } };
};
const soulTask = (at: number, drop: string, slot?: "armor" | "weapon", id?: string) => ev("SoulTaskLogged", at, { taskId: "d+", drop, ...(slot ? { legendarySlot: slot } : {}) } as never, id);

describe("legendary gear from level-ups and breakthroughs (ruling 176)", () => {
  it("gives the realm entered's legendary, worn if the slot is empty, else into the stash", () => {
    const s = foundation();
    const step = lastStep(s);
    expect(pendingBreakthroughRolls(s).map((p) => p.step)).toContain(step);
    // The white robe is worn, so a legendary armor goes to the stash; a weapon is worn at once.
    const armor = apply(s, rolled(step, T0 + 3 * H, "armor", "ba"));
    const a = armor.gear.items["legendary:ba"]!;
    expect(a).toMatchObject({ kind: "legendary", slot: "armor", realm: "foundation_establishment", source: { kind: "step", step } });
    expect(LEGENDARY_NAMES.foundation_establishment.armor).toContain(a.name);
    expect(wornItem(armor, "armor")!.id).toBe("robe:foundation_establishment");
    expect(stash(armor).map((i) => i.id)).toEqual(["legendary:ba"]);
    const weapon = apply(s, rolled(step, T0 + 3 * H, "weapon", "bw"));
    expect(wornItem(weapon, "weapon")!.id).toBe("legendary:bw");
    expect(weapon.gear.legendary).toEqual([{ at: T0 + 3 * H, source: "step", itemId: "legendary:bw", realm: "foundation_establishment", slot: "weapon", gold: 0 }]);
  });

  it("gives Foundation's legendary for a Qi Condensation level-up, into the stash (not wearable yet)", () => {
    const s = apply(qcMid(), rolled(1, T0 + 2 * H, "weapon", "qc"));
    expect(s.gear.items["legendary:qc"]).toMatchObject({ realm: "foundation_establishment", slot: "weapon" });
    expect(s.gear.worn.weapon).toBeNull();
    // Worn from Foundation on.
    const f = apply(s, decide("body", "BJJ", T0 + 3 * H), decide("soul", "Calm", T0 + 3 * H), ev("AreasLocked", T0 + 4 * H, {}), ev("GearEquipped", T0 + 5 * H, { itemId: "legendary:qc" }));
    expect(wornItem(f, "weapon")!.id).toBe("legendary:qc");
  });

  it("uses the stored slot, else a stable hash of the event id for events from before part 4", () => {
    expect(legendarySlotOutcome(0)).toBe("armor");
    expect(legendarySlotOutcome(0.4999)).toBe("armor");
    expect(legendarySlotOutcome(0.5)).toBe("weapon");
    expect(() => legendarySlotOutcome(1)).toThrow(RangeError);
    expect(legendarySlot("x", "weapon")).toBe("weapon");
    const slots = new Set(Array.from({ length: 40 }, (_, i) => legendarySlot(`old${i}`, undefined)));
    expect(slots).toEqual(new Set(["armor", "weapon"])); // both slots occur
    expect(legendarySlot("old7", undefined)).toBe(legendarySlot("old7", undefined)); // and replay gives the same
    const old = apply(foundation(), rolled(lastStep(foundation()), T0 + 3 * H, undefined, "pre-part-4"));
    expect(old.gear.items["legendary:pre-part-4"]!.slot).toBe(legendarySlot("pre-part-4", undefined));
    expect(old.gear.items["legendary:pre-part-4"]!.name).toBe(legendaryName("pre-part-4", "foundation_establishment", legendarySlot("pre-part-4", undefined)));
  });

  it("is uncapped: every milestone's legendary is given", () => {
    let s = qcMid();
    s = apply(s, rolled(1, T0 + 2 * H, "armor"), decide("body", "BJJ", T0 + 3 * H));
    s = apply(s, rolled(lastStep(s), T0 + 3 * H, "armor"));
    expect(legendaryItems(s)).toHaveLength(2);
  });

  it("is never bought: GearBought has no legendary kind", () => {
    expect(() => parseEvent({ id: "x", userId: "u1", at: T0, type: "GearBought", slot: "armor", kind: "legendary" })).toThrow();
  });
});

describe("stats, durability, repairs and selling (rulings 138, 155, 171, 172)", () => {
  it("keeps the ladder: legendary(R) under shop(R+1), armor and weapon", () => {
    for (let i = 0; i + 1 < GEAR_REALMS.length; i++) {
      const r = GEAR_REALMS[i]!;
      const next = GEAR_REALMS[i + 1]!;
      expect(RULES_V1.gear.armor.legendary[r].qi).toBeLessThan(RULES_V1.gear.armor.shop[next].qi);
      expect(RULES_V1.gear.armor.legendary[r].qi).toBeGreaterThan(RULES_V1.gear.armor.robe[next].qi);
      expect(RULES_V1.gear.weapon.legendary[r]).toBeLessThan(RULES_V1.gear.weapon.shop[next]);
    }
  });

  it("sells for 70% of double the shop price less damage, and repairs at 10% of Foundation's legendary value", () => {
    const s = apply(foundation(), rolled(lastStep(foundation()), T0 + 3 * H, "armor", "sa"));
    const item = s.gear.items["legendary:sa"]!;
    expect(itemValue(item)).toBe(2 * shopPrice("armor", "foundation_establishment"));
    expect(sellPrice(item)).toBeCloseTo(0.7 * 168, 9);
    const damaged = { ...item, damageBp: 5000 };
    expect(sellPrice(damaged)).toBeCloseTo(0.7 * 168 * 0.5, 9);
    expect(repairPrice(damaged)).toBeCloseTo(0.1 * 168 * 0.5, 9);
    const sold = apply(s, sell("legendary:sa", T0 + 4 * H));
    expect(sold.gold - s.gold).toBeCloseTo(117.6, 9);
    expect(legendaryItems(sold)).toEqual([]);
  });

  it("breaks like other gear: a broken legendary is lost", () => {
    const s = apply(foundation(), rolled(lastStep(foundation()), T0 + 3 * H, "armor", "br"), unequip("armor", T0 + 4 * H), ev("GearEquipped", T0 + 4 * H, { itemId: "legendary:br" }));
    // The Turtle damages worn armor 5% a night: 20 nights break it.
    const later = apply(s, ev("BodyActivityDefined", T0 + 22 * DAY, { activityId: "x", name: "x", kind: "exercise" }));
    expect(later.gear.items["legendary:br"]).toBeUndefined();
    expect(later.gear.lost.at(-1)).toMatchObject({ reason: "broken", item: { id: "legendary:br", kind: "legendary" } });
  });
});

describe("the 365-day cap on the roulette and soul drops (ruling 176)", () => {
  it("roulette: one legendary item per 365 rolling days, the gold prize inside the window, again at the window's end", () => {
    let s = withTickets(foundation(), 4);
    s = apply(s, spin(T0 + DAY, "armor", "r1"));
    expect(legendaryIds(s)).toEqual(["legendary:r1"]);
    const gold = s.gold;
    s = apply(s, spin(T0 + 2 * DAY, "weapon", "r2"));
    expect(legendaryIds(s)).toEqual(["legendary:r1"]);
    expect(s.gold - gold).toBeCloseTo(RULES_V1.roulette.goldPrize * goldMultiplier(s), 9);
    expect(s.gear.legendary.at(-1)).toMatchObject({ source: "roulette", itemId: null });
    expect(legendaryCapEndsAt(s, "roulette", T0 + 2 * DAY)).toBe(T0 + DAY + 365 * DAY);
    // One millisecond before the window ends: still gold. At its end: an item.
    s = apply(s, spin(T0 + DAY + 365 * DAY - 1, "armor", "r3"));
    expect(legendaryIds(s)).toEqual(["legendary:r1"]);
    s = apply(s, spin(T0 + DAY + 365 * DAY, "armor", "r4"));
    expect(legendaryIds(s).sort()).toEqual(["legendary:r1", "legendary:r4"]);
    expect(legendaryCapEndsAt(s, "roulette", T0 + DAY + 365 * DAY)).toBe(T0 + DAY + 730 * DAY);
  });

  it("soul: Rainbow keeps its 20%, but one item per 365 days; a capped hit pays the gold drop", () => {
    let s = rainbow();
    s = apply(s, soulTask(T0 + 4 * H, "legendary", "weapon", "s1"));
    expect(legendaryIds(s)).toEqual(["legendary:s1"]);
    const gold = s.gold;
    s = apply(s, soulTask(T0 + 5 * H, "legendary", "armor", "s2"));
    expect(legendaryIds(s)).toEqual(["legendary:s1"]);
    expect(s.gold - gold).toBeCloseTo(RULES_V1.soul.drops.gold * goldMultiplier(s), 9);
  });

  it("keeps the two windows apart: a roulette legendary doesn't cap the soul, and milestones and the Unique roll aren't capped", () => {
    let s = withTickets(rainbow(), 1);
    s = apply(s, spin(T0 + 4 * H, "armor", "r1"), soulTask(T0 + 5 * H, "legendary", "armor", "s1"));
    expect(legendaryIds(s).sort()).toEqual(["legendary:r1", "legendary:s1"]);
    s = apply(s, rolled(lastStep(s), T0 + 6 * H, "armor", "b1"));
    expect(legendaryItems(s)).toHaveLength(3);
  });

  it("gives a soul quest's first legendary hit an item and caps the next, each with its own key", () => {
    let s = rainbow();
    s = apply(
      s,
      ev("HeartDemonCreated", T0 + 8 * DAY, { demonId: "e", name: "Fear", positiveTasks: [{ taskId: "e+", name: "Face it" }], negativeTasks: [] }),
    );
    s = { ...s, soul: { ...s.soul, color: "rainbow" } };
    s = apply(s, ev("SoulQuestDefined", T0 + 8 * DAY + H, { questId: "q", name: "Session", demonIds: ["d", "e"] }));
    s = apply(s, ev("SoulQuestCompleted", T0 + 8 * DAY + 2 * H, { questId: "q", drops: ["legendary", "legendary"], legendarySlots: ["weapon", "armor"] } as never, "quest"));
    expect(legendaryIds(s)).toEqual(["legendary:quest"]);
    expect(s.gear.items["legendary:quest"]!.slot).toBe("weapon");
    expect(s.gear.legendary.map((r) => [r.itemId, r.slot])).toEqual([
      ["legendary:quest", "weapon"],
      [null, "armor"],
    ]);
  });

  it("gives nothing while dead, and a dead hit doesn't start the window", () => {
    const s = withTickets(foundation(), 2);
    const dead = { ...s, progress: { ...s.progress, diedAt: T0 + 3 * H } };
    const after = apply(dead, spin(T0 + DAY, "armor"));
    expect(legendaryItems(after)).toEqual([]);
    expect(after.gear.legendaryLastAt.roulette).toBeNull();
  });
});

describe("the Unique class roll (rulings 120, 176)", () => {
  const core = () => rich(apply(replay([created, interview, ...overrides(8)]), declare("a", T0 + H), declare("b", T0 + H)));

  it("gives legendary gear of the claimed tribulation's realm, stored inline or rolled later, uncapped", () => {
    let s = apply(core(), claim("a", T0 + DAY, { classDrop: "legendary", classDropSlot: "armor" }));
    const id = legendaryIds(s)[0]!;
    expect(s.gear.items[id]).toMatchObject({ realm: "core_formation", slot: "armor", source: { kind: "class" } });
    // The next claim, past the 7-day cooldown, rolled later by the server.
    s = apply(s, claim("b", T0 + 9 * DAY));
    const pending = s.class.pendingDrops;
    const eventId = Object.keys(pending)[0]!;
    s = apply(s, ev("ClassDropRolled", T0 + 9 * DAY + 1, { eventId, drop: "legendary", slot: "weapon" }));
    expect(legendaryItems(s).map((i) => [i.realm, i.slot])).toEqual([
      ["core_formation", "armor"],
      ["core_formation", "weapon"],
    ]);
    expect(s.gear.items[`legendary:${eventId}`]).toBeDefined();
  });
});

describe("repents, death and selling (rulings 103, 112, 145)", () => {
  it("removes the repented breakthrough's legendary even if worn; others stay", () => {
    let s = honestNascent();
    const nsStep = lastStep(s);
    s = withTickets(s, 1);
    s = apply(s, rolled(nsStep, T0 + 6 * DAY, "weapon", "ns"), spin(T0 + 6 * DAY + H, "weapon", "rl"));
    expect(wornItem(s, "weapon")!.id).toBe("legendary:ns");
    s = apply(s, repent(T0 + 7 * DAY, ["c"]));
    expect(legendaryIds(s)).toEqual(["legendary:rl"]); // the roulette's stays (the first repent's penalty takes nothing)
    expect(s.gear.worn.weapon).toBeNull();
    expect(s.gear.lost.at(-1)).toMatchObject({ reason: "repent", item: { id: "legendary:ns" } });
  });

  it("exploit attempt: selling the breakthrough's legendary before repenting keeps the gold, and the milestone never rolls again", () => {
    let s = honestNascent();
    const nsStep = lastStep(s);
    s = apply(s, rolled(nsStep, T0 + 6 * DAY, "armor", "ns"));
    const gold = s.gold;
    s = apply(s, sell("legendary:ns", T0 + 6 * DAY + H));
    expect(s.gold - gold).toBeCloseTo(0.7 * 2 * shopPrice("armor", "nascent_soul"), 9);
    const sold = s.gold;
    s = apply(s, repent(T0 + 7 * DAY, ["c"]));
    expect(s.gold).toBeCloseTo(sold, 9); // accepted: the gold stays
    // Re-reaching Nascent Soul earns no roll: once per lifetime (ruling 103).
    s = apply(s, ev("TribulationRescheduled", T0 + 7 * DAY + H, { tribulationId: "c", deadline: T0 + 100 * DAY }), claim("c", T0 + 8 * DAY), complete("c", T0 + 8 * DAY));
    expect(s.main.realm).toBe("nascent_soul");
    expect(pendingBreakthroughRolls(s).some((p) => p.step === lastStep(s))).toBe(false);
  });

  it("repent penalties take stash legendaries after scales, never worn ones", () => {
    let s = withTickets(honestNascent(), 1);
    const mid = s.progress.steps.find((x) => x.kind === "level" && x.realm === "core_formation" && x.level === "mid")!;
    // The mid level-up's legendary armor goes to the stash (a robe is worn); a roulette weapon is worn.
    s = apply(s, rolled(mid.step, T0 + 6 * DAY, "armor", "mid"), spin(T0 + 6 * DAY + 1, "weapon", "rw"));
    for (const robe of stash(s).filter((i) => i.kind === "robe")) s = apply(s, sell(robe.id, T0 + 6 * DAY + 2));
    s = { ...s, inventory: { ...s.inventory, scales: 1 }, progress: { ...s.progress, repents: { nascent_soul: 1 } } };
    // The second repent takes one item: the scale before the legendary (ruling 112).
    const second = apply(s, repent(T0 + 7 * DAY, ["c"]));
    expect(second.inventory.scales).toBe(0);
    expect(legendaryIds(second).sort()).toEqual(["legendary:mid", "legendary:rw"]);
    // The fourth takes the whole inventory and stash, but never worn gear.
    const fourth = apply({ ...s, progress: { ...s.progress, repents: { nascent_soul: 3 } } }, repent(T0 + 7 * DAY, ["c"]));
    expect(legendaryIds(fourth)).toEqual(["legendary:rw"]);
    // Worn when the penalty applied, so kept; then off to the stash, since Nascent Soul gear can't be worn in Core Formation (ruling 138).
    expect(stash(fourth).map((i) => i.id)).toEqual(["legendary:rw"]);
  });

  it("a soul lose-item drop never takes legendary gear", () => {
    let s = apply(withTickets(foundation(), 1), spin(T0 + 3 * H, "armor", "st"));
    s = apply(s, ev("HeartDemonCreated", T0 + 4 * H, { demonId: "d", name: "Doubt", positiveTasks: [], negativeTasks: [{ taskId: "d-", name: "Relapse" }] }));
    s = { ...s, soul: { ...s.soul, color: "violet" } };
    expect(stash(s).map((i) => i.id)).toEqual(["legendary:st"]);
    const lost = apply(s, ev("SoulTaskLogged", T0 + 5 * H, { taskId: "d-", drop: "lose_item" } as never));
    expect(legendaryIds(lost)).toEqual(["legendary:st"]);
  });

  it("death takes worn legendaries too (ruling 145)", () => {
    let s = honestNascent();
    s = withTickets(s, 1);
    s = apply(s, spin(T0 + 6 * DAY, "weapon", "worn"));
    expect(wornItem(s, "weapon")!.id).toBe("legendary:worn");
    // The fifth repent in a realm kills the avatar.
    s = { ...s, progress: { ...s.progress, repents: { nascent_soul: 4 } } };
    s = apply(s, repent(T0 + 7 * DAY, ["c"]));
    expect(s.progress.diedAt).not.toBeNull();
    expect(legendaryItems(s)).toEqual([]);
    expect(s.gear.worn).toEqual({ armor: null, weapon: null });
  });
});

describe("legendary class wearables (ruling 177)", () => {
  const demonEv = ev("HeartDemonCreated", T0, { demonId: "d", name: "Impatience", positiveTasks: [{ taskId: "breathe", name: "Breathe" }], negativeTasks: [] });
  const withClass = (cls: ClassId) => rich(replay([created, interview, demonEv, ...overrides(8, cls)]));
  const core = (cls: ClassId) => apply(withClass(cls), declare("a", T0 + 2 * H), declare("b", T0 + 2 * H));

  it("rolls 10% of wearable drops legendary; events without the flag stay ordinary", () => {
    expect(wearableLegendaryOutcome(0.0999)).toBe(true);
    expect(wearableLegendaryOutcome(0.1)).toBe(false);
    const s = apply(core("bard"), claim("a", T0 + DAY, { classDrop: "soul_wearable", classDropLegendary: true }));
    expect(s.inventory).toMatchObject({ soulWearables: 0, legendarySoulWearables: 1 });
    expect(s.class.legendaryWearables).toBe(1);
    const old = apply(core("bard"), claim("a", T0 + DAY, { classDrop: "soul_wearable" }));
    expect(old.inventory).toMatchObject({ soulWearables: 1, legendarySoulWearables: 0 });
    // A Unique class's legendary item is gear, never a legendary wearable.
    const monk = apply(core("monk"), claim("a", T0 + DAY, { classDrop: "legendary", classDropLegendary: true }));
    expect(monk.class.legendaryWearables).toBe(0);
  });

  it("soul: freezes the demon for 7 days and adds 50% to every damage dealt to it meanwhile, never to heals", () => {
    let s = apply(core("bard"), claim("a", T0 + DAY, { classDrop: "soul_wearable", classDropLegendary: true }));
    expect(code(() => applyEvent(s, wear("soul", T0 + DAY + H)))).toBe("no_wearable"); // no ordinary one held
    s = apply(s, wear("soul", T0 + DAY + H, true, "d"));
    const hp = s.soul.demons.d!.hp;
    s = apply(s, ev("SoulTaskLogged", T0 + DAY + 2 * H, { taskId: "breathe" }));
    expect(hp - s.soul.demons.d!.hp).toBeCloseTo(RULES_V1.soul.positiveDamage * 1.5, 9);
    expect(s.soul.demons.d!.frozenUntil).toBe(T0 + DAY + H + 7 * DAY);
    const before = s.soul.demons.d!.hp;
    s = apply(s, ev("SoulTaskLogged", T0 + 9 * DAY, { taskId: "breathe" }));
    expect(before - s.soul.demons.d!.hp).toBeLessThan(RULES_V1.soul.positiveDamage * 1.01); // after the 7 days: plain damage (growth may add a little)
  });

  it("pet keep: keeps the tier for 30 days and adds 5% to the gold pool meanwhile; one keep at a time", () => {
    let s = apply(core("warrior"), claim("a", T0 + DAY, { classDrop: "pet_keep", classDropLegendary: true }));
    const m0 = goldMultiplier(s);
    s = apply(s, wear("pet_keep", T0 + DAY + H, true));
    expect(goldMultiplier(s)).toBeCloseTo(m0 + 0.05, 9);
    expect(s.companion.tierKeptUntil).toBe(T0 + DAY + H + 30 * DAY);
    s = { ...s, inventory: { ...s.inventory, petKeepWearables: 1 } };
    expect(code(() => applyEvent(s, wear("pet_keep", T0 + 2 * DAY)))).toBe("already_active");
    const later = apply(s, ev("BodyActivityDefined", T0 + 32 * DAY, { activityId: "x", name: "x", kind: "exercise" }));
    expect(goldMultiplier(later)).toBeCloseTo(m0, 9);
  });

  it("pet halo: a ticket worth +15% on the next legendary roll", () => {
    let s = apply(qcMid(), ev("BreakthroughRolled", T0 + 2 * H, { step: 1, item: "none" }));
    s = { ...s, inventory: { ...s.inventory, legendaryPetHaloWearables: 1 } };
    s = apply(s, wear("pet_halo", T0 + 3 * H, true));
    expect(s.haloTickets).toEqual([{ grantedAt: T0 + 3 * H, expiresAt: T0 + 3 * H + 90 * DAY, bonus: 0.15 }]);
    s = apply(s, decide("body", "BJJ", T0 + 4 * H));
    expect(pendingBreakthroughRolls(s).at(-1)!.chance).toBeCloseTo(0.02 + 0.15, 9);
  });

  it("is forfeited at a class change and lost after the ordinary ones", () => {
    let s = apply(core("bard"), claim("a", T0 + DAY, { classDrop: "soul_wearable", classDropLegendary: true }));
    s = { ...s, inventory: { ...s.inventory, soulWearables: 1, gainPotions: 0 } };
    const changed = apply(s, ev("ClassChosen", T0 + 2 * DAY, { class: "erudite" }));
    expect(changed.inventory).toMatchObject({ soulWearables: 0, legendarySoulWearables: 0 });
    expect(changed.class.history.at(-1)!.forfeited).toBe(2);
  });
});

describe("the server's rolls (ruling 176)", () => {
  it("derives the slot and the legendary flag from where u landed inside its band, with no extra draw", () => {
    expect(breakthroughRollSlot(0.2, 0.05)).toBe("armor");
    expect(breakthroughRollSlot(0.2, 0.15)).toBe("weapon");
    expect(breakthroughRollSlot(0.2, 0.3)).toBeUndefined();
    expect(rouletteSlot(0.981)).toBe("armor");
    expect(rouletteSlot(0.9895)).toBe("weapon");
    expect(rouletteSlot(0.1)).toBeUndefined();
    expect(soulDropSlot("rainbow", "positive", 0.45, RULES_V1)).toBe("armor");
    expect(soulDropSlot("rainbow", "positive", 0.55, RULES_V1)).toBe("weapon");
    expect(soulDropSlot("rainbow", "positive", 0.2, RULES_V1)).toBeUndefined();
    expect(classDropRoll("soul", 0.5, 0.04)).toEqual({ drop: "soul_wearable", legendary: true });
    expect(classDropRoll("soul", 0.5, 0.06)).toEqual({ drop: "soul_wearable", legendary: false });
    expect(classDropRoll("body", 0.5, 0.26)).toEqual({ drop: "pet_halo", legendary: true });
    expect(classDropRoll("hybrid", 0.5, 0.38)).toEqual({ drop: "pet_halo", legendary: true });
    expect(classDropRoll("unique", 0.02, 0.005)).toEqual({ drop: "legendary", slot: "armor" });
    expect(classDropRoll("unique", 0.02, 0.5)).toEqual({ drop: "none" });
  });

  it("makes about 10% of wearable drops legendary across u", () => {
    for (const group of ["soul", "body", "hybrid"] as const) {
      let wearables = 0;
      let legendary = 0;
      for (let i = 0; i < 10_000; i++) {
        const r = classDropRoll(group, 0.5, i / 10_000);
        if (r.drop === "none") continue;
        wearables += 1;
        if (r.legendary) legendary += 1;
      }
      expect(legendary / wearables).toBeCloseTo(0.1, 2);
    }
  });
});
