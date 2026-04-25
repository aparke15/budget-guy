import { describe, expect, it } from "vitest";

import {
  getSelectableCategories,
  getVisibleBudgetCategories,
} from "./categories";
import type { Category, Transaction } from "../types";

const categories: Category[] = [
  {
    id: "cat-active-expense",
    name: "Groceries",
    kind: "expense",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "cat-archived-expense",
    name: "Old Dining",
    kind: "expense",
    archivedAt: "2026-04-10T00:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
  },
  {
    id: "cat-active-income",
    name: "Salary",
    kind: "income",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

describe("category helpers", () => {
  it("filters archived categories out of new selection lists by default", () => {
    expect(
      getSelectableCategories(categories, { kind: "expense" }).map(
        (category) => category.id
      )
    ).toEqual(["cat-active-expense"]);

    expect(
      getSelectableCategories(categories, {
        kind: "expense",
        includeCategoryIds: ["cat-archived-expense"],
      }).map((category) => category.id)
    ).toEqual(["cat-active-expense", "cat-archived-expense"]);
  });

  it("keeps archived split categories selectable when they are already referenced", () => {
    expect(
      getSelectableCategories(categories, {
        kind: "expense",
        includeCategoryIds: ["cat-archived-expense", "cat-active-expense"],
      }).map((category) => category.id)
    ).toEqual(["cat-active-expense", "cat-archived-expense"]);
  });

  it("keeps archived budget categories visible only when the month still references them", () => {
    const transactions: Transaction[] = [
      {
        id: "txn-1",
        kind: "standard",
        date: "2026-04-15",
        amountCents: -1200,
        accountId: "acct-1",
        categoryId: "cat-archived-expense",
        source: "manual",
        createdAt: "2026-04-15T00:00:00.000Z",
        updatedAt: "2026-04-15T00:00:00.000Z",
      },
    ];

    expect(
      getVisibleBudgetCategories(categories, [], transactions, "2026-04").map(
        (category) => category.id
      )
    ).toEqual(["cat-active-expense", "cat-archived-expense"]);

    expect(
      getVisibleBudgetCategories(categories, [], transactions, "2026-05").map(
        (category) => category.id
      )
    ).toEqual(["cat-active-expense"]);
  });
});