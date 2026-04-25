import { migratePersistedStateToLatest } from "../lib/persistence";
import { latestPersistedStateSchema } from "../lib/validation";
import { createSeedState } from "../seed/seed-data";
import type { PersistedState } from "../types";
import {
  buildPersistedStateSnapshot,
  clearPersistedState,
  savePersistedState,
  STORAGE_KEY,
} from "./storage-runtime";

type ParsedPersistedStateResult =
  | {
      success: true;
      data: PersistedState;
    }
  | {
      success: false;
      error: string;
    };

export { buildPersistedStateSnapshot, clearPersistedState, savePersistedState, STORAGE_KEY };

export function exportPersistedStateJson(state: PersistedState): string {
  const result = latestPersistedStateSchema.safeParse(state);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "invalid persisted state");
  }

  return JSON.stringify(result.data, null, 2);
}

export function parsePersistedStateJson(raw: string): ParsedPersistedStateResult {
  try {
    const parsed = JSON.parse(raw);
    return migratePersistedStateToLatest(parsed);
  } catch {
    return {
      success: false,
      error: "file is not valid json",
    };
  }
}

export function buildBackupFileName(date = new Date()): string {
  return `budget-mvp-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const result = parsePersistedStateJson(raw);

    if (!result.success) {
      console.warn("invalid persisted state, ignoring local data", {
        error: result.error,
      });
      return null;
    }

    return result.data;
  } catch (error) {
    console.warn("failed to load persisted state", error);
    return null;
  }
}

export function loadOrCreatePersistedState(): PersistedState {
  const existing = loadPersistedState();

  if (existing) {
    return existing;
  }

  const seeded = createSeedState();
  savePersistedState(seeded);
  return seeded;
}