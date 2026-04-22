import { useEffect, useMemo, useState } from "react";

import {
  createTransferInput,
  createTransaction,
  createTransactionFormValues,
} from "../../lib/factories";
import { parseAmountInputToCents } from "../../lib/money";
import {
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  textAreaStyle,
} from "../components/style-constants";
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
    <form onSubmit={handleSubmit} className="stack-sm">
      <div className="form-grid">
        <label className="field">
          <span className="field__label">type</span>
          <select
            value={values.entryType}
            onChange={(event) =>
              handleTypeSwap(
                event.target.value as "income" | "expense" | "transfer"
              )
            }
            style={inputStyle}
          >
            <option value="expense">expense</option>
            <option value="income">income</option>
            <option value="transfer">transfer</option>
          </select>
        </label>

        <label className="field">
          <span className="field__label">amount</span>
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
            style={inputStyle}
          />
        </label>

        <label className="field">
          <span className="field__label">date</span>
          <input
            type="date"
            value={values.date}
            onChange={(event) => updateField("date", event.target.value)}
            style={inputStyle}
          />
        </label>

        {isTransferMode ? (
          <>
            <label className="field">
              <span className="field__label">from account</span>
              <select
                value={values.fromAccountId}
                onChange={(event) => updateField("fromAccountId", event.target.value)}
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

            <label className="field">
              <span className="field__label">to account</span>
              <select
                value={values.toAccountId}
                onChange={(event) => updateField("toAccountId", event.target.value)}
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
          </>
        ) : (
          <>
            <label className="field">
              <span className="field__label">account</span>
              <select
                value={values.accountId}
                onChange={(event) => updateField("accountId", event.target.value)}
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

            <label className="field">
              <span className="field__label">category</span>
              <select
                value={values.categoryId}
                onChange={(event) => updateField("categoryId", event.target.value)}
                style={inputStyle}
              >
                <option value="">select category</option>
                {matchingCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">merchant</span>
              <input
                type="text"
                value={values.merchant}
                onChange={(event) => updateField("merchant", event.target.value)}
                style={inputStyle}
              />
            </label>
          </>
        )}
      </div>

      <label className="field">
        <span className="field__label">note</span>
        <textarea
          rows={3}
          value={values.note}
          onChange={(event) => updateField("note", event.target.value)}
          style={textAreaStyle}
        />
      </label>

      {error ? (
        <div className="message-box message-box--error">
          {error}
        </div>
      ) : null}

      <div className="button-row">
        <button
          type="submit"
          disabled={transferSubmitDisabled}
          style={{
            ...primaryButtonStyle,
            cursor: transferSubmitDisabled ? "not-allowed" : "pointer",
            opacity: transferSubmitDisabled ? 0.7 : 1,
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