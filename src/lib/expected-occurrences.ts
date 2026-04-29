import { addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";

import { getCategoryDisplayName } from "./categories";
import { getCurrentDate, getRecurringOccurrenceDatesForMonth } from "./dates";
import type { Account, Category, RecurringRule, Transaction } from "../types";

export type ExpectedOccurrenceStatus = "upcoming" | "due" | "overdue" | "matched";

export type ExpectedOccurrence = {
  id: string;
  recurringRuleId: string;
  ruleName: string;
  kind: RecurringRule["kind"];
  date: string;
  amountCents: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  categoryName?: string;
  categoryArchived: boolean;
  merchant?: string;
  note?: string;
  status: ExpectedOccurrenceStatus;
  matchedTransactionCount: number;
  daysFromToday: number;
};

export type ExpectedOccurrenceSummary = {
  dueTodayCount: number;
  overdueCount: number;
  next7DaysCount: number;
  pendingCount: number;
};

export type AccountExpectedBalanceEffect = {
  accountId: string;
  pendingCount: number;
  netExpectedChangeCents: number;
};

export type DueSoonListOptions = {
  limit?: number;
  accountId?: string;
};

type DateInterval = {
  startDate: string;
  endDate: string;
};

function buildExpectedOccurrenceId(recurringRuleId: string, date: string): string {
  return `${recurringRuleId}:${date}`;
}

function getStatus(date: string, matchedTransactionCount: number, today: string) {
  if (matchedTransactionCount > 0) {
    return "matched" satisfies ExpectedOccurrenceStatus;
  }

  if (date < today) {
    return "overdue" satisfies ExpectedOccurrenceStatus;
  }

  if (date === today) {
    return "due" satisfies ExpectedOccurrenceStatus;
  }

  return "upcoming" satisfies ExpectedOccurrenceStatus;
}

function getIntervalMonths(startDate: string, endDate: string): string[] {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const months: string[] = [];
  let cursor = parseISO(`${startDate.slice(0, 7)}-01`);
  const endMonth = endDate.slice(0, 7);

  while (format(cursor, "yyyy-MM") <= endMonth) {
    months.push(format(cursor, "yyyy-MM"));
    cursor = addMonths(cursor, 1);
  }

  return months;
}

function buildMatchedTransactionCountMap(transactions: Transaction[]): Map<string, number> {
  return transactions.reduce<Map<string, number>>((acc, transaction) => {
    if (!transaction.recurringRuleId) {
      return acc;
    }

    const key = buildExpectedOccurrenceId(transaction.recurringRuleId, transaction.date);
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map());
}

function buildCategoryMetadataMap(categories: Category[]): Map<
  string,
  { name: string; archived: boolean }
> {
  return new Map(
    categories.map((category) => [
      category.id,
      {
        name: getCategoryDisplayName(category),
        archived: Boolean(category.archivedAt),
      },
    ])
  );
}

function isPendingStatus(status: ExpectedOccurrenceStatus) {
  return status === "upcoming" || status === "due" || status === "overdue";
}

function comparePendingExpectedOccurrences(
  left: ExpectedOccurrence,
  right: ExpectedOccurrence
) {
  if (left.status !== right.status) {
    const order: Record<ExpectedOccurrenceStatus, number> = {
      overdue: 0,
      due: 1,
      upcoming: 2,
      matched: 3,
    };

    return order[left.status] - order[right.status];
  }

  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  return left.ruleName.localeCompare(right.ruleName);
}

export function deriveExpectedOccurrences(
  recurringRules: RecurringRule[],
  transactions: Transaction[],
  interval: DateInterval,
  options?: {
    today?: string;
    categories?: Category[];
  }
): ExpectedOccurrence[] {
  const today = options?.today ?? getCurrentDate();
  const matchedTransactionCountMap = buildMatchedTransactionCountMap(transactions);
  const categoryMetadataMap = buildCategoryMetadataMap(options?.categories ?? []);
  const months = getIntervalMonths(interval.startDate, interval.endDate);

  return recurringRules
    .filter((rule) => rule.active)
    .flatMap<ExpectedOccurrence>((rule) =>
      months.flatMap((month) =>
        getRecurringOccurrenceDatesForMonth(rule, month)
          .filter(
            (date) => date >= interval.startDate && date <= interval.endDate
          )
          .map((date) => {
            const occurrenceId = buildExpectedOccurrenceId(rule.id, date);
            const matchedTransactionCount = matchedTransactionCountMap.get(occurrenceId) ?? 0;
            const categoryMetadata = rule.categoryId
              ? categoryMetadataMap.get(rule.categoryId)
              : undefined;

            return {
              id: occurrenceId,
              recurringRuleId: rule.id,
              ruleName: rule.name,
              kind: rule.kind,
              date,
              amountCents:
                rule.kind === "transfer"
                  ? Math.abs(rule.amountCents)
                  : rule.amountCents,
              accountId: rule.accountId,
              toAccountId: rule.toAccountId,
              categoryId: rule.categoryId,
              categoryName: categoryMetadata?.name,
              categoryArchived: categoryMetadata?.archived ?? false,
              merchant: rule.kind === "standard" ? rule.merchant : undefined,
              note: rule.note,
              status: getStatus(date, matchedTransactionCount, today),
              matchedTransactionCount,
              daysFromToday: differenceInCalendarDays(parseISO(date), parseISO(today)),
            } satisfies ExpectedOccurrence;
          })
      )
    )
    .sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }

      return left.ruleName.localeCompare(right.ruleName);
    });
}

