import { addMonths, format, parseISO } from "date-fns";

import { getAllAccountBalances } from "./account-balances";
import { generateOccurrencesForMonth, getMonthKey } from "./dates";
import type { Account, RecurringRule, Transaction, TransactionKind } from "../types";

export type ForecastHorizon = "3" | "6" | "12";

export type ForecastTransaction = {
  kind: TransactionKind;
  date: string;
  amountCents: number;
  accountId: string;
  categoryId?: string;
  merchant?: string;
  note?: string;
  source: "recurring";
  recurringRuleId: string;
  transferGroupId?: string;
};

export type ForecastMonthlySummaryRow = {
  month: string;
  projectedIncomeCents: number;
  projectedExpenseCents: number;
  projectedNetCents: number;
};

export type ForecastAccountBalancePoint = {
  month: string;
  endingBalanceCents: number;
};

export type ForecastAccountBalanceRow = {
  accountId: string;
  accountName: string;
  accountType: Account["type"];
  creditLimitCents?: number;
  projectedBalances: ForecastAccountBalancePoint[];
};

export type ForecastResult = {
  months: string[];
  monthlySummaryRows: ForecastMonthlySummaryRow[];
  accountBalanceRows: ForecastAccountBalanceRow[];
};

export function getForecastMonths(
  startMonth: string,
  horizon: ForecastHorizon
): string[] {
  const monthCount = Number(horizon);
  const start = parseISO(`${startMonth}-01`);

  return Array.from({ length: monthCount }, (_, index) =>
    format(addMonths(start, index), "yyyy-MM")
  );
}

export function getProjectedRecurringTransactionsForMonth(
  recurringRules: RecurringRule[],
  month: string,
  existingTransactions: Transaction[],
  today = new Date().toISOString().slice(0, 10)
): ForecastTransaction[] {
  const currentMonth = getMonthKey(today);

  return recurringRules
    .filter((rule) => rule.active)
    .flatMap((rule) => generateOccurrencesForMonth(rule, month, existingTransactions))
    .filter((occurrence) => {
      if (month !== currentMonth) {
        return true;
      }

      return occurrence.date >= today;
    })
    .flatMap<ForecastTransaction>((occurrence) => {
      if (occurrence.kind === "transfer" && occurrence.toAccountId) {
        const transferGroupId = `forecast-${occurrence.recurringRuleId}-${occurrence.date}`;

        return [
          {
            kind: "transfer",
            date: occurrence.date,
            amountCents: -Math.abs(occurrence.amountCents),
            accountId: occurrence.accountId,
            note: occurrence.note,
            source: "recurring",
            recurringRuleId: occurrence.recurringRuleId,
            transferGroupId,
          },
          {
            kind: "transfer",
            date: occurrence.date,
            amountCents: Math.abs(occurrence.amountCents),
            accountId: occurrence.toAccountId,
            note: occurrence.note,
            source: "recurring",
            recurringRuleId: occurrence.recurringRuleId,
            transferGroupId,
          },
        ];
      }

      return [
        {
          kind: "standard",
          date: occurrence.date,
          amountCents: occurrence.amountCents,
          accountId: occurrence.accountId,
          categoryId: occurrence.categoryId,
          merchant: occurrence.merchant,
          note: occurrence.note,
          source: "recurring",
          recurringRuleId: occurrence.recurringRuleId,
        },
      ];
    });
}

export function buildForecast(
  accounts: Account[],
  transactions: Transaction[],
  recurringRules: RecurringRule[],
  startMonth: string,
  horizon: ForecastHorizon,
  today = new Date().toISOString().slice(0, 10)
): ForecastResult {
  const months = getForecastMonths(startMonth, horizon);
  const balanceMap = new Map(
    getAllAccountBalances(accounts, transactions).map((row) => [row.accountId, row.balanceCents])
  );
  const accountBalanceRows = accounts.map<ForecastAccountBalanceRow>((account) => ({
    accountId: account.id,
    accountName: account.name,
    accountType: account.type,
    creditLimitCents: account.creditLimitCents,
    projectedBalances: [],
  }));

  const monthlySummaryRows = months.map<ForecastMonthlySummaryRow>((month) => {
    const projectedTransactions = getProjectedRecurringTransactionsForMonth(
      recurringRules,
      month,
      transactions,
      today
    );
    const projectedStandardTransactions = projectedTransactions.filter(
      (transaction) => transaction.kind === "standard"
    );

    for (const transaction of projectedTransactions) {
      balanceMap.set(
        transaction.accountId,
        (balanceMap.get(transaction.accountId) ?? 0) + transaction.amountCents
      );
    }

    for (const row of accountBalanceRows) {
      row.projectedBalances.push({
        month,
        endingBalanceCents: balanceMap.get(row.accountId) ?? 0,
      });
    }

    const projectedIncomeCents = projectedStandardTransactions
      .filter((transaction) => transaction.amountCents > 0)
      .reduce((sum, transaction) => sum + transaction.amountCents, 0);
    const projectedExpenseCents = projectedStandardTransactions
      .filter((transaction) => transaction.amountCents < 0)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amountCents), 0);

    return {
      month,
      projectedIncomeCents,
      projectedExpenseCents,
      projectedNetCents: projectedIncomeCents - projectedExpenseCents,
    };
  });

  return {
    months,
    monthlySummaryRows,
    accountBalanceRows,
  };
}