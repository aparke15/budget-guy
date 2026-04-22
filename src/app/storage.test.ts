import { describe, expect, it } from "vitest";

import {
  buildBackupFileName,
  buildPersistedStateSnapshot,
  exportPersistedStateJson,
  parsePersistedStateJson,
} from "./storage";
import type { PersistedState } from "../types";

function createPersistedState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    version: 1,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurringRules: [],
    ...overrides,
  };
}

describe("storage helpers", () => {
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
    expect(json).toContain('"version": 1');
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

  it("rejects invalid json and schema-invalid payloads", () => {
    expect(parsePersistedStateJson("{not json}")).toEqual({
      success: false,
      error: "file is not valid json",
    });

    expect(
      parsePersistedStateJson(
        JSON.stringify({
          version: 2,
          accounts: [],
          categories: [],
          transactions: [],
          budgets: [],
          recurringRules: [],
        })
      )
    ).toEqual({
      success: false,
      error: "Invalid input: expected 1",
    });
  });

  it("builds a dated backup filename", () => {
    expect(buildBackupFileName(new Date("2026-04-21T12:00:00.000Z"))).toBe(
      "budget-mvp-backup-2026-04-21.json"
    );
  });
});