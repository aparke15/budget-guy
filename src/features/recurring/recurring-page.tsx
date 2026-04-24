import { Navigate } from "react-router-dom";

export function RecurringPage() {
  return <Navigate to="/transactions?tab=recurring" replace />;
}
