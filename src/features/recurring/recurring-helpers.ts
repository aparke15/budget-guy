import {
  createRecurringRule,
  getDefaultRecurringTransferAccountId,
} from "../../lib/factories";
import {
  getActiveCategories,
  getSelectableCategories,
} from "../../lib/categories";
import { formatCentsForInput, parseAmountInputToCents } from "../../lib/money";
import { recurringRuleSchema } from "../../lib/validation";
import type {
  Account,
  Category,
  RecurringFrequency,
  RecurringRule,
  RecurringRuleKind,
} from "../../types";
import type { RecurringRuleFormValues } from "../types";

function getDefaultAccountId(accounts: Account[]): string {
  return accounts[0]?.id ?? "";
}

function getDefaultCategoryId(categories: Category[]): string {
  const activeCategories = getActiveCategories(categories);

  return (
    activeCategories.find((category) => category.kind === "expense")?.id ??
    activeCategories[0]?.id ??
    ""
  );
}

function getDayOfMonthFromDate(date: string): string {
  if (!date) {
    return "1";
  }

  return String(Number(date.slice(8, 10)) || 1);
}

function getDayOfWeekFromDate(date: string): string {
  if (!date) {
    return "0";
  }

  const parsed = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "0";
  }

  return String(parsed.getDay());
}



function getWeekdayLabel(dayOfWeek?: number): string {
  switch (dayOfWeek) {
    case 0:
      return "sun";
    case 1:
      return "mon";
    case 2:
      return "tue";
    case 3:
      return "wed";
    case 4:
      return "thu";
    case 5:
      return "fri";
    case 6:
      return "sat";
    default:
      return "n/a";
  }
}

export function getRecurringDetails(rule: RecurringRule): string {
  if (rule.frequency === "monthly") {
    return `monthly on day ${rule.dayOfMonth ?? "?"}`;
  }

  if (rule.frequency === "yearly") {
    return `yearly on ${rule.startDate.slice(5)}`;
  }

  return `${rule.frequency} on ${getWeekdayLabel(rule.dayOfWeek)}`;
}

