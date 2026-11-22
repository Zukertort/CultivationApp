/**
 * Keeps the device's scheduled notifications in step with the rules engine:
 * the plan is rebuilt whenever the derived state changes, when the app comes
 * back to the foreground, and on the minute tick (which crosses midnight).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, AppState } from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { RULES_V1, pushAlertPlan, type PushAlert } from "@cultivation/rules";
import { getMeta, recentDeliveries, setMeta, type DeliveryRecord } from "./db";
import { armorActionInput } from "./gear";
import { dbTag, onGearTap, recordPresented, schedulePlan, scheduleTest, setupNotifications, trackDeliveries, type GearTap, type PermissionState } from "./notify";
import { useStore } from "./store";

interface NotificationsState {
  permission: PermissionState | "pending";
  plan: PushAlert[];
  deliveries: DeliveryRecord[];
  sendTest: (minutes: number) => Promise<void>;
}

const Ctx = createContext<NotificationsState | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { state, now, log, ready } = useStore();
  const [permission, setPermission] = useState<NotificationsState["permission"]>("pending");
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const lastScheduled = useRef("");

  const refreshDeliveries = useCallback(() => {
    void recentDeliveries(db).then(setDeliveries);
  }, [db]);

  useEffect(() => {
    void setupNotifications().then(setPermission);
    void recordPresented(db).then(refreshDeliveries);
    const unsubscribe = trackDeliveries(db, refreshDeliveries);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void recordPresented(db).then(refreshDeliveries);
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [db, refreshDeliveries]);

  // A tap on an armor push: the action runs on the state at the tap, never on its own (ruling 149).
  const latest = useRef({ state, log });
  useEffect(() => {
    latest.current = { state, log };
  }, [state, log]);
  useEffect(() => {
    if (!ready) return;
    const handle = async (t: GearTap) => {
      // The launching response comes back on every start: handle each tap once.
      if ((await getMeta(db, "gear_tap_handled")) === t.id) return;
      await setMeta(db, "gear_tap_handled", t.id);
      router.navigate("/store");
      if (t.action === "open") return;
      const { state: s, log: write } = latest.current;
      const a = armorActionInput(s, t.action);
      if ("error" in a) return Alert.alert("System", a.error);
      const r = await write(a.input);
      Alert.alert("System", r.ok ? a.done : r.message);
    };
    return onGearTap(db, (t) => void handle(t));
  }, [db, ready]);

  const plan = useMemo(() => (state.created ? pushAlertPlan(state, now, RULES_V1) : []), [state, now]);

  useEffect(() => {
    if (permission !== "granted") return;
    // Rescheduling cancels everything first, so skip it when nothing changed.
    const key = JSON.stringify(plan) + state.companion.tier;
    if (key === lastScheduled.current) return;
    lastScheduled.current = key;
    void schedulePlan(plan, state.companion.tier, dbTag(db));
  }, [db, permission, plan, state.companion.tier]);

  const sendTest = useCallback((minutes: number) => scheduleTest(minutes), []);

  const value = useMemo(() => ({ permission, plan, deliveries, sendTest }), [permission, plan, deliveries, sendTest]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNotifications must be used inside NotificationsProvider");
  return v;
}
