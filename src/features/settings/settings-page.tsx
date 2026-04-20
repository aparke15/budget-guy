import { useappstore } from "../../app/store";

export function SettingsPage() {
  const accounts = useappstore((state) => state.accounts);
  const categories = useappstore((state) => state.categories);
  const recurringRules = useappstore((state) => state.recurringRules);
  const resetseeddata = useappstore((state) => state.resetseeddata);

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.8rem" }}>settings</h1>
        <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
          currently more census than settings, but we move.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>accounts</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {accounts.map((account) => (
              <li key={account.id}>
                {account.name} ({account.type})
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>categories</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {categories.map((category) => (
              <li key={category.id}>
                {category.name} ({category.kind})
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>recurring rules</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {recurringRules.map((rule) => (
              <li key={rule.id}>
                {rule.name} ({rule.frequency})
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>dev actions</h2>

        <button
          type="button"
          onClick={() => resetseeddata()}
          style={{
            padding: "0.7rem 0.95rem",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            background: "#111827",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          reset seed data
        </button>
      </div>
    </section>
  );
}