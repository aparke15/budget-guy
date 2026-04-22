import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { buildForecast, type ForecastHorizon } from "../../lib/forecast";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import {
  getAvailableCreditCents,
  getDisplayedAccountBalanceCents,
} from "../../lib/account-balances";

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
        <div className="page-header-copy">
          <h1 className="page-title">forecast</h1>
          <p className="page-subtitle">
            projected from actual balances plus future recurring activity only.
          </p>
        </div>

        <div className="section">
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
        <div className="page-header-copy">
          <h1 className="page-title">forecast</h1>
          <p className="page-subtitle">
            projected values only. no budgets, no guesses, just future recurring activity.
          </p>
        </div>

        <div className="page-actions">
          <label className="field">
            <span className="field-label">starting month</span>
            <input
              type="month"
              min={getCurrentMonth()}
              value={startMonth}
              onChange={(event) => setStartMonth(event.target.value)}
              className="control control--compact"
            />
          </label>

          <label className="field">
            <span className="field-label">horizon</span>
            <select
              value={horizon}
              onChange={(event) => setHorizon(event.target.value as ForecastHorizon)}
              className="control control--compact"
            >
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
            </select>
          </label>
        </div>
      </div>

      {recurringRules.length === 0 ? (
        <div className="section">
          <p className="empty-state">
            no recurring rules yet. projected summaries stay flat and projected balances match current balances.
          </p>
        </div>
      ) : null}

      <div className="section">
        <div className="section-heading">
          <h2 className="section-title">monthly projected summary</h2>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>month</th>
                <th>projected income</th>
                <th>projected expenses</th>
                <th>projected net</th>
              </tr>
            </thead>
            <tbody>
              {forecast.monthlySummaryRows.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td className="cell-amount text-positive">
                    {formatCents(row.projectedIncomeCents)}
                  </td>
                  <td className="cell-amount text-negative">
                    {formatCents(row.projectedExpenseCents)}
                  </td>
                  <td className={`cell-amount ${row.projectedNetCents >= 0 ? "text-positive" : "text-negative"}`}>
                    {formatCents(row.projectedNetCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-heading">
          <h2 className="section-title">projected account ending balances</h2>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>account</th>
                <th>type</th>
                {forecast.months.map((month) => (
                  <th key={month}>projected {month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.accountBalanceRows.map((row) => (
                <tr key={row.accountId}>
                  <td className="cell-amount">{row.accountName}</td>
                  <td>{row.accountType}</td>
                  {row.projectedBalances.map((balancePoint) => (
                    <td key={balancePoint.month}>
                      {row.accountType === "credit" ? (
                        <div className="stack-sm">
                          {(() => {
                            const displayedOwedCents = getDisplayedAccountBalanceCents(
                              { type: row.accountType },
                              balancePoint.endingBalanceCents
                            );

                            return (
                              <>
                                <span
                                  className={`cell-amount ${
                                    displayedOwedCents > 0
                                      ? "text-negative"
                                      : "text-positive"
                                  }`}
                                >
                                  owed: {formatCents(displayedOwedCents)}
                                </span>
                                {row.creditLimitCents != null ? (
                                  <span className="inline-note">
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
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className={`cell-amount ${balancePoint.endingBalanceCents >= 0 ? "text-positive" : "text-negative"}`}>
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