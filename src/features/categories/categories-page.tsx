import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import { useAppStore } from "../../app/store";
import { isCategoryArchived } from "../../lib/categories";
import { createCategory } from "../../lib/factories";
import { countTransactionCategoryUsageByCategoryId } from "../../lib/transaction-splits";
import type { Category } from "../../types";
import { CategoryEditor } from "../components/editors";
import type { CategoryFormValues } from "../types";
import {
  buildDeleteImpact,
  countById,
  normalizeEntityName,
  sortItemsByName,
  type DeleteImpact,
  type PendingDelete,
} from "../settings/settings-helpers";

function createCategoryFormValues(): CategoryFormValues {
  return {
    name: "",
    kind: "expense",
  };
}

type CategoryManagementSectionProps = {
  categories: Category[];
  budgetCounts: Record<string, number>;
  transactionCounts: Record<string, number>;
  recurringRuleCounts: Record<string, number>;
  addCategory: (input: Category) => void;
  updateCategory: (id: string, input: Partial<Category>) => void;
  onRequestArchive: (category: Category) => void;
  onRestore: (categoryId: string) => void;
};

function CategoryManagementSection(props: CategoryManagementSectionProps) {
  const {
    categories,
    budgetCounts,
    transactionCounts,
    recurringRuleCounts,
    addCategory,
    updateCategory,
    onRequestArchive,
    onRestore,
  } = props;
  const [createValues, setCreateValues] = useState<CategoryFormValues>(() =>
    createCategoryFormValues()
  );
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<CategoryFormValues>(() =>
    createCategoryFormValues()
  );
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (editingId && !categories.some((category) => category.id === editingId)) {
      setEditingId(null);
      setEditValues(createCategoryFormValues());
      setEditError("");
    }
  }, [categories, editingId]);

  function updateCreateField<K extends keyof CategoryFormValues>(
    key: K,
    value: CategoryFormValues[K]
  ) {
    setCreateValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateEditField<K extends keyof CategoryFormValues>(
    key: K,
    value: CategoryFormValues[K]
  ) {
    setEditValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCreateSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    const normalizedName = normalizeEntityName(createValues.name);

    if (!normalizedName) {
      setCreateError("name is required");
      return;
    }

    if (
      categories.some(
        (category) => normalizeEntityName(category.name) === normalizedName
      )
    ) {
      setCreateError("category name already exists");
      return;
    }

    addCategory(createCategory(createValues));
    setCreateValues(createCategoryFormValues());
  }

  function startEditing(category: Category) {
    setEditingId(category.id);
    setEditValues({
      name: category.name,
      kind: category.kind,
    });
    setEditError("");
  }

  function handleEditSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    setEditError("");

    const normalizedName = normalizeEntityName(editValues.name);

    if (!normalizedName) {
      setEditError("name is required");
      return;
    }

    if (
      categories.some(
        (category) =>
          category.id !== editingId &&
          normalizeEntityName(category.name) === normalizedName
      )
    ) {
      setEditError("category name already exists");
      return;
    }

    updateCategory(editingId, {
      name: editValues.name.trim(),
      kind: editValues.kind,
    });
    setEditingId(null);
    setEditValues(createCategoryFormValues());
  }

  return (
    <div className="section-card stack-md">
      <div className="section-header">
        <div className="section-title-group">
          <h2 className="section-title">manage categories</h2>
          <p className="section-subtitle">
            create, edit, archive, and restore categories without breaking
            historical transactions, budgets, or recurring rules.
          </p>
        </div>
      </div>

      <CategoryEditor
        values={createValues}
        error={createError}
        submitLabel="add category"
        onSubmit={handleCreateSubmit}
        onChange={updateCreateField}
      />

      <div className="entity-list">
        {categories.map((category) =>
          editingId === category.id ? (
            <div key={category.id} className="entity-card">
              <div className="full-width">
                <CategoryEditor
                  values={editValues}
                  error={editError}
                  submitLabel="save category"
                  onSubmit={handleEditSubmit}
                  onChange={updateEditField}
                  onCancel={() => {
                    setEditingId(null);
                    setEditValues(createCategoryFormValues());
                    setEditError("");
                  }}
                />
              </div>
            </div>
          ) : (
            <div key={category.id} className="entity-card">
              <div className="entity-card__body">
                <div className="entity-card__title">
                  <span>{category.name}</span>
                  <span
                    className={
                      category.kind === "income"
                        ? "badge badge--income"
                        : "badge badge--expense"
                    }
                  >
                    {category.kind}
                  </span>
                  {isCategoryArchived(category) ? (
                    <span className="badge badge--neutral">archived</span>
                  ) : null}
                </div>
                <div className="entity-card__meta">
                  {budgetCounts[category.id] ?? 0} budget
                  {(budgetCounts[category.id] ?? 0) === 1 ? "" : "s"} · {transactionCounts[category.id] ?? 0} transaction
                  {(transactionCounts[category.id] ?? 0) === 1 ? "" : "s"} · {recurringRuleCounts[category.id] ?? 0} recurring rule
                  {(recurringRuleCounts[category.id] ?? 0) === 1 ? "" : "s"}
                </div>
              </div>

              <div className="table-actions">
                <button
                  type="button"
                  onClick={() => startEditing(category)}
                  className="button button--secondary button--compact"
                >
                  edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    isCategoryArchived(category)
                      ? onRestore(category.id)
                      : onRequestArchive(category)
                  }
                  className={
                    isCategoryArchived(category)
                      ? "button button--secondary button--compact"
                      : "button button--danger button--compact"
                  }
                >
                  {isCategoryArchived(category) ? "restore" : "archive"}
                </button>
              </div>
            </div>
          )
        )}

        {categories.length === 0 ? (
          <p className="empty-state">no categories yet.</p>
        ) : null}
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const categories = useAppStore((state) => state.categories);
  const transactions = useAppStore((state) => state.transactions);
  const budgets = useAppStore((state) => state.budgets);
  const recurringRules = useAppStore((state) => state.recurringRules);
  const addCategory = useAppStore((state) => state.addCategory);
  const updateCategory = useAppStore((state) => state.updateCategory);
  const archiveCategory = useAppStore((state) => state.archiveCategory);
  const unarchiveCategory = useAppStore((state) => state.unarchiveCategory);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const sortedCategories = useMemo(
    () => sortItemsByName(categories),
    [categories]
  );

  const categoryBudgetCounts = useMemo(
    () => countById(budgets, (budget) => budget.categoryId),
    [budgets]
  );

  const categoryTransactionCounts = useMemo(
    () => countTransactionCategoryUsageByCategoryId(transactions),
    [transactions]
  );

  const categoryRecurringRuleCounts = useMemo(
    () => countById(recurringRules, (rule) => rule.categoryId),
    [recurringRules]
  );

  const deleteImpact = useMemo<DeleteImpact | null>(
    () => buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules),
    [budgets, pendingDelete, recurringRules, transactions]
  );

  function handleConfirmDelete() {
    if (!pendingDelete || pendingDelete.entity !== "category") {
      return;
    }

    archiveCategory(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">categories</h1>
          <p className="page-subtitle">
            manage active and archived categories here. archived categories stay
            valid for history and stay out of new-use pickers until restored.
          </p>
        </div>
      </div>

      {deleteImpact ? (
        <div className="section-card section-card--danger">
          <div className="section-header">
            <div className="section-title-group">
              <h2 className="section-title">{deleteImpact.title}</h2>
              <p className="section-subtitle">{deleteImpact.description}</p>
            </div>

            <div className="button-row">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="button button--danger"
              >
                confirm archive
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="button button--secondary"
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CategoryManagementSection
        categories={sortedCategories}
        budgetCounts={categoryBudgetCounts}
        transactionCounts={categoryTransactionCounts}
        recurringRuleCounts={categoryRecurringRuleCounts}
        addCategory={addCategory}
        updateCategory={updateCategory}
        onRequestArchive={(category) =>
          setPendingDelete({
            entity: "category",
            id: category.id,
            name: category.name,
          })
        }
        onRestore={unarchiveCategory}
      />
    </section>
  );
}