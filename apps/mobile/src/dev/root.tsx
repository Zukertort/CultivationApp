/**
 * DEV ONLY (required from the root layout under `if (__DEV__)`, so release
 * bundles leave it out). Chooses the database the app opens and remounts the
 * app when a scenario is loaded or the mode changes; while it does, no
 * database is open.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { AdminContext } from "../lib/admin";
import { setClockOffset } from "../lib/clock";
import { DB_NAME } from "../lib/db";
import { C, T } from "../lib/ui";
import { ADMIN_CONTROLS } from "./admin";
import { databaseErrorText } from "../lib/db-errors";
import { DevContext, type Dev } from "./context";
import { loadScenario, readDevSettings, readScenarioInfo, writeAdmin, writeMode, SCENARIO_DB, type Mode } from "./loader";
import { DevPanel } from "./panel";

type Phase = { kind: "starting" } | { kind: "busy"; label: string } | { kind: "open"; mode: Mode; scenarioId: string | null; generation: number } | { kind: "error"; message: string };

/** `render(dbName, overlay)`: the app on that database, with the dev overlay inside its providers. */
export function DevRoot({ render }: { render: (dbName: string, overlay: ReactNode) => ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  const [lastLoad, setLastLoad] = useState<Dev["lastLoad"]>(null);
  const generation = useRef(0);
  const [admin, setAdminState] = useState(false);
  const setAdmin = useCallback((on: boolean) => {
    setAdminState(on);
    void writeAdmin(on);
  }, []);

  const open = useCallback(async (mode: Mode) => {
    if (mode === "real") {
      // The real log never runs on a moved clock.
      setClockOffset(0);
      return { kind: "open" as const, mode, scenarioId: null };
    }
    const info = await readScenarioInfo();
    setClockOffset(info.offsetMs);
    return { kind: "open" as const, mode, scenarioId: info.id };
  }, []);

  // One read of the dev settings at startup: two first opens racing in expo-sqlite's web worker each set up
  // SQLite and its file pool, and the loser crashes on the files the winner holds (the web startup crash).
  useEffect(() => {
    void readDevSettings()
      .then((settings) => {
        setAdminState(settings.admin);
        return open(settings.mode);
      })
      .then((p) => setPhase({ ...p, generation: 0 }))
      .catch((e: unknown) => setPhase({ kind: "error", message: databaseErrorText(e) }));
  }, [open]);

  const setMode = useCallback(
    (mode: Mode) => {
      setLastLoad(null);
      setPhase({ kind: "busy", label: mode === "real" ? "Opening my log…" : "Opening the scenario…" });
      void writeMode(mode)
        .then(() => open(mode))
        .then((p) => setPhase({ ...p, generation: ++generation.current }))
        .catch((e: unknown) => setPhase({ kind: "error", message: databaseErrorText(e) }));
    },
    [open],
  );

  const load = useCallback(
    (id: string) => {
      setPhase({ kind: "busy", label: `Building ${id}…` });
      // Let the loading screen render (and the scenario database close) before the build blocks the JS thread.
      setTimeout(() => {
        void (async () => {
          try {
            const r = await loadScenario(id);
            await writeMode("scenario");
            const p = await open("scenario");
            setLastLoad({ ...r, id });
            setPhase({ ...p, generation: ++generation.current });
          } catch (e) {
            setPhase({ kind: "error", message: databaseErrorText(e) });
          }
        })();
      }, 50);
    },
    [open],
  );

  if (phase.kind !== "open") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 }}>
        {phase.kind === "error" ? <T>Dev tools: {phase.message}</T> : <ActivityIndicator color={C.gold} />}
        {phase.kind === "busy" ? <T muted>{phase.label}</T> : null}
      </View>
    );
  }
  const dev: Dev = { mode: phase.mode, scenarioId: phase.scenarioId, lastLoad, load, setMode, admin, setAdmin };
  const dbName = phase.mode === "scenario" ? SCENARIO_DB : DB_NAME;
  return (
    <DevContext.Provider value={dev}>
      {/* A new key per open: the store reloads from the database it now points at. */}
      <AdminContext.Provider value={admin ? ADMIN_CONTROLS : null}>
        <View key={`${dbName}#${phase.generation}`} style={{ flex: 1 }}>
          {render(dbName, <DevPanel />)}
        </View>
      </AdminContext.Provider>
    </DevContext.Provider>
  );
}
