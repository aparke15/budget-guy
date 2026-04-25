// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TransactionForm } from "./transaction-form";
import type { Account, Category, Transaction } from "../../types";

const accounts: Account[] = [
  {
    id: "acct-checking",
    name: "checking",
    type: "checking",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

const categories: Category[] = [
  {
    id: "cat-active",
    name: "groceries",
    kind: "expense",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "cat-archived",
    name: "old dining",
    kind: "expense",
    archivedAt: "2026-04-10T00:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
  },
  {
    id: "cat-active-split",
    name: "household",
    kind: "expense",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

function getOptionTexts(select: HTMLSelectElement) {
  return Array.from(select.options).map((option) => option.text);
}

afterEach(() => {
  cleanup();
});

describe("transaction form archived-category behavior", () => {
  it("excludes archived categories from new standard transaction pickers by default", () => {
    render(
      <TransactionForm
        accounts={accounts}
        categories={categories}
        submitLabel="save transaction"
        onSubmit={() => {}}
      />
    );

    const categorySelect = screen.getByLabelText("category") as HTMLSelectElement;

    expect(getOptionTexts(categorySelect)).toEqual([
      "select category",
      "groceries",
      "household",
    ]);
    expect(getOptionTexts(categorySelect)).not.toContain("old dining (archived)");
  });

  it("keeps an already-linked archived category visible in standard transaction edit mode", () => {
    const transaction: Transaction = {
      id: "txn-1",
      kind: "standard",
      date: "2026-04-12",
      amountCents: -4200,
      accountId: "acct-checking",
      categoryId: "cat-archived",
      merchant: "Cafe",
      source: "manual",
      createdAt: "2026-04-12T00:00:00.000Z",
      updatedAt: "2026-04-12T00:00:00.000Z",
    };

    render(
      <TransactionForm
        accounts={accounts}
        categories={categories}
        initialState={{ mode: "standard", transaction }}
        submitLabel="save transaction"
        onSubmit={() => {}}
      />
    );

    const categorySelect = screen.getByLabelText("category") as HTMLSelectElement;

    expect(categorySelect.value).toBe("cat-archived");
    expect(getOptionTexts(categorySelect)).toContain("old dining (archived)");
  });

  it("keeps archived split categories already in use visible in split edit mode", () => {
    const transaction: Transaction = {
      id: "txn-split",
      kind: "standard",
      date: "2026-04-12",
      amountCents: -4200,
      accountId: "acct-checking",
      splits: [
        {
          id: "split-1",
          categoryId: "cat-archived",
          amountCents: -2000,
          note: "legacy",
        },
        {
          id: "split-2",
          categoryId: "cat-active-split",
          amountCents: -2200,
          note: "current",
        },
      ],
      merchant: "Market",
      source: "manual",
      createdAt: "2026-04-12T00:00:00.000Z",
      updatedAt: "2026-04-12T00:00:00.000Z",
    };

    render(
      <TransactionForm
        accounts={accounts}
        categories={categories}
        initialState={{ mode: "standard", transaction }}
        submitLabel="save transaction"
        onSubmit={() => {}}
      />
    );

    const splitCategoryOne = screen.getByLabelText("category 1") as HTMLSelectElement;
    const splitCategoryTwo = screen.getByLabelText("category 2") as HTMLSelectElement;

    expect(splitCategoryOne.value).toBe("cat-archived");
    expect(getOptionTexts(splitCategoryOne)).toContain("old dining (archived)");
    expect(splitCategoryTwo.value).toBe("cat-active-split");
    expect(getOptionTexts(splitCategoryTwo)).toContain("old dining (archived)");
  });
});