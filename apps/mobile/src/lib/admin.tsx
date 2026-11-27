/**
 * Admin controls (ruling 84): screens ask here for controls that write
 * events not meant for normal play. The controls themselves live in src/dev,
 * so release bundles never contain them; there this context is always null.
 * In a development build they show only while the dev panel's admin mode is
 * on (Expo Go always runs with __DEV__ set, so __DEV__ alone isn't enough).
 */
import { createContext, useContext, type ComponentType } from "react";
import type { Realm } from "@cultivation/rules";

export type Result = (ok: boolean, text: string) => void;

export interface AdminControls {
  /** Advances one level or realm by RealmOverride (Realm screen). */
  RealmOverride: ComponentType<{ realm: Realm; onResult: Result }>;
}

export const AdminContext = createContext<AdminControls | null>(null);

/** The admin controls, or null in normal play. */
export function useAdmin(): AdminControls | null {
  return useContext(AdminContext);
}
