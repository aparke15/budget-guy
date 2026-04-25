import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type SubmitEvent,
} from "react";

import { useAppStore } from "../../app/store";
import {
  buildBackupFileName,
  buildPersistedStateSnapshot,
  exportPersistedStateJson,
  parsePersistedStateJson,
} from "../../app/storage";
import { createCategory } from "../../lib/factories";
import { isCategoryArchived } from "../../lib/categories";
import {
  countTransactionCategoryUsageByCategoryId,
} from "../../lib/transaction-splits";
import type { Category, PersistedState } from "../../types";
import { CategoryEditor } from "../components/editors";
import type { CategoryFormValues } from "../types";
import {
  buildDeleteImpact,
  countById,
  normalizeEntityName,
  sortItemsByName,
  type DeleteImpact,
  type PendingDelete,
} from "./settings-helpers";

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
  onRequestArchive: (category: Category) => void;
  onRestore: (categoryId: string) => void;
};

function CategoriesSection(props: CategoriesSectionProps) {
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
          <h2 className="section-title">categories</h2>
          <p className="section-subtitle">
            category setup stays lightweight here. archive categories to keep
            historical references intact while removing them from new-use pickers.
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

type DataManagementSectionProps = {
  accounts: PersistedState["accounts"];
  categories: PersistedState["categories"];
  transactions: PersistedState["transactions"];
  budgets: PersistedState["budgets"];
  recurringRules: PersistedState["recurringRules"];
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
    <div className="section-card stack-md">
      <div className="section-header">
        <div className="section-title-group">
          <h2 className="section-title">data management</h2>
          <p className="section-subtitle">
            export a full backup, import one to replace all current data, or reset
            back to seed data.
          </p>
        </div>
      </div>

      <div className="button-row">
        <button type="button" onClick={handleExport} className="button button--primary">
          export json backup
        </button>

        <label className="button button--secondary">
          import json backup
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            className="visually-hidden"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            if (window.confirm("reset all local data back to the demo seed?")) {
              resetSeedData();
              setImportError("");
              setImportSuccess("seed data restored");
            }
          }}
          className="button button--danger"
        >
          reset seed data
        </button>
      </div>

      <p className="muted-text">
        import never merges. valid backups replace accounts, categories,
        transactions, budgets, and recurring rules.
      </p>

      {importError ? <p className="message message--error">{importError}</p> : null}
      {importSuccess ? (
        <p className="message message--success">{importSuccess}</p>
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
  const archiveCategory = useAppStore((state) => state.archiveCategory);
  const unarchiveCategory = useAppStore((state) => state.unarchiveCategory);
  const replacePersistedState = useAppStore((state) => state.replacePersistedState);
  const resetSeedData = useAppStore((state) => state.resetSeedData);
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
          <h1 className="page-title">settings</h1>
          <p className="page-subtitle">
            categories and local data management stay here. account and recurring
            rule management moved to their own pages.
          </p>
        </div>
      </div>

      {deleteImpact ? (
        <div className="section-card section-card--danger">
          <div className="section-header">
            <div className="section-title-group">
              <h2 className="section-title">
                {deleteImpact.title}
              </h2>
              <p className="section-subtitle">
                {deleteImpact.description}
              </p>
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
