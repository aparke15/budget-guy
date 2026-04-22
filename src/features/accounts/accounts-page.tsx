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
import { DeleteImpactBanner } from "../components/delete-impact-banner";
import {
  buildDeleteImpact,
  countById,
  countRecurringRulesByAccountId,
  sortItemsByName,
  type DeleteImpact,
  type PendingDelete,
} from "../shared/management-helpers";
import { AccountManagementSection } from "./account-management-section";

const historyRanges: Array<{ value: AccountHistoryRange; label: string }> = [
  { value: "6", label: "last 6 months" },
  { value: "12", label: "last 12 months" },
  { value: "all", label: "all" },
];

export function AccountsPage() {
  const accounts = useAppStore((state) => state.accounts);
  const budgets = useAppStore((state) => state.budgets);
  const transactions = useAppStore((state) => state.transactions);
  const recurringRules = useAppStore((state) => state.recurringRules);
  const addAccount = useAppStore((state) => state.addAccount);
  const updateAccount = useAppStore((state) => state.updateAccount);
  const deleteAccount = useAppStore((state) => state.deleteAccount);
  const upsertAccountOpeningBalance = useAppStore(
    (state) => state.upsertAccountOpeningBalance
  );
  const deleteAccountOpeningBalance = useAppStore(
    (state) => state.deleteAccountOpeningBalance
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState<AccountHistoryRange>("6");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const sortedAccounts = useMemo(() => sortItemsByName(accounts), [accounts]);
  const accountTransactionCounts = useMemo(
    () => countById(transactions, (transaction) => transaction.accountId),
    [transactions]
  );
  const accountRecurringRuleCounts = useMemo(
    () => countRecurringRulesByAccountId(recurringRules),
    [recurringRules]
  );
  const deleteImpact = useMemo<DeleteImpact | null>(() => {
    return buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules);
  }, [budgets, pendingDelete, recurringRules, transactions]);

  const balanceRows = useMemo(
    () => getAllAccountBalances(sortedAccounts, transactions),
    [sortedAccounts, transactions]
  );

  useEffect(() => {
    if (sortedAccounts.length === 0) {
      setSelectedAccountId(null);
      return;
    }

    if (
      selectedAccountId &&
      sortedAccounts.some((account) => account.id === selectedAccountId)
    ) {
      return;
    }

    setSelectedAccountId(sortedAccounts[0]?.id ?? null);
  }, [selectedAccountId, sortedAccounts]);

  const selectedAccount = useMemo(
    () => sortedAccounts.find((account) => account.id === selectedAccountId),
    [selectedAccountId, sortedAccounts]
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

  function handleConfirmDelete() {
    if (!pendingDelete || pendingDelete.entity !== "account") {
      return;
    }

    deleteAccount(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <section className="page">
      <div className="page-header-copy">
        <h1 className="page-title">accounts</h1>
        <p className="page-subtitle">
          account setup, balances, and history all live here now.
        </p>
      </div>

      {deleteImpact ? (
        <DeleteImpactBanner
          deleteImpact={deleteImpact}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}

      <AccountManagementSection
        accounts={sortedAccounts}
        transactions={transactions}
        transactionCounts={accountTransactionCounts}
        recurringRuleCounts={accountRecurringRuleCounts}
        addAccount={addAccount}
        updateAccount={updateAccount}
        upsertAccountOpeningBalance={upsertAccountOpeningBalance}
        deleteAccountOpeningBalance={deleteAccountOpeningBalance}
        onRequestDelete={(account) =>
          setPendingDelete({
            entity: "account",
            id: account.id,
            name: account.name,
          })
        }
      />

      <div className="section">
        <div className="section-heading">
          <h2 className="section-title">current balances</h2>
        </div>

        {balanceRows.length === 0 ? (
          <p className="empty-state">
            add an account above to see balances and account history.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>account name</th>
                  <th>account type</th>
                  <th>current view</th>
                  <th>limit</th>
                  <th>available credit</th>
                </tr>
              </thead>
              <tbody>
                {balanceRows.map((row) => {
                  const isSelected = row.accountId === selectedAccountId;
                  const isCredit = row.accountType === "credit";
                  const valueClassName = isCredit
                    ? row.displayValueCents > 0
                      ? "text-negative"
                      : "text-positive"
                    : row.displayValueCents >= 0
                      ? "text-positive"
                      : "text-negative";

                  return (
                    <tr
                      key={row.accountId}
                      onClick={() => setSelectedAccountId(row.accountId)}
                      className={`selection-table-row${isSelected ? " is-selected" : ""}`}
                    >
                      <td className={isSelected ? "cell-amount" : undefined}>{row.accountName}</td>
                      <td>{row.accountType}</td>
                      <td className={`cell-amount ${valueClassName}`}>
                        {row.displayLabel}: {formatCents(row.displayValueCents)}
                      </td>
                      <td>
                        {row.creditLimitCents != null ? formatCents(row.creditLimitCents) : "—"}
                      </td>
                      <td>
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
        )}
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-heading">
            <h2 className="section-title">
              {selectedAccount?.name ?? "selected account"} history
            </h2>
            <p className="section-subtitle">
              newest month first. closing {selectedAccount?.type === "credit" ? "owed" : "balance"} is cumulative through month end.
            </p>
          </div>

          <div className="action-group">
            {historyRanges.map((option) => {
              const active = option.value === historyRange;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHistoryRange(option.value)}
                  className={`button button--secondary${active ? " button--active" : ""}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {selectedAccount == null ? (
          <p className="empty-state">
            select an account after creating one to review monthly history.
          </p>
        ) : historyRows.length === 0 ? (
          <p className="empty-state">no transactions for this account yet.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>month</th>
                  <th>inflows</th>
                  <th>outflows</th>
                  <th>net change</th>
                  <th>
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
                  const closingClassName =
                    selectedAccount?.type === "credit"
                      ? closingValueCents > 0
                        ? "text-negative"
                        : "text-positive"
                      : closingValueCents >= 0
                        ? "text-positive"
                        : "text-negative";

                  return (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td className="cell-amount text-positive">
                        {formatCents(row.inflowsCents)}
                      </td>
                      <td className="cell-amount text-negative">
                        {formatCents(row.outflowsCents)}
                      </td>
                      <td className={`cell-amount ${row.netChangeCents >= 0 ? "text-positive" : "text-negative"}`}>
                        {formatCents(row.netChangeCents)}
                      </td>
                      <td className={`cell-amount ${closingClassName}`}>
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
