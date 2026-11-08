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
import { recordDelivery } from "./db";

export const CHANNEL_ID = "close-losses";

export const notificationsSupported = Platform.OS !== "web";

export type PermissionState = "granted" | "denied" | "unsupported";

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
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Close losses",
      description: "A demon near a threshold, the soul about to break, the companion about to leave",
      importance: Notifications.AndroidImportance.HIGH,
    });
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
    case "soul_broken":
      return { title: "My soul is about to break", body: "A heart demon is close to 90%. I should face it today." };
    case "demon_near_revival":
      return { title: "A defeated demon stirs", body: "One of my beaten demons is close to reviving. One practice session keeps it down." };
    case "demon_near_violet":
      return { title: "A heart demon is awakening", body: "A demon is close to 70%. Pushing it back before midnight keeps my soul's color." };
    case "companion_hungry":
      return { title: `The ${companionTier} is hungry`, body: "Train soon, or my companion will leave." };
  }
}

/** Replace the scheduled plan notifications with the given plan (test notifications are kept). */
export async function schedulePlan(plan: readonly PushAlert[], companionTier: string): Promise<void> {
  if (!notificationsSupported) return;
  for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
    if (n.content.data?.kind !== "test") await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  for (const a of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { ...alertText(a, companionTier), data: { kind: a.kind, scheduledFor: a.at } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(a.at), channelId: CHANNEL_ID },
    });
  }
}

/** A notification a few minutes out, to measure delivery delay on the device. */
export async function scheduleTest(minutes: number): Promise<void> {
  if (!notificationsSupported) return;
  const at = Date.now() + minutes * 60_000;
  await Notifications.scheduleNotificationAsync({
    content: { title: "Test from the System", body: `Scheduled for ${new Date(at).toLocaleTimeString()}.`, data: { kind: "test", scheduledFor: at } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: CHANNEL_ID },
  });
}

function scheduledFor(n: Notifications.Notification): number | null {
  const v = n.request.content.data?.scheduledFor;
  return typeof v === "number" ? v : null;
}

async function record(db: SQLiteDatabase, n: Notifications.Notification): Promise<void> {
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

export async function recordPresented(db: SQLiteDatabase): Promise<void> {
  if (!notificationsSupported) return;
  const shown = await Notifications.getPresentedNotificationsAsync();
  for (const n of shown) await record(db, n);
}
