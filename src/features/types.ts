import type {
  Account,
  AccountType,
  Category,
  CategoryKind,
  RecurringFrequency,
  RecurringRule,
  Transaction,
} from "../types";

export type TransactionFormValues = {
  date: string;
  kind: CategoryKind;
  amount: string;
  accountId: string;
  categoryId: string;
  merchant: string;
  note: string;
};

export type AccountFormValues = {
  name: string;
  type: AccountType;
};

export type CategoryFormValues = {
  name: string;
  kind: CategoryKind;
};

export type RecurringRuleFormValues = {
  name: string;
  amount: string;
  accountId: string;
  categoryId: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string;
  active: boolean;
  dayOfMonth: string;
  dayOfWeek: string;
  merchant: string;
  note: string;
};

export type TransactionFormProps = {
  accounts: Account[];
  categories: Category[];
  initialTransaction?: Transaction;
  submitLabel: string;
  onSubmit: (transaction: Transaction) => void;
  onCancel?: () => void;
};

export type RecurringRuleCandidateParams = {
  values: RecurringRuleFormValues;
  categories: Category[];
  existing?: RecurringRule;
};