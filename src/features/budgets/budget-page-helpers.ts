import type { Budget, BudgetRow, Category, MonthlySummary, Transaction } from "../../types";
import { parseAmountInputToCents, sumCategoryActualCents } from "../../lib/money";

export type BudgetEditorRow = BudgetRow & {
  budgetId?: string;
};

export function hasBudgetForMonthCategory(
  budgets: Budget[],
  month: string,
  categoryId: string,
  excludeBudgetId?: string
): boolean {
  return budgets.some(
    (budget) =>
      budget.id !== excludeBudgetId &&
      budget.month === month &&
      budget.categoryId === categoryId
  );
}

export function getAvailableBudgetCategories(
  expenseCategories: Category[],
  budgets: Budget[],
  month: string
): Category[] {
  return expenseCategories.filter(
    (category) => !hasBudgetForMonthCategory(budgets, month, category.id)
  );
}

export function getBudgetEditorRows(
  expenseCategories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
  month: string
): BudgetEditorRow[] {
  const budgetByCategoryId = new Map(
    budgets
      .filter((budget) => budget.month === month)
      .map((budget) => [budget.categoryId, budget])
  );

  return expenseCategories
    .map((category) => {
      const budget = budgetByCategoryId.get(category.id);
      const plannedCents = budget?.plannedCents ?? 0;
      const actualCents = sumCategoryActualCents(transactions, month, category.id);
      const remainingCents = plannedCents - actualCents;

      return {
        budgetId: budget?.id,
        categoryId: category.id,
        categoryName: category.name,
        plannedCents,
        actualCents,
        remainingCents,
        overBudget: remainingCents < 0,
      } satisfies BudgetEditorRow;
    })
    .sort((left, right) => left.categoryName.localeCompare(right.categoryName));
}

export function getDraftPlannedTotal(
  rows: Array<Pick<BudgetEditorRow, "categoryId" | "plannedCents">>,
  drafts: Record<string, string>
): number {
  return rows.reduce((sum, row) => {
    const raw = drafts[row.categoryId];

    if (raw == null) {
      return sum + row.plannedCents;
    }

    const parsed = parseAmountInputToCents(raw);

    return sum + (parsed ?? 0);
  }, 0);
}

export function createDraftSummary(
  summary: MonthlySummary,
  draftPlannedTotal: number
): MonthlySummary {
  return {
    ...summary,
    plannedCents: draftPlannedTotal,
    unassignedCents: summary.incomeCents - draftPlannedTotal,
  };
}

export function getDraftRemainingCents(
  draftCents: number,
  actualCents: number
): number {
  return draftCents - actualCents;
}