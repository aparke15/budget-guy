import { describe, expect, it } from "vitest";

import {
  LEGACY_PERSISTED_STATE_VERSION,
  detectPersistedStateVersion,
  migratePersistedStateToLatest,
} from "./persistence";
import {
  LATEST_PERSISTED_STATE_VERSION,
  type PersistedStateV1,
} from "../types";

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
      name: "groceries",
      kind: "expense" as const,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  ],
  transactions: [
    {
      id: "txn-1",
      date: "2026-04-02",
      amountCents: -4200,
      accountId: "acct-1",
      categoryId: "cat-1",
      source: "manual" as const,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    },
  ],
  budgets: [
    {
      id: "budget-1",
      month: "2026-04",
      categoryId: "cat-1",
      plannedCents: 5000,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  ],
  recurringRules: [
    {
      id: "rule-1",
      name: "weekly groceries",
      amountCents: -4200,
      accountId: "acct-1",
      categoryId: "cat-1",
      frequency: "monthly" as const,
      startDate: "2026-04-02",
      active: true,
      dayOfMonth: 2,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  ],
};

const V1_PERSISTED_STATE_FIXTURE: PersistedStateV1 = {
  version: 1,
  ...LEGACY_PERSISTED_STATE_FIXTURE,
  transactions: [
    {
      kind: "standard",
      ...LEGACY_PERSISTED_STATE_FIXTURE.transactions[0],
    },
  ],
  recurringRules: [
    {
      kind: "standard",
      ...LEGACY_PERSISTED_STATE_FIXTURE.recurringRules[0],
    },
  ],
};

describe("persistence migrations", () => {
  it("detects unversioned payloads as the legacy persisted version", () => {
    expect(detectPersistedStateVersion(LEGACY_PERSISTED_STATE_FIXTURE)).toBe(
      LEGACY_PERSISTED_STATE_VERSION
    );
  });

  it("loads valid current-version payloads without changing them", () => {
    const currentPersistedStateFixture = {
      ...V1_PERSISTED_STATE_FIXTURE,
      version: LATEST_PERSISTED_STATE_VERSION,
    };

    const result = migratePersistedStateToLatest(currentPersistedStateFixture);

    expect(result).toEqual({
      success: true,
      data: currentPersistedStateFixture,
    });
  });

  it("migrates a v1 payload to v2 without changing transactions", () => {
    const result = migratePersistedStateToLatest(V1_PERSISTED_STATE_FIXTURE);

    expect(result).toEqual({
      success: true,
      data: {
        ...V1_PERSISTED_STATE_FIXTURE,
        version: LATEST_PERSISTED_STATE_VERSION,
      },
    });
  });

  it("migrates an unversioned legacy payload to the latest persisted shape", () => {
    const result = migratePersistedStateToLatest(LEGACY_PERSISTED_STATE_FIXTURE);

    expect(result).toEqual({
      success: true,
      data: {
        version: LATEST_PERSISTED_STATE_VERSION,
        ...LEGACY_PERSISTED_STATE_FIXTURE,
        transactions: [
          {
            kind: "standard",
            ...LEGACY_PERSISTED_STATE_FIXTURE.transactions[0],
          },
        ],
        recurringRules: [
          {
            kind: "standard",
            ...LEGACY_PERSISTED_STATE_FIXTURE.recurringRules[0],
          },
        ],
      },
    });
  });

  it("rejects corrupt payloads", () => {
    expect(
      migratePersistedStateToLatest({
        accounts: [],
        categories: [],
        transactions: [],
        budgets: [],
      })
    ).toEqual({
      success: false,
      error: "Invalid input: expected array, received undefined",
    });
  });

  it("rejects unknown future versions", () => {
    expect(
      migratePersistedStateToLatest({
        version: LATEST_PERSISTED_STATE_VERSION + 1,
        ...LEGACY_PERSISTED_STATE_FIXTURE,
      })
    ).toEqual({
      success: false,
      error: `unsupported persisted state version: ${LATEST_PERSISTED_STATE_VERSION + 1}`,
    });
  });
});
