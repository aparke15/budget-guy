import { persistedStateSchema } from "../lib/validation";
import { createSeedState } from "../seed/seed-data";
import type { PersistedState } from "../types";

const STORAGE_KEY = "budget-mvp";

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