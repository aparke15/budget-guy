// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appRoutes } from "../../app/router";
import { CategoriesPage } from "./categories-page";
import type { PersistedState } from "../../types";

type MockStoreState = {
  categories: PersistedState["categories"];
  transactions: PersistedState["transactions"];
  budgets: PersistedState["budgets"];
  recurringRules: PersistedState["recurringRules"];
  addCategory: ReturnType<typeof vi.fn>;
  updateCategory: ReturnType<typeof vi.fn>;
  archiveCategory: ReturnType<typeof vi.fn>;
  unarchiveCategory: ReturnType<typeof vi.fn>;
};

let storeState: MockStoreState;

vi.mock("../../app/store", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) => selector(storeState),
}));

function createStoreState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    categories: [
      {
        id: "cat-groceries",
        name: "groceries",
        kind: "expense",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "cat-salary",
        name: "salary",
        kind: "income",
        createdAt: "2026-04-02T00:00:00.000Z",
        updatedAt: "2026-04-02T00:00:00.000Z",
      },
      {
        id: "cat-archived",
        name: "legacy dining",
        kind: "expense",
        archivedAt: "2026-04-10T00:00:00.000Z",
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
    ],
    transactions: [
      {
        id: "txn-1",
        kind: "standard",
        date: "2026-04-15",
        amountCents: -4200,
        accountId: "acct-1",
        categoryId: "cat-groceries",
        source: "manual",
        createdAt: "2026-04-15T00:00:00.000Z",
        updatedAt: "2026-04-15T00:00:00.000Z",
      },
    ],
    budgets: [
      {
        id: "budget-1",
        month: "2026-04",
        categoryId: "cat-groceries",
        plannedCents: 25000,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    recurringRules: [
      {
        id: "rule-1",
        kind: "standard",
        name: "weekly shop",
        amountCents: -7500,
        accountId: "acct-1",
        categoryId: "cat-groceries",
        frequency: "weekly",
        startDate: "2026-04-01",
        active: true,
        dayOfWeek: 5,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    archiveCategory: vi.fn(),
    unarchiveCategory: vi.fn(),
    ...overrides,
  };
}

describe("categories page", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
      configurable: true,
    });
    storeState = createStoreState();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders under the categories route and marks the nav item active", async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ["/categories"],
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("heading", { name: "categories" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "categories" }).getAttribute("aria-current")
    ).toBe("page");
  });

  it("keeps duplicate-name validation on create", () => {
    render(<CategoriesPage />);

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "  groceries  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "add category" }));

    expect(screen.getByText("category name already exists")).toBeTruthy();
    expect(storeState.addCategory).not.toHaveBeenCalled();
  });

  it("shows archive impact summary before confirming archive", () => {
    render(<CategoriesPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "archive" })[0]);

    expect(screen.getByText("archive category: groceries")).toBeTruthy();
    expect(
      screen.getByText(
        "this keeps 1 transaction, 1 budget, and 1 recurring rule in history, but removes the category from new-use pickers until restored."
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "confirm archive" }));

    expect(storeState.archiveCategory).toHaveBeenCalledWith("cat-groceries");
  });

  it("visually distinguishes archived categories and restores them", () => {
    render(<CategoriesPage />);

    expect(screen.getByText("legacy dining")).toBeTruthy();
    expect(screen.getByText("archived")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "restore" }));

    expect(storeState.unarchiveCategory).toHaveBeenCalledWith("cat-archived");
  });
});