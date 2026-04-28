import { addDays, addMonths, format, parseISO, startOfMonth, subDays } from "date-fns";

import { getRecurringOccurrenceDatesForMonth, getTodayDateKey } from "./dates";
import type { RecurringRule, RecurringRuleKind, Transaction } from "../types";

export type ExpectedOccurrenceStatus = "upcoming" | "due" | "overdue" | "matched";

export type ExpectedOccurrence = {
  id: string;
  recurringRuleId: string;
  recurringRuleName: string;
  kind: RecurringRuleKind;
  status: ExpectedOccurrenceStatus;
  date: string;
  amountCents: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  merchant?: string;
  note?: string;
};

export type ExpectedOccurrenceDashboardSummary = {
  dueCount: number;
  overdueCount: number;
  nextSevenDaysCount: number;
};

export type ExpectedOccurrenceAccountEffect = {
  accountId: string;
  deltaCents: number;
};

export type ExpectedOccurrenceInterval = {
  startDate: string;
  endDate: string;
};

export type ExpectedOccurrenceOperationalWindow = {
  lookbackDays: number;
  lookaheadDays: number;
};

export const DASHBOARD_EXPECTED_WINDOW: ExpectedOccurrenceOperationalWindow = {
  lookbackDays: 14,
  lookaheadDays: 7,
};

export const ACCOUNTS_EXPECTED_WINDOW: ExpectedOccurrenceOperationalWindow = {
  lookbackDays: 14,
  lookaheadDays: 30,
};

function getOccurrenceKey(recurringRuleId: string, date: string): string {
  return `${recurringRuleId}:${date}`;
}

function getMonthsInInterval(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) {
    return [];
  }

  const startMonth = startOfMonth(parseISO(startDate));
  const endMonth = startOfMonth(parseISO(endDate));
  const months: string[] = [];

  for (
    let currentMonth = startMonth;
    currentMonth <= endMonth;
    currentMonth = addMonths(currentMonth, 1)
  ) {
    months.push(format(currentMonth, "yyyy-MM"));
  }

  return months;
}

function getExpectedOccurrenceStatus(
  date: string,
  matchedKeys: Set<string>,
  recurringRuleId: string,
  referenceDate: string
): ExpectedOccurrenceStatus {
  if (matchedKeys.has(getOccurrenceKey(recurringRuleId, date))) {
    return "matched";
  }

  if (date < referenceDate) {
    return "overdue";
  }

  if (date === referenceDate) {
    return "due";
  }

  return "upcoming";
}

function isPendingOccurrence(status: ExpectedOccurrenceStatus): boolean {
  return status !== "matched";
}

