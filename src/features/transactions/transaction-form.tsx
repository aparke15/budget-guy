import { useEffect, useMemo, useState } from "react";

import {
  createTransferInput,
  createTransaction,
  createTransactionFormValues,
} from "../../lib/factories";
import {
  getCategoryDisplayName,
  getSelectableCategories,
} from "../../lib/categories";
import { makeId } from "../../lib/ids";
import { formatCents, parseAmountInputToCents } from "../../lib/money";
import type { TransactionFormProps, TransactionFormValues } from "../types";

function createEmptySplitRows(categoryId: string): TransactionFormValues["splits"] {
  return [0, 1].map(() => ({
    id: makeId("split"),
    categoryId,
    amount: "",
    note: "",
  }));
}

function stripNegativeSign(value: string): string {
  return value.replace(/-/g, "");
}

function getAllocatedSplitAmountCents(
  splits: TransactionFormValues["splits"]
): number {
  return splits.reduce(
    (sum, split) => sum + (parseAmountInputToCents(split.amount) ?? 0),
    0
  );
}

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
  const isSplitMode = !isTransferMode && values.isSplit;
  const selectedCategoryIds = useMemo(
    () => [values.categoryId, ...values.splits.map((split) => split.categoryId)],
    [values.categoryId, values.splits]
  );

  const matchingCategories = useMemo(
    () =>
      getSelectableCategories(categories, {
        kind: standardKind,
        includeCategoryIds: selectedCategoryIds,
      }),
    [categories, selectedCategoryIds, standardKind]
  );

  useEffect(() => {
    if (isTransferMode) {
      return;
    }

    if (values.isSplit) {
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
  }, [isTransferMode, matchingCategories, values.categoryId, values.isSplit]);

  useEffect(() => {
    if (isTransferMode || !values.isSplit) {
      return;
    }

    const fallbackCategoryId = matchingCategories[0]?.id ?? "";
    const nextSplits = values.splits.length > 0
      ? values.splits.map((split) => {
          const categoryIsValid = matchingCategories.some(
            (category) => category.id === split.categoryId
          );

          return categoryIsValid
            ? split
            : {
                ...split,
                categoryId: fallbackCategoryId,
              };
        })
      : createEmptySplitRows(fallbackCategoryId);

    const splitsChanged =
      nextSplits.length !== values.splits.length ||
      nextSplits.some(
        (split, index) => split.categoryId !== values.splits[index]?.categoryId
      );

    if (splitsChanged) {
      setValues((current) => ({
        ...current,
        splits: nextSplits,
      }));
    }
  }, [isTransferMode, matchingCategories, values.isSplit, values.splits]);

  const transferAmountCents = useMemo(
    () => parseAmountInputToCents(values.amount),
    [values.amount]
  );

  const splitAllocatedCents = useMemo(
    () => getAllocatedSplitAmountCents(values.splits),
    [values.splits]
  );

  const splitRemainingCents = useMemo(() => {
    const totalAmountCents = parseAmountInputToCents(values.amount) ?? 0;

    return totalAmountCents - splitAllocatedCents;
  }, [splitAllocatedCents, values.amount]);

  const splitRowsAreValid = useMemo(
    () =>
      values.splits.length >= 2 &&
      values.splits.every(
        (split) =>
          Boolean(split.categoryId) &&
          (parseAmountInputToCents(split.amount) ?? 0) > 0
      ),
    [values.splits]
  );

  const transferSubmitDisabled =
    isTransferMode &&
    (!values.date ||
      !values.fromAccountId ||
      !values.toAccountId ||
      values.fromAccountId === values.toAccountId ||
      transferAmountCents == null ||
      transferAmountCents <= 0);

  const standardSubmitDisabled =
    !isTransferMode &&
    (!values.date ||
      !values.accountId ||
      transferAmountCents == null ||
      transferAmountCents <= 0 ||
      (isSplitMode
        ? !splitRowsAreValid || splitRemainingCents !== 0
        : !values.categoryId));

  const submitDisabled = isTransferMode
    ? transferSubmitDisabled
    : standardSubmitDisabled;

  function updateField<K extends keyof TransactionFormValues>(
    key: K,
    nextValue: TransactionFormValues[K]
  ) {
    setValues((current) => ({
      ...current,
      [key]: nextValue,
    }));
  }

  function updateSplitRow(
    splitId: string,
    key: keyof TransactionFormValues["splits"][number],
    nextValue: string
  ) {
    setValues((current) => ({
      ...current,
      splits: current.splits.map((split) =>
        split.id === splitId
          ? {
              ...split,
              [key]: nextValue,
            }
          : split
      ),
    }));
  }

  function addSplitRow() {
    const fallbackCategoryId =
      values.splits[values.splits.length - 1]?.categoryId ||
      values.categoryId ||
      matchingCategories[0]?.id ||
      "";

    setValues((current) => ({
      ...current,
      splits: [
        ...current.splits,
        {
          id: makeId("split"),
          categoryId: fallbackCategoryId,
          amount: "",
          note: "",
        },
      ],
    }));
  }

  function removeSplitRow(splitId: string) {
    setValues((current) => ({
      ...current,
      splits: current.splits.filter((split) => split.id !== splitId),
    }));
  }

  function handleSplitToggle(nextIsSplit: boolean) {
    if (isTransferMode) {
      return;
    }

    setValues((current) => {
      const fallbackCategoryId =
        current.categoryId ||
        current.splits[0]?.categoryId ||
        matchingCategories[0]?.id ||
        "";

      return {
        ...current,
        isSplit: nextIsSplit,
        categoryId: fallbackCategoryId,
        splits:
          nextIsSplit && current.splits.length === 0
            ? createEmptySplitRows(fallbackCategoryId)
            : current.splits.length > 0
              ? current.splits
              : createEmptySplitRows(fallbackCategoryId),
      };
    });
  }

  function handleTypeSwap(nextEntryType: "income" | "expense" | "transfer") {
    if (nextEntryType === "transfer") {
      setValues((current) => ({
        ...current,
        entryType: "transfer",
        isSplit: false,
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
      getSelectableCategories(categories, { kind: nextEntryType })[0]?.id ?? "";

    setValues((current) => ({
      ...current,
      entryType: nextEntryType,
      accountId: current.accountId || current.fromAccountId,
      categoryId: nextCategoryId,
      splits:
        current.splits.length > 0
          ? current.splits.map((split) => ({
              ...split,
              categoryId: nextCategoryId,
            }))
          : createEmptySplitRows(nextCategoryId),
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

    if (transferAmountCents == null || transferAmountCents <= 0) {
      setError("amount must be a positive number");
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
        if (!isSplitMode && !values.categoryId) {
          setError("category is required");
          return;
        }

        if (isSplitMode && values.splits.length < 2) {
          setError("split transactions require at least 2 rows");
          return;
        }

        if (isSplitMode && !splitRowsAreValid) {
          setError("each split row needs a category and positive amount");
          return;
        }

        if (isSplitMode && splitRemainingCents !== 0) {
          setError("split amounts must add up to the transaction total");
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
            className="control"
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
            onChange={(event) => updateField("amount", stripNegativeSign(event.target.value))}
            className="control"
          />
        </label>

        <label className="field">
          <span className="field__label">date</span>
          <input
            type="date"
            value={values.date}
            onChange={(event) => updateField("date", event.target.value)}
            className="control"
          />
        </label>

        {isTransferMode ? (
          <>
            <label className="field">
              <span className="field__label">from account</span>
              <select
                value={values.fromAccountId}
                onChange={(event) => updateField("fromAccountId", event.target.value)}
                className="control"
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
                className="control"
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
                className="control"
              >
                <option value="">select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            {!isSplitMode ? (
              <label className="field">
                <span className="field__label">category</span>
                <select
                  value={values.categoryId}
                  onChange={(event) => updateField("categoryId", event.target.value)}
                  className="control"
                >
                  <option value="">select category</option>
                  {matchingCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {getCategoryDisplayName(category)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="field">
              <span className="field__label">merchant</span>
              <input
                type="text"
                value={values.merchant}
                onChange={(event) => updateField("merchant", event.target.value)}
                className="control"
              />
            </label>

            <label className="field">
              <span className="field__label">split transaction</span>
              <span className="control control--toggle">
                <input
                  type="checkbox"
                  checked={values.isSplit}
                  onChange={(event) => handleSplitToggle(event.target.checked)}
                />
                <span>allocate this transaction across categories</span>
              </span>
            </label>
          </>
        )}
      </div>

      {isSplitMode ? (
        <div className="section-card section-card--surface stack-sm">
          <div className="section-header">
            <div className="section-title-group">
              <h3 className="section-title">split allocation</h3>
              <p className="section-subtitle">
                keep the parent amount as the ledger total. split rows only drive category reporting.
              </p>
            </div>

            <button type="button" onClick={addSplitRow} className="button button--secondary">
              add split row
            </button>
          </div>

          {values.splits.map((split, index) => (
            <div key={split.id} className="form-grid">
              <label className="field">
                <span className="field__label">category {index + 1}</span>
                <select
                  value={split.categoryId}
                  onChange={(event) =>
                    updateSplitRow(split.id, "categoryId", event.target.value)
                  }
                  className="control"
                >
                  <option value="">select category</option>
                  {matchingCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {getCategoryDisplayName(category)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">amount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={split.amount}
                  onChange={(event) =>
                    updateSplitRow(split.id, "amount", stripNegativeSign(event.target.value))
                  }
                  className="control"
                />
              </label>

              <label className="field">
                <span className="field__label">split note</span>
                <input
                  type="text"
                  value={split.note}
                  onChange={(event) =>
                    updateSplitRow(split.id, "note", event.target.value)
                  }
                  className="control"
                />
              </label>

              <div className="field">
                <span className="field__label">remove</span>
                <button
                  type="button"
                  onClick={() => removeSplitRow(split.id)}
                  disabled={values.splits.length <= 2}
                  className="button button--secondary"
                >
                  remove row
                </button>
              </div>
            </div>
          ))}

          <div className="toolbar toolbar--spaced">
            <p className="muted-text">
              allocated {formatCents(splitAllocatedCents)} · remaining {formatCents(splitRemainingCents)}
            </p>

            <div className="badge-row">
              <span className="badge badge--neutral">
                {values.splits.length} split row{values.splits.length === 1 ? "" : "s"}
              </span>
              <span
                className={
                  splitRemainingCents === 0 ? "badge badge--income" : "badge badge--expense"
                }
              >
                {splitRemainingCents === 0 ? "balanced" : "needs allocation"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <label className="field">
        <span className="field__label">note</span>
        <textarea
          rows={3}
          value={values.note}
          onChange={(event) => updateField("note", event.target.value)}
          className="control"
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
          disabled={submitDisabled}
          className="button button--primary"
        >
          {submitLabel}
        </button>

        {onCancel ? (
          <button type="button" onClick={onCancel} className="button button--secondary">
            cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}