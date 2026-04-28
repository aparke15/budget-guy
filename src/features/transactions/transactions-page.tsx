import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { endOfMonth, format, parseISO } from "date-fns";

import { useAppStore } from "../../app/store";
import { getCurrentMonth, getMonthKey, getTodayDateKey } from "../../lib/dates";
import {
  deriveExpectedOccurrences,
  type ExpectedOccurrence,
} from "../../lib/expected-occurrences";
import { formatCents } from "../../lib/money";
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

type ExpectedActivityRow = {
  kind: "expected";
  id: string;
  occurrence: ExpectedOccurrence;
};

type PostedActivityRow = {
  kind: "posted";
  id: string;
  row: TransactionListRow;
};

type ActivityLedgerRow = PostedActivityRow | ExpectedActivityRow;

type CategoryLookup = Map<string, { name: string; archived: boolean }>;

function getTransactionsTab(value: string | null): TransactionsTab {
  return value === "recurring" ? "recurring" : "activity";
}

function getExpectedStatusBadgeClass(status: ExpectedOccurrence["status"]) {
  if (status === "overdue") {
    return "badge badge--expense";
  }

  if (status === "due") {
    return "badge badge--transfer";
  }

  return "badge badge--neutral";
}

function getExpectedCategoryLabel(
  occurrence: ExpectedOccurrence,
  categoryMap: CategoryLookup
) {
  if (occurrence.kind === "transfer") {
    return "transfer";
  }

  if (!occurrence.categoryId) {
    return "uncategorized";
  }

  const category = categoryMap.get(occurrence.categoryId);

  if (!category) {
    return "unknown";
  }

  return category.archived ? `${category.name} (archived)` : category.name;
}

function filterExpectedOccurrences(
  occurrences: ExpectedOccurrence[],
  filters: TransactionFilters,
  accountMap: Map<string, string>,
  categoryMap: CategoryLookup
) {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return occurrences.filter((occurrence) => {
    if (getMonthKey(occurrence.date) !== filters.month) {
      return false;
    }

    if (filters.accountId) {
      if (
        occurrence.kind === "transfer" &&
        occurrence.accountId !== filters.accountId &&
        occurrence.toAccountId !== filters.accountId
      ) {
        return false;
      }

      if (occurrence.kind === "standard" && occurrence.accountId !== filters.accountId) {
        return false;
      }
    }

    if (filters.categoryId) {
      if (occurrence.kind !== "standard" || occurrence.categoryId !== filters.categoryId) {
        return false;
      }
    }

    if (!normalizedSearch) {
      return true;
    }

    const searchValue = [
      occurrence.recurringRuleName,
      occurrence.merchant ?? "",
      occurrence.note ?? "",
      accountMap.get(occurrence.accountId) ?? "",
      occurrence.toAccountId ? accountMap.get(occurrence.toAccountId) ?? "" : "",
      getExpectedCategoryLabel(occurrence, categoryMap),
    ]
      .join(" ")
      .toLowerCase();

    return searchValue.includes(normalizedSearch);
  });
}

function sortActivityLedgerRows(left: ActivityLedgerRow, right: ActivityLedgerRow) {
  const dateComparison = right.kind === "posted"
    ? (left.kind === "posted"
        ? right.row.date.localeCompare(left.row.date)
        : right.row.date.localeCompare(left.occurrence.date))
    : (left.kind === "posted"
        ? right.occurrence.date.localeCompare(left.row.date)
        : right.occurrence.date.localeCompare(left.occurrence.date));

  if (dateComparison !== 0) {
    return dateComparison;
  }

  if (left.kind !== right.kind) {
    return left.kind === "posted" ? -1 : 1;
  }

  return left.id.localeCompare(right.id);
}

function getActivityDetails(row: ActivityLedgerRow) {
  if (row.kind === "expected") {
    if (row.occurrence.kind === "transfer") {
      return row.occurrence.recurringRuleName;
    }

    return row.occurrence.merchant ?? row.occurrence.recurringRuleName;
  }

  const postedRow = row.row;

  if (postedRow.type === "transfer") {
    return `${postedRow.fromAccountName} → ${postedRow.toAccountName}`;
  }

  if (postedRow.type === "opening-balance") {
    return "opening balance";
  }

  return postedRow.merchant ?? "—";
}

