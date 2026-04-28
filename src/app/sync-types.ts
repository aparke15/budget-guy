import type { PersistedState } from "../types";

export type SnapshotMetadata = {
  schemaVersion: number;
  updatedAt: string;
  deviceId: string;
  snapshotHash: string;
};

export type LocalSnapshotInfo = SnapshotMetadata & {
  lastSyncedHash?: string;
  lastSyncedAt?: string;
  lastSyncedDeviceId?: string;
};

export type RemoteSnapshotMetadata = SnapshotMetadata & {
  userId: string;
};

export type RemoteSnapshotRecord = {
  metadata: RemoteSnapshotMetadata;
  snapshot: PersistedState;
};

export type SyncComparisonKind =
  | "no-remote-snapshot"
  | "no-local-changes"
  | "local-only"
  | "remote-only"
  | "identical"
  | "diverged";

export type SyncComparison = {
  kind: SyncComparisonKind;
  local: LocalSnapshotInfo;
  remote: RemoteSnapshotMetadata | null;
};
