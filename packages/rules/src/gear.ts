/**
 * Base gear (Roadmap part 2; rulings 137-145): one armor and one weapon slot,
 * a stash for gear not worn, free robes on first entering each realm, shop
 * gear, selling and repairs, and durability.
 *
 * Stats are fixed per realm and kind and never change: a breakthrough doesn't
 * level gear up, and damage doesn't weaken it until it breaks at 100%. Gear
 * of the current or a lower realm can be worn, never a higher realm's.
 *
 * Which worn item takes damage is a deterministic pseudo-random pick (ruling
 * 144): a hash of the user id and the local day for the companion's daily
 * damage, and of the tribulation id and its failure count for a failure. No
 * event carries it, and replay is stable.
 */
import type { EventOf, GearSlot } from "@cultivation/schema";
import { GEAR_REALMS, REALMS, RULES_V1, type GearKind, type GearRealm, type Realm, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { violate } from "./errors.js";
import { DAY, MINUTE, localDay, nextLocalMidnight } from "./time.js";

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

export interface GearState {
  /** Every item held, worn or in the stash. */
  items: Record<string, GearItem>;
  /** The item worn in each slot; every other held item is in the stash. */
  worn: Record<GearSlot, string | null>;
  /** Realms whose free robe was given (once per lifetime, ruling 139). */
  robesGranted: GearRealm[];
  /** Items lost: broken at 100%, taken by a repent or by death. */
  lost: { at: number; item: GearItem; reason: "broken" | "repent" | "death" }[];
  /** Gold spent and earned on gear, for the simulator and the app. */
  gold: { bought: number; repaired: number; sold: number };
}

export function initialGear(): GearState {
  return { items: {}, worn: { armor: null, weapon: null }, robesGranted: [], lost: [], gold: { bought: 0, repaired: 0, sold: 0 } };
}

const realmIndex = (r: Realm) => REALMS.indexOf(r);

function isGearRealm(r: Realm): r is GearRealm {
  return (GEAR_REALMS as readonly Realm[]).includes(r);
}

/** 32-bit FNV-1a: a stable, pure hash for the damage picks. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
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

/** Qi and gold a worn armor takes off a tribulation failure (ruling 142). */
export function armorReduction(state: CultivatorState, rules: RulesConfig = RULES_V1): { qi: number; gold: number } {
  const a = wornItem(state, "armor");
  return a ? rules.gear.armor[a.kind][a.realm] : { qi: 0, gold: 0 };
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

// ---- Changes ----------------------------------------------------------------

function wornIds(s: CultivatorState): string[] {
  return SLOTS.map((slot) => s.gear.worn[slot]).filter((id): id is string => id !== null);
}

/** Add an item: worn if its slot is empty and it can be worn, else into the stash. */
function addItem(s: CultivatorState, item: GearItem): void {
  s.gear.items[item.id] = item;
  if (s.gear.worn[item.slot] === null && wearable(s, item)) s.gear.worn[item.slot] = item.id;
}

function removeItem(s: CultivatorState, id: string, at: number, reason: "broken" | "repent" | "death"): void {
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

/** The worn item a hash picks, or null with nothing worn. */
function pickWorn(ids: readonly string[], key: string): string | null {
  return ids.length === 0 ? null : ids[fnv1a(key) % ids.length]!;
}

const dayKey = (s: CultivatorState, day: number) => `${s.userId}|${day}`;

/**
 * After every event: give the current realm's free robe on first entering it
 * (ruling 139), and move worn gear of a higher realm to the stash (after a
 * repent, ruling 138).
 */
export function syncGear(s: CultivatorState, at: number): void {
  if (!s.created) return;
  const g = s.gear;
  for (const slot of SLOTS) {
    const item = wornItem(s, slot);
    if (item && !wearable(s, item)) g.worn[slot] = null;
  }
  const realm = s.main.realm;
  if (!isGearRealm(realm) || g.robesGranted.includes(realm)) return;
  g.robesGranted.push(realm);
  // While dead nothing is given (ruling 106); entering a realm while dead doesn't happen, but stay safe.
  if (s.progress.diedAt !== null) return;
  addItem(s, { id: `robe:${realm}`, slot: "armor", kind: "robe", realm, damageBp: 0, obtainedAt: at });
}

/**
 * At a local midnight closing a day without rest: the companion damages one
 * worn item, picked by the user id and the day that ended (ruling 144).
 * It keeps going while dead.
 */
export function gearMidnight(s: CultivatorState, midnight: number, rested: boolean, rules: RulesConfig): void {
  if (rested) return;
  const bp = rules.gear.companionDamageBp[s.companion.tier];
  if (bp <= 0) return;
  const id = pickWorn(wornIds(s), dayKey(s, localDay(midnight - 1, s.tzOffsetMinutes)));
  if (id !== null) damage(s, id, bp, midnight);
}

/**
 * A tribulation failure (ruling 142): worn armor takes its Qi and gold off
 * the loss, then one worn item, picked by the tribulation and its failure
 * count, takes the failure damage. With nothing worn, neither applies.
 */
export function gearOnFailure(s: CultivatorState, tribulationId: string, failures: number, loss: { qi: number; gold: number }, at: number, rules: RulesConfig): { qi: number; gold: number } {
  const a = armorReduction(s, rules);
  const reduced = { qi: Math.max(0, loss.qi - a.qi), gold: Math.max(0, loss.gold - a.gold) };
  const id = pickWorn(wornIds(s), `${tribulationId}|${failures}`);
  if (id !== null) damage(s, id, rules.gear.failureDamageBp, at);
  return reduced;
}

/**
 * Repent penalties take from the stash, least valuable (by sell price) first,
 * never worn gear (ruling 145). Returns how many were taken.
 */
export function loseStashItems(s: CultivatorState, n: number, at: number, rules: RulesConfig): number {
  const items = stash(s).sort((a, b) => sellPrice(a, rules) - sellPrice(b, rules) || a.obtainedAt - b.obtainedAt);
  const taken = items.slice(0, Math.max(0, n));
  for (const i of taken) removeItem(s, i.id, at, "repent");
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

function spend(s: CultivatorState, gold: number): void {
  if (s.gold < gold) violate("insufficient_gold", `this costs ${Math.ceil(gold)} gold`);
  s.gold -= gold;
}

/** Buy the current realm's shop gear (ruling 140): worn if the slot is empty, else into the stash. */
export function onGearBought(s: CultivatorState, e: EventOf<"GearBought">, rules: RulesConfig): void {
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

/** Sell an item from the stash (provisional price). Worn gear is taken off first; nothing is sold while dead. */
export function onGearSold(s: CultivatorState, e: EventOf<"GearSold">, rules: RulesConfig): void {
  const item = getItem(s, e.itemId);
  if (Object.values(s.gear.worn).includes(item.id)) violate("gear_worn", "take the item off before selling it");
  // While dead nothing pays (ruling 106), so a sale would lose the item for nothing.
  if (s.progress.diedAt !== null) violate("dead", "nothing can be sold while the avatar is dead");
  const price = sellPrice(item, rules);
  delete s.gear.items[item.id];
  s.gold += price;
  s.gear.gold.sold += price;
}

/** Repair an item fully, worn or in the stash, for its damage's share of the repair price (ruling 144). */
export function onGearRepaired(s: CultivatorState, e: EventOf<"GearRepaired">, rules: RulesConfig): void {
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

/**
 * When each worn item will first reach the warning line from the companion's
 * daily damage, assuming no new events, the current tier, and no rest beyond
 * the current one: the midnight it crosses, within `horizonMs`. Failures
 * aren't projected (the app shows those).
 */
export function gearAlerts(state: CultivatorState, horizonMs: number, rules: RulesConfig = RULES_V1): { itemId: string; at: number }[] {
  const bp = rules.gear.companionDamageBp[state.companion.tier];
  const ids = wornIds(state);
  if (bp <= 0 || ids.length === 0) return [];
  const damageBp: Record<string, number> = Object.fromEntries(ids.map((id) => [id, state.gear.items[id]!.damageBp]));
  const out: { itemId: string; at: number }[] = [];
  const rest = state.rest;
  let alive = [...ids];
  for (let m = nextLocalMidnight(state.clock, state.tzOffsetMinutes); m <= state.clock + horizonMs && alive.length > 0; m = nextLocalMidnight(m + MINUTE, state.tzOffsetMinutes)) {
    // A day that overlaps a rest takes no damage.
    if (rest && rest.start < m && rest.end > m - DAY) continue;
    const id = pickWorn(alive, dayKey(state, localDay(m - 1, state.tzOffsetMinutes)))!;
    const before = damageBp[id]!;
    const after = Math.min(FULL_DURABILITY_BP, before + bp);
    damageBp[id] = after;
    if (before < rules.gear.warnAtBp && after >= rules.gear.warnAtBp) out.push({ itemId: id, at: m });
    if (after >= FULL_DURABILITY_BP) alive = alive.filter((x) => x !== id);
  }
  return out;
}
