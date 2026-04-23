import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import "./app.css";
import { applyTheme, getPreferredTheme, persistThemePreference, type Theme } from "./app/theme";

const navItems: Array<{ to: string; label: string; end?: boolean }> = [
  { to: "/", label: "dashboard", end: true },
  { to: "/transactions", label: "transactions" },
  { to: "/budgets", label: "budgets" },
  { to: "/accounts", label: "accounts" },
  { to: "/recurring", label: "recurring" },
  { to: "/forecast", label: "forecast" },
  { to: "/settings", label: "settings" },
];

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => getPreferredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function handleThemeToggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    persistThemePreference(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__content">
          <div className="app-brand">
            <div className="app-brand__title">budget mvp</div>
            <div className="app-brand__subtitle">
              local-first and gloriously unbank-synced
            </div>
          </div>

          <div className="app-header__actions">
            <nav className="app-nav">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    isActive
                      ? "app-nav__link app-nav__link--active"
                      : "app-nav__link"
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <button
              type="button"
              className="theme-toggle"
              onClick={handleThemeToggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              aria-pressed={theme === "dark"}
            >
              <span className="theme-toggle__icon" aria-hidden="true">
                {theme === "dark" ? "☀" : "☾"}
              </span>
              <span>{theme === "dark" ? "light mode" : "dark mode"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
