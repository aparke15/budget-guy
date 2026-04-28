// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "./dashboard-page";
import type { PersistedState } from "../../types";

type MockStoreState = PersistedState & {
  lastRecurringGenerationSummary: null;
};

let storeState: MockStoreState;
const { generateRecurringForRangeMock } = vi.hoisted(() => ({
  generateRecurringForRangeMock: vi.fn(),
}));

vi.mock("../../app/store", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) => selector(storeState),
}));

vi.mock("../../app/recurring-store-actions", () => ({
  generateRecurringForRange: generateRecurringForRangeMock,
}));

function createStoreState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    version: 3,
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
        creditLimitCents: 200000,
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
      {
        id: "cat-income",
        name: "salary",
        kind: "income",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    transactions: [
      {
        id: "txn-rent-posted",
        kind: "standard",
        date: "2026-04-01",
        amountCents: -120000,
        accountId: "acct-checking",
        categoryId: "cat-rent",
        merchant: "Landlord",
        source: "recurring",
        recurringRuleId: "rule-rent",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    budgets: [],
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
        startDate: "2026-01-01",
        active: true,
        dayOfMonth: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "rule-bill",
        kind: "standard",
        name: "utility bill",
        amountCents: -15000,
        accountId: "acct-checking",
        categoryId: "cat-archived-insurance",
        merchant: "Power Co",
        frequency: "monthly",
        startDate: "2026-04-20",
        active: true,
        dayOfMonth: 20,
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:00.000Z",
      },
      {
        id: "rule-salary",
        kind: "standard",
        name: "salary",
        amountCents: 200000,
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
        id: "rule-payment",
        kind: "transfer",
        name: "card payment",
        amountCents: 45000,
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
    lastRecurringGenerationSummary: null,
    ...overrides,
  };
}

function getSummaryCard(label: string) {
  const labelNode = Array.from(document.querySelectorAll<HTMLElement>(".summary-card__label")).find(
    (candidate) => candidate.textContent === label
  );

  if (!labelNode) {
    throw new Error(`summary label not found for ${label}`);
  }

  const card = labelNode.closest<HTMLElement>(".summary-card");

  if (!card) {
    throw new Error(`summary card not found for ${label}`);
  }

  return card;
}

describe("dashboard expected occurrences", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
    storeState = createStoreState();
    generateRecurringForRangeMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders operational recurring counts and a due-soon list without changing posted summary cards", () => {
    render(<DashboardPage />);

    expect(within(getSummaryCard("income")).getByText("$0.00")).toBeTruthy();
    expect(within(getSummaryCard("expenses")).getByText("$1,200.00")).toBeTruthy();

    expect(within(getSummaryCard("due today")).getByText("1")).toBeTruthy();
    expect(within(getSummaryCard("overdue")).getByText("1")).toBeTruthy();
    expect(within(getSummaryCard("next 7 days")).getByText("1")).toBeTruthy();

    const dueSoonList = screen.getByLabelText("due soon recurring list");

    expect(within(dueSoonList).getByText(/2026-04-20/i)).toBeTruthy();
    expect(within(dueSoonList).getByText(/insurance \(archived\)/i)).toBeTruthy();
    expect(within(dueSoonList).getByText(/2026-04-21/i)).toBeTruthy();
    expect(within(dueSoonList).getByText(/2026-04-25/i)).toBeTruthy();
    expect(within(dueSoonList).getByText(/checking → visa/i)).toBeTruthy();
    expect(within(dueSoonList).queryByText(/2026-01-01/i)).toBeNull();
  });
});