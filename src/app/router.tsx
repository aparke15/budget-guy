import { createBrowserRouter } from "react-router-dom";

import App from "../app";
import { AccountsPage } from "../features/accounts/accounts-page";
import { BudgetPage } from "../features/budgets/budget-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { ForecastPage } from "../features/forecast/forecast-page";
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
        path: "forecast",
        element: <ForecastPage />,
      },
      {
        path: "budget",
        element: <BudgetPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);