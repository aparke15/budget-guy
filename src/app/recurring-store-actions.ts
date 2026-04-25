import {
  createEmptyRecurringGenerationSummary,
  generateRecurringTransactionsForMonth,
  generateRecurringTransactionsForRange,
} from "../lib/recurring-generation";
import type { RecurringGenerationSummary } from "../types";
import { useAppStore } from "./store";

function sortTransactionsByDateDesc<T extends { date: string }>(transactions: T[]): T[] {
  return [...transactions].sort((left, right) => right.date.localeCompare(left.date));
}

export function generateRecurringForRange(
  startMonth: string,
  monthCount: number
): RecurringGenerationSummary {
  let summary = createEmptyRecurringGenerationSummary(startMonth, monthCount);

  useAppStore.setState((state) => {
    const safeMonthCount = Number.isInteger(monthCount) && monthCount > 0 ? monthCount : 1;
    const generation = generateRecurringTransactionsForRange(
      state.recurringRules,
      state.transactions,
      startMonth,
      safeMonthCount
    );

    summary = generation.summary;

    if (generation.transactions.length === 0) {
      return {
        lastRecurringGenerationSummary: generation.summary,
      };
    }

    return {
      transactions: sortTransactionsByDateDesc([
        ...state.transactions,
        ...generation.transactions,
      ]),
      lastRecurringGenerationSummary: generation.summary,
    };
  });

  return summary;
}

export function generateRecurringForMonth(month: string): RecurringGenerationSummary {
  let summary = createEmptyRecurringGenerationSummary(month, 1);

  useAppStore.setState((state) => {
    const generation = generateRecurringTransactionsForMonth(
      state.recurringRules,
      state.transactions,
      month
    );

    summary = generation.summary;

    if (generation.transactions.length === 0) {
      return {
        lastRecurringGenerationSummary: generation.summary,
      };
    }

    return {
      transactions: sortTransactionsByDateDesc([
        ...state.transactions,
        ...generation.transactions,
      ]),
      lastRecurringGenerationSummary: generation.summary,
    };
  });

  return summary;
}