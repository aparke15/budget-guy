import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parsePersistedStateJson } from "./storage";
import { createSeedState } from "../seed/seed-data";
import {
  LATEST_PERSISTED_STATE_VERSION,
  type PersistedState,
} from "../types";

const storagekey = "budget-mvp";

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

function guessCategoryKind(categoryId: string): "income" | "expense" {
  return categoryId.includes("income") || categoryId.includes("salary")
    ? "income"
    : "expense";
}

function getReferencedCategoryIds(overrides: Partial<PersistedState>): string[] {
  return [
    ...(overrides.transactions ?? []).flatMap((transaction) => [
      ...(transaction.categoryId ? [transaction.categoryId] : []),
      ...(transaction.splits?.map((split) => split.categoryId) ?? []),
    ]),
    ...(overrides.budgets ?? []).map((budget) => budget.categoryId),
    ...(overrides.recurringRules ?? []).flatMap((rule) =>
      rule.categoryId ? [rule.categoryId] : []
    ),
  ];
}

function createPersistedState(overrides: Partial<PersistedState> = {}): PersistedState {
  const categories = overrides.categories ?? [];
  const existingCategoryIds = new Set(categories.map((category) => category.id));
  const inferredCategories = getReferencedCategoryIds(overrides)
    .filter((categoryId) => !existingCategoryIds.has(categoryId))
    .map((categoryId) => ({
      id: categoryId,
      name: categoryId,
      kind: guessCategoryKind(categoryId),
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    }));

  return {
    version: LATEST_PERSISTED_STATE_VERSION,
    accounts: [],
    categories: [...categories, ...inferredCategories],
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
    localStorage.setItem(storagekey, JSON.stringify(initialState));
  }

  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => `generated-uuid-${++uuidCounter}`),
  });
  vi.resetModules();

  const module = await import("./store");

  return {
    useAppStore: module.useAppStore,
    localStorage,
  };
}

