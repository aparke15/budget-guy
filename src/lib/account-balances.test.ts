import { describe, expect, it } from "vitest";

import {
  getAvailableCreditCents,
  getAccountBalanceCents,
  getAccountLedgerBalanceCents,
  getAccountMonthlyHistoryRows,
  getDisplayedAccountBalanceCents,
  getDisplayedAccountBalanceLabel,
  getAllAccountBalances,
} from "./account-balances";
import type { Account, Budget, Transaction } from "../types";

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
    name: "Visa",
    type: "credit",
    creditLimitCents: 200000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  {
    id: "txn-opening",
    kind: "opening-balance",
    date: "2026-01-01",
    amountCents: -25000,
    accountId: "acct-checking",
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "txn-1",
    kind: "standard",
    date: "2026-01-15",
    amountCents: 200000,
    accountId: "acct-checking",
    categoryId: "cat-salary",
    source: "manual",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "txn-2",
    kind: "standard",
    date: "2026-01-20",
    amountCents: -50000,
    accountId: "acct-checking",
    categoryId: "cat-rent",
    source: "manual",
    createdAt: "2026-01-20T00:00:00.000Z",
    updatedAt: "2026-01-20T00:00:00.000Z",
  },
  {
    id: "txn-3",
    kind: "transfer",
    date: "2026-02-02",
    amountCents: -25000,
    accountId: "acct-checking",
    source: "manual",
    transferGroupId: "transfer-1",
    createdAt: "2026-02-02T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
  },
  {
    id: "txn-4",
    kind: "transfer",
    date: "2026-02-02",
    amountCents: 25000,
    accountId: "acct-savings",
    source: "manual",
    transferGroupId: "transfer-1",
    createdAt: "2026-02-02T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
  },
  {
    id: "txn-5",
    kind: "standard",
    date: "2026-03-03",
    amountCents: -10000,
    accountId: "acct-checking",
    categoryId: "cat-food",
    source: "manual",
    createdAt: "2026-03-03T00:00:00.000Z",
    updatedAt: "2026-03-03T00:00:00.000Z",
  },
  {
    id: "txn-6",
    kind: "standard",
    date: "2026-04-05",
    amountCents: 10000,
    accountId: "acct-savings",
    categoryId: "cat-interest",
    source: "manual",
    createdAt: "2026-04-05T00:00:00.000Z",
    updatedAt: "2026-04-05T00:00:00.000Z",
  },
  {
    id: "txn-credit-opening",
    kind: "opening-balance",
    date: "2026-01-01",
    amountCents: -20000,
    accountId: "acct-credit",
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "txn-credit-expense",
    kind: "standard",
    date: "2026-02-05",
    amountCents: -5000,
    accountId: "acct-credit",
    categoryId: "cat-food",
    source: "manual",
    createdAt: "2026-02-05T00:00:00.000Z",
    updatedAt: "2026-02-05T00:00:00.000Z",
  },
  {
    id: "txn-credit-refund",
    kind: "standard",
    date: "2026-02-10",
    amountCents: 1000,
    accountId: "acct-credit",
    categoryId: "cat-food",
    source: "manual",
    createdAt: "2026-02-10T00:00:00.000Z",
    updatedAt: "2026-02-10T00:00:00.000Z",
  },
  {
    id: "txn-credit-payment-out",
    kind: "transfer",
    date: "2026-03-10",
    amountCents: -4000,
    accountId: "acct-checking",
    source: "manual",
    transferGroupId: "transfer-credit-payment",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
  },
  {
    id: "txn-credit-payment-in",
    kind: "transfer",
    date: "2026-03-10",
    amountCents: 4000,
    accountId: "acct-credit",
    source: "manual",
    transferGroupId: "transfer-credit-payment",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
  },
];

