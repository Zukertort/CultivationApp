/**
 * TEMPORARY on-device roller (dogfooding Step 0, option b). It stands in for
 * the server until the server exists: it rolls every pending random outcome
 * the rules engine reports and returns exactly the events the server will
 * append (SoulDropRolled, MainQuestDropRolled, TribulationDropRolled,
 * ClassDropRolled, BreakthroughRolled), so the event log never needs a
 * migration. Rolls made here are not tamper-proof; that is accepted while
 * dogfooding. Delete this module when the server rolls.
 */
import * as Crypto from "expo-crypto";
import {
  RULES_V1,
  breakthroughRollOutcome,
  classDropOutcome,
  pendingBreakthroughRolls,
  pendingClassDrops,
  pendingQuestRolls,
  pendingSoulRolls,
  pendingTribulationRolls,
  questDropOutcome,
  soulDropOutcome,
  tribulationDropOutcome,
  type CultivatorState,
} from "@cultivation/rules";
import type { EventInput } from "./store";

/** A uniform number in [0, 1) from the platform's secure random source. */
function uniform(): number {
  const b = Crypto.getRandomBytes(4);
  return (((b[0]! << 24) >>> 0) + (b[1]! << 16) + (b[2]! << 8) + b[3]!) / 2 ** 32;
}

/** The roll events for everything pending in `state`, in the order the server would append them. */
export function rollPending(state: CultivatorState): EventInput[] {
  const out: EventInput[] = [];
  for (const p of pendingSoulRolls(state.soul)) {
    const drops = Array.from({ length: p.count }, () => soulDropOutcome(p.color, p.polarity, uniform(), RULES_V1));
    out.push({ type: "SoulDropRolled", eventId: p.eventId, drops });
  }
  for (const p of pendingQuestRolls(state)) out.push({ type: "MainQuestDropRolled", eventId: p.eventId, drop: questDropOutcome(p.chance, uniform(), RULES_V1) });
  for (const p of pendingTribulationRolls(state)) out.push({ type: "TribulationDropRolled", eventId: p.eventId, drop: tribulationDropOutcome(uniform(), RULES_V1) });
  for (const p of pendingClassDrops(state)) out.push({ type: "ClassDropRolled", eventId: p.eventId, drop: classDropOutcome(p.group, p.chance, uniform()) });
  for (const p of pendingBreakthroughRolls(state)) out.push({ type: "BreakthroughRolled", step: p.step, item: breakthroughRollOutcome(p.chance, uniform()) });
  return out;
}
