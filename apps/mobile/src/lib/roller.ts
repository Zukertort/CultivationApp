/**
 * TEMPORARY on-device roller (dogfooding Step 0, option b). It stands in for
 * the server until the server exists: it rolls every pending random outcome
 * the rules engine reports and returns exactly the events the server will
 * append (SoulDropRolled, MainQuestDropRolled, TribulationDropRolled,
 * ClassDropRolled, BreakthroughRolled), so the event log never needs a
 * migration. A legendary outcome carries its slot, and a wearable class drop
 * its legendary flag, both from the same roll (ruling 176). Rolls made here
 * are not tamper-proof; that is accepted while dogfooding. Delete this module
 * when the server rolls.
 */
import * as Crypto from "expo-crypto";
import {
  RULES_V1,
  breakthroughRollOutcome,
  breakthroughRollSlot,
  classDropRoll,
  pendingBreakthroughRolls,
  pendingClassDrops,
  pendingQuestRolls,
  pendingSoulRolls,
  pendingTribulationRolls,
  questDropOutcome,
  soulDropOutcome,
  soulDropSlot,
  tribulationDropOutcome,
  type CultivatorState,
} from "@cultivation/rules";
import type { GearSlot } from "@cultivation/schema";
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
    const us = Array.from({ length: p.count }, () => uniform());
    const drops = us.map((u) => soulDropOutcome(p.color, p.polarity, u, RULES_V1));
    const legendarySlots = us.map((u) => soulDropSlot(p.color, p.polarity, u, RULES_V1)).filter((x): x is GearSlot => x !== undefined);
    out.push({ type: "SoulDropRolled", eventId: p.eventId, drops, ...(legendarySlots.length > 0 ? { legendarySlots } : {}) });
  }
  for (const p of pendingQuestRolls(state)) out.push({ type: "MainQuestDropRolled", eventId: p.eventId, drop: questDropOutcome(p.chance, uniform(), RULES_V1) });
  for (const p of pendingTribulationRolls(state)) out.push({ type: "TribulationDropRolled", eventId: p.eventId, drop: tribulationDropOutcome(uniform(), RULES_V1) });
  for (const p of pendingClassDrops(state)) out.push({ type: "ClassDropRolled", eventId: p.eventId, ...classDropRoll(p.group, p.chance, uniform(), RULES_V1) });
  for (const p of pendingBreakthroughRolls(state)) {
    const u = uniform();
    const slot = breakthroughRollSlot(p.chance, u);
    out.push({ type: "BreakthroughRolled", step: p.step, item: breakthroughRollOutcome(p.chance, u), ...(slot ? { slot } : {}) });
  }
  return out;
}
