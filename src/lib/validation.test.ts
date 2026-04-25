import { describe, expect, it } from "vitest";

import {
  accountSchema,
  persistedStateSchema,
  recurringRuleSchema,
  transactionSchema,
} from "./validation";
import { LATEST_PERSISTED_STATE_VERSION } from "../types";

describe("validation schemas", () => {
  it("validates credit account credit-limit rules", () => {
    expect(
      accountSchema.safeParse({
        id: "acct-credit",
        name: "card",
        type: "credit",
        creditLimitCents: 250000,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      }).success
    ).toBe(true);

    const nonCreditResult = accountSchema.safeParse({
      id: "acct-checking",
      name: "checking",
      type: "checking",
      creditLimitCents: 250000,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(nonCreditResult.success).toBe(false);
    if (!nonCreditResult.success) {
      expect(nonCreditResult.error.issues[0]?.message).toBe(
        "only credit accounts can include creditLimitCents"
      );
    }

    expect(
      accountSchema.safeParse({
        id: "acct-credit",
        name: "card",
        type: "credit",
        creditLimitCents: 0,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      }).success
    ).toBe(false);
  });

  it("treats transactions without kind as standard for persisted compatibility", () => {
    const result = persistedStateSchema.safeParse({
      version: LATEST_PERSISTED_STATE_VERSION,
      accounts: [],
      categories: [
        {
          id: "cat-1",
          name: "food",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-1",
          date: "2026-04-01",
          amountCents: -1200,
          accountId: "acct-1",
          categoryId: "cat-1",
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      budgets: [],
      recurringRules: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transactions[0]?.kind).toBe("standard");
    }
  });

  it("requires categoryId for standard transactions", () => {
    const result = transactionSchema.safeParse({
      id: "txn-1",
      kind: "standard",
      date: "2026-04-01",
      amountCents: -1200,
      accountId: "acct-1",
      source: "manual",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "standard transactions require categoryId"
      );
    }
  });

  it("validates transfer-specific transaction rules", () => {
    const result = transactionSchema.safeParse({
      id: "txn-1",
      kind: "transfer",
      date: "2026-04-01",
      amountCents: 2500,
      accountId: "acct-1",
      categoryId: "cat-1",
      source: "recurring",
      recurringRuleId: "rule-1",
      transferGroupId: "transfer-1",
      merchant: "bank",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual([
        "transfer transactions cannot include categoryId",
        "transfer transactions cannot include merchant",
      ]);
    }
  });

  it("validates opening-balance transaction rules", () => {
    const result = transactionSchema.safeParse({
      id: "txn-opening",
      kind: "opening-balance",
      date: "2026-04-01",
      amountCents: 0,
      accountId: "acct-1",
      categoryId: "cat-1",
      merchant: "bank",
      source: "recurring",
      recurringRuleId: "rule-1",
      transferGroupId: "transfer-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual([
        "opening-balance transactions cannot include categoryId",
        "opening-balance transactions cannot include transferGroupId",
        "opening-balance transactions cannot include recurringRuleId",
        "opening-balance transactions must use manual source",
        "opening-balance transactions cannot include merchant",
        "opening-balance transactions require a non-zero amount",
      ]);
    }
  });

  it("requires recurringRuleId for recurring transfer transactions", () => {
    const result = transactionSchema.safeParse({
      id: "txn-1",
      kind: "transfer",
      date: "2026-04-01",
      amountCents: -2500,
      accountId: "acct-1",
      source: "recurring",
      transferGroupId: "transfer-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "recurring transfer transactions require recurringRuleId"
      );
    }
  });

  it("treats recurring rules without kind as standard for persisted compatibility", () => {
    const result = persistedStateSchema.safeParse({
      version: LATEST_PERSISTED_STATE_VERSION,
      accounts: [],
      categories: [
        {
          id: "cat-1",
          name: "rent",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [],
      budgets: [],
      recurringRules: [
        {
          id: "rule-1",
          name: "Rent",
          amountCents: -120000,
          accountId: "acct-1",
          categoryId: "cat-1",
          frequency: "monthly",
          startDate: "2026-04-01",
          active: true,
          dayOfMonth: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recurringRules[0]?.kind).toBe("standard");
    }
  });

  it("rejects orphaned transfer groups in persisted state", () => {
    const result = persistedStateSchema.safeParse({
      version: LATEST_PERSISTED_STATE_VERSION,
      accounts: [],
      categories: [],
      transactions: [
        {
          id: "txn-1",
          kind: "transfer",
          date: "2026-04-01",
          amountCents: -2500,
          accountId: "acct-1",
          source: "manual",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      budgets: [],
      recurringRules: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "transfer group transfer-1 must contain exactly 2 transactions"
      );
    }
  });

  it("rejects multiple opening-balance transactions for one account", () => {
    const result = persistedStateSchema.safeParse({
      version: LATEST_PERSISTED_STATE_VERSION,
      accounts: [],
      categories: [],
      transactions: [
        {
          id: "txn-opening-1",
          kind: "opening-balance",
          date: "2026-04-01",
          amountCents: 100,
          accountId: "acct-1",
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "txn-opening-2",
          kind: "opening-balance",
          date: "2026-04-02",
          amountCents: 200,
          accountId: "acct-1",
          source: "manual",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
        },
      ],
      budgets: [],
      recurringRules: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "account acct-1 cannot have more than one opening-balance transaction"
      );
    }
  });

  it("accepts valid split standard transactions", () => {
    const result = transactionSchema.safeParse({
      id: "txn-split",
      kind: "standard",
      date: "2026-04-01",
      amountCents: -1200,
      accountId: "acct-1",
      splits: [
        {
          id: "split-1",
          categoryId: "cat-food",
          amountCents: -700,
        },
        {
          id: "split-2",
          categoryId: "cat-household",
          amountCents: -500,
        },
      ],
      source: "manual",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("rejects split transactions with fewer than 2 rows", () => {
    const result = transactionSchema.safeParse({
      id: "txn-split",
      kind: "standard",
      date: "2026-04-01",
      amountCents: -1200,
      accountId: "acct-1",
      splits: [
        {
          id: "split-1",
          categoryId: "cat-food",
          amountCents: -1200,
        },
      ],
      source: "manual",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "split transactions require at least 2 rows"
      );
    }
  });

  it("rejects split transactions with mismatched totals", () => {
    const result = transactionSchema.safeParse({
      id: "txn-split",
      kind: "standard",
      date: "2026-04-01",
      amountCents: -1200,
      accountId: "acct-1",
      splits: [
        {
          id: "split-1",
          categoryId: "cat-food",
          amountCents: -700,
        },
        {
          id: "split-2",
          categoryId: "cat-household",
          amountCents: -400,
        },
      ],
      source: "manual",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "split transaction amounts must add up to the parent amount"
      );
    }
  });

  it("rejects split transactions with a parent categoryId", () => {
    const result = transactionSchema.safeParse({
      id: "txn-split",
      kind: "standard",
      date: "2026-04-01",
      amountCents: -1200,
      accountId: "acct-1",
      categoryId: "cat-food",
      splits: [
        {
          id: "split-1",
          categoryId: "cat-food",
          amountCents: -700,
        },
        {
          id: "split-2",
          categoryId: "cat-household",
          amountCents: -500,
        },
      ],
      source: "manual",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "split transactions cannot include parent categoryId"
      );
    }
  });

  it("rejects transfer and opening-balance splits", () => {
    const transferResult = transactionSchema.safeParse({
      id: "txn-transfer",
      kind: "transfer",
      date: "2026-04-01",
      amountCents: -1200,
      accountId: "acct-1",
      splits: [
        {
          id: "split-1",
          categoryId: "cat-food",
          amountCents: -700,
        },
        {
          id: "split-2",
          categoryId: "cat-household",
          amountCents: -500,
        },
      ],
      source: "manual",
      transferGroupId: "transfer-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const openingResult = transactionSchema.safeParse({
      id: "txn-opening",
      kind: "opening-balance",
      date: "2026-04-01",
      amountCents: 1200,
      accountId: "acct-1",
      splits: [
        {
          id: "split-1",
          categoryId: "cat-income",
          amountCents: 700,
        },
        {
          id: "split-2",
          categoryId: "cat-income-bonus",
          amountCents: 500,
        },
      ],
      source: "manual",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(transferResult.success).toBe(false);
    expect(openingResult.success).toBe(false);
  });

  it("rejects split transactions with mixed category kind semantics", () => {
    const result = persistedStateSchema.safeParse({
      version: LATEST_PERSISTED_STATE_VERSION,
      accounts: [],
      categories: [
        {
          id: "cat-food",
          name: "Food",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "cat-income",
          name: "Salary",
          kind: "income",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-split",
          kind: "standard",
          date: "2026-04-01",
          amountCents: -1200,
          accountId: "acct-1",
          splits: [
            {
              id: "split-1",
              categoryId: "cat-food",
              amountCents: -700,
            },
            {
              id: "split-2",
              categoryId: "cat-income",
              amountCents: -500,
            },
          ],
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      budgets: [],
      recurringRules: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "split category cat-income must be a expense category"
      );
    }
  });

  it("rejects non-split standard transactions whose category kind does not match the amount sign", () => {
    const result = persistedStateSchema.safeParse({
      version: LATEST_PERSISTED_STATE_VERSION,
      accounts: [],
      categories: [
        {
          id: "cat-income",
          name: "Salary",
          kind: "income",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-standard",
          kind: "standard",
          date: "2026-04-01",
          amountCents: -1200,
          accountId: "acct-1",
          categoryId: "cat-income",
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      budgets: [],
      recurringRules: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "transaction category cat-income must be a expense category"
      );
    }
  });

  it("allows archived categories to remain valid persisted references", () => {
    const result = persistedStateSchema.safeParse({
      version: LATEST_PERSISTED_STATE_VERSION,
      accounts: [],
      categories: [
        {
          id: "cat-archived",
          name: "Old Dining",
          kind: "expense",
          archivedAt: "2026-04-10T00:00:00.000Z",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-standard",
          kind: "standard",
          date: "2026-04-11",
          amountCents: -1200,
          accountId: "acct-1",
          categoryId: "cat-archived",
          source: "manual",
          createdAt: "2026-04-11T00:00:00.000Z",
          updatedAt: "2026-04-11T00:00:00.000Z",
        },
      ],
      budgets: [
        {
          id: "budget-1",
          month: "2026-04",
          categoryId: "cat-archived",
          plannedCents: 5000,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-1",
          kind: "standard",
          name: "old dining",
          amountCents: -1000,
          accountId: "acct-1",
          categoryId: "cat-archived",
          frequency: "monthly",
          startDate: "2026-04-01",
          active: true,
          dayOfMonth: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects persisted states with missing category references", () => {
    const result = persistedStateSchema.safeParse({
      version: LATEST_PERSISTED_STATE_VERSION,
      accounts: [],
      categories: [
        {
          id: "cat-existing",
          name: "Food",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-split",
          kind: "standard",
          date: "2026-04-01",
          amountCents: -1200,
          accountId: "acct-1",
          splits: [
            {
              id: "split-1",
              categoryId: "cat-existing",
              amountCents: -700,
            },
            {
              id: "split-2",
              categoryId: "cat-missing",
              amountCents: -500,
            },
          ],
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      budgets: [
        {
          id: "budget-1",
          month: "2026-04",
          categoryId: "cat-missing",
          plannedCents: 1000,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-1",
          kind: "standard",
          name: "food",
          amountCents: -1000,
          accountId: "acct-1",
          categoryId: "cat-missing",
          frequency: "monthly",
          startDate: "2026-04-01",
          active: true,
          dayOfMonth: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "budget category cat-missing must exist",
          "recurring rule category cat-missing must exist",
          "split category cat-missing must exist",
        ])
      );
    }
  });

  it("requires dayOfMonth for monthly recurring rules", () => {
    const result = recurringRuleSchema.safeParse({
      id: "rule-1",
      kind: "standard",
      name: "Rent",
      amountCents: -120000,
      accountId: "acct-1",
      categoryId: "cat-1",
      frequency: "monthly",
      startDate: "2026-04-01",
      active: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("monthly rules require dayOfMonth");
    }
  });

  it("requires dayOfWeek for weekly recurring rules", () => {
    const result = recurringRuleSchema.safeParse({
      id: "rule-1",
      kind: "standard",
      name: "Gym",
      amountCents: -2500,
      accountId: "acct-1",
      categoryId: "cat-1",
      frequency: "weekly",
      startDate: "2026-04-01",
      active: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "weekly and biweekly rules require dayOfWeek"
      );
    }
  });

  it("allows yearly recurring rules without dayOfMonth or dayOfWeek", () => {
    const standardResult = recurringRuleSchema.safeParse({
      id: "rule-yearly-standard",
      kind: "standard",
      name: "insurance",
      amountCents: -15000,
      accountId: "acct-1",
      categoryId: "cat-1",
      frequency: "yearly",
      startDate: "2024-09-12",
      active: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const transferResult = recurringRuleSchema.safeParse({
      id: "rule-yearly-transfer",
      kind: "transfer",
      name: "ira",
      amountCents: 50000,
      accountId: "acct-1",
      toAccountId: "acct-2",
      frequency: "yearly",
      startDate: "2024-02-29",
      active: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(standardResult.success).toBe(true);
    expect(transferResult.success).toBe(true);
  });

  it("validates standard and transfer recurring rule requirements", () => {
    const standardResult = recurringRuleSchema.safeParse({
      id: "rule-standard",
      kind: "standard",
      name: "Rent",
      amountCents: -120000,
      accountId: "acct-1",
      toAccountId: "acct-2",
      frequency: "monthly",
      startDate: "2026-04-01",
      active: true,
      dayOfMonth: 1,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const transferResult = recurringRuleSchema.safeParse({
      id: "rule-transfer",
      kind: "transfer",
      name: "Savings",
      amountCents: -5000,
      accountId: "acct-1",
      toAccountId: "acct-1",
      categoryId: "cat-1",
      frequency: "weekly",
      startDate: "2026-04-01",
      active: true,
      dayOfWeek: 3,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(standardResult.success).toBe(false);
    if (!standardResult.success) {
      expect(standardResult.error.issues.map((issue) => issue.message)).toEqual([
        "standard recurring rules require categoryId",
        "standard recurring rules cannot include toAccountId",
      ]);
    }

    expect(transferResult.success).toBe(false);
    if (!transferResult.success) {
      expect(transferResult.error.issues.map((issue) => issue.message)).toEqual([
        "transfer recurring rules cannot include categoryId",
        "transfer recurring rules require a positive amount",
        "transfer recurring rules must use two different accounts",
      ]);
    }
  });
});