export function createRecurringRuleFormValues(
  accounts: Account[],
  categories: Category[],
  existing?: RecurringRule
): RecurringRuleFormValues {
  if (existing) {
    return {
      kind: existing.kind,
      name: existing.name,
      amount: formatCentsForInput(Math.abs(existing.amountCents)),
      accountId: existing.accountId,
      toAccountId:
        existing.toAccountId ??
        getDefaultRecurringTransferAccountId(accounts, existing.accountId),
      categoryId: existing.categoryId ?? getDefaultCategoryId(categories),
      frequency: existing.frequency,
      startDate: existing.startDate,
      endDate: existing.endDate ?? "",
      active: existing.active,
      dayOfMonth: existing.dayOfMonth != null ? String(existing.dayOfMonth) : "",
      dayOfWeek: existing.dayOfWeek != null ? String(existing.dayOfWeek) : "",
      merchant: existing.merchant ?? "",
      note: existing.note ?? "",
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  return {
    kind: "standard",
    name: "",
    amount: "",
    accountId: getDefaultAccountId(accounts),
    toAccountId: getDefaultRecurringTransferAccountId(
      accounts,
      getDefaultAccountId(accounts)
    ),
    categoryId: getDefaultCategoryId(categories),
    frequency: "monthly",
    startDate: today,
    endDate: "",
    active: true,
    dayOfMonth: getDayOfMonthFromDate(today),
    dayOfWeek: getDayOfWeekFromDate(today),
    merchant: "",
    note: "",
  };
}

export function ensureRecurringFormReferences(
  values: RecurringRuleFormValues,
  accounts: Account[],
  categories: Category[]
): RecurringRuleFormValues {
  const selectableCategories = getSelectableCategories(categories, {
    includeCategoryId: values.categoryId,
  });
  const nextAccountId =
    accounts.some((account) => account.id === values.accountId)
      ? values.accountId
      : getDefaultAccountId(accounts);
  const nextToAccountId =
    accounts.some((account) => account.id === values.toAccountId)
      ? values.toAccountId
      : getDefaultRecurringTransferAccountId(accounts, nextAccountId);
  const nextCategoryId =
    selectableCategories.some((category) => category.id === values.categoryId)
      ? values.categoryId
      : getDefaultCategoryId(categories);

  return {
    ...values,
    accountId: nextAccountId,
    toAccountId: nextToAccountId,
    categoryId: nextCategoryId,
  };
}

export function updateRecurringKind(
  values: RecurringRuleFormValues,
  kind: RecurringRuleKind,
  accounts: Account[],
  categories: Category[]
): RecurringRuleFormValues {
  const nextAccountId = values.accountId || getDefaultAccountId(accounts);
  const selectableCategories = getSelectableCategories(categories, {
    includeCategoryId: values.categoryId,
  });

  return {
    ...values,
    kind,
    toAccountId:
      kind === "transfer"
        ? values.toAccountId ||
          getDefaultRecurringTransferAccountId(accounts, nextAccountId)
        : values.toAccountId,
    categoryId:
      kind === "standard"
        ? values.categoryId || getDefaultCategoryId(selectableCategories)
        : values.categoryId,
    merchant: kind === "transfer" ? "" : values.merchant,
  };
}

export function updateRecurringFrequency(
  values: RecurringRuleFormValues,
  frequency: RecurringFrequency
): RecurringRuleFormValues {
  if (frequency === "yearly") {
    return {
      ...values,
      frequency,
      dayOfMonth: "",
      dayOfWeek: "",
    };
  }

  if (frequency === "monthly") {
    return {
      ...values,
      frequency,
      dayOfMonth: values.dayOfMonth || getDayOfMonthFromDate(values.startDate),
      dayOfWeek: "",
    };
  }

  return {
    ...values,
    frequency,
    dayOfMonth: "",
    dayOfWeek: values.dayOfWeek || getDayOfWeekFromDate(values.startDate),
  };
}

export function updateRecurringStartDate(
  values: RecurringRuleFormValues,
  startDate: string
): RecurringRuleFormValues {
  if (values.frequency === "yearly") {
    return {
      ...values,
      startDate,
    };
  }

  if (values.frequency === "monthly") {
    return {
      ...values,
      startDate,
      dayOfMonth: values.dayOfMonth || getDayOfMonthFromDate(startDate),
    };
  }

  return {
    ...values,
    startDate,
    dayOfWeek: values.dayOfWeek || getDayOfWeekFromDate(startDate),
  };
}

export function buildRecurringRuleCandidate(
  values: RecurringRuleFormValues,
  categories: Category[],
  existing?: RecurringRule
): RecurringRule {
  if (!values.name.trim()) {
    throw new Error("name is required");
  }

  if (!values.accountId) {
    throw new Error("account is required");
  }

  if (values.kind === "standard" && !values.categoryId) {
    throw new Error("category is required");
  }

  if (values.kind === "transfer" && !values.toAccountId) {
    throw new Error("to account is required");
  }

  if (values.kind === "transfer" && values.accountId === values.toAccountId) {
    throw new Error("from and to accounts must be different");
  }

  if (!values.startDate) {
    throw new Error("start date is required");
  }

  const amountAbsCents = parseAmountInputToCents(values.amount);

  if (amountAbsCents == null || amountAbsCents <= 0) {
    throw new Error("amount must be a positive number");
  }

  const selectedCategory =
    values.kind === "standard"
      ? categories.find((category) => category.id === values.categoryId)
      : undefined;

  if (values.kind === "standard" && !selectedCategory) {
    throw new Error("category is required");
  }

  const amountCents =
    values.kind === "transfer"
      ? Math.abs(amountAbsCents)
      : selectedCategory?.kind === "income"
        ? Math.abs(amountAbsCents)
        : -Math.abs(amountAbsCents);

  const dayOfMonth =
    values.frequency === "monthly" && values.dayOfMonth.trim()
      ? Number(values.dayOfMonth)
      : undefined;
  const dayOfWeek =
    (values.frequency === "weekly" || values.frequency === "biweekly") &&
    values.dayOfWeek.trim()
      ? Number(values.dayOfWeek)
      : undefined;
  const payload = {
    name: values.name.trim(),
    amountCents,
    accountId: values.accountId,
    frequency: values.frequency,
    startDate: values.startDate,
    endDate: values.endDate.trim() || undefined,
    active: values.active,
    dayOfMonth,
    dayOfWeek,
    note: values.note,
  };
  const candidate = existing
    ? {
      ...existing,
      ...payload,
      kind: values.kind,
      toAccountId:
        values.kind === "transfer" ? values.toAccountId : undefined,
      categoryId: values.kind === "standard" ? values.categoryId : undefined,
      merchant:
        values.kind === "standard" ? values.merchant.trim() || undefined : undefined,
      note: payload.note.trim() || undefined,
    }
    : values.kind === "transfer"
      ? createRecurringRule({
          ...payload,
          kind: "transfer",
          toAccountId: values.toAccountId,
        })
      : createRecurringRule({
          ...payload,
          kind: "standard",
          categoryId: values.categoryId,
          merchant: values.merchant,
        });
  const parsed = recurringRuleSchema.safeParse(candidate);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "failed to save recurring rule");
  }

  return parsed.data;
}