/**
 * DEV ONLY. Which database the app opens (the real log or the scenario
 * database), and loading a scenario into the scenario database.
 *
 * The real log (cultivation.db) is never written here: the mode lives in its
 * own small database (cultivation-dev.db), and every write below goes to
 * cultivation-scenario.db, guarded by assertScenarioDb.
 */
import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { RULES_V1, advanceTo, replay, type CultivatorState } from "@cultivation/rules";
import { findScenario } from "@cultivation/scenarios";
import { lastEntry } from "../lib/breakthrough";
import { DB_NAME, getMeta, getUserId, migrate, setMeta } from "../lib/db";

export const SCENARIO_DB = "cultivation-scenario.db";
const DEV_DB = "cultivation-dev.db";

export type Mode = "real" | "scenario";

/** Device-only meta keys in the scenario database. */
export const META = { scenario: "dev_scenario", offset: "dev_clock_offset" } as const;
/** The app's own one-time flags, set so a loaded scenario opens on its tabs. */
const AREAS_STEP = "onboarding_areas_done";
const REALM_ENTRY_SEEN = "realm_entry_seen";

function assertScenarioDb(name: string): void {
  if (name === DB_NAME || name !== SCENARIO_DB) throw new Error(`dev tools write only to ${SCENARIO_DB}`);
}

async function withDevDb<T>(f: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const db = await openDatabaseAsync(DEV_DB);
  try {
    await db.execAsync("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    return await f(db);
  } finally {
    await db.closeAsync();
  }
}

export async function readMode(): Promise<Mode> {
  return withDevDb(async (db) => {
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = 'mode'");
    return row?.value === "scenario" ? "scenario" : "real";
  });
}

export async function writeMode(mode: Mode): Promise<void> {
  await withDevDb((db) => db.runAsync("INSERT INTO kv (key, value) VALUES ('mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [mode]).then(() => {}));
}

async function withScenarioDb<T>(f: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  assertScenarioDb(SCENARIO_DB);
  const db = await openDatabaseAsync(SCENARIO_DB);
  try {
    await migrate(db);
    return await f(db);
  } finally {
    await db.closeAsync();
  }
}

export interface ScenarioInfo {
  id: string | null;
  offsetMs: number;
}

export async function readScenarioInfo(): Promise<ScenarioInfo> {
  return withScenarioDb(async (db) => ({
    id: await getMeta(db, META.scenario),
    offsetMs: Number((await getMeta(db, META.offset)) ?? 0) || 0,
  }));
}

/** Persist the time-travel offset; the database must be the scenario one. */
export async function saveOffset(db: SQLiteDatabase, offsetMs: number): Promise<void> {
  assertScenarioDb(db.databasePath.split(/[\\/]/).pop() ?? "");
  await setMeta(db, META.offset, String(offsetMs));
}

/** Local midnight of the device's today. */
function todayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface LoadResult {
  events: number;
  ms: number;
  /** What the scenario says that doesn't hold after loading (empty when it does). */
  problems: string[];
}

/**
 * Replace the scenario database with a freshly built scenario. Call it with
 * the scenario database closed (the app shows a loading screen meanwhile).
 */
export async function loadScenario(id: string): Promise<LoadResult> {
  const sc = findScenario(id);
  if (!sc) throw new Error(`unknown scenario ${id}`);
  const started = Date.now();
  assertScenarioDb(SCENARIO_DB);
  try {
    await deleteDatabaseAsync(SCENARIO_DB);
  } catch {
    // Not there yet, or the platform can't delete it: the tables are emptied below.
  }
  return withScenarioDb(async (db) => {
    await db.execAsync("DELETE FROM events; DELETE FROM meta WHERE key <> 'userId'; DELETE FROM notification_log;");
    const userId = await getUserId(db);
    const today = todayMidnight();
    const tzOffsetMinutes = -new Date().getTimezoneOffset();
    const events = sc.build({ today, tzOffsetMinutes, userId });
    const insert = await db.prepareAsync("INSERT INTO events (id, user_id, at, type, body) VALUES (?, ?, ?, ?, ?)");
    try {
      await db.withTransactionAsync(async () => {
        for (const e of events) await insert.executeAsync([e.id, e.userId, e.at, e.type, JSON.stringify(e)]);
      });
    } finally {
      await insert.finalizeAsync();
    }
    const replayed = replay(events, RULES_V1);
    await setMeta(db, META.scenario, sc.id);
    await setMeta(db, META.offset, "0");
    await setMeta(db, AREAS_STEP, "1");
    const entry = lastEntry(replayed.progress.steps);
    if (entry) await setMeta(db, REALM_ENTRY_SEEN, String(entry.step));
    const at = Date.now();
    const state: CultivatorState = replayed.created ? advanceTo(replayed, Math.max(at, replayed.clock), RULES_V1) : replayed;
    return { events: events.length, ms: Date.now() - started, problems: sc.check(state, at) };
  });
}
