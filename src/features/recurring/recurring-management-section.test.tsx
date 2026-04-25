// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecurringManagementSection } from "./recurring-management-section";
import type { PersistedState } from "../../types";

type MockStoreState = {
  accounts: PersistedState["accounts"];
  categories: PersistedState["categories"];
  transactions: PersistedState["transactions"];
  budgets: PersistedState["budgets"];
  recurringRules: PersistedState["recurringRules"];
  addRecurringRule: ReturnType<typeof vi.fn>;
  updateRecurringRule: ReturnType<typeof vi.fn>;
  deleteRecurringRule: ReturnType<typeof vi.fn>;
  lastRecurringGenerationSummary: null;
};

let storeState: MockStoreState;
const generateRecurringForRangeMock = vi.fn();

vi.mock("../../app/store", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) => selector(storeState),
}));

vi.mock("../../app/recurring-store-actions", () => ({
  generateRecurringForRange: (...args: unknown[]) => generateRecurringForRangeMock(...args),
}));

function createStoreState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
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
        id: "cat-active",
        name: "groceries",
        kind: "expense",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "cat-archived",
        name: "old dining",
        kind: "expense",
        archivedAt: "2026-04-10T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
    ],
    transactions: [],
    budgets: [],
    recurringRules: [
      {
        id: "rule-archived",
        kind: "standard",
        name: "legacy dinner",
        amountCents: -4500,
        accountId: "acct-checking",
        categoryId: "cat-archived",
        merchant: "Cafe",
        frequency: "monthly",
        startDate: "2026-01-01",
        active: true,
        dayOfMonth: 12,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    addRecurringRule: vi.fn(),
    updateRecurringRule: vi.fn(),
    deleteRecurringRule: vi.fn(),
    lastRecurringGenerationSummary: null,
    ...overrides,
  };
}

function getOptionTexts(select: HTMLSelectElement) {
  return Array.from(select.options).map((option) => option.text);
}

describe("recurring management archived-category behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
    generateRecurringForRangeMock.mockReset();
    storeState = createStoreState();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("excludes archived categories from new recurring-rule creation but keeps linked archived categories in edit mode", () => {
    render(<RecurringManagementSection />);

    const createCategorySelect = screen.getByLabelText("category") as HTMLSelectElement;

    expect(getOptionTexts(createCategorySelect)).toEqual([
      "select category",
      "groceries (expense)",
    ]);
    expect(getOptionTexts(createCategorySelect)).not.toContain(
      "old dining (archived) (expense)"
    );

    fireEvent.click(screen.getByRole("button", { name: "edit" }));

    const categorySelects = screen.getAllByLabelText("category") as HTMLSelectElement[];
    const editCategorySelect = categorySelects.find(
      (select) => select.value === "cat-archived"
    );

    expect(editCategorySelect).toBeTruthy();
    expect(getOptionTexts(editCategorySelect!)).toContain(
      "old dining (archived) (expense)"
    );
  });
});