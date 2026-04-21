import { describe, expect, it } from "vitest";

import { recurringRuleSchema } from "./validation";

describe("validation schemas", () => {
  it("requires dayOfMonth for monthly recurring rules", () => {
    const result = recurringRuleSchema.safeParse({
      id: "rule-1",
      name: "Rent",
      amountCents: -120000,
      accountId: "acct-1",
      categoryId: "cat-1",
      frequency: "monthly",
      startDate: "2026-04-01",
      active: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("monthly rules require dayOfMonth");
    }
  });

  it("requires dayOfWeek for weekly recurring rules", () => {
    const result = recurringRuleSchema.safeParse({
      id: "rule-1",
      name: "Gym",
      amountCents: -2500,
      accountId: "acct-1",
      categoryId: "cat-1",
      frequency: "weekly",
      startDate: "2026-04-01",
      active: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "weekly and biweekly rules require dayOfWeek"
      );
    }
  });
});
