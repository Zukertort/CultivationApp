/**
 * Keeps the device's scheduled notifications in step with the rules engine:
 * the plan is rebuilt whenever the derived state changes, when the app comes
 * back to the foreground, and on the minute tick (which crosses midnight).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { RULES_V1, pushAlertPlan, type PushAlert } from "@cultivation/rules";
import { recentDeliveries, type DeliveryRecord } from "./db";
import { recordPresented, schedulePlan, scheduleTest, setupNotifications, trackDeliveries, type PermissionState } from "./notify";
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
  const { state, now } = useStore();
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

  const plan = useMemo(() => (state.created ? pushAlertPlan(state, now, RULES_V1) : []), [state, now]);

  useEffect(() => {
    if (permission !== "granted") return;
    // Rescheduling cancels everything first, so skip it when nothing changed.
    const key = JSON.stringify(plan) + state.companion.tier;
    if (key === lastScheduled.current) return;
    lastScheduled.current = key;
    void schedulePlan(plan, state.companion.tier);
  }, [permission, plan, state.companion.tier]);

  const sendTest = useCallback((minutes: number) => scheduleTest(minutes), []);

  const value = useMemo(() => ({ permission, plan, deliveries, sendTest }), [permission, plan, deliveries, sendTest]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNotifications must be used inside NotificationsProvider");
  return v;
}
