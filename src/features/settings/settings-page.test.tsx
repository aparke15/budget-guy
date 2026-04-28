// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "./settings-page";
import * as storageModule from "../../app/storage";
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
const authModule = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  sendMagicLinkSignIn: vi.fn(),
  signOut: vi.fn(),
  subscribeToAuthStateChanges: vi.fn(),
}));
const remoteStorageModule = vi.hoisted(() => ({
  fetchRemoteSnapshotMetadata: vi.fn(),
  fetchRemoteSnapshot: vi.fn(),
  uploadRemoteSnapshot: vi.fn(),
}));
const supabaseModule = vi.hoisted(() => ({
  getSupabaseAvailability: vi.fn(),
}));

vi.mock("../../app/store", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) => selector(storeState),
}));

vi.mock("../../app/auth", () => authModule);
vi.mock("../../app/remote-storage", () => remoteStorageModule);
vi.mock("../../app/supabase", () => supabaseModule);

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
    authModule.getCurrentSession.mockResolvedValue({
      success: true,
      session: null,
      user: null,
    });
    authModule.sendMagicLinkSignIn.mockResolvedValue({ success: true });
    authModule.signOut.mockResolvedValue({ success: true });
    authModule.subscribeToAuthStateChanges.mockReturnValue(() => {});
    remoteStorageModule.fetchRemoteSnapshotMetadata.mockResolvedValue({
      success: true,
      data: null,
    });
    remoteStorageModule.fetchRemoteSnapshot.mockResolvedValue({
      success: true,
      data: null,
    });
    remoteStorageModule.uploadRemoteSnapshot.mockResolvedValue({
      success: true,
      data: {
        metadata: {
          userId: "user-1",
          schemaVersion: LATEST_PERSISTED_STATE_VERSION,
          updatedAt: "2026-04-21T00:00:00.000Z",
          deviceId: "device-a",
          snapshotHash: "hash-a",
        },
        snapshot: createPersistedState(),
      },
    });
    supabaseModule.getSupabaseAvailability.mockReturnValue({
      available: true,
      client: {},
      config: {
        url: "https://example.supabase.co",
        anonKey: "anon-key",
      },
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

  it("no longer renders category management controls", () => {
    render(<SettingsPage />);

    expect(
      screen.queryByRole("heading", { name: "manage categories" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "add category" })
    ).toBeNull();
  });

  it("shows the signed-out auth prompt while keeping local-only messaging", async () => {
    render(<SettingsPage />);

    expect(
      await screen.findByText(
        /signed out users keep the full local-first app experience/i
      )
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "send magic link" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "backup local before pull" })
    ).toBeNull();
  });

  it("shows signed-in sync actions for an authenticated user", async () => {
    authModule.getCurrentSession.mockResolvedValue({
      success: true,
      session: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
      user: {
        id: "user-1",
        email: "user@example.com",
      },
    });

    render(<SettingsPage />);

    expect(await screen.findByText(/signed in as/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "push local to cloud" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "pull cloud to this device" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "sync now" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "backup local before pull" })
    ).toBeNull();
  });

  it("shows backup-before-pull only when cloud state could overwrite local data", async () => {
    authModule.getCurrentSession.mockResolvedValue({
      success: true,
      session: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
      user: {
        id: "user-1",
        email: "user@example.com",
      },
    });
    remoteStorageModule.fetchRemoteSnapshotMetadata.mockResolvedValue({
      success: true,
      data: {
        userId: "user-1",
        schemaVersion: LATEST_PERSISTED_STATE_VERSION,
        updatedAt: "2026-04-21T12:00:00.000Z",
        deviceId: "device-remote",
        snapshotHash: "hash-cloud-newer",
      },
    });

    render(<SettingsPage />);

    expect(
      await screen.findByRole("button", { name: "backup local before pull" })
    ).toBeTruthy();
  });

  it("reuses the shared backup export path before pull", async () => {
    const downloadBackupSpy = vi
      .spyOn(storageModule, "downloadPersistedStateBackup")
      .mockImplementation(() => {});
    authModule.getCurrentSession.mockResolvedValue({
      success: true,
      session: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
      user: {
        id: "user-1",
        email: "user@example.com",
      },
    });
    remoteStorageModule.fetchRemoteSnapshotMetadata.mockResolvedValue({
      success: true,
      data: {
        userId: "user-1",
        schemaVersion: LATEST_PERSISTED_STATE_VERSION,
        updatedAt: "2026-04-21T12:00:00.000Z",
        deviceId: "device-remote",
        snapshotHash: "hash-cloud-newer",
      },
    });

    render(<SettingsPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "backup local before pull" })
    );

    expect(downloadBackupSpy).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("local backup exported. you can pull from cloud when ready.")
    ).toBeTruthy();
  });

  it("pulls a validated cloud snapshot through the existing replace path", async () => {
    const replacement = createPersistedState({
      accounts: [
        {
          id: "acct-cloud",
          name: "cloud checking",
          type: "checking",
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
      ],
    });
    authModule.getCurrentSession.mockResolvedValue({
      success: true,
      session: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
      user: {
        id: "user-1",
        email: "user@example.com",
      },
    });
    remoteStorageModule.fetchRemoteSnapshot.mockResolvedValue({
      success: true,
      data: {
        metadata: {
          userId: "user-1",
          schemaVersion: LATEST_PERSISTED_STATE_VERSION,
          updatedAt: "2026-04-21T12:00:00.000Z",
          deviceId: "device-b",
          snapshotHash: "hash-cloud",
        },
        snapshot: replacement,
      },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "pull cloud to this device" }));

    expect(await screen.findByText("cloud snapshot pulled into local storage.")).toBeTruthy();
    expect(storeState.replacePersistedState).toHaveBeenCalledWith(replacement);
  });

  it("hides backup-before-pull when no remote snapshot exists", async () => {
    authModule.getCurrentSession.mockResolvedValue({
      success: true,
      session: {
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      },
      user: {
        id: "user-1",
        email: "user@example.com",
      },
    });
    remoteStorageModule.fetchRemoteSnapshotMetadata.mockResolvedValue({
      success: true,
      data: null,
    });

    render(<SettingsPage />);

    expect(
      await screen.findByRole("button", { name: "pull cloud to this device" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "backup local before pull" })
    ).toBeNull();
  });
});