import type {
  Account,
  AccountType,
  Category,
  CategoryKind,
  RecurringFrequency,
  RecurringRuleKind,
  RecurringRule,
  Transaction,
} from "../types";

export type TransactionEntryType = CategoryKind | "transfer";

export type TransferFormInput = {
  date: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  note?: string;
};

export type TransactionFormValues = {
  date: string;
  entryType: TransactionEntryType;
  amount: string;
  accountId: string;
  categoryId: string;
  merchant: string;
  note: string;
  fromAccountId: string;
  toAccountId: string;
};

export type TransactionFormInitialState =
  | {
      mode: "standard";
      transaction: Transaction;
    }
  | ({
      mode: "transfer";
      transferGroupId: string;
    } & TransferFormInput);

export type TransactionFormSubmission =
  | {
      mode: "standard";
      transaction: Transaction;
    }
  | {
      mode: "transfer";
      transferGroupId?: string;
      input: TransferFormInput;
    };

export type AccountFormValues = {
  name: string;
  type: AccountType;
  creditLimit: string;
  openingBalance: string;
  openingBalanceDate: string;
};

export type CategoryFormValues = {
  name: string;
  kind: CategoryKind;
};

export type RecurringRuleFormValues = {
  kind: RecurringRuleKind;
  name: string;
  amount: string;
  accountId: string;
  toAccountId: string;
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
  initialState?: TransactionFormInitialState;
  submitLabel: string;
  onSubmit: (submission: TransactionFormSubmission) => void;
  onCancel?: () => void;
};

export type RecurringRuleCandidateParams = {
  values: RecurringRuleFormValues;
  categories: Category[];
  existing?: RecurringRule;
};