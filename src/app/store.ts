import { create } from "zustand";

import { generateoccurrencesformonth, getnowiso } from "../lib/dates";
import { createseedstate } from "../seed/seed-data";
import type {
  account,
  budget,
  category,
  persistedstate,
  recurringrule,
  transaction,
} from "../types";
import { loadorcreatepersistedstate, savepersistedstate } from "./storage";

type appstate = {
  accounts: account[];
  categories: category[];
  transactions: transaction[];
  budgets: budget[];
  recurringRules: recurringrule[];

  addaccount: (input: account) => void;
  updateaccount: (id: string, input: Partial<account>) => void;
  deleteaccount: (id: string) => void;

  addcategory: (input: category) => void;
  updatecategory: (id: string, input: Partial<category>) => void;
  deletecategory: (id: string) => void;

  addtransaction: (input: transaction) => void;
  updatetransaction: (id: string, input: Partial<transaction>) => void;
  deletetransaction: (id: string) => void;

  addbudget: (input: budget) => void;
  updatebudget: (id: string, input: Partial<budget>) => void;
  deletebudget: (id: string) => void;

  addrecurringrule: (input: recurringrule) => void;
  updaterecurringrule: (id: string, input: Partial<recurringrule>) => void;
  deleterecurringrule: (id: string) => void;

  generaterecurringformonth: (month: string) => void;
  resetseeddata: () => void;
};

type datastate = {
  accounts: account[];
  categories: category[];
  transactions: transaction[];
  budgets: budget[];
  recurringRules: recurringrule[];
};

const initialdata = loadorcreatepersistedstate();

function sorttransactions(transactions: transaction[]): transaction[] {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date));
}

function buildpersistedstate(state: datastate): persistedstate {
  return {
    version: 1,
    accounts: state.accounts,
    categories: state.categories,
    transactions: state.transactions,
    budgets: state.budgets,
    recurringRules: state.recurringRules,
  };
}

export const useappstore = create<appstate>((set) => ({
  accounts: initialdata.accounts,
  categories: initialdata.categories,
  transactions: sorttransactions(initialdata.transactions),
  budgets: initialdata.budgets,
  recurringRules: initialdata.recurringRules,

  addaccount: (input) =>
    set((state) => ({
      accounts: [...state.accounts, input],
    })),

  updateaccount: (id, input) =>
    set((state) => ({
      accounts: state.accounts.map((account) =>
        account.id === id
          ? {
              ...account,
              ...input,
              updatedAt: getnowiso(),
            }
          : account
      ),
    })),

  deleteaccount: (id) =>
    set((state) => ({
      accounts: state.accounts.filter((account) => account.id !== id),
    })),

  addcategory: (input) =>
    set((state) => ({
      categories: [...state.categories, input],
    })),

  updatecategory: (id, input) =>
    set((state) => ({
      categories: state.categories.map((category) =>
        category.id === id
          ? {
              ...category,
              ...input,
              updatedAt: getnowiso(),
            }
          : category
      ),
    })),

  deletecategory: (id) =>
    set((state) => ({
      categories: state.categories.filter((category) => category.id !== id),
    })),

  addtransaction: (input) =>
    set((state) => ({
      transactions: sorttransactions([...state.transactions, input]),
    })),

  updatetransaction: (id, input) =>
    set((state) => ({
      transactions: sorttransactions(
        state.transactions.map((transaction) =>
          transaction.id === id
            ? {
                ...transaction,
                ...input,
                updatedAt: getnowiso(),
              }
            : transaction
        )
      ),
    })),

  deletetransaction: (id) =>
    set((state) => ({
      transactions: state.transactions.filter(
        (transaction) => transaction.id !== id
      ),
    })),

  addbudget: (input) =>
    set((state) => ({
      budgets: [...state.budgets, input],
    })),

  updatebudget: (id, input) =>
    set((state) => ({
      budgets: state.budgets.map((budget) =>
        budget.id === id
          ? {
              ...budget,
              ...input,
              updatedAt: getnowiso(),
            }
          : budget
      ),
    })),

  deletebudget: (id) =>
    set((state) => ({
      budgets: state.budgets.filter((budget) => budget.id !== id),
    })),

  addrecurringrule: (input) =>
    set((state) => ({
      recurringRules: [...state.recurringRules, input],
    })),

  updaterecurringrule: (id, input) =>
    set((state) => ({
      recurringRules: state.recurringRules.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              ...input,
              updatedAt: getnowiso(),
            }
          : rule
      ),
    })),

  deleterecurringrule: (id) =>
    set((state) => ({
      recurringRules: state.recurringRules.filter((rule) => rule.id !== id),
    })),

  generaterecurringformonth: (month) =>
    set((state) => {
      const now = getnowiso();

      const generatedtransactions = state.recurringRules
        .filter((rule) => rule.active)
        .flatMap((rule) =>
          generateoccurrencesformonth(rule, month, state.transactions)
        )
        .map<transaction>((occurrence) => ({
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

      if (generatedtransactions.length === 0) {
        return {};
      }

      return {
        transactions: sorttransactions([
          ...state.transactions,
          ...generatedtransactions,
        ]),
      };
    }),

  resetseeddata: () => {
    const seeded = createseedstate();

    set({
      accounts: seeded.accounts,
      categories: seeded.categories,
      transactions: sorttransactions(seeded.transactions),
      budgets: seeded.budgets,
      recurringRules: seeded.recurringRules,
    });
  },
}));

useappstore.subscribe((state) => {
  savepersistedstate(
    buildpersistedstate({
      accounts: state.accounts,
      categories: state.categories,
      transactions: state.transactions,
      budgets: state.budgets,
      recurringRules: state.recurringRules,
    })
  );
});