describe("app store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("hydrates from persisted state and sorts transactions newest first", async () => {
    const persisted = createPersistedState({
      transactions: [
        {
          id: "txn-older",
          kind: "standard",
          date: "2026-04-01",
          amountCents: -100,
          accountId: "acct-1",
          categoryId: "cat-1",
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "txn-newer",
          kind: "standard",
          date: "2026-04-10",
          amountCents: -200,
          accountId: "acct-1",
          categoryId: "cat-1",
          source: "manual",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    expect(useAppStore.getState().transactions.map((item) => item.id)).toEqual([
      "txn-newer",
      "txn-older",
    ]);
  });

  it("updates entities and persists the latest state to local storage", async () => {
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-1",
          name: "checking",
          type: "checking",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore, localStorage } = await loadStore(persisted);

    useAppStore.getState().updateAccount("acct-1", {
      name: "main checking",
      type: "savings",
    });

    expect(useAppStore.getState().accounts[0]).toMatchObject({
      id: "acct-1",
      name: "main checking",
      type: "savings",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-21T12:34:56.000Z",
    });

    const saved = JSON.parse(localStorage.getItem(storagekey) ?? "null") as PersistedState;

    expect(saved.accounts[0]).toMatchObject({
      id: "acct-1",
      name: "main checking",
      type: "savings",
      updatedAt: "2026-04-21T12:34:56.000Z",
    });
  });

  it("rejects invalid account updates before committing state", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-1",
          name: "checking",
          type: "checking",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().updateAccount("acct-1", {
      creditLimitCents: 1000,
    });

    expect(useAppStore.getState().accounts[0]).not.toHaveProperty("creditLimitCents");
    expect(warnSpy).toHaveBeenCalledWith(
      "rejecting invalid store update",
      expect.objectContaining({ action: "updateAccount" })
    );
  });

  it("creates an account opening-balance transaction and keeps exactly one per account", async () => {
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-1",
          name: "checking",
          type: "checking",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore
      .getState()
      .upsertAccountOpeningBalance("acct-1", 15000, "2026-04-01");
    useAppStore
      .getState()
      .upsertAccountOpeningBalance("acct-1", 25000, "2026-04-02");

    const openingBalances = useAppStore
      .getState()
      .transactions.filter(
        (transaction) =>
          transaction.accountId === "acct-1" &&
          transaction.kind === "opening-balance"
      );

    expect(openingBalances).toHaveLength(1);
    expect(openingBalances[0]).toMatchObject({
      amountCents: 25000,
      date: "2026-04-02",
    });
  });

  it("clears an existing account opening-balance transaction", async () => {
    const persisted = createPersistedState({
      transactions: [
        {
          id: "txn-opening",
          kind: "opening-balance",
          date: "2026-04-01",
          amountCents: 15000,
          accountId: "acct-1",
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().deleteAccountOpeningBalance("acct-1");

    expect(useAppStore.getState().transactions).toEqual([]);
  });

  it("rejects opening-balance updates for missing accounts", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { useAppStore } = await loadStore(createPersistedState());

    useAppStore
      .getState()
      .upsertAccountOpeningBalance("acct-missing", 15000, "2026-04-01");

    expect(useAppStore.getState().transactions).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      "rejecting invalid store update",
      expect.objectContaining({ action: "upsertAccountOpeningBalance" })
    );
  });

  it("deletes account-linked transactions including opening balances", async () => {
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-1",
          name: "checking",
          type: "checking",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-opening",
          kind: "opening-balance",
          date: "2026-04-01",
          amountCents: 15000,
          accountId: "acct-1",
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "txn-standard",
          kind: "standard",
          date: "2026-04-02",
          amountCents: -500,
          accountId: "acct-1",
          categoryId: "cat-1",
          source: "manual",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-1",
          kind: "standard",
          name: "rent",
          amountCents: -1000,
          accountId: "acct-1",
          categoryId: "cat-1",
          frequency: "monthly",
          startDate: "2026-04-01",
          active: true,
          dayOfMonth: 1,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().deleteAccount("acct-1");

    expect(useAppStore.getState().accounts).toEqual([]);
    expect(useAppStore.getState().transactions).toEqual([]);
    expect(useAppStore.getState().recurringRules).toEqual([]);
  });

  it("replaces the full persisted state and saves it immediately", async () => {
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-old",
          name: "old",
          type: "cash",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const replacement = createPersistedState({
      accounts: [
        {
          id: "acct-new",
          name: "new checking",
          type: "checking",
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
      ],
      categories: [
        {
          id: "cat-1",
          name: "rent",
          kind: "expense",
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore, localStorage } = await loadStore(persisted);

    useAppStore.getState().generateRecurringForMonth("2026-04");

    useAppStore.getState().replacePersistedState(replacement);

    expect(useAppStore.getState().accounts).toEqual(replacement.accounts);
    expect(useAppStore.getState().categories).toEqual(replacement.categories);
    expect(useAppStore.getState().lastRecurringGenerationSummary).toBeNull();
    expect(JSON.parse(localStorage.getItem(storagekey) ?? "null")).toEqual(replacement);
  });

  it("deletes recurring rules without mutating already-generated concrete transactions", async () => {
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-1",
          name: "checking",
          type: "checking",
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
      transactions: [
        {
          id: "txn-generated-rent",
          kind: "standard",
          date: "2026-04-05",
          amountCents: -100000,
          accountId: "acct-1",
          categoryId: "cat-rent",
          source: "recurring",
          recurringRuleId: "rule-rent",
          createdAt: "2026-04-05T00:00:00.000Z",
          updatedAt: "2026-04-05T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-rent",
          kind: "standard",
          name: "rent",
          amountCents: -100000,
          accountId: "acct-1",
          categoryId: "cat-rent",
          frequency: "monthly",
          startDate: "2026-01-01",
          active: true,
          dayOfMonth: 5,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore, localStorage } = await loadStore(persisted);

    useAppStore.getState().deleteRecurringRule("rule-rent");

    expect(useAppStore.getState().recurringRules).toEqual([]);
    expect(useAppStore.getState().transactions).toEqual(persisted.transactions);

    const saved = JSON.parse(localStorage.getItem(storagekey) ?? "null") as PersistedState;

    expect(saved.recurringRules).toEqual([]);
    expect(saved.transactions).toEqual(persisted.transactions);
  });

  it("does not mutate store state when import parsing fails", async () => {
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-1",
          name: "checking",
          type: "checking",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore, localStorage } = await loadStore(persisted);

    const beforeState = useAppStore.getState().accounts;
    const result = parsePersistedStateJson("{bad json}");

    expect(result.success).toBe(false);
    expect(useAppStore.getState().accounts).toEqual(beforeState);
    expect(JSON.parse(localStorage.getItem(storagekey) ?? "null")).toEqual(persisted);
  });

  it("blocks duplicate budgets for the same month and category", async () => {
    const persisted = createPersistedState({
      categories: [
        {
          id: "cat-food",
          name: "food",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "cat-rent",
          name: "rent",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      budgets: [
        {
          id: "budget-1",
          month: "2026-04",
          categoryId: "cat-food",
          plannedCents: 1000,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore, localStorage } = await loadStore(persisted);

    useAppStore.getState().addBudget({
      id: "budget-2",
      month: "2026-04",
      categoryId: "cat-food",
      plannedCents: 2000,
      createdAt: "2026-04-21T12:34:56.000Z",
      updatedAt: "2026-04-21T12:34:56.000Z",
    });

    expect(useAppStore.getState().budgets).toHaveLength(1);

    useAppStore.getState().addBudget({
      id: "budget-3",
      month: "2026-04",
      categoryId: "cat-rent",
      plannedCents: 3000,
      createdAt: "2026-04-21T12:34:56.000Z",
      updatedAt: "2026-04-21T12:34:56.000Z",
    });

    expect(useAppStore.getState().budgets).toHaveLength(2);

    useAppStore.getState().updateBudget("budget-3", {
      categoryId: "cat-food",
    });

    expect(useAppStore.getState().budgets.find((item) => item.id === "budget-3"))
      .toMatchObject({ categoryId: "cat-rent" });

    const saved = JSON.parse(localStorage.getItem(storagekey) ?? "null") as PersistedState;

    expect(saved.budgets).toHaveLength(2);
  });

  it("deletes accounts by cascading transfer pairs, opening balances, and recurring rules", async () => {
    const persisted = createPersistedState({
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
      transactions: [
        {
          id: "txn-transfer-out",
          kind: "transfer",
          date: "2026-04-10",
          amountCents: -2500,
          accountId: "acct-checking",
          source: "manual",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
        {
          id: "txn-transfer-in",
          kind: "transfer",
          date: "2026-04-10",
          amountCents: 2500,
          accountId: "acct-savings",
          source: "manual",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
        {
          id: "txn-opening",
          kind: "opening-balance",
          date: "2026-04-01",
          amountCents: 10000,
          accountId: "acct-checking",
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-checking",
          kind: "standard",
          name: "rent",
          amountCents: -2500,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          frequency: "monthly",
          startDate: "2026-04-01",
          active: true,
          dayOfMonth: 10,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().deleteAccount("acct-checking");

    expect(useAppStore.getState().accounts.map((account) => account.id)).toEqual([
      "acct-savings",
    ]);
    expect(useAppStore.getState().transactions).toEqual([]);
    expect(useAppStore.getState().recurringRules).toEqual([]);
  });

  it("generates recurring transactions once per month and keeps them sorted", async () => {
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-1",
          name: "checking",
          type: "checking",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      categories: [
        {
          id: "cat-1",
          name: "rent",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-existing",
          kind: "standard",
          date: "2026-04-02",
          amountCents: -500,
          accountId: "acct-1",
          categoryId: "cat-1",
          source: "manual",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-1",
          kind: "standard",
          name: "rent",
          amountCents: -180000,
          accountId: "acct-1",
          categoryId: "cat-1",
          frequency: "monthly",
          startDate: "2026-01-01",
          active: true,
          dayOfMonth: 15,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore, localStorage } = await loadStore(persisted);

    const firstSummary = useAppStore.getState().generateRecurringForMonth("2026-04");

    expect(useAppStore.getState().transactions).toHaveLength(2);
    expect(firstSummary).toEqual(useAppStore.getState().lastRecurringGenerationSummary);
    expect(useAppStore.getState().lastRecurringGenerationSummary).toMatchObject({
      startMonth: "2026-04",
      endMonth: "2026-04",
      monthCount: 1,
      createdTransactions: 1,
      createdTransfers: 0,
      duplicateOccurrences: 0,
    });
    expect(useAppStore.getState().transactions[0]).toMatchObject({
      id: "generated-uuid-1",
      kind: "standard",
      date: "2026-04-15",
      amountCents: -180000,
      accountId: "acct-1",
      categoryId: "cat-1",
      source: "recurring",
      recurringRuleId: "rule-1",
      createdAt: "2026-04-21T12:34:56.000Z",
      updatedAt: "2026-04-21T12:34:56.000Z",
    });
    expect(useAppStore.getState().transactions.map((item) => item.id)).toEqual([
      "generated-uuid-1",
      "txn-existing",
    ]);

    const secondSummary = useAppStore.getState().generateRecurringForMonth("2026-04");

    expect(useAppStore.getState().transactions).toHaveLength(2);
    expect(secondSummary).toEqual(useAppStore.getState().lastRecurringGenerationSummary);
    expect(useAppStore.getState().lastRecurringGenerationSummary).toMatchObject({
      startMonth: "2026-04",
      endMonth: "2026-04",
      monthCount: 1,
      createdTransactions: 0,
      createdTransfers: 0,
      duplicateOccurrences: 1,
    });

    const saved = JSON.parse(localStorage.getItem(storagekey) ?? "null") as PersistedState;

    expect(saved.transactions).toHaveLength(2);
  });

  it("generates recurring transfers as exactly one linked pair per occurrence", async () => {
    const persisted = createPersistedState({
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
      recurringRules: [
        {
          id: "rule-transfer",
          kind: "transfer",
          name: "save",
          amountCents: 2500,
          accountId: "acct-checking",
          toAccountId: "acct-savings",
          frequency: "monthly",
          startDate: "2026-01-01",
          active: true,
          dayOfMonth: 15,
          note: "monthly transfer",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore, localStorage } = await loadStore(persisted);

    useAppStore.getState().generateRecurringForMonth("2026-04");

    const transactions = useAppStore.getState().transactions;

    expect(transactions).toHaveLength(2);
    expect(transactions[0]?.transferGroupId).toBe(transactions[1]?.transferGroupId);
    expect(transactions).toEqual([
      expect.objectContaining({
        kind: "transfer",
        source: "recurring",
        recurringRuleId: "rule-transfer",
        date: "2026-04-15",
        amountCents: -2500,
        accountId: "acct-checking",
        note: "monthly transfer",
      }),
      expect.objectContaining({
        kind: "transfer",
        source: "recurring",
        recurringRuleId: "rule-transfer",
        date: "2026-04-15",
        amountCents: 2500,
        accountId: "acct-savings",
        note: "monthly transfer",
      }),
    ]);

    useAppStore.getState().generateRecurringForMonth("2026-04");
    expect(useAppStore.getState().transactions).toHaveLength(2);

    const saved = JSON.parse(localStorage.getItem(storagekey) ?? "null") as PersistedState;
    expect(saved.transactions).toHaveLength(2);
  });

  it("generates recurring transactions across a selected month range", async () => {
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-1",
          name: "checking",
          type: "checking",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      categories: [
        {
          id: "cat-1",
          name: "rent",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-1",
          kind: "standard",
          name: "rent",
          amountCents: -180000,
          accountId: "acct-1",
          categoryId: "cat-1",
          frequency: "monthly",
          startDate: "2026-01-01",
          active: true,
          dayOfMonth: 15,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    const summary = useAppStore.getState().generateRecurringForRange("2026-04", 3);

    expect(useAppStore.getState().transactions.map((item) => item.date)).toEqual([
      "2026-06-15",
      "2026-05-15",
      "2026-04-15",
    ]);
    expect(summary).toEqual({
      startMonth: "2026-04",
      endMonth: "2026-06",
      monthCount: 3,
      createdOccurrences: 3,
      createdTransactions: 3,
      createdTransfers: 0,
      duplicateOccurrences: 0,
      ruleResults: [
        {
          recurringRuleId: "rule-1",
          ruleName: "rent",
          kind: "standard",
          createdOccurrences: 3,
          createdTransactions: 3,
          createdTransfers: 0,
          duplicateOccurrences: 0,
        },
      ],
    });
  });

  it("generates yearly standard recurring transactions only for the matching month", async () => {
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-1",
          name: "checking",
          type: "checking",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      categories: [
        {
          id: "cat-1",
          name: "dues",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-yearly",
          kind: "standard",
          name: "dues",
          amountCents: -12000,
          accountId: "acct-1",
          categoryId: "cat-1",
          frequency: "yearly",
          startDate: "2024-09-12",
          active: true,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().generateRecurringForMonth("2026-08");
    expect(useAppStore.getState().transactions).toHaveLength(0);

    useAppStore.getState().generateRecurringForMonth("2026-09");
    expect(useAppStore.getState().transactions).toEqual([
      expect.objectContaining({
        kind: "standard",
        date: "2026-09-12",
        amountCents: -12000,
        recurringRuleId: "rule-yearly",
        source: "recurring",
      }),
    ]);

    useAppStore.getState().generateRecurringForMonth("2026-09");
    expect(useAppStore.getState().transactions).toHaveLength(1);
  });

  it("generates yearly recurring transfer pairs only in matching leap-safe month/day cases", async () => {
    const persisted = createPersistedState({
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
      recurringRules: [
        {
          id: "rule-yearly-transfer",
          kind: "transfer",
          name: "leap save",
          amountCents: 5000,
          accountId: "acct-checking",
          toAccountId: "acct-savings",
          frequency: "yearly",
          startDate: "2024-02-29",
          active: true,
          note: "leap transfer",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().generateRecurringForMonth("2027-02");
    expect(useAppStore.getState().transactions).toHaveLength(0);

    useAppStore.getState().generateRecurringForMonth("2028-02");
    expect(useAppStore.getState().transactions).toHaveLength(2);
    expect(useAppStore.getState().transactions).toEqual([
      expect.objectContaining({
        kind: "transfer",
        date: "2028-02-29",
        amountCents: -5000,
        accountId: "acct-checking",
        recurringRuleId: "rule-yearly-transfer",
        source: "recurring",
      }),
      expect.objectContaining({
        kind: "transfer",
        date: "2028-02-29",
        amountCents: 5000,
        accountId: "acct-savings",
        recurringRuleId: "rule-yearly-transfer",
        source: "recurring",
      }),
    ]);

    useAppStore.getState().generateRecurringForMonth("2028-02");
    expect(useAppStore.getState().transactions).toHaveLength(2);
  });

  it("does not generate duplicate recurring transfer pairs when one side already exists", async () => {
    const { useAppStore } = await loadStore(
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
        recurringRules: [
          {
            id: "rule-transfer",
            kind: "transfer",
            name: "save",
            amountCents: 2500,
            accountId: "acct-checking",
            toAccountId: "acct-savings",
            frequency: "monthly",
            startDate: "2026-01-01",
            active: true,
            dayOfMonth: 15,
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );

    useAppStore.setState({
      transactions: [
        {
          id: "txn-transfer-out",
          kind: "transfer",
          date: "2026-04-15",
          amountCents: -2500,
          accountId: "acct-checking",
          source: "recurring",
          recurringRuleId: "rule-transfer",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-15T00:00:00.000Z",
          updatedAt: "2026-04-15T00:00:00.000Z",
        },
      ],
    });

    useAppStore.getState().generateRecurringForMonth("2026-04");

    expect(useAppStore.getState().transactions).toHaveLength(1);
    expect(useAppStore.getState().transactions[0]).toMatchObject({
      id: "txn-transfer-out",
      recurringRuleId: "rule-transfer",
      date: "2026-04-15",
    });
  });

  it("resets state back to seeded data", async () => {
    const persisted = createPersistedState({
      accounts: [
        {
          id: "acct-custom",
          name: "custom",
          type: "cash",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore, localStorage } = await loadStore(persisted);

    useAppStore.getState().generateRecurringForMonth("2026-04");

    useAppStore.getState().resetSeedData();

    const seeded = createSeedState();

    expect(useAppStore.getState().accounts).toEqual(seeded.accounts);
    expect(useAppStore.getState().categories).toEqual(seeded.categories);
    expect(useAppStore.getState().budgets).toEqual(seeded.budgets);
    expect(useAppStore.getState().recurringRules).toEqual(seeded.recurringRules);
    expect(useAppStore.getState().lastRecurringGenerationSummary).toBeNull();
    expect(useAppStore.getState().transactions).toEqual(
      [...seeded.transactions].sort((left, right) =>
        right.date.localeCompare(left.date)
      )
    );

    const saved = JSON.parse(localStorage.getItem(storagekey) ?? "null") as PersistedState;

    expect(saved.accounts).toEqual(seeded.accounts);
  });

  it("adds transfers as exactly two linked transactions", async () => {
    const { useAppStore, localStorage } = await loadStore(
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
      amountCents: 2500,
      note: "move to savings",
    });

    const transactions = useAppStore.getState().transactions;

    expect(transactions).toHaveLength(2);
    expect(transactions.map((transaction) => transaction.transferGroupId)).toEqual([
      transactions[0]?.transferGroupId,
      transactions[0]?.transferGroupId,
    ]);
    expect(transactions).toEqual([
      expect.objectContaining({
        kind: "transfer",
        date: "2026-04-21",
        amountCents: -2500,
        accountId: "acct-checking",
        note: "move to savings",
        source: "manual",
      }),
      expect.objectContaining({
        kind: "transfer",
        date: "2026-04-21",
        amountCents: 2500,
        accountId: "acct-savings",
        note: "move to savings",
        source: "manual",
      }),
    ]);

    const saved = JSON.parse(localStorage.getItem(storagekey) ?? "null") as PersistedState;
    expect(saved.transactions).toHaveLength(2);
  });

  it("updates both sides of a transfer together and preserves transfer ids", async () => {
    const persisted = createPersistedState({
      transactions: [
        {
          id: "txn-transfer-out",
          kind: "transfer",
          date: "2026-04-10",
          amountCents: -2500,
          accountId: "acct-checking",
          note: "old note",
          source: "manual",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
        {
          id: "txn-transfer-in",
          kind: "transfer",
          date: "2026-04-10",
          amountCents: 2500,
          accountId: "acct-savings",
          note: "old note",
          source: "manual",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().updateTransfer("transfer-1", {
      date: "2026-04-22",
      fromAccountId: "acct-savings",
      toAccountId: "acct-checking",
      amountCents: 4200,
      note: "updated",
    });

    expect(useAppStore.getState().transactions).toEqual([
      expect.objectContaining({
        id: "txn-transfer-out",
        kind: "transfer",
        date: "2026-04-22",
        amountCents: -4200,
        accountId: "acct-savings",
        note: "updated",
        transferGroupId: "transfer-1",
      }),
      expect.objectContaining({
        id: "txn-transfer-in",
        kind: "transfer",
        date: "2026-04-22",
        amountCents: 4200,
        accountId: "acct-checking",
        note: "updated",
        transferGroupId: "transfer-1",
      }),
    ]);
  });

  it("deletes both sides of a transfer through dedicated and generic delete flows", async () => {
    const persisted = createPersistedState({
      transactions: [
        {
          id: "txn-transfer-out",
          kind: "transfer",
          date: "2026-04-10",
          amountCents: -2500,
          accountId: "acct-checking",
          source: "manual",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
        {
          id: "txn-transfer-in",
          kind: "transfer",
          date: "2026-04-10",
          amountCents: 2500,
          accountId: "acct-savings",
          source: "manual",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
    });

    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().deleteTransaction("txn-transfer-out");
    expect(useAppStore.getState().transactions).toEqual([]);

    useAppStore.setState({
      transactions: [...persisted.transactions],
    });

    useAppStore.getState().deleteTransfer("transfer-1");
    expect(useAppStore.getState().transactions).toEqual([]);
  });

  it("routes generic transfer updates through pair-safe logic", async () => {
    const persisted = createPersistedState({
      transactions: [
        {
          id: "txn-transfer-out",
          kind: "transfer",
          date: "2026-04-10",
          amountCents: -2500,
          accountId: "acct-checking",
          note: "old note",
          source: "manual",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
        {
          id: "txn-transfer-in",
          kind: "transfer",
          date: "2026-04-10",
          amountCents: 2500,
          accountId: "acct-savings",
          note: "old note",
          source: "manual",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().updateTransaction("txn-transfer-out", {
      date: "2026-04-12",
      amountCents: -3300,
      accountId: "acct-cash",
      note: "pair-safe",
    });

    expect(useAppStore.getState().transactions).toEqual([
      expect.objectContaining({
        id: "txn-transfer-out",
        date: "2026-04-12",
        amountCents: -3300,
        accountId: "acct-cash",
        note: "pair-safe",
      }),
      expect.objectContaining({
        id: "txn-transfer-in",
        date: "2026-04-12",
        amountCents: 3300,
        accountId: "acct-savings",
        note: "pair-safe",
      }),
    ]);
  });

  it("adds, updates, and deletes split transactions as single records", async () => {
    const { useAppStore } = await loadStore(
      createPersistedState({
        categories: [
          {
            id: "cat-food",
            name: "food",
            kind: "expense",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "cat-home",
            name: "home",
            kind: "expense",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "cat-salary",
            name: "salary",
            kind: "income",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
      })
    );

    useAppStore.getState().addTransaction({
      id: "txn-split",
      kind: "standard",
      date: "2026-04-12",
      amountCents: -3000,
      accountId: "acct-checking",
      merchant: "Warehouse",
      splits: [
        {
          id: "split-1",
          categoryId: "cat-food",
          amountCents: -1200,
          note: "produce",
        },
        {
          id: "split-2",
          categoryId: "cat-home",
          amountCents: -1800,
          note: "supplies",
        },
      ],
      source: "manual",
      createdAt: "2026-04-12T00:00:00.000Z",
      updatedAt: "2026-04-12T00:00:00.000Z",
    });

    expect(useAppStore.getState().transactions).toHaveLength(1);
    expect(useAppStore.getState().transactions[0]).toMatchObject({
      id: "txn-split",
      splits: [
        expect.objectContaining({ categoryId: "cat-food", amountCents: -1200 }),
        expect.objectContaining({ categoryId: "cat-home", amountCents: -1800 }),
      ],
    });
    expect(useAppStore.getState().transactions[0]).not.toHaveProperty("categoryId");

    useAppStore.getState().updateTransaction("txn-split", {
      amountCents: -3500,
      splits: [
        {
          id: "split-1",
          categoryId: "cat-food",
          amountCents: -2000,
          note: "produce",
        },
        {
          id: "split-2",
          categoryId: "cat-home",
          amountCents: -1500,
          note: "supplies",
        },
      ],
    });

    expect(useAppStore.getState().transactions[0]).toMatchObject({
      amountCents: -3500,
      updatedAt: "2026-04-21T12:34:56.000Z",
      splits: [
        expect.objectContaining({ amountCents: -2000 }),
        expect.objectContaining({ amountCents: -1500 }),
      ],
    });

    useAppStore.getState().updateTransaction("txn-split", {
      categoryId: "cat-food",
      splits: undefined,
      amountCents: -3500,
    });

    expect(useAppStore.getState().transactions[0]).toMatchObject({
      amountCents: -3500,
      categoryId: "cat-food",
    });
    expect(useAppStore.getState().transactions[0]).not.toHaveProperty("splits");

    useAppStore.getState().deleteTransaction("txn-split");

    expect(useAppStore.getState().transactions).toEqual([]);
  });

  it("rejects invalid split category-kind combinations before committing state", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const persisted = createPersistedState({
      categories: [
        {
          id: "cat-food",
          name: "food",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "cat-home",
          name: "home",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-split",
          kind: "standard",
          date: "2026-04-12",
          amountCents: -3000,
          accountId: "acct-checking",
          splits: [
            {
              id: "split-1",
              categoryId: "cat-food",
              amountCents: -1200,
            },
            {
              id: "split-2",
              categoryId: "cat-home",
              amountCents: -1800,
            },
          ],
          source: "manual",
          createdAt: "2026-04-12T00:00:00.000Z",
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().updateCategory("cat-food", {
      kind: "income",
    });

    expect(useAppStore.getState().categories.find((category) => category.id === "cat-food"))
      .toMatchObject({ kind: "expense" });
    expect(warnSpy).toHaveBeenCalledWith(
      "rejecting invalid store update",
      expect.objectContaining({ action: "updateCategory" })
    );
  });

  it("rejects invalid transaction updates and keeps the previous transaction intact", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const persisted = createPersistedState({
      categories: [
        {
          id: "cat-food",
          name: "food",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "cat-home",
          name: "home",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-standard",
          kind: "standard",
          date: "2026-04-12",
          amountCents: -3000,
          accountId: "acct-checking",
          categoryId: "cat-food",
          source: "manual",
          createdAt: "2026-04-12T00:00:00.000Z",
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().updateTransaction("txn-standard", {
      amountCents: -3000,
      splits: [
        {
          id: "split-1",
          categoryId: "cat-food",
          amountCents: -1500,
        },
      ],
    });

    expect(useAppStore.getState().transactions[0]).toMatchObject({
      id: "txn-standard",
      categoryId: "cat-food",
      amountCents: -3000,
    });
    expect(useAppStore.getState().transactions[0]).not.toHaveProperty("splits");
    expect(warnSpy).toHaveBeenCalledWith(
      "rejecting invalid store update",
      expect.objectContaining({ action: "updateTransaction" })
    );
  });

  it("rejects category deletion that would leave split references behind", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const persisted = createPersistedState({
      categories: [
        {
          id: "cat-food",
          name: "food",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "cat-home",
          name: "home",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-split",
          kind: "standard",
          date: "2026-04-12",
          amountCents: -3000,
          accountId: "acct-checking",
          splits: [
            {
              id: "split-1",
              categoryId: "cat-food",
              amountCents: -1200,
            },
            {
              id: "split-2",
              categoryId: "cat-home",
              amountCents: -1800,
            },
          ],
          source: "manual",
          createdAt: "2026-04-12T00:00:00.000Z",
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().deleteCategory("cat-food");

    expect(useAppStore.getState().categories.map((category) => category.id)).toEqual([
      "cat-food",
      "cat-home",
    ]);
    expect(useAppStore.getState().transactions[0]).toMatchObject({
      id: "txn-split",
      splits: [
        expect.objectContaining({ categoryId: "cat-food" }),
        expect.objectContaining({ categoryId: "cat-home" }),
      ],
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "rejecting invalid store update",
      expect.objectContaining({ action: "deleteCategory" })
    );
  });

  it("archives and restores categories without removing referenced history", async () => {
    const persisted = createPersistedState({
      categories: [
        {
          id: "cat-food",
          name: "food",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-standard",
          kind: "standard",
          date: "2026-04-12",
          amountCents: -3000,
          accountId: "acct-checking",
          categoryId: "cat-food",
          source: "manual",
          createdAt: "2026-04-12T00:00:00.000Z",
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
      ],
    });
    const { useAppStore } = await loadStore(persisted);

    useAppStore.getState().archiveCategory("cat-food");

    expect(useAppStore.getState().categories[0]).toMatchObject({
      id: "cat-food",
      archivedAt: "2026-04-21T12:34:56.000Z",
    });
    expect(useAppStore.getState().transactions[0]).toMatchObject({
      categoryId: "cat-food",
    });

    useAppStore.getState().unarchiveCategory("cat-food");

    expect(useAppStore.getState().categories[0]).not.toHaveProperty("archivedAt");
  });
});
