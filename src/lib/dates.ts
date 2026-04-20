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
  generatedrecurringoccurrence,
  recurringrule,
  transaction,
} from "../types";

export function getmonthkey(date: string): string {
  return date.slice(0, 7);
}

export function getcurrentmonth(): string {
  return format(new Date(), "yyyy-MM");
}

export function getnowiso(): string {
  return new Date().toISOString();
}

export function getmonthlyoccurrencedate(
  month: string,
  dayofmonth: number
): string {
  const monthstart = parseISO(`${month}-01`);
  const maxday = getDaysInMonth(monthstart);
  const safeday = Math.min(dayofmonth, maxday);
  const candidate = new Date(monthstart);

  candidate.setDate(safeday);

  return format(candidate, "yyyy-MM-dd");
}

export function isdatewithinbounds(
  date: string,
  startdate: string,
  enddate?: string
): boolean {
  const candidate = parseISO(date);
  const start = parseISO(startdate);

  if (isBefore(candidate, start)) {
    return false;
  }

  if (enddate) {
    const end = parseISO(enddate);

    if (isAfter(candidate, end)) {
      return false;
    }
  }

  return true;
}

export function getfirstweekdayonorafter(
  startdate: string,
  dayofweek: number
): string {
  let candidate = parseISO(startdate);

  while (getDay(candidate) !== dayofweek) {
    candidate = addDays(candidate, 1);
  }

  return format(candidate, "yyyy-MM-dd");
}

export function generateoccurrencesformonth(
  rule: recurringrule,
  month: string,
  transactions: transaction[]
): generatedrecurringoccurrence[] {
  if (!rule.active) {
    return [];
  }

  const existingdates = new Set(
    transactions
      .filter((transaction) => transaction.recurringRuleId === rule.id)
      .map((transaction) => transaction.date)
  );

  const occurrences: generatedrecurringoccurrence[] = [];

  if (rule.frequency === "monthly") {
    const date = getmonthlyoccurrencedate(month, rule.dayOfMonth!);

    if (
      isdatewithinbounds(date, rule.startDate, rule.endDate) &&
      !existingdates.has(date)
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

  const monthstart = startOfMonth(parseISO(`${month}-01`));
  const monthend = endOfMonth(monthstart);
  const anchordate = parseISO(
    getfirstweekdayonorafter(rule.startDate, rule.dayOfWeek!)
  );
  const intervaldays = rule.frequency === "weekly" ? 7 : 14;

  for (const day of eachDayOfInterval({ start: monthstart, end: monthend })) {
    if (getDay(day) !== rule.dayOfWeek) {
      continue;
    }

    if (isBefore(day, anchordate)) {
      continue;
    }

    const diffdays = differenceInCalendarDays(day, anchordate);

    if (diffdays % intervaldays !== 0) {
      continue;
    }

    const date = format(day, "yyyy-MM-dd");

    if (!isdatewithinbounds(date, rule.startDate, rule.endDate)) {
      continue;
    }

    if (existingdates.has(date)) {
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