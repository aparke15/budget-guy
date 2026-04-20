import { z } from "zod";

export const accountschema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["checking", "savings", "credit", "cash"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const categoryschema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["income", "expense"]),
  color: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const transactionschema = z.object({
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

export const budgetschema = z.object({
  id: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  categoryId: z.string().min(1),
  plannedCents: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const recurringruleschema = z
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

export const persistedstateschema = z.object({
  version: z.literal(1),
  accounts: z.array(accountschema),
  categories: z.array(categoryschema),
  transactions: z.array(transactionschema),
  budgets: z.array(budgetschema),
  recurringRules: z.array(recurringruleschema),
});

export type accountschematype = z.infer<typeof accountschema>;
export type categoryschematype = z.infer<typeof categoryschema>;
export type transactionschematype = z.infer<typeof transactionschema>;
export type budgetschematype = z.infer<typeof budgetschema>;
export type recurringruleschematype = z.infer<typeof recurringruleschema>;
export type persistedstateschematype = z.infer<
  typeof persistedstateschema
>;