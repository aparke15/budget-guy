import { describe, expect, it } from "vitest";

import {
  createDraftSummary,
  getAvailableBudgetCategories,
  getBudgetEditorRows,
  getDraftPlannedTotal,
  getDraftRemainingCents,
  hasBudgetForMonthCategory,
} from "./budget-page-helpers";
import type { Budget, Category, MonthlySummary, Transaction } from "../../types";

const categories: Category[] = [
  {
    id: "cat-rent",
    name: "Rent",
    kind: "expense",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "cat-food",
    name: "Food",
    kind: "expense",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "cat-salary",
    name: "Salary",
    kind: "income",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

const summary: MonthlySummary = {
  incomeCents: 300000,
  expenseCents: 125000,
  netCents: 175000,
  plannedCents: 130000,
  unassignedCents: 170000,
};

const budgets: Budget[] = [
  {
    id: "budget-rent",
    month: "2026-04",
    categoryId: "cat-rent",
    plannedCents: 120000,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "budget-food",
    month: "2026-04",
    categoryId: "cat-food",
    plannedCents: 25000,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "budget-other-month",
    month: "2026-05",
    categoryId: "cat-rent",
    plannedCents: 130000,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  {
    id: "txn-rent",
    kind: "standard",
    date: "2026-04-03",
    amountCents: -120000,
    accountId: "acct-1",
    categoryId: "cat-rent",
    source: "manual",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
  },
  {
    id: "txn-food",
    kind: "standard",
    date: "2026-04-04",
    amountCents: -4500,
    accountId: "acct-1",
    categoryId: "cat-food",
    source: "manual",
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
  },
];

describe("budget page helpers", () => {
  it("totals draft planned amounts for expense categories", () => {
    expect(
      getDraftPlannedTotal(getBudgetEditorRows(categories.filter((item) => item.kind === "expense"), budgets, transactions, "2026-04"), {
        "cat-rent": "1200.00",
        "cat-food": "45.67",
      })
    ).toBe(124567);
  });

  it("treats blank and invalid draft values as zero", () => {
    expect(
      getDraftPlannedTotal(getBudgetEditorRows(categories.filter((item) => item.kind === "expense"), budgets, transactions, "2026-04"), {
        "cat-rent": "",
        "cat-food": "oops",
      })
    ).toBe(0);
  });

  it("returns only existing budget rows for the selected month", () => {
    expect(
      getBudgetEditorRows(
        categories.filter((item) => item.kind === "expense"),
        budgets,
        transactions,
        "2026-04"
      )
    ).toEqual([
      {
        budgetId: "budget-food",
        categoryId: "cat-food",
        categoryName: "Food",
        plannedCents: 25000,
        actualCents: 4500,
        remainingCents: 20500,
        overBudget: false,
      },
      {
        budgetId: "budget-rent",
        categoryId: "cat-rent",
        categoryName: "Rent",
        plannedCents: 120000,
        actualCents: 120000,
        remainingCents: 0,
        overBudget: false,
      },
    ]);
  });

  it("lists only categories without a budget for the selected month", () => {
    expect(
      getAvailableBudgetCategories(
        categories.filter((item) => item.kind === "expense"),
        budgets,
        "2026-04"
      ).map((category) => category.id)
    ).toEqual([]);

    expect(
      getAvailableBudgetCategories(
        categories.filter((item) => item.kind === "expense"),
        budgets,
        "2026-05"
      ).map((category) => category.id)
    ).toEqual(["cat-food"]);
  });

  it("detects duplicate budgets for a month and category", () => {
    expect(hasBudgetForMonthCategory(budgets, "2026-04", "cat-rent")).toBe(true);
    expect(hasBudgetForMonthCategory(budgets, "2026-04", "cat-salary")).toBe(false);
  });

  it("creates a draft summary by overlaying planned and unassigned values", () => {
    expect(createDraftSummary(summary, 150000)).toEqual({
      incomeCents: 300000,
      expenseCents: 125000,
      netCents: 175000,
      plannedCents: 150000,
      unassignedCents: 150000,
    });
  });

  it("computes draft remaining using draft planned and actual spent", () => {
    expect(getDraftRemainingCents(20000, 4500)).toBe(15500);
    expect(getDraftRemainingCents(10000, 12000)).toBe(-2000);
  });
});
