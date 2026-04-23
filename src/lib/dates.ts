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
  isValid,
  parseISO,
  startOfMonth,
} from "date-fns";

import type {
  GeneratedRecurringOccurrence,
  RecurringRule,
  Transaction,
} from "../types";

function buildGeneratedRecurringOccurrence(
  rule: RecurringRule,
  date: string
): GeneratedRecurringOccurrence {
  return {
    recurringRuleId: rule.id,
    kind: rule.kind,
    date,
    amountCents: rule.kind === "transfer" ? Math.abs(rule.amountCents) : rule.amountCents,
    accountId: rule.accountId,
    toAccountId: rule.toAccountId,
    categoryId: rule.categoryId,
    merchant: rule.kind === "standard" ? rule.merchant : undefined,
    note: rule.note,
  };
}

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

export function getYearlyOccurrenceDate(
  month: string,
  startDate: string
): string | null {
  if (month.slice(5, 7) !== startDate.slice(5, 7)) {
    return null;
  }

  const candidateDate = `${month.slice(0, 4)}-${startDate.slice(5, 10)}`;
  const parsed = parseISO(candidateDate);

  if (!isValid(parsed) || format(parsed, "yyyy-MM-dd") !== candidateDate) {
    return null;
  }

  return candidateDate;
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

export function getRecurringOccurrenceDatesForMonth(
  rule: RecurringRule,
  month: string
): string[] {
  if (!rule.active) {
    return [];
  }

  if (rule.frequency === "monthly") {
    const date = getMonthlyOccurrenceDate(month, rule.dayOfMonth!);

    return isDateWithinBounds(date, rule.startDate, rule.endDate) ? [date] : [];
  }

  if (rule.frequency === "yearly") {
    const date = getYearlyOccurrenceDate(month, rule.startDate);

    if (!date) {
      return [];
    }

    return isDateWithinBounds(date, rule.startDate, rule.endDate) ? [date] : [];
  }

  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const monthEnd = endOfMonth(monthStart);
  const anchorDate = parseISO(
    getFirstWeekdayOnOrAfter(rule.startDate, rule.dayOfWeek!)
  );
  const intervalDays = rule.frequency === "weekly" ? 7 : 14;
  const dates: string[] = [];

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

    dates.push(date);
  }

  return dates;
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

  return getRecurringOccurrenceDatesForMonth(rule, month)
    .filter((date) => !existingDates.has(date))
    .map((date) => buildGeneratedRecurringOccurrence(rule, date));
}