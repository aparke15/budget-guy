export const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "0.875rem",
  padding: "1.1rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
} as const;

export const inputStyle = {
  width: "100%",
  minWidth: 0,
  minHeight: "2.5rem",
  padding: "0.6rem 0.75rem",
  borderRadius: "0.625rem",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
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
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
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
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
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
  border: "1px solid #ef4444",
  background: "#ffffff",
  color: "#b91c1c",
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
