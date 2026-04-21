import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents, getBudgetRows, getMonthlySummary } from "../../lib/money";

function Card(props: {
  title: string;
  value: string;
  tone?: "default" | "good" | "bad";
}) {
  const color =
    props.tone === "good"
      ? "#166534"
      : props.tone === "bad"
        ? "#991b1b"
        : "#111827";

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0.75rem",
        padding: "1rem",
      }}
    >
      <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>{props.title}</div>
      <div
        style={{
          marginTop: "0.4rem",
          fontSize: "1.5rem",
          fontWeight: 700,
          color,
        }}
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
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>dashboard</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
            month snapshot. no oracle, just arithmetic.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <label
            style={{
              display: "grid",
              gap: "0.35rem",
              fontSize: "0.9rem",
              color: "#374151",
            }}
          >
            month
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
            style={{
              padding: "0.7rem 0.95rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "#111827",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            generate recurring
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
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

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>over budget</h2>

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

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
            category snapshot
          </h2>

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

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>recent transactions</h2>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.65rem 0.5rem" }}>date</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>merchant</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>source</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  style={{ borderBottom: "1px solid #f3f4f6" }}
                >
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {transaction.date}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {transaction.merchant ?? "—"}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {transaction.source}
                  </td>
                  <td
                    style={{
                      padding: "0.65rem 0.5rem",
                      color:
                        transaction.amountCents >= 0 ? "#166534" : "#991b1b",
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