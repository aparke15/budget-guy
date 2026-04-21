import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAppStore } from "../../app/store";
import {
  createAccount,
  createCategory,
  createRecurringRule,
} from "../../lib/factories";
import { formatCents, formatCentsForInput, parseAmountInputToCents } from "../../lib/money";
import { recurringRuleSchema } from "../../lib/validation";
import {
  buildDeleteImpact,
  countById,
  normalizeEntityName,
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
  AccountType,
  Category,
  CategoryKind,
  RecurringFrequency,
  RecurringRule,
} from "../../types";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "0.75rem",
  padding: "1rem",
} as const;

const inputStyle = {
  padding: "0.55rem 0.7rem",
  borderRadius: "0.5rem",
  border: "1px solid #d1d5db",
  background: "#ffffff",
} as const;

const primaryButtonStyle = {
  padding: "0.65rem 0.9rem",
  borderRadius: "0.5rem",
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
} as const;

const secondaryButtonStyle = {
  padding: "0.65rem 0.9rem",
  borderRadius: "0.5rem",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
} as const;

const dangerButtonStyle = {
  padding: "0.65rem 0.9rem",
  borderRadius: "0.5rem",
  border: "1px solid #ef4444",
  background: "#ffffff",
  color: "#b91c1c",
  cursor: "pointer",
} as const;

function createAccountFormValues(): AccountFormValues {
  return {
    name: "",
    type: "checking",
  };
}

function createCategoryFormValues(): CategoryFormValues {
  return {
    name: "",
    kind: "expense",
  };
}

function getDefaultAccountId(accounts: Account[]): string {
  return accounts[0]?.id ?? "";
}

function getDefaultCategoryId(categories: Category[]): string {
  return categories.find((category) => category.kind === "expense")?.id ?? categories[0]?.id ?? "";
}

function getDayOfMonthFromDate(date: string): string {
  if (!date) {
    return "1";
  }

  return String(Number(date.slice(8, 10)) || 1);
}

function getDayOfWeekFromDate(date: string): string {
  if (!date) {
    return "0";
  }

  const parsed = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "0";
  }

  return String(parsed.getDay());
}

