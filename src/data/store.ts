// One store object, read through useSyncExternalStore. Only service functions write (chapter 11).
import { useSyncExternalStore } from 'react';
import type { DB } from './schema';
import { createSeed, SCHEMA_VERSION } from './seed';
import { DEMO_START, setClockOffset } from './clock';

const KEY = 'underground:v1';
let storageOk = true;
let state: DB = load();
const listeners = new Set<() => void>();
let persistTimer: number | undefined;

function freshSeed(): DB {
  const db = createSeed();
  db.dev.clockOffsetMs = DEMO_START - Date.now();
  return db;
}

function load(): DB {
  let db: DB | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.schemaVersion === SCHEMA_VERSION) db = parsed;
    }
  } catch {
    storageOk = false;
  }
  if (!db) db = freshSeed();
  setClockOffset(db.dev.clockOffsetMs);
  return db;
}

export function storageAvailable() {
  return storageOk;
}

function persist() {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      storageOk = false;
    }
  }, 120);
}

export function getState(): DB {
  return state;
}

/** Apply one atomic update: the mutator receives a deep copy, then subscribers are notified. */
export function commit(mutator: (draft: DB) => void): DB {
  const draft = structuredClone(state);
  mutator(draft);
  state = draft;
  setClockOffset(state.dev.clockOffsetMs);
  persist();
  listeners.forEach((l) => l());
  return state;
}

export function resetStore() {
  const keepSession = null;
  state = freshSeed();
  state.session = keepSession;
  setClockOffset(state.dev.clockOffsetMs);
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getState, getState);
}

let seq = 0;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Keep tabs in sync if the same prototype is open twice (booking conflict test with two windows).
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return;
  try {
    const next = JSON.parse(e.newValue) as DB;
    if (next.schemaVersion !== SCHEMA_VERSION) return;
    // The session is per window: keep ours.
    next.session = state.session;
    state = next;
    setClockOffset(state.dev.clockOffsetMs);
    listeners.forEach((l) => l());
  } catch {
    /* ignore */
  }
});
