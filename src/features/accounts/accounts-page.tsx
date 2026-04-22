import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import { useAppStore } from "../../app/store";
import {
  type AccountHistoryRange,
  getAccountMonthlyHistoryRows,
  getAllAccountBalances,
  getDisplayedAccountBalanceCents,
  getDisplayedAccountBalanceLabel,
} from "../../lib/account-balances";
import { getCurrentMonth } from "../../lib/dates";
import { createAccount } from "../../lib/factories";
import { formatCents } from "../../lib/money";
import type { Account } from "../../types";
import { AccountEditor } from "../components/editors";
import {
  compactDangerButtonStyle,
  compactSecondaryButtonStyle,
  dangerButtonStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "../components/style-constants";
import {
  buildDeleteImpact,
  countById,
  countRecurringRulesByAccountId,
  createAccountFormValues,
  getAccountOpeningBalanceTransaction,
  normalizeEntityName,
  parseAccountCreditLimitInput,
  parseAccountOpeningBalanceInput,
  sortItemsByName,
  type DeleteImpact,
  type PendingDelete,
} from "../settings/settings-helpers";
import type { AccountFormValues } from "../types";

const historyRanges: Array<{ value: AccountHistoryRange; label: string }> = [
  { value: "6", label: "last 6 months" },
  { value: "12", label: "last 12 months" },
  { value: "all", label: "all" },
];

function getAccountTypeBadgeClass(type: Account["type"]) {
  return type === "credit" ? "badge badge--credit" : "badge badge--neutral";
}

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
    () => getAllAccountBalances(sortedAccounts, transactions),
    [sortedAccounts, transactions]
  );

  const openingBalanceTransactionMap = useMemo(
    () =>
      new Map(
        sortedAccounts.map((account) => [
          account.id,
          getAccountOpeningBalanceTransaction(transactions, account.id),
        ])
      ),
    [sortedAccounts, transactions]
  );

  const accountTransactionCounts = useMemo(
    () => countById(transactions, (transaction) => transaction.accountId),
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

  useEffect(() => {
    if (editingId && !sortedAccounts.some((account) => account.id === editingId)) {
      setEditingId(null);
      setEditValues(createAccountFormValues());
      setEditError("");
    }
  }, [editingId, sortedAccounts]);

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

  const creditAccountCount = useMemo(
    () => sortedAccounts.filter((account) => account.type === "credit").length,
    [sortedAccounts]
  );

  function updateCreateField<K extends keyof AccountFormValues>(
    key: K,
    value: AccountFormValues[K]
  ) {
    setCreateValues((current) => ({
      ...current,
      creditLimit: key === "type" && value !== "credit" ? "" : current.creditLimit,
      [key]: value,
    }));
  }

  function updateEditField<K extends keyof AccountFormValues>(
    key: K,
    value: AccountFormValues[K]
  ) {
    setEditValues((current) => ({
      ...current,
      creditLimit: key === "type" && value !== "credit" ? "" : current.creditLimit,
      [key]: value,
    }));
  }

  function setValidationError(message: string, currentId?: string) {
    if (currentId) {
      setEditError(message);
      return;
    }

    setCreateError(message);
  }

  function validateAccountForm(
    values: AccountFormValues,
    currentId?: string
  ): { creditLimitCents?: number; openingBalanceCents?: number } | null {
    const normalizedName = normalizeEntityName(values.name);

    if (!normalizedName) {
      setValidationError("name is required", currentId);
      return null;
    }

    if (
      sortedAccounts.some(
        (account) =>
          account.id !== currentId &&
          normalizeEntityName(account.name) === normalizedName
      )
    ) {
      setValidationError("account name already exists", currentId);
      return null;
    }

    const creditLimitInput = parseAccountCreditLimitInput(values.creditLimit);

    if (values.type === "credit") {
      if (creditLimitInput.hasValue && creditLimitInput.amountCents == null) {
        setValidationError("credit limit must be a valid amount", currentId);
        return null;
      }

      if (
        creditLimitInput.amountCents != null &&
        creditLimitInput.amountCents <= 0
      ) {
        setValidationError("credit limit must be greater than zero", currentId);
        return null;
      }
    }

    const openingBalanceInput = parseAccountOpeningBalanceInput(
      values.openingBalance
    );

    if (openingBalanceInput.hasValue && openingBalanceInput.amountCents == null) {
      setValidationError("opening balance must be a valid amount", currentId);
      return null;
    }

    if (
      openingBalanceInput.amountCents != null &&
      openingBalanceInput.amountCents !== 0 &&
      !values.openingBalanceDate
    ) {
      setValidationError("opening balance date is required", currentId);
      return null;
    }

    return {
      creditLimitCents:
        values.type === "credit"
          ? creditLimitInput.amountCents ?? undefined
          : undefined,
      openingBalanceCents: openingBalanceInput.amountCents ?? undefined,
    };
  }

  function handleCreateSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    const validated = validateAccountForm(createValues);

    if (!validated) {
      return;
    }

    const account = createAccount({
      name: createValues.name,
      type: createValues.type,
      creditLimitCents: validated.creditLimitCents,
    });

    addAccount(account);

    if (
      validated.openingBalanceCents != null &&
      validated.openingBalanceCents !== 0
    ) {
      upsertAccountOpeningBalance(
        account.id,
        validated.openingBalanceCents,
        createValues.openingBalanceDate
      );
    }

    setCreateValues(createAccountFormValues());
    setSelectedAccountId(account.id);
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

    const validated = validateAccountForm(editValues, editingId);

    if (!validated) {
      return;
    }

    updateAccount(editingId, {
      name: editValues.name.trim(),
      type: editValues.type,
      creditLimitCents: validated.creditLimitCents,
    });

    if (
      validated.openingBalanceCents != null &&
      validated.openingBalanceCents !== 0
    ) {
      upsertAccountOpeningBalance(
        editingId,
        validated.openingBalanceCents,
        editValues.openingBalanceDate
      );
    } else {
      deleteAccountOpeningBalance(editingId);
    }

    setEditingId(null);
    setEditValues(createAccountFormValues());
  }

  function handleConfirmDelete() {
    if (!pendingDelete || pendingDelete.entity !== "account") {
      return;
    }

    deleteAccount(pendingDelete.id);
    setPendingDelete(null);

    if (editingId === pendingDelete.id) {
      setEditingId(null);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">accounts</h1>
          <p className="page-subtitle">
            balances and history still come straight from transactions. account
            setup, opening balances, credit limits, and deletes now live here too.
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            onClick={() => {
              document
                .getElementById("account-create-form")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            style={primaryButtonStyle}
          >
            new account
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card__label">accounts</div>
          <div className="summary-card__value">{sortedAccounts.length}</div>
        </div>
        <div className="summary-card summary-card--info">
          <div className="summary-card__label">transactions</div>
          <div className="summary-card__value">{transactions.length}</div>
        </div>
        <div className="summary-card summary-card--good">
          <div className="summary-card__label">credit accounts</div>
          <div className="summary-card__value">{creditAccountCount}</div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title-group">
            <h2 className="section-title">current balances</h2>
            <p className="section-subtitle">
              select an account row to inspect monthly history.
            </p>
          </div>
        </div>

        {balanceRows.length === 0 ? (
          <p className="empty-state">
            no accounts yet. create one below to start tracking balances.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  <th>account</th>
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
                  const valueClass = isCredit
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
                      className={isSelected ? "table-row--selected" : undefined}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ fontWeight: isSelected ? 700 : 600 }}>
                        {row.accountName}
                      </td>
                      <td>
                        <span className={getAccountTypeBadgeClass(row.accountType)}>
                          {row.accountType}
                        </span>
                      </td>
                      <td className={valueClass} style={{ fontWeight: 700 }}>
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
        )}
      </div>

      {deleteImpact ? (
        <div className="section-card section-card--danger">
          <div className="section-header">
            <div className="section-title-group">
              <h2 className="section-title" style={{ color: "#991b1b" }}>
                {deleteImpact.title}
              </h2>
              <p className="section-subtitle" style={{ color: "#7f1d1d" }}>
                {deleteImpact.description}
              </p>
            </div>

            <div className="button-row">
              <button type="button" onClick={handleConfirmDelete} style={dangerButtonStyle}>
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
        </div>
      ) : null}

      <div className="section-card stack-md" id="account-create-form">
        <div className="section-header">
          <div className="section-title-group">
            <h2 className="section-title">account manager</h2>
            <p className="section-subtitle">
              create, edit, or remove accounts inline. deletes still cascade through
              linked transactions and recurring rules.
            </p>
          </div>
        </div>

        <AccountEditor
          values={createValues}
          error={createError}
          submitLabel="add account"
          onSubmit={handleCreateSubmit}
          onChange={updateCreateField}
        />

        <div className="entity-list">
          {sortedAccounts.map((account) => {
            const openingBalance = openingBalanceTransactionMap.get(account.id);

            return editingId === account.id ? (
              <div key={account.id} className="entity-card">
                <div style={{ width: "100%" }}>
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
              </div>
            ) : (
              <div key={account.id} className="entity-card">
                <div className="entity-card__body">
                  <div className="entity-card__title">
                    <span>{account.name}</span>
                    <span className={getAccountTypeBadgeClass(account.type)}>
                      {account.type}
                    </span>
                    {openingBalance ? (
                      <span className="badge badge--opening">opening balance</span>
                    ) : null}
                  </div>

                  <div className="entity-card__meta">
                    {accountTransactionCounts[account.id] ?? 0} transaction
                    {(accountTransactionCounts[account.id] ?? 0) === 1 ? "" : "s"} · {accountRecurringRuleCounts[account.id] ?? 0} recurring rule
                    {(accountRecurringRuleCounts[account.id] ?? 0) === 1 ? "" : "s"}
                  </div>

                  {account.type === "credit" && account.creditLimitCents != null ? (
                    <div className="entity-card__meta">
                      credit limit: {formatCents(account.creditLimitCents)}
                    </div>
                  ) : null}

                  {openingBalance ? (
                    <div className="entity-card__meta">
                      opening balance {formatCents(openingBalance.amountCents)} on {openingBalance.date}
                    </div>
                  ) : null}
                </div>

                <div className="table-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      startEditing(account);
                    }}
                    style={compactSecondaryButtonStyle}
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    style={compactSecondaryButtonStyle}
                  >
                    view history
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
                    style={compactDangerButtonStyle}
                  >
                    delete
                  </button>
                </div>
              </div>
            );
          })}

          {sortedAccounts.length === 0 ? (
            <p className="empty-state">
              no accounts yet. checking, savings, cash, or credit all start here.
            </p>
          ) : null}
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title-group">
            <h2 className="section-title">
              {selectedAccount?.name ?? "selected account"} history
            </h2>
            <p className="section-subtitle">
              newest month first. closing {selectedAccount?.type === "credit" ? "owed" : "balance"} stays cumulative through month end.
            </p>
          </div>

          <div className="button-row">
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
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {!selectedAccount ? (
          <p className="empty-state">
            select an account to inspect monthly inflows, outflows, and closing values.
          </p>
        ) : historyRows.length === 0 ? (
          <p className="empty-state">no transactions for this account yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  <th>month</th>
                  <th>inflows</th>
                  <th>outflows</th>
                  <th>net change</th>
                  <th>
                    closing {selectedAccount.type === "credit" ? "owed" : "balance"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => {
                  const closingValueCents = getDisplayedAccountBalanceCents(
                    selectedAccount,
                    row.closingBalanceCents
                  );
                  const closingLabel = getDisplayedAccountBalanceLabel(selectedAccount);
                  const closingClass =
                    selectedAccount.type === "credit"
                      ? closingValueCents > 0
                        ? "text-negative"
                        : "text-positive"
                      : closingValueCents >= 0
                        ? "text-positive"
                        : "text-negative";

                  return (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td className="text-positive" style={{ fontWeight: 700 }}>
                        {formatCents(row.inflowsCents)}
                      </td>
                      <td className="text-negative" style={{ fontWeight: 700 }}>
                        {formatCents(row.outflowsCents)}
                      </td>
                      <td
                        className={row.netChangeCents >= 0 ? "text-positive" : "text-negative"}
                        style={{ fontWeight: 700 }}
                      >
                        {formatCents(row.netChangeCents)}
                      </td>
                      <td className={closingClass} style={{ fontWeight: 700 }}>
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