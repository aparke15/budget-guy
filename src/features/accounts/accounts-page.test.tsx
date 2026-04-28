// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadOrCreatePersistedState } from "../../app/storage";
import type { PersistedState } from "../../types";

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
    version: 3,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurringRules: [],
    ...overrides,
  };
}

async function loadAccountsPage(initialState?: PersistedState) {
  const localStorage = new MemoryStorage();
  let uuidCounter = 0;

  if (initialState) {
    localStorage.setItem(storageKey, JSON.stringify(initialState));
  }

  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => `generated-uuid-${++uuidCounter}`),
  });
  vi.stubGlobal("scrollTo", vi.fn());
  vi.resetModules();

  const [{ AccountsPage }, storeModule] = await Promise.all([
    import("./accounts-page"),
    import("../../app/store"),
  ]);
  storeModule.initializeAppStore(loadOrCreatePersistedState());

  return {
    AccountsPage,
    useAppStore: storeModule.useAppStore,
    localStorage,
  };
}

function getFormBySubmitLabel(label: string) {
  const button = screen.getByRole("button", { name: label });
  const form = button.closest("form");

  if (!form) {
    throw new Error(`form not found for ${label}`);
  }

  return form;
}

function getEntityCardByText(text: string) {
  const card = Array.from(document.querySelectorAll<HTMLElement>(".entity-card")).find(
    (candidate) => candidate.textContent?.includes(text)
  );

  if (!card) {
    throw new Error(`entity card not found for ${text}`);
  }

  return card;
}

function hasEntityCard(text: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(".entity-card")).some(
    (candidate) => candidate.textContent?.includes(text)
  );
}

function getBalanceTableRow(accountName: string) {
  const row = Array.from(
    document.querySelectorAll<HTMLTableRowElement>(
      ".responsive-table-desktop tbody tr"
    )
  ).find((candidate) => candidate.textContent?.includes(accountName));

  if (!row) {
    throw new Error(`balance row not found for ${accountName}`);
  }

  return row;
}