export function buildExpectedOccurrenceSummary(
  occurrences: ExpectedOccurrence[]
): ExpectedOccurrenceSummary {
  return occurrences.reduce<ExpectedOccurrenceSummary>(
    (summary, occurrence) => {
      if (!isPendingStatus(occurrence.status)) {
        return summary;
      }

      summary.pendingCount += 1;

      if (occurrence.status === "due") {
        summary.dueTodayCount += 1;
      }

      if (occurrence.status === "overdue") {
        summary.overdueCount += 1;
      }

      if (occurrence.daysFromToday >= 0 && occurrence.daysFromToday <= 7) {
        summary.next7DaysCount += 1;
      }

      return summary;
    },
    {
      dueTodayCount: 0,
      overdueCount: 0,
      next7DaysCount: 0,
      pendingCount: 0,
    }
  );
}

export function buildAccountExpectedBalanceEffects(
  accounts: Account[],
  occurrences: ExpectedOccurrence[]
): AccountExpectedBalanceEffect[] {
  const totals = occurrences.reduce<Map<string, AccountExpectedBalanceEffect>>((acc, occurrence) => {
    if (!isPendingStatus(occurrence.status)) {
      return acc;
    }

    const fromAccount = acc.get(occurrence.accountId) ?? {
      accountId: occurrence.accountId,
      pendingCount: 0,
      netExpectedChangeCents: 0,
    };

    fromAccount.pendingCount += 1;
    fromAccount.netExpectedChangeCents +=
      occurrence.kind === "transfer"
        ? -Math.abs(occurrence.amountCents)
        : occurrence.amountCents;
    acc.set(occurrence.accountId, fromAccount);

    if (occurrence.kind === "transfer" && occurrence.toAccountId) {
      const toAccount = acc.get(occurrence.toAccountId) ?? {
        accountId: occurrence.toAccountId,
        pendingCount: 0,
        netExpectedChangeCents: 0,
      };

      toAccount.pendingCount += 1;
      toAccount.netExpectedChangeCents += Math.abs(occurrence.amountCents);
      acc.set(occurrence.toAccountId, toAccount);
    }

    return acc;
  }, new Map());

  return accounts.map((account) => totals.get(account.id) ?? {
    accountId: account.id,
    pendingCount: 0,
    netExpectedChangeCents: 0,
  });
}

export function buildDueSoonList(
  occurrences: ExpectedOccurrence[],
  options?: DueSoonListOptions
): ExpectedOccurrence[] {
  const limit = options?.limit ?? 5;

  return buildPendingExpectedOccurrences(occurrences)
    .filter((occurrence) => {
      if (!options?.accountId) {
        return true;
      }

      return (
        occurrence.accountId === options.accountId ||
        occurrence.toAccountId === options.accountId
      );
    })
    .slice(0, limit);
}

export function buildPendingExpectedOccurrences(
  occurrences: ExpectedOccurrence[]
): ExpectedOccurrence[] {
  return occurrences
    .filter((occurrence) => isPendingStatus(occurrence.status))
    .sort(comparePendingExpectedOccurrences);
}