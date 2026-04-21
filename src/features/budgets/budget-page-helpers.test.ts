import { describe, expect, it } from "vitest";

import {
  createDraftSummary,
  getDraftPlannedTotal,
  getDraftRemainingCents,
} from "./budget-page-helpers";
import type { Category, MonthlySummary } from "../../types";

const categories: Category[] = [
  {
    id: "cat-rent",
    name: "Rent",
    kind: "expense",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "cat-food",
    name: "Food",
    kind: "expense",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "cat-salary",
    name: "Salary",
    kind: "income",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

const summary: MonthlySummary = {
  incomeCents: 300000,
  expenseCents: 125000,
  netCents: 175000,
  plannedCents: 130000,
  unassignedCents: 170000,
};

describe("budget page helpers", () => {
  it("totals draft planned amounts for expense categories", () => {
    expect(
      getDraftPlannedTotal(categories.filter((item) => item.kind === "expense"), {
        "cat-rent": "1200.00",
        "cat-food": "45.67",
      })
    ).toBe(124567);
  });

  it("treats blank and invalid draft values as zero", () => {
    expect(
      getDraftPlannedTotal(categories.filter((item) => item.kind === "expense"), {
        "cat-rent": "",
        "cat-food": "oops",
      })
    ).toBe(0);
  });

  it("creates a draft summary by overlaying planned and unassigned values", () => {
    expect(createDraftSummary(summary, 150000)).toEqual({
      incomeCents: 300000,
      expenseCents: 125000,
      netCents: 175000,
      plannedCents: 150000,
      unassignedCents: 150000,
    });
  });

  it("computes draft remaining using draft planned and actual spent", () => {
    expect(getDraftRemainingCents(20000, 4500)).toBe(15500);
    expect(getDraftRemainingCents(10000, 12000)).toBe(-2000);
  });
});
