import {
  getMonthRange,
  getNowIso,
  getRecurringOccurrenceDatesForMonth,
} from "./dates";
import { createTransferTransactions } from "./factories";
import type {
  RecurringGenerationRuleSummary,
  RecurringGenerationSummary,
  RecurringRule,
  Transaction,
} from "../types";

export type RecurringGenerationResult = {
  transactions: Transaction[];
  summary: RecurringGenerationSummary;
};

export function createEmptyRecurringGenerationSummary(
  startMonth: string,
  monthCount: number
): RecurringGenerationSummary {
  const months = getMonthRange(startMonth, monthCount);
  const endMonth = months[months.length - 1] ?? startMonth;

  return {
    startMonth,
    endMonth,
    monthCount,
    createdOccurrences: 0,
    createdTransactions: 0,
    createdTransfers: 0,
    duplicateOccurrences: 0,
    ruleResults: [],
  };
}

export function generateRecurringTransactionsForRange(
  recurringRules: RecurringRule[],
  existingTransactions: Transaction[],
  startMonth: string,
  monthCount: number
): RecurringGenerationResult {
  const months = getMonthRange(startMonth, monthCount);
  const summary = createEmptyRecurringGenerationSummary(startMonth, months.length);
  const generatedTransactions: Transaction[] = [];
  const existingRecurringKeys = new Set(
    existingTransactions
      .filter((transaction) => transaction.recurringRuleId)
      .map((transaction) => `${transaction.recurringRuleId}:${transaction.date}`)
  );

  if (months.length === 0) {
    return {
      transactions: generatedTransactions,
      summary,
    };
  }

  for (const rule of recurringRules.filter((item) => item.active)) {
    const ruleSummary: RecurringGenerationRuleSummary = {
      recurringRuleId: rule.id,
      ruleName: rule.name,
      kind: rule.kind,
      createdOccurrences: 0,
      createdTransactions: 0,
      createdTransfers: 0,
      duplicateOccurrences: 0,
    };

    for (const month of months) {
      const scheduledDates = getRecurringOccurrenceDatesForMonth(rule, month);

      for (const date of scheduledDates) {
        const duplicateKey = `${rule.id}:${date}`;

        if (existingRecurringKeys.has(duplicateKey)) {
          ruleSummary.duplicateOccurrences += 1;
          continue;
        }

        if (rule.kind === "transfer" && rule.toAccountId) {
          const transferTransactions = createTransferTransactions({
            input: {
              date,
              fromAccountId: rule.accountId,
              toAccountId: rule.toAccountId,
              amountCents: Math.abs(rule.amountCents),
              note: rule.note,
            },
            metadata: {
              source: "recurring",
              recurringRuleId: rule.id,
            },
          });

          generatedTransactions.push(...transferTransactions);
          ruleSummary.createdOccurrences += 1;
          ruleSummary.createdTransactions += transferTransactions.length;
          ruleSummary.createdTransfers += 1;
        } else {
          const now = getNowIso();

          generatedTransactions.push({
            id: crypto.randomUUID(),
            kind: "standard",
            date,
            amountCents: rule.amountCents,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            merchant: rule.merchant,
            note: rule.note,
            source: "recurring",
            recurringRuleId: rule.id,
            createdAt: now,
            updatedAt: now,
          });
          ruleSummary.createdOccurrences += 1;
          ruleSummary.createdTransactions += 1;
        }

        existingRecurringKeys.add(duplicateKey);
      }
    }

    summary.createdOccurrences += ruleSummary.createdOccurrences;
    summary.createdTransactions += ruleSummary.createdTransactions;
    summary.createdTransfers += ruleSummary.createdTransfers;
    summary.duplicateOccurrences += ruleSummary.duplicateOccurrences;

    if (
      ruleSummary.createdOccurrences > 0 ||
      ruleSummary.duplicateOccurrences > 0
    ) {
      summary.ruleResults.push(ruleSummary);
    }
  }

  return {
    transactions: generatedTransactions,
    summary,
  };
}

export function generateRecurringTransactionsForMonth(
  recurringRules: RecurringRule[],
  existingTransactions: Transaction[],
  month: string
): RecurringGenerationResult {
  return generateRecurringTransactionsForRange(
    recurringRules,
    existingTransactions,
    month,
    1
  );
}