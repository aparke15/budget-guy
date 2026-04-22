import { useEffect, useMemo, useState, type ChangeEvent, type SubmitEvent } from "react";

import { useAppStore } from "../../app/store";
import {
  buildBackupFileName,
  buildPersistedStateSnapshot,
  exportPersistedStateJson,
  parsePersistedStateJson,
} from "../../app/storage";
import { createCategory } from "../../lib/factories";
import {
  buildDeleteImpact,
  countById,
  normalizeEntityName,
  sortItemsByName,
  type DeleteImpact,
  type PendingDelete,
} from "./settings-helpers";
import type { CategoryFormValues } from "../types";
import type { Category, PersistedState } from "../../types";
import { CategoryEditor } from "../components/editors";
import {
  cardStyle,
  dangerButtonStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "../components/style-constants";

function createCategoryFormValues(): CategoryFormValues {
  return { name: "", kind: "expense" };
}

type CategoriesSectionProps = {
  categories: Category[];
  budgetCounts: Record<string, number>;
  transactionCounts: Record<string, number>;
  recurringRuleCounts: Record<string, number>;
  addCategory: (input: Category) => void;
  updateCategory: (id: string, input: Partial<Category>) => void;
  onRequestDelete: (category: Category) => void;
};

function CategoriesSection(props: CategoriesSectionProps) {
  const {
    categories,
    budgetCounts,
    transactionCounts,
    recurringRuleCounts,
    addCategory,
    updateCategory,
    onRequestDelete,
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
    if (editingId && !categories.some((c) => c.id === editingId)) {
      setEditingId(null);
      setEditValues(createCategoryFormValues());
      setEditError("");
    }
  }, [categories, editingId]);

  function updateCreateField<K extends keyof CategoryFormValues>(
    key: K,
    value: CategoryFormValues[K]
  ) {
    setCreateValues((current) => ({ ...current, [key]: value }));
  }

  function updateEditField<K extends keyof CategoryFormValues>(
    key: K,
    value: CategoryFormValues[K]
  ) {
    setEditValues((current) => ({ ...current, [key]: value }));
  }

  function handleCreateSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    const normalizedName = normalizeEntityName(createValues.name);

    if (!normalizedName) {
      setCreateError("name is required");
      return;
    }

    if (categories.some((c) => normalizeEntityName(c.name) === normalizedName)) {
      setCreateError("category name already exists");
      return;
    }

    addCategory(createCategory(createValues));
    setCreateValues(createCategoryFormValues());
  }

  function startEditing(category: Category) {
    setEditingId(category.id);
    setEditValues({ name: category.name, kind: category.kind });
    setEditError("");
  }

  function handleEditSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingId) return;

    setEditError("");

    const normalizedName = normalizeEntityName(editValues.name);

    if (!normalizedName) {
      setEditError("name is required");
      return;
    }

    if (
      categories.some(
        (c) => c.id !== editingId && normalizeEntityName(c.name) === normalizedName
      )
    ) {
      setEditError("category name already exists");
      return;
    }

    updateCategory(editingId, { name: editValues.name.trim(), kind: editValues.kind });
    setEditingId(null);
    setEditValues(createCategoryFormValues());
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
        categories ({categories.length})
      </h2>
      <p style={{ margin: "0.35rem 0 1rem", color: "#6b7280", fontSize: "0.9rem" }}>
        keep category setup lightweight. deletes also remove linked budgets,
        transactions, and recurring rules.
      </p>

      <div style={{ display: "grid", gap: "0.9rem" }}>
        <CategoryEditor
          values={createValues}
          error={createError}
          submitLabel="add category"
          onSubmit={handleCreateSubmit}
          onChange={updateCreateField}
        />

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {categories.map((category) =>
            editingId === category.id ? (
              <div key={category.id} className="entity-edit-wrapper">
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
            ) : (
              <div key={category.id} className="entity-row">
                <div className="entity-row__body">
                  <div className="entity-row__name">{category.name}</div>
                  <div className="entity-row__meta">
                    <span
                      className={
                        "badge badge--" +
                        (category.kind === "income" ? "income" : "expense")
                      }
                    >
                      {category.kind}
                    </span>
                  </div>
                  <div className="entity-row__stats">
                    {budgetCounts[category.id] ?? 0} budget
                    {(budgetCounts[category.id] ?? 0) === 1 ? "" : "s"} &middot;{" "}
                    {transactionCounts[category.id] ?? 0} transaction
                    {(transactionCounts[category.id] ?? 0) === 1 ? "" : "s"} &middot;{" "}
                    {recurringRuleCounts[category.id] ?? 0} recurring rule
                    {(recurringRuleCounts[category.id] ?? 0) === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="entity-row__actions">
                  <button
                    type="button"
                    onClick={() => startEditing(category)}
                    style={secondaryButtonStyle}
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(category)}
                    style={dangerButtonStyle}
                  >
                    delete
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
    </div>
  );
}

type DataManagementSectionProps = {
  accounts: ReturnType<typeof useAppStore.getState>["accounts"];
  categories: ReturnType<typeof useAppStore.getState>["categories"];
  transactions: ReturnType<typeof useAppStore.getState>["transactions"];
  budgets: ReturnType<typeof useAppStore.getState>["budgets"];
  recurringRules: ReturnType<typeof useAppStore.getState>["recurringRules"];
  replacePersistedState: (state: PersistedState) => void;
  resetSeedData: () => void;
};

function DataManagementSection(props: DataManagementSectionProps) {
  const {
    accounts,
    categories,
    transactions,
    budgets,
    recurringRules,
    replacePersistedState,
    resetSeedData,
  } = props;
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");

  function handleExport() {
    const state = buildPersistedStateSnapshot({
      accounts,
      categories,
      transactions,
      budgets,
      recurringRules,
    });
    const json = exportPersistedStateJson(state);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildBackupFileName();
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImportError("");
    setImportSuccess("");
    if (!file) return;
    const raw = await file.text();
    const result = parsePersistedStateJson(raw);
    if (result.success) {
      const confirmed = window.confirm(
        "importing a backup replaces all current data. continue?"
      );
      if (!confirmed) {
        event.target.value = "";
        return;
      }
      replacePersistedState(result.data);
      setImportSuccess("backup imported successfully");
      event.target.value = "";
      return;
    }
    setImportError("error" in result ? result.error : "invalid backup file");
    event.target.value = "";
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>data management</h2>
      <p style={{ margin: "0.35rem 0 1rem", color: "#6b7280", fontSize: "0.9rem" }}>
        export a full json backup or import one to replace all current data after
        confirmation.
      </p>

      <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
        <button type="button" onClick={handleExport} style={primaryButtonStyle}>
          export json backup
        </button>
        <label
          style={{
            ...secondaryButtonStyle,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          import json backup
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            style={{ display: "none" }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("this will replace all data with seed data. continue?"))
              resetSeedData();
          }}
          style={secondaryButtonStyle}
        >
          reset seed data
        </button>
      </div>

      <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>
        import never merges. valid backups replace accounts, categories, transactions,
        budgets, and recurring rules.
      </p>
      {importError ? (
        <p style={{ margin: "0.75rem 0 0", color: "#b91c1c", fontSize: "0.9rem" }}>
          {importError}
        </p>
      ) : null}
      {importSuccess ? (
        <p style={{ margin: "0.75rem 0 0", color: "#166534", fontSize: "0.9rem" }}>
          {importSuccess}
        </p>
      ) : null}
    </div>
  );
}

export function SettingsPage() {
  const accounts = useAppStore((state) => state.accounts);
  const categories = useAppStore((state) => state.categories);
  const transactions = useAppStore((state) => state.transactions);
  const budgets = useAppStore((state) => state.budgets);
  const recurringRules = useAppStore((state) => state.recurringRules);
  const addCategory = useAppStore((state) => state.addCategory);
  const updateCategory = useAppStore((state) => state.updateCategory);
  const deleteCategory = useAppStore((state) => state.deleteCategory);
  const deleteTransaction = useAppStore((state) => state.deleteTransaction);
  const deleteBudget = useAppStore((state) => state.deleteBudget);
  const deleteRecurringRule = useAppStore((state) => state.deleteRecurringRule);
  const replacePersistedState = useAppStore((state) => state.replacePersistedState);
  const resetSeedData = useAppStore((state) => state.resetSeedData);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const sortedCategories = useMemo(() => sortItemsByName(categories), [categories]);

  const categoryBudgetCounts = useMemo(
    () => countById(budgets, (b) => b.categoryId),
    [budgets]
  );

  const categoryTransactionCounts = useMemo(
    () => countById(transactions, (t) => t.categoryId),
    [transactions]
  );

  const categoryRecurringRuleCounts = useMemo(
    () => countById(recurringRules, (r) => r.categoryId),
    [recurringRules]
  );

  const deleteImpact = useMemo<DeleteImpact | null>(
    () => buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules),
    [budgets, pendingDelete, recurringRules, transactions]
  );

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.entity === "category") {
      budgets
        .filter((b) => b.categoryId === pendingDelete.id)
        .forEach((b) => deleteBudget(b.id));
      transactions
        .filter((t) => t.categoryId === pendingDelete.id)
        .forEach((t) => deleteTransaction(t.id));
      recurringRules
        .filter((r) => r.categoryId === pendingDelete.id)
        .forEach((r) => deleteRecurringRule(r.id));
      deleteCategory(pendingDelete.id);
    }
    setPendingDelete(null);
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>settings</h1>
          <p>categories and data management.</p>
        </div>
      </div>

      {deleteImpact ? (
        <div className="delete-confirm">
          <h2>{deleteImpact.title}</h2>
          <p>{deleteImpact.description}</p>
          <div className="toolbar">
            <button
              type="button"
              onClick={handleConfirmDelete}
              style={{ ...dangerButtonStyle, background: "#fee2e2" }}
            >
              confirm delete
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              style={secondaryButtonStyle}
            >
              cancel
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "1rem" }}>
        <DataManagementSection
          accounts={accounts}
          categories={categories}
          transactions={transactions}
          budgets={budgets}
          recurringRules={recurringRules}
          replacePersistedState={replacePersistedState}
          resetSeedData={resetSeedData}
        />
        <CategoriesSection
          categories={sortedCategories}
          budgetCounts={categoryBudgetCounts}
          transactionCounts={categoryTransactionCounts}
          recurringRuleCounts={categoryRecurringRuleCounts}
          addCategory={addCategory}
          updateCategory={updateCategory}
          onRequestDelete={(category) =>
            setPendingDelete({
              entity: "category",
              id: category.id,
              name: category.name,
            })
          }
        />
      </div>
    </section>
  );
}
