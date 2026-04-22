import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { createBudget } from "../../lib/factories";
import { getCurrentMonth } from "../../lib/dates";
import {
  createDraftSummary,
  getAvailableBudgetCategories,
  getBudgetEditorRows,
  getDraftPlannedTotal,
  getDraftRemainingCents,
  hasBudgetForMonthCategory,
} from "./budget-page-helpers";
import {
  formatCents,
  formatCentsForInput,
  getMonthlySummary,
  parseAmountInputToCents,
} from "../../lib/money";

export function BudgetPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newPlannedAmount, setNewPlannedAmount] = useState("");
  const [addError, setAddError] = useState("");

  const categories = useAppStore((state) => state.categories);
  const budgets = useAppStore((state) => state.budgets);
  const transactions = useAppStore((state) => state.transactions);
  const addBudget = useAppStore((state) => state.addBudget);
  const updateBudget = useAppStore((state) => state.updateBudget);
  const deleteBudget = useAppStore((state) => state.deleteBudget);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "expense"),
    [categories]
  );

  const rows = useMemo(
    () => getBudgetEditorRows(expenseCategories, budgets, transactions, month),
    [budgets, expenseCategories, month, transactions]
  );

  const budgetMap = useMemo(
    () => new Map(rows.map((row) => [row.categoryId, row])),
    [rows]
  );

  const availableCategories = useMemo(
    () => getAvailableBudgetCategories(expenseCategories, budgets, month),
    [budgets, expenseCategories, month]
  );

  const summary = useMemo(
    () => getMonthlySummary(transactions, budgets, month),
    [budgets, month, transactions]
  );

  const draftPlannedTotal = useMemo(
    () => getDraftPlannedTotal(rows, drafts),
    [drafts, rows]
  );

  const draftSummary = useMemo(
    () => createDraftSummary(summary, draftPlannedTotal),
    [draftPlannedTotal, summary]
  );

  useEffect(() => {
    const nextDrafts = Object.fromEntries(
      rows.map((row) => {
        const existing = budgetMap.get(row.categoryId);

        return [
          row.categoryId,
          existing ? formatCentsForInput(existing.plannedCents) : "",
        ];
      })
    );

    setDrafts(nextDrafts);
  }, [budgetMap, rows]);

  useEffect(() => {
    setNewCategoryId((current) => {
      if (availableCategories.some((category) => category.id === current)) {
        return current;
      }

      return availableCategories[0]?.id ?? "";
    });
  }, [availableCategories]);

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

    if (!existing) {
      return false;
    }

    const currentCents = getDraftCents(categoryId);
    const existingCents = existing.plannedCents;

    return currentCents !== existingCents;
  }

  function saveCategoryBudget(categoryId: string) {
    const existing = budgetMap.get(categoryId);

    if (!existing) {
      return;
    }

    const plannedCents = getDraftCents(categoryId);

    if (existing.plannedCents !== plannedCents) {
      updateBudget(existing.budgetId, { plannedCents });
    }
  }

  function removeCategoryBudget(categoryId: string) {
    const existing = budgetMap.get(categoryId);

    if (!existing) {
      return;
    }

    deleteBudget(existing.budgetId);

    setDrafts((current) => {
      const next = { ...current };

      delete next[categoryId];
      return next;
    });
  }

  function saveAllBudgets() {
    rows.forEach((row) => {
      saveCategoryBudget(row.categoryId);
    });
  }

  function handleAddBudget() {
    setAddError("");

    if (!newCategoryId) {
      setAddError("choose an expense category");
      return;
    }

    if (hasBudgetForMonthCategory(budgets, month, newCategoryId)) {
      setAddError("budget already exists for this category and month");
      return;
    }

    const parsed = parseAmountInputToCents(newPlannedAmount);
    const plannedCents = parsed ?? 0;

    if (plannedCents < 0) {
      setAddError("planned amount must be zero or more");
      return;
    }

    addBudget(
      createBudget({
        month,
        categoryId: newCategoryId,
        plannedCents,
      })
    );
    setNewPlannedAmount("");
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
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              marginBottom: "1rem",
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.9rem", color: "#374151" }}>add category</span>
              <select
                value={newCategoryId}
                onChange={(event) => setNewCategoryId(event.target.value)}
                disabled={availableCategories.length === 0}
                style={{
                  padding: "0.55rem 0.7rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                }}
              >
                {availableCategories.length === 0 ? (
                  <option value="">all expense categories already budgeted</option>
                ) : null}

                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.9rem", color: "#374151" }}>planned</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={newPlannedAmount}
                onChange={(event) => setNewPlannedAmount(event.target.value)}
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
              onClick={handleAddBudget}
              disabled={availableCategories.length === 0}
              style={{
                padding: "0.7rem 0.95rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                background: availableCategories.length === 0 ? "#f3f4f6" : "#111827",
                color: availableCategories.length === 0 ? "#9ca3af" : "#ffffff",
                cursor: availableCategories.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              add budget
            </button>
          </div>

          {addError ? (
            <p style={{ margin: "0 0 1rem", color: "#b91c1c", fontSize: "0.9rem" }}>
              {addError}
            </p>
          ) : null}

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
              {rows.map((row) => {
                const dirty = isDirty(row.categoryId);
                const remainingCents = getDraftRemainingCents(
                  getDraftCents(row.categoryId),
                  row.actualCents
                );
                const overBudget = remainingCents < 0;

                return (
                  <tr
                    key={row.budgetId}
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
                    <td style={{ padding: "0.65rem 0.5rem" }}>
                      {row.categoryName}
                    </td>

                    <td style={{ padding: "0.65rem 0.5rem" }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={drafts[row.categoryId] ?? ""}
                        onChange={(event) =>
                          updateDraft(row.categoryId, event.target.value)
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
                      {formatCents(row.actualCents)}
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
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => saveCategoryBudget(row.categoryId)}
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

                        <button
                          type="button"
                          onClick={() => removeCategoryBudget(row.categoryId)}
                          style={{
                            padding: "0.45rem 0.65rem",
                            borderRadius: "0.45rem",
                            border: "1px solid #ef4444",
                            background: "#ffffff",
                            color: "#b91c1c",
                            cursor: "pointer",
                          }}
                        >
                          remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: "1rem 0.5rem", color: "#6b7280" }}
                  >
                    no budgets for this month yet. add one to get started.
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