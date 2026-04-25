import type { Transaction, TransactionSplit } from "../types";

export function hasTransactionSplits(
  transaction: Transaction
): transaction is Transaction & { kind: "standard"; splits: TransactionSplit[] } {
  return (
    transaction.kind === "standard" &&
    Array.isArray(transaction.splits) &&
    transaction.splits.length > 0
  );
}

export function getTransactionCategoryAllocations(
  transaction: Transaction
): TransactionSplit[] {
  if (transaction.kind !== "standard") {
    return [];
  }

  if (hasTransactionSplits(transaction)) {
    return transaction.splits;
  }

  if (!transaction.categoryId) {
    return [];
  }

  return [
    {
      id: `${transaction.id}-category`,
      categoryId: transaction.categoryId,
      amountCents: transaction.amountCents,
      note: undefined,
    },
  ];
}

export function getTransactionCategoryIds(transaction: Transaction): string[] {
  return getTransactionCategoryAllocations(transaction).map(
    (allocation) => allocation.categoryId
  );
}

export function transactionReferencesCategory(
  transaction: Transaction,
  categoryId: string
): boolean {
  return getTransactionCategoryIds(transaction).includes(categoryId);
}

export function countTransactionCategoryUsageByCategoryId(
  transactions: Transaction[]
): Record<string, number> {
  return transactions.reduce<Record<string, number>>((acc, transaction) => {
    const categoryIds = new Set(getTransactionCategoryIds(transaction));

    for (const currentCategoryId of categoryIds) {
      acc[currentCategoryId] = (acc[currentCategoryId] ?? 0) + 1;
    }

    return acc;
  }, {});
}

export function countTransactionsReferencingCategory(
  transactions: Transaction[],
  categoryId: string
): number {
  return transactions.filter((transaction) =>
    transactionReferencesCategory(transaction, categoryId)
  ).length;
}