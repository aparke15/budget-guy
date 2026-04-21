import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  getDaysInMonth,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
} from "date-fns";

import type {
  GeneratedRecurringOccurrence,
  RecurringRule,
  Transaction,
} from "../types";

export function getMonthKey(date: string): string {
  return date.slice(0, 7);
}

export function getCurrentMonth(): string {
  return format(new Date(), "yyyy-MM");
}

export function getNowIso(): string {
  return new Date().toISOString();
}

export function getMonthlyOccurrenceDate(
  month: string,
  dayOfMonth: number
): string {
  const monthStart = parseISO(`${month}-01`);
  const maxDay = getDaysInMonth(monthStart);
  const safeDay = Math.min(dayOfMonth, maxDay);
  const candidate = new Date(monthStart);

  candidate.setDate(safeDay);

  return format(candidate, "yyyy-MM-dd");
}

export function isDateWithinBounds(
  date: string,
  startDate: string,
  endDate?: string
): boolean {
  const candidate = parseISO(date);
  const start = parseISO(startDate);

  if (isBefore(candidate, start)) {
    return false;
  }

  if (endDate) {
    const end = parseISO(endDate);

    if (isAfter(candidate, end)) {
      return false;
    }
  }

  return true;
}

export function getFirstWeekdayOnOrAfter(
  startDate: string,
  dayOfWeek: number
): string {
  let candidate = parseISO(startDate);

  while (getDay(candidate) !== dayOfWeek) {
    candidate = addDays(candidate, 1);
  }

  return format(candidate, "yyyy-MM-dd");
}

export function generateOccurrencesForMonth(
  rule: RecurringRule,
  month: string,
  transactions: Transaction[]
): GeneratedRecurringOccurrence[] {
  if (!rule.active) {
    return [];
  }

  const existingDates = new Set(
    transactions
      .filter((transaction) => transaction.recurringRuleId === rule.id)
      .map((transaction) => transaction.date)
  );

  const occurrences: GeneratedRecurringOccurrence[] = [];

  if (rule.frequency === "monthly") {
    const date = getMonthlyOccurrenceDate(month, rule.dayOfMonth!);

    if (
      isDateWithinBounds(date, rule.startDate, rule.endDate) &&
      !existingDates.has(date)
    ) {
      occurrences.push({
        recurringRuleId: rule.id,
        date,
        amountCents: rule.amountCents,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        merchant: rule.merchant,
        note: rule.note,
      });
    }

    return occurrences;
  }

  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const monthEnd = endOfMonth(monthStart);
  const anchorDate = parseISO(
    getFirstWeekdayOnOrAfter(rule.startDate, rule.dayOfWeek!)
  );
  const intervalDays = rule.frequency === "weekly" ? 7 : 14;

  for (const day of eachDayOfInterval({ start: monthStart, end: monthEnd })) {
    if (getDay(day) !== rule.dayOfWeek) {
      continue;
    }

    if (isBefore(day, anchorDate)) {
      continue;
    }

    const diffDays = differenceInCalendarDays(day, anchorDate);

    if (diffDays % intervalDays !== 0) {
      continue;
    }

    const date = format(day, "yyyy-MM-dd");

    if (!isDateWithinBounds(date, rule.startDate, rule.endDate)) {
      continue;
    }

    if (existingDates.has(date)) {
      continue;
    }

    occurrences.push({
      recurringRuleId: rule.id,
      date,
      amountCents: rule.amountCents,
      accountId: rule.accountId,
      categoryId: rule.categoryId,
      merchant: rule.merchant,
      note: rule.note,
    });
  }

  return occurrences;
}