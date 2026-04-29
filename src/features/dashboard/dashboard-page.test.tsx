// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "./dashboard-page";
import type { PersistedState, RecurringGenerationSummary } from "../../types";

type MockStoreState = {
  transactions: PersistedState["transactions"];
  budgets: PersistedState["budgets"];
  categories: PersistedState["categories"];
  accounts: PersistedState["accounts"];
  recurringRules: PersistedState["recurringRules"];
  lastRecurringGenerationSummary: RecurringGenerationSummary | null;
};

let storeState: MockStoreState;

vi.mock("../../app/store", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) => selector(storeState),
}));

vi.mock("../../app/recurring-store-actions", () => ({
  generateRecurringForRange: vi.fn(),
}));

function createStoreState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    transactions: [],
    budgets: [],
    categories: [],
    accounts: [],
    recurringRules: [],
    lastRecurringGenerationSummary: null,
    ...overrides,
  };
}

function getSummaryCardValue(label: string) {
  const card = screen.getByText(label).closest<HTMLElement>(".summary-card");

  if (!card) {
    throw new Error(`summary card not found for ${label}`);
  }

  return within(card).getByText(/^[0-9]+$/).textContent;
}

function getSectionByHeading(text: string) {
  const heading = screen.getByRole("heading", { name: text });
  const section = heading.closest<HTMLElement>(".section-card");

  if (!section) {
    throw new Error(`section not found for ${text}`);
  }

  return section;
}

describe("dashboard expected occurrence summary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
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
        {
          id: "cat-archived",
          name: "old gym",
          kind: "expense",
          archivedAt: "2026-04-10T00:00:00.000Z",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
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
          active: true,
          dayOfMonth: 20,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "rule-due",
          kind: "standard",
          name: "gym",
          amountCents: -4500,
          accountId: "acct-checking",
          categoryId: "cat-archived",
          frequency: "yearly",
          startDate: "2024-04-21",
          active: true,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "rule-upcoming-transfer",
          kind: "transfer",
          name: "save",
          amountCents: 5000,
          accountId: "acct-checking",
          toAccountId: "acct-savings",
          frequency: "monthly",
          startDate: "2026-01-24",
          active: true,
          dayOfMonth: 24,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows due-today, overdue, next-7-days counts and a due-soon list", () => {
    render(<DashboardPage />);

    const nearTermSection = getSectionByHeading("near-term expected items");

    expect(getSummaryCardValue("due today")).toBe("1");
    expect(getSummaryCardValue("overdue")).toBe("2");
    expect(getSummaryCardValue("next 7 days")).toBe("2");
    expect(
      within(nearTermSection).getByText(
        /2026-04-20 · rent · \$1,200.00 · rent · overdue/
      )
    ).toBeTruthy();
    expect(
      within(nearTermSection).getByText(
        /2026-04-21 · gym · \$45.00 · old gym \(archived\) · due/
      )
    ).toBeTruthy();
    expect(
      within(nearTermSection).getByText(
        /2026-04-24 · save · \$50.00 · checking → savings · upcoming/
      )
    ).toBeTruthy();
  });
});