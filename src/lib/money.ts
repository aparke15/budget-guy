import type {
  budget,
  budgetrow,
  category,
  monthlysummary,
  transaction,
} from "../types";
import { getmonthkey } from "./dates";

export function formatcents(
  amountcents: number,
  locale = "en-US",
  currency = "USD"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountcents / 100);
}

export function sumincomecents(
  transactions: transaction[],
  month: string
): number {
  return transactions
    .filter(
      (transaction) =>
        getmonthkey(transaction.date) === month &&
        transaction.amountCents > 0
    )
    .reduce((sum, transaction) => sum + transaction.amountCents, 0);
}

export function sumexpensecents(
  transactions: transaction[],
  month: string
): number {
  return transactions
    .filter(
      (transaction) =>
        getmonthkey(transaction.date) === month &&
        transaction.amountCents < 0
    )
    .reduce((sum, transaction) => sum + Math.abs(transaction.amountCents), 0);
}

export function sumcategoryactualcents(
  transactions: transaction[],
  month: string,
  categoryid: string
): number {
  return transactions
    .filter(
      (transaction) =>
        getmonthkey(transaction.date) === month &&
        transaction.categoryId === categoryid &&
        transaction.amountCents < 0
    )
    .reduce((sum, transaction) => sum + Math.abs(transaction.amountCents), 0);
}

export function getmonthlysummary(
  transactions: transaction[],
  budgets: budget[],
  month: string
): monthlysummary {
  const incomeCents = sumincomecents(transactions, month);
  const expenseCents = sumexpensecents(transactions, month);
  const plannedCents = budgets
    .filter((budget) => budget.month === month)
    .reduce((sum, budget) => sum + budget.plannedCents, 0);

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    plannedCents,
    unassignedCents: incomeCents - plannedCents,
  };
}

export function getbudgetrows(
  categories: category[],
  budgets: budget[],
  transactions: transaction[],
  month: string
): budgetrow[] {
  const budgetmap = budgets
    .filter((budget) => budget.month === month)
    .reduce<Record<string, number>>((acc, budget) => {
      acc[budget.categoryId] = budget.plannedCents;
      return acc;
    }, {});

  return categories
    .filter((category) => category.kind === "expense")
    .map((category) => {
      const plannedCents = budgetmap[category.id] ?? 0;
      const actualCents = sumcategoryactualcents(
        transactions,
        month,
        category.id
      );
      const remainingCents = plannedCents - actualCents;

      return {
        categoryId: category.id,
        categoryName: category.name,
        plannedCents,
        actualCents,
        remainingCents,
        overBudget: remainingCents < 0,
      };
    })
    .sort((a, b) => b.actualCents - a.actualCents);
}