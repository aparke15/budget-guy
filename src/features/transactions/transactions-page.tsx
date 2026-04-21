import { useMemo, useState } from "react";

import { useAppStore } from "../../app/store";
import { getCurrentMonth, getMonthKey } from "../../lib/dates";
import { formatCents } from "../../lib/money";
import type { Transaction } from "../../types";
import { TransactionForm } from "./transaction-form";

export function TransactionsPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const transactions = useAppStore((state) => state.transactions);
  const categories = useAppStore((state) => state.categories);
  const accounts = useAppStore((state) => state.accounts);
  const addTransaction = useAppStore((state) => state.addTransaction);
  const updateTransaction = useAppStore((state) => state.updateTransaction);
  const deleteTransaction = useAppStore((state) => state.deleteTransaction);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) => getMonthKey(transaction.date) === month
      ),
    [month, transactions]
  );

  const editingTransaction = useMemo(
    () =>
      editingId
        ? transactions.find((transaction) => transaction.id === editingId)
        : undefined,
    [editingId, transactions]
  );

  function handleCreate(transaction: Transaction) {
    addTransaction(transaction);
    setShowCreateForm(false);
  }

  function handleUpdate(transaction: Transaction) {
    updateTransaction(transaction.id, transaction);
    setEditingId(null);
  }

  function handleDelete(transaction: Transaction) {
    const ok = window.confirm(
      `delete transaction for ${transaction.date} (${formatCents(
        transaction.amountCents
      )})?`
    );

    if (!ok) {
      return;
    }

    deleteTransaction(transaction.id);

    if (editingId === transaction.id) {
      setEditingId(null);
    }
  }

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>transactions</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280" }}>
            ledger first. glamour later.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <label
            style={{
              display: "grid",
              gap: "0.35rem",
              fontSize: "0.9rem",
              color: "#374151",
            }}
          >
            month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              style={{
                padding: "0.55rem 0.7rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                background: "#ffffff",
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setShowCreateForm((current) => !current);
              setEditingId(null);
            }}
            style={{
              padding: "0.7rem 0.95rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              background: "#111827",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            {showCreateForm ? "hide form" : "add transaction"}
          </button>
        </div>
      </div>

      {showCreateForm ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
            new transaction
          </h2>

          <TransactionForm
            accounts={accounts}
            categories={categories}
            submitLabel="save transaction"
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      ) : null}

      {editingTransaction ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
            edit transaction
          </h2>

          <TransactionForm
            accounts={accounts}
            categories={categories}
            initialTransaction={editingTransaction}
            submitLabel="update transaction"
            onSubmit={handleUpdate}
            onCancel={() => setEditingId(null)}
          />
        </div>
      ) : null}

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
        }}
      >
        <div style={{ marginBottom: "0.9rem", color: "#6b7280" }}>
          {filteredTransactions.length} transaction
          {filteredTransactions.length === 1 ? "" : "s"} in {month}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <th style={{ padding: "0.65rem 0.5rem" }}>date</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>merchant</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>category</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>account</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>source</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>amount</th>
                <th style={{ padding: "0.65rem 0.5rem" }}>actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  style={{ borderBottom: "1px solid #f3f4f6" }}
                >
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {transaction.date}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {transaction.merchant ?? "—"}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {categoryMap.get(transaction.categoryId)?.name ?? "unknown"}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {accountMap.get(transaction.accountId)?.name ?? "unknown"}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    {transaction.source}
                  </td>
                  <td
                    style={{
                      padding: "0.65rem 0.5rem",
                      color:
                        transaction.amountCents >= 0 ? "#166534" : "#991b1b",
                      fontWeight: 600,
                    }}
                  >
                    {formatCents(transaction.amountCents)}
                  </td>
                  <td style={{ padding: "0.65rem 0.5rem" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(transaction.id);
                          setShowCreateForm(false);
                        }}
                        style={{
                          padding: "0.45rem 0.65rem",
                          borderRadius: "0.45rem",
                          border: "1px solid #d1d5db",
                          background: "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(transaction)}
                        style={{
                          padding: "0.45rem 0.65rem",
                          borderRadius: "0.45rem",
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          color: "#991b1b",
                          cursor: "pointer",
                        }}
                      >
                        delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "1rem 0.5rem",
                      color: "#6b7280",
                    }}
                  >
                    no transactions for this month yet. suspiciously peaceful.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}