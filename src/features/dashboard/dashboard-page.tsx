import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents, getBudgetRows, getMonthlySummary } from "../../lib/money";
import { primaryButtonStyle } from "../components/style-constants";

function SummaryCard(props: {
  title: string;
  value: string;
  tone?: "default" | "good" | "bad";
}) {
  const tone = props.tone ?? "default";
  return (
    <div className="summary-card">
      <div className="summary-card__label">{props.title}</div>
      <div
        className={`summary-card__value${tone === "good" ? " summary-card__value--good" : tone === "bad" ? " summary-card__value--bad" : ""}`}
      >
        {props.value}
      </div>
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
        <div className="page-header-text">
          <h1>dashboard</h1>
          <p>month snapshot. no oracle, just arithmetic.</p>
        </div>

        <div className="page-actions">
          <label className="field" style={{ gap: "0.25rem" }}>
            <span>month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              style={{
                padding: "0.55rem 0.7rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                background: "#ffffff",
              }}
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
        <SummaryCard title="income" value={formatCents(summary.incomeCents)} />
        <SummaryCard title="expenses" value={formatCents(summary.expenseCents)} />
        <SummaryCard
          title="net"
          value={formatCents(summary.netCents)}
          tone={summary.netCents >= 0 ? "good" : "bad"}
        />
        <SummaryCard
          title="unassigned"
          value={formatCents(summary.unassignedCents)}
          tone={summary.unassignedCents >= 0 ? "default" : "bad"}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <div className="section-card">
          <h2>over budget</h2>

          {overBudget.length === 0 ? (
            <p style={{ color: "#166534", marginBottom: 0 }}>
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
          <h2>category snapshot</h2>

          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {budgetRows.slice(0, 5).map((row) => (
              <li key={row.categoryId} style={{ marginBottom: "0.4rem" }}>
                {row.categoryName}: {formatCents(row.actualCents)} spent /{" "}
                {formatCents(row.plannedCents)} planned
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="section-card">
        <h2>recent transactions</h2>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
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
                  <td>
                    {transaction.recurringRuleId ? (
                      <span className="badge badge--recurring">recurring</span>
                    ) : transaction.kind === "transfer" ? (
                      <span className="badge badge--transfer">transfer</span>
                    ) : transaction.kind === "opening-balance" ? (
                      <span className="badge badge--neutral">opening</span>
                    ) : (
                      <span className="badge badge--neutral">{transaction.source}</span>
                    )}
                  </td>
                  <td
                    style={{
                      color: transaction.amountCents >= 0 ? "#166534" : "#991b1b",
                      fontWeight: 600,
                    }}
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