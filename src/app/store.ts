import { create } from "zustand";

import { hasBudgetForMonthCategory } from "../features/budgets/budget-page-helpers";
import { countTransactionsReferencingCategory } from "../lib/transaction-splits";
import { getNowIso } from "../lib/dates";
import {
  createOpeningBalanceTransaction,
  createTransferTransactions,
} from "../lib/factories";
import {
  createEmptyRecurringGenerationSummary,
  generateRecurringTransactionsForRange,
  generateRecurringTransactionsForMonth,
} from "../lib/recurring-generation";
import { latestPersistedStateSchema } from "../lib/validation";
import { createSeedState } from "../seed/seed-data";
import type {
  Account,
  Budget,
  Category,
  PersistedState,
  PersistedStateCollections,
  RecurringGenerationSummary,
  RecurringRule,
  Transaction,
} from "../types";
import {
  buildPersistedStateSnapshot,
  loadOrCreatePersistedState,
  savePersistedState,
} from "./storage";

type AppState = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
  lastRecurringGenerationSummary: RecurringGenerationSummary | null;

  addAccount: (input: Account) => void;
  updateAccount: (id: string, input: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  upsertAccountOpeningBalance: (
    accountId: string,
    amountCents: number,
    date: string,
    note?: string
  ) => void;
  deleteAccountOpeningBalance: (accountId: string) => void;

  addCategory: (input: Category) => void;
  updateCategory: (id: string, input: Partial<Category>) => void;
  archiveCategory: (id: string) => void;
  unarchiveCategory: (id: string) => void;
  deleteCategory: (id: string) => void;

  addTransaction: (input: Transaction) => void;
  updateTransaction: (id: string, input: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addTransfer: (input: {
    date: string;
    fromAccountId: string;
    toAccountId: string;
    amountCents: number;
    note?: string;
  }) => void;
  updateTransfer: (
    transferGroupId: string,
    input: {
      date: string;
      fromAccountId: string;
      toAccountId: string;
      amountCents: number;
      note?: string;
    }
  ) => void;
  deleteTransfer: (transferGroupId: string) => void;

  addBudget: (input: Budget) => void;
  updateBudget: (id: string, input: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  addRecurringRule: (input: RecurringRule) => void;
  updateRecurringRule: (id: string, input: Partial<RecurringRule>) => void;
  deleteRecurringRule: (id: string) => void;

  replacePersistedState: (state: PersistedState) => void;

  generateRecurringForRange: (
    startMonth: string,
    monthCount: number
  ) => RecurringGenerationSummary;
  generateRecurringForMonth: (month: string) => RecurringGenerationSummary;
  resetSeedData: () => void;
};

const initialData = loadOrCreatePersistedState();

type StoreCollections = PersistedStateCollections;

function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date));
}

function getStoreCollections(state: AppState): StoreCollections {
  return {
    accounts: state.accounts,
    categories: state.categories,
    transactions: state.transactions,
    budgets: state.budgets,
    recurringRules: state.recurringRules,
  };
}

function validateStoreCollectionsUpdate(
  currentCollections: StoreCollections,
  proposedUpdates: Partial<StoreCollections>,
  action: string
): StoreCollections | null {
  const nextCollections = {
    ...currentCollections,
    ...proposedUpdates,
  };
  const snapshot = buildPersistedStateSnapshot(nextCollections);
  const result = latestPersistedStateSchema.safeParse(snapshot);

  if (!result.success) {
    console.warn("rejecting invalid store update", {
      action,
      issues: result.error.issues,
    });
    return null;
  }

  return nextCollections;
}

function normalizeTransactionUpdate(
  existingTransaction: Transaction,
  input: Partial<Transaction>
): Partial<Transaction> {
  const nextKind = input.kind ?? existingTransaction.kind;

  if (nextKind !== "standard") {
    return {
      ...input,
      categoryId: undefined,
      splits: undefined,
    };
  }

  if (input.splits !== undefined) {
    return {
      ...input,
      categoryId: undefined,
    };
  }

  if (input.categoryId !== undefined) {
    return {
      ...input,
      splits: undefined,
    };
  }

  return input;
}

