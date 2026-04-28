import { buildLatestPersistedState } from "../lib/persistence";
import { latestPersistedStateSchema } from "../lib/validation";
import type { PersistedState, PersistedStateCollections } from "../types";
import { updateLocalSnapshotInfo } from "./sync";

export const STORAGE_KEY = "budget-mvp";

export function buildPersistedStateSnapshot(
  collections: PersistedStateCollections
): PersistedState {
  return buildLatestPersistedState(collections);
}

export function savePersistedState(state: PersistedState): void {
  const result = latestPersistedStateSchema.safeParse(state);

  if (!result.success) {
    console.warn("refusing to save invalid persisted state", {
      issues: result.error.issues,
    });
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
  updateLocalSnapshotInfo(result.data);
}

export function clearPersistedState(): void {
  localStorage.removeItem(STORAGE_KEY);
}