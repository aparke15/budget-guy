import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { createBudget } from "../../lib/factories";
import { getCurrentMonth } from "../../lib/dates";
import {
  createDraftSummary,
  getDraftPlannedTotal,
  getDraftRemainingCents,
} from "./budget-page-helpers";
import {
  formatCents,
  formatCentsForInput,
  getBudgetRows,
  getMonthlySummary,
  parseAmountInputToCents,
} from "../../lib/money";

export function BudgetPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const categories = useAppStore((state) => state.categories);
  const budgets = useAppStore((state) => state.budgets);
  const transactions = useAppStore((state) => state.transactions);
  const addBudget = useAppStore((state) => state.addBudget);
  const updateBudget = useAppStore((state) => state.updateBudget);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "expense"),
    [categories]
  );

  const budgetMap = useMemo(
    () =>
      new Map(
        budgets
          .filter((budget) => budget.month === month)
          .map((budget) => [budget.categoryId, budget])
      ),
    [budgets, month]
  );

  const rows = useMemo(
    () => getBudgetRows(categories, budgets, transactions, month),
    [budgets, categories, month, transactions]
  );

  const rowMap = useMemo(
    () => new Map(rows.map((row) => [row.categoryId, row])),
    [rows]
  );

  const summary = useMemo(
    () => getMonthlySummary(transactions, budgets, month),
    [budgets, month, transactions]
  );

  const draftPlannedTotal = useMemo(
    () => getDraftPlannedTotal(expenseCategories, drafts),
    [drafts, expenseCategories]
  );

  const draftSummary = useMemo(
    () => createDraftSummary(summary, draftPlannedTotal),
    [draftPlannedTotal, summary]
  );

  useEffect(() => {
    const nextDrafts = Object.fromEntries(
      expenseCategories.map((category) => {
        const existing = budgetMap.get(category.id);

        return [
          category.id,
          existing ? formatCentsForInput(existing.plannedCents) : "",
        ];
      })
    );

    setDrafts(nextDrafts);
  }, [budgetMap, expenseCategories, month]);

  function updateDraft(categoryId: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [categoryId]: value,
    }));
  }

  function getDraftCents(categoryId: string): number {
    const raw = drafts[categoryId] ?? "";
    const parsed = parseAmountInputToCents(raw);

    return parsed ?? 0;
  }

  function isDirty(categoryId: string): boolean {
    const existing = budgetMap.get(categoryId);
    const currentCents = getDraftCents(categoryId);
    const existingCents = existing?.plannedCents ?? 0;

    return currentCents !== existingCents;
  }

  function saveCategoryBudget(categoryId: string) {
    const plannedCents = getDraftCents(categoryId);
    const existing = budgetMap.get(categoryId);

    if (existing) {
      if (existing.plannedCents !== plannedCents) {
        updateBudget(existing.id, { plannedCents });
      }

      return;
    }

    if (plannedCents === 0) {
      return;
    }

    addBudget(
      createBudget({
        month,
        categoryId,
        plannedCents,
      })
    );
  }

  function saveAllBudgets() {
    expenseCategories.forEach((category) => {
      saveCategoryBudget(category.id);
    });
  }

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>budget</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
            planned vs actual. now with agency.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <label
            style={{
              display: "grid",
              gap: "0.35rem",
              fontSize: "0.9rem",
              color: "#374151",
            }}
          >
            month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              style={{
                padding: "0.55rem 0.7rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                background: "#ffffff",
              }}
            />
          </label>

          <button
            type="button"
            onClick={saveAllBudgets}
            style={{
              padding: "0.7rem 0.95rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "#111827",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            save all budgets
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>planned</div>
          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "1.4rem",
              fontWeight: 700,
            }}
          >
            {formatCents(draftSummary.plannedCents)}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>spent</div>
          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "1.4rem",
              fontWeight: 700,
            }}
          >
            {formatCents(summary.expenseCents)}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>unassigned</div>
          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: draftSummary.unassignedCents < 0 ? "#991b1b" : "#111827",
            }}
          >
            {formatCents(draftSummary.unassignedCents)}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <th style={{ padding: "0.65rem 0.5rem" }}>category</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>planned</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>actual</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>remaining</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>actions</th>
              </tr>
            </thead>
            <tbody>
              {expenseCategories.map((category) => {
                const row = rowMap.get(category.id);
                const dirty = isDirty(category.id);
                const remainingCents = getDraftRemainingCents(
                  getDraftCents(category.id),
                  row?.actualCents ?? 0
                );
                const overBudget = remainingCents < 0;

                return (
                  <tr
                    key={category.id}
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
                    <td style={{ padding: "0.65rem 0.5rem" }}>
                      {category.name}
                    </td>

                    <td style={{ padding: "0.65rem 0.5rem" }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={drafts[category.id] ?? ""}
                        onChange={(event) =>
                          updateDraft(category.id, event.target.value)
                        }
                        style={{
                          width: "120px",
                          padding: "0.5rem 0.6rem",
                          borderRadius: "0.45rem",
                          border: dirty
                            ? "1px solid #2563eb"
                            : "1px solid #d1d5db",
                          background: "#ffffff",
                        }}
                      />
                    </td>

                    <td style={{ padding: "0.65rem 0.5rem" }}>
                      {formatCents(row?.actualCents ?? 0)}
                    </td>

                    <td
                      style={{
                        padding: "0.65rem 0.5rem",
                        color: overBudget ? "#991b1b" : "#166534",
                        fontWeight: 600,
                      }}
                    >
                      {formatCents(remainingCents)}
                    </td>

                    <td style={{ padding: "0.65rem 0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => saveCategoryBudget(category.id)}
                        disabled={!dirty}
                        style={{
                          padding: "0.45rem 0.65rem",
                          borderRadius: "0.45rem",
                          border: "1px solid #d1d5db",
                          background: dirty ? "#111827" : "#f3f4f6",
                          color: dirty ? "#ffffff" : "#9ca3af",
                          cursor: dirty ? "pointer" : "not-allowed",
                        }}
                      >
                        save
                      </button>
                    </td>
                  </tr>
                );
              })}

              {expenseCategories.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: "1rem 0.5rem", color: "#6b7280" }}
                  >
                    no expense categories yet. that would be nice in real life.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}