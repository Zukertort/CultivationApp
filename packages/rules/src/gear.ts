/**
 * Base gear (Roadmap part 2; rulings 137-158): one armor and one weapon slot,
 * a stash for gear not worn, free robes on first entering each realm, shop
 * gear, selling and repairs, and durability.
 *
 * Stats are fixed per realm and kind and never change: a breakthrough doesn't
 * level gear up, and damage doesn't weaken it until it breaks at 100%. Gear
 * of the current or a lower realm can be worn, never a higher realm's.
 *
 * Damage (rulings 147, 166): the companion's daily damage hits every armor
 * worn at any point that local day; a failure's 20% hits one item worn at
 * the deadline, armor or weapon, a deterministic pick (an FNV-1a hash of the
 * tribulation and its failure count). Nothing else damages gear: passing
 * never does, and the weapon doesn't wear with use. With no armor worn all
 * day, the companion's damage takes Qi and gold instead (ruling 154). No
 * event carries damage; replay derives it.
 *
 * Legendary items (Roadmap part 4; ruling 176): a legendary outcome gives the
 * legendary armor or weapon of its realm (Foundation's when rolled in Qi
 * Condensation), named from the realm's pool. The slot is rolled by the
 * server and stored in the event; older events get it from a hash of the
 * event id. Soul drops and the roulette give at most one each per 365
 * rolling days; other hits pay gold instead.
 */
