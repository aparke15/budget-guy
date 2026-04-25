import { z } from "zod";

import { LATEST_PERSISTED_STATE_VERSION } from "../types";

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["checking", "savings", "credit", "cash"]),
  creditLimitCents: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((account, ctx) => {
  if (account.type !== "credit" && account.creditLimitCents != null) {
    ctx.addIssue({
      code: "custom",
      path: ["creditLimitCents"],
      message: "only credit accounts can include creditLimitCents",
    });
  }
});

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["income", "expense"]),
  color: z.string().optional(),
  archivedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const transactionSplitSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  amountCents: z.number().int(),
  note: z.string().optional(),
}).superRefine((split, ctx) => {
  if (split.amountCents === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["amountCents"],
      message: "split rows require a non-zero amount",
    });
  }
});

export const transactionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["standard", "transfer", "opening-balance"]).default("standard"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int(),
  accountId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  splits: z.array(transactionSplitSchema).optional(),
  merchant: z.string().optional(),
  note: z.string().optional(),
  source: z.enum(["manual", "recurring"]),
  recurringRuleId: z.string().optional(),
  transferGroupId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((transaction, ctx) => {
  if (transaction.kind === "standard") {
    const splits = transaction.splits;
    const hasSplits = splits != null;

    if (hasSplits && splits.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: "split transactions require at least 2 rows",
      });
    }

    if (hasSplits && transaction.amountCents === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountCents"],
        message: "split transactions require a non-zero amount",
      });
    }

    if (hasSplits && transaction.categoryId != null) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "split transactions cannot include parent categoryId",
      });
    }

    if (!hasSplits && !transaction.categoryId) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "standard transactions require categoryId",
      });
    }

    if (hasSplits) {
      const splitTotalAmountCents = splits.reduce(
        (sum, split) => sum + split.amountCents,
        0
      );

      if (splitTotalAmountCents !== transaction.amountCents) {
        ctx.addIssue({
          code: "custom",
          path: ["splits"],
          message: "split transaction amounts must add up to the parent amount",
        });
      }

      const parentSign = Math.sign(transaction.amountCents);

      if (
        parentSign !== 0 &&
        splits.some((split) => Math.sign(split.amountCents) !== parentSign)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["splits"],
          message: "split amounts must use the same sign as the parent transaction",
        });
      }
    }

    if (transaction.transferGroupId != null) {
      ctx.addIssue({
        code: "custom",
        path: ["transferGroupId"],
        message: "standard transactions cannot include transferGroupId",
      });
    }

    return;
  }

  if (transaction.kind === "opening-balance") {
    if (transaction.categoryId != null) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "opening-balance transactions cannot include categoryId",
      });
    }

    if (transaction.transferGroupId != null) {
      ctx.addIssue({
        code: "custom",
        path: ["transferGroupId"],
        message: "opening-balance transactions cannot include transferGroupId",
      });
    }

    if (transaction.splits != null) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: "opening-balance transactions cannot include splits",
      });
    }

    if (transaction.recurringRuleId != null) {
      ctx.addIssue({
        code: "custom",
        path: ["recurringRuleId"],
        message: "opening-balance transactions cannot include recurringRuleId",
      });
    }

    if (transaction.source !== "manual") {
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message: "opening-balance transactions must use manual source",
      });
    }

    if (transaction.merchant != null) {
      ctx.addIssue({
        code: "custom",
        path: ["merchant"],
        message: "opening-balance transactions cannot include merchant",
      });
    }

    if (transaction.amountCents === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountCents"],
        message: "opening-balance transactions require a non-zero amount",
      });
    }

    return;
  }

  if (transaction.categoryId != null) {
    ctx.addIssue({
      code: "custom",
      path: ["categoryId"],
      message: "transfer transactions cannot include categoryId",
    });
  }

  if (transaction.splits != null) {
    ctx.addIssue({
      code: "custom",
      path: ["splits"],
      message: "transfer transactions cannot include splits",
    });
  }

  if (transaction.transferGroupId == null) {
    ctx.addIssue({
      code: "custom",
      path: ["transferGroupId"],
      message: "transfer transactions require transferGroupId",
    });
  }

  if (transaction.source === "recurring" && transaction.recurringRuleId == null) {
    ctx.addIssue({
      code: "custom",
      path: ["recurringRuleId"],
      message: "recurring transfer transactions require recurringRuleId",
    });
  }

  if (transaction.source === "manual" && transaction.recurringRuleId != null) {
    ctx.addIssue({
      code: "custom",
      path: ["recurringRuleId"],
      message: "manual transfer transactions cannot include recurringRuleId",
    });
  }

  if (transaction.merchant != null) {
    ctx.addIssue({
      code: "custom",
      path: ["merchant"],
      message: "transfer transactions cannot include merchant",
    });
  }

  if (transaction.amountCents === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["amountCents"],
      message: "transfer transactions require a non-zero amount",
    });
  }
});

