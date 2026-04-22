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
          <span style={{ fontSize: "0.9rem", color: "#374151" }}>kind</span>
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
};
