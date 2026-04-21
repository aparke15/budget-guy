import { describe, expect, it } from "vitest";

import {
  generateOccurrencesForMonth,
  getFirstWeekdayOnOrAfter,
  getMonthKey,
  getMonthlyOccurrenceDate,
  isDateWithinBounds,
} from "./dates";
import type { RecurringRule, Transaction } from "../types";

function createRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: "rule-1",
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
  it("gets a month key from an iso date", () => {
    expect(getMonthKey("2026-04-21")).toBe("2026-04");
  });

  it("clamps monthly occurrence dates to the last day of the month", () => {
    expect(getMonthlyOccurrenceDate("2026-02", 31)).toBe("2026-02-28");
    expect(getMonthlyOccurrenceDate("2024-02", 31)).toBe("2024-02-29");
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
        date: "2026-02-02",
        amountCents: -5000,
        accountId: "acct-1",
        categoryId: "cat-1",
        merchant: undefined,
        note: undefined,
      },
      {
        recurringRuleId: "rule-1",
        date: "2026-02-09",
        amountCents: -5000,
        accountId: "acct-1",
        categoryId: "cat-1",
        merchant: undefined,
        note: undefined,
      },
      {
        recurringRuleId: "rule-1",
        date: "2026-02-16",
        amountCents: -5000,
        accountId: "acct-1",
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
        date: "2026-02-03",
        amountCents: -5000,
        accountId: "acct-1",
        categoryId: "cat-1",
        merchant: undefined,
        note: undefined,
      },
      {
        recurringRuleId: "rule-1",
        date: "2026-02-17",
        amountCents: -5000,
        accountId: "acct-1",
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
});
