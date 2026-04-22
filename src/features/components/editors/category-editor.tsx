import type { SubmitEvent } from "react";
import type { CategoryFormValues } from "../../types";
import { inputStyle, primaryButtonStyle, secondaryButtonStyle } from "../style-constants";
import type { CategoryKind } from "../../../types";

type CategoryEditorProps = {
  values: CategoryFormValues;
  error: string;
  submitLabel: string;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof CategoryFormValues>(
    key: K,
    value: CategoryFormValues[K]
  ) => void;
  onCancel?: () => void;
};

export function CategoryEditor(props: CategoryEditorProps) {
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
            style={inputStyle}
          />
        </label>

        <label className="field">
          <span className="field__label">kind</span>
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
        <p className="message message--error">{error}</p>
      ) : null}

      <div className="button-row">
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
};
