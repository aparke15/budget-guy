// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { TransactionsPage } from "./transactions-page";
import type { PersistedState } from "../../types";

type MockStoreState = {
  transactions: PersistedState["transactions"];
  categories: PersistedState["categories"];
  accounts: PersistedState["accounts"];
  recurringRules: PersistedState["recurringRules"];
  addTransaction: ReturnType<typeof vi.fn>;
  updateTransaction: ReturnType<typeof vi.fn>;
  deleteTransaction: ReturnType<typeof vi.fn>;
  addTransfer: ReturnType<typeof vi.fn>;
  updateTransfer: ReturnType<typeof vi.fn>;
  deleteTransfer: ReturnType<typeof vi.fn>;
};

let storeState: MockStoreState;
const { recurringManagementSectionMock } = vi.hoisted(() => ({
  recurringManagementSectionMock: vi.fn(),
}));

vi.mock("../../app/store", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) => selector(storeState),
}));

vi.mock("../recurring/recurring-management-section", () => ({
  RecurringManagementSection: recurringManagementSectionMock,
}));

function createStoreState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    transactions: [],
    categories: [],
    accounts: [],
    recurringRules: [],
    addTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    addTransfer: vi.fn(),
    updateTransfer: vi.fn(),
    deleteTransfer: vi.fn(),
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();

  return <output data-testid="location-search">{location.search}</output>;
}

function renderPage(initialEntry = "/transactions") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/transactions"
          element={
            <>
              <TransactionsPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("transactions page recurring navigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
    vi.stubGlobal("scrollTo", vi.fn());
    recurringManagementSectionMock.mockClear();
    recurringManagementSectionMock.mockImplementation(
      ({ focusedRuleId }: { focusedRuleId?: string | null }) => (
        <div>
          recurring management section
          {focusedRuleId ? ` focused rule ${focusedRuleId}` : ""}
        </div>
      )
    );
    storeState = createStoreState({
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
          id: "cat-rent",
          name: "rent",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-rent",
          kind: "standard",
          date: "2026-04-05",
          amountCents: -120000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          merchant: "Landlord",
          source: "recurring",
          recurringRuleId: "rule-rent",
          createdAt: "2026-04-05T00:00:00.000Z",
          updatedAt: "2026-04-05T00:00:00.000Z",
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("switches to the recurring subview and updates the query string", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "recurring" }));

    expect(screen.getByText("recurring management section")).toBeTruthy();
    expect(screen.getByTestId("location-search").textContent).toBe("?tab=recurring");
  });

  it("shows an edit-rule action for generated recurring rows and targets the matching rule", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "edit rule" }));

    expect(screen.getByText("recurring management section focused rule rule-rent")).toBeTruthy();
    expect(screen.getByTestId("location-search").textContent).toBe(
      "?tab=recurring&rule=rule-rent"
    );
  });

  it("shows opening-balance rows as account-managed only", () => {
    storeState = createStoreState({
      accounts: [
        {
          id: "acct-checking",
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
          amountCents: 50000,
          accountId: "acct-checking",
          note: "seed cash",
          source: "manual",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    renderPage();

    const actionCell = screen.getByText("edit in accounts").closest("td");

    expect(actionCell).toBeTruthy();
    expect(actionCell?.querySelector("button")).toBeNull();
  });

  it("shows pending expected rows, suppresses matched expected rows, and preserves archived category labels", () => {
    storeState = createStoreState({
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
          id: "cat-rent",
          name: "rent",
          kind: "expense",
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
      recurringRules: [
        {
          id: "rule-rent",
          kind: "standard",
          name: "rent",
          amountCents: -120000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          merchant: "Landlord",
          frequency: "monthly",
          startDate: "2026-01-05",
          active: true,
          dayOfMonth: 5,
          createdAt: "2026-01-05T00:00:00.000Z",
          updatedAt: "2026-01-05T00:00:00.000Z",
        },
        {
          id: "rule-insurance",
          kind: "standard",
          name: "insurance",
          amountCents: -15000,
          accountId: "acct-checking",
          categoryId: "cat-archived-insurance",
          merchant: "Carrier",
          frequency: "monthly",
          startDate: "2026-04-25",
          active: true,
          dayOfMonth: 25,
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-rent",
          kind: "standard",
          date: "2026-04-05",
          amountCents: -120000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          merchant: "Landlord",
          source: "recurring",
          recurringRuleId: "rule-rent",
          createdAt: "2026-04-05T00:00:00.000Z",
          updatedAt: "2026-04-05T00:00:00.000Z",
        },
      ],
    });

    renderPage();

    const ledgerSection = screen.getByText("ledger").closest(".section-card");

    expect(ledgerSection?.textContent).toContain("2 ledger rows in 2026-04");
    expect(ledgerSection?.textContent).toContain("Carrier");
    expect(ledgerSection?.textContent).toContain("insurance (archived)");
    expect(ledgerSection?.textContent).toContain("pending recurring");
    expect(screen.getAllByRole("button", { name: "edit rule" }).length).toBeGreaterThan(0);
  });
});