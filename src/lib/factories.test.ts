import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAccount,
  createBudget,
  createCategory,
  createRecurringRule,
  createTransaction,
  createTransactionFormValues,
} from "./factories";
import type { Account, Category, Transaction } from "../types";

const accounts: Account[] = [
  {
    id: "acct-checking",
    name: "Checking",
    type: "checking",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const categories: Category[] = [
  {
    id: "cat-food",
    name: "Food",
    kind: "expense",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-salary",
    name: "Salary",
    kind: "income",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("factory helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates default transaction form values from available accounts and expense categories", () => {
    const values = createTransactionFormValues(accounts, categories);

    expect(values.accountId).toBe("acct-checking");
    expect(values.categoryId).toBe("cat-food");
    expect(values.kind).toBe("expense");
    expect(values.date).toBe("2026-04-21");
  });

  it("maps an existing transaction into editable form values", () => {
    const existing: Transaction = {
      id: "txn-1",
      date: "2026-04-10",
      amountCents: -12345,
      accountId: "acct-checking",
      categoryId: "cat-food",
      merchant: "Coffee Shop",
      note: "Morning",
      source: "manual",
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    };

    expect(createTransactionFormValues(accounts, categories, existing)).toEqual({
      date: "2026-04-10",
      kind: "expense",
      amount: "123.45",
      accountId: "acct-checking",
      categoryId: "cat-food",
      merchant: "Coffee Shop",
      note: "Morning",
    });
  });

  it("creates an expense transaction and trims optional text fields", () => {
    const transaction = createTransaction({
      values: {
        date: "2026-04-21",
        kind: "expense",
        amount: "123.45",
        accountId: "acct-checking",
        categoryId: "cat-food",
        merchant: "  Corner Store  ",
        note: "  snacks  ",
      },
    });

    expect(transaction.id.startsWith("txn-")).toBe(true);
    expect(transaction.amountCents).toBe(-12345);
    expect(transaction.merchant).toBe("Corner Store");
    expect(transaction.note).toBe("snacks");
    expect(transaction.createdAt).toBe("2026-04-21T12:34:56.000Z");
    expect(transaction.updatedAt).toBe("2026-04-21T12:34:56.000Z");
  });

  it("preserves immutable fields when updating an existing transaction", () => {
    const existing: Transaction = {
      id: "txn-existing",
      date: "2026-04-01",
      amountCents: -1000,
      accountId: "acct-checking",
      categoryId: "cat-food",
      source: "recurring",
      recurringRuleId: "rule-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };

    const transaction = createTransaction({
      existing,
      values: {
        date: "2026-04-22",
        kind: "income",
        amount: "55.00",
        accountId: "acct-checking",
        categoryId: "cat-salary",
        merchant: "",
        note: "",
      },
    });

    expect(transaction).toMatchObject({
      id: "txn-existing",
      source: "recurring",
      recurringRuleId: "rule-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-21T12:34:56.000Z",
      amountCents: 5500,
      categoryId: "cat-salary",
    });
  });

  it("rejects invalid transaction amounts", () => {
    expect(() =>
      createTransaction({
        values: {
          date: "2026-04-21",
          kind: "expense",
          amount: "0",
          accountId: "acct-checking",
          categoryId: "cat-food",
          merchant: "",
          note: "",
        },
      })
    ).toThrow("amount must be a positive number");
  });

  it("creates trimmed account, category, budget, and recurring rule records", () => {
    const account = createAccount({ name: "  Main Checking  ", type: "checking" });
    const category = createCategory({ name: "  Groceries  ", kind: "expense" });
    const budget = createBudget({
      month: "2026-04",
      categoryId: "cat-food",
      plannedCents: 45000,
    });
    const recurringRule = createRecurringRule({
      name: "  Paycheck  ",
      amountCents: 250000,
      accountId: "acct-checking",
      categoryId: "cat-salary",
      frequency: "monthly",
      startDate: "2026-04-01",
      dayOfMonth: 1,
      merchant: "  Employer  ",
      note: "  Salary  ",
    });

    expect(account).toMatchObject({
      name: "Main Checking",
      type: "checking",
      createdAt: "2026-04-21T12:34:56.000Z",
      updatedAt: "2026-04-21T12:34:56.000Z",
    });
    expect(account.id.startsWith("acct-")).toBe(true);

    expect(category).toMatchObject({
      name: "Groceries",
      kind: "expense",
      createdAt: "2026-04-21T12:34:56.000Z",
      updatedAt: "2026-04-21T12:34:56.000Z",
    });
    expect(category.id.startsWith("cat-")).toBe(true);

    expect(budget).toMatchObject({
      month: "2026-04",
      categoryId: "cat-food",
      plannedCents: 45000,
      createdAt: "2026-04-21T12:34:56.000Z",
      updatedAt: "2026-04-21T12:34:56.000Z",
    });
    expect(budget.id.startsWith("budget-")).toBe(true);

    expect(recurringRule).toMatchObject({
      name: "Paycheck",
      amountCents: 250000,
      accountId: "acct-checking",
      categoryId: "cat-salary",
      frequency: "monthly",
      startDate: "2026-04-01",
      dayOfMonth: 1,
      active: true,
      merchant: "Employer",
      note: "Salary",
      createdAt: "2026-04-21T12:34:56.000Z",
      updatedAt: "2026-04-21T12:34:56.000Z",
    });
    expect(recurringRule.id.startsWith("rule-")).toBe(true);
  });
});
