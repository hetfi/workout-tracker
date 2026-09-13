/**
 * Local draft storage using IndexedDB (via idb).
 *
 * Stores in-progress session data locally so it survives:
 * - Page reloads
 * - Browser tab closes/reopens (PWA)
 * - Network disconnection
 *
 * Data is synced to Supabase separately; this is the fallback/cache layer.
 */

import { openDB, type IDBPDatabase } from "idb";
import type { LocalDraftSession, LocalDraftTimer } from "@/domain/types";

const DB_NAME = "workout-tracker-draft";
const DB_VERSION = 1;

const STORE_SESSIONS = "sessions";
const STORE_TIMERS = "timers";

interface WorkoutTrackerDB {
  [STORE_SESSIONS]: {
    key: string; // sessionId
    value: LocalDraftSession;
  };
  [STORE_TIMERS]: {
    key: string; // sessionId
    value: LocalDraftTimer;
  };
}

let _db: IDBPDatabase<WorkoutTrackerDB> | null = null;

async function getDB(): Promise<IDBPDatabase<WorkoutTrackerDB>> {
  if (_db) return _db;

  _db = await openDB<WorkoutTrackerDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(STORE_TIMERS)) {
        db.createObjectStore(STORE_TIMERS, { keyPath: "sessionId" });
      }
    },
  });

  return _db;
}

// ---- Session draft ----

export async function saveDraftSession(session: LocalDraftSession): Promise<void> {
  const db = await getDB();
  await db.put(STORE_SESSIONS, {
    ...session,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadDraftSession(
  sessionId: string
): Promise<LocalDraftSession | undefined> {
  const db = await getDB();
  return db.get(STORE_SESSIONS, sessionId);
}

export async function deleteDraftSession(sessionId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_SESSIONS, sessionId);
}

export async function listDraftSessions(): Promise<LocalDraftSession[]> {
  const db = await getDB();
  return db.getAll(STORE_SESSIONS);
}

// ---- Timer draft ----

export async function saveDraftTimer(timer: LocalDraftTimer): Promise<void> {
  const db = await getDB();
  await db.put(STORE_TIMERS, timer);
}

export async function loadDraftTimer(
  sessionId: string
): Promise<LocalDraftTimer | undefined> {
  const db = await getDB();
  return db.get(STORE_TIMERS, sessionId);
}

export async function deleteDraftTimer(sessionId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_TIMERS, sessionId);
}

// ---- Cleanup ----

export async function clearAllDrafts(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_SESSIONS);
  await db.clear(STORE_TIMERS);
}
