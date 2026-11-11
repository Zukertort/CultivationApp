/**
 * Main path, part 4: classes. A class adds gold and Qi bonuses to every gain,
 * lets tagged Main tasks also count for Body or Soul (as its group allows),
 * and earns a class drop on passed tribulations: wearables for Soul, Body and
 * Hybrid classes, a legendary-item roll for Unique ones.
 *
 * Settled rules live in docs/design.md, Rulings 113-124. The only random
 * outcome is the class drop, rolled by the server and stored in the claim or
 * a ClassDropRolled event.
 */
import type { ClassDrop, ClassId, Effort, EventOf } from "@cultivation/schema";
import { GROWTH_COLORS, RULES_V1, type ClassGroup, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { violate } from "./errors.js";
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
  /** Wearables worn, by kind. */
  worn: { soul: number; pet_lion: number; pet_halo: number };
}

export function initialClass(): ClassState {
  return {
    id: null,
    history: [],
    pendingDrops: {},
    drops: { none: 0, soul_wearable: 0, pet_lion: 0, pet_halo: 0, legendary: 0 },
    worn: { soul: 0, pet_lion: 0, pet_halo: 0 },
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

function heldWearables(s: CultivatorState): number {
  const inv = s.inventory;
  return inv.soulWearables + inv.petLionWearables + inv.petHaloWearables;
}

function setClass(s: CultivatorState, to: ClassId, at: number, gold: number): void {
  const c = s.class;
  let forfeited = 0;
  if (c.id !== null) {
    // A change forfeits the held soul and pet wearables; worn ones keep running (ruling 118).
    forfeited = heldWearables(s);
    s.inventory.soulWearables = 0;
    s.inventory.petLionWearables = 0;
    s.inventory.petHaloWearables = 0;
  }
  c.history.push({ at, from: c.id, to, gold, forfeited });
  c.id = to;
}

/** The class picked with the end-of-Foundation choice, for free (ruling 113). */
export function chooseClassAtCore(s: CultivatorState, to: ClassId, at: number): void {
  if (s.class.id === to) return;
  if (s.class.id !== null) violate("class_already_chosen", "the class is already chosen; change it with ClassChosen");
  setClass(s, to, at, 0);
}

/**
 * Pick the class when none was ever chosen (free, from Core Formation on), or
 * change it for gold until Spirit Realm locks it (rulings 113, 114, 123).
 */
export function onClassChosen(s: CultivatorState, e: EventOf<"ClassChosen">, rules: RulesConfig): void {
  const realm = s.main.realm;
  if (s.class.id === null) {
    if (realm === "qi_condensation" || realm === "foundation_establishment") violate("class_not_yet", "the class is chosen at the end of Foundation");
    setClass(s, e.class, e.at, 0);
    return;
  }
  if (s.class.id === e.class) violate("class_unchanged", "this is already the class");
  if (realm === "spirit_realm") violate("class_locked", "the class locks on entering Spirit Realm");
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
      return f < 0.5 ? "pet_lion" : "pet_halo";
    case "hybrid":
      return f < 0.5 ? "soul_wearable" : f < 0.75 ? "pet_lion" : "pet_halo";
  }
}

function applyClassDrop(s: CultivatorState, drop: ClassDrop): void {
  s.class.drops[drop] += 1;
  const inv = s.inventory;
  if (drop === "soul_wearable") inv.soulWearables += 1;
  if (drop === "pet_lion") inv.petLionWearables += 1;
  if (drop === "pet_halo") inv.petHaloWearables += 1;
  if (drop === "legendary") inv.legendary += 1;
}

/** A claim that earned its item roll also earns the class drop (ruling 119): stored, or pending for the server. */
export function earnClassDrop(s: CultivatorState, e: { id: string; at: number; tribulationId: string; classDrop?: ClassDrop | undefined }, rules: RulesConfig): void {
  const odds = classDropChance(s, rules);
  if (!odds) return;
  if (e.classDrop !== undefined) applyClassDrop(s, e.classDrop);
  else s.class.pendingDrops[e.id] = { eventId: e.id, at: e.at, tribulationId: e.tribulationId, ...odds };
}

/** Record a pending class drop's outcome; false when nothing is pending for that event (the caller flags it). */
export function onClassDropRolled(s: CultivatorState, e: EventOf<"ClassDropRolled">): boolean {
  if (!s.class.pendingDrops[e.eventId]) return false;
  delete s.class.pendingDrops[e.eventId];
  applyClassDrop(s, e.drop);
  return true;
}

export function pendingClassDrops(state: CultivatorState): PendingClassDrop[] {
  return Object.values(state.class.pendingDrops).sort((a, b) => a.at - b.at);
}

// ---- Wearables --------------------------------------------------------------

/**
 * Wear a class wearable (ruling 118): a soul wearable freezes a demon's
 * growth for 7 days; a Lion pet wearable keeps the Lion for 30 days (only at
 * Lion); a halo pet wearable grants a halo ticket. Each is used up.
 */
export function onWearableUsed(s: CultivatorState, e: EventOf<"WearableUsed">, rules: RulesConfig): void {
  const inv = s.inventory;
  const w = rules.classes.wearables;
  switch (e.wearable) {
    case "soul": {
      if (inv.soulWearables < 1) violate("no_wearable", "no soul wearable held");
      if (e.demonId === undefined) violate("demon_required", "a soul wearable is worn on a demon");
      const d = s.soul.demons[e.demonId];
      if (!d) violate("unknown_demon", `demon ${e.demonId} does not exist`);
      if (d.frozenUntil !== null && e.at < d.frozenUntil) violate("already_frozen", "this demon is already frozen");
      inv.soulWearables -= 1;
      d.frozenUntil = e.at + w.freezeDays * DAY;
      break;
    }
    case "pet_lion": {
      if (inv.petLionWearables < 1) violate("no_wearable", "no Lion pet wearable held");
      const c = s.companion;
      if (c.tier !== "lion") violate("not_lion", "this pet wearable keeps the Lion; the companion must be a Lion");
      if (c.lionKeptUntil !== null && e.at < c.lionKeptUntil) violate("already_active", "the Lion is already kept");
      inv.petLionWearables -= 1;
      c.lionKeptUntil = e.at + w.lionKeepDays * DAY;
      break;
    }
    case "pet_halo": {
      if (inv.petHaloWearables < 1) violate("no_wearable", "no halo pet wearable held");
      inv.petHaloWearables -= 1;
      s.haloTickets.push({ grantedAt: e.at, expiresAt: e.at + rules.halo.ticketDays * DAY });
      break;
    }
  }
  s.class.worn[e.wearable] += 1;
}
