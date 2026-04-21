import { getNowIso } from "./dates";
import { makeId } from "./ids";
import {
  formatCentsForInput,
  parseAmountInputToCents,
} from "./money";
import type { TransactionFormValues } from "../features/types";
import type {
  Account,
  AccountType,
  Budget,
  Category,
  CategoryKind,
  RecurringFrequency,
  RecurringRule,
  Transaction,
} from "../types";

type CreateTransactionParams = {
  values: TransactionFormValues;
  existing?: Transaction;
};

type CreateAccountParams = {
  name: string;
  type: AccountType;
};

type CreateCategoryParams = {
  name: string;
  kind: CategoryKind;
  color?: string;
};

type CreateBudgetParams = {
  month: string;
  categoryId: string;
  plannedCents: number;
};

type CreateRecurringRuleParams = {
  name: string;
  amountCents: number;
  accountId: string;
  categoryId: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  active?: boolean;
  dayOfMonth?: number;
  dayOfWeek?: number;
  merchant?: string;
  note?: string;
};

function getDefaultCategoryId(
  categories: Category[],
  kind: CategoryKind
): string {
  return categories.find((category) => category.kind === kind)?.id ?? "";
}

function getDefaultAccountId(accounts: Account[]): string {
  return accounts[0]?.id ?? "";
}

export function createTransactionFormValues(
  accounts: Account[],
  categories: Category[],
  existing?: Transaction
): TransactionFormValues {
  if (existing) {
    return {
      date: existing.date,
      kind: existing.amountCents >= 0 ? "income" : "expense",
      amount: formatCentsForInput(existing.amountCents),
      accountId: existing.accountId,
      categoryId: existing.categoryId,
      merchant: existing.merchant ?? "",
      note: existing.note ?? "",
    };
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    kind: "expense",
    amount: "",
    accountId: getDefaultAccountId(accounts),
    categoryId: getDefaultCategoryId(categories, "expense"),
    merchant: "",
    note: "",
  };
}

export function createTransaction(
  params: CreateTransactionParams
): Transaction {
  const { values, existing } = params;
  const amountAbsCents = parseAmountInputToCents(values.amount);

  if (amountAbsCents == null || amountAbsCents <= 0) {
    throw new Error("amount must be a positive number");
  }

  const now = getNowIso();
  const amountCents =
    values.kind === "income"
      ? Math.abs(amountAbsCents)
      : -Math.abs(amountAbsCents);

  return {
    id: existing?.id ?? makeId("txn"),
    date: values.date,
    amountCents,
    accountId: values.accountId,
    categoryId: values.categoryId,
    merchant: values.merchant.trim() || undefined,
    note: values.note.trim() || undefined,
    source: existing?.source ?? "manual",
    recurringRuleId: existing?.recurringRuleId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function createAccount(params: CreateAccountParams): Account {
  const now = getNowIso();

  return {
    id: makeId("acct"),
    name: params.name.trim(),
    type: params.type,
    createdAt: now,
    updatedAt: now,
  };
}

export function createCategory(params: CreateCategoryParams): Category {
  const now = getNowIso();

  return {
    id: makeId("cat"),
    name: params.name.trim(),
    kind: params.kind,
    color: params.color,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBudget(params: CreateBudgetParams): Budget {
  const now = getNowIso();

  return {
    id: makeId("budget"),
    month: params.month,
    categoryId: params.categoryId,
    plannedCents: params.plannedCents,
    createdAt: now,
    updatedAt: now,
  };
}

export function createRecurringRule(
  params: CreateRecurringRuleParams
): RecurringRule {
  const now = getNowIso();

  return {
    id: makeId("rule"),
    name: params.name.trim(),
    amountCents: params.amountCents,
    accountId: params.accountId,
    categoryId: params.categoryId,
    merchant: params.merchant?.trim() || undefined,
    note: params.note?.trim() || undefined,
    frequency: params.frequency,
    startDate: params.startDate,
    endDate: params.endDate,
    active: params.active ?? true,
    dayOfMonth: params.dayOfMonth,
    dayOfWeek: params.dayOfWeek,
    createdAt: now,
    updatedAt: now,
  };
}