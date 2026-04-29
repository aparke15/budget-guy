import { afterEach, describe, expect, it, vi } from "vitest";

import type { Account, Category, RecurringRule, Transaction } from "../types";
import {
  buildPendingExpectedOccurrences,
  buildAccountExpectedBalanceEffects,
  buildDueSoonList,
  buildExpectedOccurrenceSummary,
  deriveExpectedOccurrences,
} from "./expected-occurrences";

const accounts: Account[] = [
  {
    id: "acct-checking",
    name: "Checking",
    type: "checking",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acct-savings",
    name: "Savings",
    type: "savings",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acct-credit",
    name: "Card",
    type: "credit",
    creditLimitCents: 100000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const categories: Category[] = [
  {
    id: "cat-rent",
    name: "Rent",
    kind: "expense",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-archived",
    name: "Old Gym",
    kind: "expense",
    archivedAt: "2026-04-10T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
  },
  {
    id: "cat-salary",
    name: "Salary",
    kind: "income",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const recurringRules: RecurringRule[] = [
  {
    id: "rule-rent",
    kind: "standard",
    name: "Rent",
    amountCents: -120000,
    accountId: "acct-checking",
    categoryId: "cat-rent",
    frequency: "monthly",
    startDate: "2026-01-05",
    active: true,
    dayOfMonth: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule-salary",
    kind: "standard",
    name: "Salary",
    amountCents: 300000,
    accountId: "acct-checking",
    categoryId: "cat-salary",
    frequency: "weekly",
    startDate: "2026-04-01",
    active: true,
    dayOfWeek: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule-transfer",
    kind: "transfer",
    name: "Save",
    amountCents: 5000,
    accountId: "acct-checking",
    toAccountId: "acct-savings",
    frequency: "biweekly",
    startDate: "2026-04-03",
    active: true,
    dayOfWeek: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule-gym",
    kind: "standard",
    name: "Gym",
    amountCents: -4500,
    accountId: "acct-credit",
    categoryId: "cat-archived",
    frequency: "yearly",
    startDate: "2024-04-22",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

function createTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "txn-default",
    kind: "standard",
    date: "2026-04-01",
    amountCents: -1000,
    accountId: "acct-checking",
    categoryId: "cat-rent",
    source: "manual",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("expected occurrence helpers", () => {
  it("derives monthly, weekly, biweekly, and yearly occurrences inside an interval", () => {
    const results = deriveExpectedOccurrences(
      recurringRules,
      [],
      {
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      },
      {
        today: "2026-04-21",
        categories,
      }
    );

    expect(results.map((occurrence) => `${occurrence.recurringRuleId}:${occurrence.date}`)).toEqual([
      "rule-salary:2026-04-01",
      "rule-transfer:2026-04-03",
      "rule-rent:2026-04-05",
      "rule-salary:2026-04-08",
      "rule-salary:2026-04-15",
      "rule-transfer:2026-04-17",
      "rule-gym:2026-04-22",
      "rule-salary:2026-04-22",
      "rule-salary:2026-04-29",
    ]);
  });

  it("classifies strict matches only by recurringRuleId and scheduled date", () => {
    const results = deriveExpectedOccurrences(
      recurringRules,
      [
        createTransaction({
          id: "txn-rent",
          date: "2026-04-05",
          recurringRuleId: "rule-rent",
          source: "recurring",
        }),
        createTransaction({
          id: "txn-rent-wrong-date",
          date: "2026-04-06",
          recurringRuleId: "rule-rent",
          source: "recurring",
        }),
        createTransaction({
          id: "txn-no-rule",
          date: "2026-04-22",
          recurringRuleId: undefined,
          source: "manual",
        }),
      ],
      {
        startDate: "2026-04-01",
        endDate: "2026-04-10",
      },
      {
        today: "2026-04-05",
      }
    );

    expect(results.find((occurrence) => occurrence.recurringRuleId === "rule-rent")).toMatchObject({
      date: "2026-04-05",
      status: "matched",
      matchedTransactionCount: 1,
    });
    expect(results.find((occurrence) => occurrence.recurringRuleId === "rule-salary")).toMatchObject({
      date: "2026-04-01",
      status: "overdue",
    });
  });

  it("classifies overdue, due, and upcoming statuses", () => {
    const results = deriveExpectedOccurrences(
      recurringRules.filter((rule) => rule.id !== "rule-transfer"),
      [],
      {
        startDate: "2026-04-15",
        endDate: "2026-04-23",
      },
      {
        today: "2026-04-22",
        categories,
      }
    );

    expect(results.map((occurrence) => [occurrence.ruleName, occurrence.status])).toEqual([
      ["Salary", "overdue"],
      ["Gym", "due"],
      ["Salary", "due"],
    ]);
  });

  it("keeps one canonical transfer occurrence and derives per-account effects from it", () => {
    const results = deriveExpectedOccurrences(
      recurringRules,
      [
        createTransaction({
          id: "txn-transfer-out",
          kind: "transfer",
          date: "2026-04-17",
          amountCents: -5000,
          accountId: "acct-checking",
          recurringRuleId: "rule-transfer",
          source: "recurring",
          transferGroupId: "transfer-1",
        }),
        createTransaction({
          id: "txn-transfer-in",
          kind: "transfer",
          date: "2026-04-17",
          amountCents: 5000,
          accountId: "acct-savings",
          recurringRuleId: "rule-transfer",
          source: "recurring",
          transferGroupId: "transfer-1",
        }),
      ],
      {
        startDate: "2026-04-01",
        endDate: "2026-04-18",
      },
      {
        today: "2026-04-10",
      }
    );

    const transferOccurrences = results.filter(
      (occurrence) => occurrence.recurringRuleId === "rule-transfer"
    );

    expect(transferOccurrences).toEqual([
      expect.objectContaining({
        date: "2026-04-03",
        kind: "transfer",
        amountCents: 5000,
      }),
      expect.objectContaining({
        date: "2026-04-17",
        kind: "transfer",
        status: "matched",
        matchedTransactionCount: 2,
      }),
    ]);

    expect(buildAccountExpectedBalanceEffects(accounts, transferOccurrences)).toEqual([
      {
        accountId: "acct-checking",
        pendingCount: 1,
        netExpectedChangeCents: -5000,
      },
      {
        accountId: "acct-savings",
        pendingCount: 1,
        netExpectedChangeCents: 5000,
      },
      {
        accountId: "acct-credit",
        pendingCount: 0,
        netExpectedChangeCents: 0,
      },
    ]);
  });

  it("surfaces archived category labeling instead of dropping referenced rules", () => {
    const results = deriveExpectedOccurrences(
      recurringRules,
      [],
      {
        startDate: "2026-04-22",
        endDate: "2026-04-22",
      },
      {
        today: "2026-04-20",
        categories,
      }
    );

    expect(results).toContainEqual(
      expect.objectContaining({
        recurringRuleId: "rule-gym",
        categoryId: "cat-archived",
        categoryName: "Old Gym (archived)",
        categoryArchived: true,
      })
    );
  });

  it("treats interval boundaries as inclusive and builds summary plus due-soon output from pending items only", () => {
    const results = deriveExpectedOccurrences(
      recurringRules,
      [
        createTransaction({
          id: "txn-matched-salary",
          date: "2026-04-22",
          recurringRuleId: "rule-salary",
          source: "recurring",
        }),
      ],
      {
        startDate: "2026-04-22",
        endDate: "2026-04-29",
      },
      {
        today: "2026-04-22",
        categories,
      }
    );

    expect(results.map((occurrence) => occurrence.date)).toEqual([
      "2026-04-22",
      "2026-04-22",
      "2026-04-29",
    ]);
    expect(buildExpectedOccurrenceSummary(results)).toEqual({
      dueTodayCount: 1,
      overdueCount: 0,
      next7DaysCount: 2,
      pendingCount: 2,
    });
    expect(buildDueSoonList(results, { limit: 2 })).toEqual([
      expect.objectContaining({ recurringRuleId: "rule-gym", status: "due" }),
      expect.objectContaining({ recurringRuleId: "rule-salary", date: "2026-04-29" }),
    ]);
  });

  it("uses the current local date key when today is omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 22, 9, 15, 0));

    const results = deriveExpectedOccurrences(
      recurringRules.filter((rule) => rule.id === "rule-gym"),
      [],
      {
        startDate: "2026-04-22",
        endDate: "2026-04-22",
      },
      {
        categories,
      }
    );

    expect(results).toContainEqual(
      expect.objectContaining({
        recurringRuleId: "rule-gym",
        status: "due",
      })
    );
  });

  it("returns pending occurrences in overdue, due, then upcoming order", () => {
    const results = deriveExpectedOccurrences(
      recurringRules,
      [
        createTransaction({
          id: "txn-rent",
          date: "2026-04-05",
          recurringRuleId: "rule-rent",
          source: "recurring",
        }),
      ],
      {
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      },
      {
        today: "2026-04-22",
        categories,
      }
    );

    expect(
      buildPendingExpectedOccurrences(results).map((occurrence) => [
        occurrence.recurringRuleId,
        occurrence.status,
        occurrence.date,
      ])
    ).toEqual([
      ["rule-salary", "overdue", "2026-04-01"],
      ["rule-transfer", "overdue", "2026-04-03"],
      ["rule-salary", "overdue", "2026-04-08"],
      ["rule-salary", "overdue", "2026-04-15"],
      ["rule-transfer", "overdue", "2026-04-17"],
      ["rule-gym", "due", "2026-04-22"],
      ["rule-salary", "due", "2026-04-22"],
      ["rule-salary", "upcoming", "2026-04-29"],
    ]);
  });
});