export const budgetSchema = z.object({
  id: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  categoryId: z.string().min(1),
  plannedCents: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const recurringRuleSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["standard", "transfer"]).default("standard"),
    name: z.string().min(1),
    amountCents: z.number().int(),
    accountId: z.string().min(1),
    toAccountId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    merchant: z.string().optional(),
    note: z.string().optional(),
    frequency: z.enum(["monthly", "weekly", "biweekly", "yearly"]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    active: z.boolean(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((rule, ctx) => {
    if (rule.kind === "standard") {
      if (!rule.categoryId) {
        ctx.addIssue({
          code: "custom",
          path: ["categoryId"],
          message: "standard recurring rules require categoryId",
        });
      }

      if (rule.toAccountId != null) {
        ctx.addIssue({
          code: "custom",
          path: ["toAccountId"],
          message: "standard recurring rules cannot include toAccountId",
        });
      }
    }

    if (rule.kind === "transfer") {
      if (!rule.toAccountId) {
        ctx.addIssue({
          code: "custom",
          path: ["toAccountId"],
          message: "transfer recurring rules require toAccountId",
        });
      }

      if (rule.categoryId != null) {
        ctx.addIssue({
          code: "custom",
          path: ["categoryId"],
          message: "transfer recurring rules cannot include categoryId",
        });
      }

      if (rule.merchant != null) {
        ctx.addIssue({
          code: "custom",
          path: ["merchant"],
          message: "transfer recurring rules cannot include merchant",
        });
      }

      if (rule.amountCents <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["amountCents"],
          message: "transfer recurring rules require a positive amount",
        });
      }

      if (rule.accountId === rule.toAccountId) {
        ctx.addIssue({
          code: "custom",
          path: ["toAccountId"],
          message: "transfer recurring rules must use two different accounts",
        });
      }
    }

    if (rule.frequency === "monthly" && rule.dayOfMonth == null) {
      ctx.addIssue({
        code: "custom",
        path: ["dayOfMonth"],
        message: "monthly rules require dayOfMonth",
      });
    }

    if (
      (rule.frequency === "weekly" || rule.frequency === "biweekly") &&
      rule.dayOfWeek == null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["dayOfWeek"],
        message: "weekly and biweekly rules require dayOfWeek",
      });
    }
  });

const persistedCollectionsShape = {
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  budgets: z.array(budgetSchema),
  recurringRules: z.array(recurringRuleSchema),
};

function addPersistedStateRefinements<
  TSchema extends z.ZodObject<typeof persistedCollectionsShape>
