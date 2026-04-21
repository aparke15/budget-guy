import { create } from "zustand";

import { generateOccurrencesForMonth, getNowIso } from "../lib/dates";
import { createSeedState } from "../seed/seed-data";
import type {
  Account,
  Budget,
  Category,
  PersistedState,
  RecurringRule,
  Transaction,
} from "../types";
import { loadOrCreatePersistedState, savePersistedState } from "./storage";

type AppState = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];

  addAccount: (input: Account) => void;
  updateAccount: (id: string, input: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addCategory: (input: Category) => void;
  updateCategory: (id: string, input: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addTransaction: (input: Transaction) => void;
  updateTransaction: (id: string, input: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  addBudget: (input: Budget) => void;
  updateBudget: (id: string, input: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  addRecurringRule: (input: RecurringRule) => void;
  updateRecurringRule: (id: string, input: Partial<RecurringRule>) => void;
  deleteRecurringRule: (id: string) => void;

  generateRecurringForMonth: (month: string) => void;
  resetSeedData: () => void;
};

type DataState = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
};

const initialData = loadOrCreatePersistedState();

function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date));
}

function buildPersistedState(state: DataState): PersistedState {
  return {
    version: 1,
    accounts: state.accounts,
    categories: state.categories,
    transactions: state.transactions,
    budgets: state.budgets,
    recurringRules: state.recurringRules,
  };
}

export const useAppStore = create<AppState>((set) => ({
  accounts: initialData.accounts,
  categories: initialData.categories,
  transactions: sortTransactions(initialData.transactions),
  budgets: initialData.budgets,
  recurringRules: initialData.recurringRules,

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
    set((state) => ({
      transactions: sortTransactions([...state.transactions, input]),
    })),

  updateTransaction: (id, input) =>
    set((state) => ({
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
    })),

  deleteTransaction: (id) =>
    set((state) => ({
      transactions: state.transactions.filter(
        (transaction) => transaction.id !== id
      ),
    })),

  addBudget: (input) =>
    set((state) => ({
      budgets: [...state.budgets, input],
    })),

  updateBudget: (id, input) =>
    set((state) => ({
      budgets: state.budgets.map((budget) =>
        budget.id === id
          ? {
              ...budget,
              ...input,
              updatedAt: getNowIso(),
            }
          : budget
      ),
    })),

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

  generateRecurringForMonth: (month) =>
    set((state) => {
      const now = getNowIso();

      const generatedTransactions = state.recurringRules
        .filter((rule) => rule.active)
        .flatMap((rule) =>
          generateOccurrencesForMonth(rule, month, state.transactions)
        )
        .map<Transaction>((occurrence) => ({
          id: crypto.randomUUID(),
          date: occurrence.date,
          amountCents: occurrence.amountCents,
          accountId: occurrence.accountId,
          categoryId: occurrence.categoryId,
          merchant: occurrence.merchant,
          note: occurrence.note,
          source: "recurring",
          recurringRuleId: occurrence.recurringRuleId,
          createdAt: now,
          updatedAt: now,
        }));

      if (generatedTransactions.length === 0) {
        return {};
      }

      return {
        transactions: sortTransactions([
          ...state.transactions,
          ...generatedTransactions,
        ]),
      };
    }),

  resetSeedData: () => {
    const seeded = createSeedState();

    set({
      accounts: seeded.accounts,
      categories: seeded.categories,
      transactions: sortTransactions(seeded.transactions),
      budgets: seeded.budgets,
      recurringRules: seeded.recurringRules,
    });
  },
}));

useAppStore.subscribe((state) => {
  savePersistedState(
    buildPersistedState({
      accounts: state.accounts,
      categories: state.categories,
      transactions: state.transactions,
      budgets: state.budgets,
      recurringRules: state.recurringRules,
    })
  );
});