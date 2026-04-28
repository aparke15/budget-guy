import { describe, expect, it } from "vitest";

import {
  ACCOUNTS_EXPECTED_WINDOW,
  DASHBOARD_EXPECTED_WINDOW,
  deriveExpectedOccurrences,
  getDueSoonExpectedOccurrences,
  getExpectedOccurrenceIntervalForWindow,
  getExpectedOccurrenceAccountEffects,
  getExpectedOccurrenceDashboardSummary,
  getOperationalExpectedOccurrences,
} from "./expected-occurrences";
import type { RecurringRule, Transaction } from "../types";

const recurringRules: RecurringRule[] = [
  {
    id: "rule-rent",
    kind: "standard",
    name: "rent",
    amountCents: -120000,
    accountId: "acct-checking",
    categoryId: "cat-rent",
    merchant: "Landlord",
    frequency: "monthly",
    startDate: "2026-01-01",
    active: true,
    dayOfMonth: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule-paycheck",
    kind: "standard",
    name: "paycheck",
    amountCents: 250000,
    accountId: "acct-checking",
    categoryId: "cat-income",
    merchant: "Employer",
    frequency: "weekly",
    startDate: "2026-04-01",
    active: true,
    dayOfWeek: 3,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "rule-gym",
    kind: "standard",
    name: "gym",
    amountCents: -5000,
    accountId: "acct-checking",
    categoryId: "cat-fitness",
    frequency: "biweekly",
    startDate: "2026-04-03",
    active: true,
    dayOfWeek: 5,
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
  },
  {
    id: "rule-insurance",
    kind: "standard",
    name: "insurance",
    amountCents: -18000,
    accountId: "acct-checking",
    categoryId: "cat-archived-insurance",
    frequency: "yearly",
    startDate: "2024-04-30",
    active: true,
    dayOfMonth: undefined,
    dayOfWeek: undefined,
    createdAt: "2024-04-30T00:00:00.000Z",
    updatedAt: "2024-04-30T00:00:00.000Z",
  },
  {
    id: "rule-transfer",
    kind: "transfer",
    name: "card payment",
    amountCents: 45000,
    accountId: "acct-checking",
    toAccountId: "acct-credit",
    frequency: "monthly",
    startDate: "2026-04-01",
    active: true,
    dayOfMonth: 25,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  {
    id: "txn-rent-posted",
    kind: "standard",
    date: "2026-04-01",
    amountCents: -120000,
    accountId: "acct-checking",
    categoryId: "cat-rent",
    merchant: "Landlord",
    source: "recurring",
    recurringRuleId: "rule-rent",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "txn-same-date-wrong-rule",
    kind: "standard",
    date: "2026-04-25",
    amountCents: -45000,
    accountId: "acct-checking",
    categoryId: "cat-rent",
    merchant: "Manual payment",
    source: "manual",
    recurringRuleId: "rule-other",
    createdAt: "2026-04-25T00:00:00.000Z",
    updatedAt: "2026-04-25T00:00:00.000Z",
  },
  {
    id: "txn-transfer-out",
    kind: "transfer",
    date: "2026-05-25",
    amountCents: -45000,
    accountId: "acct-checking",
    source: "recurring",
    recurringRuleId: "rule-transfer",
    transferGroupId: "transfer-1",
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
  },
  {
    id: "txn-transfer-in",
    kind: "transfer",
    date: "2026-05-25",
    amountCents: 45000,
    accountId: "acct-credit",
    source: "recurring",
    recurringRuleId: "rule-transfer",
    transferGroupId: "transfer-1",
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
  },
  {
    id: "txn-opening",
    kind: "opening-balance",
    date: "2026-04-01",
    amountCents: 50000,
    accountId: "acct-checking",
    source: "manual",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

describe("expected occurrence helpers", () => {
  it("derives monthly, weekly, biweekly, yearly, and transfer occurrences across an interval", () => {
    const occurrences = deriveExpectedOccurrences(
      recurringRules,
      transactions,
      {
        startDate: "2026-04-01",
        endDate: "2026-05-31",
      },
      "2026-04-21"
    );

    expect(occurrences.map((occurrence) => [occurrence.recurringRuleId, occurrence.date])).toEqual(
      expect.arrayContaining([
        ["rule-rent", "2026-04-01"],
        ["rule-rent", "2026-05-01"],
        ["rule-paycheck", "2026-04-01"],
        ["rule-paycheck", "2026-04-08"],
        ["rule-paycheck", "2026-04-15"],
        ["rule-paycheck", "2026-04-22"],
        ["rule-paycheck", "2026-04-29"],
        ["rule-paycheck", "2026-05-06"],
        ["rule-gym", "2026-04-03"],
        ["rule-gym", "2026-04-17"],
        ["rule-gym", "2026-05-01"],
        ["rule-gym", "2026-05-15"],
        ["rule-gym", "2026-05-29"],
        ["rule-insurance", "2026-04-30"],
        ["rule-transfer", "2026-04-25"],
        ["rule-transfer", "2026-05-25"],
      ])
    );
  });

  it("matches only on recurringRuleId plus scheduled date and classifies statuses", () => {
    const occurrences = deriveExpectedOccurrences(
      recurringRules,
      transactions,
      {
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      },
      "2026-04-21"
    );

    expect(
      occurrences.find((occurrence) => occurrence.id === "rule-rent:2026-04-01")?.status
    ).toBe("matched");
    expect(
      occurrences.find((occurrence) => occurrence.id === "rule-paycheck:2026-04-15")?.status
    ).toBe("overdue");
    expect(
      occurrences.find((occurrence) => occurrence.id === "rule-transfer:2026-04-25")?.status
    ).toBe("upcoming");
    expect(
      deriveExpectedOccurrences(
        recurringRules,
        transactions,
        {
          startDate: "2026-04-22",
          endDate: "2026-04-22",
        },
        "2026-04-22"
      )[0]?.status
    ).toBe("due");
  });

  it("derives transfer effects from one canonical expected occurrence", () => {
    const occurrences = deriveExpectedOccurrences(
      recurringRules,
      transactions,
      {
        startDate: "2026-05-25",
        endDate: "2026-05-25",
      },
      "2026-04-21"
    );

    expect(occurrences).toEqual([
      expect.objectContaining({
        recurringRuleId: "rule-transfer",
        date: "2026-05-25",
        status: "matched",
      }),
    ]);
    expect(getExpectedOccurrenceAccountEffects(occurrences)).toEqual([
      
    ]);
  });

  it("keeps archived category references visible in derived outputs", () => {
    const occurrences = deriveExpectedOccurrences(
      recurringRules,
      transactions,
      {
        startDate: "2026-04-30",
        endDate: "2026-04-30",
      },
      "2026-04-21"
    );

    expect(occurrences).toEqual([
      expect.objectContaining({
        recurringRuleId: "rule-insurance",
        categoryId: "cat-archived-insurance",
      }),
    ]);
  });

  it("handles month boundaries and due-soon summaries without any store coupling", () => {
    const occurrences = deriveExpectedOccurrences(
      recurringRules,
      transactions,
      {
        startDate: "2026-04-28",
        endDate: "2026-05-05",
      },
      "2026-04-30"
    );

    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      "2026-04-29",
      "2026-04-30",
      "2026-05-01",
      "2026-05-01",
    ]);

    expect(
      getExpectedOccurrenceDashboardSummary(
        occurrences,
        "2026-04-30",
        DASHBOARD_EXPECTED_WINDOW
      )
    ).toEqual({
      dueCount: 1,
      overdueCount: 1,
      nextSevenDaysCount: 2,
    });

    expect(
      getDueSoonExpectedOccurrences(
        occurrences,
        "2026-04-30",
        DASHBOARD_EXPECTED_WINDOW
      ).map(
        (occurrence) => occurrence.id
      )
    ).toEqual([
      "rule-paycheck:2026-04-29",
      "rule-insurance:2026-04-30",
      "rule-gym:2026-05-01",
      "rule-rent:2026-05-01",
    ]);
  });

  it("builds bounded operational intervals from a reference date", () => {
    expect(
      getExpectedOccurrenceIntervalForWindow("2026-04-21", DASHBOARD_EXPECTED_WINDOW)
    ).toEqual({
      startDate: "2026-04-07",
      endDate: "2026-04-28",
    });

    expect(
      getExpectedOccurrenceIntervalForWindow("2026-04-21", ACCOUNTS_EXPECTED_WINDOW)
    ).toEqual({
      startDate: "2026-04-07",
      endDate: "2026-05-21",
    });
  });

  it("bounds overdue semantics and orders operational rows by relevance", () => {
    const occurrences = deriveExpectedOccurrences(
      recurringRules,
      transactions,
      {
        startDate: "2026-03-01",
        endDate: "2026-05-05",
      },
      "2026-04-21"
    );

    expect(
      getOperationalExpectedOccurrences(
        occurrences,
        "2026-04-21",
        DASHBOARD_EXPECTED_WINDOW
      ).map((occurrence) => occurrence.id)
    ).toEqual([
      "rule-gym:2026-04-17",
      "rule-paycheck:2026-04-15",
      "rule-paycheck:2026-04-08",
      "rule-paycheck:2026-04-22",
      "rule-transfer:2026-04-25",
    ]);

    expect(
      getExpectedOccurrenceDashboardSummary(
        occurrences,
        "2026-04-21",
        DASHBOARD_EXPECTED_WINDOW
      )
    ).toEqual({
      dueCount: 0,
      overdueCount: 3,
      nextSevenDaysCount: 2,
    });
  });

  it("keeps due-soon limited to overdue items in lookback plus due and upcoming inside lookahead", () => {
    const occurrences = deriveExpectedOccurrences(
      recurringRules,
      transactions,
      {
        startDate: "2026-03-01",
        endDate: "2026-05-05",
      },
      "2026-04-21"
    );

    expect(
      getDueSoonExpectedOccurrences(
        occurrences,
        "2026-04-21",
        DASHBOARD_EXPECTED_WINDOW
      ).map((occurrence) => occurrence.id)
    ).toEqual([
      "rule-gym:2026-04-17",
      "rule-paycheck:2026-04-15",
      "rule-paycheck:2026-04-08",
      "rule-paycheck:2026-04-22",
      "rule-transfer:2026-04-25",
    ]);
  });
});