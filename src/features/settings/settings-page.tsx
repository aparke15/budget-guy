import { useState, type ChangeEvent } from "react";

import { useAppStore } from "../../app/store";
import {
  buildPersistedStateSnapshot,
  downloadPersistedStateBackup,
  parsePersistedStateJson,
} from "../../app/storage";
import type { PersistedState } from "../../types";
import { SettingsSyncSection } from "./settings-sync-section";

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
    downloadPersistedStateBackup(
      buildPersistedStateSnapshot({
        accounts,
        categories,
        transactions,
        budgets,
        recurringRules,
      })
    );
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
  const replacePersistedState = useAppStore((state) => state.replacePersistedState);
  const resetSeedData = useAppStore((state) => state.resetSeedData);
  const snapshot = buildPersistedStateSnapshot({
    accounts,
    categories,
    transactions,
    budgets,
    recurringRules,
  });

  return (
    <section className="page">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">settings</h1>
          <p className="page-subtitle">
            local-first data utilities and optional cloud sync live here. categories,
            accounts, and recurring rules now have dedicated management areas.
          </p>
        </div>
      </div>

      <SettingsSyncSection
        snapshot={snapshot}
        replacePersistedState={replacePersistedState}
      />

      <DataManagementSection
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        budgets={budgets}
        recurringRules={recurringRules}
        replacePersistedState={replacePersistedState}
        resetSeedData={resetSeedData}
      />
    </section>
  );
}
