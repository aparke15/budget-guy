import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateOccurrencesForMonth,
  getFirstWeekdayOnOrAfter,
  getMonthRange,
  getMonthKey,
  getMonthlyOccurrenceDate,
  getTodayDateKey,
  getYearlyOccurrenceDate,
  isDateWithinBounds,
} from "./dates";
import type { RecurringRule, Transaction } from "../types";

function createRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: "rule-1",
    kind: "standard",
    name: "rule",
    amountCents: -5000,
    accountId: "acct-1",
    categoryId: "cat-1",
    frequency: "monthly",
    startDate: "2026-01-01",
    active: true,
    dayOfMonth: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("dates utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gets a month key from an iso date", () => {
    expect(getMonthKey("2026-04-21")).toBe("2026-04");
  });

  it("builds today's date key using local calendar formatting", () => {
    vi.setSystemTime(new Date("2026-04-21T23:34:56"));

    expect(getTodayDateKey()).toBe("2026-04-21");
  });

  it("builds a consecutive month range from a start month", () => {
    expect(getMonthRange("2026-11", 4)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(getMonthRange("2026-11", 0)).toEqual([]);
  });

  it("clamps monthly occurrence dates to the last day of the month", () => {
    expect(getMonthlyOccurrenceDate("2026-02", 31)).toBe("2026-02-28");
    expect(getMonthlyOccurrenceDate("2024-02", 31)).toBe("2024-02-29");
  });

  it("returns yearly occurrence dates only for matching months and valid calendar days", () => {
    expect(getYearlyOccurrenceDate("2026-09", "2024-09-12")).toBe("2026-09-12");
    expect(getYearlyOccurrenceDate("2026-10", "2024-09-12")).toBeNull();
    expect(getYearlyOccurrenceDate("2025-02", "2024-02-29")).toBeNull();
    expect(getYearlyOccurrenceDate("2028-02", "2024-02-29")).toBe("2028-02-29");
  });

  it("treats date bounds as inclusive", () => {
    expect(isDateWithinBounds("2026-03-01", "2026-03-01", "2026-03-31")).toBe(true);
    expect(isDateWithinBounds("2026-03-31", "2026-03-01", "2026-03-31")).toBe(true);
    expect(isDateWithinBounds("2026-02-28", "2026-03-01", "2026-03-31")).toBe(false);
    expect(isDateWithinBounds("2026-04-01", "2026-03-01", "2026-03-31")).toBe(false);
  });

  it("finds the first weekday on or after a start date", () => {
    expect(getFirstWeekdayOnOrAfter("2026-04-21", 2)).toBe("2026-04-21");
    expect(getFirstWeekdayOnOrAfter("2026-04-21", 5)).toBe("2026-04-24");
  });

  it("generates monthly recurring occurrences and skips duplicates", () => {
    const rule = createRule({
      dayOfMonth: 31,
      startDate: "2026-01-15",
      endDate: "2026-12-31",
    });
    const existingTransactions: Transaction[] = [
      {
        id: "txn-1",
        kind: "standard",
        date: "2026-02-28",
        amountCents: -5000,
        accountId: "acct-1",
        categoryId: "cat-1",
        source: "recurring",
        recurringRuleId: rule.id,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ];

    expect(generateOccurrencesForMonth(rule, "2026-02", existingTransactions)).toEqual([]);
  });

  it("generates weekly occurrences within the selected month and end date", () => {
    const rule = createRule({
      frequency: "weekly",
      startDate: "2026-01-05",
      endDate: "2026-02-16",
      dayOfWeek: 1,
      dayOfMonth: undefined,
    });

    expect(generateOccurrencesForMonth(rule, "2026-02", [])).toEqual([
      {
        recurringRuleId: "rule-1",
        kind: "standard",
        date: "2026-02-02",
        amountCents: -5000,
        accountId: "acct-1",
        toAccountId: undefined,
        categoryId: "cat-1",
        merchant: undefined,
        note: undefined,
      },
      {
        recurringRuleId: "rule-1",
        kind: "standard",
        date: "2026-02-09",
        amountCents: -5000,
        accountId: "acct-1",
        toAccountId: undefined,
        categoryId: "cat-1",
        merchant: undefined,
        note: undefined,
      },
      {
        recurringRuleId: "rule-1",
        kind: "standard",
        date: "2026-02-16",
        amountCents: -5000,
        accountId: "acct-1",
        toAccountId: undefined,
        categoryId: "cat-1",
        merchant: undefined,
        note: undefined,
      },
    ]);
  });

  it("generates biweekly occurrences using the anchor weekday cadence", () => {
    const rule = createRule({
      frequency: "biweekly",
      startDate: "2026-01-06",
      dayOfWeek: 2,
      dayOfMonth: undefined,
    });

    expect(generateOccurrencesForMonth(rule, "2026-02", [])).toEqual([
      {
        recurringRuleId: "rule-1",
        kind: "standard",
        date: "2026-02-03",
        amountCents: -5000,
        accountId: "acct-1",
        toAccountId: undefined,
        categoryId: "cat-1",
        merchant: undefined,
        note: undefined,
      },
      {
        recurringRuleId: "rule-1",
        kind: "standard",
        date: "2026-02-17",
        amountCents: -5000,
        accountId: "acct-1",
        toAccountId: undefined,
        categoryId: "cat-1",
        merchant: undefined,
        note: undefined,
      },
    ]);
  });

  it("returns no occurrences for inactive rules", () => {
    const rule = createRule({ active: false });

    expect(generateOccurrencesForMonth(rule, "2026-02", [])).toEqual([]);
  });

  it("generates yearly standard occurrences only in matching month/day cases", () => {
    const rule = createRule({
      frequency: "yearly",
      startDate: "2024-09-12",
      endDate: "2027-09-12",
      dayOfMonth: undefined,
      dayOfWeek: undefined,
    });

    expect(generateOccurrencesForMonth(rule, "2026-08", [])).toEqual([]);
    expect(generateOccurrencesForMonth(rule, "2026-09", [])).toEqual([
      {
        recurringRuleId: "rule-1",
        kind: "standard",
        date: "2026-09-12",
        amountCents: -5000,
        accountId: "acct-1",
        toAccountId: undefined,
        categoryId: "cat-1",
        merchant: undefined,
        note: undefined,
      },
    ]);
    expect(generateOccurrencesForMonth(rule, "2028-09", [])).toEqual([]);
  });

  it("supports yearly february 29 rules only in leap years", () => {
    const rule = createRule({
      frequency: "yearly",
      startDate: "2024-02-29",
      dayOfMonth: undefined,
      dayOfWeek: undefined,
    });

    expect(generateOccurrencesForMonth(rule, "2025-02", [])).toEqual([]);
    expect(generateOccurrencesForMonth(rule, "2028-02", [])).toEqual([
      {
        recurringRuleId: "rule-1",
        kind: "standard",
        date: "2028-02-29",
        amountCents: -5000,
        accountId: "acct-1",
        toAccountId: undefined,
        categoryId: "cat-1",
        merchant: undefined,
        note: undefined,
      },
    ]);
  });

  it("preserves duplicate prevention for yearly transfer occurrences", () => {
    const rule = createRule({
      kind: "transfer",
      amountCents: 2500,
      toAccountId: "acct-2",
      categoryId: undefined,
      frequency: "yearly",
      startDate: "2024-04-21",
      dayOfMonth: undefined,
      dayOfWeek: undefined,
    });
    const existingTransactions: Transaction[] = [
      {
        id: "txn-transfer-out",
        kind: "transfer",
        date: "2026-04-21",
        amountCents: -2500,
        accountId: "acct-1",
        source: "recurring",
        recurringRuleId: "rule-1",
        transferGroupId: "transfer-1",
        createdAt: "2026-04-21T00:00:00.000Z",
        updatedAt: "2026-04-21T00:00:00.000Z",
      },
    ];

    expect(generateOccurrencesForMonth(rule, "2026-04", existingTransactions)).toEqual([]);
    expect(generateOccurrencesForMonth(rule, "2027-04", [])).toEqual([
      {
        recurringRuleId: "rule-1",
        kind: "transfer",
        date: "2027-04-21",
        amountCents: 2500,
        accountId: "acct-1",
        toAccountId: "acct-2",
        categoryId: undefined,
        merchant: undefined,
        note: undefined,
      },
    ]);
  });

  it("generates transfer occurrences with absolute amounts and duplicate prevention", () => {
    const rule = createRule({
      kind: "transfer",
      amountCents: 2500,
      toAccountId: "acct-2",
      categoryId: undefined,
      merchant: undefined,
      frequency: "monthly",
      startDate: "2026-01-01",
      dayOfMonth: 10,
    });
    const existingTransactions: Transaction[] = [
      {
        id: "txn-transfer-out",
        kind: "transfer",
        date: "2026-02-10",
        amountCents: -2500,
        accountId: "acct-1",
        source: "recurring",
        recurringRuleId: "rule-1",
        transferGroupId: "transfer-1",
        createdAt: "2026-02-10T00:00:00.000Z",
        updatedAt: "2026-02-10T00:00:00.000Z",
      },
    ];

    expect(generateOccurrencesForMonth(rule, "2026-02", existingTransactions)).toEqual([]);
    expect(generateOccurrencesForMonth(rule, "2026-03", [])).toEqual([
      {
        recurringRuleId: "rule-1",
        kind: "transfer",
        date: "2026-03-10",
        amountCents: 2500,
        accountId: "acct-1",
        toAccountId: "acct-2",
        categoryId: undefined,
        merchant: undefined,
        note: undefined,
      },
    ]);
  });
});
