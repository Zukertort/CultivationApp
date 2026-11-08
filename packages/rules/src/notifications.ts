/**
 * Push notification plan: which projected losses become push notifications,
 * and when. Only close losses push, at most a few a day, most urgent first
 * (design doc, Notifications). The app schedules the plan as local
 * notifications and rebuilds it after every event, sync and midnight.
 */
import { RULES_V1, type RulesConfig } from "./config.js";
import { companionAlertAt, demonAlerts, type CultivatorState, type DemonAlertKind } from "./engine.js";
import { DAY, localDay } from "./time.js";

export type PushKind = "soul_broken" | "demon_near_revival" | "demon_near_violet" | "companion_hungry";

export interface PushAlert {
  kind: PushKind;
  at: number;
  demonId?: string;
}

/** Most urgent first, in the doc's order (tribulation deadlines and equipment come later). */
const PRIORITY: readonly PushKind[] = ["soul_broken", "demon_near_revival", "demon_near_violet", "companion_hungry"];

const FROM_DEMON: Partial<Record<DemonAlertKind, PushKind>> = {
  broken: "soul_broken",
  near_revival: "demon_near_revival",
  near_violet: "demon_near_violet",
};

/**
 * Push alerts from `now` to the scheduling horizon, at most
 * `maxPerDay` per local day, keeping the most urgent of each day.
 */
export function pushAlertPlan(state: CultivatorState, now: number, rules: RulesConfig = RULES_V1): PushAlert[] {
  const n = rules.notifications;
  const until = now + n.horizonDays * DAY;
  const candidates: PushAlert[] = [];

  const hungry = companionAlertAt(state, n.companionHungryFraction, rules);
  if (hungry !== null) candidates.push({ kind: "companion_hungry", at: hungry });
  for (const a of demonAlerts(state, rules)) {
    const kind = FROM_DEMON[a.kind];
    if (kind) candidates.push({ kind, at: a.at, demonId: a.demonId });
  }

  const byDay = new Map<number, PushAlert[]>();
  for (const c of candidates) {
    if (c.at < now || c.at > until) continue;
    const day = localDay(c.at, state.tzOffsetMinutes);
    byDay.set(day, [...(byDay.get(day) ?? []), c]);
  }
  const plan: PushAlert[] = [];
  for (const alerts of byDay.values()) {
    alerts.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || a.at - b.at);
    plan.push(...alerts.slice(0, n.maxPerDay));
  }
  return plan.sort((a, b) => a.at - b.at);
}
