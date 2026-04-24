import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { inputStyle } from "../components/style-constants";
import { buildForecast, type ForecastHorizon } from "../../lib/forecast";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import { getAvailableCreditCents } from "../../lib/account-balances";

const tableCellStyle = {
  padding: "0.7rem 0.55rem",
  borderBottom: "1px solid var(--border-subtle)",
} as const;

export function ForecastPage() {
  const accounts = useAppStore((state) => state.accounts);
  const transactions = useAppStore((state) => state.transactions);
  const recurringRules = useAppStore((state) => state.recurringRules);

  const [horizon, setHorizon] = useState<ForecastHorizon>("6");
  const [startMonth, setStartMonth] = useState(getCurrentMonth());
  const [expandedSummaryMonth, setExpandedSummaryMonth] = useState<string | null>(null);
  const [expandedBalanceAccountId, setExpandedBalanceAccountId] = useState<string | null>(null);

  const forecast = useMemo(
    () => buildForecast(accounts, transactions, recurringRules, startMonth, horizon),
    [accounts, horizon, recurringRules, startMonth, transactions]
  );
  const finalProjectedMonth = forecast.months[forecast.months.length - 1] ?? null;

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

        <div className="section-card section-card--surface">
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
        <div className="section-card section-card--surface">
          <p className="empty-state">
            no recurring rules yet. projected summaries stay flat and projected balances match current balances.
          </p>
        </div>
      ) : null}

      <div className="section-card section-card--surface">
        <h2 className="section-title">monthly projected summary</h2>

        <div className="table-wrap responsive-table-desktop">
          <table className="app-table">
            <thead>
              <tr>
                <th style={tableCellStyle}>month</th>
                <th className="money-column" style={tableCellStyle}>projected income</th>
                <th className="money-column" style={tableCellStyle}>projected expenses</th>
                <th className="money-column" style={tableCellStyle}>projected net</th>
              </tr>
            </thead>
            <tbody>
              {forecast.monthlySummaryRows.map((row) => (
                <tr key={row.month}>
                  <td style={tableCellStyle}>{row.month}</td>
                  <td
                    className="money-column"
                    style={{
                      ...tableCellStyle,
                      color: "var(--text-positive)",
                      fontWeight: 600,
                    }}
                  >
                    {formatCents(row.projectedIncomeCents)}
                  </td>
                  <td
                    className="money-column"
                    style={{
                      ...tableCellStyle,
                      color: "var(--text-negative)",
                      fontWeight: 600,
                    }}
                  >
                    {formatCents(row.projectedExpenseCents)}
                  </td>
                  <td
                    className="money-column"
                    style={{
                      ...tableCellStyle,
                      color:
                        row.projectedNetCents >= 0
                          ? "var(--text-positive)"
                          : "var(--text-negative)",
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

        <div className="responsive-table-mobile table-card-list" aria-label="monthly projected summary list">
          {forecast.monthlySummaryRows.map((row) => {
            const isExpanded = expandedSummaryMonth === row.month;

            return (
              <article
                key={row.month}
                className={isExpanded ? "table-card table-card--expanded" : "table-card"}
              >
                <button
                  type="button"
                  className="table-card__summary"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedSummaryMonth((current) =>
                      current === row.month ? null : row.month
                    )
                  }
                >
                  <div className="table-card__top">
                    <div className="table-card__details-group">
                      <div className="table-card__details">{row.month}</div>
                    </div>

                    <div
                      className={`table-card__amount ${
                        row.projectedNetCents >= 0 ? "text-positive" : "text-negative"
                      } font-bold`}
                    >
                      {formatCents(row.projectedNetCents)}
                    </div>
                  </div>

                  <div className="table-card__summary-footer">
                    <div className="table-card__summary-meta">
                      <span>projected net</span>
                    </div>

                    <span className="table-card__chevron" aria-hidden="true">
                      {isExpanded ? "▴" : "▾"}
                    </span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="table-card__expanded-details">
                    <div className="table-card__meta-line">
                      <span className="table-card__eyebrow">projected income</span>
                      <span className="text-positive font-bold">
                        {formatCents(row.projectedIncomeCents)}
                      </span>
                    </div>

                    <div className="table-card__meta-line">
                      <span className="table-card__eyebrow">projected expenses</span>
                      <span className="text-negative font-bold">
                        {formatCents(row.projectedExpenseCents)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      <div className="section-card section-card--surface">
        <h2 className="section-title">projected account ending balances</h2>

        <div className="table-wrap responsive-table-desktop">
          <table className="app-table">
            <thead>
              <tr>
                <th style={tableCellStyle}>account</th>
                <th style={tableCellStyle}>type</th>
                {forecast.months.map((month) => (
                  <th key={month} className="money-column" style={tableCellStyle}>
                    projected {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.accountBalanceRows.map((row) => (
                <tr key={row.accountId}>
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
                    <td key={balancePoint.month} className="money-column" style={tableCellStyle}>
                      <div style={{ display: "grid", gap: "0.2rem" }}>
                        <span
                          style={{
                            color:
                              balancePoint.endingBalanceCents > 0
                                ? "var(--text-positive)"
                                : balancePoint.endingBalanceCents < 0
                                  ? "var(--text-negative)"
                                  : "var(--text-default)",
                            fontWeight: 600,
                          }}
                        >
                          {formatCents(balancePoint.endingBalanceCents)}
                        </span>
                        {row.accountType === "credit" && row.creditLimitCents != null ? (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
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
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="responsive-table-mobile table-card-list" aria-label="projected account balances list">
          {forecast.accountBalanceRows.map((row) => {
            const latestBalancePoint = row.projectedBalances[row.projectedBalances.length - 1];
            const latestBalanceCents = latestBalancePoint?.endingBalanceCents ?? 0;
            const latestAvailableCreditCents =
              row.accountType === "credit" && row.creditLimitCents != null
                ? getAvailableCreditCents(
                    {
                      type: row.accountType,
                      creditLimitCents: row.creditLimitCents,
                    },
                    latestBalanceCents
                  )
                : undefined;
            const isExpanded = expandedBalanceAccountId === row.accountId;

            return (
              <article
                key={row.accountId}
                className={isExpanded ? "table-card table-card--expanded" : "table-card"}
              >
                <button
                  type="button"
                  className="table-card__summary"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedBalanceAccountId((current) =>
                      current === row.accountId ? null : row.accountId
                    )
                  }
                >
                  <div className="table-card__top">
                    <div className="table-card__details-group">
                      <div className="table-card__details">{row.accountName}</div>
                    </div>

                    <div
                      className={`table-card__amount ${
                        latestBalanceCents > 0
                          ? "text-positive"
                          : latestBalanceCents < 0
                            ? "text-negative"
                            : ""
                      } font-bold`}
                    >
                      {formatCents(latestBalanceCents)}
                    </div>
                  </div>

                  <div className="table-card__summary-footer">
                    <div className="table-card__summary-meta">
                      <span>{finalProjectedMonth ? `projected ${finalProjectedMonth}` : "projected balance"}</span>
                    </div>

                    <span className="table-card__chevron" aria-hidden="true">
                      {isExpanded ? "▴" : "▾"}
                    </span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="table-card__expanded-details">
                    <div className="badge-row">
                      <span
                        className={
                          row.accountType === "credit"
                            ? "badge badge--credit"
                            : "badge badge--neutral"
                        }
                      >
                        {row.accountType}
                      </span>
                    </div>

                    <div className="table-card__meta-line">
                      <span className="table-card__eyebrow">credit limit</span>
                      <span>
                        {row.creditLimitCents != null ? formatCents(row.creditLimitCents) : "—"}
                      </span>
                    </div>

                    {latestAvailableCreditCents != null ? (
                      <div className="table-card__meta-line">
                        <span className="table-card__eyebrow">available credit</span>
                        <span>{formatCents(latestAvailableCreditCents)}</span>
                      </div>
                    ) : null}

                    <div className="table-card__detail-grid">
                      {row.projectedBalances.map((balancePoint) => {
                        const availableCreditCents =
                          row.accountType === "credit" && row.creditLimitCents != null
                            ? getAvailableCreditCents(
                                {
                                  type: row.accountType,
                                  creditLimitCents: row.creditLimitCents,
                                },
                                balancePoint.endingBalanceCents
                              )
                            : undefined;

                        return (
                          <div key={balancePoint.month} className="table-card__detail-row">
                            <div className="table-card__details-group">
                              <span className="table-card__detail-label">{balancePoint.month}</span>
                              {availableCreditCents != null ? (
                                <span className="table-card__detail-label">
                                  available {formatCents(availableCreditCents)}
                                </span>
                              ) : null}
                            </div>
                            <span
                              className={`table-card__detail-value ${
                                balancePoint.endingBalanceCents > 0
                                  ? "text-positive"
                                  : balancePoint.endingBalanceCents < 0
                                    ? "text-negative"
                                    : ""
                              } font-bold`}
                            >
                              {formatCents(balancePoint.endingBalanceCents)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}