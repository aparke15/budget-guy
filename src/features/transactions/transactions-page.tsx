import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import {
  compactDangerButtonStyle,
  compactSecondaryButtonStyle,
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "../components/style-constants";
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
        <div className="page-title-group">
          <h1 className="page-title">transactions</h1>
          <p className="page-subtitle">
            ledger first. glamour later.
          </p>
        </div>

        <div className="page-actions">
          <label className="field">
            <span className="field__label">month</span>
            <input
              type="month"
              value={filters.month}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  month: event.target.value,
                }))
              }
              style={inputStyle}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setShowCreateForm((current) => !current);
              setEditingId(null);
            }}
            style={primaryButtonStyle}
          >
            {showCreateForm ? "hide form" : "add transaction"}
          </button>
        </div>
      </div>

      {showCreateForm ? (
        <div className="section-card">
          <h2 className="section-title">new transaction</h2>

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
        <div className="section-card">
          <h2 className="section-title">edit transaction</h2>

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

      <div className="section-card">
        <div className="section-header">
          <div className="section-title-group">
            <h2 className="section-title">ledger</h2>
            <p className="section-subtitle">
          {filteredTransactions.length} transaction
          {filteredTransactions.length === 1 ? "" : "s"} in {filters.month}
          {hasActiveFilters ? " matching current filters" : ""}
            </p>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: "1rem" }}>
          <label className="field">
            <span className="field__label">account</span>
            <select
              value={filters.accountId ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  accountId: event.target.value || null,
                }))
              }
              style={inputStyle}
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
            <span className="field__label">category</span>
            <select
              value={filters.categoryId ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  categoryId: event.target.value || null,
                }))
              }
              style={inputStyle}
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
            <span className="field__label">search</span>
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
              style={inputStyle}
            />
          </label>

          <div className="button-row" style={{ alignItems: "end" }}>
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
                ...secondaryButtonStyle,
                cursor: hasActiveFilters ? "pointer" : "not-allowed",
                opacity: hasActiveFilters ? 1 : 0.6,
              }}
            >
              clear filters
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>date</th>
                <th>details</th>
                <th>category</th>
                <th>account</th>
                <th>badges</th>
                <th>amount</th>
                <th>note</th>
                <th>actions</th>
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
                  <td>
                    <div className="badge-row">
                      <span
                        className={
                          row.type === "transfer"
                            ? "badge badge--transfer"
                            : row.type === "opening-balance"
                              ? "badge badge--opening"
                              : row.amountCents >= 0
                                ? "badge badge--income"
                                : "badge badge--expense"
                        }
                      >
                        {row.type === "transfer"
                          ? "transfer"
                          : row.type === "opening-balance"
                            ? "opening balance"
                            : row.amountCents >= 0
                              ? "income"
                              : "expense"}
                      </span>
                      <span
                        className={
                          row.source === "recurring"
                            ? "badge badge--recurring"
                            : "badge badge--neutral"
                        }
                      >
                        {row.source}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
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
                  <td>{row.note ?? "—"}</td>
                  <td>
                    {row.type === "opening-balance" ? (
                      <span className="badge badge--muted">
                        edit in accounts
                      </span>
                    ) : (
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(row.id);
                            setShowCreateForm(false);
                          }}
                          style={compactSecondaryButtonStyle}
                        >
                          edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          style={compactDangerButtonStyle}
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
                    style={{ padding: 0 }}
                  >
                    <p className="empty-state">
                      {hasActiveFilters
                        ? "no transactions match the current filters for this month. try clearing filters."
                        : "no transactions for this month yet. suspiciously peaceful."}
                    </p>
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