import type { EventOf, GearSlot } from "@cultivation/schema";
import { GEAR_REALMS, REALMS, RULES_V1, type GearKind, type GearRealm, type Realm, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { violate } from "./errors.js";
import { DAY } from "./time.js";

export const FULL_DURABILITY_BP = 10_000;
const SLOTS: readonly GearSlot[] = ["armor", "weapon"];

export interface GearItem {
  id: string;
  slot: GearSlot;
  kind: GearKind;
  /** The realm whose stats it has; it can be worn in this realm and above. */
  realm: GearRealm;
  /** Damage in basis points of durability; it breaks at 10,000. */
  damageBp: number;
  obtainedAt: number;
  /** A legendary item's name from its realm's pool (cosmetic; ruling 176). */
  name?: string;
  /** A legendary item's source; `step` names the level-up or breakthrough that gave it, which a repent removes (ruling 103). */
  source?: { kind: LegendarySource; step?: number };
}

/** Where a legendary item came from (ruling 176). */
export type LegendarySource = "step" | "class" | "roulette" | "soul";

/** Sources capped at one legendary item per `legendaryCapDays` rolling days (ruling 176). */
export type CappedSource = Extract<LegendarySource, "roulette" | "soul">;

/** A legendary hit: the item given, or the gold paid instead when its source was capped. */
export interface LegendaryRecord {
  at: number;
  source: LegendarySource;
  /** The item given; null when the cap paid gold instead. */
  itemId: string | null;
  realm: GearRealm;
  slot: GearSlot;
  /** Gold paid instead (capped hits only). */
  gold: number;
}

/**
 * Legendary pools (ruling 121): two named armors and two named weapons per
 * realm. The names are cosmetic; every legendary of a realm and slot has the
 * same stats. Picked by a hash of the event key, never stored.
 */
export const LEGENDARY_NAMES: Record<GearRealm, Record<GearSlot, readonly [string, string]>> = {
  foundation_establishment: { armor: ["Cloudstep Vestment", "Jade Dew Robe"], weapon: ["Morning Frost Sword", "Pine Needle Spear"] },
  core_formation: { armor: ["Golden Core Mantle", "Amber Scale Armor"], weapon: ["Sunforge Saber", "Golden Crane Halberd"] },
  nascent_soul: { armor: ["Azure Soul Raiment", "Tidal Mirror Plate"], weapon: ["Azure Dragon Glaive", "Starfall Sword"] },
  spirit_realm: { armor: ["Verdant Spirit Shroud", "Thousand-Leaf Armor"], weapon: ["Spirit Willow Whip", "Emerald Thunder Blade"] },
};

export type GearLossReason = "broken" | "repent" | "soul" | "death";

export interface GearState {
  /** Every item held, worn or in the stash. */
  items: Record<string, GearItem>;
  /** The item worn in each slot; every other held item is in the stash. */
  worn: Record<GearSlot, string | null>;
  /** Realms whose free robe was given (once per lifetime, ruling 139). */
  robesGranted: GearRealm[];
  /** Every armor worn at any point in the current local day: the companion's midnight damage hits each (ruling 147). */
  armorWornToday: string[];
  /** Items lost: broken at 100%, taken by a repent, a soul drop or death. */
  lost: { at: number; item: GearItem; reason: GearLossReason }[];
  /** Gold spent and earned on gear, for the simulator and the app. */
  gold: { bought: number; repaired: number; sold: number };
  /** What the companion's damage took with no armor worn (ruling 154). */
  unarmored: { qi: number; gold: number; days: number };
  /** Every legendary hit, given or paid as gold, oldest first (ruling 176). */
  legendary: LegendaryRecord[];
  /** When each capped source last gave a legendary item (ruling 176). */
  legendaryLastAt: Record<CappedSource, number | null>;
}

export function initialGear(): GearState {
  return {
    items: {},
    worn: { armor: null, weapon: null },
    robesGranted: [],
    armorWornToday: [],
    lost: [],
    gold: { bought: 0, repaired: 0, sold: 0 },
    unarmored: { qi: 0, gold: 0, days: 0 },
    legendary: [],
    legendaryLastAt: { roulette: null, soul: null },
  };
}

const realmIndex = (r: Realm) => REALMS.indexOf(r);

/** 32-bit FNV-1a: a stable, pure hash for the failure's pick (ruling 166). */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function isGearRealm(r: Realm): r is GearRealm {
  return (GEAR_REALMS as readonly Realm[]).includes(r);
}

// ---- Lookups ----------------------------------------------------------------

export function wornItem(state: CultivatorState, slot: GearSlot): GearItem | null {
  const id = state.gear.worn[slot];
  return id === null ? null : (state.gear.items[id] ?? null);
}

export function stash(state: CultivatorState): GearItem[] {
  const worn = new Set(Object.values(state.gear.worn));
  return Object.values(state.gear.items).filter((i) => !worn.has(i.id));
}

/** Qi and gold an armor takes off a tribulation failure (ruling 142). */
export function armorStats(item: Pick<GearItem, "kind" | "realm">, rules: RulesConfig = RULES_V1): { qi: number; gold: number } {
  return rules.gear.armor[item.kind][item.realm];
}

/** Qi and gold the worn armor takes off a tribulation failure (ruling 142). */
export function armorReduction(state: CultivatorState, rules: RulesConfig = RULES_V1): { qi: number; gold: number } {
  const a = wornItem(state, "armor");
  return a ? armorStats(a, rules) : { qi: 0, gold: 0 };
}

/** The worn weapon's share of the additive Qi pool (ruling 143). */
export function weaponQiBonus(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  const w = wornItem(state, "weapon");
  return w && w.kind !== "robe" ? rules.gear.weapon[w.kind][w.realm] : 0;
}

/** What buying costs: the shop gear's price, or a robe's value (half the realm's shop armor; ruling 157). */
export function shopPrice(slot: GearSlot, realm: GearRealm, rules: RulesConfig = RULES_V1, kind: "shop" | "robe" = "shop"): number {
  return kind === "robe" ? itemValue({ kind, slot, realm }, rules) : rules.gear.shopGold[slot][realm];
}

/** An item's value (ruling 155): its kind's factor (robe half, legendary double) times its realm's shop price for the slot. */
export function itemValue(item: Pick<GearItem, "kind" | "slot" | "realm">, rules: RulesConfig = RULES_V1): number {
  return rules.gear.valueFactor[item.kind] * rules.gear.shopGold[item.slot][item.realm];
}

/** What selling an item pays (rulings 155, 157): 70% of its value, less its damage's share; robes included. */
export function sellPrice(item: GearItem, rules: RulesConfig = RULES_V1): number {
  return rules.gear.sellShare * itemValue(item, rules) * (1 - item.damageBp / FULL_DURABILITY_BP);
}

/**
 * A full repair costs 10% of the Foundation value of the same kind and slot,
 * prorated by its damage, in every realm (rulings 155, 172): a recurring cost
 * stays a fixed share of a flat income while one-time prices double.
 */
export function repairPrice(item: GearItem, rules: RulesConfig = RULES_V1): number {
  const base = itemValue({ kind: item.kind, slot: item.slot, realm: "foundation_establishment" }, rules);
  return (rules.gear.repairShare * base * item.damageBp) / FULL_DURABILITY_BP;
}

/**
 * Qi and gold the companion's damage takes on a day with no armor worn
 * (ruling 154): more than repairing that damage would cost, based on
 * Foundation's shop armor in every realm (ruling 172), so it stays a fixed
 * share of income.
 */
export function unarmoredLoss(bp: number, rules: RulesConfig = RULES_V1): { qi: number; gold: number } {
  const repair = (rules.gear.repairShare * itemValue({ kind: "shop", slot: "armor", realm: "foundation_establishment" }, rules) * bp) / FULL_DURABILITY_BP;
  const loss = rules.gear.unarmoredLossFactor * repair;
  return { qi: loss, gold: loss };
}

/** Can this item be worn now: its realm is the current one or lower. */
export function wearable(state: CultivatorState, item: GearItem): boolean {
  return realmIndex(item.realm) <= realmIndex(state.main.realm);
}

// ---- Changes ----------------------------------------------------------------

/** Add an item: worn if its slot is empty and it can be worn, else into the stash. */
function addItem(s: CultivatorState, item: GearItem): void {
  s.gear.items[item.id] = item;
  if (s.gear.worn[item.slot] === null && wearable(s, item)) s.gear.worn[item.slot] = item.id;
}

function removeItem(s: CultivatorState, id: string, at: number, reason: GearLossReason): void {
  const g = s.gear;
  const item = g.items[id];
  if (!item) return;
  for (const slot of SLOTS) if (g.worn[slot] === id) g.worn[slot] = null;
  delete g.items[id];
  g.lost.push({ at, item, reason });
}

/** Damage one item; at 100% it breaks and is lost (ruling 144). */
function damage(s: CultivatorState, id: string, bp: number, at: number): void {
  const item = s.gear.items[id];
  if (!item || bp <= 0) return;
  item.damageBp = Math.min(FULL_DURABILITY_BP, item.damageBp + bp);
  if (item.damageBp >= FULL_DURABILITY_BP) removeItem(s, id, at, "broken");
}

function noteWornArmor(s: CultivatorState): void {
  const id = s.gear.worn.armor;
  if (id !== null && !s.gear.armorWornToday.includes(id)) s.gear.armorWornToday.push(id);
}

/**
 * After every event: give the current realm's free robe on first entering it
 * (ruling 139), move worn gear of a higher realm to the stash (after a
 * repent, ruling 138), and note the worn armor for tonight's damage (ruling 147).
 */
export function syncGear(s: CultivatorState, at: number): void {
  if (!s.created) return;
  const g = s.gear;
  for (const slot of SLOTS) {
    const item = wornItem(s, slot);
    if (item && !wearable(s, item)) g.worn[slot] = null;
  }
  const realm = s.main.realm;
  if (isGearRealm(realm) && !g.robesGranted.includes(realm)) {
    g.robesGranted.push(realm);
    // While dead nothing is given (ruling 106); entering a realm while dead doesn't happen, but stay safe.
    if (s.progress.diedAt === null) addItem(s, { id: `robe:${realm}`, slot: "armor", kind: "robe", realm, damageBp: 0, obtainedAt: at });
  }
  noteWornArmor(s);
}

/**
 * At a local midnight: after a day without rest, the companion damages every
 * armor worn at any point that day and still held (ruling 147); the weapon
 * isn't hit. With no armor worn all day, it takes Qi and gold instead,
 * floored at the balances (ruling 154), except in Qi Condensation, where
 * gear doesn't exist yet. It keeps going while dead. Then the day's list
 * starts again from the armor worn now.
 */
export function gearMidnight(s: CultivatorState, midnight: number, rested: boolean, rules: RulesConfig): void {
  const g = s.gear;
  const bp = rules.gear.companionDamageBp[s.companion.tier];
  if (!rested && bp > 0) {
    for (const id of g.armorWornToday) damage(s, id, bp, midnight);
    const realm = s.main.realm;
    if (g.armorWornToday.length === 0 && isGearRealm(realm) && s.created) {
      const loss = unarmoredLoss(bp, rules);
      const qi = Math.min(s.qi, loss.qi);
      const gold = Math.min(s.gold, loss.gold);
      s.qi -= qi;
      s.gold -= gold;
      g.unarmored.qi += qi;
      g.unarmored.gold += gold;
      g.unarmored.days += 1;
    }
  }
  g.armorWornToday = [];
  noteWornArmor(s);
}

/** The worn item a failure's 20% hits (ruling 166): one of the worn armor and weapon, picked by the tribulation and its failure count; null with nothing worn. */
export function failurePick(state: CultivatorState, tribulationId: string, failures: number): string | null {
  const ids = SLOTS.map((slot) => state.gear.worn[slot]).filter((id): id is string => id !== null);
  return ids.length === 0 ? null : ids[fnv1a(`${tribulationId}|${failures}`) % ids.length]!;
}

/**
 * A tribulation failure (rulings 142, 147, 166): the worn armor takes its Qi
 * and gold off the ruling 80 loss, then one worn item (armor or weapon,
 * `failurePick`) takes the failure's damage. With nothing worn, neither
 * applies. Gear events settle overdue failures first, so the gear worn when
 * a failure is applied is the gear worn at its deadline.
 */
export function gearOnFailure(s: CultivatorState, tribulationId: string, failures: number, loss: { qi: number; gold: number }, at: number, rules: RulesConfig): { qi: number; gold: number } {
  const a = armorReduction(s, rules);
  const reduced = { qi: Math.max(0, loss.qi - a.qi), gold: Math.max(0, loss.gold - a.gold) };
  const id = failurePick(s, tribulationId, failures);
  if (id !== null) damage(s, id, rules.gear.failureDamageBp, at);
  return reduced;
}

/**
 * Repent penalties and soul "lose item" drops take from the stash, least
 * valuable (by sell price) first, never worn gear (rulings 145, 146).
 * Returns how many were taken.
 */
export function loseStashItems(s: CultivatorState, n: number, at: number, rules: RulesConfig, reason: "repent" | "soul"): number {
  return loseStash(s, n, at, rules, reason, false);
}

/**
 * Repent penalties take legendary gear from the stash after scales, least
 * valuable first, never worn (rulings 112, 145); soul drops never take it.
 */
export function loseStashLegendaries(s: CultivatorState, n: number, at: number, rules: RulesConfig): number {
  return loseStash(s, n, at, rules, "repent", true);
}

/** A repent removes the legendary item the repented step gave, worn or in the stash (ruling 103); sold or broken, nothing. */
export function removeStepLegendary(s: CultivatorState, step: number, at: number): void {
  for (const item of Object.values(s.gear.items)) {
    if (item.source?.kind === "step" && item.source.step === step) removeItem(s, item.id, at, "repent");
  }
}

function loseStash(s: CultivatorState, n: number, at: number, rules: RulesConfig, reason: "repent" | "soul", legendary: boolean): number {
  const items = stash(s)
    .filter((i) => (i.kind === "legendary") === legendary)
    .sort((a, b) => sellPrice(a, rules) - sellPrice(b, rules) || a.obtainedAt - b.obtainedAt);
  const taken = items.slice(0, Math.max(0, n));
  for (const i of taken) removeItem(s, i.id, at, reason);
  return taken.length;
}

/** Death takes worn gear too; the avatar is left in ordinary clothes (ruling 145). */
export function loseAllGear(s: CultivatorState, at: number): void {
  for (const id of Object.keys(s.gear.items)) removeItem(s, id, at, "death");
}

// ---- Legendary items --------------------------------------------------------

/** The server's roll for a legendary item's slot: u in [0, 1), armor below one half (ruling 176). */
export function legendarySlotOutcome(u: number): GearSlot {
  if (!(u >= 0 && u < 1)) throw new RangeError("u must be in [0, 1)");
  return u < 0.5 ? "armor" : "weapon";
}

/** The slot stored in the event, else (events from before part 4) one picked by a hash of the event key. */
export function legendarySlot(key: string, stored: GearSlot | undefined): GearSlot {
  return stored ?? (fnv1a(`${key}|slot`) % 2 === 0 ? "armor" : "weapon");
}

/** The realm whose legendary a roll in `realm` gives: its own, or Foundation's in Qi Condensation (ruling 176). */
export function legendaryRealm(realm: Realm): GearRealm {
  return isGearRealm(realm) ? realm : "foundation_establishment";
}

/** The pool name for a legendary item, by a hash of its event key (cosmetic). */
export function legendaryName(key: string, realm: GearRealm, slot: GearSlot): string {
  const pool = LEGENDARY_NAMES[realm][slot];
  return pool[fnv1a(`${key}|name`) % pool.length]!;
}

/** Legendary items held, worn or in the stash. */
export function legendaryItems(state: CultivatorState): GearItem[] {
  return Object.values(state.gear.items).filter((i) => i.kind === "legendary");
}

/** Is a capped source inside its window at `at` (ruling 176)? */
export function legendaryCapped(state: CultivatorState, source: CappedSource, at: number, rules: RulesConfig = RULES_V1): boolean {
  const last = state.gear.legendaryLastAt[source];
  return last !== null && at - last < rules.gear.legendaryCapDays * DAY;
}

/** When a capped source can give a legendary item again; null when it can now. */
export function legendaryCapEndsAt(state: CultivatorState, source: CappedSource, at: number, rules: RulesConfig = RULES_V1): number | null {
  const last = state.gear.legendaryLastAt[source];
  return last !== null && legendaryCapped(state, source, at, rules) ? last + rules.gear.legendaryCapDays * DAY : null;
}

export interface LegendaryGrant {
  /** A unique key for the hit: the event id, plus an index when one event holds several. */
  key: string;
  at: number;
  /** The realm the roll belongs to: the step's realm, the claimed tribulation's, or the current one. */
  realm: Realm;
  slot: GearSlot | undefined;
  source: LegendarySource;
  step?: number;
  /** For capped sources: pays the gold due instead inside the window and returns it. */
  goldInstead?: () => number;
}

/**
 * A legendary outcome (ruling 176): the legendary armor or weapon of its
 * realm, worn if the slot is empty and it is wearable, else into the stash.
 * Soul drops and the roulette give at most one item each per rolling
 * `legendaryCapDays`; other hits inside the window pay their gold instead.
 * While dead nothing is given (ruling 106). Returns the item, or null.
 */
export function grantLegendary(s: CultivatorState, g: LegendaryGrant, rules: RulesConfig): GearItem | null {
  if (s.progress.diedAt !== null) return null;
  const realm = legendaryRealm(g.realm);
  const slot = legendarySlot(g.key, g.slot);
  const record: LegendaryRecord = { at: g.at, source: g.source, itemId: null, realm, slot, gold: 0 };
  const capped = g.source === "roulette" || g.source === "soul" ? g.source : null;
  if (capped !== null && legendaryCapped(s, capped, g.at, rules)) {
    record.gold = g.goldInstead?.() ?? 0;
    s.gear.legendary.push(record);
    return null;
  }
  if (capped !== null) s.gear.legendaryLastAt[capped] = g.at;
  const id = `legendary:${g.key}`;
  if (s.gear.items[id]) violate("duplicate_gear", `gear ${id} already exists`);
  const item: GearItem = {
    id,
    slot,
    kind: "legendary",
    realm,
    damageBp: 0,
    obtainedAt: g.at,
    name: legendaryName(g.key, realm, slot),
    source: g.step === undefined ? { kind: g.source } : { kind: g.source, step: g.step },
  };
  addItem(s, item);
  record.itemId = id;
  s.gear.legendary.push(record);
  return item;
}

// ---- Handlers ---------------------------------------------------------------

/** The realm whose gear a purchase is for: the one named, else the current realm (ruling 165). */
function purchaseRealm(s: CultivatorState, named: GearRealm | undefined): GearRealm {
  if (named) return named;
  const realm = s.main.realm;
  if (!isGearRealm(realm)) violate("gear_realm_required", "in Qi Condensation, name the realm whose gear to buy; it is worn from that realm on");
  return realm;
}

function getItem(s: CultivatorState, id: string): GearItem {
  const item = s.gear.items[id];
  if (!item) violate("unknown_gear", `no gear ${id} is held`);
  return item;
}

/** While dead nothing is bought, sold or repaired, and nothing pays (rulings 106, 150). */
function alive(s: CultivatorState, what: string): void {
  if (s.progress.diedAt !== null) violate("dead", `nothing can be ${what} while the avatar is dead`);
}

function spend(s: CultivatorState, gold: number): void {
  if (s.gold < gold) violate("insufficient_gold", `this costs ${Math.ceil(gold)} gold`);
  s.gold -= gold;
}

/** Buy any realm's shop gear or robe, in any realm (rulings 140, 157, 165): worn if the slot is empty and it is wearable, else into the stash. */
export function onGearBought(s: CultivatorState, e: EventOf<"GearBought">, rules: RulesConfig): void {
  alive(s, "bought");
  const realm = purchaseRealm(s, e.realm);
  if (s.gear.items[e.id]) violate("duplicate_gear", `gear ${e.id} already exists`);
  const kind = e.kind ?? "shop";
  if (kind === "robe" && e.slot !== "armor") violate("robe_is_armor", "a robe is armor; there is no robe weapon");
  const price = shopPrice(e.slot, realm, rules, kind);
  spend(s, price);
  s.gear.gold.bought += price;
  addItem(s, { id: e.id, slot: e.slot, kind, realm, damageBp: 0, obtainedAt: e.at });
}

/** Wear an item from the stash; the one in its slot goes to the stash. Only gear of the current realm or lower (ruling 138). */
export function onGearEquipped(s: CultivatorState, e: EventOf<"GearEquipped">): void {
  const item = getItem(s, e.itemId);
  if (s.gear.worn[item.slot] === item.id) violate("already_worn", "this item is already worn");
  if (!wearable(s, item)) violate("gear_realm_too_high", "gear of a higher realm can't be worn");
  s.gear.worn[item.slot] = item.id;
}

export function onGearUnequipped(s: CultivatorState, e: EventOf<"GearUnequipped">): void {
  if (s.gear.worn[e.slot] === null) violate("slot_empty", `nothing is worn as ${e.slot}`);
  s.gear.worn[e.slot] = null;
}

/** Sell an item from the stash for 70% of its value less damage (rulings 155, 157), robes included. Worn gear is taken off first. */
export function onGearSold(s: CultivatorState, e: EventOf<"GearSold">, rules: RulesConfig): void {
  alive(s, "sold");
  const item = getItem(s, e.itemId);
  if (Object.values(s.gear.worn).includes(item.id)) violate("gear_worn", "take the item off before selling it");
  const price = sellPrice(item, rules);
  delete s.gear.items[item.id];
  s.gold += price;
  s.gear.gold.sold += price;
}

/** Repair an item fully, worn or in the stash, for 10% of its value prorated by damage (rulings 144, 155). */
export function onGearRepaired(s: CultivatorState, e: EventOf<"GearRepaired">, rules: RulesConfig): void {
  alive(s, "repaired");
  const item = getItem(s, e.itemId);
  if (item.damageBp <= 0) violate("nothing_to_repair", "this item has no damage");
  const price = repairPrice(item, rules);
  spend(s, price);
  s.gear.gold.repaired += price;
  item.damageBp = 0;
}

// ---- Projections ------------------------------------------------------------

/** Held items at or above the warning line (95% damage), for the avatar's warning and push (ruling 144). */
export function gearWarnings(state: CultivatorState, rules: RulesConfig = RULES_V1): GearItem[] {
  return Object.values(state.gear.items).filter((i) => i.damageBp >= rules.gear.warnAtBp);
}
