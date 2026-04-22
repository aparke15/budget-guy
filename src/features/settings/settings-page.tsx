import { useEffect, useMemo, useState, type ChangeEvent, type SubmitEvent } from "react";

import { useAppStore } from "../../app/store";
import {
  buildBackupFileName,
  buildPersistedStateSnapshot,
  exportPersistedStateJson,
  parsePersistedStateJson,
} from "../../app/storage";
import {
  createAccount,
  createCategory,
} from "../../lib/factories";
import { formatCents } from "../../lib/money";
import {
  buildDuplicateName,
  buildDeleteImpact,
  countRecurringRulesByAccountId,
  countById,
  createAccountFormValues,
  getAccountOpeningBalanceTransaction,
  normalizeEntityName,
  parseAccountCreditLimitInput,
  parseAccountOpeningBalanceInput,
  sortItemsByName,
  type DeleteImpact,
  type PendingDelete,
} from "./settings-helpers";
import type {
  AccountFormValues,
  CategoryFormValues,
  RecurringRuleFormValues,
} from "../types";
import type {
  Account,
  Budget,
  Category,
  PersistedState,
  RecurringRule,
  Transaction,
} from "../../types";
import { AccountEditor, CategoryEditor, RecurringRuleEditor } from "../components/editors";
import { cardStyle, dangerButtonStyle, primaryButtonStyle, secondaryButtonStyle } from "../components/style-constants";
import { buildRecurringRuleCandidate, createRecurringRuleFormValues, ensureRecurringFormReferences, getRecurringDetails, updateRecurringFrequency, updateRecurringKind, updateRecurringStartDate } from "../recurring/recurring-helpers";

function createCategoryFormValues(): CategoryFormValues {
  return {
    name: "",
    kind: "expense",
  };
}

