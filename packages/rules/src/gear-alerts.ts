/**
 * Gear projections for warnings and pushes (rulings 144, 149): when the worn
 * armor reaches the 95% warning line from the companion's daily damage, and
 * when it is at risk before a tribulation deadline (at 80% a failure's 20%
 * would break it). They assume no new events, the current tier and no rest
 * beyond the current one. The weapon wears with use, not with time, so it
 * isn't projected; the app warns when it is at 95%.
 */
import { RULES_V1, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { FULL_DURABILITY_BP, wornItem, type GearItem } from "./gear.js";
import { openTribulationDeadlines } from "./tribulation.js";
import { DAY, MINUTE, nextLocalMidnight } from "./time.js";

const HOUR = 60 * MINUTE;

/** The worn armor's damage at each coming midnight that damages it, up to `until`. */
function armorDamageSteps(state: CultivatorState, until: number, rules: RulesConfig): { at: number; before: number; after: number }[] {
  const armor = wornItem(state, "armor");
  const bp = rules.gear.companionDamageBp[state.companion.tier];
  if (!armor || bp <= 0) return [];
  const out: { at: number; before: number; after: number }[] = [];
  const rest = state.rest;
  let d = armor.damageBp;
  for (let m = nextLocalMidnight(state.clock, state.tzOffsetMinutes); m <= until && d < FULL_DURABILITY_BP; m = nextLocalMidnight(m + MINUTE, state.tzOffsetMinutes)) {
    // A day that overlaps a rest takes no damage.
    if (rest && rest.start < m && rest.end > m - DAY) continue;
    const after = Math.min(FULL_DURABILITY_BP, d + bp);
    out.push({ at: m, before: d, after });
    d = after;
  }
  return out;
}

/** The midnight the worn armor first reaches the 95% warning line, within `horizonMs` (ruling 144). */
export function gearAlerts(state: CultivatorState, horizonMs: number, rules: RulesConfig = RULES_V1): { itemId: string; at: number }[] {
  const armor = wornItem(state, "armor");
  if (!armor) return [];
  const warn = rules.gear.warnAtBp;
  const cross = armorDamageSteps(state, state.clock + horizonMs, rules).find((x) => x.before < warn && x.after >= warn);
  return cross ? [{ itemId: armor.id, at: cross.at }] : [];
}

export interface ArmorRisk {
  item: GearItem;
  tribulationId: string;
  deadline: number;
}

/**
 * The before-deadline warning (ruling 149): the worn armor is at 80% damage
 * or more and an open tribulation is due within 72 hours, so failing it
 * would break the armor. Null when not at risk.
 */
export function armorAtRisk(state: CultivatorState, rules: RulesConfig = RULES_V1): ArmorRisk | null {
  const item = wornItem(state, "armor");
  if (!item || item.damageBp < rules.gear.riskAtBp) return null;
  const due = openTribulationDeadlines(state).find((d) => d.deadline >= state.clock && d.deadline - state.clock <= rules.gear.riskHours * HOUR);
  return due ? { item, tribulationId: due.tribulationId, deadline: due.deadline } : null;
}

/**
 * When the before-deadline warning will start, for a push (ruling 149): the
 * first coming moment the worn armor is at risk for an open tribulation,
 * either 72 hours before its deadline or the midnight the companion's damage
 * takes the armor to 80%. A risk that already holds isn't pushed (the app
 * shows it); one alert at most.
 */
export function armorRiskAlerts(state: CultivatorState, horizonMs: number, rules: RulesConfig = RULES_V1): { itemId: string; tribulationId: string; at: number }[] {
  const armor = wornItem(state, "armor");
  if (!armor) return [];
  const until = state.clock + horizonMs;
  const risk = rules.gear.riskAtBp;
  const steps = armorDamageSteps(state, until, rules);
  const damageAt = (t: number) => steps.filter((x) => x.at <= t).at(-1)?.after ?? armor.damageBp;
  let first: { itemId: string; tribulationId: string; at: number } | null = null;
  for (const { tribulationId, deadline } of openTribulationDeadlines(state)) {
    const windowStart = deadline - rules.gear.riskHours * HOUR;
    let at: number | null = null;
    if (windowStart > state.clock) {
      const d = damageAt(windowStart);
      if (d >= risk && d < FULL_DURABILITY_BP) at = windowStart;
    }
    if (at === null) {
      const from = Math.max(windowStart, state.clock);
      const cross = steps.find((x) => x.at > from && x.at < deadline && x.before < risk && x.after >= risk && x.after < FULL_DURABILITY_BP);
      if (cross) at = cross.at;
    }
    if (at !== null && at <= until && (first === null || at < first.at)) first = { itemId: armor.id, tribulationId, at };
  }
  return first ? [first] : [];
}
