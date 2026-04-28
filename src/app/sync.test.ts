import { describe, expect, it } from "vitest";

import {
  compareSnapshotMetadata,
  getSyncComparisonSummary,
} from "./sync";
import type {
  LocalSnapshotInfo,
  RemoteSnapshotMetadata,
} from "./sync-types";

function createLocalSnapshotInfo(
  overrides: Partial<LocalSnapshotInfo> = {}
): LocalSnapshotInfo {
  return {
    schemaVersion: 3,
    updatedAt: "2026-04-21T10:00:00.000Z",
    deviceId: "device-local",
    snapshotHash: "hash-local",
    ...overrides,
  };
}

function createRemoteSnapshotMetadata(
  overrides: Partial<RemoteSnapshotMetadata> = {}
): RemoteSnapshotMetadata {
  return {
    userId: "user-1",
    schemaVersion: 3,
    updatedAt: "2026-04-21T09:00:00.000Z",
    deviceId: "device-remote",
    snapshotHash: "hash-remote",
    ...overrides,
  };
}

describe("snapshot sync comparison", () => {
  it("detects when no remote snapshot exists", () => {
    expect(compareSnapshotMetadata(createLocalSnapshotInfo(), null).kind).toBe(
      "no-remote-snapshot"
    );
  });

  it("detects identical snapshots by hash and schema version", () => {
    expect(
      compareSnapshotMetadata(
        createLocalSnapshotInfo({ snapshotHash: "hash-1" }),
        createRemoteSnapshotMetadata({ snapshotHash: "hash-1", deviceId: "device-local" })
      ).kind
    ).toBe("identical");
  });

  it("detects local-only changes when the remote still matches the last synced hash", () => {
    expect(
      compareSnapshotMetadata(
        createLocalSnapshotInfo({
          snapshotHash: "hash-new-local",
          lastSyncedHash: "hash-remote",
        }),
        createRemoteSnapshotMetadata({ snapshotHash: "hash-remote" })
      ).kind
    ).toBe("local-only");
  });

  it("detects no local changes when the current local hash is still the last synced hash", () => {
    expect(
      compareSnapshotMetadata(
        createLocalSnapshotInfo({
          snapshotHash: "hash-local",
          lastSyncedHash: "hash-local",
        }),
        createRemoteSnapshotMetadata({ snapshotHash: "hash-cloud-newer" })
      ).kind
    ).toBe("no-local-changes");
  });

  it("detects remote-only snapshots from timestamp ordering when no sync baseline exists", () => {
    expect(
      compareSnapshotMetadata(
        createLocalSnapshotInfo({ updatedAt: "2026-04-21T09:00:00.000Z" }),
        createRemoteSnapshotMetadata({ updatedAt: "2026-04-21T12:00:00.000Z" })
      ).kind
    ).toBe("remote-only");
  });

  it("detects diverged snapshots when both sides moved away from the last sync hash", () => {
    const comparison = compareSnapshotMetadata(
      createLocalSnapshotInfo({
        snapshotHash: "hash-local-new",
        lastSyncedHash: "hash-old",
      }),
      createRemoteSnapshotMetadata({ snapshotHash: "hash-remote-new" })
    );

    expect(comparison.kind).toBe("diverged");
    expect(getSyncComparisonSummary(comparison)).toBe(
      "local and cloud snapshots diverged"
    );
  });
});
