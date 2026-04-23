import type { RecurringGenerationSummary } from "../../types";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildRecurringGenerationMessage(summary: RecurringGenerationSummary): string {
  const parts = [
    `created ${pluralize(summary.createdTransactions, "transaction")}`,
    `including ${pluralize(summary.createdTransfers, "transfer pair")}`,
    `skipped ${pluralize(summary.duplicateOccurrences, "duplicate occurrence")}`,
  ];

  return `${parts.join(", ")}.`;
}

export function RecurringGenerationFeedback(props: {
  summary: RecurringGenerationSummary;
  showRuleBreakdown?: boolean;
}) {
  const { summary, showRuleBreakdown = false } = props;

  return (
    <div
      className="section-card section-card--surface"
      style={{
        borderColor:
          summary.createdTransactions > 0
            ? "var(--color-accent-border)"
            : "var(--border-strong)",
        background:
          summary.createdTransactions > 0
            ? "var(--color-accent-surface)"
            : "var(--bg-subtle)",
      }}
    >
      <div className="section-header">
        <div className="section-title-group">
          <h2 className="section-title">last recurring run</h2>
          <p className="section-subtitle">{summary.month}</p>
        </div>

        <div className="badge-row">
          <span className="badge badge--recurring">
            {pluralize(summary.createdTransactions, "transaction")}
          </span>
          <span className="badge badge--transfer">
            {pluralize(summary.createdTransfers, "transfer pair")}
          </span>
          <span className="badge badge--muted">
            {pluralize(summary.duplicateOccurrences, "duplicate")}
          </span>
        </div>
      </div>

      <p
        className="message-box"
        style={{
          marginTop: "0.9rem",
          borderColor:
            summary.createdTransactions > 0
              ? "var(--color-accent-border)"
              : "var(--border-strong)",
          background:
            summary.createdTransactions > 0
              ? "var(--color-accent-surface-strong)"
              : "var(--bg-muted)",
          color: "var(--text-default)",
        }}
      >
        {buildRecurringGenerationMessage(summary)}
      </p>

      {showRuleBreakdown && summary.ruleResults.length > 0 ? (
        <div className="stack-sm">
          <div className="section-subtitle" style={{ marginBottom: "0.5rem" }}>
            by rule
          </div>
          <ul className="list-compact list-compact--tight">
            {summary.ruleResults.map((result) => (
              <li key={result.recurringRuleId}>
                {result.ruleName}: created {pluralize(result.createdTransactions, "transaction")}
                {result.createdTransfers > 0
                  ? ` (${pluralize(result.createdTransfers, "transfer pair")})`
                  : ""}
                {result.duplicateOccurrences > 0
                  ? `, skipped ${pluralize(result.duplicateOccurrences, "duplicate occurrence")}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}