export type AccountType = "checking" | "savings" | "credit" | "cash";

export type CategoryKind = "income" | "expense";

export type TransactionKind = "standard" | "transfer" | "opening-balance";

export type RecurringFrequency = "monthly" | "weekly" | "biweekly" | "yearly";

export type RecurringRuleKind = "standard" | "transfer";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  creditLimitCents?: number;
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
  kind: TransactionKind;
  date: string; // yyyy-mm-dd
  amountCents: number;
  accountId: string;
  categoryId?: string; // required for standard, omitted for transfer/opening-balance
  merchant?: string;
  note?: string;
  source: "manual" | "recurring";
  recurringRuleId?: string;
  transferGroupId?: string; // required for transfer, absent for standard/opening-balance
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
  kind: RecurringRuleKind;
  name: string;
  amountCents: number;
  accountId: string; // standard: transaction account, transfer: from account
  toAccountId?: string; // transfer only
  categoryId?: string; // standard only
  merchant?: string; // standard only
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
  kind: RecurringRuleKind;
  date: string;
  amountCents: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  merchant?: string;
  note?: string;
};

export type RecurringGenerationRuleSummary = {
  recurringRuleId: string;
  ruleName: string;
  kind: RecurringRuleKind;
  createdOccurrences: number;
  createdTransactions: number;
  createdTransfers: number;
  duplicateOccurrences: number;
};

export type RecurringGenerationSummary = {
  month: string;
  createdOccurrences: number;
  createdTransactions: number;
  createdTransfers: number;
  duplicateOccurrences: number;
  ruleResults: RecurringGenerationRuleSummary[];
};

export type PersistedState = {
  version: 1;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
};