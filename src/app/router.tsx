import { Navigate, createBrowserRouter } from "react-router-dom";

import App from "../app";
import { AccountsPage } from "../features/accounts/accounts-page";
import { BudgetPage } from "../features/budgets/budget-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { ForecastPage } from "../features/forecast/forecast-page";
import { RecurringPage } from "../features/recurring/recurring-page";
import { SettingsPage } from "../features/settings/settings-page";
import { TransactionsPage } from "../features/transactions/transactions-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "transactions",
        element: <TransactionsPage />,
      },
      {
        path: "accounts",
        element: <AccountsPage />,
      },
      {
        path: "budgets",
        element: <BudgetPage />,
      },
      {
        path: "budget",
        element: <Navigate to="/budgets" replace />,
      },
      {
        path: "recurring",
        element: <RecurringPage />,
      },
      {
        path: "forecast",
        element: <ForecastPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);