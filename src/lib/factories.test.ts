import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAccount,
  createBudget,
  createOpeningBalanceTransaction,
  createTransferInput,
  createCategory,
  createRecurringRule,
  createTransferTransactions,
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
    expect(values.entryType).toBe("expense");
    expect(values.date).toBe("2026-04-21");
    expect(values.fromAccountId).toBe("acct-checking");
    expect(values.toAccountId).toBe("acct-checking");
  });

  it("maps an existing transaction into editable form values", () => {
    const existing: Transaction = {
      id: "txn-1",
      kind: "standard",
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

    expect(
      createTransactionFormValues(accounts, categories, {
        mode: "standard",
        transaction: existing,
      })
    ).toEqual({
      date: "2026-04-10",
      entryType: "expense",
      amount: "123.45",
      accountId: "acct-checking",
      categoryId: "cat-food",
      merchant: "Coffee Shop",
      note: "Morning",
      fromAccountId: "acct-checking",
      toAccountId: "acct-checking",
    });
  });

  it("creates an expense transaction and trims optional text fields", () => {
    const transaction = createTransaction({
      values: {
        date: "2026-04-21",
        entryType: "expense",
        amount: "123.45",
        accountId: "acct-checking",
        categoryId: "cat-food",
        merchant: "  Corner Store  ",
        note: "  snacks  ",
        fromAccountId: "acct-checking",
        toAccountId: "acct-checking",
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
      kind: "standard",
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
        entryType: "income",
        amount: "55.00",
        accountId: "acct-checking",
        categoryId: "cat-salary",
        merchant: "",
        note: "",
        fromAccountId: "acct-checking",
        toAccountId: "acct-checking",
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
          entryType: "expense",
          amount: "0",
          accountId: "acct-checking",
          categoryId: "cat-food",
          merchant: "",
          note: "",
          fromAccountId: "acct-checking",
          toAccountId: "acct-checking",
        },
      })
    ).toThrow("amount must be a positive number");
  });

  it("builds transfer form values and linked transfer transactions", () => {
    const values = createTransactionFormValues(accounts, categories, {
      mode: "transfer",
      transferGroupId: "transfer-1",
      date: "2026-04-22",
      fromAccountId: "acct-checking",
      toAccountId: "acct-savings",
      amountCents: 2500,
      note: "move",
    });

    expect(values).toEqual({
      date: "2026-04-22",
      entryType: "transfer",
      amount: "25.00",
      accountId: "acct-checking",
      categoryId: "cat-food",
      merchant: "",
      note: "move",
      fromAccountId: "acct-checking",
      toAccountId: "acct-savings",
    });

    const input = createTransferInput(values);
    const [fromTransaction, toTransaction] = createTransferTransactions({ input });

    expect(fromTransaction).toMatchObject({
      kind: "transfer",
      amountCents: -2500,
      accountId: "acct-checking",
      source: "manual",
      note: "move",
    });
    expect(toTransaction).toMatchObject({
      kind: "transfer",
      amountCents: 2500,
      accountId: "acct-savings",
      source: "manual",
      note: "move",
      transferGroupId: fromTransaction.transferGroupId,
    });
  });

  it("creates opening-balance transactions as manual uncategorized entries", () => {
    const transaction = createOpeningBalanceTransaction({
      accountId: "acct-checking",
      amountCents: -12345,
      date: "2026-04-21",
      note: "  starting point  ",
    });

    expect(transaction).toMatchObject({
      kind: "opening-balance",
      accountId: "acct-checking",
      amountCents: -12345,
      date: "2026-04-21",
      note: "starting point",
      source: "manual",
    });

    expect(transaction).not.toHaveProperty("categoryId");
    expect(transaction).not.toHaveProperty("merchant");
    expect(transaction).not.toHaveProperty("recurringRuleId");
    expect(transaction).not.toHaveProperty("transferGroupId");
  });

  it("creates trimmed account, category, budget, and recurring rule records", () => {
    const account = createAccount({
      name: "  Main Checking  ",
      type: "checking",
      creditLimitCents: 999999,
    });
    const creditAccount = createAccount({
      name: "  Rewards Card  ",
      type: "credit",
      creditLimitCents: 250000,
    });
    const category = createCategory({ name: "  Groceries  ", kind: "expense" });
    const budget = createBudget({
      month: "2026-04",
      categoryId: "cat-food",
      plannedCents: 45000,
    });
    const recurringRule = createRecurringRule({
      kind: "standard",
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
      creditLimitCents: undefined,
      createdAt: "2026-04-21T12:34:56.000Z",
      updatedAt: "2026-04-21T12:34:56.000Z",
    });
    expect(account.id.startsWith("acct-")).toBe(true);
    expect(creditAccount).toMatchObject({
      name: "Rewards Card",
      type: "credit",
      creditLimitCents: 250000,
    });

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
      kind: "standard",
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

  it("creates recurring transfer rules with positive amounts and no category fields", () => {
    const recurringRule = createRecurringRule({
      kind: "transfer",
      name: "  Savings Move  ",
      amountCents: -5000,
      accountId: "acct-checking",
      toAccountId: "acct-savings",
      frequency: "monthly",
      startDate: "2026-04-01",
      dayOfMonth: 1,
      note: "  Auto save  ",
    });

    expect(recurringRule).toMatchObject({
      kind: "transfer",
      name: "Savings Move",
      amountCents: 5000,
      accountId: "acct-checking",
      toAccountId: "acct-savings",
      categoryId: undefined,
      merchant: undefined,
      note: "Auto save",
    });
  });
});
