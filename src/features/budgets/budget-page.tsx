import { useMemo, useState } from "react";

import { useappstore } from "../../app/store";
import { getcurrentmonth } from "../../lib/dates";
import { formatcents, getbudgetrows, getmonthlysummary } from "../../lib/money";

export function BudgetPage() {
  const [month, setMonth] = useState(getcurrentmonth());

  const categories = useappstore((state) => state.categories);
  const budgets = useappstore((state) => state.budgets);
  const transactions = useappstore((state) => state.transactions);

  const rows = useMemo(
    () => getbudgetrows(categories, budgets, transactions, month),
    [budgets, categories, month, transactions]
  );

  const summary = useMemo(
    () => getmonthlysummary(transactions, budgets, month),
    [budgets, month, transactions]
  );

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
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>budget</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
            planned vs actual. the ancient duel.
          </p>
        </div>

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
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
          <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>planned</div>
          <div style={{ marginTop: "0.4rem", fontSize: "1.4rem", fontWeight: 700 }}>
            {formatcents(summary.plannedCents)}
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
          <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>spent</div>
          <div style={{ marginTop: "0.4rem", fontSize: "1.4rem", fontWeight: 700 }}>
            {formatcents(summary.expenseCents)}
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
          <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>unassigned</div>
          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: summary.unassignedCents < 0 ? "#991b1b" : "#111827",
            }}
          >
            {formatcents(summary.unassignedCents)}
          </div>
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
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.65rem 0.5rem" }}>category</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>planned</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>actual</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>remaining</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.categoryId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.65rem 0.5rem" }}>{row.categoryName}</td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {formatcents(row.plannedCents)}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {formatcents(row.actualCents)}
                  </td>
                  <td
                    style={{
                      padding: "0.65rem 0.5rem",
                      color: row.overBudget ? "#991b1b" : "#166534",
                      fontWeight: 600,
                    }}
                  >
                    {formatcents(row.remainingCents)}
                  </td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "1rem 0.5rem", color: "#6b7280" }}>
                    no budget rows for this month yet.
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