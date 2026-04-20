import { persistedstateschema } from "../lib/validation";
import { createseedstate } from "../seed/seed-data";
import type { persistedstate } from "../types";

const storagekey = "budget-mvp";

export function loadpersistedstate(): persistedstate | null {
  try {
    const raw = localStorage.getItem(storagekey);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const result = persistedstateschema.safeParse(parsed);

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

export function savepersistedstate(state: persistedstate): void {
  const result = persistedstateschema.safeParse(state);

  if (!result.success) {
    console.warn("refusing to save invalid persisted state", {
      issues: result.error.issues,
    });
    return;
  }

  localStorage.setItem(storagekey, JSON.stringify(result.data));
}

export function clearpersistedstate(): void {
  localStorage.removeItem(storagekey);
}

export function loadorcreatepersistedstate(): persistedstate {
  const existing = loadpersistedstate();

  if (existing) {
    return existing;
  }

  const seeded = createseedstate();
  savepersistedstate(seeded);
  return seeded;
}