import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents, getBudgetRows, getMonthlySummary } from "../../lib/money";

function Card(props: {
  title: string;
  value: string;
  tone?: "default" | "good" | "bad";
}) {
  const valueClassName =
    props.tone === "good"
      ? "summary-value text-positive"
      : props.tone === "bad"
        ? "summary-value text-negative"
        : "summary-value";

  return (
    <div className="summary-item">
      <div className="summary-label">{props.title}</div>
      <div className={valueClassName}>{props.value}</div>
    </div>
  );
}

export function DashboardPage() {
  const [month, setMonth] = useState(getCurrentMonth());

  const transactions = useAppStore((state) => state.transactions);
  const budgets = useAppStore((state) => state.budgets);
  const categories = useAppStore((state) => state.categories);
  const generateRecurringForMonth = useAppStore(
    (state) => state.generateRecurringForMonth
  );

  const summary = useMemo(
    () => getMonthlySummary(transactions, budgets, month),
    [budgets, month, transactions]
  );

  const budgetRows = useMemo(
    () => getBudgetRows(categories, budgets, transactions, month),
    [budgets, categories, month, transactions]
  );

  const overBudget = budgetRows.filter((row) => row.overBudget);
  const recentTransactions = transactions.slice(0, 8);

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">dashboard</h1>
          <p className="page-subtitle">
            month snapshot. no oracle, just arithmetic.
          </p>
        </div>

        <div className="page-actions">
          <label className="field">
            <span className="field-label">month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="control control--compact"
            />
          </label>

          <button
            type="button"
            onClick={() => generateRecurringForMonth(month)}
            className="button button--primary"
          >
            generate recurring
          </button>
        </div>
      </div>

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

      <div className="two-column-grid">
        <div className="section">
          <div className="section-heading">
            <h2 className="section-title">over budget</h2>
          </div>

          {overBudget.length === 0 ? (
            <p className="empty-state text-positive">
              shocking restraint. nothing over budget this month.
            </p>
          ) : (
            <ul className="metric-list">
              {overBudget.map((row) => (
                <li key={row.categoryId} className="metric-row">
                  <span className="metric-row-label">{row.categoryName}</span>
                  <span className="metric-row-value text-negative">
                    {formatCents(Math.abs(row.remainingCents))} over
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="section">
          <div className="section-heading">
            <h2 className="section-title">category snapshot</h2>
          </div>

          <ul className="metric-list">
            {budgetRows.slice(0, 5).map((row) => (
              <li key={row.categoryId} className="metric-row">
                <span className="metric-row-label">{row.categoryName}</span>
                <span className="metric-row-value">
                  {formatCents(row.actualCents)} spent / {formatCents(row.plannedCents)} planned
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="section">
        <div className="section-heading">
          <h2 className="section-title">recent transactions</h2>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>date</th>
                <th>merchant</th>
                <th>source</th>
                <th>amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.date}</td>
                  <td>{transaction.merchant ?? "—"}</td>
                  <td>{transaction.source}</td>
                  <td
                    className={`cell-amount ${
                      transaction.amountCents >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {formatCents(transaction.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}