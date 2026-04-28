import { describe, expect, it } from "vitest";

import {
  parseRemoteSnapshotMetadataRow,
  parseRemoteSnapshotRow,
} from "./remote-storage";
import { LATEST_PERSISTED_STATE_VERSION, type PersistedState } from "../types";

const LEGACY_REMOTE_SNAPSHOT = {
  accounts: [
    {
      id: "acct-1",
      name: "checking",
      type: "checking" as const,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  ],
  categories: [
    {
      id: "cat-rent",
      name: "rent",
      kind: "expense" as const,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  ],
  transactions: [
    {
      id: "txn-1",
      date: "2026-04-02",
      amountCents: -120000,
      accountId: "acct-1",
      categoryId: "cat-rent",
      source: "manual" as const,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    },
  ],
  budgets: [],
  recurringRules: [],
};

function createPersistedState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    version: LATEST_PERSISTED_STATE_VERSION,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurringRules: [],
    ...overrides,
  };
}

describe("remote snapshot parsing", () => {
  it("parses remote metadata rows", () => {
    expect(
      parseRemoteSnapshotMetadataRow({
        user_id: "user-1",
        schema_version: LATEST_PERSISTED_STATE_VERSION,
        updated_at: "2026-04-21T10:00:00.000Z",
        device_id: "device-a",
        snapshot_hash: "hash-1",
      })
    ).toEqual({
      success: true,
      data: {
        userId: "user-1",
        schemaVersion: LATEST_PERSISTED_STATE_VERSION,
        updatedAt: "2026-04-21T10:00:00.000Z",
        deviceId: "device-a",
        snapshotHash: "hash-1",
      },
    });
  });

  it("routes remote snapshots through the migration-aware parse path", () => {
    expect(
      parseRemoteSnapshotRow({
        user_id: "user-1",
        schema_version: 1,
        updated_at: "2026-04-21T10:00:00.000Z",
        device_id: "device-a",
        snapshot_hash: "hash-legacy",
        snapshot: LEGACY_REMOTE_SNAPSHOT,
      })
    ).toEqual({
      success: true,
      data: {
        metadata: {
          userId: "user-1",
          schemaVersion: 1,
          updatedAt: "2026-04-21T10:00:00.000Z",
          deviceId: "device-a",
          snapshotHash: "hash-legacy",
        },
        snapshot: createPersistedState({
          ...LEGACY_REMOTE_SNAPSHOT,
          transactions: [
            {
              kind: "standard",
              ...LEGACY_REMOTE_SNAPSHOT.transactions[0],
            },
          ],
        }),
      },
    });
  });

  it("rejects invalid remote snapshots before they reach the app", () => {
    expect(
      parseRemoteSnapshotRow({
        user_id: "user-1",
        schema_version: LATEST_PERSISTED_STATE_VERSION,
        updated_at: "2026-04-21T10:00:00.000Z",
        device_id: "device-a",
        snapshot_hash: "hash-bad",
        snapshot: {
          version: LATEST_PERSISTED_STATE_VERSION,
          accounts: [],
        },
      })
    ).toEqual({
      success: false,
      error: "Invalid input: expected array, received undefined",
    });
  });
});
