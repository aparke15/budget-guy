import type { SubmitEvent } from "react";
import type { AccountFormValues } from "../../types";
import { inputStyle, primaryButtonStyle, secondaryButtonStyle } from "../style-constants";
import type { AccountType } from "../../../types";

type AccountEditorProps = {
  values: AccountFormValues;
  error: string;
  submitLabel: string;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof AccountFormValues>(
    key: K,
    value: AccountFormValues[K]
  ) => void;
  onCancel?: () => void;
};

export function AccountEditor(props: AccountEditorProps) {
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

        {values.type === "credit" ? (
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.9rem", color: "#374151" }}>
              credit limit
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={values.creditLimit}
              onChange={(event) => onChange("creditLimit", event.target.value)}
              style={inputStyle}
            />
          </label>
        ) : null}

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>
            opening balance
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={values.openingBalance}
            onChange={(event) => onChange("openingBalance", event.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>
            opening balance date
          </span>
          <input
            type="date"
            value={values.openingBalanceDate}
            onChange={(event) => onChange("openingBalanceDate", event.target.value)}
            style={inputStyle}
          />
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