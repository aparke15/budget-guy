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
    <section className="page">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">budgets</h1>
          <p className="page-subtitle">planned vs actual. now with agency.</p>
        </div>

        <div className="page-actions">
          <label className="field">
            <span className="field-label">month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="control control--compact"
            />
          </label>

          <button type="button" onClick={saveAllBudgets} className="button button--primary">
            save all budgets
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-item">
          <div className="summary-label">planned</div>
          <div className="summary-value">{formatCents(draftSummary.plannedCents)}</div>
        </div>

        <div className="summary-item">
          <div className="summary-label">spent</div>
          <div className="summary-value">{formatCents(summary.expenseCents)}</div>
        </div>

        <div className="summary-item">
          <div className="summary-label">unassigned</div>
          <div className={`summary-value ${draftSummary.unassignedCents < 0 ? "text-negative" : ""}`}>
            {formatCents(draftSummary.unassignedCents)}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="toolbar">
          <label className="field">
            <span className="field-label">add category</span>
            <select
              value={newCategoryId}
              onChange={(event) => setNewCategoryId(event.target.value)}
              disabled={availableCategories.length === 0}
              className="control"
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

          <label className="field">
            <span className="field-label">planned</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={newPlannedAmount}
              onChange={(event) => setNewPlannedAmount(event.target.value)}
              className="control"
            />
          </label>

          <div className="toolbar-actions">
            <button
              type="button"
              onClick={handleAddBudget}
              disabled={availableCategories.length === 0}
              className="button button--primary"
            >
              add budget
            </button>
          </div>
        </div>

        {addError ? <p className="status-message status-message--error">{addError}</p> : null}

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>category</th>
                <th>planned</th>
                <th>actual</th>
                <th>remaining</th>
                <th className="cell-actions">actions</th>
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
                  <tr key={row.budgetId}>
                    <td>{row.categoryName}</td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={drafts[row.categoryId] ?? ""}
                        onChange={(event) => updateDraft(row.categoryId, event.target.value)}
                        className={`control control--compact${dirty ? " control--dirty" : ""}`}
                      />
                    </td>
                    <td>{formatCents(row.actualCents)}</td>
                    <td className={`cell-amount ${overBudget ? "text-negative" : "text-positive"}`}>
                      {formatCents(remainingCents)}
                    </td>
                    <td className="cell-actions">
                      <div className="action-group">
                        <button
                          type="button"
                          onClick={() => saveCategoryBudget(row.categoryId)}
                          disabled={!dirty}
                          className="button button--primary button--small"
                        >
                          save
                        </button>

                        <button
                          type="button"
                          onClick={() => removeCategoryBudget(row.categoryId)}
                          className="button button--danger button--small"
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
                  <td colSpan={5} className="text-muted">
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