const budgets: Budget[] = [
  {
    id: "budget-1",
    month: "2026-02",
    categoryId: "cat-rent",
    plannedCents: 999999,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
];

describe("account balance helpers", () => {
  it("calculates current balance per account from transactions only", () => {
    expect(getAccountBalanceCents(transactions, "acct-checking")).toBe(86000);
    expect(getAccountBalanceCents(transactions, "acct-savings")).toBe(35000);
    expect(getAccountLedgerBalanceCents(transactions, "acct-credit")).toBe(-20000);
    expect(budgets).toHaveLength(1);
  });

  it("includes transfers in balances and preserves non-credit display values", () => {
    expect(getAllAccountBalances(accounts, transactions)).toEqual([
      {
        accountId: "acct-checking",
        accountName: "Checking",
        accountType: "checking",
        balanceCents: 86000,
        displayLabel: "balance",
        displayValueCents: 86000,
        creditLimitCents: undefined,
        availableCreditCents: undefined,
      },
      {
        accountId: "acct-savings",
        accountName: "Savings",
        accountType: "savings",
        balanceCents: 35000,
        displayLabel: "balance",
        displayValueCents: 35000,
        creditLimitCents: undefined,
        availableCreditCents: undefined,
      },
      {
        accountId: "acct-credit",
        accountName: "Visa",
        accountType: "credit",
        balanceCents: -20000,
        displayLabel: "balance",
        displayValueCents: -20000,
        creditLimitCents: 200000,
        availableCreditCents: 180000,
      },
    ]);
  });

  it("keeps account balance display signed while still deriving available credit", () => {
    const creditAccount = accounts[2]!;

    expect(getDisplayedAccountBalanceLabel(creditAccount)).toBe("balance");
    expect(getDisplayedAccountBalanceCents(creditAccount, -20000)).toBe(-20000);
    expect(getDisplayedAccountBalanceCents(creditAccount, 5000)).toBe(5000);
    expect(getAvailableCreditCents(creditAccount, -20000)).toBe(180000);
    expect(getAvailableCreditCents(creditAccount, 5000)).toBe(200000);
  });

  it("builds monthly history rows with inflows, outflows, net change, and closing balance", () => {
    expect(
      getAccountMonthlyHistoryRows(transactions, "acct-checking", "all", "2026-12")
    ).toEqual([
      {
        month: "2026-03",
        inflowsCents: 0,
        outflowsCents: 14000,
        netChangeCents: -14000,
        closingBalanceCents: 86000,
      },
      {
        month: "2026-02",
        inflowsCents: 0,
        outflowsCents: 25000,
        netChangeCents: -25000,
        closingBalanceCents: 100000,
      },
      {
        month: "2026-01",
        inflowsCents: 200000,
        outflowsCents: 75000,
        netChangeCents: 125000,
        closingBalanceCents: 125000,
      },
    ]);
  });

  it("accumulates closing balances correctly for transfer destination accounts", () => {
    expect(
      getAccountMonthlyHistoryRows(transactions, "acct-savings", "all", "2026-12")
    ).toEqual([
      {
        month: "2026-04",
        inflowsCents: 10000,
        outflowsCents: 0,
        netChangeCents: 10000,
        closingBalanceCents: 35000,
      },
      {
        month: "2026-02",
        inflowsCents: 25000,
        outflowsCents: 0,
        netChangeCents: 25000,
        closingBalanceCents: 25000,
      },
    ]);
  });

  it("shows credit account history as ledger-driven owed reduction after refunds and payments", () => {
    expect(
      getAccountMonthlyHistoryRows(transactions, "acct-credit", "all", "2026-12")
    ).toEqual([
      {
        month: "2026-03",
        inflowsCents: 4000,
        outflowsCents: 0,
        netChangeCents: 4000,
        closingBalanceCents: -20000,
      },
      {
        month: "2026-02",
        inflowsCents: 1000,
        outflowsCents: 5000,
        netChangeCents: -4000,
        closingBalanceCents: -24000,
      },
      {
        month: "2026-01",
        inflowsCents: 0,
        outflowsCents: 20000,
        netChangeCents: -20000,
        closingBalanceCents: -20000,
      },
    ]);
  });

  it("filters history rows by 6, 12, and all month ranges", () => {
    const extendedTransactions: Transaction[] = [
      ...transactions,
      {
        id: "txn-older",
        kind: "standard",
        date: "2025-04-10",
        amountCents: 5000,
        accountId: "acct-checking",
        categoryId: "cat-salary",
        source: "manual",
        createdAt: "2025-04-10T00:00:00.000Z",
        updatedAt: "2025-04-10T00:00:00.000Z",
      },
    ];

    expect(
      getAccountMonthlyHistoryRows(extendedTransactions, "acct-checking", "6", "2026-03")
    ).toEqual([
      expect.objectContaining({ month: "2026-03" }),
      expect.objectContaining({ month: "2026-02" }),
      expect.objectContaining({ month: "2026-01" }),
    ]);
    expect(
      getAccountMonthlyHistoryRows(extendedTransactions, "acct-checking", "12", "2026-03")
        .map((row) => row.month)
    ).toEqual(["2026-03", "2026-02", "2026-01", "2025-04"]);
    expect(
      getAccountMonthlyHistoryRows(extendedTransactions, "acct-checking", "all", "2026-03")
        .map((row) => row.month)
    ).toEqual(["2026-03", "2026-02", "2026-01", "2025-04"]);
  });

  it("returns empty history for accounts with no transactions", () => {
    expect(getAccountMonthlyHistoryRows([], "acct-checking", "all", "2026-04")).toEqual([]);
  });
});