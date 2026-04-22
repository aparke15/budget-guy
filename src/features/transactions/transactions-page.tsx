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
        <div className="page-header-copy">
          <h1 className="page-title">transactions</h1>
          <p className="page-subtitle">ledger first. glamour later.</p>
        </div>

        <div className="page-actions">
          <label className="field">
            <span className="field-label">month</span>
            <input
              type="month"
              value={filters.month}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  month: event.target.value,
                }))
              }
              className="control control--compact"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setShowCreateForm((current) => !current);
              setEditingId(null);
            }}
            className="button button--primary"
          >
            {showCreateForm ? "hide form" : "add transaction"}
          </button>
        </div>
      </div>

      {showCreateForm ? (
        <div className="section">
          <div className="section-heading">
            <h2 className="section-title">new transaction</h2>
          </div>

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
        <div className="section">
          <div className="section-heading">
            <h2 className="section-title">edit transaction</h2>
          </div>

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

      <div className="section">
        <div className="section-header">
          <div className="section-heading">
            <h2 className="section-title">ledger</h2>
            <p className="section-subtitle">
              {filteredTransactions.length} transaction
              {filteredTransactions.length === 1 ? "" : "s"} in {filters.month}
              {hasActiveFilters ? " matching current filters" : ""}
            </p>
          </div>
        </div>

        <div className="filter-grid">
          <label className="field">
            <span className="field-label">account</span>
            <select
              value={filters.accountId ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  accountId: event.target.value || null,
                }))
              }
              className="control"
            >
              <option value="">all accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">category</span>
            <select
              value={filters.categoryId ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  categoryId: event.target.value || null,
                }))
              }
              className="control"
            >
              <option value="">all categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">search</span>
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
              className="control"
            />
          </label>

          <div className="toolbar-actions">
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
              className="button button--secondary"
            >
              clear filters
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>date</th>
                <th>details</th>
                <th>category</th>
                <th>account</th>
                <th>source</th>
                <th>amount</th>
                <th>note</th>
                <th className="cell-actions">actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>
                    {row.type === "transfer"
                      ? `${row.fromAccountName} → ${row.toAccountName}`
                      : row.type === "opening-balance"
                        ? "opening balance"
                        : row.merchant ?? "—"}
                  </td>
                  <td>
                    {row.type === "transfer"
                      ? "transfer"
                      : row.type === "opening-balance"
                        ? "—"
                        : categoryMap.get(row.categoryId) ?? "unknown"}
                  </td>
                  <td>{row.type === "transfer" ? "—" : row.accountName}</td>
                  <td>{row.source}</td>
                  <td
                    className={`cell-amount ${
                      row.type === "transfer"
                        ? "text-info"
                        : row.amountCents >= 0
                          ? "text-positive"
                          : "text-negative"
                    }`}
                  >
                    {formatCents(row.amountCents)}
                  </td>
                  <td>{row.note ?? "—"}</td>
                  <td className="cell-actions">
                    {row.type === "opening-balance" ? (
                      <span className="inline-note">edit in settings</span>
                    ) : (
                      <div className="action-group">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(row.id);
                            setShowCreateForm(false);
                          }}
                          className="button button--secondary button--small"
                        >
                          edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          className="button button--danger button--small"
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
                  <td colSpan={8} className="text-muted">
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
