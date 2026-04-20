import { useMemo, useState } from "react";

import { useappstore } from "../../app/store";
import { getcurrentmonth, getmonthkey } from "../../lib/dates";
import { formatcents } from "../../lib/money";

export function TransactionsPage() {
  const [month, setMonth] = useState(getcurrentmonth());

  const transactions = useappstore((state) => state.transactions);
  const categories = useappstore((state) => state.categories);
  const accounts = useappstore((state) => state.accounts);

  const categorymap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const accountmap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const filteredtransactions = transactions.filter(
    (transaction) => getmonthkey(transaction.date) === month
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
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>transactions</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
            ledger first. glamour later.
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
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
        }}
      >
        <div style={{ marginBottom: "0.9rem", color: "#6b7280" }}>
          {filteredtransactions.length} transaction
          {filteredtransactions.length === 1 ? "" : "s"} in {month}
        </div>

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
                <th style={{ padding: "0.65rem 0.5rem" }}>category</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>account</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>source</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredtransactions.map((transaction) => (
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
                    {categorymap.get(transaction.categoryId)?.name ?? "unknown"}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {accountmap.get(transaction.accountId)?.name ?? "unknown"}
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
                    {formatcents(transaction.amountCents)}
                  </td>
                </tr>
              ))}

              {filteredtransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "1rem 0.5rem",
                      color: "#6b7280",
                    }}
                  >
                    no transactions for this month yet. suspiciously peaceful.
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