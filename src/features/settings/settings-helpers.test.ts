import { describe, expect, it } from "vitest";

import {
  buildDeleteImpact,
  countById,
  normalizeEntityName,
  sortItemsByName,
  type PendingDelete,
} from "./settings-helpers";
import type { Budget, RecurringRule, Transaction } from "../../types";

const budgets: Budget[] = [
  {
    id: "budget-1",
    month: "2026-04",
    categoryId: "cat-1",
    plannedCents: 10000,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

const recurringRules: RecurringRule[] = [
  {
    id: "rule-1",
    name: "Rent",
    amountCents: -10000,
    accountId: "acct-1",
    categoryId: "cat-1",
    frequency: "monthly",
    startDate: "2026-04-01",
    active: true,
    dayOfMonth: 1,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  {
    id: "txn-1",
    date: "2026-04-01",
    amountCents: -10000,
    accountId: "acct-1",
    categoryId: "cat-1",
    source: "manual",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "txn-2",
    date: "2026-04-15",
    amountCents: -10000,
    accountId: "acct-1",
    categoryId: "cat-1",
    source: "recurring",
    recurringRuleId: "rule-1",
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  },
];

describe("settings helpers", () => {
  it("normalizes names for duplicate comparisons", () => {
    expect(normalizeEntityName("  Main Checking ")).toBe("main checking");
  });

  it("sorts items by display name", () => {
    expect(
      sortItemsByName([
        { id: "2", name: "zeta" },
        { id: "1", name: "alpha" },
      ])
    ).toEqual([
      { id: "1", name: "alpha" },
      { id: "2", name: "zeta" },
    ]);
  });

  it("counts related items by referenced id and skips missing ids", () => {
    expect(
      countById(transactions, (transaction) => transaction.recurringRuleId)
    ).toEqual({
      "rule-1": 1,
    });
  });

  it("builds account delete impact copy", () => {
    const pendingDelete: PendingDelete = {
      entity: "account",
      id: "acct-1",
      name: "checking",
    };

    expect(
      buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules)
    ).toEqual({
      title: "delete account: checking",
      description: "this will remove 2 transactions and 1 recurring rule.",
    });
  });

  it("builds category delete impact copy", () => {
    const pendingDelete: PendingDelete = {
      entity: "category",
      id: "cat-1",
      name: "rent",
    };

    expect(
      buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules)
    ).toEqual({
      title: "delete category: rent",
      description:
        "this will remove 1 budget, 2 transactions, and 1 recurring rule.",
    });
  });

  it("builds recurring rule delete impact copy", () => {
    const pendingDelete: PendingDelete = {
      entity: "rule",
      id: "rule-1",
      name: "rent",
    };

    expect(
      buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules)
    ).toEqual({
      title: "delete recurring rule: rent",
      description:
        "this removes the rule only. 1 previously generated transaction will stay in history.",
    });
  });
});
