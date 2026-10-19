/**
 * Pit Stop Persistence Store
 *
 * Uses expo-sqlite to persist an in-progress pit stop across app kills/restarts.
 * There is at most ONE active pit stop at a time per trip.
 *
 * Schema
 * ──────
 * active_pit_stop (single row):
 *   id         TEXT  — uuid
 *   trip_key   TEXT  — client_id of the current trip (matches offlineQueue key)
 *   lat        REAL
 *   lng        REAL
 *   started_ms INTEGER — epoch ms when pause was pressed
 *   tag        TEXT  — nullable: 'fuel' | 'food' | 'rest' | 'other'
 */

import * as SQLite from 'expo-sqlite';
import type { PitStopTag } from '@/utils/telemetry';

export interface ActivePitStop {
  id: string;
  tripKey: string;
  lat: number;
  lng: number;
  startedMs: number;
  tag: PitStopTag | null;
}

const DB_NAME = 'slipstream_pitstops.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS active_pit_stop (
          id         TEXT    NOT NULL,
          trip_key   TEXT    NOT NULL,
          lat        REAL    NOT NULL,
          lng        REAL    NOT NULL,
          started_ms INTEGER NOT NULL,
          tag        TEXT
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

/** Persist a new active pit stop, replacing any existing row */
export async function savePitStop(stop: ActivePitStop): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM active_pit_stop;');
  await db.runAsync(
    `INSERT INTO active_pit_stop (id, trip_key, lat, lng, started_ms, tag)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [stop.id, stop.tripKey, stop.lat, stop.lng, stop.startedMs, stop.tag ?? null],
  );
}

/** Load the persisted pit stop, or null if none exists */
export async function loadActivePitStop(): Promise<ActivePitStop | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{
      id: string;
      trip_key: string;
      lat: number;
      lng: number;
      started_ms: number;
      tag: string | null;
    }>('SELECT * FROM active_pit_stop LIMIT 1;');

    if (!row) return null;

    return {
      id: row.id,
      tripKey: row.trip_key,
      lat: row.lat,
      lng: row.lng,
      startedMs: row.started_ms,
      tag: (row.tag as PitStopTag | null) ?? null,
    };
  } catch (err) {
    console.warn('[PitStopStore] Failed to load active pit stop:', err);
    return null;
  }
}

/** Update only the tag of the current active pit stop */
export async function updatePitStopTag(tag: PitStopTag): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE active_pit_stop SET tag = ?;', [tag]);
}

/** Clear the persisted pit stop (called on resume or trip end) */
export async function clearPitStop(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM active_pit_stop;');
}
