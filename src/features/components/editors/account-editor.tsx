import type { SubmitEvent } from "react";
import type { AccountFormValues } from "../../types";
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
    <form onSubmit={onSubmit} className="stack-sm">
      <div className="form-grid">
        <label className="field">
          <span className="field__label">name</span>
          <input
            type="text"
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
            className="control"
          />
        </label>

        <label className="field">
          <span className="field__label">type</span>
          <select
            value={values.type}
            onChange={(event) =>
              onChange("type", event.target.value as AccountType)
            }
            className="control"
          >
            <option value="checking">checking</option>
            <option value="savings">savings</option>
            <option value="credit">credit</option>
            <option value="cash">cash</option>
          </select>
        </label>

        {values.type === "credit" ? (
          <label className="field">
            <span className="field__label">credit limit</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={values.creditLimit}
              onChange={(event) => onChange("creditLimit", event.target.value)}
              className="control"
            />
          </label>
        ) : null}

        <label className="field">
          <span className="field__label">opening balance</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={values.openingBalance}
            onChange={(event) => onChange("openingBalance", event.target.value)}
            className="control"
          />
        </label>

        <label className="field">
          <span className="field__label">opening balance date</span>
          <input
            type="date"
            value={values.openingBalanceDate}
            onChange={(event) => onChange("openingBalanceDate", event.target.value)}
            className="control"
          />
        </label>
      </div>

      {error ? (
        <p className="message message--error">{error}</p>
      ) : null}

      <div className="button-row">
        <button type="submit" className="button button--primary">
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