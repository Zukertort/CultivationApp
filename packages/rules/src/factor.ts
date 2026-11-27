/**
 * Realm scaling (rulings 169-172): the realm factor (1, 1, 2, 4, 8 from Qi
 * Condensation to Spirit Realm) and the completion cost of a claimed
 * tribulation. Every Qi price, the debt cap, gear stats and one-time gear
 * prices scale with the factor; recurring costs (repairs, the unarmored loss,
 * vacations, gain potions) stay a fixed share of a flat income.
 */
import { GEAR_REALMS, RULES_V1, type PriceRealm, type Realm, type RulesConfig } from "./config.js";

/** The realm whose prices apply: Spirit Realm's above it (Step 2+). */
export function priceRealm(realm: Realm): PriceRealm {
  if (realm === "qi_condensation" || (GEAR_REALMS as readonly Realm[]).includes(realm)) return realm as PriceRealm;
  return "spirit_realm";
}

export function realmFactor(realm: Realm, rules: RulesConfig = RULES_V1): number {
  return rules.realms.factor[priceRealm(realm)];
}

/**
 * The Qi to complete a claimed tribulation of `realm` (ruling 169): K in
 * Foundation, 2K in Core Formation, 4K in Nascent Soul. Qi Condensation has
 * none, and Spirit Realm none until Step 2 designs its tribulations.
 */
export function completionCost(realm: Realm, rules: RulesConfig = RULES_V1): number {
  if (realm !== "foundation_establishment" && realm !== "core_formation" && realm !== "nascent_soul") return 0;
  return rules.realms.completionK * realmFactor(realm, rules);
}

/** The realm's Qi base for prices (ruling 170): K times the factor, in every realm (Spirit Realm 8K, Qi Condensation K). */
export function realmQiBase(realm: Realm, rules: RulesConfig = RULES_V1): number {
  return rules.realms.completionK * realmFactor(realm, rules);
}
