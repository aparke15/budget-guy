export type accounttype = "checking" | "savings" | "credit" | "cash";

export type categorykind = "income" | "expense";

export type recurringfrequency = "monthly" | "weekly" | "biweekly";

export type account = {
  id: string;
  name: string;
  type: accounttype;
  createdAt: string;
  updatedAt: string;
};

export type category = {
  id: string;
  name: string;
  kind: categorykind;
  color?: string;
  createdAt: string;
  updatedAt: string;
};

export type transaction = {
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

export type budget = {
  id: string;
  month: string; // yyyy-mm
  categoryId: string;
  plannedCents: number;
  createdAt: string;
  updatedAt: string;
};

export type recurringrule = {
  id: string;
  name: string;
  amountCents: number; // positive = income, negative = expense
  accountId: string;
  categoryId: string;
  merchant?: string;
  note?: string;
  frequency: recurringfrequency;
  startDate: string; // yyyy-mm-dd
  endDate?: string; // yyyy-mm-dd
  active: boolean;
  dayOfMonth?: number; // monthly only
  dayOfWeek?: number; // weekly/biweekly only
  createdAt: string;
  updatedAt: string;
};

export type budgetrow = {
  categoryId: string;
  categoryName: string;
  plannedCents: number;
  actualCents: number;
  remainingCents: number;
  overBudget: boolean;
};

export type monthlysummary = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  plannedCents: number;
  unassignedCents: number;
};

export type generatedrecurringoccurrence = {
  recurringRuleId: string;
  date: string;
  amountCents: number;
  accountId: string;
  categoryId: string;
  merchant?: string;
  note?: string;
};

export type persistedstate = {
  version: 1;
  accounts: account[];
  categories: category[];
  transactions: transaction[];
  budgets: budget[];
  recurringRules: recurringrule[];
};