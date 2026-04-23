import { create } from "zustand";

import { hasBudgetForMonthCategory } from "../features/budgets/budget-page-helpers";
import { getNowIso } from "../lib/dates";
import {
  createOpeningBalanceTransaction,
  createTransferTransactions,
} from "../lib/factories";
import {
  createEmptyRecurringGenerationSummary,
  generateRecurringTransactionsForMonth,
} from "../lib/recurring-generation";
import { createSeedState } from "../seed/seed-data";
import type {
  Account,
  Budget,
  Category,
  PersistedState,
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

  generateRecurringForMonth: (month: string) => RecurringGenerationSummary;
  resetSeedData: () => void;
};

const initialData = loadOrCreatePersistedState();

function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date));
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
    set((state) => ({
      accounts: [...state.accounts, input],
    })),

  updateAccount: (id, input) =>
    set((state) => ({
      accounts: state.accounts.map((account) =>
        account.id === id
          ? {
              ...account,
              ...input,
              updatedAt: getNowIso(),
            }
          : account
      ),
    })),

  deleteAccount: (id) =>
    set((state) => ({
      accounts: state.accounts.filter((account) => account.id !== id),
      transactions: state.transactions.filter(
        (transaction) => transaction.accountId !== id
      ),
      recurringRules: state.recurringRules.filter(
        (rule) => rule.accountId !== id && rule.toAccountId !== id
      ),
    })),

  upsertAccountOpeningBalance: (accountId, amountCents, date, note) =>
    set((state) => {
      const existing = getAccountOpeningBalanceTransaction(
        state.transactions,
        accountId
      );
      const transactionsWithoutOpeningBalance = removeAccountOpeningBalanceTransactions(
        state.transactions,
        accountId
      );

      if (amountCents === 0) {
        return {
          transactions: sortTransactions(transactionsWithoutOpeningBalance),
        };
      }

      const openingBalanceTransaction = createOpeningBalanceTransaction({
        accountId,
        amountCents,
        date,
        note: note ?? existing?.note,
        existing,
      });

      return {
        transactions: sortTransactions([
          ...transactionsWithoutOpeningBalance,
          openingBalanceTransaction,
        ]),
      };
    }),

  deleteAccountOpeningBalance: (accountId) =>
    set((state) => ({
      transactions: sortTransactions(
        removeAccountOpeningBalanceTransactions(state.transactions, accountId)
      ),
    })),

  addCategory: (input) =>
    set((state) => ({
      categories: [...state.categories, input],
    })),

  updateCategory: (id, input) =>
    set((state) => ({
      categories: state.categories.map((category) =>
        category.id === id
          ? {
              ...category,
              ...input,
              updatedAt: getNowIso(),
            }
          : category
      ),
    })),

  deleteCategory: (id) =>
    set((state) => ({
      categories: state.categories.filter((category) => category.id !== id),
    })),

  addTransaction: (input) =>
    set((state) => {
      if (input.kind === "transfer") {
        return {};
      }

      return {
        transactions: sortTransactions([...state.transactions, input]),
      };
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

      return {
        transactions: sortTransactions(
          state.transactions.map((transaction) =>
            transaction.id === id
              ? {
                  ...transaction,
                  ...input,
                  updatedAt: getNowIso(),
                }
              : transaction
          )
        ),
      };
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
        return {
          transactions: removeTransferGroupTransactions(
            state.transactions,
            existingTransaction.transferGroupId
          ),
        };
      }

      return {
        transactions: state.transactions.filter(
          (transaction) => transaction.id !== id
        ),
      };
    }),

  addTransfer: (input) =>
    set((state) => ({
      transactions: sortTransactions([
        ...state.transactions,
        ...createTransferTransactions({ input }),
      ]),
    })),

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

      return {
        transactions: replaceTransferGroupTransactions(
          state.transactions,
          transferGroupId,
          replacementTransactions
        ),
      };
    }),

  deleteTransfer: (transferGroupId) =>
    set((state) => ({
      transactions: removeTransferGroupTransactions(
        state.transactions,
        transferGroupId
      ),
    })),

  addBudget: (input) =>
    set((state) => {
      if (hasBudgetForMonthCategory(state.budgets, input.month, input.categoryId)) {
        return {};
      }

      return {
        budgets: [...state.budgets, input],
      };
    }),

  updateBudget: (id, input) =>
    set((state) => {
      if (!canApplyBudgetUpdate(state.budgets, id, input)) {
        return {};
      }

      return {
        budgets: state.budgets.map((budget) =>
          budget.id === id
            ? {
                ...budget,
                ...input,
                updatedAt: getNowIso(),
              }
            : budget
        ),
      };
    }),

  deleteBudget: (id) =>
    set((state) => ({
      budgets: state.budgets.filter((budget) => budget.id !== id),
    })),

  addRecurringRule: (input) =>
    set((state) => ({
      recurringRules: [...state.recurringRules, input],
    })),

  updateRecurringRule: (id, input) =>
    set((state) => ({
      recurringRules: state.recurringRules.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              ...input,
              updatedAt: getNowIso(),
            }
          : rule
      ),
    })),

  deleteRecurringRule: (id) =>
    set((state) => ({
      recurringRules: state.recurringRules.filter((rule) => rule.id !== id),
    })),

  replacePersistedState: (persistedState) =>
    set({
      accounts: persistedState.accounts,
      categories: persistedState.categories,
      transactions: sortTransactions(persistedState.transactions),
      budgets: persistedState.budgets,
      recurringRules: persistedState.recurringRules,
      lastRecurringGenerationSummary: null,
    }),

  generateRecurringForMonth: (month) => {
    let summary = createEmptyRecurringGenerationSummary(month);

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