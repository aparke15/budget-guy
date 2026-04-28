import { Suspense, lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import App from "../app";

const DashboardPage = lazy(async () => {
  const module = await import("../features/dashboard/dashboard-page");

  return { default: module.DashboardPage };
});

const TransactionsPage = lazy(async () => {
  const module = await import("../features/transactions/transactions-page");

  return { default: module.TransactionsPage };
});

const AccountsPage = lazy(async () => {
  const module = await import("../features/accounts/accounts-page");

  return { default: module.AccountsPage };
});

const BudgetPage = lazy(async () => {
  const module = await import("../features/budgets/budget-page");

  return { default: module.BudgetPage };
});

const CategoriesPage = lazy(async () => {
  const module = await import("../features/categories/categories-page");

  return { default: module.CategoriesPage };
});

const RecurringPage = lazy(async () => {
  const module = await import("../features/recurring/recurring-page");

  return { default: module.RecurringPage };
});

const ForecastPage = lazy(async () => {
  const module = await import("../features/forecast/forecast-page");

  return { default: module.ForecastPage };
});

const SettingsPage = lazy(async () => {
  const module = await import("../features/settings/settings-page");

  return { default: module.SettingsPage };
});

function RouteFallback() {
  return <div className="empty-state">loading...</div>;
}

function withRouteSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

export const appRoutes = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: withRouteSuspense(<DashboardPage />),
      },
      {
        path: "transactions",
        element: withRouteSuspense(<TransactionsPage />),
      },
      {
        path: "accounts",
        element: withRouteSuspense(<AccountsPage />),
      },
      {
        path: "budgets",
        element: withRouteSuspense(<BudgetPage />),
      },
      {
        path: "categories",
        element: withRouteSuspense(<CategoriesPage />),
      },
      {
        path: "budget",
        element: <Navigate to="/budgets" replace />,
      },
      {
        path: "recurring",
        element: withRouteSuspense(<RecurringPage />),
      },
      {
        path: "forecast",
        element: withRouteSuspense(<ForecastPage />),
      },
      {
        path: "settings",
        element: withRouteSuspense(<SettingsPage />),
      },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);