import type { SubmitEvent } from "react";
import { parseAmountInputToCents } from "../../../lib/money";
import type {
  Account,
  Category,
  RecurringFrequency,
  RecurringRuleKind,
} from "../../../types";
import type { RecurringRuleFormValues } from "../../types";
import { inputStyle, primaryButtonStyle, secondaryButtonStyle } from "../style-constants";

const fieldLabelStyle = {
  display: "grid",
  gap: "0.35rem",
  minWidth: 0,
} as const;

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
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        }}
      >
        <label style={fieldLabelStyle}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>rule type</span>
          <select
            value={values.kind}
            onChange={(event) => onKindChange(event.target.value as RecurringRuleKind)}
            style={inputStyle}
          >
            <option value="standard">standard</option>
            <option value="transfer">transfer</option>
          </select>
        </label>

        <label style={fieldLabelStyle}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>name</span>
          <input
            type="text"
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={fieldLabelStyle}>
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

        <label style={fieldLabelStyle}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>
            {isTransferRule ? "from account" : "account"}
          </span>
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

        {isTransferRule ? (
          <label style={fieldLabelStyle}>
            <span style={{ fontSize: "0.9rem", color: "#374151" }}>to account</span>
            <select
              value={values.toAccountId}
              onChange={(event) => onChange("toAccountId", event.target.value)}
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
        ) : (
          <label style={fieldLabelStyle}>
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
        )}

        <label style={fieldLabelStyle}>
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
            <option value="yearly">yearly</option>
          </select>
        </label>

        <label style={fieldLabelStyle}>
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

        <label style={fieldLabelStyle}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>end date</span>
          <input
            type="date"
            value={values.endDate}
            onChange={(event) => onChange("endDate", event.target.value)}
            style={inputStyle}
          />
        </label>

        {values.frequency === "monthly" ? (
          <label style={fieldLabelStyle}>
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
        ) : values.frequency === "weekly" || values.frequency === "biweekly" ? (
          <label style={fieldLabelStyle}>
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
        ) : null}

        {!isTransferRule ? (
          <label style={fieldLabelStyle}>
            <span style={{ fontSize: "0.9rem", color: "#374151" }}>merchant</span>
            <input
              type="text"
              value={values.merchant}
              onChange={(event) => onChange("merchant", event.target.value)}
              style={inputStyle}
            />
          </label>
        ) : null}

        <label style={fieldLabelStyle}>
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

      {isTransferRule ? (
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
          transfer amounts are stored as positive values and generated as linked transfer pairs.
        </p>
      ) : (
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
          selected category kind: {selectedCategory?.kind ?? "n/a"}. saved amount will be {selectedCategory?.kind === "income" ? "positive" : "negative"}.
        </p>
      )}

      {error ? (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={submitDisabled || transferSubmitInvalid}
          style={{
            ...primaryButtonStyle,
            opacity: submitDisabled || transferSubmitInvalid ? 0.6 : 1,
            cursor:
              submitDisabled || transferSubmitInvalid
                ? "not-allowed"
                : "pointer",
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