import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { inputStyle } from "../components/style-constants";
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
      <section className="page">
        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">forecast</h1>
            <p className="page-subtitle">
            projected from actual balances plus future recurring activity only.
          </p>
        </div>

        </div>

        <div className="section-card">
          <p className="empty-state">
            no accounts yet. add accounts and recurring rules to see a forecast.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">forecast</h1>
          <p className="page-subtitle">
            projected values only. no budgets, no guesses, just future recurring activity.
          </p>
        </div>

        <div className="page-actions">
          <label className="field">
            <span className="field__label">starting month</span>
            <input
              type="month"
              min={getCurrentMonth()}
              value={startMonth}
              onChange={(event) => setStartMonth(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label className="field">
            <span className="field__label">horizon</span>
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

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card__label">accounts</div>
          <div className="summary-card__value">{accounts.length}</div>
        </div>
        <div className="summary-card summary-card--good">
          <div className="summary-card__label">active recurring rules</div>
          <div className="summary-card__value">
            {recurringRules.filter((rule) => rule.active).length}
          </div>
        </div>
        <div className="summary-card summary-card--info">
          <div className="summary-card__label">forecast months</div>
          <div className="summary-card__value">{forecast.months.length}</div>
        </div>
      </div>

      {recurringRules.length === 0 ? (
        <div className="section-card">
          <p className="empty-state">
            no recurring rules yet. projected summaries stay flat and projected balances match current balances.
          </p>
        </div>
      ) : null}

      <div className="section-card">
        <h2 className="section-title">monthly projected summary</h2>

        <div className="table-wrap">
          <table className="app-table">
            <thead>
              <tr>
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

      <div className="section-card">
        <h2 className="section-title">projected account ending balances</h2>

        <div className="table-wrap">
          <table className="app-table">
            <thead>
              <tr>
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
                  <td style={tableCellStyle}>
                    <span
                      className={
                        row.accountType === "credit"
                          ? "badge badge--credit"
                          : "badge badge--neutral"
                      }
                    >
                      {row.accountType}
                    </span>
                  </td>
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