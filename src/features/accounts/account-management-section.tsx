import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import { createAccount } from "../../lib/factories";
import type { Account, Transaction } from "../../types";
import { AccountEditor } from "../components/editors/account-editor";
import { normalizeEntityName } from "../shared/management-helpers";
import type { AccountFormValues } from "../types";
import {
  createAccountFormValues,
  getAccountOpeningBalanceTransaction,
  parseAccountCreditLimitInput,
  parseAccountOpeningBalanceInput,
} from "./account-management-helpers";

type AccountManagementSectionProps = {
  accounts: Account[];
  transactions: Transaction[];
  transactionCounts: Record<string, number>;
  recurringRuleCounts: Record<string, number>;
  addAccount: (input: Account) => void;
  updateAccount: (id: string, input: Partial<Account>) => void;
  upsertAccountOpeningBalance: (
    accountId: string,
    amountCents: number,
    date: string,
    note?: string
  ) => void;
  deleteAccountOpeningBalance: (accountId: string) => void;
  onRequestDelete: (account: Account) => void;
};

export function AccountManagementSection(props: AccountManagementSectionProps) {
  const {
    accounts,
    transactions,
    transactionCounts,
    recurringRuleCounts,
    addAccount,
    updateAccount,
    upsertAccountOpeningBalance,
    deleteAccountOpeningBalance,
    onRequestDelete,
  } = props;
  const [createValues, setCreateValues] = useState<AccountFormValues>(() =>
    createAccountFormValues()
  );
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<AccountFormValues>(() =>
    createAccountFormValues()
  );
  const [editError, setEditError] = useState("");

  const openingBalanceTransactionMap = useMemo(
    () =>
      new Map(
        accounts.map((account) => [
          account.id,
          getAccountOpeningBalanceTransaction(transactions, account.id),
        ])
      ),
    [accounts, transactions]
  );

  useEffect(() => {
    if (editingId && !accounts.some((account) => account.id === editingId)) {
      setEditingId(null);
      setEditValues(createAccountFormValues());
      setEditError("");
    }
  }, [accounts, editingId]);

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
      createAccountFormValues(account, openingBalanceTransactionMap.get(account.id))
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

  return (
    <div className="section">
      <div className="section-heading">
        <h2 className="section-title">manage accounts</h2>
        <p className="section-subtitle">
          add and edit accounts inline. deletes also remove linked transactions and recurring rules.
        </p>
      </div>

      <AccountEditor
        values={createValues}
        error={createError}
        submitLabel="add account"
        onSubmit={handleCreateSubmit}
        onChange={updateCreateField}
      />

      <div className="record-list">
        {accounts.map((account) =>
          editingId === account.id ? (
            <div key={account.id} className="record-item">
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
            <div key={account.id} className="record-item">
              <div className="record-copy">
                <div className="record-title">{account.name}</div>
                <div className="record-meta">{account.type}</div>
                <div className="record-detail">
                  {transactionCounts[account.id] ?? 0} transaction
                  {(transactionCounts[account.id] ?? 0) === 1 ? "" : "s"} · {recurringRuleCounts[account.id] ?? 0} recurring rule
                  {(recurringRuleCounts[account.id] ?? 0) === 1 ? "" : "s"}
                </div>
              </div>

              <div className="action-group">
                <button
                  type="button"
                  onClick={() => startEditing(account)}
                  className="button button--secondary button--small"
                >
                  edit
                </button>

                <button
                  type="button"
                  onClick={() => onRequestDelete(account)}
                  className="button button--danger button--small"
                >
                  delete
                </button>
              </div>
            </div>
          )
        )}

        {accounts.length === 0 ? <p className="empty-state">no accounts yet.</p> : null}
      </div>
    </div>
  );
}
