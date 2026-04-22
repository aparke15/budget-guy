import { useEffect, useState, type SubmitEvent } from "react";

import { formatCents } from "../../lib/money";
import type { Account, Category, RecurringRule } from "../../types";
import { RecurringRuleEditor } from "../components/editors/recurring-rule-editor";
import { buildDuplicateName } from "../shared/management-helpers";
import type { RecurringRuleFormValues } from "../types";
import {
  buildRecurringRuleCandidate,
  createRecurringRuleFormValues,
  ensureRecurringFormReferences,
  getRecurringDetails,
  updateRecurringFrequency,
  updateRecurringKind,
  updateRecurringStartDate,
} from "./recurring-helpers";

type RecurringRulesSectionProps = {
  accounts: Account[];
  categories: Category[];
  recurringRules: RecurringRule[];
  generatedTransactionCounts: Record<string, number>;
  addRecurringRule: (input: RecurringRule) => void;
  updateRecurringRule: (id: string, input: Partial<RecurringRule>) => void;
  onRequestDelete: (rule: RecurringRule) => void;
};

export function RecurringRulesSection(props: RecurringRulesSectionProps) {
  const {
    accounts,
    categories,
    recurringRules,
    generatedTransactionCounts,
    addRecurringRule,
    updateRecurringRule,
    onRequestDelete,
  } = props;
  const [createValues, setCreateValues] = useState<RecurringRuleFormValues>(() =>
    createRecurringRuleFormValues(accounts, categories)
  );
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<RecurringRuleFormValues>(() =>
    createRecurringRuleFormValues(accounts, categories)
  );
  const [editError, setEditError] = useState("");

  useEffect(() => {
    setCreateValues((current) =>
      ensureRecurringFormReferences(current, accounts, categories)
    );
  }, [accounts, categories]);

  useEffect(() => {
    if (!editingId) {
      return;
    }

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
    setCreateValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateEditField<K extends keyof RecurringRuleFormValues>(
    key: K,
    value: RecurringRuleFormValues[K]
  ) {
    setEditValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCreateSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    try {
      addRecurringRule(buildRecurringRuleCandidate(createValues, categories));
      setCreateValues(createRecurringRuleFormValues(accounts, categories));
    } catch (caught) {
      setCreateError(
        caught instanceof Error
          ? caught.message
          : "failed to save recurring rule"
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
        recurringRules.map((currentRule) => currentRule.name)
      ),
    });
    setCreateError("");
  }

  function handleEditSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingId) {
      return;
    }

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
        toAccountId: candidate.toAccountId,
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
        caught instanceof Error
          ? caught.message
          : "failed to save recurring rule"
      );
    }
  }

  return (
    <div className="section">
      <div className="section-heading">
        <h2 className="section-title">manage recurring rules</h2>
        <p className="section-subtitle">
          recurring rules stay manual-run. standard rules follow category sign; transfer rules generate linked transfer pairs.
        </p>
      </div>

      <RecurringRuleEditor
        values={createValues}
        error={createError}
        accounts={accounts}
        categories={categories}
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
          setCreateValues((current) => updateRecurringFrequency(current, frequency))
        }
        onStartDateChange={(startDate) =>
          setCreateValues((current) => updateRecurringStartDate(current, startDate))
        }
      />

      {accounts.length === 0 ? (
        <p className="empty-state">add at least one account before saving recurring rules.</p>
      ) : createValues.kind === "standard" && categories.length === 0 ? (
        <p className="empty-state">add at least one category before saving standard recurring rules.</p>
      ) : createValues.kind === "transfer" && accounts.length < 2 ? (
        <p className="empty-state">add at least two accounts before saving recurring transfer rules.</p>
      ) : null}

      <div className="record-list">
        {recurringRules.map((rule) => {
          const accountName =
            accounts.find((account) => account.id === rule.accountId)?.name ??
            "unknown account";
          const toAccountName =
            rule.kind === "transfer"
              ? accounts.find((account) => account.id === rule.toAccountId)?.name ??
                "unknown account"
              : null;
          const categoryMatch = categories.find(
            (category) => category.id === rule.categoryId
          );

          return editingId === rule.id ? (
            <div key={rule.id} className="record-item">
              <div className="full-width">
                <RecurringRuleEditor
                  values={editValues}
                  error={editError}
                  accounts={accounts}
                  categories={categories}
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
                    setEditValues((current) => updateRecurringFrequency(current, frequency))
                  }
                  onStartDateChange={(startDate) =>
                    setEditValues((current) => updateRecurringStartDate(current, startDate))
                  }
                  onCancel={() => {
                    setEditingId(null);
                    setEditValues(createRecurringRuleFormValues(accounts, categories));
                    setEditError("");
                  }}
                />
              </div>
            </div>
          ) : (
            <div key={rule.id} className="record-item">
              <div className="record-copy">
                <div className="record-title">{rule.name}</div>
                <div className="record-meta">
                  {rule.kind} · {formatCents(Math.abs(rule.amountCents))} · {getRecurringDetails(rule)}
                </div>
                <div className="record-detail">
                  {rule.kind === "transfer"
                    ? `${accountName} → ${toAccountName}`
                    : `${accountName} · ${categoryMatch?.name ?? "unknown category"} (${categoryMatch?.kind ?? "n/a"})`}
                </div>
                <div className="record-detail">
                  starts {rule.startDate}
                  {rule.endDate ? ` · ends ${rule.endDate}` : ""}
                  {rule.active ? " · active" : " · inactive"}
                </div>
                <div className="record-detail">
                  {generatedTransactionCounts[rule.id] ?? 0} generated transaction
                  {(generatedTransactionCounts[rule.id] ?? 0) === 1 ? "" : "s"} already in history
                </div>
              </div>

              <div className="action-group">
                <button
                  type="button"
                  onClick={() => startEditing(rule)}
                  className="button button--secondary button--small"
                >
                  edit
                </button>

                <button
                  type="button"
                  onClick={() => duplicateRule(rule)}
                  className="button button--secondary button--small"
                >
                  duplicate
                </button>

                <button
                  type="button"
                  onClick={() => onRequestDelete(rule)}
                  className="button button--danger button--small"
                >
                  delete
                </button>
              </div>
            </div>
          );
        })}

        {recurringRules.length === 0 ? <p className="empty-state">no recurring rules yet.</p> : null}
      </div>
    </div>
  );
}
