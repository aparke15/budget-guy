import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents, getBudgetRows, getMonthlySummary } from "../../lib/money";
import { inputStyle, primaryButtonStyle } from "../components/style-constants";

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
              style={inputStyle}
            />
          </label>

          <button
            type="button"
            onClick={() => generateRecurringForMonth(month)}
            style={primaryButtonStyle}
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

      <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="section-card">
          <h2 className="section-title">over budget</h2>

          {overBudget.length === 0 ? (
            <p className="empty-state" style={{ color: "#166534" }}>
              shocking restraint. nothing over budget this month.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {overBudget.map((row) => (
                <li key={row.categoryId} style={{ marginBottom: "0.4rem" }}>
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
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {budgetRows.slice(0, 5).map((row) => (
                <li key={row.categoryId} style={{ marginBottom: "0.4rem" }}>
                  {row.categoryName}: {formatCents(row.actualCents)} spent /{" "}
                  {formatCents(row.plannedCents)} planned
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title-group">
            <h2 className="section-title">recent transactions</h2>
            <p className="section-subtitle">latest ledger activity across all accounts.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>date</th>
                <th>details</th>
                <th>badges</th>
                <th>amount</th>
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
                    <td>
                      {transaction.kind === "opening-balance"
                        ? "opening balance"
                        : transaction.kind === "transfer"
                          ? "transfer"
                          : transaction.merchant ?? "—"}
                    </td>
                    <td>
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
                    </td>
                    <td
                      className={
                        transaction.kind === "transfer"
                          ? "text-info"
                          : transaction.amountCents >= 0
                            ? "text-positive"
                            : "text-negative"
                      }
                      style={{ fontWeight: 700 }}
                    >
                      {formatCents(transaction.amountCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}