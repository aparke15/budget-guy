import type { SubmitEvent } from "react";

import { parseAmountInputToCents } from "../../../lib/money";
import type {
  Account,
  Category,
  RecurringFrequency,
  RecurringRuleKind,
} from "../../../types";
import type { RecurringRuleFormValues } from "../../types";

type RecurringRuleEditorProps = {
  values: RecurringRuleFormValues;
  error: string;
  accounts: Account[];
  categories: Category[];
  submitLabel: string;
  submitDisabled?: boolean;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  onChange: <K extends keyof RecurringRuleFormValues>(
    key: K,
    value: RecurringRuleFormValues[K]
  ) => void;
  onKindChange: (kind: RecurringRuleKind) => void;
  onFrequencyChange: (frequency: RecurringFrequency) => void;
  onStartDateChange: (startDate: string) => void;
};

export function RecurringRuleEditor(props: RecurringRuleEditorProps) {
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
    onKindChange,
    onFrequencyChange,
    onStartDateChange,
  } = props;
  const isTransferRule = values.kind === "transfer";
  const selectedCategory = categories.find(
    (category) => category.id === values.categoryId
  );
  const transferAmountCents = parseAmountInputToCents(values.amount);
  const transferSubmitInvalid =
    isTransferRule &&
    (!values.accountId ||
      !values.toAccountId ||
      values.accountId === values.toAccountId ||
      transferAmountCents == null ||
      transferAmountCents <= 0);

  return (
    <form onSubmit={onSubmit} className="stack-md">
      <div className="form-grid form-grid--tight">
        <label className="field">
          <span className="field-label">rule type</span>
          <select
            value={values.kind}
            onChange={(event) => onKindChange(event.target.value as RecurringRuleKind)}
            className="control"
          >
            <option value="standard">standard</option>
            <option value="transfer">transfer</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">name</span>
          <input
            type="text"
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
            className="control"
          />
        </label>

        <label className="field">
          <span className="field-label">amount</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={values.amount}
            onChange={(event) => onChange("amount", event.target.value)}
            className="control"
          />
        </label>

        <label className="field">
          <span className="field-label">{isTransferRule ? "from account" : "account"}</span>
          <select
            value={values.accountId}
            onChange={(event) => onChange("accountId", event.target.value)}
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

        {isTransferRule ? (
          <label className="field">
            <span className="field-label">to account</span>
            <select
              value={values.toAccountId}
              onChange={(event) => onChange("toAccountId", event.target.value)}
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
        ) : (
          <label className="field">
            <span className="field-label">category</span>
            <select
              value={values.categoryId}
              onChange={(event) => onChange("categoryId", event.target.value)}
              className="control"
            >
              <option value="">select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.kind})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span className="field-label">frequency</span>
          <select
            value={values.frequency}
            onChange={(event) => onFrequencyChange(event.target.value as RecurringFrequency)}
            className="control"
          >
            <option value="monthly">monthly</option>
            <option value="weekly">weekly</option>
            <option value="biweekly">biweekly</option>
            <option value="yearly">yearly</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">start date</span>
          <input
            type="date"
            value={values.startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="control"
          />
        </label>

        <label className="field">
          <span className="field-label">end date</span>
          <input
            type="date"
            value={values.endDate}
            onChange={(event) => onChange("endDate", event.target.value)}
            className="control"
          />
        </label>

        {values.frequency === "monthly" ? (
          <label className="field">
            <span className="field-label">day of month</span>
            <input
              type="number"
              min="1"
              max="31"
              value={values.dayOfMonth}
              onChange={(event) => onChange("dayOfMonth", event.target.value)}
              className="control"
            />
          </label>
        ) : values.frequency === "weekly" || values.frequency === "biweekly" ? (
          <label className="field">
            <span className="field-label">day of week</span>
            <select
              value={values.dayOfWeek}
              onChange={(event) => onChange("dayOfWeek", event.target.value)}
              className="control"
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
        ) : null}

        {!isTransferRule ? (
          <label className="field">
            <span className="field-label">merchant</span>
            <input
              type="text"
              value={values.merchant}
              onChange={(event) => onChange("merchant", event.target.value)}
              className="control"
            />
          </label>
        ) : null}

        <label className="field">
          <span className="field-label">note</span>
          <input
            type="text"
            value={values.note}
            onChange={(event) => onChange("note", event.target.value)}
            className="control"
          />
        </label>
      </div>

      <label className="field inline-toggle">
        <input
          type="checkbox"
          checked={values.active}
          onChange={(event) => onChange("active", event.target.checked)}
        />
        <span className="field-label">active rule</span>
      </label>

      {isTransferRule ? (
        <p className="field-help">
          transfer amounts are stored as positive values and generated as linked transfer pairs.
        </p>
      ) : (
        <p className="field-help">
          selected category kind: {selectedCategory?.kind ?? "n/a"}. saved amount will be {selectedCategory?.kind === "income" ? "positive" : "negative"}.
        </p>
      )}

      {error ? <p className="status-message status-message--error">{error}</p> : null}

      <div className="form-actions">
        <button
          type="submit"
          disabled={submitDisabled || transferSubmitInvalid}
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
