export const cardStyle = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "0.875rem",
  padding: "1.1rem",
  boxShadow: "var(--shadow-card)",
} as const;

export const inputStyle = {
  width: "100%",
  minWidth: 0,
  minHeight: "2.5rem",
  padding: "0.6rem 0.75rem",
  borderRadius: "0.625rem",
  border: "1px solid var(--border-strong)",
  background: "var(--bg-card)",
  color: "var(--text-default)",
} as const;

export const textAreaStyle = {
  ...inputStyle,
  minHeight: "unset",
  resize: "vertical",
} as const;

export const primaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "2.5rem",
  padding: "0.65rem 0.95rem",
  borderRadius: "0.625rem",
  border: "1px solid var(--button-primary-border)",
  background: "var(--button-primary-bg)",
  color: "var(--button-primary-text)",
  cursor: "pointer",
  fontWeight: 600,
} as const;

export const secondaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "2.5rem",
  padding: "0.65rem 0.95rem",
  borderRadius: "0.625rem",
  border: "1px solid var(--button-secondary-border)",
  background: "var(--button-secondary-bg)",
  color: "var(--button-secondary-text)",
  cursor: "pointer",
  fontWeight: 600,
} as const;

export const dangerButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "2.5rem",
  padding: "0.65rem 0.95rem",
  borderRadius: "0.625rem",
  border: "1px solid var(--button-danger-border)",
  background: "var(--button-danger-bg)",
  color: "var(--button-danger-text)",
  cursor: "pointer",
  fontWeight: 600,
} as const;

export const compactSecondaryButtonStyle = {
  ...secondaryButtonStyle,
  minHeight: "2rem",
  padding: "0.45rem 0.7rem",
  borderRadius: "0.5rem",
  fontSize: "0.9rem",
} as const;

export const compactDangerButtonStyle = {
  ...dangerButtonStyle,
  minHeight: "2rem",
  padding: "0.45rem 0.7rem",
  borderRadius: "0.5rem",
  fontSize: "0.9rem",
} as const;
