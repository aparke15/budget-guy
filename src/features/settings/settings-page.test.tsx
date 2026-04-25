// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "./settings-page";
import {
  LATEST_PERSISTED_STATE_VERSION,
  type PersistedState,
} from "../../types";

type MockStoreState = {
  accounts: PersistedState["accounts"];
  categories: PersistedState["categories"];
  transactions: PersistedState["transactions"];
  budgets: PersistedState["budgets"];
  recurringRules: PersistedState["recurringRules"];
  addCategory: ReturnType<typeof vi.fn>;
  updateCategory: ReturnType<typeof vi.fn>;
  archiveCategory: ReturnType<typeof vi.fn>;
  unarchiveCategory: ReturnType<typeof vi.fn>;
  replacePersistedState: ReturnType<typeof vi.fn>;
  resetSeedData: ReturnType<typeof vi.fn>;
};

let storeState: MockStoreState;

vi.mock("../../app/store", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) => selector(storeState),
}));

function createPersistedState(
  overrides: Partial<PersistedState> = {}
): PersistedState {
  return {
    version: LATEST_PERSISTED_STATE_VERSION,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurringRules: [],
    ...overrides,
  };
}

function createStoreState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurringRules: [],
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    archiveCategory: vi.fn(),
    unarchiveCategory: vi.fn(),
    replacePersistedState: vi.fn(),
    resetSeedData: vi.fn(),
    ...overrides,
  };
}

describe("settings page backup import", () => {
  beforeEach(() => {
    storeState = createStoreState({
      accounts: [
        {
          id: "acct-existing",
          name: "existing",
          type: "checking",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("replaces all current data after importing a valid backup", async () => {
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
          id: "cat-rent",
          name: "rent",
          kind: "expense",
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
      ],
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("import json backup"), {
      target: {
        files: [
          new File([JSON.stringify(replacement)], "backup.json", {
            type: "application/json",
          }),
        ],
      },
    });

    expect(await screen.findByText("backup imported successfully")).toBeTruthy();
    expect(storeState.replacePersistedState).toHaveBeenCalledWith(replacement);
  });

  it("rejects invalid backup files without replacing in-memory data", async () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("import json backup"), {
      target: {
        files: [
          new File(["{bad json}"], "backup.json", {
            type: "application/json",
          }),
        ],
      },
    });

    expect(await screen.findByText("file is not valid json")).toBeTruthy();
    expect(storeState.replacePersistedState).not.toHaveBeenCalled();
  });

  it("leaves current data untouched when the replacement confirmation is cancelled", async () => {
    const replacement = createPersistedState({
      accounts: [
        {
          id: "acct-imported",
          name: "imported",
          type: "cash",
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
      ],
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("import json backup"), {
      target: {
        files: [
          new File([JSON.stringify(replacement)], "backup.json", {
            type: "application/json",
          }),
        ],
      },
    });

    expect(storeState.replacePersistedState).not.toHaveBeenCalled();
    expect(screen.queryByText("backup imported successfully")).toBeNull();
  });
});