type AccountsSectionProps = {
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

function AccountsSection(props: AccountsSectionProps) {
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

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
        accounts ({accounts.length})
      </h2>
      <p style={{ margin: "0.35rem 0 1rem", color: "#6b7280", fontSize: "0.9rem" }}>
        add and edit accounts inline. deletes will also remove linked transactions and recurring rules.
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
          {accounts.map((account) =>
            editingId === account.id ? (
              <div
                key={account.id}
                style={{ border: "1px solid #e5e7eb", borderRadius: "0.75rem", padding: "0.9rem" }}
              >
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
              <div
                key={account.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.8rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.75rem",
                  padding: "0.9rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{account.name}</div>
                  <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                    {account.type}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                    {transactionCounts[account.id] ?? 0} transaction
                    {(transactionCounts[account.id] ?? 0) === 1 ? "" : "s"} · {recurringRuleCounts[account.id] ?? 0} recurring rule
                    {(recurringRuleCounts[account.id] ?? 0) === 1 ? "" : "s"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => startEditing(account)}
                    style={secondaryButtonStyle}
                  >
                    edit
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestDelete(account)}
                    style={dangerButtonStyle}
                  >
                    delete
                  </button>
                </div>
              </div>
            )
          )}

          {accounts.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
              no accounts yet.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type CategoriesSectionProps = {
  categories: Category[];
  budgetCounts: Record<string, number>;
  transactionCounts: Record<string, number>;
  recurringRuleCounts: Record<string, number>;
  addCategory: (input: Category) => void;
  updateCategory: (id: string, input: Partial<Category>) => void;
  onRequestDelete: (category: Category) => void;
};

function CategoriesSection(props: CategoriesSectionProps) {
  const {
    categories,
    budgetCounts,
    transactionCounts,
    recurringRuleCounts,
    addCategory,
    updateCategory,
    onRequestDelete,
  } = props;
  const [createValues, setCreateValues] = useState<CategoryFormValues>(() =>
    createCategoryFormValues()
  );
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<CategoryFormValues>(() =>
    createCategoryFormValues()
  );
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (editingId && !categories.some((category) => category.id === editingId)) {
      setEditingId(null);
      setEditValues(createCategoryFormValues());
      setEditError("");
    }
  }, [categories, editingId]);

  function updateCreateField<K extends keyof CategoryFormValues>(
    key: K,
    value: CategoryFormValues[K]
  ) {
    setCreateValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateEditField<K extends keyof CategoryFormValues>(
    key: K,
    value: CategoryFormValues[K]
  ) {
    setEditValues((current) => ({
      ...current,
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
      categories.some(
        (category) => normalizeEntityName(category.name) === normalizedName
      )
    ) {
      setCreateError("category name already exists");
      return;
    }

    addCategory(createCategory(createValues));
    setCreateValues(createCategoryFormValues());
  }

  function startEditing(category: Category) {
    setEditingId(category.id);
    setEditValues({
      name: category.name,
      kind: category.kind,
    });
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
      categories.some(
        (category) =>
          category.id !== editingId &&
          normalizeEntityName(category.name) === normalizedName
      )
    ) {
      setEditError("category name already exists");
      return;
    }

    updateCategory(editingId, {
      name: editValues.name.trim(),
      kind: editValues.kind,
    });
    setEditingId(null);
    setEditValues(createCategoryFormValues());
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
        categories ({categories.length})
      </h2>
      <p style={{ margin: "0.35rem 0 1rem", color: "#6b7280", fontSize: "0.9rem" }}>
        keep category setup lightweight. deletes also remove linked budgets, transactions, and recurring rules.
      </p>

      <div style={{ display: "grid", gap: "0.9rem" }}>
        <CategoryEditor
          values={createValues}
          error={createError}
          submitLabel="add category"
          onSubmit={handleCreateSubmit}
          onChange={updateCreateField}
        />

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {categories.map((category) =>
            editingId === category.id ? (
              <div
                key={category.id}
                style={{ border: "1px solid #e5e7eb", borderRadius: "0.75rem", padding: "0.9rem" }}
              >
                <CategoryEditor
                  values={editValues}
                  error={editError}
                  submitLabel="save category"
                  onSubmit={handleEditSubmit}
                  onChange={updateEditField}
                  onCancel={() => {
                    setEditingId(null);
                    setEditValues(createCategoryFormValues());
                    setEditError("");
                  }}
                />
              </div>
            ) : (
              <div
                key={category.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.8rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.75rem",
                  padding: "0.9rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{category.name}</div>
                  <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                    {category.kind}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                    {budgetCounts[category.id] ?? 0} budget
                    {(budgetCounts[category.id] ?? 0) === 1 ? "" : "s"} · {transactionCounts[category.id] ?? 0} transaction
                    {(transactionCounts[category.id] ?? 0) === 1 ? "" : "s"} · {recurringRuleCounts[category.id] ?? 0} recurring rule
                    {(recurringRuleCounts[category.id] ?? 0) === 1 ? "" : "s"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => startEditing(category)}
                    style={secondaryButtonStyle}
                  >
                    edit
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestDelete(category)}
                    style={dangerButtonStyle}
                  >
                    delete
                  </button>
                </div>
              </div>
            )
          )}

          {categories.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
              no categories yet.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type RecurringRulesSectionProps = {
  accounts: Account[];
  categories: Category[];
  recurringRules: RecurringRule[];
  generatedTransactionCounts: Record<string, number>;
  addRecurringRule: (input: RecurringRule) => void;
  updateRecurringRule: (id: string, input: Partial<RecurringRule>) => void;
  onRequestDelete: (rule: RecurringRule) => void;
};

function RecurringRulesSection(props: RecurringRulesSectionProps) {
  const {
    accounts,
    categories,
    recurringRules,
    generatedTransactionCounts,
    addRecurringRule,
    updateRecurringRule,
    onRequestDelete,
  } = props;
  const [createValues, setCreateValues] = useState<RecurringRuleFormValues>(() =>
    createRecurringRuleFormValues(accounts, categories)
  );
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<RecurringRuleFormValues>(() =>
    createRecurringRuleFormValues(accounts, categories)
  );
  const [editError, setEditError] = useState("");

  useEffect(() => {
    setCreateValues((current) =>
      ensureRecurringFormReferences(current, accounts, categories)
    );
  }, [accounts, categories]);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    const currentRule = recurringRules.find((rule) => rule.id === editingId);

    if (!currentRule) {
      setEditingId(null);
      setEditValues(createRecurringRuleFormValues(accounts, categories));
      setEditError("");
      return;
    }

    setEditValues((current) =>
      ensureRecurringFormReferences(current, accounts, categories)
    );
  }, [accounts, categories, editingId, recurringRules]);

  function updateCreateField<K extends keyof RecurringRuleFormValues>(
    key: K,
    value: RecurringRuleFormValues[K]
  ) {
    setCreateValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateEditField<K extends keyof RecurringRuleFormValues>(
    key: K,
    value: RecurringRuleFormValues[K]
  ) {
    setEditValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCreateSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    try {
      addRecurringRule(buildRecurringRuleCandidate(createValues, categories));
      setCreateValues(createRecurringRuleFormValues(accounts, categories));
    } catch (caught) {
      setCreateError(
        caught instanceof Error
          ? caught.message
          : "failed to save recurring rule"
      );
    }
  }

  function startEditing(rule: RecurringRule) {
    setEditingId(rule.id);
    setEditValues(createRecurringRuleFormValues(accounts, categories, rule));
    setEditError("");
  }

  function duplicateRule(rule: RecurringRule) {
    const duplicateValues = createRecurringRuleFormValues(accounts, categories, rule);

    setCreateValues({
      ...duplicateValues,
      name: buildDuplicateName(
        rule.name,
        recurringRules.map((currentRule) => currentRule.name)
      ),
    });
    setCreateError("");
  }

  function handleEditSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    const existingRule = recurringRules.find((rule) => rule.id === editingId);

    if (!existingRule) {
      setEditError("recurring rule no longer exists");
      return;
    }

    setEditError("");

    try {
      const candidate = buildRecurringRuleCandidate(
        editValues,
        categories,
        existingRule
      );

      updateRecurringRule(editingId, {
        name: candidate.name,
        amountCents: candidate.amountCents,
        accountId: candidate.accountId,
        categoryId: candidate.categoryId,
        merchant: candidate.merchant,
        note: candidate.note,
        frequency: candidate.frequency,
        startDate: candidate.startDate,
        endDate: candidate.endDate,
        active: candidate.active,
        dayOfMonth: candidate.dayOfMonth,
        dayOfWeek: candidate.dayOfWeek,
      });
      setEditingId(null);
      setEditValues(createRecurringRuleFormValues(accounts, categories));
    } catch (caught) {
      setEditError(
        caught instanceof Error
          ? caught.message
          : "failed to save recurring rule"
      );
    }
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
        recurring rules ({recurringRules.length})
      </h2>
      <p style={{ margin: "0.35rem 0 1rem", color: "#6b7280", fontSize: "0.9rem" }}>
        recurring rules stay manual-run. standard rules follow category sign; transfer rules generate linked transfer pairs.
      </p>

      <div style={{ display: "grid", gap: "0.9rem" }}>
        <RecurringRuleEditor
          values={createValues}
          error={createError}
          accounts={accounts}
          categories={categories}
          submitLabel="add recurring rule"
          submitDisabled={
            accounts.length === 0 ||
            (createValues.kind === "standard" && categories.length === 0) ||
            (createValues.kind === "transfer" && accounts.length < 2)
          }
          onSubmit={handleCreateSubmit}
          onChange={updateCreateField}
          onKindChange={(kind) =>
            setCreateValues((current) =>
              updateRecurringKind(current, kind, accounts, categories)
            )
          }
          onFrequencyChange={(frequency) =>
            setCreateValues((current) => updateRecurringFrequency(current, frequency))
          }
          onStartDateChange={(startDate) =>
            setCreateValues((current) => updateRecurringStartDate(current, startDate))
          }
        />

        {accounts.length === 0 ? (
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
            add at least one account before saving recurring rules.
          </p>
        ) : createValues.kind === "standard" && categories.length === 0 ? (
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
            add at least one category before saving standard recurring rules.
          </p>
        ) : createValues.kind === "transfer" && accounts.length < 2 ? (
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
            add at least two accounts before saving recurring transfer rules.
          </p>
        ) : null}

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {recurringRules.map((rule) => {
            const accountName =
              accounts.find((account) => account.id === rule.accountId)?.name ??
              "unknown account";
            const toAccountName =
              rule.kind === "transfer"
                ? accounts.find((account) => account.id === rule.toAccountId)?.name ??
                  "unknown account"
                : null;
            const categoryMatch = categories.find(
              (category) => category.id === rule.categoryId
            );

            return editingId === rule.id ? (
              <div
                key={rule.id}
                style={{ border: "1px solid #e5e7eb", borderRadius: "0.75rem", padding: "0.9rem" }}
              >
                <RecurringRuleEditor
                  values={editValues}
                  error={editError}
                  accounts={accounts}
                  categories={categories}
                  submitLabel="save recurring rule"
                  submitDisabled={
                    accounts.length === 0 ||
                    (editValues.kind === "standard" && categories.length === 0) ||
                    (editValues.kind === "transfer" && accounts.length < 2)
                  }
                  onSubmit={handleEditSubmit}
                  onChange={updateEditField}
                  onKindChange={(kind) =>
                    setEditValues((current) =>
                      updateRecurringKind(current, kind, accounts, categories)
                    )
                  }
                  onFrequencyChange={(frequency) =>
                    setEditValues((current) => updateRecurringFrequency(current, frequency))
                  }
                  onStartDateChange={(startDate) =>
                    setEditValues((current) => updateRecurringStartDate(current, startDate))
                  }
                  onCancel={() => {
                    setEditingId(null);
                    setEditValues(createRecurringRuleFormValues(accounts, categories));
                    setEditError("");
                  }}
                />
              </div>
            ) : (
              <div
                key={rule.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.8rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.75rem",
                  padding: "0.9rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: "0.2rem" }}>
                  <div style={{ fontWeight: 600 }}>{rule.name}</div>
                  <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                    {rule.kind} · {formatCents(Math.abs(rule.amountCents))} · {getRecurringDetails(rule)}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                    {rule.kind === "transfer"
                      ? `${accountName} → ${toAccountName}`
                      : `${accountName} · ${categoryMatch?.name ?? "unknown category"} (${categoryMatch?.kind ?? "n/a"})`}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                    starts {rule.startDate}
                    {rule.endDate ? ` · ends ${rule.endDate}` : ""}
                    {rule.active ? " · active" : " · inactive"}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                    {generatedTransactionCounts[rule.id] ?? 0} generated transaction
                    {(generatedTransactionCounts[rule.id] ?? 0) === 1 ? "" : "s"} already in history
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => startEditing(rule)}
                    style={secondaryButtonStyle}
                  >
                    edit
                  </button>

                  <button
                    type="button"
                    onClick={() => duplicateRule(rule)}
                    style={secondaryButtonStyle}
                  >
                    duplicate
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestDelete(rule)}
                    style={dangerButtonStyle}
                  >
                    delete
                  </button>
                </div>
              </div>
            );
          })}

          {recurringRules.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
              no recurring rules yet.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type DataManagementSectionProps = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
  replacePersistedState: (state: PersistedState) => void;
};

function DataManagementSection(props: DataManagementSectionProps) {
  const {
    accounts,
    categories,
    transactions,
    budgets,
    recurringRules,
    replacePersistedState,
  } = props;
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");

  function handleExport() {
    const state = buildPersistedStateSnapshot({
      accounts,
      categories,
      transactions,
      budgets,
      recurringRules,
    });
    const json = exportPersistedStateJson(state);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = buildBackupFileName();
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setImportError("");
    setImportSuccess("");

    if (!file) {
      return;
    }

    const raw = await file.text();
    const result = parsePersistedStateJson(raw);

    if (result.success) {
      const confirmed = window.confirm(
        "importing a backup replaces all current data. continue?"
      );

      if (!confirmed) {
        event.target.value = "";
        return;
      }

      replacePersistedState(result.data);
      setImportSuccess("backup imported successfully");
      event.target.value = "";
      return;
    }

    setImportError("error" in result ? result.error : "invalid backup file");
    event.target.value = "";
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>data management</h2>
      <p style={{ margin: "0.35rem 0 1rem", color: "#6b7280", fontSize: "0.9rem" }}>
        export a full json backup or import one to replace all current data after confirmation.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={handleExport}
          style={primaryButtonStyle}
        >
          export json backup
        </button>

        <label
          style={{
            ...secondaryButtonStyle,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          import json backup
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <p style={{ margin: "0.9rem 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
        import never merges. valid backups replace accounts, categories, transactions, budgets, and recurring rules.
      </p>

      {importError ? (
        <p style={{ margin: "0.75rem 0 0", color: "#b91c1c", fontSize: "0.9rem" }}>
          {importError}
        </p>
      ) : null}

      {importSuccess ? (
        <p style={{ margin: "0.75rem 0 0", color: "#166534", fontSize: "0.9rem" }}>
          {importSuccess}
        </p>
      ) : null}
    </div>
  );
}

export function SettingsPage() {
  const accounts = useAppStore((state) => state.accounts);
  const categories = useAppStore((state) => state.categories);
  const transactions = useAppStore((state) => state.transactions);
  const budgets = useAppStore((state) => state.budgets);
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
  const addCategory = useAppStore((state) => state.addCategory);
  const updateCategory = useAppStore((state) => state.updateCategory);
  const deleteCategory = useAppStore((state) => state.deleteCategory);
  const deleteTransaction = useAppStore((state) => state.deleteTransaction);
  const deleteBudget = useAppStore((state) => state.deleteBudget);
  const addRecurringRule = useAppStore((state) => state.addRecurringRule);
  const updateRecurringRule = useAppStore((state) => state.updateRecurringRule);
  const deleteRecurringRule = useAppStore((state) => state.deleteRecurringRule);
  const replacePersistedState = useAppStore((state) => state.replacePersistedState);
  const resetSeedData = useAppStore((state) => state.resetSeedData);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const sortedAccounts = useMemo(() => sortItemsByName(accounts), [accounts]);
  const sortedCategories = useMemo(
    () => sortItemsByName(categories),
    [categories]
  );
  const sortedRecurringRules = useMemo(
    () => sortItemsByName(recurringRules),
    [recurringRules]
  );

  const accountTransactionCounts = useMemo(
    () => countById(transactions, (transaction) => transaction.accountId),
    [transactions]
  );

  const accountRecurringRuleCounts = useMemo(
    () => countRecurringRulesByAccountId(recurringRules),
    [recurringRules]
  );

  const categoryBudgetCounts = useMemo(
    () => countById(budgets, (budget) => budget.categoryId),
    [budgets]
  );

  const categoryTransactionCounts = useMemo(
    () => countById(transactions, (transaction) => transaction.categoryId),
    [transactions]
  );

  const categoryRecurringRuleCounts = useMemo(
    () => countById(recurringRules, (rule) => rule.categoryId),
    [recurringRules]
  );

  const generatedTransactionCounts = useMemo(
    () => countById(transactions, (transaction) => transaction.recurringRuleId),
    [transactions]
  );

  const deleteImpact = useMemo<DeleteImpact | null>(() => {
    return buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules);
  }, [budgets, pendingDelete, recurringRules, transactions]);

  function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    if (pendingDelete.entity === "account") {
      deleteAccount(pendingDelete.id);
    }

    if (pendingDelete.entity === "category") {
      budgets
        .filter((budget) => budget.categoryId === pendingDelete.id)
        .forEach((budget) => deleteBudget(budget.id));
      transactions
        .filter((transaction) => transaction.categoryId === pendingDelete.id)
        .forEach((transaction) => deleteTransaction(transaction.id));
      recurringRules
        .filter((rule) => rule.categoryId === pendingDelete.id)
        .forEach((rule) => deleteRecurringRule(rule.id));
      deleteCategory(pendingDelete.id);
    }

    if (pendingDelete.entity === "rule") {
      deleteRecurringRule(pendingDelete.id);
    }

    setPendingDelete(null);
  }

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.8rem" }}>settings</h1>
        <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
          simple inline setup for accounts, categories, and recurring rules.
        </p>
      </div>

      {deleteImpact ? (
        <div
          style={{
            ...cardStyle,
            borderColor: "#fecaca",
            background: "#fef2f2",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.05rem", color: "#991b1b" }}>
            {deleteImpact.title}
          </h2>
          <p style={{ margin: "0.35rem 0 1rem", color: "#7f1d1d" }}>
            {deleteImpact.description}
          </p>

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleConfirmDelete}
              style={{
                ...dangerButtonStyle,
                background: "#fee2e2",
              }}
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

      <div style={{ display: "grid", gap: "1rem" }}>
        <DataManagementSection
          accounts={accounts}
          categories={categories}
          transactions={transactions}
          budgets={budgets}
          recurringRules={recurringRules}
          replacePersistedState={replacePersistedState}
        />

        <AccountsSection
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

        <CategoriesSection
          categories={sortedCategories}
          budgetCounts={categoryBudgetCounts}
          transactionCounts={categoryTransactionCounts}
          recurringRuleCounts={categoryRecurringRuleCounts}
          addCategory={addCategory}
          updateCategory={updateCategory}
          onRequestDelete={(category) =>
            setPendingDelete({
              entity: "category",
              id: category.id,
              name: category.name,
            })
          }
        />

        <RecurringRulesSection
          accounts={sortedAccounts}
          categories={sortedCategories}
          recurringRules={sortedRecurringRules}
          generatedTransactionCounts={generatedTransactionCounts}
          addRecurringRule={addRecurringRule}
          updateRecurringRule={updateRecurringRule}
          onRequestDelete={(rule) =>
            setPendingDelete({
              entity: "rule",
              id: rule.id,
              name: rule.name,
            })
          }
        />
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>dev actions</h2>

        <button
          type="button"
          onClick={() => resetSeedData()}
          style={primaryButtonStyle}
        >
          reset seed data
        </button>
      </div>
    </section>
  );
}