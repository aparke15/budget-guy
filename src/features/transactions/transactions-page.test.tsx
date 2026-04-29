// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { TransactionsPage } from "./transactions-page";
import type { PersistedState } from "../../types";

type MockStoreState = {
  transactions: PersistedState["transactions"];
  categories: PersistedState["categories"];
  accounts: PersistedState["accounts"];
  recurringRules: PersistedState["recurringRules"];
  postExpectedOccurrence: ReturnType<typeof vi.fn>;
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
    postExpectedOccurrence: vi.fn(),
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

function getSectionByHeading(text: string) {
  const heading = screen.getByRole("heading", { name: text });
  const section = heading.closest<HTMLElement>(".section-card");

  if (!section) {
    throw new Error(`section not found for ${text}`);
  }

  return section;
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
      recurringRules: [
        {
          id: "rule-rent",
          kind: "standard",
          name: "rent",
          amountCents: -120000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          frequency: "monthly",
          startDate: "2026-01-05",
          active: true,
          dayOfMonth: 5,
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

  it("switches to the inbox subview and lists pending expected items only", () => {
    storeState = createStoreState({
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
          id: "rule-overdue",
          kind: "standard",
          name: "rent",
          amountCents: -120000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          frequency: "monthly",
          startDate: "2026-04-20",
          endDate: "2026-04-20",
          active: true,
          dayOfMonth: 20,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "rule-transfer",
          kind: "transfer",
          name: "save",
          amountCents: 5000,
          accountId: "acct-checking",
          toAccountId: "acct-savings",
          frequency: "monthly",
          startDate: "2026-04-24",
          endDate: "2026-04-24",
          active: true,
          dayOfMonth: 24,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "rule-matched",
          kind: "standard",
          name: "already posted",
          amountCents: -5000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          frequency: "monthly",
          startDate: "2026-04-10",
          endDate: "2026-04-10",
          active: true,
          dayOfMonth: 10,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-matched",
          kind: "standard",
          date: "2026-04-10",
          amountCents: -5000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          source: "recurring",
          recurringRuleId: "rule-matched",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
    });

    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "inbox" }));

    const inboxSection = getSectionByHeading("expected inbox");
    const inboxTable = within(inboxSection).getByRole("table");

    expect(within(inboxTable).getByRole("button", { name: "post rent for 2026-04-20" })).toBeTruthy();
    expect(within(inboxTable).getByRole("button", { name: "post save for 2026-04-24" })).toBeTruthy();
    expect(within(inboxTable).getByText("overdue")).toBeTruthy();
    expect(within(inboxTable).getByText("upcoming")).toBeTruthy();
    expect(within(inboxTable).getByText("checking → savings")).toBeTruthy();
    expect(within(inboxTable).queryByText("already posted")).toBeNull();
    expect(within(inboxTable).getAllByRole("button", { name: /post .* for 2026-04-/ })).toHaveLength(2);
  });

  it("shows an edit-rule action for generated recurring rows and targets the matching rule", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "edit rule" }));

    expect(screen.getByText("recurring management section focused rule rule-rent")).toBeTruthy();
    expect(screen.getByTestId("location-search").textContent).toBe(
      "?tab=recurring&rule=rule-rent"
    );
  });

  it("posts inbox items through the expected-occurrence store action and keeps edit-rule navigation", () => {
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
      recurringRules: [
        {
          id: "rule-rent",
          kind: "standard",
          name: "rent",
          amountCents: -120000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          frequency: "monthly",
          startDate: "2026-04-21",
          endDate: "2026-04-21",
          active: true,
          dayOfMonth: 21,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    renderPage("/transactions?tab=inbox");

    fireEvent.click(screen.getByRole("button", { name: "post rent for 2026-04-21" }));

    expect(storeState.postExpectedOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({
        recurringRuleId: "rule-rent",
        date: "2026-04-21",
        status: "due",
      })
    );

    fireEvent.click(screen.getAllByRole("button", { name: "edit rule" })[0]!);

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

  it("renders pending expected rows inline but hides matched expected rows", () => {
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
          name: "old rent",
          kind: "expense",
          archivedAt: "2026-04-10T00:00:00.000Z",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-upcoming",
          kind: "standard",
          name: "rent due soon",
          amountCents: -120000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          frequency: "monthly",
          startDate: "2026-01-22",
          active: true,
          dayOfMonth: 22,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "rule-matched",
          kind: "standard",
          name: "already posted",
          amountCents: -5000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          frequency: "monthly",
          startDate: "2026-01-10",
          active: true,
          dayOfMonth: 10,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-matched",
          kind: "standard",
          date: "2026-04-10",
          amountCents: -5000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          merchant: "landlord",
          source: "recurring",
          recurringRuleId: "rule-matched",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
    });

    renderPage();

    const ledgerSection = getSectionByHeading("ledger");
    const ledgerTable = within(ledgerSection).getByRole("table");

    expect(within(ledgerTable).getByText("rent due soon")).toBeTruthy();
    expect(within(ledgerTable).getByText("old rent (archived)")).toBeTruthy();
    expect(within(ledgerTable).getByText("expected")).toBeTruthy();
    expect(within(ledgerTable).getByText("upcoming")).toBeTruthy();
    expect(within(ledgerTable).queryByText("already posted")).toBeNull();
    expect(within(ledgerTable).getAllByRole("button", { name: "edit rule" }).length).toBe(2);
  });

  it("applies category and search filters to expected rows", () => {
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
          id: "cat-food",
          name: "food",
          kind: "expense",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      recurringRules: [
        {
          id: "rule-rent",
          kind: "standard",
          name: "rent due soon",
          amountCents: -120000,
          accountId: "acct-checking",
          categoryId: "cat-rent",
          frequency: "monthly",
          startDate: "2026-01-22",
          active: true,
          dayOfMonth: 22,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "rule-food",
          kind: "standard",
          name: "groceries planned",
          amountCents: -3000,
          accountId: "acct-checking",
          categoryId: "cat-food",
          merchant: "corner store",
          frequency: "monthly",
          startDate: "2026-01-23",
          active: true,
          dayOfMonth: 23,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    renderPage();

    const ledgerSection = getSectionByHeading("ledger");
    const ledgerTable = within(ledgerSection).getByRole("table");

    fireEvent.change(screen.getByLabelText("category"), {
      target: { value: "cat-food" },
    });

    expect(within(ledgerTable).getByText("corner store")).toBeTruthy();
    expect(within(ledgerTable).queryByText("rent due soon")).toBeNull();

    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: "corner" },
    });

    expect(within(ledgerTable).getByText("corner store")).toBeTruthy();
  });
});