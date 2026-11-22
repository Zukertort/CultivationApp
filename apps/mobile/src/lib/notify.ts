/**
 * Local notifications. The rules engine decides what to push and when
 * (pushAlertPlan, built from companionAlertAt and demonAlerts); this file only
 * schedules that plan on the device and measures how late the OS delivers.
 *
 * Android delivers DATE triggers "at an approximate time" unless the app holds
 * the exact-alarm permission. These alerts are early warnings (within 5% of a
 * line), so approximate delivery is acceptable and the app doesn't ask for it.
 * Samsung One UI may delay inexact alarms further for apps it puts to sleep;
 * the delivery log below measures that on a real device.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { SQLiteDatabase } from "expo-sqlite";
import type { PushAlert } from "@cultivation/rules";
import { clockOffset } from "./clock";
import { recordDelivery } from "./db";

export const CHANNEL_ID = "close-losses";

/** The armor pushes carry two one-tap actions (ruling 149); each opens the app, which logs the event. */
export const GEAR_CATEGORY = "gear";
const GEAR_KINDS: readonly PushAlert["kind"][] = ["gear_breaking", "armor_at_risk"];

export const notificationsSupported = Platform.OS !== "web";

export type PermissionState = "granted" | "denied" | "unsupported";

let channelReady = false;

/** A trigger at device time `at` (a dev scenario's clock offset already taken off). */
const dateTrigger = (at: number): Notifications.NotificationTriggerInput => ({
  type: Notifications.SchedulableTriggerInputTypes.DATE,
  date: new Date(at),
  ...(channelReady ? { channelId: CHANNEL_ID } : {}),
});

export async function setupNotifications(): Promise<PermissionState> {
  if (!notificationsSupported) return "unsupported";
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    // Expo Go 58.0.5 on Android 16 / One UI 8.5 throws a NullPointerException
    // here. Don't let that block the permission request: fall back to the
    // default channel.
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Close losses",
        description: "A demon near a threshold, the soul about to break, the companion about to leave",
        importance: Notifications.AndroidImportance.HIGH,
      });
      channelReady = true;
    } catch (e) {
      console.warn("Notification channel not created; using the default channel.", e);
    }
  }
  try {
    await Notifications.setNotificationCategoryAsync(GEAR_CATEGORY, [
      { identifier: "swap", buttonTitle: "Swap armor", options: { opensAppToForeground: true } },
      { identifier: "repair", buttonTitle: "Repair", options: { opensAppToForeground: true } },
    ]);
  } catch (e) {
    console.warn("Notification actions not set up; the armor pushes open the Store instead.", e);
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted ? "granted" : "denied";
}

/**
 * Notification text. Lock screens are visible to others, so demon names never
 * appear here (the doc keeps soul details opt-in).
 */
export function alertText(a: PushAlert, companionTier: string): { title: string; body: string } {
  switch (a.kind) {
    case "tribulation_deadline":
      return {
        title: "A tribulation deadline is close",
        body: a.hoursLeft === 1 ? "One hour left on a tribulation. There are no extensions." : `${a.hoursLeft ?? ""} hours left on a tribulation. There are no extensions.`,
      };
    case "rest_ending":
      return { title: "My rest is over", body: "Time to return to cultivation." };
    case "quest_deadline":
      return { title: "A quest deadline is close", body: a.hoursLeft === 1 ? "One hour left on a quest. Finish it or it expires." : `${a.hoursLeft ?? ""} hours left on a quest.` };
    case "soul_broken":
      return { title: "My soul is about to break", body: "A heart demon is close to 90%. I should face it today." };
    case "demon_near_revival":
      return { title: "A defeated demon stirs", body: "One of my beaten demons is close to reviving. One practice session keeps it down." };
    case "demon_near_violet":
      return { title: "A heart demon is awakening", body: "A demon is close to 70%. Pushing it back before midnight keeps my soul's color." };
    case "companion_hungry":
      return { title: `The ${companionTier} is hungry`, body: "Train soon, or my companion will leave." };
    case "gear_breaking":
      return { title: "My equipment is almost broken", body: "I should repair it before it's lost." };
    case "armor_at_risk":
      return { title: "My armor would break on a failure", body: "A tribulation is due within 72 hours. Repair the armor or wear another." };
    case "daily_reminder":
      return { title: "Time to cultivate", body: "Nothing urgent today. A look at my to-do list keeps the path moving." };
  }
}