function buildUpdatedTransaction(
  existingTransaction: Transaction,
  input: Partial<Transaction>
): Transaction {
  const nextTransaction = {
    ...existingTransaction,
    ...normalizeTransactionUpdate(existingTransaction, input),
    updatedAt: getNowIso(),
  };

  if (nextTransaction.kind !== "standard") {
    const { categoryId: _categoryId, splits: _splits, ...normalizedTransaction } = nextTransaction;
    return normalizedTransaction as Transaction;
  }

  if (nextTransaction.splits != null) {
    const { categoryId: _categoryId, ...normalizedTransaction } = nextTransaction;
    return normalizedTransaction as Transaction;
  }

  if (nextTransaction.categoryId != null) {
    const { splits: _splits, ...normalizedTransaction } = nextTransaction;
    return normalizedTransaction as Transaction;
  }

  return nextTransaction;
}

function getTransferGroupTransactions(
  transactions: Transaction[],
  transferGroupId: string
): Transaction[] {
  return transactions.filter(
    (transaction) => transaction.transferGroupId === transferGroupId
  );
}

function getTransferPair(transactions: Transaction[], transferGroupId: string) {
  const groupTransactions = getTransferGroupTransactions(
    transactions,
    transferGroupId
  );

  return {
    transactions: groupTransactions,
    fromTransaction: groupTransactions.find(
      (transaction) => transaction.amountCents < 0
    ),
    toTransaction: groupTransactions.find(
      (transaction) => transaction.amountCents > 0
    ),
  };
}

function replaceTransferGroupTransactions(
  transactions: Transaction[],
  transferGroupId: string,
  replacements: Transaction[]
): Transaction[] {
  return sortTransactions([
    ...transactions.filter(
      (transaction) => transaction.transferGroupId !== transferGroupId
    ),
    ...replacements,
  ]);
}

function removeTransferGroupTransactions(
  transactions: Transaction[],
  transferGroupId: string
): Transaction[] {
  return transactions.filter(
    (transaction) => transaction.transferGroupId !== transferGroupId
  );
}

function buildTransferUpdateInput(
  existingTransaction: Transaction,
  pair: {
    fromTransaction?: Transaction;
    toTransaction?: Transaction;
  },
  input: Partial<Transaction>
) {
  const fromTransaction = pair.fromTransaction;
  const toTransaction = pair.toTransaction;

  if (!fromTransaction || !toTransaction) {
    return null;
  }

  const targetIsFromSide = existingTransaction.amountCents < 0;
  const nextAmountCents = Math.abs(
    input.amountCents ?? Math.abs(fromTransaction.amountCents)
  );

  return {
    date: input.date ?? fromTransaction.date,
    fromAccountId: targetIsFromSide
      ? input.accountId ?? fromTransaction.accountId
      : fromTransaction.accountId,
    toAccountId: targetIsFromSide
      ? toTransaction.accountId
      : input.accountId ?? toTransaction.accountId,
    amountCents: nextAmountCents,
    note: input.note ?? fromTransaction.note ?? toTransaction.note,
  };
}

function canApplyBudgetUpdate(
  budgets: Budget[],
  id: string,
  input: Partial<Budget>
): boolean {
  const existingBudget = budgets.find((budget) => budget.id === id);

  if (!existingBudget) {
    return false;
  }

  const nextMonth = input.month ?? existingBudget.month;
  const nextCategoryId = input.categoryId ?? existingBudget.categoryId;

  return !hasBudgetForMonthCategory(budgets, nextMonth, nextCategoryId, id);
}

function getAccountOpeningBalanceTransactions(
  transactions: Transaction[],
  accountId: string
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.accountId === accountId &&
      transaction.kind === "opening-balance"
  );
}

