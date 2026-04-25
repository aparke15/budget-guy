import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

import type { Account, Category, RecurringRule } from "../../types";
import {
  buildRecurringRuleCandidate,
  createRecurringRuleFormValues,
  ensureRecurringFormReferences,
  updateRecurringKind,
} from "./recurring-helpers";

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

const categories: Category[] = [
  {
    id: "cat-rent",
    name: "Rent",
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

describe("recurring helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds standard recurring rules using category-derived signs", () => {
    const rule = buildRecurringRuleCandidate(
      {
        kind: "standard",
        name: "Paycheck",
        amount: "1000.00",
        accountId: "acct-checking",
        toAccountId: "acct-savings",
        categoryId: "cat-salary",
        frequency: "monthly",
        startDate: "2026-04-01",
        endDate: "",
        active: true,
        dayOfMonth: "1",
        dayOfWeek: "",
        merchant: "Employer",
        note: "Salary",
      },
      categories
    );

    expect(rule).toMatchObject({
      kind: "standard",
      amountCents: 100000,
      categoryId: "cat-salary",
      merchant: "Employer",
      toAccountId: undefined,
    });
  });

  it("builds transfer recurring rules with positive amounts and no category fields", () => {
    const rule = buildRecurringRuleCandidate(
      {
        kind: "transfer",
        name: "Savings",
        amount: "50.00",
        accountId: "acct-checking",
        toAccountId: "acct-savings",
        categoryId: "cat-rent",
        frequency: "weekly",
        startDate: "2026-04-01",
        endDate: "",
        active: true,
        dayOfMonth: "",
        dayOfWeek: "3",
        merchant: "Ignored",
        note: "Move cash",
      },
      categories
    );

    expect(rule).toMatchObject({
      kind: "transfer",
      amountCents: 5000,
      accountId: "acct-checking",
      toAccountId: "acct-savings",
      categoryId: undefined,
      merchant: undefined,
      note: "Move cash",
    });
  });

  it("builds yearly recurring rules through the form helper", () => {
    const standardRule = buildRecurringRuleCandidate(
      {
        kind: "standard",
        name: "Annual Due",
        amount: "120.00",
        accountId: "acct-checking",
        toAccountId: "acct-savings",
        categoryId: "cat-rent",
        frequency: "yearly",
        startDate: "2026-09-12",
        endDate: "",
        active: true,
        dayOfMonth: "",
        dayOfWeek: "",
        merchant: "Club",
        note: "Annual fee",
      },
      categories
    );
    const transferRule = buildRecurringRuleCandidate(
      {
        kind: "transfer",
        name: "Annual Save",
        amount: "500.00",
        accountId: "acct-checking",
        toAccountId: "acct-savings",
        categoryId: "cat-rent",
        frequency: "yearly",
        startDate: "2026-12-31",
        endDate: "",
        active: true,
        dayOfMonth: "",
        dayOfWeek: "",
        merchant: "Ignored",
        note: "Year end transfer",
      },
      categories
    );

    expect(standardRule).toMatchObject({
      kind: "standard",
      frequency: "yearly",
      startDate: "2026-09-12",
      dayOfMonth: undefined,
      dayOfWeek: undefined,
    });
    expect(transferRule).toMatchObject({
      kind: "transfer",
      frequency: "yearly",
      startDate: "2026-12-31",
      dayOfMonth: undefined,
      dayOfWeek: undefined,
    });
  });

  it("loads existing transfer rules into transfer-specific form values", () => {
    const existing: RecurringRule = {
      id: "rule-transfer",
      kind: "transfer",
      name: "Savings",
      amountCents: 5000,
      accountId: "acct-checking",
      toAccountId: "acct-savings",
      frequency: "monthly",
      startDate: "2026-04-01",
      active: true,
      dayOfMonth: 1,
      note: "Move cash",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };

    expect(createRecurringRuleFormValues(accounts, categories, existing)).toEqual({
      kind: "transfer",
      name: "Savings",
      amount: "50.00",
      accountId: "acct-checking",
      toAccountId: "acct-savings",
      categoryId: "cat-rent",
      frequency: "monthly",
      startDate: "2026-04-01",
      endDate: "",
      active: true,
      dayOfMonth: "1",
      dayOfWeek: "",
      merchant: "",
      note: "Move cash",
    });
  });

  it("keeps recurring form references valid and can switch to transfer mode", () => {
    const ensured = ensureRecurringFormReferences(
      {
        kind: "standard",
        name: "",
        amount: "",
        accountId: "missing-account",
        toAccountId: "missing-account",
        categoryId: "missing-category",
        frequency: "monthly",
        startDate: "2026-04-21",
        endDate: "",
        active: true,
        dayOfMonth: "21",
        dayOfWeek: "2",
        merchant: "",
        note: "",
      },
      accounts,
      categories
    );
    const switched = updateRecurringKind(ensured, "transfer", accounts, categories);

    expect(ensured.accountId).toBe("acct-checking");
    expect(ensured.toAccountId).toBe("acct-savings");
    expect(ensured.categoryId).toBe("cat-rent");
    expect(switched.kind).toBe("transfer");
    expect(switched.toAccountId).toBe("acct-savings");
    expect(switched.merchant).toBe("");
  });

  it("defaults new recurring rules to active categories and keeps an archived selected category on edit", () => {
    const archivedCategories: Category[] = [
      {
        id: "cat-archived",
        name: "Old Rent",
        kind: "expense",
        archivedAt: "2026-04-10T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
      {
        id: "cat-active",
        name: "Groceries",
        kind: "expense",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    expect(createRecurringRuleFormValues(accounts, archivedCategories).categoryId).toBe(
      "cat-active"
    );

    expect(
      ensureRecurringFormReferences(
        {
          kind: "standard",
          name: "",
          amount: "",
          accountId: "acct-checking",
          toAccountId: "acct-savings",
          categoryId: "cat-archived",
          frequency: "monthly",
          startDate: "2026-04-21",
          endDate: "",
          active: true,
          dayOfMonth: "21",
          dayOfWeek: "2",
          merchant: "",
          note: "",
        },
        accounts,
        archivedCategories
      ).categoryId
    ).toBe("cat-archived");
  });

  it("clears schedule-only fields when switching to yearly frequency", () => {
    const existing: RecurringRule = {
      id: "rule-yearly",
      kind: "transfer",
      name: "Yearly Savings",
      amountCents: 5000,
      accountId: "acct-checking",
      toAccountId: "acct-savings",
      frequency: "yearly",
      startDate: "2026-04-21",
      endDate: "",
      active: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    } as RecurringRule;

    const values = createRecurringRuleFormValues(accounts, categories, existing);

    expect(values.frequency).toBe("yearly");
    expect(values.dayOfMonth).toBe("");
    expect(values.dayOfWeek).toBe("");
  });
});