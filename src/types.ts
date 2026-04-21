export type AccountType = "checking" | "savings" | "credit" | "cash";

export type CategoryKind = "income" | "expense";

export type RecurringFrequency = "monthly" | "weekly" | "biweekly";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  color?: string;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  date: string; // yyyy-mm-dd
  amountCents: number; // positive = income, negative = expense
  accountId: string;
  categoryId: string;
  merchant?: string;
  note?: string;
  source: "manual" | "recurring";
  recurringRuleId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Budget = {
  id: string;
  month: string; // yyyy-mm
  categoryId: string;
  plannedCents: number;
  createdAt: string;
  updatedAt: string;
};

export type RecurringRule = {
  id: string;
  name: string;
  amountCents: number; // positive = income, negative = expense
  accountId: string;
  categoryId: string;
  merchant?: string;
  note?: string;
  frequency: RecurringFrequency;
  startDate: string; // yyyy-mm-dd
  endDate?: string; // yyyy-mm-dd
  active: boolean;
  dayOfMonth?: number; // monthly only
  dayOfWeek?: number; // weekly/biweekly only
  createdAt: string;
  updatedAt: string;
};

export type BudgetRow = {
  categoryId: string;
  categoryName: string;
  plannedCents: number;
  actualCents: number;
  remainingCents: number;
  overBudget: boolean;
};

export type MonthlySummary = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  plannedCents: number;
  unassignedCents: number;
};

export type GeneratedRecurringOccurrence = {
  recurringRuleId: string;
  date: string;
  amountCents: number;
  accountId: string;
  categoryId: string;
  merchant?: string;
  note?: string;
};

export type PersistedState = {
  version: 1;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
};