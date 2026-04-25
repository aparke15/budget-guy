import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { getVisibleBudgetCategories } from "../../lib/categories";
import { createBudget } from "../../lib/factories";
import { getCurrentMonth } from "../../lib/dates";
import {
  createDraftSummary,
  getBudgetEditorRows,
  getDraftPlannedTotal,
  getDraftRemainingCents,
} from "./budget-page-helpers";
import {
  formatCents,
  formatCentsForInput,
  getMonthlySummary,
  parseAmountInputToCents,
} from "../../lib/money";
import {
  compactSecondaryButtonStyle,
  inputStyle,
  primaryButtonStyle,
} from "../components/style-constants";

export function BudgetPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [expandedBudgetCategoryId, setExpandedBudgetCategoryId] = useState<string | null>(null);

  const categories = useAppStore((state) => state.categories);
  const budgets = useAppStore((state) => state.budgets);
  const transactions = useAppStore((state) => state.transactions);
  const addBudget = useAppStore((state) => state.addBudget);
  const updateBudget = useAppStore((state) => state.updateBudget);

  const expenseCategories = useMemo(
    () => getVisibleBudgetCategories(categories, budgets, transactions, month),
    [budgets, categories, month, transactions]
  );

  const rows = useMemo(
    () => getBudgetEditorRows(expenseCategories, budgets, transactions, month),
    [budgets, expenseCategories, month, transactions]
  );

  const budgetMap = useMemo(
    () => new Map(rows.map((row) => [row.categoryId, row])),
    [rows]
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

  function updateDraft(categoryId: string, value: string) {
    setExpandedBudgetCategoryId(categoryId);
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
    const existing = budgetMap.get(categoryId);

    const plannedCents = getDraftCents(categoryId);

    if (existing?.budgetId) {
      if (existing.plannedCents !== plannedCents) {
        updateBudget(existing.budgetId, { plannedCents });
      }

      return;
    }

    if (plannedCents !== 0) {
      addBudget(
        createBudget({
          month,
          categoryId,
          plannedCents,
        })
      );
    }
  }

  function saveAllBudgets() {
    rows.forEach((row) => {
      saveCategoryBudget(row.categoryId);
    });
  }

  function toggleExpandedBudgetRow(categoryId: string, forceExpanded = false) {
    setExpandedBudgetCategoryId((current) => {
      if (forceExpanded) {
        return categoryId;
      }

      return current === categoryId ? null : categoryId;
    });
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">budgets</h1>
          <p className="page-subtitle">
            every expense category gets a row. set the plan directly from your category list.
          </p>
        </div>

        <div className="page-actions">
          <label className="field">
            <span className="field__label">month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              style={inputStyle}
            />
          </label>

          <button
            type="button"
            onClick={saveAllBudgets}
            style={primaryButtonStyle}
          >
            save all budgets
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card__label">planned</div>
          <div className="summary-card__value">{formatCents(draftSummary.plannedCents)}</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__label">spent</div>
          <div className="summary-card__value">{formatCents(summary.expenseCents)}</div>
        </div>

        <div className={draftSummary.unassignedCents < 0 ? "summary-card summary-card--bad" : "summary-card"}>
          <div className="summary-card__label">unassigned</div>
          <div className="summary-card__value">{formatCents(draftSummary.unassignedCents)}</div>
        </div>
      </div>

      <div className="section-card section-card--surface">
        <div className="section-header">
          <div className="section-title-group">
            <h2 className="section-title">monthly plan by category</h2>
            <p className="section-subtitle">
              expense categories come from Settings. categories without a saved plan start at 0.00.
            </p>
          </div>
        </div>

        <div className="table-wrap responsive-table-desktop">
          <table className="app-table">
            <thead>
              <tr>
                <th>category</th>
                <th className="money-column">planned</th>
                <th className="money-column">actual</th>
                <th className="money-column">remaining</th>
                <th>actions</th>
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
                  <tr key={row.categoryId}>
                    <td>{row.categoryName}</td>

                    <td className="money-column">
                      <input
                        className="money-input budget-planned-input"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={drafts[row.categoryId] ?? ""}
                        onChange={(event) =>
                          updateDraft(row.categoryId, event.target.value)
                        }
                        style={{
                          ...inputStyle,
                          minHeight: "2.25rem",
                          border: dirty
                            ? "1px solid var(--color-accent)"
                            : "1px solid var(--border-strong)",
                        }}
                      />
                    </td>

                    <td className="money-column">{formatCents(row.actualCents)}</td>

                    <td className={`money-column ${overBudget ? "text-negative" : "text-positive"} font-bold`}>
                      {formatCents(remainingCents)}
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() => saveCategoryBudget(row.categoryId)}
                          disabled={!dirty}
                          style={{
                            ...compactSecondaryButtonStyle,
                            background: dirty ? "var(--button-primary-bg)" : "var(--bg-muted)",
                            color: dirty ? "var(--button-primary-text)" : "var(--text-muted)",
                            borderColor: dirty
                              ? "var(--button-primary-border)"
                              : "var(--border-strong)",
                            cursor: dirty ? "pointer" : "not-allowed",
                          }}
                        >
                          save
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-cell--flush">
                    <p className="empty-state">
                      no expense categories yet. add one in settings to start budgeting.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="responsive-table-mobile table-card-list" aria-label="budget rows list">
          {rows.length === 0 ? (
            <p className="empty-state">
              no expense categories yet. add one in settings to start budgeting.
            </p>
          ) : (
            rows.map((row) => {
              const dirty = isDirty(row.categoryId);
              const remainingCents = getDraftRemainingCents(
                getDraftCents(row.categoryId),
                row.actualCents
              );
              const overBudget = remainingCents < 0;
              const isExpanded = expandedBudgetCategoryId === row.categoryId || dirty;

              return (
                <article
                  key={row.categoryId}
                  className={isExpanded ? "table-card table-card--expanded" : "table-card"}
                >
                  <button
                    type="button"
                    className="table-card__summary"
                    aria-expanded={isExpanded}
                    onClick={() => {
                      if (dirty) {
                        toggleExpandedBudgetRow(row.categoryId, true);
                        return;
                      }

                      toggleExpandedBudgetRow(row.categoryId);
                    }}
                  >
                    <div className="table-card__top">
                      <div className="table-card__details-group">
                        <div className="table-card__details">{row.categoryName}</div>
                      </div>

                      <div className="table-card__amount font-bold">
                        {formatCents(row.actualCents)} / {formatCents(getDraftCents(row.categoryId))}
                      </div>
                    </div>

                    <div className="table-card__summary-footer">
                      <div className="table-card__summary-meta">
                        <span>spent / planned</span>
                      </div>

                      <span className="table-card__chevron" aria-hidden="true">
                        {isExpanded ? "▴" : "▾"}
                      </span>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="table-card__expanded-details">
                      <label className="field">
                        <span className="field__label">planned</span>
                        <input
                          className="money-input"
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={drafts[row.categoryId] ?? ""}
                          onFocus={() => toggleExpandedBudgetRow(row.categoryId, true)}
                          onChange={(event) =>
                            updateDraft(row.categoryId, event.target.value)
                          }
                          style={{
                            ...inputStyle,
                            minHeight: "2.25rem",
                            border: dirty
                              ? "1px solid var(--color-accent)"
                              : "1px solid var(--border-strong)",
                          }}
                        />
                      </label>

                      <div className="table-card__meta-line">
                        <span className="table-card__eyebrow">remaining</span>
                        <span className={overBudget ? "text-negative font-bold" : "text-positive font-bold"}>
                          {formatCents(remainingCents)}
                        </span>
                      </div>

                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() => saveCategoryBudget(row.categoryId)}
                          disabled={!dirty}
                          style={{
                            ...compactSecondaryButtonStyle,
                            background: dirty ? "var(--button-primary-bg)" : "var(--bg-muted)",
                            color: dirty ? "var(--button-primary-text)" : "var(--text-muted)",
                            borderColor: dirty
                              ? "var(--button-primary-border)"
                              : "var(--border-strong)",
                            cursor: dirty ? "pointer" : "not-allowed",
                          }}
                        >
                          save
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}