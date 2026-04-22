import "./app.css";

import { NavLink, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="shell-inner app-header-inner">
          <div className="brand">
            <div className="brand-title">budget mvp</div>
            <div className="brand-subtitle">
              local-first and gloriously unbank-synced
            </div>
          </div>

          <nav className="app-nav" aria-label="Primary">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              dashboard
            </NavLink>

            <NavLink
              to="/transactions"
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              transactions
            </NavLink>

            <NavLink
              to="/budget"
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              budgets
            </NavLink>

            <NavLink
              to="/accounts"
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              accounts
            </NavLink>

            <NavLink
              to="/recurring"
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              recurring
            </NavLink>

            <NavLink
              to="/forecast"
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              forecast
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              settings
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <div className="shell-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
