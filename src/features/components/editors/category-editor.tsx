import type { SubmitEvent } from "react";

import type { CategoryKind } from "../../../types";
import type { CategoryFormValues } from "../../types";

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
    <form onSubmit={onSubmit} className="stack-md">
      <div className="form-grid">
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
          <span className="field-label">kind</span>
          <select
            value={values.kind}
            onChange={(event) => onChange("kind", event.target.value as CategoryKind)}
            className="control"
          >
            <option value="expense">expense</option>
            <option value="income">income</option>
          </select>
        </label>
      </div>

      {error ? <p className="status-message status-message--error">{error}</p> : null}

      <div className="form-actions">
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
