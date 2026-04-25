import type { Category, CategoryKind, Transaction } from "../types";
import { transactionReferencesCategory } from "./transaction-splits";

export function isCategoryArchived(category: Category): boolean {
  return category.archivedAt != null;
}

export function getActiveCategories(categories: Category[]): Category[] {
  return categories.filter((category) => !isCategoryArchived(category));
}

export function getCategoryDisplayName(category: Category): string {
  return isCategoryArchived(category)
    ? `${category.name} (archived)`
    : category.name;
}

export function getSelectableCategories(
  categories: Category[],
  options?: {
    kind?: CategoryKind;
    includeCategoryId?: string;
    includeCategoryIds?: string[];
  }
): Category[] {
  const { kind, includeCategoryId, includeCategoryIds = [] } = options ?? {};
  const includedCategoryIds = new Set(
    [includeCategoryId, ...includeCategoryIds].filter(
      (value): value is string => Boolean(value)
    )
  );

  return categories.filter((category) => {
    if (kind && category.kind !== kind) {
      return false;
    }

    return !isCategoryArchived(category) || includedCategoryIds.has(category.id);
  });
}

export function getVisibleBudgetCategories(
  categories: Category[],
  budgets: Array<{ month: string; categoryId: string }>,
  transactions: Transaction[],
  month: string
): Category[] {
  return categories.filter((category) => {
    if (category.kind !== "expense") {
      return false;
    }

    if (!isCategoryArchived(category)) {
      return true;
    }

    return (
      budgets.some(
        (budget) => budget.month === month && budget.categoryId === category.id
      ) ||
      transactions.some(
        (transaction) =>
          transaction.date.startsWith(`${month}-`) &&
          transactionReferencesCategory(transaction, category.id)
      )
    );
  });
}