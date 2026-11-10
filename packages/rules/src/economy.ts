/**
 * Shared economy helpers: bonus multipliers, gains (which repay tax debt
 * first) and the procrastination tax. Used by the engine and the Main path.
 */
import { RULES_V1, type MainPath, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";

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

/** Gold multiplier for soul drops, the roulette and anything outside Body and Main: no tier bonus (ruling 35). */
export function goldMultiplier(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  return goldItems(state, rules);
}

/** Gold multiplier for Body and Main gold: the fitness tier's bonus joins the pool (ruling 35). */
export function trainingGoldMultiplier(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  return (1 + rules.tiers[state.companion.tier].goldBonus) * goldItems(state, rules);
}

/** Qi multiplier for every Qi gain: the pose bonus joins the pool (ruling 35). */
export function qiMultiplier(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  return (1 + (currentPose(state, rules)?.qiBonus ?? 0)) * qiItems(state, rules);
}

/** Qi multiplier for Main tasks and quests: the pose plus the fitness tier's core Qi bonus. */
export function mainQiMultiplier(state: CultivatorState, rules: RulesConfig = RULES_V1): number {
  const pool = 1 + (currentPose(state, rules)?.qiBonus ?? 0) + rules.tiers[state.companion.tier].coreQiBonus;
  return pool * qiItems(state, rules);
}

/** Add gold; tax debt is repaid first. */
export function earnGold(s: CultivatorState, amount: number): void {
  if (!(amount > 0)) return;
  const repay = Math.min(s.main.debt.gold, amount);
  s.main.debt.gold -= repay;
  s.gold += amount - repay;
}

/** Add Qi; tax debt is repaid first. */
export function earnQi(s: CultivatorState, amount: number): void {
  if (!(amount > 0)) return;
  const repay = Math.min(s.main.debt.qi, amount);
  s.main.debt.qi -= repay;
  s.qi += amount - repay;
}

/**
 * Charge procrastination tax: taken from the balances, the rest becomes debt
 * (balances never go below 0), capped. Reaching either cap starts Qi
 * deviation (ruling 33).
 */
export function chargeTax(s: CultivatorState, path: MainPath, qi: number, gold: number, at: number, rules: RulesConfig): void {
  const m = s.main;
  const cap = rules.main.debtCap;
  const fromQi = Math.min(s.qi, qi);
  const fromGold = Math.min(s.gold, gold);
  s.qi -= fromQi;
  s.gold -= fromGold;
  m.debt.qi = Math.min(cap.qi, m.debt.qi + (qi - fromQi));
  m.debt.gold = Math.min(cap.gold, m.debt.gold + (gold - fromGold));
  const paid = m.taxPaid[path];
  paid.qi += qi;
  paid.gold += gold;
  if (m.deviation === null && (m.debt.qi >= cap.qi || m.debt.gold >= cap.gold)) {
    m.deviation = { since: at, windowStart: at, done: 0 };
    m.deviationsEntered += 1;
  }
}
