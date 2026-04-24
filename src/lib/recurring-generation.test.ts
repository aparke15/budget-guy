import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { generateRecurringTransactionsForRange } from "./recurring-generation";
import type { RecurringRule, Transaction } from "../types";

function createStandardRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: "rule-standard",
    kind: "standard",
    name: "rent",
    amountCents: -120000,
    accountId: "acct-checking",
    categoryId: "cat-rent",
    frequency: "monthly",
    startDate: "2026-01-01",
    active: true,
    dayOfMonth: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createTransferRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: "rule-transfer",
    kind: "transfer",
    name: "save",
    amountCents: 25000,
    accountId: "acct-checking",
    toAccountId: "acct-savings",
    frequency: "monthly",
    startDate: "2026-01-01",
    active: true,
    dayOfMonth: 12,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("recurring generation helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("generated-1")
        .mockReturnValueOnce("generated-2")
        .mockReturnValueOnce("generated-3")
        .mockReturnValueOnce("generated-4"),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("generates a selected month range and aggregates the summary", () => {
    const result = generateRecurringTransactionsForRange(
      [createStandardRule()],
      [],
      "2026-04",
      3
    );

    expect(result.transactions.map((transaction) => transaction.date)).toEqual([
      "2026-04-05",
      "2026-05-05",
      "2026-06-05",
    ]);
    expect(result.summary).toEqual({
      startMonth: "2026-04",
      endMonth: "2026-06",
      monthCount: 3,
      createdOccurrences: 3,
      createdTransactions: 3,
      createdTransfers: 0,
      duplicateOccurrences: 0,
      ruleResults: [
        {
          recurringRuleId: "rule-standard",
          ruleName: "rent",
          kind: "standard",
          createdOccurrences: 3,
          createdTransactions: 3,
          createdTransfers: 0,
          duplicateOccurrences: 0,
        },
      ],
    });
  });

  it("skips duplicates when rerunning the same range", () => {
    const existingTransactions: Transaction[] = [
      {
        id: "txn-existing-apr",
        kind: "standard",
        date: "2026-04-05",
        amountCents: -120000,
        accountId: "acct-checking",
        categoryId: "cat-rent",
        source: "recurring",
        recurringRuleId: "rule-standard",
        createdAt: "2026-04-05T00:00:00.000Z",
        updatedAt: "2026-04-05T00:00:00.000Z",
      },
      {
        id: "txn-existing-may",
        kind: "standard",
        date: "2026-05-05",
        amountCents: -120000,
        accountId: "acct-checking",
        categoryId: "cat-rent",
        source: "recurring",
        recurringRuleId: "rule-standard",
        createdAt: "2026-05-05T00:00:00.000Z",
        updatedAt: "2026-05-05T00:00:00.000Z",
      },
    ];

    const result = generateRecurringTransactionsForRange(
      [createStandardRule()],
      existingTransactions,
      "2026-04",
      3
    );

    expect(result.transactions).toEqual([
      expect.objectContaining({
        id: "generated-1",
        date: "2026-06-05",
        recurringRuleId: "rule-standard",
      }),
    ]);
    expect(result.summary).toEqual({
      startMonth: "2026-04",
      endMonth: "2026-06",
      monthCount: 3,
      createdOccurrences: 1,
      createdTransactions: 1,
      createdTransfers: 0,
      duplicateOccurrences: 2,
      ruleResults: [
        {
          recurringRuleId: "rule-standard",
          ruleName: "rent",
          kind: "standard",
          createdOccurrences: 1,
          createdTransactions: 1,
          createdTransfers: 0,
          duplicateOccurrences: 2,
        },
      ],
    });
  });

  it("generates recurring transfer pairs across multiple months", () => {
    const result = generateRecurringTransactionsForRange(
      [createTransferRule()],
      [],
      "2026-04",
      2
    );

    expect(result.transactions).toEqual([
      expect.objectContaining({
        kind: "transfer",
        date: "2026-04-12",
        amountCents: -25000,
        accountId: "acct-checking",
        recurringRuleId: "rule-transfer",
        source: "recurring",
      }),
      expect.objectContaining({
        kind: "transfer",
        date: "2026-04-12",
        amountCents: 25000,
        accountId: "acct-savings",
        recurringRuleId: "rule-transfer",
        source: "recurring",
      }),
      expect.objectContaining({
        kind: "transfer",
        date: "2026-05-12",
        amountCents: -25000,
        accountId: "acct-checking",
        recurringRuleId: "rule-transfer",
        source: "recurring",
      }),
      expect.objectContaining({
        kind: "transfer",
        date: "2026-05-12",
        amountCents: 25000,
        accountId: "acct-savings",
        recurringRuleId: "rule-transfer",
        source: "recurring",
      }),
    ]);
    expect(result.summary).toEqual({
      startMonth: "2026-04",
      endMonth: "2026-05",
      monthCount: 2,
      createdOccurrences: 2,
      createdTransactions: 4,
      createdTransfers: 2,
      duplicateOccurrences: 0,
      ruleResults: [
        {
          recurringRuleId: "rule-transfer",
          ruleName: "save",
          kind: "transfer",
          createdOccurrences: 2,
          createdTransactions: 4,
          createdTransfers: 2,
          duplicateOccurrences: 0,
        },
      ],
    });
  });
});