function createRecurringRuleFormValues(
  accounts: Account[],
  categories: Category[],
  existing?: RecurringRule
): RecurringRuleFormValues {
  if (existing) {
    return {
      name: existing.name,
      amount: formatCentsForInput(existing.amountCents),
      accountId: existing.accountId,
      categoryId: existing.categoryId,
      frequency: existing.frequency,
      startDate: existing.startDate,
      endDate: existing.endDate ?? "",
      active: existing.active,
      dayOfMonth: existing.dayOfMonth != null ? String(existing.dayOfMonth) : "",
      dayOfWeek: existing.dayOfWeek != null ? String(existing.dayOfWeek) : "",
      merchant: existing.merchant ?? "",
      note: existing.note ?? "",
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  return {
    name: "",
    amount: "",
    accountId: getDefaultAccountId(accounts),
    categoryId: getDefaultCategoryId(categories),
    frequency: "monthly",
    startDate: today,
    endDate: "",
    active: true,
    dayOfMonth: getDayOfMonthFromDate(today),
    dayOfWeek: getDayOfWeekFromDate(today),
    merchant: "",
    note: "",
  };
}

function ensureRecurringFormReferences(
  values: RecurringRuleFormValues,
  accounts: Account[],
  categories: Category[]
): RecurringRuleFormValues {
  const nextAccountId =
    accounts.some((account) => account.id === values.accountId)
      ? values.accountId
      : getDefaultAccountId(accounts);
  const nextCategoryId =
    categories.some((category) => category.id === values.categoryId)
      ? values.categoryId
      : getDefaultCategoryId(categories);

  return {
    ...values,
    accountId: nextAccountId,
    categoryId: nextCategoryId,
  };
}

function updateRecurringFrequency(
  values: RecurringRuleFormValues,
  frequency: RecurringFrequency
): RecurringRuleFormValues {
  if (frequency === "monthly") {
    return {
      ...values,
      frequency,
      dayOfMonth: values.dayOfMonth || getDayOfMonthFromDate(values.startDate),
      dayOfWeek: "",
    };
  }

  return {
    ...values,
    frequency,
    dayOfMonth: "",
      dayOfWeek: values.dayOfWeek || getDayOfWeekFromDate(values.startDate),
  };
}

function updateRecurringStartDate(
  values: RecurringRuleFormValues,
  startDate: string
): RecurringRuleFormValues {
  if (values.frequency === "monthly") {
    return {
      ...values,
      startDate,
      dayOfMonth: values.dayOfMonth || getDayOfMonthFromDate(startDate),
    };
  }

  return {
    ...values,
    startDate,
    dayOfWeek: values.dayOfWeek || getDayOfWeekFromDate(startDate),
  };
}

function buildRecurringRuleCandidate(
  values: RecurringRuleFormValues,
  categories: Category[],
  existing?: RecurringRule
): RecurringRule {
  if (!values.name.trim()) {
    throw new Error("name is required");
  }

  if (!values.accountId) {
    throw new Error("account is required");
  }

  if (!values.categoryId) {
    throw new Error("category is required");
  }

  if (!values.startDate) {
    throw new Error("start date is required");
  }

  const amountAbsCents = parseAmountInputToCents(values.amount);

  if (amountAbsCents == null || amountAbsCents <= 0) {
    throw new Error("amount must be a positive number");
  }

  const selectedCategory = categories.find(
    (category) => category.id === values.categoryId
  );

  if (!selectedCategory) {
    throw new Error("category is required");
  }

  const amountCents =
    selectedCategory.kind === "income"
      ? Math.abs(amountAbsCents)
      : -Math.abs(amountAbsCents);

  const dayOfMonth =
    values.frequency === "monthly" && values.dayOfMonth.trim()
      ? Number(values.dayOfMonth)
      : undefined;
  const dayOfWeek =
    values.frequency !== "monthly" && values.dayOfWeek.trim()
      ? Number(values.dayOfWeek)
      : undefined;
  const payload = {
    name: values.name.trim(),
    amountCents,
    accountId: values.accountId,
    categoryId: values.categoryId,
    frequency: values.frequency,
    startDate: values.startDate,
    endDate: values.endDate.trim() || undefined,
    active: values.active,
    dayOfMonth,
    dayOfWeek,
    merchant: values.merchant,
    note: values.note,
  };
  const candidate = existing
    ? {
        ...existing,
        ...payload,
        merchant: payload.merchant.trim() || undefined,
        note: payload.note.trim() || undefined,
      }
    : createRecurringRule(payload);
  const parsed = recurringRuleSchema.safeParse(candidate);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "failed to save recurring rule");
  }

  return parsed.data;
}

function getWeekdayLabel(dayOfWeek?: number): string {
  switch (dayOfWeek) {
    case 0:
      return "sun";
    case 1:
      return "mon";
    case 2:
      return "tue";
    case 3:
      return "wed";
    case 4:
      return "thu";
    case 5:
      return "fri";
    case 6:
      return "sat";
    default:
      return "n/a";
  }
}

function getRecurringDetails(rule: RecurringRule): string {
  if (rule.frequency === "monthly") {
    return `monthly on day ${rule.dayOfMonth ?? "?"}`;
  }

  return `${rule.frequency} on ${getWeekdayLabel(rule.dayOfWeek)}`;
}

type AccountEditorProps = {
  values: AccountFormValues;
  error: string;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof AccountFormValues>(
    key: K,
    value: AccountFormValues[K]
  ) => void;
  onCancel?: () => void;
};

