import { useEffect, useMemo, useState } from "react";

import {
  createTransferInput,
  createTransaction,
  createTransactionFormValues,
} from "../../lib/factories";
import { parseAmountInputToCents } from "../../lib/money";
import type { TransactionFormProps, TransactionFormValues } from "../types";

export function TransactionForm(props: TransactionFormProps) {
  const {
    accounts,
    categories,
    initialState,
    submitLabel,
    onSubmit,
    onCancel,
  } = props;

  const [values, setValues] = useState<TransactionFormValues>(() =>
    createTransactionFormValues(accounts, categories, initialState)
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setValues(createTransactionFormValues(accounts, categories, initialState));
    setError("");
  }, [accounts, categories, initialState]);

  const standardKind = values.entryType === "income" ? "income" : "expense";
  const isTransferMode = values.entryType === "transfer";

  const matchingCategories = useMemo(
    () => categories.filter((category) => category.kind === standardKind),
    [categories, standardKind]
  );

  useEffect(() => {
    if (isTransferMode) {
      return;
    }

    const categoryIsValid = matchingCategories.some(
      (category) => category.id === values.categoryId
    );

    if (!categoryIsValid) {
      setValues((current) => ({
        ...current,
        categoryId: matchingCategories[0]?.id ?? "",
      }));
    }
  }, [isTransferMode, matchingCategories, values.categoryId]);

  const transferAmountCents = useMemo(
    () => parseAmountInputToCents(values.amount),
    [values.amount]
  );

  const transferSubmitDisabled =
    isTransferMode &&
    (!values.date ||
      !values.fromAccountId ||
      !values.toAccountId ||
      values.fromAccountId === values.toAccountId ||
      transferAmountCents == null ||
      transferAmountCents <= 0);

  function updateField<K extends keyof TransactionFormValues>(
    key: K,
    nextValue: TransactionFormValues[K]
  ) {
    setValues((current) => ({
      ...current,
      [key]: nextValue,
    }));
  }

  function handleTypeSwap(nextEntryType: "income" | "expense" | "transfer") {
    if (nextEntryType === "transfer") {
      setValues((current) => ({
        ...current,
        entryType: "transfer",
        fromAccountId: current.fromAccountId || current.accountId || accounts[0]?.id || "",
        toAccountId:
          current.toAccountId ||
          accounts.find((account) => account.id !== (current.accountId || current.fromAccountId))?.id ||
          accounts[0]?.id ||
          "",
        merchant: "",
      }));
      return;
    }

    const nextCategoryId =
      categories.find((category) => category.kind === nextEntryType)?.id ?? "";

    setValues((current) => ({
      ...current,
      entryType: nextEntryType,
      accountId: current.accountId || current.fromAccountId,
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

    if (!isTransferMode && !values.accountId) {
      setError("account is required");
      return;
    }

    try {
      if (isTransferMode) {
        const input = createTransferInput(values);

        onSubmit({
          mode: "transfer",
          transferGroupId:
            initialState?.mode === "transfer"
              ? initialState.transferGroupId
              : undefined,
          input,
        });
      } else {
        if (!values.categoryId) {
          setError("category is required");
          return;
        }

        const transaction = createTransaction({
          values,
          existing:
            initialState?.mode === "standard" ? initialState.transaction : undefined,
        });

        onSubmit({
          mode: "standard",
          transaction,
        });
      }

      if (!initialState) {
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
            value={values.entryType}
            onChange={(event) =>
              handleTypeSwap(
                event.target.value as "income" | "expense" | "transfer"
              )
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
            <option value="transfer">transfer</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>amount</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={values.amount}
            onChange={(event) =>
              updateField(
                "amount",
                isTransferMode
                  ? event.target.value.replace(/-/g, "")
                  : event.target.value
              )
            }
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

        {isTransferMode ? (
          <>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.9rem", color: "#374151" }}>
                from account
              </span>
              <select
                value={values.fromAccountId}
                onChange={(event) => updateField("fromAccountId", event.target.value)}
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
                to account
              </span>
              <select
                value={values.toAccountId}
                onChange={(event) => updateField("toAccountId", event.target.value)}
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
          </>
        ) : (
          <>
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
          </>
        )}
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
          disabled={transferSubmitDisabled}
          style={{
            padding: "0.7rem 0.95rem",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            background: "#111827",
            color: "#ffffff",
            cursor: transferSubmitDisabled ? "not-allowed" : "pointer",
            opacity: transferSubmitDisabled ? 0.7 : 1,
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