function getActivityCategoryLabel(
  row: ActivityLedgerRow,
  categoryMap: CategoryLookup
) {
  if (row.kind === "expected") {
    return getExpectedCategoryLabel(row.occurrence, categoryMap);
  }

  const postedRow = row.row;

  if (postedRow.type === "transfer") {
    return "transfer";
  }

  if (postedRow.type === "opening-balance") {
    return "opening balance";
  }

  if (postedRow.splits?.length) {
    return `split · ${postedRow.splits.length} categories`;
  }

  return postedRow.categoryId
    ? categoryMap.get(postedRow.categoryId)?.name ?? "unknown"
    : "unknown";
}

function getActivityAccountLabel(row: ActivityLedgerRow, accountMap: Map<string, string>) {
  if (row.kind === "expected") {
    if (row.occurrence.kind === "transfer") {
      return `${accountMap.get(row.occurrence.accountId) ?? "unknown"} → ${accountMap.get(row.occurrence.toAccountId ?? "") ?? "unknown"}`;
    }

    return accountMap.get(row.occurrence.accountId) ?? "unknown";
  }

  const postedRow = row.row;

  if (postedRow.type === "transfer") {
    return `${postedRow.fromAccountName} → ${postedRow.toAccountName}`;
  }

  return postedRow.accountName;
}

function getActivityAmountClass(row: ActivityLedgerRow) {
  if (row.kind === "expected") {
    if (row.occurrence.kind === "transfer") {
      return "text-info font-semibold";
    }

    return row.occurrence.amountCents >= 0
      ? "text-positive font-semibold"
      : "text-negative font-semibold";
  }

  const postedRow = row.row;

  if (postedRow.type === "transfer") {
    return "text-info font-semibold";
  }

  return postedRow.amountCents >= 0
    ? "text-positive font-semibold"
    : "text-negative font-semibold";
}

function getPostedTransactionTypeBadgeClass(row: TransactionListRow) {
  if (row.type === "transfer") {
    return "badge badge--transfer";
  }

  if (row.type === "opening-balance") {
    return "badge badge--opening";
  }

  return row.amountCents >= 0 ? "badge badge--income" : "badge badge--expense";
}

