import { useEffect, useMemo, useState } from "react";

import {
  createTransaction,
  createTransactionFormValues,
} from "../../lib/factories";
import type { TransactionFormProps, TransactionFormValues } from "../types";

export function TransactionForm(props: TransactionFormProps) {
  const {
    accounts,
    categories,
    initialTransaction,
    submitLabel,
    onSubmit,
    onCancel,
  } = props;

  const [values, setValues] = useState<TransactionFormValues>(() =>
    createTransactionFormValues(accounts, categories, initialTransaction)
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setValues(
      createTransactionFormValues(accounts, categories, initialTransaction)
    );
    setError("");
  }, [accounts, categories, initialTransaction]);

  const matchingCategories = useMemo(
    () =>
      categories.filter((category) => category.kind === values.kind),
    [categories, values.kind]
  );

  useEffect(() => {
    const categoryIsValid = matchingCategories.some(
      (category) => category.id === values.categoryId
    );

    if (!categoryIsValid) {
      setValues((current) => ({
        ...current,
        categoryId: matchingCategories[0]?.id ?? "",
      }));
    }
  }, [matchingCategories, values.categoryId]);

  function updateField<K extends keyof TransactionFormValues>(
    key: K,
    nextValue: TransactionFormValues[K]
  ) {
    setValues((current) => ({
      ...current,
      [key]: nextValue,
    }));
  }

  function handleTypeSwap(nextKind: "income" | "expense") {
    const nextCategoryId =
      categories.find((category) => category.kind === nextKind)?.id ?? "";

    setValues((current) => ({
      ...current,
      kind: nextKind,
      categoryId: nextCategoryId,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!values.date) {
      setError("date is required");
      return;
    }

    if (!values.accountId) {
      setError("account is required");
      return;
    }

    if (!values.categoryId) {
      setError("category is required");
      return;
    }

    try {
      const transaction = createTransaction({
        values,
        existing: initialTransaction,
      });

      onSubmit(transaction);

      if (!initialTransaction) {
        setValues(createTransactionFormValues(accounts, categories));
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "failed to save transaction"
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gap: "0.9rem",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "0.9rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>type</span>
          <select
            value={values.kind}
            onChange={(event) =>
              handleTypeSwap(event.target.value as "income" | "expense")
            }
            style={{
              padding: "0.55rem 0.7rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "#ffffff",
            }}
          >
            <option value="expense">expense</option>
            <option value="income">income</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>amount</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={values.amount}
            onChange={(event) => updateField("amount", event.target.value)}
            style={{
              padding: "0.55rem 0.7rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "#ffffff",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>date</span>
          <input
            type="date"
            value={values.date}
            onChange={(event) => updateField("date", event.target.value)}
            style={{
              padding: "0.55rem 0.7rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "#ffffff",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>account</span>
          <select
            value={values.accountId}
            onChange={(event) => updateField("accountId", event.target.value)}
            style={{
              padding: "0.55rem 0.7rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "#ffffff",
            }}
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
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>
            category
          </span>
          <select
            value={values.categoryId}
            onChange={(event) => updateField("categoryId", event.target.value)}
            style={{
              padding: "0.55rem 0.7rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "#ffffff",
            }}
          >
            <option value="">select category</option>
            {matchingCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>
            merchant
          </span>
          <input
            type="text"
            value={values.merchant}
            onChange={(event) => updateField("merchant", event.target.value)}
            style={{
              padding: "0.55rem 0.7rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "#ffffff",
            }}
          />
        </label>
      </div>

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span style={{ fontSize: "0.9rem", color: "#374151" }}>note</span>
        <textarea
          rows={3}
          value={values.note}
          onChange={(event) => updateField("note", event.target.value)}
          style={{
            padding: "0.7rem",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            resize: "vertical",
          }}
        />
      </label>

      {error ? (
        <div
          style={{
            padding: "0.7rem 0.85rem",
            borderRadius: "0.5rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="submit"
          style={{
            padding: "0.7rem 0.95rem",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            background: "#111827",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          {submitLabel}
        </button>

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "0.7rem 0.95rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#111827",
              cursor: "pointer",
            }}
          >
            cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}