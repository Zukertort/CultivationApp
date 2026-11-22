/**
 * Test-only helpers. Tests of other paths that run for weeks past Foundation
 * use `noWear`, so the companion's gear damage and the unarmored loss
 * (rulings 147, 154) don't move the Qi and gold they measure. Not exported
 * from the package.
 */
import { TIERS, type RulesConfig } from "./config.js";

export const noWear = (rules: RulesConfig): RulesConfig => ({
  ...rules,
  gear: { ...rules.gear, companionDamageBp: Object.fromEntries(TIERS.map((t) => [t, 0])) as RulesConfig["gear"]["companionDamageBp"] },
});
