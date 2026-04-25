import { beforeEach, describe, expect, it } from "vitest";

import {
  buildBackupFileName,
  buildPersistedStateSnapshot,
  exportPersistedStateJson,
  loadPersistedState,
  loadOrCreatePersistedState,
  parsePersistedStateJson,
  STORAGE_KEY,
} from "./storage";
import { createSeedState } from "../seed/seed-data";
import { LATEST_PERSISTED_STATE_VERSION, type PersistedState } from "../types";

const LEGACY_PERSISTED_STATE_FIXTURE = {
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
      id: "cat-1",
      name: "rent",
      kind: "expense" as const,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  ],
  transactions: [
    {
      id: "txn-1",
      date: "2026-04-01",
      amountCents: -120000,
      accountId: "acct-1",
      categoryId: "cat-1",
      source: "manual" as const,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  ],
  budgets: [],
  recurringRules: [],
};

function installLocalStorageMock() {
  const storage = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });
}

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

describe("storage helpers", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("builds the full persisted state snapshot shape", () => {
    expect(
      buildPersistedStateSnapshot({
        accounts: [],
        categories: [],
        transactions: [],
        budgets: [],
        recurringRules: [],
      })
    ).toEqual(createPersistedState());
  });

  it("exports formatted persisted state json", () => {
    const json = exportPersistedStateJson(
      createPersistedState({
        accounts: [
          {
            id: "acct-1",
            name: "checking",
            type: "checking",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );

    expect(JSON.parse(json)).toEqual(
      createPersistedState({
        accounts: [
          expect.objectContaining({
            id: "acct-1",
            name: "checking",
          }),
        ],
      })
    );
    expect(json).toContain(`"version": ${LATEST_PERSISTED_STATE_VERSION}`);
    expect(json).toContain('\n  "accounts": [');
  });

  it("parses and validates valid persisted state json", () => {
    const result = parsePersistedStateJson(
      JSON.stringify(
        createPersistedState({
          categories: [
            {
              id: "cat-1",
              name: "rent",
              kind: "expense",
              createdAt: "2026-04-01T00:00:00.000Z",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
          ],
        })
      )
    );

    expect(result).toEqual({
      success: true,
      data: createPersistedState({
        categories: [
          {
            id: "cat-1",
            name: "rent",
            kind: "expense",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      }),
    });
  });

  it("parses legacy json through the migration pipeline", () => {
    const result = parsePersistedStateJson(
      JSON.stringify(LEGACY_PERSISTED_STATE_FIXTURE)
    );

    expect(result).toEqual({
      success: true,
      data: createPersistedState({
        ...LEGACY_PERSISTED_STATE_FIXTURE,
        transactions: [
          {
            kind: "standard",
            ...LEGACY_PERSISTED_STATE_FIXTURE.transactions[0],
          },
        ],
      }),
    });
  });

  it("rejects invalid json and schema-invalid payloads", () => {
    expect(parsePersistedStateJson("{not json}")).toEqual({
      success: false,
      error: "file is not valid json",
    });

    expect(
      parsePersistedStateJson(
        JSON.stringify({
          version: LATEST_PERSISTED_STATE_VERSION + 1,
          accounts: [],
          categories: [],
          transactions: [],
          budgets: [],
          recurringRules: [],
        })
      )
    ).toEqual({
      success: false,
      error: `unsupported persisted state version: ${LATEST_PERSISTED_STATE_VERSION + 1}`,
    });
  });

  it("loads legacy local storage through the same migration pipeline", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(LEGACY_PERSISTED_STATE_FIXTURE));

    expect(loadPersistedState()).toEqual(
      createPersistedState({
        ...LEGACY_PERSISTED_STATE_FIXTURE,
        transactions: [
          {
            kind: "standard",
            ...LEGACY_PERSISTED_STATE_FIXTURE.transactions[0],
          },
        ],
      })
    );
  });

  it("falls back to seeded latest-version data when saved state is invalid", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accounts: [],
        categories: [],
        transactions: [],
        budgets: [],
      })
    );

    const seeded = createSeedState();

    expect(loadOrCreatePersistedState()).toEqual(seeded);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual(seeded);
  });

  it("builds a dated backup filename", () => {
    expect(buildBackupFileName(new Date("2026-04-21T12:00:00.000Z"))).toBe(
      "budget-mvp-backup-2026-04-21.json"
    );
  });
});