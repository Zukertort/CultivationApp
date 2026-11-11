/**
 * Push notification plan: which projected losses become push notifications,
 * and when. Only close losses push, at most a few a day, most urgent first
 * (design doc, Notifications). The app schedules the plan as local
 * notifications and rebuilds it after every event, sync and midnight.
 */
import { RULES_V1, type RulesConfig } from "./config.js";
import { companionAlertAt, demonAlerts, type CultivatorState, type DemonAlertKind } from "./engine.js";
import { questDeadlineAlerts } from "./main.js";
import { tribulationDeadlineAlerts } from "./tribulation.js";
import { DAY, MINUTE, localDay } from "./time.js";

export type PushKind =
  | "tribulation_deadline"
  | "rest_ending"
  | "quest_deadline"
  | "soul_broken"
  | "demon_near_revival"
  | "demon_near_violet"
  | "companion_hungry"
  | "daily_reminder";

export interface PushAlert {
  kind: PushKind;
  at: number;
  demonId?: string;
  questId?: string;
  tribulationId?: string;
  /** Hours left before a quest or tribulation deadline. */
  hoursLeft?: number;
  /** Moved earlier, out of quiet hours (ruling 129). */
  movedForQuiet?: boolean;
}

/** Most urgent first, in the doc's order (equipment comes with gear). The return date is never crowded out. */
const PRIORITY: readonly PushKind[] = [
  "tribulation_deadline",
  "rest_ending",
  "quest_deadline",
  "soul_broken",
  "demon_near_revival",
  "demon_near_violet",
  "companion_hungry",
  "daily_reminder",
];

/** What still pushes during a rest: tribulation deadlines keep running on vacation; closed-door rest mutes everything. */
const DURING_REST: Record<"vacation" | "closed_door", readonly PushKind[]> = {
  vacation: ["tribulation_deadline"],
  closed_door: [],
};

const FROM_DEMON: Partial<Record<DemonAlertKind, PushKind>> = {
  broken: "soul_broken",
  near_revival: "demon_near_revival",
  near_violet: "demon_near_violet",
};

/** The local day's start, as an instant. */
function dayStart(day: number, tz: number): number {
  return day * DAY - tz * MINUTE;
}

/**
 * Move an alert inside quiet hours to just before they start, never later
 * and never dropped (ruling 129). When the window's start is already past,
 * it goes out now.
 */
function outOfQuiet(a: PushAlert, quiet: { start: number; end: number } | null, tz: number, now: number): PushAlert {
  if (!quiet) return a;
  const day = localDay(a.at, tz);
  const minute = Math.floor((a.at - dayStart(day, tz)) / MINUTE);
  const { start, end } = quiet;
  const inside = start < end ? minute >= start && minute < end : minute >= start || minute < end;
  if (!inside) return a;
  // A window that wraps past midnight started the day before when the alert is after midnight.
  const windowDay = start < end || minute >= start ? day : day - 1;
  const at = Math.max(now, dayStart(windowDay, tz) + start * MINUTE - MINUTE);
  return { ...a, at, movedForQuiet: true };
}

/**
 * Push alerts from `now` to the scheduling horizon, at most
 * `maxPerDay` per local day, keeping the most urgent of each day. During the
 * current rest only tribulation deadlines push (on vacation), plus the
 * return date when the rest ends. Alerts inside quiet hours move to just
 * before they start (ruling 129), and a day with no other push gets the
 * daily reminder, unless a rest covers it (ruling 128).
 */
export function pushAlertPlan(state: CultivatorState, now: number, rules: RulesConfig = RULES_V1): PushAlert[] {
  const n = rules.notifications;
  const until = now + n.horizonDays * DAY;
  const candidates: PushAlert[] = [];

  for (const t of tribulationDeadlineAlerts(state, rules)) {
    candidates.push({ kind: "tribulation_deadline", at: t.at, tribulationId: t.tribulationId, hoursLeft: t.hoursLeft });
  }
  for (const q of questDeadlineAlerts(state, rules)) candidates.push({ kind: "quest_deadline", at: q.at, questId: q.questId, hoursLeft: q.hoursLeft });
  if (state.rest) candidates.push({ kind: "rest_ending", at: state.rest.end });
  const hungry = companionAlertAt(state, n.companionHungryFraction, rules);
  if (hungry !== null) candidates.push({ kind: "companion_hungry", at: hungry });
  for (const a of demonAlerts(state, rules)) {
    const kind = FROM_DEMON[a.kind];
    if (kind) candidates.push({ kind, at: a.at, demonId: a.demonId });
  }

  const tz = state.tzOffsetMinutes;
  const quiet = state.prefs.quiet;
  const byDay = new Map<number, PushAlert[]>();
  const rest = state.rest;
  for (const c of candidates) {
    if (c.at < now || c.at > until) continue;
    if (rest && c.at < rest.end && !DURING_REST[rest.kind].includes(c.kind)) continue;
    const moved = outOfQuiet(c, quiet, tz, now);
    const day = localDay(moved.at, tz);
    byDay.set(day, [...(byDay.get(day) ?? []), moved]);
  }
  const plan: PushAlert[] = [];
  for (const alerts of byDay.values()) {
    alerts.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || a.at - b.at);
    plan.push(...alerts.slice(0, n.maxPerDay));
  }
  // The daily reminder, on days with no other push, muted during any rest (ruling 128).
  const minutes = state.prefs.reminderMinutes ?? n.defaultReminderMinutes;
  for (let day = localDay(now, tz); day <= localDay(until, tz); day++) {
    if (byDay.has(day)) continue;
    const at = dayStart(day, tz) + minutes * MINUTE;
    if (at < now || at > until || (rest && at < rest.end)) continue;
    plan.push(outOfQuiet({ kind: "daily_reminder", at }, quiet, tz, now));
  }
  return plan.sort((a, b) => a.at - b.at);
}
