import type { Category, MonthlySummary } from "../../types";
import { parseAmountInputToCents } from "../../lib/money";

export function getDraftPlannedTotal(
  expenseCategories: Category[],
  drafts: Record<string, string>
): number {
  return expenseCategories.reduce((sum, category) => {
    const raw = drafts[category.id] ?? "";
    const parsed = parseAmountInputToCents(raw);

    return sum + (parsed ?? 0);
  }, 0);
}

export function createDraftSummary(
  summary: MonthlySummary,
  draftPlannedTotal: number
): MonthlySummary {
  return {
    ...summary,
    plannedCents: draftPlannedTotal,
    unassignedCents: summary.incomeCents - draftPlannedTotal,
  };
}

export function getDraftRemainingCents(
  draftCents: number,
  actualCents: number
): number {
  return draftCents - actualCents;
}