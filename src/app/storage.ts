import { persistedStateSchema } from "../lib/validation";
import { createSeedState } from "../seed/seed-data";
import type { PersistedState } from "../types";

export const STORAGE_KEY = "budget-mvp";

type PersistedCollections = Omit<PersistedState, "version">;

type ParsedPersistedStateResult =
  | {
      success: true;
      data: PersistedState;
    }
  | {
      success: false;
      error: string;
    };

export function buildPersistedStateSnapshot(
  collections: PersistedCollections
): PersistedState {
  return {
    version: 1,
    accounts: collections.accounts,
    categories: collections.categories,
    transactions: collections.transactions,
    budgets: collections.budgets,
    recurringRules: collections.recurringRules,
  };
}

export function exportPersistedStateJson(state: PersistedState): string {
  const result = persistedStateSchema.safeParse(state);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "invalid persisted state");
  }

  return JSON.stringify(result.data, null, 2);
}

export function parsePersistedStateJson(raw: string): ParsedPersistedStateResult {
  try {
    const parsed = JSON.parse(raw);
    const result = persistedStateSchema.safeParse(parsed);

    if (!result.success) {
      return {
        success: false,
        error: result.error.issues[0]?.message ?? "invalid backup file",
      };
    }

    return {
      success: true,
      data: result.data,
    };
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

    const parsed = JSON.parse(raw);
    const result = persistedStateSchema.safeParse(parsed);

    if (!result.success) {
      console.warn("invalid persisted state, ignoring local data", {
        issues: result.error.issues,
      });
      return null;
    }

    return result.data;
  } catch (error) {
    console.warn("failed to load persisted state", error);
    return null;
  }
}

export function savePersistedState(state: PersistedState): void {
  const result = persistedStateSchema.safeParse(state);

  if (!result.success) {
    console.warn("refusing to save invalid persisted state", {
      issues: result.error.issues,
    });
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
}

export function clearPersistedState(): void {
  localStorage.removeItem(STORAGE_KEY);
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