import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import { useAppStore } from "../../app/store";
import { getCurrentMonth } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import {
  buildDeleteImpact,
  buildDuplicateName,
  countById,
  sortItemsByName,
  type DeleteImpact,
  type PendingDelete,
} from "../settings/settings-helpers";
import type { RecurringRuleFormValues } from "../types";
import { RecurringRuleEditor } from "../components/editors";
import {
  compactDangerButtonStyle,
  compactSecondaryButtonStyle,
  dangerButtonStyle,
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "../components/style-constants";
import {
  buildRecurringRuleCandidate,
  createRecurringRuleFormValues,
  ensureRecurringFormReferences,
  getRecurringDetails,
  updateRecurringFrequency,
  updateRecurringKind,
  updateRecurringStartDate,
} from "./recurring-helpers";
import { RecurringGenerationFeedback } from "./recurring-generation-feedback";

function getRuleKindBadgeClass(kind: RecurringRuleFormValues["kind"] | "standard" | "transfer") {
  return kind === "transfer" ? "badge badge--transfer" : "badge badge--recurring";
}

export function RecurringManagementSection() {
  const accounts = useAppStore((state) => state.accounts);
  const categories = useAppStore((state) => state.categories);
  const transactions = useAppStore((state) => state.transactions);
  const budgets = useAppStore((state) => state.budgets);
  const recurringRules = useAppStore((state) => state.recurringRules);
  const addRecurringRule = useAppStore((state) => state.addRecurringRule);
  const updateRecurringRule = useAppStore((state) => state.updateRecurringRule);
  const deleteRecurringRule = useAppStore((state) => state.deleteRecurringRule);
  const generateRecurringForRange = useAppStore(
    (state) => state.generateRecurringForRange
  );
  const generationSummary = useAppStore(
    (state) => state.lastRecurringGenerationSummary
  );

  const [startMonth, setStartMonth] = useState(getCurrentMonth());
  const [monthCount, setMonthCount] = useState("12");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [createValues, setCreateValues] = useState<RecurringRuleFormValues>(() =>
    createRecurringRuleFormValues(accounts, categories)
  );
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<RecurringRuleFormValues>(() =>
    createRecurringRuleFormValues(accounts, categories)
  );
  const [editError, setEditError] = useState("");

  const sortedAccounts = useMemo(() => sortItemsByName(accounts), [accounts]);
  const sortedCategories = useMemo(() => sortItemsByName(categories), [categories]);
  const sortedRecurringRules = useMemo(
    () => sortItemsByName(recurringRules),
    [recurringRules]
  );

  const generatedTransactionCounts = useMemo(
    () => countById(transactions, (transaction) => transaction.recurringRuleId),
    [transactions]
  );

  const activeRuleCount = useMemo(
    () => recurringRules.filter((rule) => rule.active).length,
    [recurringRules]
  );

  const deleteImpact = useMemo<DeleteImpact | null>(
    () => buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules),
    [budgets, pendingDelete, recurringRules, transactions]
  );

  useEffect(() => {
    setCreateValues((current) =>
      ensureRecurringFormReferences(current, sortedAccounts, sortedCategories)
    );
  }, [sortedAccounts, sortedCategories]);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    const currentRule = recurringRules.find((rule) => rule.id === editingId);

    if (!currentRule) {
      setEditingId(null);
      setEditValues(createRecurringRuleFormValues(sortedAccounts, sortedCategories));
      setEditError("");
      return;
    }

    setEditValues((current) =>
      ensureRecurringFormReferences(current, sortedAccounts, sortedCategories)
    );
  }, [editingId, recurringRules, sortedAccounts, sortedCategories]);

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

  function startEditing(ruleId: string) {
    const rule = recurringRules.find((currentRule) => currentRule.id === ruleId);

    if (!rule) {
      return;
    }

    setEditingId(rule.id);
    setEditValues(createRecurringRuleFormValues(sortedAccounts, sortedCategories, rule));
    setEditError("");
  }

  function handleCreateSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    try {
      addRecurringRule(buildRecurringRuleCandidate(createValues, sortedCategories));
      setCreateValues(createRecurringRuleFormValues(sortedAccounts, sortedCategories));
    } catch (caught) {
      setCreateError(
        caught instanceof Error ? caught.message : "failed to save recurring transaction"
      );
    }
  }

  function duplicateRule(ruleId: string) {
    const rule = recurringRules.find((currentRule) => currentRule.id === ruleId);

    if (!rule) {
      return;
    }

    const duplicateValues = createRecurringRuleFormValues(
      sortedAccounts,
      sortedCategories,
      rule
    );

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
      setEditError("recurring transaction no longer exists");
      return;
    }

    setEditError("");

    try {
      const candidate = buildRecurringRuleCandidate(
        editValues,
        sortedCategories,
        existingRule
      );

      updateRecurringRule(editingId, {
        kind: candidate.kind,
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
      setEditValues(createRecurringRuleFormValues(sortedAccounts, sortedCategories));
    } catch (caught) {
      setEditError(
        caught instanceof Error ? caught.message : "failed to save recurring transaction"
      );
    }
  }

  function handleConfirmDelete() {
    if (!pendingDelete || pendingDelete.entity !== "rule") {
      return;
    }

    deleteRecurringRule(pendingDelete.id);
    setPendingDelete(null);

    if (editingId === pendingDelete.id) {
      setEditingId(null);
    }
  }

  function handleGenerateRecurring() {
    const parsedMonthCount = Number.parseInt(monthCount, 10);

    generateRecurringForRange(
      startMonth,
      Number.isInteger(parsedMonthCount) && parsedMonthCount > 0
        ? parsedMonthCount
        : 12
    );
  }

  return (
    <div className="stack-md">
      <div className="section-card section-card--surface stack-md">
        <div className="section-header">
          <div className="section-title-group">
            <h2 className="section-title">recurring transactions</h2>
            <p className="section-subtitle">
              save recurring blueprints next to the ledger, then generate a selected
              range into real transactions when you want them.
            </p>
          </div>

          <div className="page-actions">
            <label className="field field--medium">
              <span className="field__label">start month</span>
              <input
                type="month"
                value={startMonth}
                onChange={(event) => setStartMonth(event.target.value)}
                style={inputStyle}
              />
            </label>

            <label className="field field--compact">
              <span className="field__label">months</span>
              <input
                type="number"
                min="1"
                step="1"
                value={monthCount}
                onChange={(event) => setMonthCount(event.target.value)}
                style={inputStyle}
              />
            </label>

            <button
              type="button"
              onClick={handleGenerateRecurring}
              style={primaryButtonStyle}
            >
              generate recurring range
            </button>
          </div>
        </div>

        {generationSummary ? (
          <RecurringGenerationFeedback
            summary={generationSummary}
            showRuleBreakdown
          />
        ) : null}

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-card__label">rules</div>
            <div className="summary-card__value">{recurringRules.length}</div>
          </div>
          <div className="summary-card summary-card--good">
            <div className="summary-card__label">active rules</div>
            <div className="summary-card__value">{activeRuleCount}</div>
          </div>
          <div className="summary-card summary-card--info">
            <div className="summary-card__label">generated transactions</div>
            <div className="summary-card__value">
              {Object.values(generatedTransactionCounts).reduce(
                (total, count) => total + count,
                0
              )}
            </div>
          </div>
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
              <button type="button" onClick={handleConfirmDelete} style={dangerButtonStyle}>
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
        </div>
      ) : null}

      <div className="section-card stack-md">
        <div className="section-header">
          <div className="section-title-group">
            <h2 className="section-title">transaction templates</h2>
            <p className="section-subtitle">
              recurring stays a `RecurringRule` behind the scenes, but the editor is
              shaped like a transaction with cadence.
            </p>
          </div>
        </div>

        <RecurringRuleEditor
          values={createValues}
          error={createError}
          accounts={sortedAccounts}
          categories={sortedCategories}
          submitLabel="add recurring transaction"
          submitDisabled={
            sortedAccounts.length === 0 ||
            (createValues.kind === "standard" && sortedCategories.length === 0) ||
            (createValues.kind === "transfer" && sortedAccounts.length < 2)
          }
          onSubmit={handleCreateSubmit}
          onChange={updateCreateField}
          onKindChange={(kind) =>
            setCreateValues((current) =>
              updateRecurringKind(current, kind, sortedAccounts, sortedCategories)
            )
          }
          onFrequencyChange={(frequency) =>
            setCreateValues((current) => updateRecurringFrequency(current, frequency))
          }
          onStartDateChange={(startDate) =>
            setCreateValues((current) => updateRecurringStartDate(current, startDate))
          }
        />

        {sortedAccounts.length === 0 ? (
          <p className="empty-state">
            add at least one account before saving recurring transactions.
          </p>
        ) : createValues.kind === "standard" && sortedCategories.length === 0 ? (
          <p className="empty-state">
            add at least one category before saving standard recurring transactions.
          </p>
        ) : createValues.kind === "transfer" && sortedAccounts.length < 2 ? (
          <p className="empty-state">
            add at least two accounts before saving recurring transfers.
          </p>
        ) : null}

        <div className="entity-list">
          {sortedRecurringRules.map((rule) => {
            const accountName =
              sortedAccounts.find((account) => account.id === rule.accountId)?.name ??
              "unknown account";
            const toAccountName =
              rule.kind === "transfer"
                ? sortedAccounts.find((account) => account.id === rule.toAccountId)?.name ??
                  "unknown account"
                : null;
            const categoryMatch = sortedCategories.find(
              (category) => category.id === rule.categoryId
            );

            return editingId === rule.id ? (
              <div key={rule.id} className="entity-card">
                <div className="full-width">
                  <RecurringRuleEditor
                    values={editValues}
                    error={editError}
                    accounts={sortedAccounts}
                    categories={sortedCategories}
                    submitLabel="save recurring transaction"
                    submitDisabled={
                      sortedAccounts.length === 0 ||
                      (editValues.kind === "standard" &&
                        sortedCategories.length === 0) ||
                      (editValues.kind === "transfer" && sortedAccounts.length < 2)
                    }
                    onSubmit={handleEditSubmit}
                    onChange={updateEditField}
                    onKindChange={(kind) =>
                      setEditValues((current) =>
                        updateRecurringKind(
                          current,
                          kind,
                          sortedAccounts,
                          sortedCategories
                        )
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
                      setEditValues(
                        createRecurringRuleFormValues(sortedAccounts, sortedCategories)
                      );
                      setEditError("");
                    }}
                  />
                </div>
              </div>
            ) : (
              <div key={rule.id} className="entity-card">
                <div className="entity-card__body">
                  <div className="entity-card__title">
                    <span>{rule.name}</span>
                    <span className={getRuleKindBadgeClass(rule.kind)}>{rule.kind}</span>
                    <span className={rule.active ? "badge badge--success" : "badge badge--muted"}>
                      {rule.active ? "active" : "inactive"}
                    </span>
                  </div>

                  <div className="badge-row">
                    <span className="badge badge--neutral">{rule.frequency}</span>
                    <span className="badge badge--recurring">{getRecurringDetails(rule)}</span>
                    <span className="badge badge--neutral">
                      {formatCents(Math.abs(rule.amountCents))}
                    </span>
                  </div>

                  <div className="entity-card__meta">
                    {rule.kind === "transfer"
                      ? `${accountName} → ${toAccountName}`
                      : `${accountName} · ${categoryMatch?.name ?? "unknown category"} (${categoryMatch?.kind ?? "n/a"})`}
                  </div>
                  <div className="entity-card__meta">
                    starts {rule.startDate}
                    {rule.endDate ? ` · ends ${rule.endDate}` : ""}
                  </div>
                  <div className="entity-card__meta">
                    {generatedTransactionCounts[rule.id] ?? 0} generated transaction
                    {(generatedTransactionCounts[rule.id] ?? 0) === 1 ? "" : "s"} already in activity
                  </div>
                </div>

                <div className="table-actions">
                  <button
                    type="button"
                    onClick={() => startEditing(rule.id)}
                    style={compactSecondaryButtonStyle}
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateRule(rule.id)}
                    style={compactSecondaryButtonStyle}
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
                    style={compactDangerButtonStyle}
                  >
                    delete
                  </button>
                </div>
              </div>
            );
          })}

          {sortedRecurringRules.length === 0 ? (
            <p className="empty-state">
              no recurring transactions yet. add one here, then generate a range when
              you want real ledger activity.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
