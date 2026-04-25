import type {
  Budget,
  BudgetRow,
  Category,
  MonthlySummary,
  Transaction,
} from "../types";
import { getMonthKey } from "./dates";
import { getTransactionCategoryAllocations } from "./transaction-splits";

export function formatCents(
  amountCents: number,
  locale = "en-US",
  currency = "USD"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export function formatCentsForInput(amountCents: number): string {
  return (Math.abs(amountCents) / 100).toFixed(2);
}

export function formatSignedCentsForInput(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

export function parseAmountInputToCents(input: string): number | null {
  const normalized = input.replace(/[$,\s]/g, "").trim();

  if (!normalized) {
    return null;
  }

  const value = Number(normalized);

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100);
}

export function sumIncomeCents(
  transactions: Transaction[],
  month: string
): number {
  return transactions
    .filter(
      (transaction) =>
        getMonthKey(transaction.date) === month &&
        transaction.kind === "standard" &&
        transaction.amountCents > 0
    )
    .reduce((sum, transaction) => sum + transaction.amountCents, 0);
}

export function sumExpenseCents(
  transactions: Transaction[],
  month: string
): number {
  return transactions
    .filter(
      (transaction) =>
        getMonthKey(transaction.date) === month &&
        transaction.kind === "standard" &&
        transaction.amountCents < 0
    )
    .reduce((sum, transaction) => sum + Math.abs(transaction.amountCents), 0);
}

export function sumCategoryActualCents(
  transactions: Transaction[],
  month: string,
  categoryId: string
): number {
  return transactions
    .filter(
      (transaction) =>
        getMonthKey(transaction.date) === month &&
        transaction.kind === "standard"
    )
    .flatMap((transaction) => getTransactionCategoryAllocations(transaction))
    .filter(
      (allocation) =>
        allocation.categoryId === categoryId && allocation.amountCents < 0
    )
    .reduce((sum, allocation) => sum + Math.abs(allocation.amountCents), 0);
}

export function getMonthlySummary(
  transactions: Transaction[],
  budgets: Budget[],
  month: string
): MonthlySummary {
  const incomeCents = sumIncomeCents(transactions, month);
  const expenseCents = sumExpenseCents(transactions, month);
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

export function getBudgetRows(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
  month: string
): BudgetRow[] {
  const budgetMap = budgets
    .filter((budget) => budget.month === month)
    .reduce<Record<string, number>>((acc, budget) => {
      acc[budget.categoryId] = budget.plannedCents;
      return acc;
    }, {});

  return categories
    .filter((category) => category.kind === "expense")
    .map((category) => {
      const plannedCents = budgetMap[category.id] ?? 0;
      const actualCents = sumCategoryActualCents(
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