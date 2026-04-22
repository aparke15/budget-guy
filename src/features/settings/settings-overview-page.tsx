import { useEffect, useMemo, useState, type ChangeEvent, type SubmitEvent } from "react";

import { useAppStore } from "../../app/store";
import {
  buildBackupFileName,
  buildPersistedStateSnapshot,
  exportPersistedStateJson,
  parsePersistedStateJson,
} from "../../app/storage";
import { createCategory } from "../../lib/factories";
import type {
  Account,
  Budget,
  Category,
  PersistedState,
  RecurringRule,
  Transaction,
} from "../../types";
import { DeleteImpactBanner } from "../components/delete-impact-banner";
import { CategoryEditor } from "../components/editors/category-editor";
import {
  buildDeleteImpact,
  countById,
  normalizeEntityName,
  sortItemsByName,
  type DeleteImpact,
  type PendingDelete,
} from "../shared/management-helpers";
import type { CategoryFormValues } from "../types";

function createCategoryFormValues(): CategoryFormValues {
  return {
    name: "",
    kind: "expense",
  };
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
    <div className="section">
      <div className="section-heading">
        <h2 className="section-title">categories</h2>
        <p className="section-subtitle">
          keep category setup lightweight. deletes also remove linked budgets, transactions, and recurring rules.
        </p>
      </div>

      <CategoryEditor
        values={createValues}
        error={createError}
        submitLabel="add category"
        onSubmit={handleCreateSubmit}
        onChange={updateCreateField}
      />

      <div className="record-list">
        {categories.map((category) =>
          editingId === category.id ? (
            <div key={category.id} className="record-item">
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
            <div key={category.id} className="record-item">
              <div className="record-copy">
                <div className="record-title">{category.name}</div>
                <div className="record-meta">{category.kind}</div>
                <div className="record-detail">
                  {budgetCounts[category.id] ?? 0} budget
                  {(budgetCounts[category.id] ?? 0) === 1 ? "" : "s"} · {transactionCounts[category.id] ?? 0} transaction
                  {(transactionCounts[category.id] ?? 0) === 1 ? "" : "s"} · {recurringRuleCounts[category.id] ?? 0} recurring rule
                  {(recurringRuleCounts[category.id] ?? 0) === 1 ? "" : "s"}
                </div>
              </div>

              <div className="action-group">
                <button
                  type="button"
                  onClick={() => startEditing(category)}
                  className="button button--secondary button--small"
                >
                  edit
                </button>

                <button
                  type="button"
                  onClick={() => onRequestDelete(category)}
                  className="button button--danger button--small"
                >
                  delete
                </button>
              </div>
            </div>
          )
        )}

        {categories.length === 0 ? <p className="empty-state">no categories yet.</p> : null}
      </div>
    </div>
  );
}

type DataManagementSectionProps = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
  replacePersistedState: (state: PersistedState) => void;
};

function DataManagementSection(props: DataManagementSectionProps) {
  const {
    accounts,
    categories,
    transactions,
    budgets,
    recurringRules,
    replacePersistedState,
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

    if (!file) {
      return;
    }

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
    <div className="section">
      <div className="section-heading">
        <h2 className="section-title">data management</h2>
        <p className="section-subtitle">
          export a full json backup or import one to replace all current data after confirmation.
        </p>
      </div>

      <div className="form-actions">
        <button type="button" onClick={handleExport} className="button button--primary">
          export json backup
        </button>

        <label className="button button--secondary">
          import json backup
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <p className="field-help">
        import never merges. valid backups replace accounts, categories, transactions, budgets, and recurring rules.
      </p>

      {importError ? <p className="status-message status-message--error">{importError}</p> : null}
      {importSuccess ? <p className="status-message status-message--success">{importSuccess}</p> : null}
    </div>
  );
}

export function SettingsOverviewPage() {
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
    () => countById(budgets, (budget) => budget.categoryId),
    [budgets]
  );
  const categoryTransactionCounts = useMemo(
    () => countById(transactions, (transaction) => transaction.categoryId),
    [transactions]
  );
  const categoryRecurringRuleCounts = useMemo(
    () => countById(recurringRules, (rule) => rule.categoryId),
    [recurringRules]
  );
  const deleteImpact = useMemo<DeleteImpact | null>(() => {
    return buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules);
  }, [budgets, pendingDelete, recurringRules, transactions]);

  function handleConfirmDelete() {
    if (!pendingDelete || pendingDelete.entity !== "category") {
      return;
    }

    budgets
      .filter((budget) => budget.categoryId === pendingDelete.id)
      .forEach((budget) => deleteBudget(budget.id));
    transactions
      .filter((transaction) => transaction.categoryId === pendingDelete.id)
      .forEach((transaction) => deleteTransaction(transaction.id));
    recurringRules
      .filter((rule) => rule.categoryId === pendingDelete.id)
      .forEach((rule) => deleteRecurringRule(rule.id));
    deleteCategory(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <section className="page">
      <div className="page-header-copy">
        <h1 className="page-title">settings</h1>
        <p className="page-subtitle">
          app-level setup only: categories, backups, and reset actions.
        </p>
      </div>

      {deleteImpact ? (
        <DeleteImpactBanner
          deleteImpact={deleteImpact}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}

      <div className="page">
        <DataManagementSection
          accounts={accounts}
          categories={categories}
          transactions={transactions}
          budgets={budgets}
          recurringRules={recurringRules}
          replacePersistedState={replacePersistedState}
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

      <div className="section">
        <div className="section-heading">
          <h2 className="section-title">dev actions</h2>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => resetSeedData()}
            className="button button--primary"
          >
            reset seed data
          </button>
        </div>
      </div>
    </section>
  );
}
