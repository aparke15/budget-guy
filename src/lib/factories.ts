import { getActiveCategories } from "./categories";
import { getNowIso } from "./dates";
import { makeId } from "./ids";
import {
  formatCentsForInput,
  parseAmountInputToCents,
} from "./money";
import type { ExpectedOccurrence } from "./expected-occurrences";
import type {
  TransferFormInput,
  TransactionFormInitialState,
  TransactionFormValues,
} from "../features/types";
import type {
  Account,
  AccountType,
  Budget,
  Category,
  CategoryKind,
  RecurringFrequency,
  RecurringRuleKind,
  RecurringRule,
  Transaction,
  TransactionSplit,
} from "../types";

type CreateTransactionParams = {
  values: TransactionFormValues;
  existing?: Transaction;
};

type CreateTransferTransactionsParams = {
  input: TransferFormInput;
  existing?: {
    transferGroupId?: string;
    fromTransaction?: Transaction;
    toTransaction?: Transaction;
  };
  metadata?: {
    source?: "manual" | "recurring";
    recurringRuleId?: string;
  };
};

type CreateOpeningBalanceTransactionParams = {
  accountId: string;
  amountCents: number;
  date: string;
  note?: string;
  existing?: Transaction;
};

type CreateAccountParams = {
  name: string;
  type: AccountType;
  creditLimitCents?: number;
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

type BaseRecurringRuleParams = {
  name: string;
  amountCents: number;
  accountId: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  active?: boolean;
  dayOfMonth?: number;
  dayOfWeek?: number;
  note?: string;
};

type CreateRecurringRuleParams =
  | (BaseRecurringRuleParams & {
      kind?: "standard";
      categoryId: string;
      merchant?: string;
      toAccountId?: undefined;
    })
  | (BaseRecurringRuleParams & {
      kind: "transfer";
      toAccountId: string;
      categoryId?: undefined;
      merchant?: undefined;
    });

function getDefaultCategoryId(
  categories: Category[],
  kind: CategoryKind
): string {
  const activeCategories = getActiveCategories(categories);

  return activeCategories.find((category) => category.kind === kind)?.id ?? "";
}

function getDefaultAccountId(accounts: Account[]): string {
  return accounts[0]?.id ?? "";
}

function getDefaultTransferDestinationAccountId(accounts: Account[]): string {
  return accounts[1]?.id ?? accounts[0]?.id ?? "";
}

function createEmptyTransactionFormSplits(
  categoryId: string
): TransactionFormValues["splits"] {
  return [0, 1].map(() => ({
    id: makeId("split"),
    categoryId,
    amount: "",
    note: "",
  }));
}

function getPersistedSplitAmountCents(
  amount: string,
  entryType: Exclude<TransactionFormValues["entryType"], "transfer">
): number {
  const parsedAmountCents = parseAmountInputToCents(amount);

  if (parsedAmountCents == null || parsedAmountCents <= 0) {
    throw new Error("split amounts must be positive numbers");
  }

  return entryType === "income"
    ? Math.abs(parsedAmountCents)
    : -Math.abs(parsedAmountCents);
}

function createTransactionSplits(
  values: TransactionFormValues,
  amountCents: number
): TransactionSplit[] {
  if (values.entryType === "transfer") {
    throw new Error("transfer entries cannot include splits");
  }

  const entryType = values.entryType;

  if (values.splits.length < 2) {
    throw new Error("split transactions require at least 2 rows");
  }

  const splits = values.splits.map((split) => {
    if (!split.categoryId) {
      throw new Error("each split row requires a category");
    }

    return {
      id: split.id || makeId("split"),
      categoryId: split.categoryId,
      amountCents: getPersistedSplitAmountCents(split.amount, entryType),
      note: split.note.trim() || undefined,
    } satisfies TransactionSplit;
  });

  const totalSplitAmountCents = splits.reduce(
    (sum, split) => sum + split.amountCents,
    0
  );

  if (totalSplitAmountCents !== amountCents) {
    throw new Error("split amounts must add up to the transaction total");
  }

  return splits;
}

export function getDefaultRecurringTransferAccountId(
  accounts: Account[],
  fromAccountId: string
): string {
  return (
    accounts.find((account) => account.id !== fromAccountId)?.id ??
    fromAccountId ??
    ""
  );
}

export function createTransactionFormValues(
  accounts: Account[],
  categories: Category[],
  initialState?: TransactionFormInitialState
): TransactionFormValues {
  const defaultExpenseCategoryId = getDefaultCategoryId(categories, "expense");

  if (initialState?.mode === "standard") {
    const { transaction: existing } = initialState;
    const splitCategoryId =
      existing.splits?.[0]?.categoryId ??
      existing.categoryId ??
      defaultExpenseCategoryId;

    return {
      date: existing.date,
      entryType: existing.amountCents >= 0 ? "income" : "expense",
      amount: formatCentsForInput(existing.amountCents),
      accountId: existing.accountId,
      categoryId: existing.categoryId ?? splitCategoryId,
      isSplit: Boolean(existing.splits?.length),
      splits:
        existing.splits?.map((split) => ({
          id: split.id,
          categoryId: split.categoryId,
          amount: formatCentsForInput(split.amountCents),
          note: split.note ?? "",
        })) ?? createEmptyTransactionFormSplits(splitCategoryId),
      merchant: existing.merchant ?? "",
      note: existing.note ?? "",
      fromAccountId: getDefaultAccountId(accounts),
      toAccountId: getDefaultTransferDestinationAccountId(accounts),
    };
  }

  if (initialState?.mode === "transfer") {
    return {
      date: initialState.date,
      entryType: "transfer",
      amount: formatCentsForInput(initialState.amountCents),
      accountId: getDefaultAccountId(accounts),
      categoryId: defaultExpenseCategoryId,
      isSplit: false,
      splits: createEmptyTransactionFormSplits(defaultExpenseCategoryId),
      merchant: "",
      note: initialState.note ?? "",
      fromAccountId: initialState.fromAccountId,
      toAccountId: initialState.toAccountId,
    };
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    entryType: "expense",
    amount: "",
    accountId: getDefaultAccountId(accounts),
    categoryId: defaultExpenseCategoryId,
    isSplit: false,
    splits: createEmptyTransactionFormSplits(defaultExpenseCategoryId),
    merchant: "",
    note: "",
    fromAccountId: getDefaultAccountId(accounts),
    toAccountId: getDefaultTransferDestinationAccountId(accounts),
  };
}

export function createTransaction(
  params: CreateTransactionParams
): Transaction {
  const { values, existing } = params;

  if (values.entryType === "transfer") {
    throw new Error("transfer entries must use the transfer factory");
  }

  const amountAbsCents = parseAmountInputToCents(values.amount);

  if (amountAbsCents == null || amountAbsCents <= 0) {
    throw new Error("amount must be a positive number");
  }

  const now = getNowIso();
  const amountCents =
    values.entryType === "income"
      ? Math.abs(amountAbsCents)
      : -Math.abs(amountAbsCents);
  const splits = values.isSplit ? createTransactionSplits(values, amountCents) : undefined;

  return {
    id: existing?.id ?? makeId("txn"),
    kind: "standard",
    date: values.date,
    amountCents,
    accountId: values.accountId,
    categoryId: splits ? undefined : values.categoryId,
    splits,
    merchant: values.merchant.trim() || undefined,
    note: values.note.trim() || undefined,
    source: existing?.source ?? "manual",
    recurringRuleId: existing?.recurringRuleId,
    transferGroupId: undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function createTransactionFromExpectedOccurrence(
  occurrence: ExpectedOccurrence
): Transaction {
  if (occurrence.kind !== "standard") {
    throw new Error("transfer expected occurrences must use the transfer factory");
  }

  const now = getNowIso();

  return {
    id: makeId("txn"),
    kind: "standard",
    date: occurrence.date,
    amountCents: occurrence.amountCents,
    accountId: occurrence.accountId,
    categoryId: occurrence.categoryId,
    merchant: occurrence.merchant,
    note: occurrence.note,
    source: "recurring",
    recurringRuleId: occurrence.recurringRuleId,
    transferGroupId: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function createTransferInput(
  values: TransactionFormValues
): TransferFormInput {
  const amountCents = parseAmountInputToCents(values.amount);

  if (amountCents == null || amountCents <= 0) {
    throw new Error("amount must be a positive number");
  }

  if (!values.fromAccountId) {
    throw new Error("from account is required");
  }

  if (!values.toAccountId) {
    throw new Error("to account is required");
  }

  if (values.fromAccountId === values.toAccountId) {
    throw new Error("from and to accounts must be different");
  }

  return {
    date: values.date,
    fromAccountId: values.fromAccountId,
    toAccountId: values.toAccountId,
    amountCents: Math.abs(amountCents),
    note: values.note.trim() || undefined,
  };
}

export function createTransferTransactions(
  params: CreateTransferTransactionsParams
): [Transaction, Transaction] {
  const { input, existing, metadata } = params;

  if (input.amountCents <= 0 || !Number.isInteger(input.amountCents)) {
    throw new Error("amount must be a positive number");
  }

  if (input.fromAccountId === input.toAccountId) {
    throw new Error("from and to accounts must be different");
  }

  const now = getNowIso();
  const transferGroupId = existing?.transferGroupId ?? makeId("transfer");
  const source = metadata?.source ?? "manual";

  return [
    {
      id: existing?.fromTransaction?.id ?? makeId("txn"),
      kind: "transfer",
      date: input.date,
      amountCents: -Math.abs(input.amountCents),
      accountId: input.fromAccountId,
      note: input.note,
      source,
      recurringRuleId: metadata?.recurringRuleId,
      transferGroupId,
      createdAt: existing?.fromTransaction?.createdAt ?? now,
      updatedAt: now,
    },
    {
      id: existing?.toTransaction?.id ?? makeId("txn"),
      kind: "transfer",
      date: input.date,
      amountCents: Math.abs(input.amountCents),
      accountId: input.toAccountId,
      note: input.note,
      source,
      recurringRuleId: metadata?.recurringRuleId,
      transferGroupId,
      createdAt: existing?.toTransaction?.createdAt ?? now,
      updatedAt: now,
    },
  ];
}

export function createOpeningBalanceTransaction(
  params: CreateOpeningBalanceTransactionParams
): Transaction {
  const { accountId, amountCents, date, note, existing } = params;

  if (!Number.isInteger(amountCents) || amountCents === 0) {
    throw new Error("amount must be a non-zero integer number of cents");
  }

  const now = getNowIso();

  return {
    id: existing?.id ?? makeId("txn"),
    kind: "opening-balance",
    date,
    amountCents,
    accountId,
    note: note?.trim() || undefined,
    source: "manual",
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
    creditLimitCents:
      params.type === "credit" ? params.creditLimitCents : undefined,
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
  const kind: RecurringRuleKind = params.kind ?? "standard";

  return {
    id: makeId("rule"),
    kind,
    name: params.name.trim(),
    amountCents:
      kind === "transfer"
        ? Math.abs(params.amountCents)
        : params.amountCents,
    accountId: params.accountId,
    toAccountId: kind === "transfer" ? params.toAccountId : undefined,
    categoryId: kind === "standard" ? params.categoryId : undefined,
    merchant:
      kind === "standard" ? params.merchant?.trim() || undefined : undefined,
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