import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { cardStyle, inputStyle } from "../components/style-constants";
import { buildForecast, type ForecastHorizon } from "../../lib/forecast";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import {
  getAvailableCreditCents,
  getDisplayedAccountBalanceCents,
} from "../../lib/account-balances";

const tableCellStyle = {
  padding: "0.7rem 0.55rem",
  borderBottom: "1px solid #f3f4f6",
} as const;

export function ForecastPage() {
  const accounts = useAppStore((state) => state.accounts);
  const transactions = useAppStore((state) => state.transactions);
  const recurringRules = useAppStore((state) => state.recurringRules);

  const [horizon, setHorizon] = useState<ForecastHorizon>("6");
  const [startMonth, setStartMonth] = useState(getCurrentMonth());

  const forecast = useMemo(
    () => buildForecast(accounts, transactions, recurringRules, startMonth, horizon),
    [accounts, horizon, recurringRules, startMonth, transactions]
  );

  if (accounts.length === 0) {
    return (
      <section style={{ display: "grid", gap: "1.25rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>forecast</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
            projected from actual balances plus future recurring activity only.
          </p>
        </div>

        <div style={cardStyle}>
          <p style={{ margin: 0, color: "#6b7280" }}>
            no accounts yet. add accounts and recurring rules to see a forecast.
          </p>
        </div>
      </section>
    );
  }

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
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>forecast</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
            projected values only. no budgets, no guesses, just future recurring activity.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.9rem", color: "#374151" }}>
            starting month
            <input
              type="month"
              min={getCurrentMonth()}
              value={startMonth}
              onChange={(event) => setStartMonth(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: "0.35rem", fontSize: "0.9rem", color: "#374151" }}>
            horizon
            <select
              value={horizon}
              onChange={(event) => setHorizon(event.target.value as ForecastHorizon)}
              style={inputStyle}
            >
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
            </select>
          </label>
        </div>
      </div>

      {recurringRules.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: "#6b7280" }}>
            no recurring rules yet. projected summaries stay flat and projected balances match current balances.
          </p>
        </div>
      ) : null}

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>monthly projected summary</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={tableCellStyle}>month</th>
                <th style={tableCellStyle}>projected income</th>
                <th style={tableCellStyle}>projected expenses</th>
                <th style={tableCellStyle}>projected net</th>
              </tr>
            </thead>
            <tbody>
              {forecast.monthlySummaryRows.map((row) => (
                <tr key={row.month} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={tableCellStyle}>{row.month}</td>
                  <td style={{ ...tableCellStyle, color: "#166534", fontWeight: 600 }}>
                    {formatCents(row.projectedIncomeCents)}
                  </td>
                  <td style={{ ...tableCellStyle, color: "#991b1b", fontWeight: 600 }}>
                    {formatCents(row.projectedExpenseCents)}
                  </td>
                  <td
                    style={{
                      ...tableCellStyle,
                      color: row.projectedNetCents >= 0 ? "#166534" : "#991b1b",
                      fontWeight: 600,
                    }}
                  >
                    {formatCents(row.projectedNetCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
          projected account ending balances
        </h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={tableCellStyle}>account</th>
                <th style={tableCellStyle}>type</th>
                {forecast.months.map((month) => (
                  <th key={month} style={tableCellStyle}>
                    projected {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.accountBalanceRows.map((row) => (
                <tr key={row.accountId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ ...tableCellStyle, fontWeight: 600 }}>{row.accountName}</td>
                  <td style={tableCellStyle}>{row.accountType}</td>
                  {row.projectedBalances.map((balancePoint) => (
                    <td key={balancePoint.month} style={tableCellStyle}>
                      {row.accountType === "credit" ? (
                        <div style={{ display: "grid", gap: "0.2rem" }}>
                          <span
                            style={{
                              color:
                                getDisplayedAccountBalanceCents(
                                  { type: row.accountType },
                                  balancePoint.endingBalanceCents
                                ) > 0
                                  ? "#991b1b"
                                  : "#166534",
                              fontWeight: 600,
                            }}
                          >
                            owed:{" "}
                            {formatCents(
                              getDisplayedAccountBalanceCents(
                                { type: row.accountType },
                                balancePoint.endingBalanceCents
                              )
                            )}
                          </span>
                          {row.creditLimitCents != null ? (
                            <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                              available:{" "}
                              {formatCents(
                                getAvailableCreditCents(
                                  {
                                    type: row.accountType,
                                    creditLimitCents: row.creditLimitCents,
                                  },
                                  balancePoint.endingBalanceCents
                                ) ?? 0
                              )}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span
                          style={{
                            color:
                              balancePoint.endingBalanceCents >= 0 ? "#166534" : "#991b1b",
                            fontWeight: 600,
                          }}
                        >
                          {formatCents(balancePoint.endingBalanceCents)}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}