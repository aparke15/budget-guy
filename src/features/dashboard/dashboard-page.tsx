import { useMemo, useState } from "react";
import { addDays, format, subDays } from "date-fns";

import { useAppStore } from "../../app/store";
import { generateRecurringForRange } from "../../app/recurring-store-actions";
import { getCurrentDate, getCurrentMonth } from "../../lib/dates";
import {
  buildDueSoonList,
  buildExpectedOccurrenceSummary,
  deriveExpectedOccurrences,
} from "../../lib/expected-occurrences";
import { formatCents, getBudgetRows, getMonthlySummary } from "../../lib/money";
import { hasTransactionSplits } from "../../lib/transaction-splits";
import { RecurringGenerationFeedback } from "../recurring/recurring-generation-feedback";

function Card(props: {
  title: string;
  value: string;
  tone?: "default" | "good" | "bad";
}) {
  const toneClass =
    props.tone === "good"
      ? "summary-card summary-card--good"
      : props.tone === "bad"
        ? "summary-card summary-card--bad"
        : "summary-card";

  return (
    <div className={toneClass}>
      <div className="summary-card__label">{props.title}</div>
      <div className="summary-card__value">{props.value}</div>
    </div>
  );
}

export function DashboardPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [monthCount, setMonthCount] = useState("12");
  const [expandedRecentTransactionId, setExpandedRecentTransactionId] = useState<string | null>(null);

  const transactions = useAppStore((state) => state.transactions);
  const budgets = useAppStore((state) => state.budgets);
  const categories = useAppStore((state) => state.categories);
  const accounts = useAppStore((state) => state.accounts);
  const recurringRules = useAppStore((state) => state.recurringRules);
  const generationSummary = useAppStore(
    (state) => state.lastRecurringGenerationSummary
  );
  const today = getCurrentDate();
  const nearTermWindowStart = useMemo(
    () => format(subDays(new Date(`${today}T12:00:00`), 30), "yyyy-MM-dd"),
    [today]
  );
  const nearTermWindowEnd = useMemo(
    () => format(addDays(new Date(`${today}T12:00:00`), 30), "yyyy-MM-dd"),
    [today]
  );

  const summary = useMemo(
    () => getMonthlySummary(transactions, budgets, month),
    [budgets, month, transactions]
  );

  const expectedOccurrences = useMemo(
    () =>
      deriveExpectedOccurrences(
        recurringRules,
        transactions,
        {
          startDate: nearTermWindowStart,
          endDate: nearTermWindowEnd,
        },
        {
          today,
          categories,
        }
      ),
    [categories, nearTermWindowEnd, nearTermWindowStart, recurringRules, today, transactions]
  );

  const expectedSummary = useMemo(
    () => buildExpectedOccurrenceSummary(expectedOccurrences),
    [expectedOccurrences]
  );

  const dueSoonOccurrences = useMemo(
    () => buildDueSoonList(expectedOccurrences, { limit: 5 }),
    [expectedOccurrences]
  );

  const budgetRows = useMemo(
    () => getBudgetRows(categories, budgets, transactions, month),
    [budgets, categories, month, transactions]
  );

  const overBudget = budgetRows.filter((row) => row.overBudget);
  const recentTransactions = transactions.slice(0, 8);
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );

  function toggleExpandedRecentTransaction(transactionId: string) {
    setExpandedRecentTransactionId((current) =>
      current === transactionId ? null : transactionId
    );
  }

  function getRecentTransactionDetails(transaction: (typeof recentTransactions)[number]) {
    return transaction.kind === "opening-balance"
      ? "opening balance"
      : transaction.kind === "transfer"
        ? transaction.merchant ?? "transfer"
        : transaction.merchant ?? "—";
  }

  function getRecentTransactionCategoryLabel(
    transaction: (typeof recentTransactions)[number]
  ) {
    if (transaction.kind === "transfer") {
      return "transfer";
    }

    if (transaction.kind === "opening-balance") {
      return "opening balance";
    }

    if (hasTransactionSplits(transaction)) {
      return `split · ${transaction.splits.length} categories`;
    }

    return transaction.categoryId
      ? categoryMap.get(transaction.categoryId) ?? "unknown"
      : "—";
  }

  function getRecentTransactionAccountLabel(
    transaction: (typeof recentTransactions)[number]
  ) {
    return accountMap.get(transaction.accountId) ?? "unknown account";
  }

  function getRecentTransactionAmountClass(
    transaction: (typeof recentTransactions)[number]
  ) {
    if (transaction.kind === "transfer") {
      return "text-info font-bold";
    }

    return transaction.amountCents >= 0
      ? "text-positive font-bold"
      : "text-negative font-bold";
  }

  function renderRecentTransactionBadges(
    transaction: (typeof recentTransactions)[number]
  ) {
    return (
      <div className="badge-row">
        <span
          className={
            transaction.kind === "transfer"
              ? "badge badge--transfer"
              : transaction.kind === "opening-balance"
                ? "badge badge--opening"
                : transaction.amountCents >= 0
                  ? "badge badge--income"
                  : "badge badge--expense"
          }
        >
          {transaction.kind === "transfer"
            ? "transfer"
            : transaction.kind === "opening-balance"
              ? "opening balance"
              : transaction.amountCents >= 0
                ? "income"
                : "expense"}
        </span>
        <span
          className={
            transaction.source === "recurring"
              ? "badge badge--recurring"
              : "badge badge--neutral"
          }
        >
          {transaction.source}
        </span>
      </div>
    );
  }

  function handleGenerateRecurring() {
    const parsedMonthCount = Number.parseInt(monthCount, 10);

    generateRecurringForRange(
      month,
      Number.isInteger(parsedMonthCount) && parsedMonthCount > 0
        ? parsedMonthCount
        : 12
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">dashboard</h1>
          <p className="page-subtitle">
            month snapshot. no oracle, just arithmetic.
          </p>
        </div>

        <div className="page-actions">
          <label className="field">
            <span className="field__label">month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="control"
            />
          </label>

          <label className="field field--compact">
            <span className="field__label">generate months</span>
            <input
              type="number"
              min="1"
              step="1"
              value={monthCount}
              onChange={(event) => setMonthCount(event.target.value)}
              className="control"
            />
          </label>

          <button
            type="button"
            onClick={handleGenerateRecurring}
            className="button button--primary"
          >
            generate recurring range
          </button>
        </div>
      </div>

      {generationSummary ? <RecurringGenerationFeedback summary={generationSummary} /> : null}

      <div className="summary-grid">
        <Card title="income" value={formatCents(summary.incomeCents)} />
        <Card title="expenses" value={formatCents(summary.expenseCents)} />
        <Card
          title="net"
          value={formatCents(summary.netCents)}
          tone={summary.netCents >= 0 ? "good" : "bad"}
        />
        <Card
          title="unassigned"
          value={formatCents(summary.unassignedCents)}
          tone={summary.unassignedCents >= 0 ? "default" : "bad"}
        />
      </div>

      <div className="summary-grid">
        <Card title="due today" value={String(expectedSummary.dueTodayCount)} />
        <Card title="overdue" value={String(expectedSummary.overdueCount)} tone={expectedSummary.overdueCount > 0 ? "bad" : "default"} />
        <Card title="next 7 days" value={String(expectedSummary.next7DaysCount)} />
      </div>

      <div className="summary-grid summary-grid--wide">
        <div className="section-card">
          <h2 className="section-title">over budget</h2>

          {overBudget.length === 0 ? (
            <p className="empty-state text-positive">
              shocking restraint. nothing over budget this month.
            </p>
          ) : (
            <ul className="list-compact">
              {overBudget.map((row) => (
                <li key={row.categoryId}>
                  {row.categoryName}: {formatCents(Math.abs(row.remainingCents))}{" "}
                  over
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="section-card">
          <h2 className="section-title">category snapshot</h2>

          {budgetRows.length === 0 ? (
            <p className="empty-state">no budget rows for this month yet.</p>
          ) : (
            <ul className="list-compact">
              {budgetRows.slice(0, 5).map((row) => (
                <li key={row.categoryId}>
                  {row.categoryName}: {formatCents(row.actualCents)} spent /{" "}
                  {formatCents(row.plannedCents)} planned
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="section-card section-card--surface">
        <div className="section-header">
          <div className="section-title-group">
            <h2 className="section-title">near-term expected items</h2>
            <p className="section-subtitle">
              pending recurring items from the last 30 days through the next 30 days. nothing here touches posted balances or monthly actuals.
            </p>
          </div>
        </div>

        {dueSoonOccurrences.length === 0 ? (
          <p className="empty-state">no pending recurring items in the current last-30 / next-30-day window.</p>
        ) : (
          <ul className="list-compact list-compact--tight">
            {dueSoonOccurrences.map((occurrence) => (
              <li key={occurrence.id}>
                {occurrence.date} · {occurrence.ruleName} · {formatCents(
                  occurrence.kind === "transfer"
                    ? -Math.abs(occurrence.amountCents)
                    : occurrence.amountCents
                )}
                {occurrence.kind === "transfer" ? (
                  <> · {accountMap.get(occurrence.accountId) ?? "unknown"} → {accountMap.get(occurrence.toAccountId ?? "") ?? "unknown"}</>
                ) : occurrence.categoryName ? (
                  <> · {occurrence.categoryName}</>
                ) : null}
                <> · {occurrence.status}</>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="section-card section-card--surface">
        <div className="section-header">
          <div className="section-title-group">
            <h2 className="section-title">recent transactions</h2>
            <p className="section-subtitle">latest ledger activity across all accounts.</p>
          </div>
        </div>

        <div className="table-wrap responsive-table-desktop">
          <table className="app-table">
            <thead>
              <tr>
                <th>date</th>
                <th>details</th>
                <th>badges</th>
                <th className="money-column">amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="empty-state">no transactions yet.</p>
                  </td>
                </tr>
              ) : (
                recentTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.date}</td>
                    <td>{getRecentTransactionDetails(transaction)}</td>
                    <td>{renderRecentTransactionBadges(transaction)}</td>
                    <td className={`money-column ${getRecentTransactionAmountClass(transaction)}`}>
                      {formatCents(transaction.amountCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="responsive-table-mobile table-card-list" aria-label="recent transactions list">
          {recentTransactions.length === 0 ? (
            <p className="empty-state">no transactions yet.</p>
          ) : (
            recentTransactions.map((transaction) => {
              const isExpanded = expandedRecentTransactionId === transaction.id;

              return (
                <article
                  key={transaction.id}
                  className={
                    transaction.kind === "opening-balance"
                      ? isExpanded
                        ? "table-card table-card--opening table-card--expanded"
                        : "table-card table-card--opening"
                      : isExpanded
                        ? "table-card table-card--expanded"
                        : "table-card"
                  }
                >
                  <button
                    type="button"
                    className="table-card__summary"
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpandedRecentTransaction(transaction.id)}
                  >
                    <div className="table-card__top">
                      <div className="table-card__details-group">
                        <div className="table-card__details">
                          {getRecentTransactionDetails(transaction)}
                        </div>
                      </div>

                      <div className={`table-card__amount ${getRecentTransactionAmountClass(transaction)}`}>
                        {formatCents(transaction.amountCents)}
                      </div>
                    </div>

                    <div className="table-card__summary-footer">
                      <div className="table-card__summary-meta">
                        <span className="table-card__date">{transaction.date}</span>
                      </div>

                      <span className="table-card__chevron" aria-hidden="true">
                        {isExpanded ? "▴" : "▾"}
                      </span>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="table-card__expanded-details">
                      <div className="table-card__meta-line">
                        <span className="table-card__eyebrow">category</span>
                        <span>{getRecentTransactionCategoryLabel(transaction)}</span>
                      </div>

                      <div className="table-card__meta-line">
                        <span className="table-card__eyebrow">account</span>
                        <span>{getRecentTransactionAccountLabel(transaction)}</span>
                      </div>

                      {renderRecentTransactionBadges(transaction)}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}