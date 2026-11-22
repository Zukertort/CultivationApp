/**
 * Base gear (Roadmap part 2; rulings 137-152): one armor and one weapon slot,
 * a stash for gear not worn, free robes on first entering each realm, shop
 * gear, selling and repairs, and durability.
 *
 * Stats are fixed per realm and kind and never change: a breakthrough doesn't
 * level gear up, and damage doesn't weaken it until it breaks at 100%. Gear
 * of the current or a lower realm can be worn, never a higher realm's.
 *
 * Damage goes by slot (ruling 147): the companion's daily damage hits every
 * armor worn at any point that local day, a failure's damage hits the armor
 * worn at the deadline, and the weapon wears with use, on each Qi gain it
 * boosts. No event carries damage; replay derives it.
 */
import type { Effort, EventOf, GearSlot } from "@cultivation/schema";
import { GEAR_REALMS, REALMS, RULES_V1, type GearKind, type GearRealm, type Realm, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { violate } from "./errors.js";

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
}

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
}

export function initialGear(): GearState {
  return { items: {}, worn: { armor: null, weapon: null }, robesGranted: [], armorWornToday: [], lost: [], gold: { bought: 0, repaired: 0, sold: 0 } };
}

const realmIndex = (r: Realm) => REALMS.indexOf(r);

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

export function shopPrice(slot: GearSlot, realm: GearRealm, rules: RulesConfig = RULES_V1): number {
  return rules.gear.shopGold[slot][realm];
}

/** What selling an item pays (provisional): a share of its realm's shop price, by kind, less its damage. */
export function sellPrice(item: GearItem, rules: RulesConfig = RULES_V1): number {
  const g = rules.gear;
  return g.sellShare * g.sellKindFactor[item.kind] * g.shopGold[item.slot][item.realm] * (1 - item.damageBp / FULL_DURABILITY_BP);
}

/** A full repair costs its damage's share of the item's realm price (ruling 144); legendary gear costs more. */
export function repairPrice(item: GearItem, rules: RulesConfig = RULES_V1): number {
  const table = item.kind === "legendary" ? rules.gear.repairGold.legendary : rules.gear.repairGold.base;
  return (table[item.realm] * item.damageBp) / FULL_DURABILITY_BP;
}

/** Can this item be worn now: its realm is the current one or lower. */
export function wearable(state: CultivatorState, item: GearItem): boolean {
  return realmIndex(item.realm) <= realmIndex(state.main.realm);
}

/**
 * The stash armor a one-tap swap would wear (ruling 149): wearable, below
 * the risk line (a failure wouldn't break it), the best failure reduction,
 * then the least damaged. Null when there is none.
 */
export function bestStashArmor(state: CultivatorState, rules: RulesConfig = RULES_V1): GearItem | null {
  const options = stash(state).filter((i) => i.slot === "armor" && wearable(state, i) && i.damageBp < rules.gear.riskAtBp);
  options.sort((a, b) => armorStats(b, rules).qi - armorStats(a, rules).qi || a.damageBp - b.damageBp || a.obtainedAt - b.obtainedAt);
  return options[0] ?? null;
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
 * isn't hit. It keeps going while dead. Then the day's list starts again
 * from the armor worn now.
 */
export function gearMidnight(s: CultivatorState, midnight: number, rested: boolean, rules: RulesConfig): void {
  const g = s.gear;
  const bp = rules.gear.companionDamageBp[s.companion.tier];
  if (!rested && bp > 0) for (const id of g.armorWornToday) damage(s, id, bp, midnight);
  g.armorWornToday = [];
  noteWornArmor(s);
}

/**
 * A tribulation failure (rulings 142, 147): the worn armor takes its Qi and
 * gold off the ruling 80 loss, then takes the failure's damage. With no
 * armor worn, neither applies. Gear events settle overdue failures first, so
 * the armor worn when a failure is applied is the armor worn at its deadline.
 */
export function gearOnFailure(s: CultivatorState, loss: { qi: number; gold: number }, at: number, rules: RulesConfig): { qi: number; gold: number } {
  const a = armorReduction(s, rules);
  const reduced = { qi: Math.max(0, loss.qi - a.qi), gold: Math.max(0, loss.gold - a.gold) };
  const id = s.gear.worn.armor;
  if (id !== null) damage(s, id, rules.gear.failureDamageBp, at);
  return reduced;
}

/**
 * The worn weapon wears on each Qi gain it boosts (ruling 147): a Main task
 * by its effort, any other gain as `other`. Its bonus stays whole until it
 * breaks. Nothing pays while dead (ruling 106), so nothing wears.
 */
export function weaponWear(s: CultivatorState, effort: Effort | "other", at: number, rules: RulesConfig): void {
  const id = s.gear.worn.weapon;
  if (id === null || s.progress.diedAt !== null || weaponQiBonus(s, rules) <= 0) return;
  damage(s, id, rules.gear.weaponWearBp[effort], at);
}

/**
 * Repent penalties and soul "lose item" drops take from the stash, least
 * valuable (by sell price) first, never worn gear (rulings 145, 146).
 * Returns how many were taken.
 */
export function loseStashItems(s: CultivatorState, n: number, at: number, rules: RulesConfig, reason: "repent" | "soul"): number {
  const items = stash(s).sort((a, b) => sellPrice(a, rules) - sellPrice(b, rules) || a.obtainedAt - b.obtainedAt);
  const taken = items.slice(0, Math.max(0, n));
  for (const i of taken) removeItem(s, i.id, at, reason);
  return taken.length;
}

/** Death takes worn gear too; the avatar is left in ordinary clothes (ruling 145). */
export function loseAllGear(s: CultivatorState, at: number): void {
  for (const id of Object.keys(s.gear.items)) removeItem(s, id, at, "death");
}

// ---- Handlers ---------------------------------------------------------------

function currentGearRealm(s: CultivatorState): GearRealm {
  const realm = s.main.realm;
  if (!isGearRealm(realm)) violate("gear_before_foundation", "gear is worn from Foundation Establishment on; in Qi Condensation you wear ordinary clothes");
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

/** Buy the current realm's shop gear (ruling 140): worn if the slot is empty, else into the stash. */
export function onGearBought(s: CultivatorState, e: EventOf<"GearBought">, rules: RulesConfig): void {
  alive(s, "bought");
  const realm = currentGearRealm(s);
  if (s.gear.items[e.id]) violate("duplicate_gear", `gear ${e.id} already exists`);
  const price = shopPrice(e.slot, realm, rules);
  spend(s, price);
  s.gear.gold.bought += price;
  addItem(s, { id: e.id, slot: e.slot, kind: "shop", realm, damageBp: 0, obtainedAt: e.at });
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

/** Sell an item from the stash (provisional price). Worn gear is taken off first. */
export function onGearSold(s: CultivatorState, e: EventOf<"GearSold">, rules: RulesConfig): void {
  alive(s, "sold");
  const item = getItem(s, e.itemId);
  if (Object.values(s.gear.worn).includes(item.id)) violate("gear_worn", "take the item off before selling it");
  const price = sellPrice(item, rules);
  delete s.gear.items[item.id];
  s.gold += price;
  s.gear.gold.sold += price;
}

/** Repair an item fully, worn or in the stash, for its damage's share of the repair price (ruling 144). */
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

/** Held items at or above the warning line (95% damage), for the avatar's warning (ruling 144). */
export function gearWarnings(state: CultivatorState, rules: RulesConfig = RULES_V1): GearItem[] {
  return Object.values(state.gear.items).filter((i) => i.damageBp >= rules.gear.warnAtBp);
}