function AccountEditor(props: AccountEditorProps) {
  const { values, error, submitLabel, onSubmit, onChange, onCancel } = props;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>name</span>
          <input
            type="text"
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>type</span>
          <select
            value={values.type}
            onChange={(event) =>
              onChange("type", event.target.value as AccountType)
            }
            style={inputStyle}
          >
            <option value="checking">checking</option>
            <option value="savings">savings</option>
            <option value="credit">credit</option>
            <option value="cash">cash</option>
          </select>
        </label>
      </div>

      {error ? (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button type="submit" style={primaryButtonStyle}>
          {submitLabel}
        </button>

        {onCancel ? (
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
            cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

type CategoryEditorProps = {
  values: CategoryFormValues;
  error: string;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof CategoryFormValues>(
    key: K,
    value: CategoryFormValues[K]
  ) => void;
  onCancel?: () => void;
};

function CategoryEditor(props: CategoryEditorProps) {
  const { values, error, submitLabel, onSubmit, onChange, onCancel } = props;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>name</span>
          <input
            type="text"
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>kind</span>
          <select
            value={values.kind}
            onChange={(event) =>
              onChange("kind", event.target.value as CategoryKind)
            }
            style={inputStyle}
          >
            <option value="expense">expense</option>
            <option value="income">income</option>
          </select>
        </label>
      </div>

      {error ? (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button type="submit" style={primaryButtonStyle}>
          {submitLabel}
        </button>

        {onCancel ? (
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
            cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

type RecurringRuleEditorProps = {
  values: RecurringRuleFormValues;
  error: string;
  accounts: Account[];
  categories: Category[];
  submitLabel: string;
  submitDisabled?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  onChange: <K extends keyof RecurringRuleFormValues>(
    key: K,
    value: RecurringRuleFormValues[K]
  ) => void;
  onFrequencyChange: (frequency: RecurringFrequency) => void;
  onStartDateChange: (startDate: string) => void;
};

function RecurringRuleEditor(props: RecurringRuleEditorProps) {
  const {
    values,
    error,
    accounts,
    categories,
    submitLabel,
    submitDisabled,
    onSubmit,
    onCancel,
    onChange,
    onFrequencyChange,
    onStartDateChange,
  } = props;
  const selectedCategory = categories.find(
    (category) => category.id === values.categoryId
  );

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>name</span>
          <input
            type="text"
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>amount</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={values.amount}
            onChange={(event) => onChange("amount", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>account</span>
          <select
            value={values.accountId}
            onChange={(event) => onChange("accountId", event.target.value)}
            style={inputStyle}
          >
            <option value="">select account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>category</span>
          <select
            value={values.categoryId}
            onChange={(event) => onChange("categoryId", event.target.value)}
            style={inputStyle}
          >
            <option value="">select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.kind})
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>
            frequency
          </span>
          <select
            value={values.frequency}
            onChange={(event) =>
              onFrequencyChange(event.target.value as RecurringFrequency)
            }
            style={inputStyle}
          >
            <option value="monthly">monthly</option>
            <option value="weekly">weekly</option>
            <option value="biweekly">biweekly</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>
            start date
          </span>
          <input
            type="date"
            value={values.startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>end date</span>
          <input
            type="date"
            value={values.endDate}
            onChange={(event) => onChange("endDate", event.target.value)}
            style={inputStyle}
          />
        </label>

        {values.frequency === "monthly" ? (
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.9rem", color: "#374151" }}>
              day of month
            </span>
            <input
              type="number"
              min="1"
              max="31"
              value={values.dayOfMonth}
              onChange={(event) => onChange("dayOfMonth", event.target.value)}
              style={inputStyle}
            />
          </label>
        ) : (
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.9rem", color: "#374151" }}>
              day of week
            </span>
            <select
              value={values.dayOfWeek}
              onChange={(event) => onChange("dayOfWeek", event.target.value)}
              style={inputStyle}
            >
              <option value="0">sun</option>
              <option value="1">mon</option>
              <option value="2">tue</option>
              <option value="3">wed</option>
              <option value="4">thu</option>
              <option value="5">fri</option>
              <option value="6">sat</option>
            </select>
          </label>
        )}

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>merchant</span>
          <input
            type="text"
            value={values.merchant}
            onChange={(event) => onChange("merchant", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>note</span>
          <input
            type="text"
            value={values.note}
            onChange={(event) => onChange("note", event.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          color: "#374151",
          fontSize: "0.9rem",
        }}
      >
        <input
          type="checkbox"
          checked={values.active}
          onChange={(event) => onChange("active", event.target.checked)}
        />
        active rule
      </label>

      <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
        selected category kind: {selectedCategory?.kind ?? "n/a"}. saved amount will be {selectedCategory?.kind === "income" ? "positive" : "negative"}.
      </p>

      {error ? (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={submitDisabled}
          style={{
            ...primaryButtonStyle,
            opacity: submitDisabled ? 0.6 : 1,
            cursor: submitDisabled ? "not-allowed" : "pointer",
          }}
        >
          {submitLabel}
        </button>

        {onCancel ? (
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
            cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

type AccountsSectionProps = {
  accounts: Account[];
  transactionCounts: Record<string, number>;
  recurringRuleCounts: Record<string, number>;
  addAccount: (input: Account) => void;
  updateAccount: (id: string, input: Partial<Account>) => void;
  onRequestDelete: (account: Account) => void;
};

function AccountsSection(props: AccountsSectionProps) {
  const {
    accounts,
    transactionCounts,
    recurringRuleCounts,
    addAccount,
    updateAccount,
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
      [key]: value,
    }));
  }

  function updateEditField<K extends keyof AccountFormValues>(
    key: K,
    value: AccountFormValues[K]
  ) {
    setEditValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
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

    addAccount(createAccount(createValues));
    setCreateValues(createAccountFormValues());
  }

  function startEditing(account: Account) {
    setEditingId(account.id);
    setEditValues({
      name: account.name,
      type: account.type,
    });
    setEditError("");
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
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

    updateAccount(editingId, {
      name: editValues.name.trim(),
      type: editValues.type,
    });
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

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
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

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
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

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
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

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
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
        recurring rules stay manual-run. amount sign follows the selected category kind.
      </p>

      <div style={{ display: "grid", gap: "0.9rem" }}>
        <RecurringRuleEditor
          values={createValues}
          error={createError}
          accounts={accounts}
          categories={categories}
          submitLabel="add recurring rule"
          submitDisabled={accounts.length === 0 || categories.length === 0}
          onSubmit={handleCreateSubmit}
          onChange={updateCreateField}
          onFrequencyChange={(frequency) =>
            setCreateValues((current) => updateRecurringFrequency(current, frequency))
          }
          onStartDateChange={(startDate) =>
            setCreateValues((current) => updateRecurringStartDate(current, startDate))
          }
        />

        {accounts.length === 0 || categories.length === 0 ? (
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
            add at least one account and one category before saving recurring rules.
          </p>
        ) : null}

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {recurringRules.map((rule) => {
            const accountName =
              accounts.find((account) => account.id === rule.accountId)?.name ??
              "unknown account";
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
                  submitDisabled={accounts.length === 0 || categories.length === 0}
                  onSubmit={handleEditSubmit}
                  onChange={updateEditField}
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
                    {formatCents(rule.amountCents)} · {getRecurringDetails(rule)}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                    {accountName} · {categoryMatch?.name ?? "unknown category"} ({categoryMatch?.kind ?? "n/a"})
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

export function SettingsPage() {
  const accounts = useAppStore((state) => state.accounts);
  const categories = useAppStore((state) => state.categories);
  const transactions = useAppStore((state) => state.transactions);
  const budgets = useAppStore((state) => state.budgets);
  const recurringRules = useAppStore((state) => state.recurringRules);
  const addAccount = useAppStore((state) => state.addAccount);
  const updateAccount = useAppStore((state) => state.updateAccount);
  const deleteAccount = useAppStore((state) => state.deleteAccount);
  const addCategory = useAppStore((state) => state.addCategory);
  const updateCategory = useAppStore((state) => state.updateCategory);
  const deleteCategory = useAppStore((state) => state.deleteCategory);
  const deleteTransaction = useAppStore((state) => state.deleteTransaction);
  const deleteBudget = useAppStore((state) => state.deleteBudget);
  const addRecurringRule = useAppStore((state) => state.addRecurringRule);
  const updateRecurringRule = useAppStore((state) => state.updateRecurringRule);
  const deleteRecurringRule = useAppStore((state) => state.deleteRecurringRule);
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
    () => countById(recurringRules, (rule) => rule.accountId),
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
      transactions
        .filter((transaction) => transaction.accountId === pendingDelete.id)
        .forEach((transaction) => deleteTransaction(transaction.id));
      recurringRules
        .filter((rule) => rule.accountId === pendingDelete.id)
        .forEach((rule) => deleteRecurringRule(rule.id));
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
        <AccountsSection
          accounts={sortedAccounts}
          transactionCounts={accountTransactionCounts}
          recurringRuleCounts={accountRecurringRuleCounts}
          addAccount={addAccount}
          updateAccount={updateAccount}
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