describe("accounts page opening-balance and delete flows", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("creates, updates, and removes opening balances through the account manager", async () => {
    const { AccountsPage, useAppStore } = await loadAccountsPage(createPersistedState());

    render(<AccountsPage />);

    const createForm = getFormBySubmitLabel("add account");

    fireEvent.change(within(createForm).getByLabelText("name"), {
      target: { value: "checking" },
    });
    fireEvent.change(within(createForm).getByLabelText("opening balance"), {
      target: { value: "50.00" },
    });
    fireEvent.change(within(createForm).getByLabelText("opening balance date"), {
      target: { value: "2026-04-01" },
    });
    fireEvent.click(within(createForm).getByRole("button", { name: "add account" }));

    expect(screen.getByText("opening balance $50.00 on 2026-04-01")).toBeTruthy();
    expect(
      useAppStore
        .getState()
        .transactions.filter((transaction) => transaction.kind === "opening-balance")
    ).toHaveLength(1);

    const checkingCard = getEntityCardByText("checking");

    fireEvent.click(within(checkingCard).getByRole("button", { name: "edit" }));

    const editForm = getFormBySubmitLabel("save account");

    fireEvent.change(within(editForm).getByLabelText("opening balance"), {
      target: { value: "75.00" },
    });
    fireEvent.change(within(editForm).getByLabelText("opening balance date"), {
      target: { value: "2026-04-02" },
    });
    fireEvent.click(within(editForm).getByRole("button", { name: "save account" }));

    expect(screen.getByText("opening balance $75.00 on 2026-04-02")).toBeTruthy();
    expect(
      useAppStore
        .getState()
        .transactions.filter((transaction) => transaction.kind === "opening-balance")
    ).toHaveLength(1);
    expect(
      useAppStore
        .getState()
        .transactions.filter((transaction) => transaction.kind === "opening-balance")[0]
    ).toEqual(
      expect.objectContaining({
        amountCents: 7500,
        date: "2026-04-02",
        source: "manual",
      })
    );

    fireEvent.click(within(getEntityCardByText("checking")).getByRole("button", { name: "edit" }));

    const clearForm = getFormBySubmitLabel("save account");

    fireEvent.change(within(clearForm).getByLabelText("opening balance"), {
      target: { value: "" },
    });
    fireEvent.click(within(clearForm).getByRole("button", { name: "save account" }));

    expect(screen.queryByText(/opening balance \$/)).toBeNull();
    expect(
      useAppStore
        .getState()
        .transactions.filter((transaction) => transaction.kind === "opening-balance")
    ).toHaveLength(0);
  });

  it("stores credit opening balances as owed amounts and reduces available credit", async () => {
    const { AccountsPage, useAppStore } = await loadAccountsPage(createPersistedState());

    render(<AccountsPage />);

    const createForm = getFormBySubmitLabel("add account");

    fireEvent.change(within(createForm).getByLabelText("name"), {
      target: { value: "visa" },
    });
    fireEvent.change(within(createForm).getByLabelText("type"), {
      target: { value: "credit" },
    });
    fireEvent.change(within(createForm).getByLabelText("credit limit"), {
      target: { value: "1000.00" },
    });
    fireEvent.change(within(createForm).getByLabelText("opening balance"), {
      target: { value: "200.00" },
    });
    fireEvent.change(within(createForm).getByLabelText("opening balance date"), {
      target: { value: "2026-04-01" },
    });
    fireEvent.click(within(createForm).getByRole("button", { name: "add account" }));

    expect(
      useAppStore
        .getState()
        .transactions.filter((transaction) => transaction.kind === "opening-balance")
    ).toEqual([
      expect.objectContaining({
        accountId: "acct-generated-uuid-1",
        amountCents: -20000,
        date: "2026-04-01",
      }),
    ]);

    const balanceRow = getBalanceTableRow("visa");

    expect(balanceRow.textContent).toContain("$200.00");
    expect(balanceRow.textContent).toContain("$1,000.00");
    expect(balanceRow.textContent).toContain("$800.00$800.00");
    expect(balanceRow.querySelector(".text-negative")).toBeTruthy();
  });

  it("shows posted and expected 30-day balances plus expected credit and pending recurring items", async () => {
    const { AccountsPage } = await loadAccountsPage(
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
            creditLimitCents: 120000,
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        ],
        categories: [
          {
            id: "cat-income",
            name: "salary",
            kind: "income",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            id: "cat-archived-insurance",
            name: "insurance",
            kind: "expense",
            archivedAt: "2026-04-10T00:00:00.000Z",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-10T00:00:00.000Z",
          },
        ],
        transactions: [
          {
            id: "txn-paycheck",
            kind: "standard",
            date: "2026-04-15",
            amountCents: 100000,
            accountId: "acct-checking",
            categoryId: "cat-income",
            source: "manual",
            createdAt: "2026-04-15T00:00:00.000Z",
            updatedAt: "2026-04-15T00:00:00.000Z",
          },
          {
            id: "txn-card-balance",
            kind: "standard",
            date: "2026-04-12",
            amountCents: -20000,
            accountId: "acct-credit",
            categoryId: "cat-archived-insurance",
            source: "manual",
            createdAt: "2026-04-12T00:00:00.000Z",
            updatedAt: "2026-04-12T00:00:00.000Z",
          },
        ],
        recurringRules: [
          {
            id: "rule-salary",
            kind: "standard",
            name: "salary",
            amountCents: 50000,
            accountId: "acct-checking",
            categoryId: "cat-income",
            merchant: "Employer",
            frequency: "monthly",
            startDate: "2026-04-21",
            active: true,
            dayOfMonth: 21,
            createdAt: "2026-04-21T00:00:00.000Z",
            updatedAt: "2026-04-21T00:00:00.000Z",
          },
          {
            id: "rule-insurance",
            kind: "standard",
            name: "insurance",
            amountCents: -12000,
            accountId: "acct-checking",
            categoryId: "cat-archived-insurance",
            merchant: "Carrier",
            frequency: "monthly",
            startDate: "2026-04-20",
            active: true,
            dayOfMonth: 20,
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-20T00:00:00.000Z",
          },
          {
            id: "rule-payment",
            kind: "transfer",
            name: "card payment",
            amountCents: 20000,
            accountId: "acct-checking",
            toAccountId: "acct-credit",
            frequency: "monthly",
            startDate: "2026-04-25",
            active: true,
            dayOfMonth: 25,
            createdAt: "2026-04-25T00:00:00.000Z",
            updatedAt: "2026-04-25T00:00:00.000Z",
          },
        ],
      })
    );

    render(<AccountsPage />);

    expect(screen.getByText("expected 30d")).toBeTruthy();
    expect(screen.getByText("expected credit")).toBeTruthy();

    const checkingRow = getBalanceTableRow("checking");
    const creditRow = getBalanceTableRow("visa");

    expect(checkingRow.textContent).toContain("$1,000.00");
    expect(checkingRow.textContent).toContain("$1,680.00");
    expect(creditRow.textContent).toContain("$200.00");
    expect(creditRow.textContent).toContain("$1,000.00");
    expect(creditRow.textContent).toContain("$1,200.00");

    const pendingList = screen.getByLabelText("pending recurring account list");

    expect(within(pendingList).getAllByText(/insurance \(archived\)/i)).toHaveLength(2);
    expect(within(pendingList).getByText(/2026-04-25/i)).toBeTruthy();
  });

  it("deletes an account from the page by cascading related transactions, transfer pairs, opening balances, and recurring rules", async () => {
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
          id: "txn-opening",
          kind: "opening-balance",
          date: "2026-04-01",
          amountCents: 10000,
          accountId: "acct-checking",
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "txn-standard",
          kind: "standard",
          date: "2026-04-05",
          amountCents: -2500,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          source: "manual",
          createdAt: "2026-04-05T00:00:00.000Z",
          updatedAt: "2026-04-05T00:00:00.000Z",
        },
        {
          id: "txn-transfer-out",
          kind: "transfer",
          date: "2026-04-10",
          amountCents: -5000,
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
          amountCents: 5000,
          accountId: "acct-savings",
          source: "manual",
          transferGroupId: "transfer-1",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-rent",
          kind: "standard",
          name: "rent",
          amountCents: -2500,
          accountId: "acct-checking",
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
    const { AccountsPage, useAppStore } = await loadAccountsPage(persisted);

    render(<AccountsPage />);

    fireEvent.click(
      within(getEntityCardByText("checking")).getByRole("button", { name: "delete" })
    );

    expect(
      screen.getByText(
        "this will remove 3 transactions and 1 recurring rule."
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "confirm delete" }));

    expect(hasEntityCard("checking")).toBe(false);
    expect(useAppStore.getState().accounts.map((account) => account.id)).toEqual([
      "acct-savings",
    ]);
    expect(useAppStore.getState().transactions).toEqual([]);
    expect(useAppStore.getState().recurringRules).toEqual([]);
  });
});