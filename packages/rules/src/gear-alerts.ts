/**
 * Gear projections for warnings and pushes (rulings 144, 149, 153): when the
 * worn armor reaches the 95% warning line from the companion's daily damage,
 * when it is getting damaged (50%, an in-app line only), and when a failure
 * of a tribulation due within 72 hours would break it. They assume no new
 * events, the current tier and no rest beyond the current one. The weapon
 * wears with use, not with time, so it isn't projected; the app warns when
 * it is at 95%.
 */
import { RULES_V1, type RulesConfig } from "./config.js";
import type { CultivatorState } from "./engine.js";
import { FULL_DURABILITY_BP, armorStats, stash, wearable, wornItem, type GearItem } from "./gear.js";
import { openTribulationDeadlines } from "./tribulation.js";
import { DAY, MINUTE, nextLocalMidnight } from "./time.js";

const HOUR = 60 * MINUTE;

/** The coming local midnights up to `until` at which the companion damages armor (days overlapping a rest don't). */
function damagingMidnights(state: CultivatorState, until: number): number[] {
  const out: number[] = [];
  const rest = state.rest;
  for (let m = nextLocalMidnight(state.clock, state.tzOffsetMinutes); m <= until; m = nextLocalMidnight(m + MINUTE, state.tzOffsetMinutes)) {
    if (rest && rest.start < m && rest.end > m - DAY) continue;
    out.push(m);
  }
  return out;
}

/** The midnight the worn armor first reaches the 95% warning line, within `horizonMs` (ruling 144). */
export function gearAlerts(state: CultivatorState, horizonMs: number, rules: RulesConfig = RULES_V1): { itemId: string; at: number }[] {
  const armor = wornItem(state, "armor");
  const bp = rules.gear.companionDamageBp[state.companion.tier];
  if (!armor || bp <= 0) return [];
  const warn = rules.gear.warnAtBp;
  let d = armor.damageBp;
  for (const m of damagingMidnights(state, state.clock + horizonMs)) {
    const after = d + bp;
    if (d < warn && after >= warn) return [{ itemId: armor.id, at: m }];
    if (after >= FULL_DURABILITY_BP) return [];
    d = after;
  }
  return [];
}

/**
 * An armor's damage once a failure of a tribulation due at `deadline` is
 * applied, at the first midnight after it, with the companion's damage at
 * every midnight until then, that one included (ruling 153). At 100% or more
 * the failure would break it: for a deadline today that is 75% at Turtle.
 */
export function damageAtFailure(state: CultivatorState, item: Pick<GearItem, "damageBp">, deadline: number, rules: RulesConfig = RULES_V1): number {
  const bp = rules.gear.companionDamageBp[state.companion.tier];
  const nights = damagingMidnights(state, nextLocalMidnight(deadline, state.tzOffsetMinutes)).length;
  return item.damageBp + rules.gear.failureDamageBp + bp * nights;
}

/** The worn armor is getting damaged (50% or more): the avatar's in-app line, never pushed (ruling 153). */
export function armorCare(state: CultivatorState, rules: RulesConfig = RULES_V1): GearItem | null {
  const item = wornItem(state, "armor");
  return item && item.damageBp >= rules.gear.careAtBp ? item : null;
}

export interface ArmorRisk {
  item: GearItem;
  tribulationId: string;
  deadline: number;
}

const dueSoon = (state: CultivatorState, rules: RulesConfig) =>
  openTribulationDeadlines(state).filter((d) => d.deadline >= state.clock && d.deadline - state.clock <= rules.gear.riskHours * HOUR);

/**
 * The before-deadline warning (rulings 153, 166): a tribulation is due
 * within 72 hours and, were it failed, the worn armor's damage plus the
 * failure's 20% plus the companion's damage until then would reach 100%, or
 * the worn weapon's damage plus 20% would (the failure may pick either).
 * Armor first. Null when not at risk.
 */
export function armorAtRisk(state: CultivatorState, rules: RulesConfig = RULES_V1): ArmorRisk | null {
  const soon = dueSoon(state, rules);
  const armor = wornItem(state, "armor");
  const due = armor ? soon.find((d) => damageAtFailure(state, armor, d.deadline, rules) >= FULL_DURABILITY_BP) : undefined;
  if (armor && due) return { item: armor, tribulationId: due.tribulationId, deadline: due.deadline };
  // A failure's 20% can pick the weapon too (ruling 166); it takes no companion damage, so the line is 80%.
  const weapon = wornItem(state, "weapon");
  const first = soon[0];
  if (weapon && first && weapon.damageBp + rules.gear.failureDamageBp >= FULL_DURABILITY_BP) return { item: weapon, tribulationId: first.tribulationId, deadline: first.deadline };
  return null;
}

/**
 * When the before-deadline warning will start, for a push (ruling 153): 72
 * hours before the first deadline whose failure would break the worn armor.
 * The projection doesn't change as the days pass, so a risk that already
 * holds isn't pushed (the app shows it). One alert at most.
 */
export function armorRiskAlerts(state: CultivatorState, horizonMs: number, rules: RulesConfig = RULES_V1): { itemId: string; tribulationId: string; at: number }[] {
  const armor = wornItem(state, "armor");
  if (!armor) return [];
  for (const { tribulationId, deadline } of openTribulationDeadlines(state)) {
    const at = deadline - rules.gear.riskHours * HOUR;
    if (at <= state.clock || at > state.clock + horizonMs) continue;
    if (damageAtFailure(state, armor, deadline, rules) >= FULL_DURABILITY_BP) return [{ itemId: armor.id, tribulationId, at }];
  }
  return [];
}

/**
 * The stash armor a one-tap swap would wear (rulings 149, 153): wearable,
 * one a failure wouldn't break (for the tribulation due soonest within 72
 * hours, else for a deadline today), the best failure reduction, then the
 * least damaged. Null when there is none.
 */
export function bestStashArmor(state: CultivatorState, rules: RulesConfig = RULES_V1): GearItem | null {
  const deadline = armorAtRisk(state, rules)?.deadline ?? dueSoon(state, rules)[0]?.deadline ?? state.clock;
  const options = stash(state).filter((i) => i.slot === "armor" && wearable(state, i) && damageAtFailure(state, i, deadline, rules) < FULL_DURABILITY_BP);
  options.sort((a, b) => armorStats(b, rules).qi - armorStats(a, rules).qi || a.damageBp - b.damageBp || a.obtainedAt - b.obtainedAt);
  return options[0] ?? null;
}
