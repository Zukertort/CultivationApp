/**
 * Shared economy helpers: bonus multipliers, gains (which repay tax debt
 * first) and the procrastination tax. Used by the engine and the Main path.
 */
import { RULES_V1, type MainPath, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";

/** The current class's gold and Qi bonus (ruling 115); read here to keep economy free of the class module. */
function classShare(state: CultivatorState, rules: RulesConfig): { gold: number; qi: number } {
  const id = state.class.id;
  return id === null ? { gold: 0, qi: 0 } : rules.classes.table[id];
}

export function masteredCount(state: CultivatorState): number {
  return state.masteries.length;
}

function currentPose(state: CultivatorState, rules: RulesConfig) {
  const n = masteredCount(state);
  let current = rules.poses[0];
  for (const p of rules.poses) if (n >= p.minMastered) current = p;
  return current;
}

export function pose(state: CultivatorState, rules: RulesConfig = RULES_V1): string {
  return currentPose(state, rules)?.name ?? "standing";
}

/** Scales and wings multiply the additive pool (bonus stacking). */
function goldItems(state: CultivatorState, rules: RulesConfig): number {
  const inv = state.inventory;
  return (1 + rules.scales.goldBonusEach) ** inv.scales * (inv.wings ? 1 + rules.wings.goldBonus : 1);
}

function qiItems(state: CultivatorState, rules: RulesConfig): number {
  const inv = state.inventory;
  return (1 + rules.scales.qiBonusEach) ** inv.scales * (inv.wings ? 1 + rules.wings.qiBonus : 1);
}

// ---- Potions (ruling 58) ----------------------------------------------------

export type PotionKind = "gain" | "legendary";

/**
 * Split a potion drop by where the server's roll landed inside the potion
 * band (f in [0, 1)): the last `legendaryShare` of the band is a legendary
 * potion, the rest a gain potion. One roll decides both the drop and its kind.
 */
export function potionKind(f: number, rules: RulesConfig = RULES_V1): PotionKind {
  return f < 1 - rules.potions.legendaryShare ? "gain" : "legendary";
}

export function addPotion(s: CultivatorState, kind: PotionKind): void {
  if (kind === "gain") s.inventory.gainPotions += 1;
  else s.inventory.legendaryPotions += 1;
}

/** A lost item is a potion: a gain potion if there is one, else a legendary potion. */
export function losePotion(s: CultivatorState): void {
  const inv = s.inventory;
  if (inv.gainPotions > 0) inv.gainPotions -= 1;
  else if (inv.legendaryPotions > 0) inv.legendaryPotions -= 1;
}

/** The active gain potion's share of the additive pool (0 when none is active). */
export function potionBonus(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  const until = state.inventory.gainPotionUntil;
  return until !== null && state.clock < until ? rules.potions.gain.bonus : 0;
}

// ---- Multipliers ------------------------------------------------------------

/** Gold multiplier for soul drops, the roulette and anything outside Body and Main: no tier bonus (ruling 35). */
export function goldMultiplier(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  return (1 + classShare(state, rules).gold + potionBonus(state, rules)) * goldItems(state, rules);
}

/** Gold multiplier for Body and Main gold: the fitness tier's bonus joins the pool (ruling 35). */
export function trainingGoldMultiplier(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  return (1 + rules.tiers[state.companion.tier].goldBonus + classShare(state, rules).gold + potionBonus(state, rules)) * goldItems(state, rules);
}

/** Qi multiplier for every Qi gain: the pose bonus joins the pool (ruling 35). */
export function qiMultiplier(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  return (1 + (currentPose(state, rules)?.qiBonus ?? 0) + classShare(state, rules).qi + potionBonus(state, rules)) * qiItems(state, rules);
}

/** Qi multiplier for Main tasks and quests: the pose plus the fitness tier's core Qi bonus. */
export function mainQiMultiplier(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  const pool = 1 + (currentPose(state, rules)?.qiBonus ?? 0) + rules.tiers[state.companion.tier].coreQiBonus + classShare(state, rules).qi + potionBonus(state, rules);
  return pool * qiItems(state, rules);
}

/** Add gold; tax debt is repaid first, its unforgivable postponed part first of all. */
export function earnGold(s: CultivatorState, amount: number): void {
  if (!(amount > 0)) return;
  const m = s.main;
  const repay = Math.min(m.debt.gold, amount);
  m.debt.gold -= repay;
  m.debtPostponed.gold = Math.max(0, m.debtPostponed.gold - repay);
  s.gold += amount - repay;
}

/** Add Qi; tax debt is repaid first, its unforgivable postponed part first of all. */
export function earnQi(s: CultivatorState, amount: number): void {
  if (!(amount > 0)) return;
  const m = s.main;
  const repay = Math.min(m.debt.qi, amount);
  m.debt.qi -= repay;
  m.debtPostponed.qi = Math.max(0, m.debtPostponed.qi - repay);
  s.qi += amount - repay;
}

/**
 * Charge procrastination tax: taken from the balances, the rest becomes debt
 * (balances never go below 0), capped. Reaching either cap starts Qi
 * deviation (ruling 33). Debt from `postponed` tax is tracked apart, since
 * the comeback doesn't forgive it (ruling 59).
 */
export function chargeTax(s: CultivatorState, path: MainPath, qi: number, gold: number, at: number, rules: RulesConfig, postponed = false): void {
  const m = s.main;
  const cap = rules.main.debtCap;
  const fromQi = Math.min(s.qi, qi);
  const fromGold = Math.min(s.gold, gold);
  s.qi -= fromQi;
  s.gold -= fromGold;
  const before = { ...m.debt };
  m.debt.qi = Math.min(cap.qi, m.debt.qi + (qi - fromQi));
  m.debt.gold = Math.min(cap.gold, m.debt.gold + (gold - fromGold));
  if (postponed) {
    m.debtPostponed.qi += m.debt.qi - before.qi;
    m.debtPostponed.gold += m.debt.gold - before.gold;
  }
  const paid = m.taxPaid[path];
  paid.qi += qi;
  paid.gold += gold;
  if (m.deviation === null && (m.debt.qi >= cap.qi || m.debt.gold >= cap.gold)) {
    m.deviation = { since: at, windowStart: at, done: 0 };
    m.deviationsEntered += 1;
  }
}