>(schema: TSchema) {
  return schema.superRefine((state, ctx) => {
  const categoryIds = new Set(state.categories.map((category) => category.id));
  const categoryKindById = new Map(
    state.categories.map((category) => [category.id, category.kind])
  );
  const transferGroups = new Map<string, typeof state.transactions>();

  for (const transaction of state.transactions) {
    if (transaction.kind !== "transfer" || !transaction.transferGroupId) {
      continue;
    }

    const existing = transferGroups.get(transaction.transferGroupId) ?? [];
    existing.push(transaction);
    transferGroups.set(transaction.transferGroupId, existing);
  }

  for (const [transferGroupId, transactions] of transferGroups) {
    if (transactions.length !== 2) {
      ctx.addIssue({
        code: "custom",
        path: ["transactions"],
        message: `transfer group ${transferGroupId} must contain exactly 2 transactions`,
      });
      continue;
    }

    const fromTransaction = transactions.find(
      (transaction) => transaction.amountCents < 0
    );
    const toTransaction = transactions.find(
      (transaction) => transaction.amountCents > 0
    );

    if (!fromTransaction || !toTransaction) {
      ctx.addIssue({
        code: "custom",
        path: ["transactions"],
        message: `transfer group ${transferGroupId} must contain one negative and one positive transaction`,
      });
      continue;
    }

    if (Math.abs(fromTransaction.amountCents) !== toTransaction.amountCents) {
      ctx.addIssue({
        code: "custom",
        path: ["transactions"],
        message: `transfer group ${transferGroupId} must balance to the same absolute amount`,
      });
    }

    if (fromTransaction.accountId === toTransaction.accountId) {
      ctx.addIssue({
        code: "custom",
        path: ["transactions"],
        message: `transfer group ${transferGroupId} must use two different accounts`,
      });
    }

    if (fromTransaction.date !== toTransaction.date) {
      ctx.addIssue({
        code: "custom",
        path: ["transactions"],
        message: `transfer group ${transferGroupId} must use the same date for both transactions`,
      });
    }
  }

  const openingBalanceCounts = state.transactions.reduce<Map<string, number>>(
    (counts, transaction) => {
      if (transaction.kind !== "opening-balance") {
        return counts;
      }

      counts.set(transaction.accountId, (counts.get(transaction.accountId) ?? 0) + 1);
      return counts;
    },
    new Map()
  );

  for (const [accountId, count] of openingBalanceCounts) {
    if (count <= 1) {
      continue;
    }

    ctx.addIssue({
      code: "custom",
      path: ["transactions"],
      message: `account ${accountId} cannot have more than one opening-balance transaction`,
    });
  }

  for (const budget of state.budgets) {
    if (!categoryIds.has(budget.categoryId)) {
      ctx.addIssue({
        code: "custom",
        path: ["budgets"],
        message: `budget category ${budget.categoryId} must exist`,
      });
    }
  }

  for (const rule of state.recurringRules) {
    if (rule.categoryId && !categoryIds.has(rule.categoryId)) {
      ctx.addIssue({
        code: "custom",
        path: ["recurringRules"],
        message: `recurring rule category ${rule.categoryId} must exist`,
      });
    }
  }

  for (const transaction of state.transactions) {
    if (transaction.kind !== "standard") {
      continue;
    }

    if (transaction.categoryId && !categoryIds.has(transaction.categoryId)) {
      ctx.addIssue({
        code: "custom",
        path: ["transactions"],
        message: `transaction category ${transaction.categoryId} must exist`,
      });
    }

    if (transaction.splits == null) {
      if (transaction.categoryId) {
        const categoryKind = categoryKindById.get(transaction.categoryId);
        const expectedCategoryKind = transaction.amountCents < 0 ? "expense" : "income";

        if (
          transaction.amountCents !== 0 &&
          categoryKind &&
          categoryKind !== expectedCategoryKind
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["transactions"],
            message: `transaction category ${transaction.categoryId} must be a ${expectedCategoryKind} category`,
          });
        }
      }

      continue;
    }

    const expectedCategoryKind = transaction.amountCents < 0 ? "expense" : "income";

    for (const split of transaction.splits) {
      if (!categoryIds.has(split.categoryId)) {
        ctx.addIssue({
          code: "custom",
          path: ["transactions"],
          message: `split category ${split.categoryId} must exist`,
        });
        continue;
      }

      const categoryKind = categoryKindById.get(split.categoryId);

      if (categoryKind && categoryKind !== expectedCategoryKind) {
        ctx.addIssue({
          code: "custom",
          path: ["transactions"],
          message: `split category ${split.categoryId} must be a ${expectedCategoryKind} category`,
        });
      }
    }
  }
  });
}

export const persistedCollectionsSchema = addPersistedStateRefinements(
  z.object(persistedCollectionsShape)
);

export const latestPersistedStateSchema = addPersistedStateRefinements(
  z.object({
    version: z.literal(LATEST_PERSISTED_STATE_VERSION),
    ...persistedCollectionsShape,
  })
);

export const persistedStateSchema = latestPersistedStateSchema;

export type AccountSchemaType = z.infer<typeof accountSchema>;
export type CategorySchemaType = z.infer<typeof categorySchema>;
export type TransactionSchemaType = z.infer<typeof transactionSchema>;
export type BudgetSchemaType = z.infer<typeof budgetSchema>;
export type RecurringRuleSchemaType = z.infer<typeof recurringRuleSchema>;
export type PersistedStateSchemaType = z.infer<typeof persistedStateSchema>;
export type PersistedCollectionsSchemaType = z.infer<typeof persistedCollectionsSchema>;
export type LatestPersistedStateSchemaType = z.infer<typeof latestPersistedStateSchema>;