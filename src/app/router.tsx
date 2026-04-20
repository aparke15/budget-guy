import { createBrowserRouter } from "react-router-dom";

import App from "../app";
import { BudgetPage } from "../features/budgets/budget-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
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