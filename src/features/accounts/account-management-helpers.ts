import { formatSignedCentsForInput, parseAmountInputToCents } from "../../lib/money";
import type { AccountFormValues } from "../types";
import type { Account, Transaction } from "../../types";

function getTodayDateInputValue(today = new Date()): string {
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
      ? formatSignedCentsForInput(openingBalanceTransaction.amountCents)
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