function getPostedTransactionTypeBadgeLabel(row: TransactionListRow) {
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
  const recurringRules = useAppStore((state) => state.recurringRules);
  const addTransaction = useAppStore((state) => state.addTransaction);
  const updateTransaction = useAppStore((state) => state.updateTransaction);
  const deleteTransaction = useAppStore((state) => state.deleteTransaction);
  const addTransfer = useAppStore((state) => state.addTransfer);
  const updateTransfer = useAppStore((state) => state.updateTransfer);
  const deleteTransfer = useAppStore((state) => state.deleteTransfer);

  const today = useMemo(() => getTodayDateKey(), []);

  const categoryMap = useMemo<CategoryLookup>(
    () =>
      new Map(
        categories.map((category) => [
          category.id,
          { name: category.name, archived: Boolean(category.archivedAt) },
        ])
      ),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );

  const transactionRows = useMemo(
    () => buildTransactionListRows(transactions, accounts),
    [accounts, transactions]
  );

  const filteredTransactions = useMemo(
    () => filterTransactionRows(transactionRows, filters),
    [filters, transactionRows]
  );

  const expectedOccurrences = useMemo(
    () =>
      deriveExpectedOccurrences(
        recurringRules,
        transactions,
        {
          startDate: `${filters.month}-01`,
          endDate: format(endOfMonth(parseISO(`${filters.month}-01`)), "yyyy-MM-dd"),
        },
        today
      ).filter((occurrence) => occurrence.status !== "matched"),
    [filters.month, recurringRules, today, transactions]
  );

  const filteredExpectedOccurrences = useMemo(
    () =>
      filterExpectedOccurrences(
        expectedOccurrences,
        filters,
        accountMap,
        categoryMap
      ),
    [accountMap, categoryMap, expectedOccurrences, filters]
  );

  const activityRows = useMemo<ActivityLedgerRow[]>(
    () =>
      [
        ...filteredTransactions.map((row) => ({
          kind: "posted" as const,
          id: row.id,
          row,
        })),
        ...filteredExpectedOccurrences.map((occurrence) => ({
          kind: "expected" as const,
          id: occurrence.id,
          occurrence,
        })),
      ].sort(sortActivityLedgerRows),
    [filteredExpectedOccurrences, filteredTransactions]
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

  function jumpToRecurringRule(ruleId: string) {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set("tab", "recurring");
    nextParams.set("rule", ruleId);

    setEditingId(null);
    setShowCreateForm(false);
    setExpandedTransactionId(null);
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
    ? "no posted or expected rows match the current filters for this month. try clearing filters."
    : "no posted or expected rows for this month yet. suspiciously peaceful.";

  function renderActivityBadges(row: ActivityLedgerRow) {
    if (row.kind === "expected") {
      return (
        <div className="badge-row">
          <span className={getExpectedStatusBadgeClass(row.occurrence.status)}>
            {row.occurrence.status}
          </span>
          <span className="badge badge--muted">expected</span>
          <span
            className={
              row.occurrence.kind === "transfer"
                ? "badge badge--transfer"
                : row.occurrence.amountCents >= 0
                  ? "badge badge--income"
                  : "badge badge--expense"
            }
          >
            {row.occurrence.kind === "transfer"
              ? "transfer"
              : row.occurrence.amountCents >= 0
                ? "income"
                : "expense"}
          </span>
        </div>
      );
    }

    const postedRow = row.row;

    return (
      <div className="badge-row">
        <span className={getPostedTransactionTypeBadgeClass(postedRow)}>
          {getPostedTransactionTypeBadgeLabel(postedRow)}
        </span>
        {postedRow.type === "standard" && postedRow.splits?.length ? (
          <span className="badge badge--neutral">split</span>
        ) : null}
        <span
          className={
            postedRow.source === "recurring"
              ? "badge badge--recurring"
              : "badge badge--neutral"
          }
        >
          {postedRow.source}
        </span>
      </div>
    );
  }

  function renderSplitBreakdown(row: ActivityLedgerRow) {
    if (row.kind === "expected" || row.row.type !== "standard" || !row.row.splits?.length) {
      return null;
    }

    return (
      <div className="stack-sm">
        {row.row.splits.map((split) => (
          <div
            key={split.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.75rem",
              alignItems: "baseline",
            }}
          >
            <div className="stack-sm" style={{ minWidth: 0, gap: "0.15rem" }}>
              <span>
                {categoryMap.get(split.categoryId)?.name ?? "unknown"}
              </span>
              {split.note ? (
                <span className="muted-text">{split.note}</span>
              ) : null}
            </div>
            <span className={split.amountCents >= 0 ? "text-positive" : "text-negative"}>
              {formatCents(split.amountCents)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  function renderActivityActions(row: ActivityLedgerRow) {
    if (row.kind === "expected") {
      return row.occurrence.recurringRuleId ? (
        <div className="table-actions transaction-card__actions">
          <button
            type="button"
            onClick={() => jumpToRecurringRule(row.occurrence.recurringRuleId)}
            className="button button--secondary button--compact"
          >
            edit rule
          </button>
        </div>
      ) : null;
    }

    const postedRow = row.row;

    if (postedRow.type === "opening-balance") {
      return <span className="badge badge--muted">edit in accounts</span>;
    }

    return (
      <div className="table-actions transaction-card__actions">
        {postedRow.source === "recurring" && postedRow.recurringRuleId ? (
          <button
            type="button"
            onClick={() => jumpToRecurringRule(postedRow.recurringRuleId!)}
            className="button button--secondary button--compact"
          >
            edit rule
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => startEditingTransaction(postedRow.id)}
          className="button button--secondary button--compact"
        >
          edit
        </button>

        <button
          type="button"
          onClick={() => handleDelete(postedRow)}
          className="button button--danger button--compact"
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
                    className="control"
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
                  {activityRows.length} ledger row
                  {activityRows.length === 1 ? "" : "s"} in {filters.month}
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
                <span className="field__label">category</span>
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
                  className="control"
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
                  className="button button--secondary"
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
                  {activityRows.map((row) => (
                    <tr key={row.id} className={row.kind === "expected" ? "activity-row--expected" : undefined}>
                      <td>{row.kind === "expected" ? row.occurrence.date : row.row.date}</td>
                      <td>{getActivityDetails(row)}</td>
                      <td>{getActivityCategoryLabel(row, categoryMap)}</td>
                      <td>
                        {row.kind === "expected"
                          ? row.occurrence.kind === "transfer"
                            ? "—"
                            : accountMap.get(row.occurrence.accountId) ?? "unknown"
                          : row.row.type === "transfer"
                            ? "—"
                            : row.row.accountName}
                      </td>
                      <td>{renderActivityBadges(row)}</td>
                      <td className={`money-column ${getActivityAmountClass(row)}`}>
                        {formatCents(
                          row.kind === "expected"
                            ? row.occurrence.amountCents
                            : row.row.amountCents
                        )}
                      </td>
                      <td>{row.kind === "expected" ? row.occurrence.note ?? "pending recurring" : row.row.note ?? "—"}</td>
                      <td>{renderActivityActions(row)}</td>
                    </tr>
                  ))}

                  {activityRows.length === 0 ? (
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
              {activityRows.length === 0 ? (
                <p className="empty-state">{emptyStateMessage}</p>
              ) : (
                activityRows.map((row) => (
                  (() => {
                    const isExpanded = expandedTransactionId === row.id;

                    return (
                  <article
                    key={row.id}
                    className={
                      row.kind === "expected"
                        ? isExpanded
                          ? "transaction-card transaction-card--expected transaction-card--expanded"
                          : "transaction-card transaction-card--expected"
                        : row.row.type === "transfer"
                        ? isExpanded
                          ? "transaction-card transaction-card--transfer transaction-card--expanded"
                          : "transaction-card transaction-card--transfer"
                        : row.row.type === "opening-balance"
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
                            {getActivityDetails(row)}
                          </div>
                        </div>

                        <div className={`transaction-card__amount ${getActivityAmountClass(row)}`}>
                          {formatCents(
                            row.kind === "expected"
                              ? row.occurrence.amountCents
                              : row.row.amountCents
                          )}
                        </div>
                      </div>

                      <div className="transaction-card__summary-footer">
                        <div className="transaction-card__summary-meta">
                          <span className="transaction-card__date">
                            {row.kind === "expected" ? row.occurrence.date : row.row.date}
                          </span>
                          <span className="transaction-card__separator" aria-hidden="true">
                            ·
                          </span>
                          <span>{getActivityAccountLabel(row, accountMap)}</span>
                        </div>

                        <span className="transaction-card__chevron" aria-hidden="true">
                          {isExpanded ? "▴" : "▾"}
                        </span>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="transaction-card__expanded-details">
                        {row.kind === "posted" && row.row.type === "opening-balance" ? (
                          <span className="transaction-card__eyebrow">account seed</span>
                        ) : null}

                        {row.kind === "expected" ? (
                          <span className="transaction-card__eyebrow">pending expected occurrence</span>
                        ) : null}

                        <div className="transaction-card__meta-line">
                          <span>{getActivityCategoryLabel(row, categoryMap)}</span>
                          <span className="transaction-card__separator" aria-hidden="true">
                            ·
                          </span>
                          <span>{getActivityAccountLabel(row, accountMap)}</span>
                        </div>

                        {renderSplitBreakdown(row)}

                        <div className="transaction-card__footer">
                          <div className="transaction-card__date-and-badges">
                            {renderActivityBadges(row)}
                          </div>

                          {renderActivityActions(row)}
                        </div>

                        {(row.kind === "expected" ? row.occurrence.note : row.row.note) ? (
                          <p className="transaction-card__note">
                            {row.kind === "expected" ? row.occurrence.note : row.row.note}
                          </p>
                        ) : null}
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
        <RecurringManagementSection focusedRuleId={searchParams.get("rule")} />
      )}
    </section>
  );
}