import { describe, expect, it } from "vitest";

import {
  formatCentsForInput,
  getBudgetRows,
  getMonthlySummary,
  parseAmountInputToCents,
  sumCategoryActualCents,
  sumExpenseCents,
  sumIncomeCents,
} from "./money";
import type { Budget, Category, Transaction } from "../types";

const categories: Category[] = [
  {
    id: "cat-rent",
    name: "Rent",
    kind: "expense",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
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

const transactions: Transaction[] = [
  {
    id: "txn-1",
    date: "2026-04-01",
    amountCents: 250000,
    accountId: "acct-1",
    categoryId: "cat-salary",
    source: "manual",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "txn-2",
    date: "2026-04-02",
    amountCents: -120000,
    accountId: "acct-1",
    categoryId: "cat-rent",
    source: "manual",
    createdAt: "2026-04-02T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
  },
  {
    id: "txn-3",
    date: "2026-04-03",
    amountCents: -4500,
    accountId: "acct-1",
    categoryId: "cat-food",
    source: "manual",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
  },
  {
    id: "txn-4",
    date: "2026-03-31",
    amountCents: -9999,
    accountId: "acct-1",
    categoryId: "cat-food",
    source: "manual",
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
  },
];

const budgets: Budget[] = [
  {
    id: "budget-1",
    month: "2026-04",
    categoryId: "cat-rent",
    plannedCents: 110000,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "budget-2",
    month: "2026-04",
    categoryId: "cat-food",
    plannedCents: 20000,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "budget-3",
    month: "2026-03",
    categoryId: "cat-food",
    plannedCents: 99999,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
];

describe("money utilities", () => {
  it("formats cents for inputs using absolute value", () => {
    expect(formatCentsForInput(-12345)).toBe("123.45");
  });

  it("parses decimal input into cents and rejects invalid values", () => {
    expect(parseAmountInputToCents(" $1,234.56 ")).toBe(123456);
    expect(parseAmountInputToCents("0.015")).toBe(2);
    expect(parseAmountInputToCents("")).toBeNull();
    expect(parseAmountInputToCents("nope")).toBeNull();
  });

  it("sums income and expense values for a month", () => {
    expect(sumIncomeCents(transactions, "2026-04")).toBe(250000);
    expect(sumExpenseCents(transactions, "2026-04")).toBe(124500);
    expect(sumCategoryActualCents(transactions, "2026-04", "cat-food")).toBe(4500);
  });

  it("computes monthly summary values from transactions and budgets", () => {
    expect(getMonthlySummary(transactions, budgets, "2026-04")).toEqual({
      incomeCents: 250000,
      expenseCents: 124500,
      netCents: 125500,
      plannedCents: 130000,
      unassignedCents: 120000,
    });
  });

  it("builds budget rows for expense categories only and sorts by actual spend", () => {
    expect(getBudgetRows(categories, budgets, transactions, "2026-04")).toEqual([
      {
        categoryId: "cat-rent",
        categoryName: "Rent",
        plannedCents: 110000,
        actualCents: 120000,
        remainingCents: -10000,
        overBudget: true,
      },
      {
        categoryId: "cat-food",
        categoryName: "Food",
        plannedCents: 20000,
        actualCents: 4500,
        remainingCents: 15500,
        overBudget: false,
      },
    ]);
  });
});