function compareOccurrences(left: ExpectedOccurrence, right: ExpectedOccurrence): number {
  const dateComparison = left.date.localeCompare(right.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return left.recurringRuleName.localeCompare(right.recurringRuleName);
}

function getOperationalStatusRank(status: ExpectedOccurrenceStatus): number {
  switch (status) {
    case "overdue":
      return 0;
    case "due":
      return 1;
    case "upcoming":
      return 2;
    case "matched":
      return 3;
  }
}

function compareByOperationalRelevance(
  left: ExpectedOccurrence,
  right: ExpectedOccurrence
): number {
  const statusRankComparison =
    getOperationalStatusRank(left.status) - getOperationalStatusRank(right.status);

  if (statusRankComparison !== 0) {
    return statusRankComparison;
  }

  if (left.status === "overdue" && right.status === "overdue") {
    const dateComparison = right.date.localeCompare(left.date);

    if (dateComparison !== 0) {
      return dateComparison;
    }
  }

  if (left.status === "upcoming" && right.status === "upcoming") {
    const dateComparison = left.date.localeCompare(right.date);

    if (dateComparison !== 0) {
      return dateComparison;
    }
  }

  if (left.status === "due" && right.status === "due") {
    const dateComparison = left.date.localeCompare(right.date);

    if (dateComparison !== 0) {
      return dateComparison;
    }
  }

  return left.recurringRuleName.localeCompare(right.recurringRuleName);
}

export function getExpectedOccurrenceIntervalForWindow(
  referenceDate: string,
  window: ExpectedOccurrenceOperationalWindow
): ExpectedOccurrenceInterval {
  return {
    startDate: format(subDays(parseISO(referenceDate), window.lookbackDays), "yyyy-MM-dd"),
    endDate: format(addDays(parseISO(referenceDate), window.lookaheadDays), "yyyy-MM-dd"),
  };
}

export function getOperationalExpectedOccurrences(
  occurrences: ExpectedOccurrence[],
  referenceDate: string,
  window: ExpectedOccurrenceOperationalWindow
): ExpectedOccurrence[] {
  const interval = getExpectedOccurrenceIntervalForWindow(referenceDate, window);

  return occurrences
    .filter(
      (occurrence) =>
        isPendingOccurrence(occurrence.status) &&
        occurrence.date >= interval.startDate &&
        occurrence.date <= interval.endDate
    )
    .sort(compareByOperationalRelevance);
}

export function deriveExpectedOccurrences(
  recurringRules: RecurringRule[],
  transactions: Transaction[],
  interval: ExpectedOccurrenceInterval,
  referenceDate = getTodayDateKey()
): ExpectedOccurrence[] {
  const months = getMonthsInInterval(interval.startDate, interval.endDate);

  if (months.length === 0) {
    return [];
  }

  const matchedKeys = new Set(
    transactions
      .filter(
        (transaction) =>
          transaction.kind !== "opening-balance" && transaction.recurringRuleId
      )
      .map((transaction) => getOccurrenceKey(transaction.recurringRuleId!, transaction.date))
  );

  return recurringRules
    .filter((rule) => rule.active)
    .flatMap((rule) =>
      months.flatMap((month) =>
        getRecurringOccurrenceDatesForMonth(rule, month)
          .filter(
            (date) => date >= interval.startDate && date <= interval.endDate
          )
          .map<ExpectedOccurrence>((date) => ({
            id: getOccurrenceKey(rule.id, date),
            recurringRuleId: rule.id,
            recurringRuleName: rule.name,
            kind: rule.kind,
            status: getExpectedOccurrenceStatus(
              date,
              matchedKeys,
              rule.id,
              referenceDate
            ),
            date,
            amountCents:
              rule.kind === "transfer" ? Math.abs(rule.amountCents) : rule.amountCents,
            accountId: rule.accountId,
            toAccountId: rule.toAccountId,
            categoryId: rule.categoryId,
            merchant: rule.kind === "standard" ? rule.merchant : undefined,
            note: rule.note,
          }))
      )
    )
    .sort(compareOccurrences);
}

export function getExpectedOccurrenceDashboardSummary(
  occurrences: ExpectedOccurrence[],
  referenceDate: string,
  window: ExpectedOccurrenceOperationalWindow = DASHBOARD_EXPECTED_WINDOW
): ExpectedOccurrenceDashboardSummary {
  const operationalOccurrences = getOperationalExpectedOccurrences(
    occurrences,
    referenceDate,
    window
  );

  return operationalOccurrences.reduce<ExpectedOccurrenceDashboardSummary>(
    (summary, occurrence) => {
      if (occurrence.status === "due") {
        summary.dueCount += 1;
      }

      if (occurrence.status === "overdue") {
        summary.overdueCount += 1;
      }

      if (
        occurrence.status === "upcoming" &&
        occurrence.date > referenceDate
      ) {
        summary.nextSevenDaysCount += 1;
      }

      return summary;
    },
    {
      dueCount: 0,
      overdueCount: 0,
      nextSevenDaysCount: 0,
    }
  );
}

export function getDueSoonExpectedOccurrences(
  occurrences: ExpectedOccurrence[],
  referenceDate: string,
  window: ExpectedOccurrenceOperationalWindow = DASHBOARD_EXPECTED_WINDOW
): ExpectedOccurrence[] {
  return getOperationalExpectedOccurrences(occurrences, referenceDate, window);
}

export function getExpectedOccurrenceAccountEffects(
  occurrences: ExpectedOccurrence[]
): ExpectedOccurrenceAccountEffect[] {
  const totals = new Map<string, number>();

  for (const occurrence of occurrences) {
    if (!isPendingOccurrence(occurrence.status)) {
      continue;
    }

    if (occurrence.kind === "transfer" && occurrence.toAccountId) {
      totals.set(
        occurrence.accountId,
        (totals.get(occurrence.accountId) ?? 0) - Math.abs(occurrence.amountCents)
      );
      totals.set(
        occurrence.toAccountId,
        (totals.get(occurrence.toAccountId) ?? 0) + Math.abs(occurrence.amountCents)
      );
      continue;
    }

    totals.set(
      occurrence.accountId,
      (totals.get(occurrence.accountId) ?? 0) + occurrence.amountCents
    );
  }

  return Array.from(totals.entries())
    .map(([accountId, deltaCents]) => ({ accountId, deltaCents }))
    .sort((left, right) => left.accountId.localeCompare(right.accountId));
}

export function getExpectedOccurrenceDeltaForAccount(
  occurrences: ExpectedOccurrence[],
  accountId: string
): number {
  return getExpectedOccurrenceAccountEffects(occurrences).find(
    (effect) => effect.accountId === accountId
  )?.deltaCents ?? 0;
}