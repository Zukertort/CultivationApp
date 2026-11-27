/**
 * The gold shop's services and potions (Roadmap part 3; rulings 159-163):
 * prices by realm, gain potions, and vacations, capped in length and per
 * window. Gear prices are in gear.ts. Legendary potions, legendary items and
 * class wearables are never sold.
 */
import type { EventOf } from "@cultivation/schema";
import { GEAR_REALMS, RULES_V1, type PriceRealm, type Realm, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { violate } from "./errors.js";
import { DAY } from "./time.js";

/** The realm whose prices apply: Spirit Realm's above it (Step 2+). */
export function priceRealm(realm: Realm): PriceRealm {
  if (realm === "qi_condensation" || (GEAR_REALMS as readonly Realm[]).includes(realm)) return realm as PriceRealm;
  return "spirit_realm";
}

/** A gain potion's shop price in the current realm (ruling 160). */
export function potionPrice(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  return rules.potions.gain.gold[priceRealm(state.main.realm)];
}

/** A vacation's price for `days` days in the current realm (ruling 161). */
export function vacationPrice(state: CultivatorState, days: number, rules: RulesConfig = RULES_V1): number {
  return days * rules.rest.vacationGoldPerDay[priceRealm(state.main.realm)];
}

/** Vacation time already used in the window ending at `at` (ms). */
function vacationUsed(state: CultivatorState, at: number, rules: RulesConfig): number {
  const windowStart = at - rules.rest.vacationWindowDays * DAY;
  return state.vacationLog.reduce((sum, p) => sum + Math.max(0, Math.min(p.end, at) - Math.max(p.start, windowStart)), 0);
}

/** The longest vacation that can start at `at`, in whole days: the length cap and what the window has left (ruling 161). */
export function vacationDaysLeft(state: CultivatorState, at: number, rules: RulesConfig = RULES_V1): number {
  const r = rules.rest;
  const left = Math.floor((r.vacationMaxDaysPerWindow * DAY - vacationUsed(state, at, rules)) / DAY);
  return Math.max(0, Math.min(r.vacationMaxDays, left));
}

/**
 * Check and charge a vacation starting at `at` (ruling 161): at most 14 days,
 * at most 30 days in any 91, priced by the current realm. Called by the
 * RestStarted handler.
 */
export function chargeVacation(s: CultivatorState, at: number, until: number, rules: RulesConfig): void {
  const r = rules.rest;
  const length = until - at;
  const days = Math.ceil(length / DAY);
  if (days > r.vacationMaxDays) violate("vacation_too_long", `a vacation is capped at ${r.vacationMaxDays} days`);
  if (vacationUsed(s, at, rules) + length > r.vacationMaxDaysPerWindow * DAY) {
    violate("vacation_quota", `at most ${r.vacationMaxDaysPerWindow} vacation days per ${r.vacationWindowDays} days`);
  }
  const cost = vacationPrice(s, days, rules);
  if (s.gold < cost) violate("insufficient_gold", `this vacation costs ${Math.ceil(cost)} gold`);
  s.gold -= cost;
}

/** Buy a gain potion (ruling 160): Qi Condensation included; nothing is bought while dead (ruling 150). */
export function onPotionBought(s: CultivatorState, _e: EventOf<"PotionBought">, rules: RulesConfig): void {
  if (s.progress.diedAt !== null) violate("dead", "nothing can be bought while the avatar is dead");
  const price = potionPrice(s, rules);
  if (s.gold < price) violate("insufficient_gold", `a gain potion costs ${Math.ceil(price)} gold`);
  s.gold -= price;
  s.inventory.gainPotions += 1;
  s.shopSpent.potions += price;
}
