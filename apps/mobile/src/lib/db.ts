/**
 * Local event log. Only raw events are stored; every number on screen is
 * derived by replaying them through @cultivation/rules.
 */
import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { parseEvent, type GameEvent } from "@cultivation/schema";

export const DB_NAME = "cultivation.db";

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      at INTEGER NOT NULL,
      type TEXT NOT NULL,
      body TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notification_log (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      scheduled_for INTEGER NOT NULL,
      delivered_at INTEGER NOT NULL
    );
  `);
}

/** Events in the order they were appended (the order they must be replayed in). */
export async function loadEvents(db: SQLiteDatabase): Promise<GameEvent[]> {
  const rows = await db.getAllAsync<{ body: string }>("SELECT body FROM events ORDER BY seq");
  return rows.map((r) => parseEvent(JSON.parse(r.body)));
}

export async function appendEvent(db: SQLiteDatabase, e: GameEvent): Promise<void> {
  await db.runAsync("INSERT INTO events (id, user_id, at, type, body) VALUES (?, ?, ?, ?, ?)", [e.id, e.userId, e.at, e.type, JSON.stringify(e)]);
}

/** This device's user id, created on first launch (every event carries it). */
export async function getUserId(db: SQLiteDatabase): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'userId'");
  if (row) return row.value;
  const userId = Crypto.randomUUID();
  await db.runAsync("INSERT INTO meta (key, value) VALUES ('userId', ?)", [userId]);
  return userId;
}

export interface DeliveryRecord {
  id: string;
  kind: string;
  scheduledFor: number;
  deliveredAt: number;
}

/** Record when a scheduled notification was actually shown, to measure OS delays. */
export async function recordDelivery(db: SQLiteDatabase, r: DeliveryRecord): Promise<void> {
  await db.runAsync("INSERT OR IGNORE INTO notification_log (id, kind, scheduled_for, delivered_at) VALUES (?, ?, ?, ?)", [
    r.id,
    r.kind,
    r.scheduledFor,
    r.deliveredAt,
  ]);
}

export async function recentDeliveries(db: SQLiteDatabase, limit = 10): Promise<DeliveryRecord[]> {
  return db.getAllAsync<DeliveryRecord>(
    "SELECT id, kind, scheduled_for AS scheduledFor, delivered_at AS deliveredAt FROM notification_log ORDER BY delivered_at DESC LIMIT ?",
    [limit],
  );
}

/**
 * Device-only flags for one-time screens and prompts (the onboarding's area
 * step, the battery prompt). Game facts never go here: they are events.
 */
export async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}