/** The database file a notification was scheduled from, so one scheduled from a dev scenario is never logged into the real log's delivery table. */
export const dbTag = (db: SQLiteDatabase) => db.databasePath.split(/[\\/]/).pop() ?? "";

/** Replace the scheduled plan notifications with the given plan (test notifications are kept). */
export async function schedulePlan(plan: readonly PushAlert[], companionTier: string, db: string): Promise<void> {
  if (!notificationsSupported) return;
  for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
    if (n.content.data?.kind !== "test") await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  // The plan is in game time; in a dev scenario with time travel the device fires it that much earlier.
  const offset = clockOffset();
  for (const a of plan) {
    await Notifications.scheduleNotificationAsync({
      content: {
        ...alertText(a, companionTier),
        data: { kind: a.kind, scheduledFor: a.at, firesAt: a.at - offset, db },
        ...(GEAR_KINDS.includes(a.kind) ? { categoryIdentifier: GEAR_CATEGORY } : {}),
      },
      trigger: dateTrigger(a.at - offset),
    });
  }
}

/** A notification a few minutes out, to measure delivery delay on the device. */
export async function scheduleTest(minutes: number): Promise<void> {
  if (!notificationsSupported) return;
  const at = Date.now() + minutes * 60_000;
  await Notifications.scheduleNotificationAsync({
    content: { title: "Test from the System", body: `Scheduled for ${new Date(at).toLocaleTimeString()}.`, data: { kind: "test", scheduledFor: at } },
    trigger: dateTrigger(at),
  });
}

/** When the OS was asked to show it, in device time (delays are measured against this). */
function scheduledFor(n: Notifications.Notification): number | null {
  const v = n.request.content.data?.firesAt ?? n.request.content.data?.scheduledFor;
  return typeof v === "number" ? v : null;
}

async function record(db: SQLiteDatabase, n: Notifications.Notification): Promise<void> {
  // Scheduled from another database (a dev scenario's, or the real log's while a scenario is open): not ours to log.
  const from = n.request.content.data?.db;
  if (typeof from === "string" && from !== dbTag(db)) return;
  const planned = scheduledFor(n);
  if (planned === null) return;
  const kind = String(n.request.content.data?.kind ?? "unknown");
  await recordDelivery(db, { id: n.request.identifier, kind, scheduledFor: planned, deliveredAt: n.date });
}

/**
 * Log delivery times: notifications received while the app is open, plus the
 * ones still in the tray when it comes back (their `date` is when the OS
 * showed them). Returns an unsubscribe function.
 */
export function trackDeliveries(db: SQLiteDatabase, onRecorded: () => void): () => void {
  if (!notificationsSupported) return () => {};
  const sub = Notifications.addNotificationReceivedListener((n) => {
    void record(db, n).then(onRecorded);
  });
  return () => sub.remove();
}

/** What a tap on an armor push asks for: one of its actions, or (a plain tap) to open the Store. Null for other pushes or another database's. */
export type GearTap = { id: string; action: "swap" | "repair" | "open" };

export function gearTap(r: Notifications.NotificationResponse, db: SQLiteDatabase): GearTap | null {
  const data = r.notification.request.content.data;
  if (!GEAR_KINDS.includes(data?.kind as PushAlert["kind"])) return null;
  if (typeof data?.db === "string" && data.db !== dbTag(db)) return null;
  const a = r.actionIdentifier;
  const action = a === "swap" || a === "repair" ? a : "open";
  return { id: `${r.notification.request.identifier}:${a}`, action };
}

/** Listen for taps on armor pushes, including the one that launched the app. Returns an unsubscribe function. */
export function onGearTap(db: SQLiteDatabase, handle: (t: GearTap) => void): () => void {
  if (!notificationsSupported) return () => {};
  void Notifications.getLastNotificationResponseAsync().then((r) => {
    const t = r ? gearTap(r, db) : null;
    if (t) handle(t);
  });
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const t = gearTap(r, db);
    if (t) handle(t);
  });
  return () => sub.remove();
}

export async function recordPresented(db: SQLiteDatabase): Promise<void> {
  if (!notificationsSupported) return;
  const shown = await Notifications.getPresentedNotificationsAsync();
  for (const n of shown) await record(db, n);
}
