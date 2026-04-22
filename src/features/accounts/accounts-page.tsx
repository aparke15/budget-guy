import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import { useAppStore } from "../../app/store";
import {
  type AccountHistoryRange,
  getDisplayedAccountBalanceCents,
  getDisplayedAccountBalanceLabel,
  getAccountMonthlyHistoryRows,
  getAllAccountBalances,
} from "../../lib/account-balances";
import { getCurrentMonth } from "../../lib/dates";
import { createAccount } from "../../lib/factories";
import { formatCents } from "../../lib/money";
import {
  buildDeleteImpact,
  countRecurringRulesByAccountId,
  countById,
  createAccountFormValues,
  normalizeEntityName,
  parseAccountCreditLimitInput,
  parseAccountOpeningBalanceInput,
  sortItemsByName,
  type DeleteImpact,
  type PendingDelete,
} from "../settings/settings-helpers";
import type { AccountFormValues } from "../types";
import type { Account } from "../../types";
import { AccountEditor } from "../components/editors";
import {
  cardStyle,
  dangerButtonStyle,
  secondaryButtonStyle,
} from "../components/style-constants";

const historyRanges: Array<{ value: AccountHistoryRange; label: string }> = [
  { value: "6", label: "last 6 months" },
  { value: "12", label: "last 12 months" },
  { value: "all", label: "all" },
];

