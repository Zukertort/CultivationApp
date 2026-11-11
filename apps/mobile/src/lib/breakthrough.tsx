/**
 * After any breakthrough, open the Trials tab on the new realm's intro: its
 * purpose, good and bad examples, and what to do next (the "realm intro
 * screens" item). The last realm entry seen is kept on the device, so each
 * entry is shown once, even one made while onboarding.
 */
import { useEffect } from "react";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import type { ProgressStep } from "@cultivation/rules";
import { getMeta, setMeta } from "./db";
import { useStore } from "./store";

const SEEN = "realm_entry_seen";

/** The step that last entered a new realm: a breakthrough, or an override into a different realm. */
function lastEntry(steps: readonly ProgressStep[]): ProgressStep | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const x = steps[i]!;
    if (x.repented) continue;
    if (x.kind === "breakthrough" || (x.kind === "override" && i > 0 && steps[i - 1]!.realm !== x.realm)) return x;
  }
  return null;
}

export function BreakthroughWatcher() {
  const db = useSQLiteContext();
  const { state } = useStore();
  const entry = lastEntry(state.progress.steps);
  const key = entry ? String(entry.step) : null;
  const realm = state.main.realm;

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    void getMeta(db, SEEN).then((seen) => {
      if (cancelled || seen === key) return;
      void setMeta(db, SEEN, key);
      // Only announce the realm the cultivator is in now (a repent may have dropped them back).
      router.navigate({ pathname: "/trials", params: { entered: realm } });
    });
    return () => {
      cancelled = true;
    };
  }, [db, key, realm]);

  return null;
}
