import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

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
import { RecurringManagementSection } from "../recurring/recurring-management-section";
import { TransactionForm } from "./transaction-form";
import {
  buildTransactionListRows,
  filterTransactionRows,
  hasActiveTransactionFilters,
  type TransactionListRow,
  type TransactionFilters,
} from "./transaction-filters";

type TransactionsTab = "activity" | "recurring";

function getTransactionsTab(value: string | null): TransactionsTab {
  return value === "recurring" ? "recurring" : "activity";
}

function getTransactionDetails(row: TransactionListRow) {
  if (row.type === "transfer") {
    return `${row.fromAccountName} → ${row.toAccountName}`;
  }

  if (row.type === "opening-balance") {
    return "opening balance";
  }

  return row.merchant ?? "—";
}

function getTransactionCategoryLabel(
  row: TransactionListRow,
  categoryMap: Map<string, string>
) {
  if (row.type === "transfer") {
    return "transfer";
  }

  if (row.type === "opening-balance") {
    return "opening balance";
  }

  return categoryMap.get(row.categoryId) ?? "unknown";
}

function getTransactionAccountLabel(row: TransactionListRow) {
  if (row.type === "transfer") {
    return `${row.fromAccountName} → ${row.toAccountName}`;
  }

  return row.accountName;
}

function getTransactionAmountClass(row: TransactionListRow) {
  if (row.type === "transfer") {
    return "text-info font-semibold";
  }

  return row.amountCents >= 0
    ? "text-positive font-semibold"
    : "text-negative font-semibold";
}

function getTransactionTypeBadgeClass(row: TransactionListRow) {
  if (row.type === "transfer") {
    return "badge badge--transfer";
  }

  if (row.type === "opening-balance") {
    return "badge badge--opening";
  }

  return row.amountCents >= 0 ? "badge badge--income" : "badge badge--expense";
}