function getAccountOpeningBalanceTransaction(
  transactions: Transaction[],
  accountId: string
): Transaction | undefined {
  return getAccountOpeningBalanceTransactions(transactions, accountId)[0];
}

function removeAccountOpeningBalanceTransactions(
  transactions: Transaction[],
  accountId: string
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      !(transaction.accountId === accountId && transaction.kind === "opening-balance")
  );
}

export const useAppStore = create<AppState>((set) => ({
  accounts: initialData.accounts,
  categories: initialData.categories,
  transactions: sortTransactions(initialData.transactions),
  budgets: initialData.budgets,
  recurringRules: initialData.recurringRules,
  lastRecurringGenerationSummary: null,

  addAccount: (input) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          accounts: [...state.accounts, input],
        },
        "addAccount"
      );

      return nextCollections ?? {};
    }),

  updateAccount: (id, input) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          accounts: state.accounts.map((account) =>
            account.id === id
              ? {
                  ...account,
                  ...input,
                  updatedAt: getNowIso(),
                }
              : account
          ),
        },
        "updateAccount"
      );

      return nextCollections ?? {};
    }),

  deleteAccount: (id) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          accounts: state.accounts.filter((account) => account.id !== id),
          transactions: state.transactions.filter(
            (transaction) => transaction.accountId !== id
          ),
          recurringRules: state.recurringRules.filter(
            (rule) => rule.accountId !== id && rule.toAccountId !== id
          ),
        },
        "deleteAccount"
      );

      return nextCollections ?? {};
    }),

  upsertAccountOpeningBalance: (accountId, amountCents, date, note) =>
    set((state) => {
      if (!state.accounts.some((account) => account.id === accountId)) {
        console.warn("rejecting invalid store update", {
          action: "upsertAccountOpeningBalance",
          issues: [{ message: `account ${accountId} must exist` }],
        });
        return {};
      }

      const existing = getAccountOpeningBalanceTransaction(
        state.transactions,
        accountId
      );
      const transactionsWithoutOpeningBalance = removeAccountOpeningBalanceTransactions(
        state.transactions,
        accountId
      );

      if (amountCents === 0) {
        const nextCollections = validateStoreCollectionsUpdate(
          getStoreCollections(state),
          {
            transactions: sortTransactions(transactionsWithoutOpeningBalance),
          },
          "upsertAccountOpeningBalance"
        );

        return nextCollections ?? {};
      }

      const openingBalanceTransaction = createOpeningBalanceTransaction({
        accountId,
        amountCents,
        date,
        note: note ?? existing?.note,
        existing,
      });

      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          transactions: sortTransactions([
            ...transactionsWithoutOpeningBalance,
            openingBalanceTransaction,
          ]),
        },
        "upsertAccountOpeningBalance"
      );

      return nextCollections ?? {};
    }),

  deleteAccountOpeningBalance: (accountId) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          transactions: sortTransactions(
            removeAccountOpeningBalanceTransactions(state.transactions, accountId)
          ),
        },
        "deleteAccountOpeningBalance"
      );

      return nextCollections ?? {};
    }),

  addCategory: (input) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          categories: [...state.categories, input],
        },
        "addCategory"
      );

      return nextCollections ?? {};
    }),

  updateCategory: (id, input) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          categories: state.categories.map((category) =>
            category.id === id
              ? {
                  ...category,
                  ...input,
                  updatedAt: getNowIso(),
                }
              : category
          ),
        },
        "updateCategory"
      );

      return nextCollections ?? {};
    }),

  archiveCategory: (id) =>
    set((state) => {
      const archivedAt = getNowIso();
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          categories: state.categories.map((category) =>
            category.id === id
              ? {
                  ...category,
                  archivedAt,
                  updatedAt: archivedAt,
                }
              : category
          ),
        },
        "archiveCategory"
      );

      return nextCollections ?? {};
    }),

  unarchiveCategory: (id) =>
    set((state) => {
      const updatedAt = getNowIso();
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          categories: state.categories.map((category) =>
            category.id === id
              ? (() => {
                  const { archivedAt: _archivedAt, ...rest } = category;

                  return {
                    ...rest,
                    updatedAt,
                  };
                })()
              : category
          ),
        },
        "unarchiveCategory"
      );

      return nextCollections ?? {};
    }),

  deleteCategory: (id) =>
    set((state) => {
      const hasReferences =
        state.budgets.some((budget) => budget.categoryId === id) ||
        state.recurringRules.some((rule) => rule.categoryId === id) ||
        countTransactionsReferencingCategory(state.transactions, id) > 0;

      if (hasReferences) {
        console.warn("rejecting invalid store update", {
          action: "deleteCategory",
          issues: [{ message: `category ${id} must not have references before hard delete` }],
        });
        return {};
      }

      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          categories: state.categories.filter((category) => category.id !== id),
        },
        "deleteCategory"
      );

      return nextCollections ?? {};
    }),

  addTransaction: (input) =>
    set((state) => {
      if (input.kind === "transfer") {
        return {};
      }

      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          transactions: sortTransactions([...state.transactions, input]),
        },
        "addTransaction"
      );

      return nextCollections ?? {};
    }),

  updateTransaction: (id, input) =>
    set((state) => {
      const existingTransaction = state.transactions.find(
        (transaction) => transaction.id === id
      );

      if (!existingTransaction) {
        return {};
      }

      if (
        existingTransaction.kind === "transfer" &&
        existingTransaction.transferGroupId
      ) {
        const pair = getTransferPair(
          state.transactions,
          existingTransaction.transferGroupId
        );
        const nextInput = buildTransferUpdateInput(
          existingTransaction,
          pair,
          input
        );

        if (!nextInput) {
          return {};
        }

        const replacementTransactions = createTransferTransactions({
          input: nextInput,
          existing: {
            transferGroupId: existingTransaction.transferGroupId,
            fromTransaction: pair.fromTransaction,
            toTransaction: pair.toTransaction,
          },
        });

        return {
          transactions: replaceTransferGroupTransactions(
            state.transactions,
            existingTransaction.transferGroupId,
            replacementTransactions
          ),
        };
      }

      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          transactions: sortTransactions(
            state.transactions.map((transaction) =>
              transaction.id === id
                ? buildUpdatedTransaction(transaction, input)
                : transaction
            )
          ),
        },
        "updateTransaction"
      );

      return nextCollections ?? {};
    }),

  deleteTransaction: (id) =>
    set((state) => {
      const existingTransaction = state.transactions.find(
        (transaction) => transaction.id === id
      );

      if (!existingTransaction) {
        return {};
      }

      if (
        existingTransaction.kind === "transfer" &&
        existingTransaction.transferGroupId
      ) {
        const nextCollections = validateStoreCollectionsUpdate(
          getStoreCollections(state),
          {
            transactions: removeTransferGroupTransactions(
              state.transactions,
              existingTransaction.transferGroupId
            ),
          },
          "deleteTransaction"
        );

        return nextCollections ?? {};
      }

      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          transactions: state.transactions.filter(
            (transaction) => transaction.id !== id
          ),
        },
        "deleteTransaction"
      );

      return nextCollections ?? {};
    }),

  addTransfer: (input) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          transactions: sortTransactions([
            ...state.transactions,
            ...createTransferTransactions({ input }),
          ]),
        },
        "addTransfer"
      );

      return nextCollections ?? {};
    }),

  updateTransfer: (transferGroupId, input) =>
    set((state) => {
      const pair = getTransferPair(state.transactions, transferGroupId);

      if (!pair.fromTransaction || !pair.toTransaction) {
        return {};
      }

      const replacementTransactions = createTransferTransactions({
        input,
        existing: {
          transferGroupId,
          fromTransaction: pair.fromTransaction,
          toTransaction: pair.toTransaction,
        },
      });

      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          transactions: replaceTransferGroupTransactions(
            state.transactions,
            transferGroupId,
            replacementTransactions
          ),
        },
        "updateTransfer"
      );

      return nextCollections ?? {};
    }),

  deleteTransfer: (transferGroupId) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          transactions: removeTransferGroupTransactions(
            state.transactions,
            transferGroupId
          ),
        },
        "deleteTransfer"
      );

      return nextCollections ?? {};
    }),

  addBudget: (input) =>
    set((state) => {
      if (hasBudgetForMonthCategory(state.budgets, input.month, input.categoryId)) {
        return {};
      }

      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          budgets: [...state.budgets, input],
        },
        "addBudget"
      );

      return nextCollections ?? {};
    }),

  updateBudget: (id, input) =>
    set((state) => {
      if (!canApplyBudgetUpdate(state.budgets, id, input)) {
        return {};
      }

      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          budgets: state.budgets.map((budget) =>
            budget.id === id
              ? {
                  ...budget,
                  ...input,
                  updatedAt: getNowIso(),
                }
              : budget
          ),
        },
        "updateBudget"
      );

      return nextCollections ?? {};
    }),

  deleteBudget: (id) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          budgets: state.budgets.filter((budget) => budget.id !== id),
        },
        "deleteBudget"
      );

      return nextCollections ?? {};
    }),

  addRecurringRule: (input) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          recurringRules: [...state.recurringRules, input],
        },
        "addRecurringRule"
      );

      return nextCollections ?? {};
    }),

  updateRecurringRule: (id, input) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          recurringRules: state.recurringRules.map((rule) =>
            rule.id === id
              ? {
                  ...rule,
                  ...input,
                  updatedAt: getNowIso(),
                }
              : rule
          ),
        },
        "updateRecurringRule"
      );

      return nextCollections ?? {};
    }),

  deleteRecurringRule: (id) =>
    set((state) => {
      const nextCollections = validateStoreCollectionsUpdate(
        getStoreCollections(state),
        {
          recurringRules: state.recurringRules.filter((rule) => rule.id !== id),
        },
        "deleteRecurringRule"
      );

      return nextCollections ?? {};
    }),

  replacePersistedState: (persistedState) =>
    set({
      accounts: persistedState.accounts,
      categories: persistedState.categories,
      transactions: sortTransactions(persistedState.transactions),
      budgets: persistedState.budgets,
      recurringRules: persistedState.recurringRules,
      lastRecurringGenerationSummary: null,
    }),

  generateRecurringForRange: (startMonth, monthCount) => {
    let summary = createEmptyRecurringGenerationSummary(startMonth, monthCount);

    set((state) => {
      const safeMonthCount =
        Number.isInteger(monthCount) && monthCount > 0 ? monthCount : 1;
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
        transactions: sortTransactions([
          ...state.transactions,
          ...generation.transactions,
        ]),
        lastRecurringGenerationSummary: generation.summary,
      };
    });

    return summary;
  },

  generateRecurringForMonth: (month) => {
    let summary = createEmptyRecurringGenerationSummary(month, 1);

    set((state) => {
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
        transactions: sortTransactions([
          ...state.transactions,
          ...generation.transactions,
        ]),
        lastRecurringGenerationSummary: generation.summary,
      };
    });

    return summary;
  },

  resetSeedData: () => {
    const seeded = createSeedState();

    set({
      accounts: seeded.accounts,
      categories: seeded.categories,
      transactions: sortTransactions(seeded.transactions),
      budgets: seeded.budgets,
      recurringRules: seeded.recurringRules,
      lastRecurringGenerationSummary: null,
    });
  },
}));

useAppStore.subscribe((state) => {
  savePersistedState(
    buildPersistedStateSnapshot({
      accounts: state.accounts,
      categories: state.categories,
      transactions: state.transactions,
      budgets: state.budgets,
      recurringRules: state.recurringRules,
    })
  );
});