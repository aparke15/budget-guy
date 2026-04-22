import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import type { TransactionFormSubmission } from "../types";
import { TransactionForm } from "./transaction-form";
import {
  buildTransactionListRows,
  filterTransactionRows,
  hasActiveTransactionFilters,
  type TransactionListRow,
  type TransactionFilters,
} from "./transaction-filters";

export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({
    month: getCurrentMonth(),
    accountId: null,
    categoryId: null,
    search: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const transactions = useAppStore((state) => state.transactions);
  const categories = useAppStore((state) => state.categories);
  const accounts = useAppStore((state) => state.accounts);
  const addTransaction = useAppStore((state) => state.addTransaction);
  const updateTransaction = useAppStore((state) => state.updateTransaction);
  const deleteTransaction = useAppStore((state) => state.deleteTransaction);
  const addTransfer = useAppStore((state) => state.addTransfer);
  const updateTransfer = useAppStore((state) => state.updateTransfer);
  const deleteTransfer = useAppStore((state) => state.deleteTransfer);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const transactionRows = useMemo(
    () => buildTransactionListRows(transactions, accounts),
    [accounts, transactions]
  );

  const filteredTransactions = useMemo(
    () => filterTransactionRows(transactionRows, filters),
    [filters, transactionRows]
  );

  const hasActiveFilters = useMemo(
    () => hasActiveTransactionFilters(filters),
    [filters]
  );

  const editingTransaction = useMemo<TransactionListRow | undefined>(
    () =>
      editingId ? transactionRows.find((row) => row.id === editingId) : undefined,
    [editingId, transactionRows]
  );

  function handleCreate(submission: TransactionFormSubmission) {
    if (submission.mode === "transfer") {
      addTransfer(submission.input);
    } else {
      addTransaction(submission.transaction);
    }

    setShowCreateForm(false);
  }

  function handleUpdate(submission: TransactionFormSubmission) {
    if (submission.mode === "transfer") {
      const transferGroupId =
        submission.transferGroupId ??
        (editingTransaction?.type === "transfer"
          ? editingTransaction.transferGroupId
          : undefined);

      if (transferGroupId) {
        updateTransfer(transferGroupId, submission.input);
      }
    } else {
      updateTransaction(submission.transaction.id, submission.transaction);
    }

    setEditingId(null);
  }

  function handleDelete(row: TransactionListRow) {
    if (row.type === "opening-balance") {
      return;
    }

    const ok = window.confirm(
      row.type === "transfer"
        ? `delete transfer for ${row.date} (${formatCents(row.amountCents)})?`
        : `delete transaction for ${row.date} (${formatCents(row.amountCents)})?`
    );

    if (!ok) {
      return;
    }

    if (row.type === "transfer") {
      deleteTransfer(row.transferGroupId);
    } else {
      deleteTransaction(row.transaction.id);
    }

    if (editingId === row.id) {
      setEditingId(null);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>transactions</h1>
          <p>ledger first. glamour later.</p>
        </div>

        <div className="page-actions">
          <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.9rem", color: "#374151" }}>
            month
            <input
              type="month"
              value={filters.month}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  month: event.target.value,
                }))
              }
              style={{ padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", background: "#ffffff" }}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setShowCreateForm((current) => !current);
              setEditingId(null);
            }}
            style={{ padding: "0.7rem 0.95rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", background: "#111827", color: "#ffffff", cursor: "pointer" }}
          >
            {showCreateForm ? "hide form" : "add transaction"}
          </button>
        </div>
      </div>

      {showCreateForm ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
            new transaction
          </h2>

          <TransactionForm
            accounts={accounts}
            categories={categories}
            submitLabel="save transaction"
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      ) : null}

      {editingTransaction ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
            edit transaction
          </h2>

          <TransactionForm
            accounts={accounts}
            categories={categories}
            initialState={
              editingTransaction?.type === "transfer"
                ? {
                    mode: "transfer",
                    transferGroupId: editingTransaction.transferGroupId,
                    date: editingTransaction.date,
                    fromAccountId: editingTransaction.fromAccountId,
                    toAccountId: editingTransaction.toAccountId,
                    amountCents: editingTransaction.amountCents,
                    note: editingTransaction.note,
                  }
                : editingTransaction?.type === "standard"
                  ? {
                      mode: "standard",
                      transaction: editingTransaction.transaction,
                    }
                  : undefined
            }
            submitLabel="update transaction"
            onSubmit={handleUpdate}
            onCancel={() => setEditingId(null)}
          />
        </div>
      ) : null}

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
        }}
      >
        <div style={{ marginBottom: "0.9rem", color: "#6b7280" }}>
          {filteredTransactions.length} transaction
          {filteredTransactions.length === 1 ? "" : "s"} in {filters.month}
          {hasActiveFilters ? " matching current filters" : ""}
        </div>

        <div
          style={{
            display: "grid",
            gap: "0.9rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginBottom: "1rem",
          }}
        >
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.9rem", color: "#374151" }}>
              account
            </span>
            <select
              value={filters.accountId ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  accountId: event.target.value || null,
                }))
              }
              style={{
                padding: "0.55rem 0.7rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                background: "#ffffff",
              }}
            >
              <option value="">all accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.9rem", color: "#374151" }}>
              category
            </span>
            <select
              value={filters.categoryId ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  categoryId: event.target.value || null,
                }))
              }
              style={{
                padding: "0.55rem 0.7rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                background: "#ffffff",
              }}
            >
              <option value="">all categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.9rem", color: "#374151" }}>
              search
            </span>
            <input
              type="text"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="merchant or note"
              style={{
                padding: "0.55rem 0.7rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                background: "#ffffff",
              }}
            />
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "end",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  accountId: null,
                  categoryId: null,
                  search: "",
                }))
              }
              disabled={!hasActiveFilters}
              style={{
                padding: "0.7rem 0.95rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#111827",
                cursor: hasActiveFilters ? "pointer" : "not-allowed",
                opacity: hasActiveFilters ? 1 : 0.6,
              }}
            >
              clear filters
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <th style={{ padding: "0.65rem 0.5rem" }}>date</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>details</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>category</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>account</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>source</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>amount</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>note</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.65rem 0.5rem" }}>{row.date}</td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {row.type === "transfer"
                      ? `${row.fromAccountName} → ${row.toAccountName}`
                      : row.type === "opening-balance"
                        ? "opening balance"
                        : row.merchant ?? "—"}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {row.type === "transfer"
                      ? "transfer"
                      : row.type === "opening-balance"
                        ? "—"
                        : categoryMap.get(row.categoryId) ?? "unknown"}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {row.type === "transfer" ? "—" : row.accountName}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>{row.source}</td>
                  <td
                    style={{
                      padding: "0.65rem 0.5rem",
                      color:
                        row.type === "transfer"
                          ? "#1d4ed8"
                          : row.amountCents >= 0
                            ? "#166534"
                            : "#991b1b",
                      fontWeight: 600,
                    }}
                  >
                    {formatCents(
                      row.type === "transfer"
                        ? row.amountCents
                        : row.amountCents
                    )}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {row.note ?? "—"}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {row.type === "opening-balance" ? (
                      <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                        edit in settings
                      </span>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(row.id);
                            setShowCreateForm(false);
                          }}
                          style={{
                            padding: "0.45rem 0.65rem",
                            borderRadius: "0.45rem",
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            cursor: "pointer",
                          }}
                        >
                          edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          style={{
                            padding: "0.45rem 0.65rem",
                            borderRadius: "0.45rem",
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#991b1b",
                            cursor: "pointer",
                          }}
                        >
                          delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: "1rem 0.5rem",
                      color: "#6b7280",
                    }}
                  >
                    {hasActiveFilters
                      ? "no transactions match the current filters for this month. try clearing filters."
                      : "no transactions for this month yet. suspiciously peaceful."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}