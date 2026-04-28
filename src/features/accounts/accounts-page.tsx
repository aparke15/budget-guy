import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import { useAppStore } from "../../app/store";
import {
  type AccountHistoryRange,
  getAccountMonthlyHistoryRows,
  getAllAccountBalances,
  getDisplayedAccountBalanceCents,
} from "../../lib/account-balances";
import { getCurrentMonth } from "../../lib/dates";
import { createAccount } from "../../lib/factories";
import { formatCents } from "../../lib/money";
import type { Account } from "../../types";
import { AccountEditor } from "../components/editors";
import {
  buildDeleteImpact,
  countById,
  countRecurringRulesByAccountId,
  createAccountFormValues,
  getAccountOpeningBalanceTransaction,
  normalizeEntityName,
  normalizeAccountOpeningBalanceCents,
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
  const [expandedBalanceAccountId, setExpandedBalanceAccountId] = useState<string | null>(null);
  const [expandedHistoryMonth, setExpandedHistoryMonth] = useState<string | null>(null);

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
      openingBalanceCents:
        openingBalanceInput.amountCents != null
          ? normalizeAccountOpeningBalanceCents(
              values.type,
              openingBalanceInput.amountCents
            )
          : undefined,
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

  function toggleExpandedBalanceAccount(accountId: string) {
    setSelectedAccountId(accountId);
    setExpandedBalanceAccountId((current) => (current === accountId ? null : accountId));
  }

  function toggleExpandedHistoryRow(month: string) {
    setExpandedHistoryMonth((current) => (current === month ? null : month));
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
            className="button button--primary"
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

      <div className="section-card section-card--surface">
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
          <>
            <div className="table-wrap responsive-table-desktop">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>account</th>
                    <th>type</th>
                    <th className="money-column">balance</th>
                    <th className="money-column">limit</th>
                    <th className="money-column">available credit</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceRows.map((row) => {
                    const isSelected = row.accountId === selectedAccountId;
                    const valueClass =
                      row.displayValueCents > 0
                        ? "text-positive"
                        : row.displayValueCents < 0
                          ? "text-negative"
                          : "";

                    return (
                      <tr
                        key={row.accountId}
                        onClick={() => setSelectedAccountId(row.accountId)}
                        className={isSelected ? "table-row--selected row-clickable" : "row-clickable"}
                      >
                        <td className={isSelected ? "font-bold" : "font-semibold"}>
                          {row.accountName}
                        </td>
                        <td>
                          <span className={getAccountTypeBadgeClass(row.accountType)}>
                            {row.accountType}
                          </span>
                        </td>
                        <td className={`money-column ${valueClass} font-bold`}>
                          {formatCents(row.displayValueCents)}
                        </td>
                        <td className="money-column">
                          {row.creditLimitCents != null
                            ? formatCents(row.creditLimitCents)
                            : "—"}
                        </td>
                        <td className="money-column">
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

            <div className="responsive-table-mobile table-card-list" aria-label="account balances list">
              {balanceRows.map((row) => {
                const isSelected = row.accountId === selectedAccountId;
                const isExpanded = expandedBalanceAccountId === row.accountId;
                const valueClass =
                  row.displayValueCents > 0
                    ? "text-positive"
                    : row.displayValueCents < 0
                      ? "text-negative"
                      : "";

                return (
                  <article
                    key={row.accountId}
                    className={
                      isSelected
                        ? isExpanded
                          ? "table-card table-card--selected table-card--expanded"
                          : "table-card table-card--selected"
                        : isExpanded
                          ? "table-card table-card--expanded"
                          : "table-card"
                    }
                  >
                    <button
                      type="button"
                      className="table-card__summary"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpandedBalanceAccount(row.accountId)}
                    >
                      <div className="table-card__top">
                        <div className="table-card__details-group">
                          <div className="table-card__details">{row.accountName}</div>
                        </div>

                        <div className={`table-card__amount ${valueClass} font-bold`}>
                          {formatCents(row.displayValueCents)}
                        </div>
                      </div>

                      <div className="table-card__summary-footer">
                        <div className="table-card__summary-meta">
                          <span>{row.displayLabel}</span>
                        </div>

                        <span className="table-card__chevron" aria-hidden="true">
                          {isExpanded ? "▴" : "▾"}
                        </span>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="table-card__expanded-details">
                        <div className="badge-row">
                          <span className={getAccountTypeBadgeClass(row.accountType)}>
                            {row.accountType}
                          </span>
                          {isSelected ? <span className="badge badge--neutral">selected</span> : null}
                        </div>

                        <div className="table-card__meta-line">
                          <span className="table-card__eyebrow">credit limit</span>
                          <span>
                            {row.creditLimitCents != null
                              ? formatCents(row.creditLimitCents)
                              : "—"}
                          </span>
                        </div>

                        {row.availableCreditCents != null ? (
                          <div className="table-card__meta-line">
                            <span className="table-card__eyebrow">available credit</span>
                            <span>{formatCents(row.availableCreditCents)}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      {deleteImpact ? (
        <div className="section-card section-card--danger">
          <div className="section-header">
            <div className="section-title-group">
              <h2 className="section-title">
                {deleteImpact.title}
              </h2>
              <p className="section-subtitle">
                {deleteImpact.description}
              </p>
            </div>

            <div className="button-row">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="button button--danger"
              >
                confirm delete
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="button button--secondary"
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
                <div className="full-width">
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
                    className="button button--secondary button--compact"
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className="button button--secondary button--compact"
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
                    className="button button--danger button--compact"
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

      <div className="section-card section-card--surface">
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
                  className={
                    active
                      ? "button button--secondary button--selected"
                      : "button button--secondary"
                  }
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
          <>
            <div className="table-wrap responsive-table-desktop">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>month</th>
                    <th className="money-column">inflows</th>
                    <th className="money-column">outflows</th>
                    <th className="money-column">net change</th>
                    <th className="money-column">closing balance</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => {
                    const closingValueCents = getDisplayedAccountBalanceCents(
                      selectedAccount,
                      row.closingBalanceCents
                    );
                    const closingClass =
                      closingValueCents > 0
                        ? "text-positive"
                        : closingValueCents < 0
                          ? "text-negative"
                          : "";

                    return (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td className="money-column text-positive font-bold">
                          {formatCents(row.inflowsCents)}
                        </td>
                        <td className="money-column text-negative font-bold">
                          {formatCents(row.outflowsCents)}
                        </td>
                        <td
                          className={`money-column ${row.netChangeCents >= 0 ? "text-positive" : "text-negative"} font-bold`}
                        >
                          {formatCents(row.netChangeCents)}
                        </td>
                        <td className={`money-column ${closingClass} font-bold`}>
                          {formatCents(closingValueCents)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="responsive-table-mobile table-card-list"
              aria-label={`${selectedAccount.name} history list`}
            >
              {historyRows.map((row) => {
                const closingValueCents = getDisplayedAccountBalanceCents(
                  selectedAccount,
                  row.closingBalanceCents
                );
                const isExpanded = expandedHistoryMonth === row.month;
                const closingClass =
                  closingValueCents > 0
                    ? "text-positive"
                    : closingValueCents < 0
                      ? "text-negative"
                      : "";

                return (
                  <article
                    key={row.month}
                    className={
                      isExpanded ? "table-card table-card--expanded" : "table-card"
                    }
                  >
                    <button
                      type="button"
                      className="table-card__summary"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpandedHistoryRow(row.month)}
                    >
                      <div className="table-card__top">
                        <div className="table-card__details-group">
                          <div className="table-card__details">{row.month}</div>
                        </div>

                        <div className={`table-card__amount ${closingClass} font-bold`}>
                          {formatCents(closingValueCents)}
                        </div>
                      </div>

                      <div className="table-card__summary-footer">
                        <div className="table-card__summary-meta">
                          <span>closing balance</span>
                        </div>

                        <span className="table-card__chevron" aria-hidden="true">
                          {isExpanded ? "▴" : "▾"}
                        </span>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="table-card__expanded-details">
                        <div className="table-card__meta-line">
                          <span className="table-card__eyebrow">inflows</span>
                          <span className="text-positive font-bold">{formatCents(row.inflowsCents)}</span>
                        </div>

                        <div className="table-card__meta-line">
                          <span className="table-card__eyebrow">outflows</span>
                          <span className="text-negative font-bold">{formatCents(row.outflowsCents)}</span>
                        </div>

                        <div className="table-card__meta-line">
                          <span className="table-card__eyebrow">net change</span>
                          <span className={row.netChangeCents >= 0 ? "text-positive font-bold" : "text-negative font-bold"}>
                            {formatCents(row.netChangeCents)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}