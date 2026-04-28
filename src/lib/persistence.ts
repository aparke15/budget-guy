import { z } from "zod";

import {
  latestPersistedStateSchema,
  persistedCollectionsSchema,
} from "./validation";
import {
  LATEST_PERSISTED_STATE_VERSION,
  PERSISTED_STATE_V1_VERSION,
  PERSISTED_STATE_V2_VERSION,
  PERSISTED_STATE_V3_VERSION,
  type LatestPersistedState,
  type PersistedStateV1,
  type PersistedStateV2,
  type PersistedStateV3,
  type PersistedStateCollections,
} from "../types";

type ParsedLatestPersistedStateResult =
  | {
      success: true;
      data: LatestPersistedState;
    }
  | {
      success: false;
      error: string;
    };

type PersistedStateMigration = (input: unknown) => unknown;

type VersionedPersistedStateLike = {
  version?: unknown;
};

type PersistedStateMigrationRegistry = Partial<
  Record<number, PersistedStateMigration>
>;

export const LEGACY_PERSISTED_STATE_VERSION = 0;

const persistedStateMigrations: PersistedStateMigrationRegistry = {
  [LEGACY_PERSISTED_STATE_VERSION]: migratePersistedStateV0ToV1,
  [PERSISTED_STATE_V1_VERSION]: migratePersistedStateV1ToV2,
  [PERSISTED_STATE_V2_VERSION]: migratePersistedStateV2ToV3,
};

function getValidationErrorMessage(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function normalizeCreditOpeningBalanceTransactions(
  state: LatestPersistedState
): LatestPersistedState {
  const creditAccountIds = new Set(
    state.accounts
      .filter((account) => account.type === "credit")
      .map((account) => account.id)
  );

  if (creditAccountIds.size === 0) {
    return state;
  }

  return {
    ...state,
    transactions: state.transactions.map((transaction) => {
      if (
        transaction.kind !== "opening-balance" ||
        transaction.amountCents <= 0 ||
        !creditAccountIds.has(transaction.accountId)
      ) {
        return transaction;
      }

      return {
        ...transaction,
        amountCents: -transaction.amountCents,
      };
    }),
  };
}

export function detectPersistedStateVersion(input: unknown): number | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const { version } = input as VersionedPersistedStateLike;

  if (version == null) {
    return LEGACY_PERSISTED_STATE_VERSION;
  }

  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < LEGACY_PERSISTED_STATE_VERSION
  ) {
    return null;
  }

  return version;
}

export function migratePersistedStateV0ToV1(
  input: unknown
): PersistedStateV1 {
  const result = persistedCollectionsSchema.safeParse(input);

  if (!result.success) {
    throw new Error(getValidationErrorMessage(result.error, "invalid persisted state"));
  }

  return {
    version: PERSISTED_STATE_V1_VERSION,
    ...result.data,
  };
}

export function migratePersistedStateV1ToV2(
  input: unknown
): PersistedStateV2 {
  const result = persistedCollectionsSchema.safeParse(input);

  if (!result.success) {
    throw new Error(getValidationErrorMessage(result.error, "invalid persisted state"));
  }

  return {
    version: PERSISTED_STATE_V2_VERSION,
    ...result.data,
  };
}

export function migratePersistedStateV2ToV3(
  input: unknown
): PersistedStateV3 {
  const result = persistedCollectionsSchema.safeParse(input);

  if (!result.success) {
    throw new Error(getValidationErrorMessage(result.error, "invalid persisted state"));
  }

  return {
    version: PERSISTED_STATE_V3_VERSION,
    ...result.data,
    categories: result.data.categories.map((category) => ({
      ...category,
      archivedAt: category.archivedAt,
    })),
  };
}

export function migratePersistedStateToLatest(
  input: unknown
): ParsedLatestPersistedStateResult {
  const detectedVersion = detectPersistedStateVersion(input);

  if (detectedVersion == null) {
    return {
      success: false,
      error: "invalid persisted state payload",
    };
  }

  if (detectedVersion > LATEST_PERSISTED_STATE_VERSION) {
    return {
      success: false,
      error: `unsupported persisted state version: ${detectedVersion}`,
    };
  }

  let currentVersion = detectedVersion;
  let currentState: unknown = input;

  while (currentVersion < LATEST_PERSISTED_STATE_VERSION) {
    const migrate = persistedStateMigrations[currentVersion];

    if (!migrate) {
      return {
        success: false,
        error: `missing persisted state migration for version ${currentVersion}`,
      };
    }

    try {
      currentState = migrate(currentState);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "invalid persisted state",
      };
    }

    currentVersion += 1;
  }

  const result = latestPersistedStateSchema.safeParse(currentState);

  if (!result.success) {
    return {
      success: false,
      error: getValidationErrorMessage(result.error, "invalid persisted state"),
    };
  }

  return {
    success: true,
    data: normalizeCreditOpeningBalanceTransactions(result.data),
  };
}

export function buildLatestPersistedState(
  collections: PersistedStateCollections
): LatestPersistedState {
  return {
    version: LATEST_PERSISTED_STATE_VERSION,
    accounts: collections.accounts,
    categories: collections.categories,
    transactions: collections.transactions,
    budgets: collections.budgets,
    recurringRules: collections.recurringRules,
  };
}
