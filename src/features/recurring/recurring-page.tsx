import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { DeleteImpactBanner } from "../components/delete-impact-banner";
import {
  buildDeleteImpact,
  countById,
  sortItemsByName,
  type DeleteImpact,
  type PendingDelete,
} from "../shared/management-helpers";
import { RecurringRulesSection } from "./recurring-rules-section";

export function RecurringPage() {
  const accounts = useAppStore((state) => state.accounts);
  const categories = useAppStore((state) => state.categories);
  const budgets = useAppStore((state) => state.budgets);
  const transactions = useAppStore((state) => state.transactions);
  const recurringRules = useAppStore((state) => state.recurringRules);
  const addRecurringRule = useAppStore((state) => state.addRecurringRule);
  const updateRecurringRule = useAppStore((state) => state.updateRecurringRule);
  const deleteRecurringRule = useAppStore((state) => state.deleteRecurringRule);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const sortedAccounts = useMemo(() => sortItemsByName(accounts), [accounts]);
  const sortedCategories = useMemo(
    () => sortItemsByName(categories),
    [categories]
  );
  const sortedRecurringRules = useMemo(
    () => sortItemsByName(recurringRules),
    [recurringRules]
  );
  const generatedTransactionCounts = useMemo(
    () => countById(transactions, (transaction) => transaction.recurringRuleId),
    [transactions]
  );
  const deleteImpact = useMemo<DeleteImpact | null>(() => {
    return buildDeleteImpact(pendingDelete, budgets, transactions, recurringRules);
  }, [budgets, pendingDelete, recurringRules, transactions]);

  function handleConfirmDelete() {
    if (!pendingDelete || pendingDelete.entity !== "rule") {
      return;
    }

    deleteRecurringRule(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <section className="page">
      <div className="page-header-copy">
        <h1 className="page-title">recurring</h1>
        <p className="page-subtitle">
          rule ownership lives here. generation stays manual from the dashboard.
        </p>
      </div>

      {deleteImpact ? (
        <DeleteImpactBanner
          deleteImpact={deleteImpact}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}

      <RecurringRulesSection
        accounts={sortedAccounts}
        categories={sortedCategories}
        recurringRules={sortedRecurringRules}
        generatedTransactionCounts={generatedTransactionCounts}
        addRecurringRule={addRecurringRule}
        updateRecurringRule={updateRecurringRule}
        onRequestDelete={(rule) =>
          setPendingDelete({
            entity: "rule",
            id: rule.id,
            name: rule.name,
          })
        }
      />
    </section>
  );
}
