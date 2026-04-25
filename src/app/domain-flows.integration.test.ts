import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAccountBalanceCents,
  getAccountLedgerBalanceCents,
  getAccountMonthlyHistoryRows,
  getAllAccountBalances,
} from "../lib/account-balances";
import { createAccount } from "../lib/factories";
import { getBudgetRows, getMonthlySummary } from "../lib/money";
import { countTransactionCategoryUsageByCategoryId } from "../lib/transaction-splits";
import {
  LATEST_PERSISTED_STATE_VERSION,
  type PersistedState,
} from "../types";

const storageKey = "budget-mvp";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function createPersistedState(
  overrides: Partial<PersistedState> = {}
): PersistedState {
  return {
    version: LATEST_PERSISTED_STATE_VERSION,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurringRules: [],
    ...overrides,
  };
}

async function loadStore(initialState?: PersistedState) {
  const localStorage = new MemoryStorage();
  let uuidCounter = 0;

  if (initialState) {
    localStorage.setItem(storageKey, JSON.stringify(initialState));
  }

  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => `generated-uuid-${++uuidCounter}`),
  });
  vi.resetModules();

  const module = await import("./store");

  return module.useAppStore;
}

describe("domain flow integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps opening balances singular while still affecting balances and history only", async () => {
    const useAppStore = await loadStore(
      createPersistedState({
        categories: [
          {
            id: "cat-income",
            name: "salary",
            kind: "income",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "cat-groceries",
            name: "groceries",
            kind: "expense",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        budgets: [
          {
            id: "budget-groceries",
            month: "2026-04",
            categoryId: "cat-groceries",
            plannedCents: 15000,
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );

    const account = createAccount({
      name: "checking",
      type: "checking",
    });

    useAppStore.getState().addAccount(account);
    useAppStore.getState().upsertAccountOpeningBalance(account.id, 10000, "2026-04-01");
    useAppStore.getState().addTransaction({
      id: "txn-paycheck",
      kind: "standard",
      date: "2026-04-05",
      amountCents: 50000,
      accountId: account.id,
      categoryId: "cat-income",
      merchant: "Employer",
      source: "manual",
      createdAt: "2026-04-05T00:00:00.000Z",
      updatedAt: "2026-04-05T00:00:00.000Z",
    });
    useAppStore.getState().addTransaction({
      id: "txn-groceries",
      kind: "standard",
      date: "2026-04-06",
      amountCents: -12000,
      accountId: account.id,
      categoryId: "cat-groceries",
      merchant: "Market",
      source: "manual",
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z",
    });

    let transactions = useAppStore.getState().transactions;
    let openingBalances = transactions.filter(
      (transaction) =>
        transaction.accountId === account.id &&
        transaction.kind === "opening-balance"
    );

    expect(openingBalances).toHaveLength(1);
    expect(getAccountBalanceCents(transactions, account.id)).toBe(48000);
    expect(
      getAccountMonthlyHistoryRows(transactions, account.id, "all", "2026-04")
    ).toEqual([
      {
        month: "2026-04",
        inflowsCents: 60000,
        outflowsCents: 12000,
        netChangeCents: 48000,
        closingBalanceCents: 48000,
      },
    ]);
    expect(getMonthlySummary(transactions, useAppStore.getState().budgets, "2026-04")).toEqual({
      incomeCents: 50000,
      expenseCents: 12000,
      netCents: 38000,
      plannedCents: 15000,
      unassignedCents: 35000,
    });
    expect(
      getBudgetRows(
        useAppStore.getState().categories,
        useAppStore.getState().budgets,
        transactions,
        "2026-04"
      )
    ).toEqual([
      {
        categoryId: "cat-groceries",
        categoryName: "groceries",
        plannedCents: 15000,
        actualCents: 12000,
        remainingCents: 3000,
        overBudget: false,
      },
    ]);

    useAppStore.getState().upsertAccountOpeningBalance(account.id, 25000, "2026-04-02");
    transactions = useAppStore.getState().transactions;
    openingBalances = transactions.filter(
      (transaction) =>
        transaction.accountId === account.id &&
        transaction.kind === "opening-balance"
    );

    expect(openingBalances).toHaveLength(1);
    expect(openingBalances[0]).toMatchObject({
      amountCents: 25000,
      date: "2026-04-02",
    });
    expect(getAccountBalanceCents(transactions, account.id)).toBe(63000);

    useAppStore.getState().deleteAccountOpeningBalance(account.id);

    expect(
      useAppStore
        .getState()
        .transactions.filter(
          (transaction) =>
            transaction.accountId === account.id &&
            transaction.kind === "opening-balance"
        )
    ).toHaveLength(0);
    expect(getAccountBalanceCents(useAppStore.getState().transactions, account.id)).toBe(38000);
  });

  it("keeps transfer create, edit, delete flows pair-safe and balance-correct", async () => {
    const useAppStore = await loadStore(
      createPersistedState({
        accounts: [
          {
            id: "acct-checking",
            name: "checking",
            type: "checking",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "acct-savings",
            name: "savings",
            type: "savings",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );

    useAppStore.getState().addTransfer({
      date: "2026-04-21",
      fromAccountId: "acct-checking",
      toAccountId: "acct-savings",
      amountCents: 5000,
      note: "move cash",
    });

    let transactions = useAppStore.getState().transactions;
    const transferGroupId = transactions[0]?.transferGroupId;

    expect(transactions).toHaveLength(2);
    expect(transferGroupId).toBeTruthy();
    expect(transactions).toEqual([
      expect.objectContaining({
        kind: "transfer",
        transferGroupId,
        accountId: "acct-checking",
        amountCents: -5000,
        note: "move cash",
      }),
      expect.objectContaining({
        kind: "transfer",
        transferGroupId,
        accountId: "acct-savings",
        amountCents: 5000,
        note: "move cash",
      }),
    ]);
    expect(getAccountBalanceCents(transactions, "acct-checking")).toBe(-5000);
    expect(getAccountBalanceCents(transactions, "acct-savings")).toBe(5000);

    useAppStore.getState().updateTransfer(transferGroupId!, {
      date: "2026-04-22",
      fromAccountId: "acct-savings",
      toAccountId: "acct-checking",
      amountCents: 8000,
      note: "move back",
    });

    transactions = useAppStore.getState().transactions;
    expect(transactions).toEqual([
      expect.objectContaining({
        kind: "transfer",
        transferGroupId,
        accountId: "acct-savings",
        amountCents: -8000,
        note: "move back",
      }),
      expect.objectContaining({
        kind: "transfer",
        transferGroupId,
        accountId: "acct-checking",
        amountCents: 8000,
        note: "move back",
      }),
    ]);
    expect(getAccountBalanceCents(transactions, "acct-checking")).toBe(8000);
    expect(getAccountBalanceCents(transactions, "acct-savings")).toBe(-8000);

    useAppStore.getState().deleteTransfer(transferGroupId!);

    expect(useAppStore.getState().transactions).toEqual([]);
    expect(getAccountBalanceCents(useAppStore.getState().transactions, "acct-checking")).toBe(0);
    expect(getAccountBalanceCents(useAppStore.getState().transactions, "acct-savings")).toBe(0);
  });

  it("preserves signed credit-account ledger semantics while displaying owed and available credit", async () => {
    const useAppStore = await loadStore(
      createPersistedState({
        accounts: [
          {
            id: "acct-checking",
            name: "checking",
            type: "checking",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "acct-credit",
            name: "visa",
            type: "credit",
            creditLimitCents: 50000,
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        categories: [
          {
            id: "cat-food",
            name: "food",
            kind: "expense",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "cat-refund",
            name: "refund",
            kind: "income",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );

    useAppStore.getState().addTransaction({
      id: "txn-credit-charge",
      kind: "standard",
      date: "2026-04-03",
      amountCents: -12000,
      accountId: "acct-credit",
      categoryId: "cat-food",
      merchant: "grocer",
      source: "manual",
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    });
    useAppStore.getState().addTransaction({
      id: "txn-credit-refund",
      kind: "standard",
      date: "2026-04-05",
      amountCents: 2000,
      accountId: "acct-credit",
      categoryId: "cat-refund",
      merchant: "grocer",
      source: "manual",
      createdAt: "2026-04-05T00:00:00.000Z",
      updatedAt: "2026-04-05T00:00:00.000Z",
    });
    useAppStore.getState().addTransfer({
      date: "2026-04-10",
      fromAccountId: "acct-checking",
      toAccountId: "acct-credit",
      amountCents: 5000,
      note: "card payment",
    });

    const transactions = useAppStore.getState().transactions;
    const creditPaymentIn = transactions.find(
      (transaction) =>
        transaction.kind === "transfer" && transaction.accountId === "acct-credit"
    );

    expect(creditPaymentIn).toMatchObject({
      amountCents: 5000,
      transferGroupId: expect.any(String),
    });
    expect(getAccountLedgerBalanceCents(transactions, "acct-credit")).toBe(-5000);
    expect(getAllAccountBalances(useAppStore.getState().accounts, transactions)).toEqual([
      {
        accountId: "acct-checking",
        accountName: "checking",
        accountType: "checking",
        balanceCents: -5000,
        displayLabel: "balance",
        displayValueCents: -5000,
        creditLimitCents: undefined,
        availableCreditCents: undefined,
      },
      {
        accountId: "acct-credit",
        accountName: "visa",
        accountType: "credit",
        balanceCents: -5000,
        displayLabel: "balance",
        displayValueCents: -5000,
        creditLimitCents: 50000,
        availableCreditCents: 45000,
      },
    ]);
  });

  it("returns recurring generation summaries while staying idempotent for standard and transfer rules", async () => {
    const useAppStore = await loadStore(
      createPersistedState({
        accounts: [
          {
            id: "acct-checking",
            name: "checking",
            type: "checking",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "acct-savings",
            name: "savings",
            type: "savings",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        categories: [
          {
            id: "cat-rent",
            name: "rent",
            kind: "expense",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        recurringRules: [
          {
            id: "rule-rent",
            kind: "standard",
            name: "rent",
            amountCents: -100000,
            accountId: "acct-checking",
            categoryId: "cat-rent",
            frequency: "monthly",
            startDate: "2026-01-01",
            active: true,
            dayOfMonth: 5,
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "rule-save",
            kind: "transfer",
            name: "save",
            amountCents: 2500,
            accountId: "acct-checking",
            toAccountId: "acct-savings",
            frequency: "monthly",
            startDate: "2026-01-01",
            active: true,
            dayOfMonth: 10,
            note: "monthly save",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );

    const firstSummary = useAppStore.getState().generateRecurringForMonth("2026-04");

    expect(firstSummary).toEqual({
      startMonth: "2026-04",
      endMonth: "2026-04",
      monthCount: 1,
      createdOccurrences: 2,
      createdTransactions: 3,
      createdTransfers: 1,
      duplicateOccurrences: 0,
      ruleResults: [
        {
          recurringRuleId: "rule-rent",
          ruleName: "rent",
          kind: "standard",
          createdOccurrences: 1,
          createdTransactions: 1,
          createdTransfers: 0,
          duplicateOccurrences: 0,
        },
        {
          recurringRuleId: "rule-save",
          ruleName: "save",
          kind: "transfer",
          createdOccurrences: 1,
          createdTransactions: 2,
          createdTransfers: 1,
          duplicateOccurrences: 0,
        },
      ],
    });

    let transactions = useAppStore.getState().transactions;
    expect(transactions).toHaveLength(3);
    expect(
      transactions.filter(
        (transaction) =>
          transaction.recurringRuleId === "rule-rent" && transaction.date === "2026-04-05"
      )
    ).toHaveLength(1);
    expect(
      transactions.filter(
        (transaction) =>
          transaction.recurringRuleId === "rule-save" && transaction.date === "2026-04-10"
      )
    ).toHaveLength(2);

    const secondSummary = useAppStore.getState().generateRecurringForMonth("2026-04");

    expect(secondSummary).toEqual({
      startMonth: "2026-04",
      endMonth: "2026-04",
      monthCount: 1,
      createdOccurrences: 0,
      createdTransactions: 0,
      createdTransfers: 0,
      duplicateOccurrences: 2,
      ruleResults: [
        {
          recurringRuleId: "rule-rent",
          ruleName: "rent",
          kind: "standard",
          createdOccurrences: 0,
          createdTransactions: 0,
          createdTransfers: 0,
          duplicateOccurrences: 1,
        },
        {
          recurringRuleId: "rule-save",
          ruleName: "save",
          kind: "transfer",
          createdOccurrences: 0,
          createdTransactions: 0,
          createdTransfers: 0,
          duplicateOccurrences: 1,
        },
      ],
    });

    transactions = useAppStore.getState().transactions;
    expect(transactions).toHaveLength(3);
  });

  it("uses split allocations for category reporting while keeping balances on the parent transaction", async () => {
    const useAppStore = await loadStore(
      createPersistedState({
        accounts: [
          {
            id: "acct-checking",
            name: "checking",
            type: "checking",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        categories: [
          {
            id: "cat-food",
            name: "food",
            kind: "expense",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "cat-household",
            name: "household",
            kind: "expense",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "cat-income",
            name: "salary",
            kind: "income",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        budgets: [
          {
            id: "budget-food",
            month: "2026-04",
            categoryId: "cat-food",
            plannedCents: 5000,
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "budget-household",
            month: "2026-04",
            categoryId: "cat-household",
            plannedCents: 6000,
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );

    useAppStore.getState().addTransaction({
      id: "txn-income",
      kind: "standard",
      date: "2026-04-03",
      amountCents: 20000,
      accountId: "acct-checking",
      categoryId: "cat-income",
      source: "manual",
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    });
    useAppStore.getState().addTransaction({
      id: "txn-split",
      kind: "standard",
      date: "2026-04-04",
      amountCents: -7000,
      accountId: "acct-checking",
      merchant: "warehouse",
      splits: [
        {
          id: "split-food",
          categoryId: "cat-food",
          amountCents: -2500,
        },
        {
          id: "split-household",
          categoryId: "cat-household",
          amountCents: -4500,
        },
      ],
      source: "manual",
      createdAt: "2026-04-04T00:00:00.000Z",
      updatedAt: "2026-04-04T00:00:00.000Z",
    });

    const { transactions, budgets, categories } = useAppStore.getState();

    expect(getAccountBalanceCents(transactions, "acct-checking")).toBe(13000);
    expect(getMonthlySummary(transactions, budgets, "2026-04")).toEqual({
      incomeCents: 20000,
      expenseCents: 7000,
      netCents: 13000,
      plannedCents: 11000,
      unassignedCents: 9000,
    });
    expect(getBudgetRows(categories, budgets, transactions, "2026-04")).toEqual([
      {
        categoryId: "cat-household",
        categoryName: "household",
        plannedCents: 6000,
        actualCents: 4500,
        remainingCents: 1500,
        overBudget: false,
      },
      {
        categoryId: "cat-food",
        categoryName: "food",
        plannedCents: 5000,
        actualCents: 2500,
        remainingCents: 2500,
        overBudget: false,
      },
    ]);
    expect(countTransactionCategoryUsageByCategoryId(transactions)).toEqual({
      "cat-income": 1,
      "cat-food": 1,
      "cat-household": 1,
    });
  });
});