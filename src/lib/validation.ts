import { z } from "zod";

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["checking", "savings", "credit", "cash"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["income", "expense"]),
  color: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const transactionSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int(),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  merchant: z.string().optional(),
  note: z.string().optional(),
  source: z.enum(["manual", "recurring"]),
  recurringRuleId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
    name: z.string().min(1),
    amountCents: z.number().int(),
    accountId: z.string().min(1),
    categoryId: z.string().min(1),
    merchant: z.string().optional(),
    note: z.string().optional(),
    frequency: z.enum(["monthly", "weekly", "biweekly"]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    active: z.boolean(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((rule, ctx) => {
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

export const persistedStateSchema = z.object({
  version: z.literal(1),
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  budgets: z.array(budgetSchema),
  recurringRules: z.array(recurringRuleSchema),
});

export type AccountSchemaType = z.infer<typeof accountSchema>;
export type CategorySchemaType = z.infer<typeof categorySchema>;
export type TransactionSchemaType = z.infer<typeof transactionSchema>;
export type BudgetSchemaType = z.infer<typeof budgetSchema>;
export type RecurringRuleSchemaType = z.infer<typeof recurringRuleSchema>;
export type PersistedStateSchemaType = z.infer<typeof persistedStateSchema>;