export function AccountsPage() {
  const accounts = useAppStore((state) => state.accounts);
  const transactions = useAppStore((state) => state.transactions);
  const recurringRules = useAppStore((state) => state.recurringRules);
  const budgets = useAppStore((state) => state.budgets);
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

  const [createValues, setCreateValues] = useState<AccountFormValues>(() =>
    createAccountFormValues()
  );
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<AccountFormValues>(() =>
    createAccountFormValues()
  );
  const [editError, setEditError] = useState("");

  const sortedAccounts = useMemo(() => sortItemsByName(accounts), [accounts]);

  const balanceRows = useMemo(
    () => getAllAccountBalances(accounts, transactions),
    [accounts, transactions]
  );

  const openingBalanceTransactionMap = useMemo(
    () =>
      new Map(
        accounts.map((account) => [
          account.id,
          transactions.find(
            (t) => t.accountId === account.id && t.kind === "opening-balance"
          ),
        ])
      ),
    [accounts, transactions]
  );

  const accountTransactionCounts = useMemo(
    () => countById(transactions, (t) => t.accountId),
    [transactions]
  );

  const accountRecurringRuleCounts = useMemo(
    () => countRecurringRulesByAccountId(recurringRules),
    [recurringRules]
  );

  const deleteImpact = useMemo<DeleteImpact | null>(
    () => buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules),
    [budgets, pendingDelete, recurringRules, transactions]
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

  useEffect(() => {
    if (editingId && !accounts.some((account) => account.id === editingId)) {
      setEditingId(null);
      setEditValues(createAccountFormValues());
      setEditError("");
    }
  }, [accounts, editingId]);

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

  function updateCreateField<K extends keyof AccountFormValues>(
    key: K,
    value: AccountFormValues[K]
  ) {
    setCreateValues((current) => ({
      ...current,
      creditLimit:
        key === "type" && value !== "credit" ? "" : current.creditLimit,
      [key]: value,
    }));
  }

  function updateEditField<K extends keyof AccountFormValues>(
    key: K,
    value: AccountFormValues[K]
  ) {
    setEditValues((current) => ({
      ...current,
      creditLimit:
        key === "type" && value !== "credit" ? "" : current.creditLimit,
      [key]: value,
    }));
  }

  function handleCreateSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    const normalizedName = normalizeEntityName(createValues.name);

    if (!normalizedName) {
      setCreateError("name is required");
      return;
    }

    if (
      accounts.some(
        (account) => normalizeEntityName(account.name) === normalizedName
      )
    ) {
      setCreateError("account name already exists");
      return;
    }

    const creditLimitInput = parseAccountCreditLimitInput(createValues.creditLimit);

    if (createValues.type === "credit") {
      if (creditLimitInput.hasValue && creditLimitInput.amountCents == null) {
        setCreateError("credit limit must be a valid amount");
        return;
      }
      if (
        creditLimitInput.amountCents != null &&
        creditLimitInput.amountCents <= 0
      ) {
        setCreateError("credit limit must be greater than zero");
        return;
      }
    }

    const openingBalanceInput = parseAccountOpeningBalanceInput(
      createValues.openingBalance
    );

    if (openingBalanceInput.hasValue && openingBalanceInput.amountCents == null) {
      setCreateError("opening balance must be a valid amount");
      return;
    }

    if (
      openingBalanceInput.amountCents != null &&
      openingBalanceInput.amountCents !== 0 &&
      !createValues.openingBalanceDate
    ) {
      setCreateError("opening balance date is required");
      return;
    }

    const account = createAccount({
      ...createValues,
      creditLimitCents:
        createValues.type === "credit"
          ? creditLimitInput.amountCents ?? undefined
          : undefined,
    });

    addAccount(account);

    if (
      openingBalanceInput.amountCents != null &&
      openingBalanceInput.amountCents !== 0
    ) {
      upsertAccountOpeningBalance(
        account.id,
        openingBalanceInput.amountCents,
        createValues.openingBalanceDate
      );
    }

    setCreateValues(createAccountFormValues());
  }

  function startEditing(account: Account) {
    setEditingId(account.id);
    setEditValues(
      createAccountFormValues(
        account,
        openingBalanceTransactionMap.get(account.id)
      )
    );
    setEditError("");
  }

  function handleEditSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    setEditError("");

    const normalizedName = normalizeEntityName(editValues.name);

    if (!normalizedName) {
      setEditError("name is required");
      return;
    }

    if (
      accounts.some(
        (account) =>
          account.id !== editingId &&
          normalizeEntityName(account.name) === normalizedName
      )
    ) {
      setEditError("account name already exists");
      return;
    }

    const creditLimitInput = parseAccountCreditLimitInput(editValues.creditLimit);

    if (editValues.type === "credit") {
      if (creditLimitInput.hasValue && creditLimitInput.amountCents == null) {
        setEditError("credit limit must be a valid amount");
        return;
      }
      if (
        creditLimitInput.amountCents != null &&
        creditLimitInput.amountCents <= 0
      ) {
        setEditError("credit limit must be greater than zero");
        return;
      }
    }

    const openingBalanceInput = parseAccountOpeningBalanceInput(
      editValues.openingBalance
    );

    if (openingBalanceInput.hasValue && openingBalanceInput.amountCents == null) {
      setEditError("opening balance must be a valid amount");
      return;
    }

    if (
      openingBalanceInput.amountCents != null &&
      openingBalanceInput.amountCents !== 0 &&
      !editValues.openingBalanceDate
    ) {
      setEditError("opening balance date is required");
      return;
    }

    updateAccount(editingId, {
      name: editValues.name.trim(),
      type: editValues.type,
      creditLimitCents:
        editValues.type === "credit"
          ? creditLimitInput.amountCents ?? undefined
          : undefined,
    });

    if (
      openingBalanceInput.amountCents != null &&
      openingBalanceInput.amountCents !== 0
    ) {
      upsertAccountOpeningBalance(
        editingId,
        openingBalanceInput.amountCents,
        editValues.openingBalanceDate
      );
    } else {
      deleteAccountOpeningBalance(editingId);
    }

    setEditingId(null);
    setEditValues(createAccountFormValues());
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;

    if (pendingDelete.entity === "account") {
      deleteAccount(pendingDelete.id);
    }

    setPendingDelete(null);
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>accounts</h1>
          <p>balances from transactions only. transfers included, budgets ignored.</p>
        </div>
      </div>

      {deleteImpact ? (
        <div className="delete-confirm">
          <h2>{deleteImpact.title}</h2>
          <p>{deleteImpact.description}</p>
          <div className="toolbar">
            <button
              type="button"
              onClick={handleConfirmDelete}
              style={{ ...dangerButtonStyle, background: "#fee2e2" }}
            >
              confirm delete
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              style={secondaryButtonStyle}
            >
              cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* ── current balances ── */}
      {accounts.length > 0 ? (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>current balances</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>account name</th>
                  <th>type</th>
                  <th>current view</th>
                  <th>limit</th>
                  <th>available credit</th>
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
                      <td style={{ fontWeight: isSelected ? 600 : 500 }}>
                        {row.accountName}
                      </td>
                      <td>
                        <span className={`badge badge--${row.accountType === "credit" ? "credit" : "neutral"}`}>
                          {row.accountType}
                        </span>
                      </td>
                      <td style={{ color: valueColor, fontWeight: 600 }}>
                        {row.displayLabel}: {formatCents(row.displayValueCents)}
                      </td>
                      <td>
                        {row.creditLimitCents != null
                          ? formatCents(row.creditLimitCents)
                          : "—"}
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
        </div>
      ) : null}

      {/* ── account history ── */}
      {accounts.length > 0 ? (
        <div style={cardStyle}>
          <div className="page-header" style={{ marginBottom: "1rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                {selectedAccount?.name ?? "selected account"} history
              </h2>
              <p style={{ margin: "0.35rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
                newest month first. closing{" "}
                {selectedAccount?.type === "credit" ? "owed" : "balance"} is
                cumulative through month end.
              </p>
            </div>
            <div className="toolbar">
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

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setSelectedAccountId(account.id)}
                style={{
                  ...secondaryButtonStyle,
                  background:
                    account.id === selectedAccountId ? "#e5e7eb" : secondaryButtonStyle.background,
                  fontWeight: account.id === selectedAccountId ? 600 : 500,
                }}
              >
                {account.name}
              </button>
            ))}
          </div>

          {historyRows.length === 0 ? (
            <p className="empty-state">no transactions for this account yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>month</th>
                    <th>inflows</th>
                    <th>outflows</th>
                    <th>net change</th>
                    <th>
                      closing{" "}
                      {selectedAccount?.type === "credit" ? "owed" : "balance"}
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
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td style={{ color: "#166534", fontWeight: 600 }}>
                          {formatCents(row.inflowsCents)}
                        </td>
                        <td style={{ color: "#991b1b", fontWeight: 600 }}>
                          {formatCents(row.outflowsCents)}
                        </td>
                        <td
                          style={{
                            color: row.netChangeCents >= 0 ? "#166534" : "#991b1b",
                            fontWeight: 600,
                          }}
                        >
                          {formatCents(row.netChangeCents)}
                        </td>
                        <td style={{ color: closingColor, fontWeight: 600 }}>
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
      ) : null}

      {/* ── manage accounts ── */}
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
          manage accounts ({accounts.length})
        </h2>
        <p style={{ margin: "0.35rem 0 1rem", color: "#6b7280", fontSize: "0.9rem" }}>
          add and edit accounts inline. deletes also remove linked transactions
          and recurring rules.
        </p>

        <div style={{ display: "grid", gap: "0.9rem" }}>
          <AccountEditor
            values={createValues}
            error={createError}
            submitLabel="add account"
            onSubmit={handleCreateSubmit}
            onChange={updateCreateField}
          />

          <div style={{ display: "grid", gap: "0.75rem" }}>
            {sortedAccounts.map((account) =>
              editingId === account.id ? (
                <div key={account.id} className="entity-edit-wrapper">
                  <AccountEditor
                    values={editValues}
                    error={editError}
                    submitLabel="save account"
                    onSubmit={handleEditSubmit}
                    onChange={updateEditField}
                    onCancel={() => {
                      setEditingId(null);
                      setEditValues(createAccountFormValues());
                      setEditError("");
                    }}
                  />
                </div>
              ) : (
                <div key={account.id} className="entity-row">
                  <div className="entity-row__body">
                    <div className="entity-row__name">{account.name}</div>
                    <div className="entity-row__meta">
                      <span
                        className={`badge badge--${account.type === "credit" ? "credit" : "neutral"}`}
                      >
                        {account.type}
                      </span>
                    </div>
                    <div className="entity-row__stats">
                      {accountTransactionCounts[account.id] ?? 0} transaction
                      {(accountTransactionCounts[account.id] ?? 0) === 1 ? "" : "s"} ·{" "}
                      {accountRecurringRuleCounts[account.id] ?? 0} recurring rule
                      {(accountRecurringRuleCounts[account.id] ?? 0) === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="entity-row__actions">
                    <button
                      type="button"
                      onClick={() => startEditing(account)}
                      style={secondaryButtonStyle}
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({
                          entity: "account",
                          id: account.id,
                          name: account.name,
                        })
                      }
                      style={dangerButtonStyle}
                    >
                      delete
                    </button>
                  </div>
                </div>
              )
            )}

            {accounts.length === 0 ? (
              <p className="empty-state">no accounts yet.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
