import { describe, expect, it } from "vitest";

import type { Account, Transaction } from "../../types";
import {
  buildTransactionListRows,
  filterTransactionRows,
  type TransactionFilters,
} from "./transaction-filters";

function createTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "txn-1",
    kind: "standard",
    date: "2026-04-10",
    amountCents: -1250,
    accountId: "acct-checking",
    categoryId: "cat-groceries",
    merchant: "Corner Store",
    note: "Weekly groceries",
    source: "manual",
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
    ...overrides,
  };
}

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
];

function createFilters(
  overrides: Partial<TransactionFilters> = {}
): TransactionFilters {
  return {
    month: "2026-04",
    accountId: null,
    categoryId: null,
    search: "",
    ...overrides,
  };
}

describe("filterTransactions", () => {
  const transactions = [
    createTransaction({
      id: "txn-month-match",
      date: "2026-04-05",
      merchant: "Corner Store",
      note: "Weekly groceries",
    }),
    createTransaction({
      id: "txn-other-month",
      date: "2026-05-01",
      merchant: "Rent Co",
      note: "May rent",
    }),
    createTransaction({
      id: "txn-other-account",
      accountId: "acct-savings",
      merchant: "Electric Co",
      note: "Utilities",
    }),
    createTransaction({
      id: "txn-other-category",
      categoryId: "cat-rent",
      merchant: "Landlord",
      note: "Monthly rent",
    }),
    createTransaction({
      id: "txn-note-match",
      merchant: "Unknown",
      note: "Reimbursement from Sam",
    }),
    createTransaction({
      id: "txn-transfer-out",
      kind: "transfer",
      categoryId: undefined,
      merchant: undefined,
      note: "Emergency fund",
      amountCents: -5000,
      transferGroupId: "transfer-1",
    }),
    createTransaction({
      id: "txn-transfer-in",
      kind: "transfer",
      accountId: "acct-savings",
      categoryId: undefined,
      merchant: undefined,
      note: "Emergency fund",
      amountCents: 5000,
      transferGroupId: "transfer-1",
    }),
    createTransaction({
      id: "txn-opening-balance",
      kind: "opening-balance",
      categoryId: undefined,
      merchant: undefined,
      note: "Imported from old ledger",
      amountCents: -12500,
    }),
  ];

  const rows = buildTransactionListRows(transactions, accounts);

  it("filters by month only", () => {
    const result = filterTransactionRows(rows, createFilters());

    expect(result.map((row) => row.id)).toEqual([
      "txn-month-match",
      "txn-other-account",
      "txn-other-category",
      "txn-note-match",
      "transfer-1",
      "txn-opening-balance",
    ]);
  });

  it("filters by account only", () => {
    const result = filterTransactionRows(
      rows,
      createFilters({ accountId: "acct-savings" })
    );

    expect(result.map((row) => row.id)).toEqual(["txn-other-account", "transfer-1"]);
  });

  it("filters by category only", () => {
    const result = filterTransactionRows(
      rows,
      createFilters({ categoryId: "cat-rent" })
    );

    expect(result.map((row) => row.id)).toEqual(["txn-other-category"]);
  });

  it("searches by merchant", () => {
    const result = filterTransactionRows(
      rows,
      createFilters({ search: "corner" })
    );

    expect(result.map((row) => row.id)).toEqual(["txn-month-match"]);
  });

  it("searches by note", () => {
    const result = filterTransactionRows(
      rows,
      createFilters({ search: "reimbursement" })
    );

    expect(result.map((row) => row.id)).toEqual(["txn-note-match"]);
  });

  it("uses case-insensitive search", () => {
    const result = filterTransactionRows(
      rows,
      createFilters({ search: "SAM" })
    );

    expect(result.map((row) => row.id)).toEqual(["txn-note-match"]);
  });

  it("composes filters together", () => {
    const result = filterTransactionRows(
      rows,
      createFilters({
        accountId: "acct-checking",
        categoryId: "cat-groceries",
        search: "weekly",
      })
    );

    expect(result.map((row) => row.id)).toEqual(["txn-month-match"]);
  });

  it("treats empty search as no search filter", () => {
    const result = filterTransactionRows(
      rows,
      createFilters({ search: "   " })
    );

    expect(result.map((row) => row.id)).toEqual([
      "txn-month-match",
      "txn-other-account",
      "txn-other-category",
      "txn-note-match",
      "transfer-1",
      "txn-opening-balance",
    ]);
  });

  it("treats null filter values as no filter", () => {
    const result = filterTransactionRows(
      rows,
      createFilters({ accountId: null, categoryId: null })
    );

    expect(result.map((row) => row.id)).toEqual([
      "txn-month-match",
      "txn-other-account",
      "txn-other-category",
      "txn-note-match",
      "transfer-1",
      "txn-opening-balance",
    ]);
  });

  it("searches transfer rows by account names and groups the pair once", () => {
    expect(rows.filter((row) => row.type === "transfer")).toHaveLength(1);

    const result = filterTransactionRows(rows, createFilters({ search: "savings" }));

    expect(result.map((row) => row.id)).toEqual(["transfer-1"]);
  });

  it("builds and filters opening-balance rows separately from categories", () => {
    expect(rows.find((row) => row.id === "txn-opening-balance")).toMatchObject({
      type: "opening-balance",
      accountId: "acct-checking",
      amountCents: -12500,
    });

    expect(
      filterTransactionRows(rows, createFilters({ categoryId: "cat-groceries" })).map(
        (row) => row.id
      )
    ).not.toContain("txn-opening-balance");

    expect(
      filterTransactionRows(rows, createFilters({ search: "opening balance" })).map(
        (row) => row.id
      )
    ).toEqual(["txn-opening-balance"]);
  });
});