function getTransactionTypeBadgeLabel(row: TransactionListRow) {
  if (row.type === "transfer") {
    return "transfer";
  }

  if (row.type === "opening-balance") {
    return "opening balance";
  }

  return row.amountCents >= 0 ? "income" : "expense";
}

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<TransactionFilters>({
    month: getCurrentMonth(),
    accountId: null,
    categoryId: null,
    search: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const editSectionRef = useRef<HTMLDivElement | null>(null);

  const activeTab = getTransactionsTab(searchParams.get("tab"));

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

  useEffect(() => {
    if (!editingTransaction || !editSectionRef.current) {
      return;
    }

    const top =
      editSectionRef.current.getBoundingClientRect().top + window.scrollY - 96;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  }, [editingTransaction]);

  function updateSearchParams(nextTab: TransactionsTab) {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set("tab", nextTab);
    nextParams.delete("rule");

    setSearchParams(nextParams, { replace: true });
  }

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

  function toggleExpandedTransaction(rowId: string) {
    setExpandedTransactionId((current) => (current === rowId ? null : rowId));
  }

  function startEditingTransaction(rowId: string) {
    setEditingId(rowId);
    setShowCreateForm(false);
    setExpandedTransactionId(null);
  }

  const emptyStateMessage = hasActiveFilters
    ? "no transactions match the current filters for this month. try clearing filters."
    : "no transactions for this month yet. suspiciously peaceful.";

  function renderTransactionBadges(row: TransactionListRow) {
    return (
      <div className="badge-row">
        <span className={getTransactionTypeBadgeClass(row)}>
          {getTransactionTypeBadgeLabel(row)}
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
    );
  }

  function renderTransactionActions(row: TransactionListRow) {
    if (row.type === "opening-balance") {
      return <span className="badge badge--muted">edit in accounts</span>;
    }

    return (
      <div className="table-actions transaction-card__actions">
        <button
          type="button"
          onClick={() => startEditingTransaction(row.id)}
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
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">transactions</h1>
          <p className="page-subtitle">
            activity and recurring now share the same neighborhood.
          </p>
        </div>
      </div>

      <div className="subview-switcher" role="tablist" aria-label="transactions views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "activity"}
          className={
            activeTab === "activity"
              ? "subview-switcher__button subview-switcher__button--active"
              : "subview-switcher__button"
          }
          onClick={() => updateSearchParams("activity")}
        >
          activity
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "recurring"}
          className={
            activeTab === "recurring"
              ? "subview-switcher__button subview-switcher__button--active"
              : "subview-switcher__button"
          }
          onClick={() => updateSearchParams("recurring")}
        >
          recurring
        </button>
      </div>


      {activeTab === "activity" ? (
        <>
          <div className="section-card section-card--surface">
            <div className="section-header">
              <div className="section-title-group">
                <h2 className="section-title">activity</h2>
                <p className="section-subtitle">
                  one-time transactions, transfers, filters, and concrete edits live here.
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
              <div className="stack-sm">
                <h3 className="section-title">new transaction</h3>

                <TransactionForm
                  accounts={accounts}
                  categories={categories}
                  submitLabel="save transaction"
                  onSubmit={handleCreate}
                  onCancel={() => setShowCreateForm(false)}
                />
              </div>
            ) : null}
          </div>

          {editingTransaction ? (
            <div ref={editSectionRef} className="section-card section-card--surface">
              <h2 className="section-title">edit transaction</h2>

              <TransactionForm
                accounts={accounts}
                categories={categories}
                initialState={
                  editingTransaction.type === "transfer"
                    ? {
                        mode: "transfer",
                        transferGroupId: editingTransaction.transferGroupId,
                        date: editingTransaction.date,
                        fromAccountId: editingTransaction.fromAccountId,
                        toAccountId: editingTransaction.toAccountId,
                        amountCents: editingTransaction.amountCents,
                        note: editingTransaction.note,
                      }
                    : editingTransaction.type === "standard"
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

          <div className="section-card section-card--surface">
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

            <div className="toolbar toolbar--spaced">
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

              <div className="button-row button-row--align-end">
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

            <div className="table-wrap transaction-ledger-table">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>date</th>
                    <th>details</th>
                    <th>category</th>
                    <th>account</th>
                    <th>badges</th>
                    <th className="money-column">amount</th>
                    <th>note</th>
                    <th>actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((row) => (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td>{getTransactionDetails(row)}</td>
                      <td>{getTransactionCategoryLabel(row, categoryMap)}</td>
                      <td>{row.type === "transfer" ? "—" : row.accountName}</td>
                      <td>{renderTransactionBadges(row)}</td>
                      <td className={`money-column ${getTransactionAmountClass(row)}`}>
                        {formatCents(row.amountCents)}
                      </td>
                      <td>{row.note ?? "—"}</td>
                      <td>{renderTransactionActions(row)}</td>
                    </tr>
                  ))}

                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="table-cell--flush">
                        <p className="empty-state">{emptyStateMessage}</p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="transaction-ledger-mobile" aria-label="transaction activity list">
              {filteredTransactions.length === 0 ? (
                <p className="empty-state">{emptyStateMessage}</p>
              ) : (
                filteredTransactions.map((row) => (
                  (() => {
                    const isExpanded = expandedTransactionId === row.id;

                    return (
                  <article
                    key={row.id}
                    className={
                      row.type === "transfer"
                        ? isExpanded
                          ? "transaction-card transaction-card--transfer transaction-card--expanded"
                          : "transaction-card transaction-card--transfer"
                        : row.type === "opening-balance"
                          ? isExpanded
                            ? "transaction-card transaction-card--opening transaction-card--expanded"
                            : "transaction-card transaction-card--opening"
                          : isExpanded
                            ? "transaction-card transaction-card--expanded"
                            : "transaction-card"
                    }
                  >
                    <button
                      type="button"
                      className="transaction-card__summary"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpandedTransaction(row.id)}
                    >
                      <div className="transaction-card__top">
                        <div className="transaction-card__details-group">
                          <div className="transaction-card__details">
                            {getTransactionDetails(row)}
                          </div>
                        </div>

                        <div className={`transaction-card__amount ${getTransactionAmountClass(row)}`}>
                          {formatCents(row.amountCents)}
                        </div>
                      </div>

                      <div className="transaction-card__summary-footer">
                        <div className="transaction-card__summary-meta">
                          <span className="transaction-card__date">{row.date}</span>
                          <span className="transaction-card__separator" aria-hidden="true">
                            ·
                          </span>
                          <span>{getTransactionAccountLabel(row)}</span>
                        </div>

                        <span className="transaction-card__chevron" aria-hidden="true">
                          {isExpanded ? "▴" : "▾"}
                        </span>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="transaction-card__expanded-details">
                        {row.type === "opening-balance" ? (
                          <span className="transaction-card__eyebrow">account seed</span>
                        ) : null}

                        <div className="transaction-card__meta-line">
                          <span>{getTransactionCategoryLabel(row, categoryMap)}</span>
                          <span className="transaction-card__separator" aria-hidden="true">
                            ·
                          </span>
                          <span>{getTransactionAccountLabel(row)}</span>
                        </div>

                        <div className="transaction-card__footer">
                          <div className="transaction-card__date-and-badges">
                            {renderTransactionBadges(row)}
                          </div>

                          {renderTransactionActions(row)}
                        </div>

                        {row.note ? <p className="transaction-card__note">{row.note}</p> : null}
                      </div>
                    ) : null}
                  </article>
                    );
                  })()
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <RecurringManagementSection />
      )}
    </section>
  );
}