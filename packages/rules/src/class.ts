/**
 * Main path, part 4: classes. A class adds gold and Qi bonuses to every gain,
 * lets tagged Main tasks also count for Body or Soul (as its group allows),
 * and earns a class drop on passed tribulations: wearables for Soul, Body and
 * Hybrid classes (10% of them legendary, ruling 177), a legendary-item roll
 * for Unique ones (legendary gear of the claim's realm, ruling 176).
 *
 * Settled rules live in docs/design.md, Rulings 113-125. The only random
 * outcome is the class drop, rolled by the server and stored in the claim or
 * a ClassDropRolled event.
 */
import { noPurchaseWhileDead } from "./shop.js";
import type { ClassDrop, ClassId, Effort, EventOf, GearSlot } from "@cultivation/schema";
import { GROWTH_COLORS, RULES_V1, type ClassGroup, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { violate } from "./errors.js";
import { grantLegendary, legendarySlotOutcome } from "./gear.js";
import { DAY } from "./time.js";

// ---- State ------------------------------------------------------------------

export interface ClassChange {
  at: number;
  from: ClassId | null;
  to: ClassId;
  /** Gold paid (0 for the first choice). */
  gold: number;
  /** Held wearables forfeited by the change (ruling 118). */
  forfeited: number;
}

/** A class drop earned by a claim with no recorded outcome yet; the server rolls it. */
export interface PendingClassDrop {
  eventId: string;
  at: number;
  tribulationId: string;
  group: ClassGroup;
  chance: number;
}

export interface ClassState {
  id: ClassId | null;
  history: ClassChange[];
  pendingDrops: Record<string, PendingClassDrop>;
  drops: Record<ClassDrop, number>;
  /** Wearable drops that were legendary (ruling 177), also counted in `drops`. */
  legendaryWearables: number;
  /** Wearables worn, by kind; `legendary` counts the legendary ones among them. */
  worn: { soul: number; pet_keep: number; pet_halo: number; legendary: number };
  /** A legendary keep's gold bonus runs until then (ruling 177). */
  keepGoldUntil: number | null;
}

export function initialClass(): ClassState {
  return {
    id: null,
    history: [],
    pendingDrops: {},
    drops: { none: 0, soul_wearable: 0, pet_keep: 0, pet_halo: 0, legendary: 0 },
    legendaryWearables: 0,
    worn: { soul: 0, pet_keep: 0, pet_halo: 0, legendary: 0 },
    keepGoldUntil: null,
  };
}

// ---- Bonuses and coverage ---------------------------------------------------

/** The current class's share of the additive pool (ruling 115); zero with no class. */
export function classBonus(state: CultivatorState, rules: RulesConfig = RULES_V1): { gold: number; qi: number } {
  const id = state.class.id;
  if (id === null) return { gold: 0, qi: 0 };
  const c = rules.classes.table[id];
  return { gold: c.gold, qi: c.qi };
}

export function classGroup(state: CultivatorState, rules: RulesConfig = RULES_V1): ClassGroup | null {
  const id = state.class.id;
  return id === null ? null : rules.classes.table[id].group;
}

/** The paths a tagged Main task can also hone under the current class (ruling 116). */
export function classCovers(state: CultivatorState, rules: RulesConfig = RULES_V1): { body: boolean; soul: boolean } {
  const g = classGroup(state, rules);
  return { body: g === "body" || g === "hybrid", soul: g === "soul" || g === "hybrid" };
}

/** Check a Main task's cross-path tags when it is defined (rulings 116-117). */
export function checkCrossTags(s: CultivatorState, task: { effort: Effort; alsoBody?: boolean | undefined; alsoSoulDemonId?: string | undefined }, rules: RulesConfig): void {
  if (!task.alsoBody && task.alsoSoulDemonId === undefined) return;
  if (task.effort === "quick") violate("cross_credit_effort", "only tasks of session effort or longer can also count for Body or Soul");
  const covers = classCovers(s, rules);
  if (task.alsoBody && !covers.body) violate("class_disallows", "the current class doesn't let core tasks hone Body");
  if (task.alsoSoulDemonId !== undefined) {
    if (!covers.soul) violate("class_disallows", "the current class doesn't let core tasks hone Soul");
    if (!s.soul.demons[task.alsoSoulDemonId]) violate("unknown_demon", `demon ${task.alsoSoulDemonId} does not exist`);
  }
}

// ---- Choosing ---------------------------------------------------------------

export function heldWearables(s: CultivatorState): number {
  const inv = s.inventory;
  return inv.soulWearables + inv.petKeepWearables + inv.petHaloWearables + inv.legendarySoulWearables + inv.legendaryPetKeepWearables + inv.legendaryPetHaloWearables;
}

function setClass(s: CultivatorState, to: ClassId, at: number, gold: number): void {
  const c = s.class;
  let forfeited = 0;
  if (c.id !== null) {
    // A change forfeits the held soul and pet wearables, legendary ones included; worn ones keep running (rulings 118, 177).
    forfeited = heldWearables(s);
    const inv = s.inventory;
    inv.soulWearables = 0;
    inv.petKeepWearables = 0;
    inv.petHaloWearables = 0;
    inv.legendarySoulWearables = 0;
    inv.legendaryPetKeepWearables = 0;
    inv.legendaryPetHaloWearables = 0;
  }
  c.history.push({ at, from: c.id, to, gold, forfeited });
  c.id = to;
}

/** The class picked on leaving Foundation (CoreFormed or an override out of it), for free (ruling 113). */
export function chooseClassAtCore(s: CultivatorState, to: ClassId, at: number): void {
  if (s.class.id === to) return;
  if (s.class.id !== null) violate("class_already_chosen", "the class is already chosen; change it with ClassChosen");
  setClass(s, to, at, 0);
}

/** Change the class for gold until Spirit Realm locks it (rulings 113, 114, 123); the first is picked on leaving Foundation. */
export function onClassChosen(s: CultivatorState, e: EventOf<"ClassChosen">, rules: RulesConfig): void {
  const realm = s.main.realm;
  if (s.class.id === null) violate("class_not_yet", "the class is chosen on leaving Foundation");
  if (s.class.id === e.class) violate("class_unchanged", "this is already the class");
  if (realm === "spirit_realm") violate("class_locked", "the class locks on entering Spirit Realm");
  // A class change is a purchase: none while dead (ruling 164).
  noPurchaseWhileDead(s);
  const price = rules.classes.changeGold;
  if (s.gold < price) violate("insufficient_gold", `changing class costs ${price} gold`);
  s.gold -= price;
  setClass(s, e.class, e.at, price);
}

// ---- Class drops ------------------------------------------------------------

/** The class drop's chance for the current class (rulings 119-120); null with no class. */
export function classDropChance(state: CultivatorState, rules: RulesConfig = RULES_V1): { group: ClassGroup; chance: number } | null {
  const group = classGroup(state, rules);
  if (group === null) return null;
  const d = rules.classes.drop;
  if (group === "unique") return { group, chance: d.uniqueLegendaryChance };
  // Weakening colors and lower tiers never reduce it.
  const color = GROWTH_COLORS.includes(state.soul.color) ? (d.soulColorBonus[state.soul.color] ?? 0) : 0;
  const tier = d.tierBonus[state.companion.tier];
  const bonus = group === "soul" ? color : group === "body" ? tier : Math.max(color, tier);
  return { group, chance: Math.min(1, d.chance + Math.max(0, bonus)) };
}

/**
 * Map a uniform u in [0, 1) to a class drop: a drop below the chance, its
 * kind by where u landed (Body: Lion or halo pet wearable 50/50; Hybrid: soul
 * or pet 50/50, the pet kind 50/50). The server draws u and stores the outcome.
 */
export function classDropOutcome(group: ClassGroup, chance: number, u: number): ClassDrop {
  if (!(u >= 0 && u < 1)) throw new RangeError("u must be in [0, 1)");
  if (u >= chance) return "none";
  const f = u / chance;
  switch (group) {
    case "unique":
      return "legendary";
    case "soul":
      return "soul_wearable";
    case "body":
      return f < 0.5 ? "pet_keep" : "pet_halo";
    case "hybrid":
      return f < 0.5 ? "soul_wearable" : f < 0.75 ? "pet_keep" : "pet_halo";
  }
}

/** The server's roll for whether a wearable class drop is legendary (ruling 177): u in [0, 1). */
export function wearableLegendaryOutcome(u: number, rules: RulesConfig = RULES_V1): boolean {
  if (!(u >= 0 && u < 1)) throw new RangeError("u must be in [0, 1)");
  return u < rules.classes.wearables.legendary.share;
}

interface ClassDropHit {
  /** The claim's event id: it keys the legendary item and its slot fallback. */
  claimId: string;
  at: number;
  tribulationId: string;
  legendary: boolean | undefined;
  slot: GearSlot | undefined;
}

/**
 * Apply a class drop: a wearable (legendary when the server rolled it so;
 * events from before part 4 carry no flag and stay ordinary, ruling 177), or
 * a Unique class's legendary item, legendary gear of the claimed
 * tribulation's realm (ruling 176).
 */
/**
 * The server's full class drop roll from one uniform u (rulings 119, 120,
 * 176, 177): the drop, and where u landed inside its band decides a
 * wearable's legendary flag (the first `share` of the band) or a Unique
 * legendary item's slot. Stored as ClassDropRolled's drop, legendary and slot.
 */
export function classDropRoll(group: ClassGroup, chance: number, u: number, rules: RulesConfig = RULES_V1): { drop: ClassDrop; legendary?: boolean; slot?: GearSlot } {
  const drop = classDropOutcome(group, chance, u);
  if (drop === "none") return { drop };
  const f = u / chance;
  if (drop === "legendary") return { drop, slot: legendarySlotOutcome(f) };
  // The sub-band the kind came from, rescaled to [0, 1).
  const [start, width] =
    group === "soul" ? [0, 1] : group === "body" ? (f < 0.5 ? [0, 0.5] : [0.5, 0.5]) : f < 0.5 ? [0, 0.5] : f < 0.75 ? [0.5, 0.25] : [0.75, 0.25];
  return { drop, legendary: wearableLegendaryOutcome(Math.min(0.999999, (f - start) / width), rules) };
}

function applyClassDrop(s: CultivatorState, drop: ClassDrop, hit: ClassDropHit, rules: RulesConfig): void {
  s.class.drops[drop] += 1;
  const inv = s.inventory;
  const legendary = hit.legendary === true && drop !== "legendary" && drop !== "none";
  if (legendary) s.class.legendaryWearables += 1;
  if (drop === "soul_wearable") legendary ? (inv.legendarySoulWearables += 1) : (inv.soulWearables += 1);
  if (drop === "pet_keep") legendary ? (inv.legendaryPetKeepWearables += 1) : (inv.petKeepWearables += 1);
  if (drop === "pet_halo") legendary ? (inv.legendaryPetHaloWearables += 1) : (inv.petHaloWearables += 1);
  if (drop === "legendary") {
    const realm = s.tribulations.items[hit.tribulationId]?.realm ?? s.main.realm;
    grantLegendary(s, { key: hit.claimId, at: hit.at, realm, slot: hit.slot, source: "class" }, rules);
  }
}

/** A claim that earned its item roll also earns the class drop (ruling 119): stored, or pending for the server. */
export function earnClassDrop(
  s: CultivatorState,
  e: { id: string; at: number; tribulationId: string; classDrop?: ClassDrop | undefined; classDropLegendary?: boolean | undefined; classDropSlot?: GearSlot | undefined },
  rules: RulesConfig,
): void {
  const odds = classDropChance(s, rules);
  if (!odds) return;
  if (e.classDrop !== undefined) applyClassDrop(s, e.classDrop, { claimId: e.id, at: e.at, tribulationId: e.tribulationId, legendary: e.classDropLegendary, slot: e.classDropSlot }, rules);
  else s.class.pendingDrops[e.id] = { eventId: e.id, at: e.at, tribulationId: e.tribulationId, ...odds };
}

/** Record a pending class drop's outcome; false when nothing is pending for that event (the caller flags it). */
export function onClassDropRolled(s: CultivatorState, e: EventOf<"ClassDropRolled">, rules: RulesConfig): boolean {
  const p = s.class.pendingDrops[e.eventId];
  if (!p) return false;
  delete s.class.pendingDrops[e.eventId];
  applyClassDrop(s, e.drop, { claimId: e.eventId, at: e.at, tribulationId: p.tribulationId, legendary: e.legendary, slot: e.slot }, rules);
  return true;
}

export function pendingClassDrops(state: CultivatorState): PendingClassDrop[] {
  return Object.values(state.class.pendingDrops).sort((a, b) => a.at - b.at);
}

// ---- Wearables --------------------------------------------------------------

const HELD = {
  soul: ["soulWearables", "legendarySoulWearables"],
  pet_keep: ["petKeepWearables", "legendaryPetKeepWearables"],
  pet_halo: ["petHaloWearables", "legendaryPetHaloWearables"],
} as const;

/**
 * Wear a class wearable (ruling 118): a soul wearable freezes a demon's
 * growth for 7 days; a keep pet wearable keeps the companion at its tier for
 * 30 days (no food loss, no demotion; promotions still work); a halo pet
 * wearable grants a halo ticket. Each is used up. A legendary one (ruling
 * 177) adds: +50% damage to the frozen demon while frozen; +5% gold in the
 * additive pool while the tier is kept; a ticket worth +15% instead of +10%.
 */
export function onWearableUsed(s: CultivatorState, e: EventOf<"WearableUsed">, rules: RulesConfig): void {
  const inv = s.inventory;
  const w = rules.classes.wearables;
  const legendary = e.legendary === true;
  const key = HELD[e.wearable][legendary ? 1 : 0];
  const what = `${legendary ? "legendary " : ""}${e.wearable === "soul" ? "soul" : e.wearable === "pet_keep" ? "keep pet" : "halo pet"} wearable`;
  if (inv[key] < 1) violate("no_wearable", `no ${what} held`);
  switch (e.wearable) {
    case "soul": {
      if (e.demonId === undefined) violate("demon_required", "a soul wearable is worn on a demon");
      const d = s.soul.demons[e.demonId];
      if (!d) violate("unknown_demon", `demon ${e.demonId} does not exist`);
      if (d.frozenUntil !== null && e.at < d.frozenUntil) violate("already_frozen", "this demon is already frozen");
      d.frozenUntil = e.at + w.freezeDays * DAY;
      if (legendary) d.boostedUntil = d.frozenUntil;
      break;
    }
    case "pet_keep": {
      const c = s.companion;
      if (c.tierKeptUntil !== null && e.at < c.tierKeptUntil) violate("already_active", "the companion is already kept");
      c.tierKeptUntil = e.at + w.keepDays * DAY;
      if (legendary) s.class.keepGoldUntil = c.tierKeptUntil;
      break;
    }
    case "pet_halo": {
      s.haloTickets.push({ grantedAt: e.at, expiresAt: e.at + rules.halo.ticketDays * DAY, ...(legendary ? { bonus: w.legendary.haloBonus } : {}) });
      break;
    }
  }
  inv[key] -= 1;
  s.class.worn[e.wearable] += 1;
  if (legendary) s.class.worn.legendary += 1;
}
