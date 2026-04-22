import { format, parseISO, subMonths } from "date-fns";

import { getCurrentMonth, getMonthKey } from "./dates";
import type { Account, Transaction } from "../types";

export type AccountHistoryRange = "6" | "12" | "all";

export type AccountBalanceRow = {
  accountId: string;
  accountName: string;
  accountType: Account["type"];
  balanceCents: number;
  displayLabel: "balance" | "owed";
  displayValueCents: number;
  creditLimitCents?: number;
  availableCreditCents?: number;
};

export type AccountMonthlyHistoryRow = {
  month: string;
  inflowsCents: number;
  outflowsCents: number;
  netChangeCents: number;
  closingBalanceCents: number;
};

export function getAccountLedgerBalanceCents(
  transactions: Transaction[],
  accountId: string
): number {
  return transactions
    .filter((transaction) => transaction.accountId === accountId)
    .reduce((sum, transaction) => sum + transaction.amountCents, 0);
}

export function getAccountBalanceCents(
  transactions: Transaction[],
  accountId: string
): number {
  return getAccountLedgerBalanceCents(transactions, accountId);
}

export function getDisplayedAccountBalanceLabel(
  account: Pick<Account, "type">
): "balance" | "owed" {
  return account.type === "credit" ? "owed" : "balance";
}

export function getDisplayedAccountBalanceCents(
  account: Pick<Account, "type">,
  ledgerBalanceCents: number
): number {
  if (account.type !== "credit") {
    return ledgerBalanceCents;
  }

  return Math.max(0, -ledgerBalanceCents);
}

export function getAvailableCreditCents(
  account: Pick<Account, "type" | "creditLimitCents">,
  ledgerBalanceCents: number
): number | undefined {
  if (account.type !== "credit" || account.creditLimitCents == null) {
    return undefined;
  }

  return account.creditLimitCents - getDisplayedAccountBalanceCents(account, ledgerBalanceCents);
}

export function getAllAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): AccountBalanceRow[] {
  return accounts.map((account) => {
    const balanceCents = getAccountBalanceCents(transactions, account.id);

    return {
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      balanceCents,
      displayLabel: getDisplayedAccountBalanceLabel(account),
      displayValueCents: getDisplayedAccountBalanceCents(account, balanceCents),
      creditLimitCents: account.creditLimitCents,
      availableCreditCents: getAvailableCreditCents(account, balanceCents),
    };
  });
}

function getRangeStartMonth(
  range: Exclude<AccountHistoryRange, "all">,
  referenceMonth: string
): string {
  const monthsToSubtract = range === "6" ? 5 : 11;
  return format(
    subMonths(parseISO(`${referenceMonth}-01`), monthsToSubtract),
    "yyyy-MM"
  );
}

export function getAccountMonthlyHistoryRows(
  transactions: Transaction[],
  accountId: string,
  range: AccountHistoryRange,
  referenceMonth = getCurrentMonth()
): AccountMonthlyHistoryRow[] {
  const accountTransactions = transactions.filter(
    (transaction) => transaction.accountId === accountId
  );

  if (accountTransactions.length === 0) {
    return [];
  }

  const monthTotals = accountTransactions.reduce<
    Record<
      string,
      {
        inflowsCents: number;
        outflowsCents: number;
        netChangeCents: number;
      }
    >
  >((acc, transaction) => {
    const month = getMonthKey(transaction.date);
    const existing = acc[month] ?? {
      inflowsCents: 0,
      outflowsCents: 0,
      netChangeCents: 0,
    };

    if (transaction.amountCents > 0) {
      existing.inflowsCents += transaction.amountCents;
    }

    if (transaction.amountCents < 0) {
      existing.outflowsCents += Math.abs(transaction.amountCents);
    }

    existing.netChangeCents += transaction.amountCents;
    acc[month] = existing;
    return acc;
  }, {});

  let closingBalanceCents = 0;
  const allRowsAscending = Object.keys(monthTotals)
    .sort((left, right) => left.localeCompare(right))
    .map((month) => {
      const totals = monthTotals[month]!;

      closingBalanceCents += totals.netChangeCents;

      return {
        month,
        inflowsCents: totals.inflowsCents,
        outflowsCents: totals.outflowsCents,
        netChangeCents: totals.netChangeCents,
        closingBalanceCents,
      };
    });

  const filteredRows =
    range === "all"
      ? allRowsAscending.filter((row) => row.month <= referenceMonth)
      : allRowsAscending.filter((row) => {
          const startMonth = getRangeStartMonth(range, referenceMonth);

          return row.month >= startMonth && row.month <= referenceMonth;
        });

  return [...filteredRows].sort((left, right) => right.month.localeCompare(left.month));
}