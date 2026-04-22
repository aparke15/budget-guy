import { getMonthKey } from "../../lib/dates";
import type { Account, Transaction } from "../../types";

export type TransactionFilters = {
  month: string;
  accountId: string | null;
  categoryId: string | null;
  search: string;
};

export type TransactionListRow =
  | {
      type: "standard";
      id: string;
      date: string;
      amountCents: number;
      accountId: string;
      accountName: string;
      categoryId: string;
      merchant?: string;
      note?: string;
      source: Transaction["source"];
      transaction: Transaction;
    }
  | {
      type: "opening-balance";
      id: string;
      date: string;
      amountCents: number;
      accountId: string;
      accountName: string;
      note?: string;
      source: "manual";
      transaction: Transaction;
    }
  | {
      type: "transfer";
      id: string;
      date: string;
      amountCents: number;
      fromAccountId: string;
      fromAccountName: string;
      toAccountId: string;
      toAccountName: string;
      note?: string;
      source: "manual";
      transferGroupId: string;
      transactions: [Transaction, Transaction];
    };

export function buildTransactionListRows(
  transactions: Transaction[],
  accounts: Account[]
): TransactionListRow[] {
  const accountMap = new Map(accounts.map((account) => [account.id, account.name]));
  const transferGroupMap = transactions.reduce<Map<string, Transaction[]>>(
    (groups, transaction) => {
      if (transaction.kind !== "transfer" || !transaction.transferGroupId) {
        return groups;
      }

      const group = groups.get(transaction.transferGroupId) ?? [];
      group.push(transaction);
      groups.set(transaction.transferGroupId, group);
      return groups;
    },
    new Map()
  );
  const seenTransferGroups = new Set<string>();

  return transactions.flatMap<TransactionListRow>((transaction) => {
    if (transaction.kind === "standard") {
      return [
        {
          type: "standard",
          id: transaction.id,
          date: transaction.date,
          amountCents: transaction.amountCents,
          accountId: transaction.accountId,
          accountName: accountMap.get(transaction.accountId) ?? "unknown",
          categoryId: transaction.categoryId ?? "",
          merchant: transaction.merchant,
          note: transaction.note,
          source: transaction.source,
          transaction,
        },
      ];
    }

    if (transaction.kind === "opening-balance") {
      return [
        {
          type: "opening-balance",
          id: transaction.id,
          date: transaction.date,
          amountCents: transaction.amountCents,
          accountId: transaction.accountId,
          accountName: accountMap.get(transaction.accountId) ?? "unknown",
          note: transaction.note,
          source: "manual",
          transaction,
        },
      ];
    }

    if (!transaction.transferGroupId || seenTransferGroups.has(transaction.transferGroupId)) {
      return [];
    }

    seenTransferGroups.add(transaction.transferGroupId);

    const pair = transferGroupMap.get(transaction.transferGroupId) ?? [transaction];
    const fromTransaction =
      pair.find((item) => item.amountCents < 0) ?? transaction;
    const toTransaction =
      pair.find((item) => item.amountCents > 0) ?? pair.find((item) => item.id !== fromTransaction.id) ?? transaction;

    return [
      {
        type: "transfer",
        id: transaction.transferGroupId,
        date: fromTransaction.date,
        amountCents: Math.abs(fromTransaction.amountCents),
        fromAccountId: fromTransaction.accountId,
        fromAccountName: accountMap.get(fromTransaction.accountId) ?? "unknown",
        toAccountId: toTransaction.accountId,
        toAccountName: accountMap.get(toTransaction.accountId) ?? "unknown",
        note: fromTransaction.note ?? toTransaction.note,
        source: "manual",
        transferGroupId: transaction.transferGroupId,
        transactions: [fromTransaction, toTransaction],
      },
    ];
  });
}

export function filterTransactionRows(
  rows: TransactionListRow[],
  filters: TransactionFilters
): TransactionListRow[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (getMonthKey(row.date) !== filters.month) {
      return false;
    }

    if (filters.accountId) {
      if (row.type === "standard" && row.accountId !== filters.accountId) {
        return false;
      }

      if (
        row.type === "opening-balance" &&
        row.accountId !== filters.accountId
      ) {
        return false;
      }

      if (
        row.type === "transfer" &&
        row.fromAccountId !== filters.accountId &&
        row.toAccountId !== filters.accountId
      ) {
        return false;
      }
    }

    if (filters.categoryId) {
      if (row.type !== "standard") {
        return false;
      }

      if (row.categoryId !== filters.categoryId) {
        return false;
      }
    }

    if (!normalizedSearch) {
      return true;
    }

    if (row.type === "standard") {
      const merchant = row.merchant?.toLowerCase() ?? "";
      const note = row.note?.toLowerCase() ?? "";

      return (
        merchant.includes(normalizedSearch) || note.includes(normalizedSearch)
      );
    }

    if (row.type === "opening-balance") {
      const note = row.note?.toLowerCase() ?? "";
      const accountName = row.accountName.toLowerCase();

      return (
        note.includes(normalizedSearch) ||
        accountName.includes(normalizedSearch) ||
        "opening balance".includes(normalizedSearch)
      );
    }

    const note = row.note?.toLowerCase() ?? "";
    const fromAccountName = row.fromAccountName.toLowerCase();
    const toAccountName = row.toAccountName.toLowerCase();

    return (
      note.includes(normalizedSearch) ||
      fromAccountName.includes(normalizedSearch) ||
      toAccountName.includes(normalizedSearch)
    );
  });
}

export function hasActiveTransactionFilters(
  filters: TransactionFilters
): boolean {
  return (
    filters.accountId !== null ||
    filters.categoryId !== null ||
    filters.search.trim() !== ""
  );
}