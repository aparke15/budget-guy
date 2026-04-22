import { describe, expect, it } from "vitest";

import {
  buildForecast,
  getForecastMonths,
  getProjectedRecurringTransactionsForMonth,
} from "./forecast";
import type { Account, RecurringRule, Transaction } from "../types";

const accounts: Account[] = [
  {
    id: "acct-checking",
    name: "Checking",
    type: "checking",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "acct-credit",
    name: "Credit Card",
    type: "credit",
    creditLimitCents: 150000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  {
    id: "txn-opening-checking",
    kind: "opening-balance",
    date: "2026-03-01",
    amountCents: 10000,
    accountId: "acct-checking",
    source: "manual",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "txn-opening-savings",
    kind: "opening-balance",
    date: "2026-03-01",
    amountCents: -5000,
    accountId: "acct-credit",
    source: "manual",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "txn-paycheck",
    kind: "standard",
    date: "2026-04-01",
    amountCents: 300000,
    accountId: "acct-checking",
    categoryId: "cat-salary",
    source: "manual",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "txn-rent",
    kind: "standard",
    date: "2026-04-02",
    amountCents: -120000,
    accountId: "acct-checking",
    categoryId: "cat-rent",
    source: "manual",
    createdAt: "2026-04-02T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
  },
];

const recurringRules: RecurringRule[] = [
  {
    id: "rule-paycheck",
    kind: "standard",
    name: "paycheck",
    amountCents: 200000,
    accountId: "acct-checking",
    categoryId: "cat-salary",
    frequency: "monthly",
    startDate: "2026-01-15",
    active: true,
    dayOfMonth: 15,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule-rent",
    kind: "standard",
    name: "rent",
    amountCents: -100000,
    accountId: "acct-checking",
    categoryId: "cat-rent",
    frequency: "monthly",
    startDate: "2026-01-01",
    active: true,
    dayOfMonth: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule-transfer",
    kind: "transfer",
    name: "pay card",
    amountCents: 50000,
    accountId: "acct-checking",
    toAccountId: "acct-credit",
    frequency: "monthly",
    startDate: "2026-01-20",
    active: true,
    dayOfMonth: 20,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("forecast helpers", () => {
  it("generates forecast month ranges for 3, 6, and 12 month horizons", () => {
    expect(getForecastMonths("2026-04", "3")).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
    expect(getForecastMonths("2026-04", "6")).toHaveLength(6);
    expect(getForecastMonths("2026-04", "12")).toHaveLength(12);
  });

  it("projects standard recurring income and expense totals", () => {
    const forecast = buildForecast(
      accounts,
      transactions,
      recurringRules,
      "2026-05",
      "3",
      "2026-04-21"
    );

    expect(forecast.monthlySummaryRows[0]).toEqual({
      month: "2026-05",
      projectedIncomeCents: 200000,
      projectedExpenseCents: 100000,
      projectedNetCents: 100000,
    });
  });

  it("excludes transfers from projected income, expenses, and net", () => {
    const projectedTransactions = getProjectedRecurringTransactionsForMonth(
      recurringRules,
      "2026-05",
      transactions,
      "2026-04-21"
    );

    expect(projectedTransactions.filter((transaction) => transaction.kind === "transfer"))
      .toHaveLength(2);

    const forecast = buildForecast(
      accounts,
      transactions,
      recurringRules,
      "2026-05",
      "3",
      "2026-04-21"
    );

    expect(forecast.monthlySummaryRows[0]?.projectedNetCents).toBe(100000);
  });

  it("includes recurring transfers in projected account balances", () => {
    const forecast = buildForecast(
      accounts,
      transactions,
      recurringRules,
      "2026-05",
      "3",
      "2026-04-21"
    );

    expect(forecast.accountBalanceRows).toEqual([
      {
        accountId: "acct-checking",
        accountName: "Checking",
        accountType: "checking",
        creditLimitCents: undefined,
        projectedBalances: [
          { month: "2026-05", endingBalanceCents: 240000 },
          { month: "2026-06", endingBalanceCents: 290000 },
          { month: "2026-07", endingBalanceCents: 340000 },
        ],
      },
      {
        accountId: "acct-credit",
        accountName: "Credit Card",
        accountType: "credit",
        creditLimitCents: 150000,
        projectedBalances: [
          { month: "2026-05", endingBalanceCents: 45000 },
          { month: "2026-06", endingBalanceCents: 95000 },
          { month: "2026-07", endingBalanceCents: 145000 },
        ],
      },
    ]);
  });

  it("respects recurring duplicate prevention for future months", () => {
    const withExistingFutureTransaction: Transaction[] = [
      ...transactions,
      {
        id: "txn-existing-future",
        kind: "standard",
        date: "2026-05-15",
        amountCents: 200000,
        accountId: "acct-checking",
        categoryId: "cat-salary",
        source: "recurring",
        recurringRuleId: "rule-paycheck",
        createdAt: "2026-04-21T00:00:00.000Z",
        updatedAt: "2026-04-21T00:00:00.000Z",
      },
    ];

    const forecast = buildForecast(
      accounts,
      withExistingFutureTransaction,
      recurringRules,
      "2026-05",
      "3",
      "2026-04-21"
    );

    expect(forecast.monthlySummaryRows[0]).toEqual({
      month: "2026-05",
      projectedIncomeCents: 0,
      projectedExpenseCents: 100000,
      projectedNetCents: -100000,
    });
  });

  it("does not mutate actual transactions when building the forecast", () => {
    const originalTransactions = transactions.map((transaction) => ({ ...transaction }));

    buildForecast(accounts, transactions, recurringRules, "2026-05", "3", "2026-04-21");

    expect(transactions).toEqual(originalTransactions);
  });
});