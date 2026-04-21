import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSeedState } from "../seed/seed-data";
import type { PersistedState } from "../types";

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

function createPersistedState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    version: 1,
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

  if (initialState) {
    localStorage.setItem(storagekey, JSON.stringify(initialState));
  }

  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => "generated-uuid"),
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

    useAppStore.getState().generateRecurringForMonth("2026-04");

    expect(useAppStore.getState().transactions).toHaveLength(2);
    expect(useAppStore.getState().transactions[0]).toMatchObject({
      id: "generated-uuid",
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
      "generated-uuid",
      "txn-existing",
    ]);

    useAppStore.getState().generateRecurringForMonth("2026-04");

    expect(useAppStore.getState().transactions).toHaveLength(2);

    const saved = JSON.parse(localStorage.getItem(storagekey) ?? "null") as PersistedState;

    expect(saved.transactions).toHaveLength(2);
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

    useAppStore.getState().resetSeedData();

    const seeded = createSeedState();

    expect(useAppStore.getState().accounts).toEqual(seeded.accounts);
    expect(useAppStore.getState().categories).toEqual(seeded.categories);
    expect(useAppStore.getState().budgets).toEqual(seeded.budgets);
    expect(useAppStore.getState().recurringRules).toEqual(seeded.recurringRules);
    expect(useAppStore.getState().transactions).toEqual(
      [...seeded.transactions].sort((left, right) =>
        right.date.localeCompare(left.date)
      )
    );

    const saved = JSON.parse(localStorage.getItem(storagekey) ?? "null") as PersistedState;

    expect(saved.accounts).toEqual(seeded.accounts);
  });
});
