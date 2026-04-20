import { NavLink, Outlet } from "react-router-dom";

function getNavLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: "0.5rem 0.75rem",
    borderRadius: "0.5rem",
    textDecoration: "none",
    color: isActive ? "#111827" : "#4b5563",
    background: isActive ? "#e5e7eb" : "transparent",
    fontWeight: isActive ? 600 : 500,
  };
}

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        color: "#111827",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              budget mvp
            </div>
            <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
              local-first and gloriously unbank-synced
            </div>
          </div>

          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <NavLink to="/" end>
              {({ isActive }) => (
                <span style={getNavLinkStyle(isActive)}>dashboard</span>
              )}
            </NavLink>

            <NavLink to="/transactions">
              {({ isActive }) => (
                <span style={getNavLinkStyle(isActive)}>transactions</span>
              )}
            </NavLink>

            <NavLink to="/budget">
              {({ isActive }) => (
                <span style={getNavLinkStyle(isActive)}>budget</span>
              )}
            </NavLink>

            <NavLink to="/settings">
              {({ isActive }) => (
                <span style={getNavLinkStyle(isActive)}>settings</span>
              )}
            </NavLink>
          </nav>
        </div>
      </header>

      <main
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "1.5rem 1.25rem 3rem",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
