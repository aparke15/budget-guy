import { formatSignedCentsForInput, parseAmountInputToCents } from "../../lib/money";
import { countTransactionsReferencingCategory } from "../../lib/transaction-splits";
import type { AccountFormValues } from "../types";
import type { Account, Budget, RecurringRule, Transaction } from "../../types";

export type PendingDelete =
  | {
      entity: "account";
      id: string;
      name: string;
    }
  | {
      entity: "category";
      id: string;
      name: string;
    }
  | {
      entity: "rule";
      id: string;
      name: string;
    };

export type DeleteImpact = {
  title: string;
  description: string;
};

export function normalizeEntityName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function buildDuplicateName(name: string, existingNames: string[]): string {
  const trimmedName = name.trim();
  const normalizedNames = new Set(existingNames.map(normalizeEntityName));

  let copyIndex = 1;

  while (true) {
    const candidate = copyIndex === 1 ? `${trimmedName} copy` : `${trimmedName} copy ${copyIndex}`;

    if (!normalizedNames.has(normalizeEntityName(candidate))) {
      return candidate;
    }

    copyIndex += 1;
  }
}

export function sortItemsByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

export function countById<T>(
  items: T[],
  getId: (item: T) => string | undefined
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const id = getId(item);

    if (!id) {
      return acc;
    }

    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
}

export function countRecurringRulesByAccountId(
  recurringRules: RecurringRule[]
): Record<string, number> {
  return recurringRules.reduce<Record<string, number>>((acc, rule) => {
    acc[rule.accountId] = (acc[rule.accountId] ?? 0) + 1;

    if (rule.kind === "transfer" && rule.toAccountId) {
      acc[rule.toAccountId] = (acc[rule.toAccountId] ?? 0) + 1;
    }

    return acc;
  }, {});
}

export function getTodayDateInputValue(today = new Date()): string {
  return today.toISOString().slice(0, 10);
}

export function getAccountOpeningBalanceTransaction(
  transactions: Transaction[],
  accountId: string
): Transaction | undefined {
  return transactions.find(
    (transaction) =>
      transaction.accountId === accountId &&
      transaction.kind === "opening-balance"
  );
}

export function normalizeAccountOpeningBalanceCents(
  accountType: Account["type"],
  amountCents: number
): number {
  return accountType === "credit" ? -Math.abs(amountCents) : amountCents;
}

export function getAccountOpeningBalanceFormValueCents(
  accountType: Account["type"],
  amountCents: number
): number {
  return accountType === "credit" ? Math.abs(amountCents) : amountCents;
}

export function createAccountFormValues(
  account?: Account,
  openingBalanceTransaction?: Transaction,
  today = getTodayDateInputValue()
): AccountFormValues {
  return {
    name: account?.name ?? "",
    type: account?.type ?? "checking",
    creditLimit:
      account?.type === "credit" && account.creditLimitCents != null
        ? formatSignedCentsForInput(account.creditLimitCents)
        : "",
    openingBalance: openingBalanceTransaction
      ? formatSignedCentsForInput(
          getAccountOpeningBalanceFormValueCents(
            account?.type ?? "checking",
            openingBalanceTransaction.amountCents
          )
        )
      : "",
    openingBalanceDate: openingBalanceTransaction?.date ?? today,
  };
}

export function parseAccountCreditLimitInput(amount: string): {
  hasValue: boolean;
  amountCents: number | null;
} {
  const trimmed = amount.trim();

  if (!trimmed) {
    return {
      hasValue: false,
      amountCents: null,
    };
  }

  const amountCents = parseAmountInputToCents(trimmed);

  return {
    hasValue: true,
    amountCents,
  };
}

export function parseAccountOpeningBalanceInput(amount: string): {
  hasValue: boolean;
  amountCents: number | null;
} {
  const trimmed = amount.trim();

  if (!trimmed) {
    return {
      hasValue: false,
      amountCents: null,
    };
  }

  return {
    hasValue: true,
    amountCents: parseAmountInputToCents(trimmed),
  };
}

export function buildDeleteImpact(
  pendingDelete: PendingDelete | null,
  budgets: Budget[],
  transactions: Transaction[],
  recurringRules: RecurringRule[]
): DeleteImpact | null {
  if (!pendingDelete) {
    return null;
  }

  if (pendingDelete.entity === "account") {
    const transactionCount = transactions.filter(
      (transaction) => transaction.accountId === pendingDelete.id
    ).length;
    const ruleCount = recurringRules.filter(
      (rule) =>
        rule.accountId === pendingDelete.id || rule.toAccountId === pendingDelete.id
    ).length;

    return {
      title: `delete account: ${pendingDelete.name}`,
      description: `this will remove ${transactionCount} transaction${transactionCount === 1 ? "" : "s"} and ${ruleCount} recurring rule${ruleCount === 1 ? "" : "s"}.`,
    };
  }

  if (pendingDelete.entity === "category") {
    const budgetCount = budgets.filter(
      (budget) => budget.categoryId === pendingDelete.id
    ).length;
    const transactionCount = countTransactionsReferencingCategory(
      transactions,
      pendingDelete.id
    );
    const ruleCount = recurringRules.filter(
      (rule) => rule.categoryId === pendingDelete.id
    ).length;

    return {
      title: `archive category: ${pendingDelete.name}`,
      description: `this keeps ${transactionCount} transaction${transactionCount === 1 ? "" : "s"}, ${budgetCount} budget${budgetCount === 1 ? "" : "s"}, and ${ruleCount} recurring rule${ruleCount === 1 ? "" : "s"} in history, but removes the category from new-use pickers until restored.`,
    };
  }

  const generatedCount = transactions.filter(
    (transaction) => transaction.recurringRuleId === pendingDelete.id
  ).length;

  return {
    title: `delete recurring rule: ${pendingDelete.name}`,
    description: `this removes the rule only. ${generatedCount} previously generated transaction${generatedCount === 1 ? " will" : "s will"} stay in history.`,
  };
}