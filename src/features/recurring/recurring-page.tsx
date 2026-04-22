import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import { useAppStore } from "../../app/store";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import {
  buildDuplicateName,
  countById,
  sortItemsByName,
  type PendingDelete,
  type DeleteImpact,
  buildDeleteImpact,
} from "../settings/settings-helpers";
import {
  buildRecurringRuleCandidate,
  createRecurringRuleFormValues,
  ensureRecurringFormReferences,
  getRecurringDetails,
  updateRecurringFrequency,
  updateRecurringKind,
  updateRecurringStartDate,
} from "./recurring-helpers";
import type { RecurringRuleFormValues } from "../types";
import type { RecurringRule } from "../../types";
import { RecurringRuleEditor } from "../components/editors";
import {
  cardStyle,
  dangerButtonStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "../components/style-constants";

export function RecurringPage() {
  const accounts = useAppStore((state) => state.accounts);
  const categories = useAppStore((state) => state.categories);
  const transactions = useAppStore((state) => state.transactions);
  const budgets = useAppStore((state) => state.budgets);
  const recurringRules = useAppStore((state) => state.recurringRules);
  const addRecurringRule = useAppStore((state) => state.addRecurringRule);
  const updateRecurringRule = useAppStore((state) => state.updateRecurringRule);
  const deleteRecurringRule = useAppStore((state) => state.deleteRecurringRule);
  const generateRecurringForMonth = useAppStore(
    (state) => state.generateRecurringForMonth
  );

  const [generateMonth, setGenerateMonth] = useState(getCurrentMonth);

  const [createValues, setCreateValues] = useState<RecurringRuleFormValues>(() =>
    createRecurringRuleFormValues(accounts, categories)
  );
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<RecurringRuleFormValues>(() =>
    createRecurringRuleFormValues(accounts, categories)
  );
  const [editError, setEditError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const sortedAccounts = useMemo(() => sortItemsByName(accounts), [accounts]);
  const sortedCategories = useMemo(() => sortItemsByName(categories), [categories]);
  const sortedRules = useMemo(() => sortItemsByName(recurringRules), [recurringRules]);

  const generatedTransactionCounts = useMemo(
    () => countById(transactions, (t) => t.recurringRuleId),
    [transactions]
  );

  const deleteImpact = useMemo<DeleteImpact | null>(
    () => buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules),
    [budgets, pendingDelete, recurringRules, transactions]
  );

  useEffect(() => {
    setCreateValues((current) =>
      ensureRecurringFormReferences(current, accounts, categories)
    );
  }, [accounts, categories]);

  useEffect(() => {
    if (!editingId) return;

    const currentRule = recurringRules.find((rule) => rule.id === editingId);

    if (!currentRule) {
      setEditingId(null);
      setEditValues(createRecurringRuleFormValues(accounts, categories));
      setEditError("");
      return;
    }

    setEditValues((current) =>
      ensureRecurringFormReferences(current, accounts, categories)
    );
  }, [accounts, categories, editingId, recurringRules]);

  function updateCreateField<K extends keyof RecurringRuleFormValues>(
    key: K,
    value: RecurringRuleFormValues[K]
  ) {
    setCreateValues((current) => ({ ...current, [key]: value }));
  }

  function updateEditField<K extends keyof RecurringRuleFormValues>(
    key: K,
    value: RecurringRuleFormValues[K]
  ) {
    setEditValues((current) => ({ ...current, [key]: value }));
  }

  function handleCreateSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    try {
      addRecurringRule(buildRecurringRuleCandidate(createValues, categories));
      setCreateValues(createRecurringRuleFormValues(accounts, categories));
    } catch (caught) {
      setCreateError(
        caught instanceof Error ? caught.message : "failed to save recurring rule"
      );
    }
  }

  function startEditing(rule: RecurringRule) {
    setEditingId(rule.id);
    setEditValues(createRecurringRuleFormValues(accounts, categories, rule));
    setEditError("");
  }

  function duplicateRule(rule: RecurringRule) {
    const duplicateValues = createRecurringRuleFormValues(accounts, categories, rule);
    setCreateValues({
      ...duplicateValues,
      name: buildDuplicateName(
        rule.name,
        recurringRules.map((r) => r.name)
      ),
    });
    setCreateError("");
  }

  function handleEditSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingId) return;

    const existingRule = recurringRules.find((rule) => rule.id === editingId);

    if (!existingRule) {
      setEditError("recurring rule no longer exists");
      return;
    }

    setEditError("");

    try {
      const candidate = buildRecurringRuleCandidate(
        editValues,
        categories,
        existingRule
      );

      updateRecurringRule(editingId, {
        name: candidate.name,
        amountCents: candidate.amountCents,
        accountId: candidate.accountId,
        categoryId: candidate.categoryId,
        merchant: candidate.merchant,
        note: candidate.note,
        frequency: candidate.frequency,
        startDate: candidate.startDate,
        endDate: candidate.endDate,
        active: candidate.active,
        dayOfMonth: candidate.dayOfMonth,
        dayOfWeek: candidate.dayOfWeek,
      });
      setEditingId(null);
      setEditValues(createRecurringRuleFormValues(accounts, categories));
    } catch (caught) {
      setEditError(
        caught instanceof Error ? caught.message : "failed to save recurring rule"
      );
    }
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;

    if (pendingDelete.entity === "rule") {
      deleteRecurringRule(pendingDelete.id);
    }

    setPendingDelete(null);
  }

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>recurring</h1>
          <p>
            rules stay manual-run. standard rules follow category sign; transfer
            rules generate linked transfer pairs.
          </p>
        </div>

        <div className="page-actions">
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.9rem", color: "#374151" }}>
            generate for month
            <div className="toolbar">
              <input
                type="month"
                value={generateMonth}
                onChange={(e) => setGenerateMonth(e.target.value)}
                style={{
                  padding: "0.55rem 0.7rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  fontSize: "1rem",
                }}
              />
              <button
                type="button"
                onClick={() => generateRecurringForMonth(generateMonth)}
                style={primaryButtonStyle}
                disabled={!generateMonth}
              >
                generate
              </button>
            </div>
          </label>
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

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
          recurring rules ({recurringRules.length})
        </h2>

        <div style={{ display: "grid", gap: "0.9rem" }}>
          <RecurringRuleEditor
            values={createValues}
            error={createError}
            accounts={sortedAccounts}
            categories={sortedCategories}
            submitLabel="add recurring rule"
            submitDisabled={
              accounts.length === 0 ||
              (createValues.kind === "standard" && categories.length === 0) ||
              (createValues.kind === "transfer" && accounts.length < 2)
            }
            onSubmit={handleCreateSubmit}
            onChange={updateCreateField}
            onKindChange={(kind) =>
              setCreateValues((current) =>
                updateRecurringKind(current, kind, accounts, categories)
              )
            }
            onFrequencyChange={(frequency) =>
              setCreateValues((current) =>
                updateRecurringFrequency(current, frequency)
              )
            }
            onStartDateChange={(startDate) =>
              setCreateValues((current) =>
                updateRecurringStartDate(current, startDate)
              )
            }
          />

          {accounts.length === 0 ? (
            <p className="empty-state">
              add at least one account before saving recurring rules.
            </p>
          ) : createValues.kind === "standard" && categories.length === 0 ? (
            <p className="empty-state">
              add at least one category before saving standard recurring rules.
            </p>
          ) : createValues.kind === "transfer" && accounts.length < 2 ? (
            <p className="empty-state">
              add at least two accounts before saving recurring transfer rules.
            </p>
          ) : null}

          <div style={{ display: "grid", gap: "0.75rem" }}>
            {sortedRules.map((rule) => {
              const accountName =
                accounts.find((a) => a.id === rule.accountId)?.name ??
                "unknown account";
              const toAccountName =
                rule.kind === "transfer"
                  ? accounts.find((a) => a.id === rule.toAccountId)?.name ??
                    "unknown account"
                  : null;
              const categoryMatch = categories.find(
                (c) => c.id === rule.categoryId
              );

              return editingId === rule.id ? (
                <div key={rule.id} className="entity-edit-wrapper">
                  <RecurringRuleEditor
                    values={editValues}
                    error={editError}
                    accounts={sortedAccounts}
                    categories={sortedCategories}
                    submitLabel="save recurring rule"
                    submitDisabled={
                      accounts.length === 0 ||
                      (editValues.kind === "standard" && categories.length === 0) ||
                      (editValues.kind === "transfer" && accounts.length < 2)
                    }
                    onSubmit={handleEditSubmit}
                    onChange={updateEditField}
                    onKindChange={(kind) =>
                      setEditValues((current) =>
                        updateRecurringKind(current, kind, accounts, categories)
                      )
                    }
                    onFrequencyChange={(frequency) =>
                      setEditValues((current) =>
                        updateRecurringFrequency(current, frequency)
                      )
                    }
                    onStartDateChange={(startDate) =>
                      setEditValues((current) =>
                        updateRecurringStartDate(current, startDate)
                      )
                    }
                    onCancel={() => {
                      setEditingId(null);
                      setEditValues(createRecurringRuleFormValues(accounts, categories));
                      setEditError("");
                    }}
                  />
                </div>
              ) : (
                <div key={rule.id} className="entity-row">
                  <div className="entity-row__body">
                    <div className="entity-row__name">{rule.name}</div>
                    <div className="entity-row__meta">
                      <span
                        className={`badge badge--${rule.kind === "transfer" ? "transfer" : categoryMatch?.kind === "income" ? "income" : "expense"}`}
                      >
                        {rule.kind}
                      </span>{" "}
                      <span className="badge badge--neutral">
                        {rule.active ? "active" : "inactive"}
                      </span>
                    </div>
                    <div className="entity-row__meta">
                      {formatCents(Math.abs(rule.amountCents))} ·{" "}
                      {getRecurringDetails(rule)}
                    </div>
                    <div className="entity-row__meta">
                      {rule.kind === "transfer"
                        ? `${accountName} → ${toAccountName}`
                        : `${accountName} · ${categoryMatch?.name ?? "unknown category"} (${categoryMatch?.kind ?? "n/a"})`}
                    </div>
                    <div className="entity-row__meta">
                      starts {rule.startDate}
                      {rule.endDate ? ` · ends ${rule.endDate}` : ""}
                    </div>
                    <div className="entity-row__stats">
                      {generatedTransactionCounts[rule.id] ?? 0} generated transaction
                      {(generatedTransactionCounts[rule.id] ?? 0) === 1 ? "" : "s"} in history
                    </div>
                  </div>
                  <div className="entity-row__actions">
                    <button
                      type="button"
                      onClick={() => startEditing(rule)}
                      style={secondaryButtonStyle}
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateRule(rule)}
                      style={secondaryButtonStyle}
                    >
                      duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({
                          entity: "rule",
                          id: rule.id,
                          name: rule.name,
                        })
                      }
                      style={dangerButtonStyle}
                    >
                      delete
                    </button>
                  </div>
                </div>
              );
            })}

            {recurringRules.length === 0 ? (
              <p className="empty-state">no recurring rules yet.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
