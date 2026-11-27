/**
 * Test-only helpers. Tests of other paths that run for weeks past Foundation
 * use `noWear`, so the companion's gear damage and the unarmored loss
 * (rulings 147, 154) don't move the Qi and gold they measure. Not exported
 * from the package.
 */
import type { GameEvent } from "@cultivation/schema";
import { RULES_V1, TIERS, type RulesConfig } from "./config.js";
import { replay, type CultivatorState } from "./engine.js";
import { RuleViolation } from "./errors.js";

export const noWear = (rules: RulesConfig): RulesConfig => ({
  ...rules,
  gear: { ...rules.gear, companionDamageBp: Object.fromEntries(TIERS.map((t) => [t, 0])) as RulesConfig["gear"]["companionDamageBp"] },
});

/**
 * A replay that fails the test when the rules skipped an event (ruling 168):
 * test fixtures build state from logs that should be valid, so a skip is a
 * broken fixture, not something to ignore.
 */
export function strictReplay(events: readonly GameEvent[], rules: RulesConfig = RULES_V1, until?: number): CultivatorState {
  const s = replay(events, rules, until);
  const skipped = s.anomalies.find((a) => a.code === "replay_skipped");
  if (skipped) {
    // "<type> <id>: <code>: <message>": throw the rule's own violation, so tests can assert on its code.
    const m = /^\S+ \S+: ([a-z_]+): (.*)$/.exec(skipped.detail ?? "");
    if (m) throw new RuleViolation(m[1]!, m[2]!);
    throw new Error(`a fixture event was skipped: ${skipped.detail}`);
  }
  return s;
}
