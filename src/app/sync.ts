import type { PersistedState } from "../types";
import type {
  LocalSnapshotInfo,
  RemoteSnapshotMetadata,
  SnapshotMetadata,
  SyncComparison,
} from "./sync-types";

const LOCAL_SYNC_METADATA_KEY = "budget-mvp-sync-metadata";
const LOCAL_DEVICE_ID_KEY = "budget-mvp-device-id";
const EMPTY_SNAPSHOT_UPDATED_AT = "1970-01-01T00:00:00.000Z";

type StoredLocalSnapshotInfo = LocalSnapshotInfo;

function getStorage(): Storage | null {
  if (typeof globalThis === "undefined") {
    return null;
  }

  const storage = globalThis.localStorage;

  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function"
  ) {
    return null;
  }

  return storage;
}

function readStoredLocalSnapshotInfo(): StoredLocalSnapshotInfo | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const raw = storage.getItem(LOCAL_SYNC_METADATA_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredLocalSnapshotInfo;

    if (
      typeof parsed.snapshotHash !== "string" ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.deviceId !== "string" ||
      typeof parsed.schemaVersion !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredLocalSnapshotInfo(snapshotInfo: StoredLocalSnapshotInfo): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(LOCAL_SYNC_METADATA_KEY, JSON.stringify(snapshotInfo));
}

function buildFallbackDeviceId(): string {
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDeviceId(): string {
  return buildFallbackDeviceId();
}

function getLatestEntityUpdatedAt(snapshot: PersistedState): string {
  const timestamps = [
    ...snapshot.accounts.map((account) => account.updatedAt),
    ...snapshot.categories.map((category) => category.updatedAt),
    ...snapshot.transactions.map((transaction) => transaction.updatedAt),
    ...snapshot.budgets.map((budget) => budget.updatedAt),
    ...snapshot.recurringRules.map((rule) => rule.updatedAt),
  ].filter((value): value is string => Boolean(value));

  if (timestamps.length === 0) {
    return EMPTY_SNAPSHOT_UPDATED_AT;
  }

  return timestamps.reduce((latest, current) =>
    current.localeCompare(latest) > 0 ? current : latest
  );
}

export function getOrCreateLocalDeviceId(): string {
  const storage = getStorage();

  if (!storage) {
    return createDeviceId();
  }

  const existing = storage.getItem(LOCAL_DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const next = createDeviceId();
  storage.setItem(LOCAL_DEVICE_ID_KEY, next);
  return next;
}

export function buildSnapshotHash(snapshot: PersistedState): string {
  const raw = JSON.stringify(snapshot);
  let hash = 2166136261;

  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildSnapshotMetadata(
  snapshot: PersistedState,
  options: {
    deviceId?: string;
    updatedAt?: string;
  } = {}
): SnapshotMetadata {
  return {
    schemaVersion: snapshot.version,
    snapshotHash: buildSnapshotHash(snapshot),
    deviceId: options.deviceId ?? getOrCreateLocalDeviceId(),
    updatedAt: options.updatedAt ?? getLatestEntityUpdatedAt(snapshot),
  };
}

export function getLocalSnapshotInfo(snapshot: PersistedState): LocalSnapshotInfo {
  const deviceId = getOrCreateLocalDeviceId();
  const stored = readStoredLocalSnapshotInfo();
  const next = buildSnapshotMetadata(snapshot, { deviceId });

  if (
    stored &&
    stored.snapshotHash === next.snapshotHash &&
    stored.schemaVersion === next.schemaVersion &&
    stored.deviceId === deviceId
  ) {
    return {
      ...next,
      updatedAt: stored.updatedAt,
      lastSyncedHash: stored.lastSyncedHash,
      lastSyncedAt: stored.lastSyncedAt,
      lastSyncedDeviceId: stored.lastSyncedDeviceId,
    };
  }

  return {
    ...next,
    lastSyncedHash: stored?.lastSyncedHash,
    lastSyncedAt: stored?.lastSyncedAt,
    lastSyncedDeviceId: stored?.lastSyncedDeviceId,
  };
}

export function ensureLocalSnapshotInfo(snapshot: PersistedState): LocalSnapshotInfo {
  const snapshotInfo = getLocalSnapshotInfo(snapshot);
  const stored = readStoredLocalSnapshotInfo();

  if (JSON.stringify(stored) !== JSON.stringify(snapshotInfo)) {
    writeStoredLocalSnapshotInfo(snapshotInfo);
  }

  return snapshotInfo;
}

export function updateLocalSnapshotInfo(
  snapshot: PersistedState,
  updatedAt = new Date().toISOString()
): LocalSnapshotInfo {
  const current = getLocalSnapshotInfo(snapshot);
  const next: LocalSnapshotInfo = {
    ...buildSnapshotMetadata(snapshot, {
      deviceId: current.deviceId,
      updatedAt,
    }),
    lastSyncedHash: current.lastSyncedHash,
    lastSyncedAt: current.lastSyncedAt,
    lastSyncedDeviceId: current.lastSyncedDeviceId,
  };

  writeStoredLocalSnapshotInfo(next);
  return next;
}

export function markLocalSnapshotSynced(
  snapshot: PersistedState,
  remote: Pick<RemoteSnapshotMetadata, "snapshotHash" | "updatedAt" | "deviceId">
): LocalSnapshotInfo {
  const current = getLocalSnapshotInfo(snapshot);
  const next: LocalSnapshotInfo = {
    ...current,
    lastSyncedHash: remote.snapshotHash,
    lastSyncedAt: remote.updatedAt,
    lastSyncedDeviceId: remote.deviceId,
  };

  writeStoredLocalSnapshotInfo(next);
  return next;
}

export function compareSnapshotMetadata(
  local: LocalSnapshotInfo,
  remote: RemoteSnapshotMetadata | null
): SyncComparison {
  if (!remote) {
    return {
      kind: "no-remote-snapshot",
      local,
      remote: null,
    };
  }

  if (
    local.snapshotHash === remote.snapshotHash &&
    local.schemaVersion === remote.schemaVersion
  ) {
    return {
      kind: "identical",
      local,
      remote,
    };
  }

  if (local.lastSyncedHash) {
    if (local.lastSyncedHash === remote.snapshotHash) {
      return {
        kind: "local-only",
        local,
        remote,
      };
    }

    if (local.lastSyncedHash === local.snapshotHash) {
      return {
        kind: "no-local-changes",
        local,
        remote,
      };
    }

    if (
      local.lastSyncedHash !== local.snapshotHash &&
      local.lastSyncedHash !== remote.snapshotHash
    ) {
      return {
        kind: "diverged",
        local,
        remote,
      };
    }
  }

  if (local.updatedAt.localeCompare(remote.updatedAt) > 0) {
    return {
      kind: "local-only",
      local,
      remote,
    };
  }

  if (remote.updatedAt.localeCompare(local.updatedAt) > 0) {
    return {
      kind: "remote-only",
      local,
      remote,
    };
  }

  if (local.deviceId !== remote.deviceId) {
    return {
      kind: "diverged",
      local,
      remote,
    };
  }

  return {
    kind: "diverged",
    local,
    remote,
  };
}

export function getSyncComparisonSummary(comparison: SyncComparison): string {
  switch (comparison.kind) {
    case "no-remote-snapshot":
      return "no cloud snapshot exists yet";
    case "no-local-changes":
      return "cloud changed since this device last synced";
    case "local-only":
      return "this device has newer local changes";
    case "remote-only":
      return "the cloud snapshot is newer than this device";
    case "identical":
      return "local and cloud snapshots match";
    case "diverged":
      return "local and cloud snapshots diverged";
  }
}
