import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import {
  type AccountHistoryRange,
  getDisplayedAccountBalanceCents,
  getDisplayedAccountBalanceLabel,
  getAccountMonthlyHistoryRows,
  getAllAccountBalances,
} from "../../lib/account-balances";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import { cardStyle, secondaryButtonStyle } from "../components/style-constants";

const tableCellStyle = {
  padding: "0.7rem 0.55rem",
  borderBottom: "1px solid #f3f4f6",
} as const;

const historyRanges: Array<{ value: AccountHistoryRange; label: string }> = [
  { value: "6", label: "last 6 months" },
  { value: "12", label: "last 12 months" },
  { value: "all", label: "all" },
];

export function AccountsPage() {
  const accounts = useAppStore((state) => state.accounts);
  const transactions = useAppStore((state) => state.transactions);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState<AccountHistoryRange>("6");

  const balanceRows = useMemo(
    () => getAllAccountBalances(accounts, transactions),
    [accounts, transactions]
  );

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId(null);
      return;
    }

    if (
      selectedAccountId &&
      accounts.some((account) => account.id === selectedAccountId)
    ) {
      return;
    }

    setSelectedAccountId(accounts[0]?.id ?? null);
  }, [accounts, selectedAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const historyRows = useMemo(
    () =>
      selectedAccountId
        ? getAccountMonthlyHistoryRows(
            transactions,
            selectedAccountId,
            historyRange,
            getCurrentMonth()
          )
        : [],
    [historyRange, selectedAccountId, transactions]
  );

  if (accounts.length === 0) {
    return (
      <section style={{ display: "grid", gap: "1.25rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>accounts</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
            balances from transactions only. no mysticism, no budgets.
          </p>
        </div>

        <div style={cardStyle}>
          <p style={{ margin: 0, color: "#6b7280" }}>
            no accounts yet. add one in settings to see balances and history.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.8rem" }}>accounts</h1>
        <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
          balances from transactions only. transfers included, budgets ignored.
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>current balances</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={tableCellStyle}>account name</th>
                <th style={tableCellStyle}>account type</th>
                <th style={tableCellStyle}>current view</th>
                <th style={tableCellStyle}>limit</th>
                <th style={tableCellStyle}>available credit</th>
              </tr>
            </thead>
            <tbody>
              {balanceRows.map((row) => {
                const isSelected = row.accountId === selectedAccountId;
                const isCredit = row.accountType === "credit";
                const valueColor = isCredit
                  ? row.displayValueCents > 0
                    ? "#991b1b"
                    : "#166534"
                  : row.displayValueCents >= 0
                    ? "#166534"
                    : "#991b1b";

                return (
                  <tr
                    key={row.accountId}
                    onClick={() => setSelectedAccountId(row.accountId)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "#f3f4f6" : "transparent",
                    }}
                  >
                    <td style={{ ...tableCellStyle, fontWeight: isSelected ? 600 : 500 }}>
                      {row.accountName}
                    </td>
                    <td style={tableCellStyle}>{row.accountType}</td>
                    <td
                      style={{
                        ...tableCellStyle,
                        color: valueColor,
                        fontWeight: 600,
                      }}
                    >
                      {row.displayLabel}: {formatCents(row.displayValueCents)}
                    </td>
                    <td style={tableCellStyle}>
                      {row.creditLimitCents != null ? formatCents(row.creditLimitCents) : "—"}
                    </td>
                    <td style={tableCellStyle}>
                      {row.availableCreditCents != null
                        ? formatCents(row.availableCreditCents)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            alignItems: "end",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
              {selectedAccount?.name ?? "selected account"} history
            </h2>
            <p style={{ margin: "0.35rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
              newest month first. closing {selectedAccount?.type === "credit" ? "owed" : "balance"} is cumulative through month end.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
            {historyRanges.map((option) => {
              const active = option.value === historyRange;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHistoryRange(option.value)}
                  style={{
                    ...secondaryButtonStyle,
                    background: active ? "#e5e7eb" : secondaryButtonStyle.background,
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {historyRows.length === 0 ? (
          <p style={{ margin: 0, color: "#6b7280" }}>
            no transactions for this account yet.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={tableCellStyle}>month</th>
                  <th style={tableCellStyle}>inflows</th>
                  <th style={tableCellStyle}>outflows</th>
                  <th style={tableCellStyle}>net change</th>
                  <th style={tableCellStyle}>
                    closing {selectedAccount?.type === "credit" ? "owed" : "balance"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => {
                  const closingValueCents = selectedAccount
                    ? getDisplayedAccountBalanceCents(
                        selectedAccount,
                        row.closingBalanceCents
                      )
                    : row.closingBalanceCents;
                  const closingLabel = selectedAccount
                    ? getDisplayedAccountBalanceLabel(selectedAccount)
                    : "balance";
                  const closingColor =
                    selectedAccount?.type === "credit"
                      ? closingValueCents > 0
                        ? "#991b1b"
                        : "#166534"
                      : closingValueCents >= 0
                        ? "#166534"
                        : "#991b1b";

                  return (
                    <tr key={row.month} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={tableCellStyle}>{row.month}</td>
                      <td style={{ ...tableCellStyle, color: "#166534", fontWeight: 600 }}>
                        {formatCents(row.inflowsCents)}
                      </td>
                      <td style={{ ...tableCellStyle, color: "#991b1b", fontWeight: 600 }}>
                        {formatCents(row.outflowsCents)}
                      </td>
                      <td
                        style={{
                          ...tableCellStyle,
                          color: row.netChangeCents >= 0 ? "#166534" : "#991b1b",
                          fontWeight: 600,
                        }}
                      >
                        {formatCents(row.netChangeCents)}
                      </td>
                      <td
                        style={{
                          ...tableCellStyle,
                          color: closingColor,
                          fontWeight: 600,
                        }}
                      >
                        {closingLabel}: {formatCents(closingValueCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}