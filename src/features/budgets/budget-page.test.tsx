// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BudgetPage } from "./budget-page";
import type { PersistedState } from "../../types";

type MockStoreState = {
  categories: PersistedState["categories"];
  budgets: PersistedState["budgets"];
  transactions: PersistedState["transactions"];
  addBudget: ReturnType<typeof vi.fn>;
  updateBudget: ReturnType<typeof vi.fn>;
};

let storeState: MockStoreState;

vi.mock("../../app/store", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) => selector(storeState),
}));

function createStoreState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    categories: [
      {
        id: "cat-active",
        name: "groceries",
        kind: "expense",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "cat-archived-budgeted",
        name: "old dining",
        kind: "expense",
        archivedAt: "2026-04-10T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
      {
        id: "cat-archived-unused",
        name: "retired travel",
        kind: "expense",
        archivedAt: "2026-04-10T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
    ],
    budgets: [
      {
        id: "budget-archived",
        month: "2026-04",
        categoryId: "cat-archived-budgeted",
        plannedCents: 4500,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    transactions: [],
    addBudget: vi.fn(),
    updateBudget: vi.fn(),
    ...overrides,
  };
}

describe("budget page archived-category behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:34:56.000Z"));
    storeState = createStoreState();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps archived categories visible for months that already reference them and excludes unused archived categories", () => {
    render(<BudgetPage />);

    expect(screen.getAllByText("old dining (archived)").length).toBeGreaterThan(0);
    expect(screen.queryByText("retired travel (archived)")).toBeNull();
  });
});