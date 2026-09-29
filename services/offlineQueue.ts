/**
 * Offline Queue Service — Phase 16
 *
 * Buffers failed Supabase writes in expo-sqlite and replays them
 * when connectivity returns. Each record carries a client_id UUID
 * so retried upserts are idempotent — no duplicate trips, drag runs,
 * or hazard reports ever hit the database.
 *
 * Architecture:
 *   - offlineQueue(id, type, payload, attempts, created_at) SQLite table
 *   - NetInfo listener calls flushQueue() on reconnect
 *   - Callers wrap any Supabase write in enqueueOrExec()
 */

import * as SQLite from 'expo-sqlite';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';

// ─── DB Initialisation ────────────────────────────────────────────────────────

const DB_NAME = 'slipstream_offline.db';
const MAX_ATTEMPTS = 5; // give up after 5 failed retries per record

let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      payload     TEXT NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS offline_queue_type_idx ON offline_queue (type);
  `);
  return _db;
}

// ─── Queue Record Types ───────────────────────────────────────────────────────

export type QueueRecordType = 'trip' | 'drag_run' | 'hazard_report';

export interface QueueRecord {
  id: string;
  type: QueueRecordType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
  attempts: number;
  createdAt: number;
}

// ─── State & Observers ───────────────────────────────────────────────────────

export type QueueStatus = 'idle' | 'syncing' | 'error';

type StatusListener = (status: QueueStatus, pendingCount: number) => void;
const listeners = new Set<StatusListener>();
let currentStatus: QueueStatus = 'idle';
let pendingCount = 0;

export function subscribeToQueueStatus(fn: StatusListener): () => void {
  listeners.add(fn);
  fn(currentStatus, pendingCount); // immediate hydration
  return () => listeners.delete(fn);
}

function emit(status: QueueStatus, count: number) {
  currentStatus = status;
  pendingCount = count;
  listeners.forEach((fn) => fn(status, count));
}

// ─── Core Queue Operations ────────────────────────────────────────────────────

/**
 * Generates a v4-ish UUID without crypto.randomUUID() to avoid
 * Hermes compatibility issues.
 */
export function generateClientId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function enqueue(
  type: QueueRecordType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
): Promise<void> {
  const db = await getDb();
  const id = payload.client_id ?? generateClientId();
  await db.runAsync(
    `INSERT OR REPLACE INTO offline_queue (id, type, payload, attempts)
     VALUES (?, ?, ?, 0)`,
    [id, type, JSON.stringify(payload)],
  );
  const rows = await db.getAllAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM offline_queue`,
  );
  emit('idle', rows[0]?.count ?? 0);
}

async function dequeue(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `DELETE FROM offline_queue WHERE id IN (${placeholders})`,
    ids,
  );
}

async function incrementAttempts(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE offline_queue SET attempts = attempts + 1 WHERE id IN (${placeholders})`,
    ids,
  );
  // Drop records that have exceeded max attempts — they'll never succeed
  await db.runAsync(
    `DELETE FROM offline_queue WHERE attempts >= ?`,
    [MAX_ATTEMPTS],
  );
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM offline_queue`,
  );
  return rows[0]?.count ?? 0;
}

// ─── Flush ───────────────────────────────────────────────────────────────────

let isFlushing = false;

export async function flushQueue(): Promise<void> {
  if (isFlushing) return;
  isFlushing = true;

  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string;
      type: string;
      payload: string;
      attempts: number;
    }>(`SELECT * FROM offline_queue ORDER BY created_at ASC LIMIT 50`);

    if (rows.length === 0) {
      emit('idle', 0);
      return;
    }

    emit('syncing', rows.length);

    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const row of rows) {
      const record = JSON.parse(row.payload) as Record<string, unknown>;
      try {
        await syncRecord(row.type as QueueRecordType, record);
        succeeded.push(row.id);
      } catch (err) {
        console.warn(`[offlineQueue] Sync failed for ${row.id}:`, err);
        failed.push(row.id);
      }
    }

    await dequeue(succeeded);
    if (failed.length) await incrementAttempts(failed);

    const remaining = await getPendingCount();
    emit(failed.length > 0 ? 'error' : 'idle', remaining);
  } finally {
    isFlushing = false;
  }
}

// ─── Per-Type Sync Logic ─────────────────────────────────────────────────────

async function syncRecord(
  type: QueueRecordType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
): Promise<void> {
  const table = tableForType(type);

  // ON CONFLICT (client_id) DO NOTHING — idempotent: safe to retry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)(table).upsert(payload, {
    onConflict: 'client_id',
    ignoreDuplicates: true,
  });

  if (error) throw new Error(error.message);
}

function tableForType(type: QueueRecordType): string {
  switch (type) {
    case 'trip':          return 'trips';
    case 'drag_run':      return 'drag_runs';
    case 'hazard_report': return 'hazard_reports';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Try to execute a Supabase write immediately.
 * On failure (network or server error), enqueue for later retry.
 *
 * @param type    Queue record type for routing the sync
 * @param payload The row object to insert/upsert (must include client_id)
 * @param write   The actual Supabase mutation to attempt first
 */
export async function enqueueOrExec(
  type: QueueRecordType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
  write: () => Promise<void>,
): Promise<void> {
  // Ensure client_id is always set before any attempt
  if (!payload.client_id) {
    payload.client_id = generateClientId();
  }

  try {
    await write();
  } catch (err) {
    console.warn(`[offlineQueue] Write failed, queuing for retry (${type}):`, err);
    await enqueue(type, payload);
  }
}

// ─── NetInfo Listener (call once at app startup) ──────────────────────────────

let netInfoUnsubscribe: (() => void) | null = null;

export function startOfflineSync(): void {
  if (netInfoUnsubscribe) return; // already running

  netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected && state.isInternetReachable) {
      flushQueue().catch((err) => {
        console.error('[offlineQueue] Flush error on reconnect:', err);
      });
    }
  });

  // Also attempt an immediate flush in case we're already online
  flushQueue().catch(console.error);
}

export function stopOfflineSync(): void {
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
}
