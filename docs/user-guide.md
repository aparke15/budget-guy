# User guide

## 1. Overview

Budget MVP is a local-first personal budgeting app for tracking transactions, transfers, account balances, monthly category budgets, forecasts, and month-by-month progress.

What it does today:
- Lets you manage your own accounts, categories, transactions, budgets, and recurring rules.
- Lets you track balances on checking, savings, cash, and credit accounts.
- Lets you move money between accounts with linked transfer entries.
- Lets you split a standard transaction across multiple reporting categories.
- Lets you keep opening balances as special transactions tied to accounts.
- Lets you review account history and a recurring-based forecast.
- Stores data in your browser's local storage on this device.
- Uses transactions as the source of truth for actual money movement.
- Lets you generate recurring transactions manually for a selected month range.
- Lets you export a JSON backup and import a replacement backup.
- Lets you optionally sign in with a magic email link for explicit cross-device snapshot sync.
- Lets you explicitly push local data to the cloud, pull cloud data to this device, or sync now.
- Lets you switch between light and dark mode, with your preference saved on this device.
   - If you have not chosen a theme yet, the app follows your system preference on first load.

Important rules to know:
- You enter money as normal currency values like `12.34`, but the app stores amounts internally as integer cents.
- Positive amounts are income.
- Negative amounts are expenses.
- On forms, you usually enter a positive number and the app applies the sign based on the type you choose.
- Transfers are stored as a linked negative/positive pair between two accounts.
- Opening balances are stored as special transactions, not as mutable account fields.
- Budgets are monthly planned amounts per category.
- Only expense categories appear on the budget page.
- Archived categories stay valid for history and edits, but are hidden from new-use pickers by default.
- Recurring rules are templates. They do not change your totals until you generate real transactions from them.
- Credit cards use the same ledger model as every other account.
   - Negative ledger balance on a credit account means money owed.
   - Positive payments, refunds, and transfers into a credit account reduce what is owed.

## 2. Quick start

Recommended first-time setup:
1. Open **Accounts**.
2. Add your accounts, such as checking, savings, cash, or credit card.
   - You can optionally set an opening balance and date.
   - For credit accounts, you can optionally set a credit limit.
3. Open **Categories** and add your categories.
   - Use **income** categories for paychecks or other income.
   - Use **expense** categories for spending categories like rent, groceries, or dining.
   - Archive categories you no longer want to assign to new activity instead of deleting history.
4. If you have repeating income or bills, add recurring rules in the **Recurring** subview inside **Transactions**.
5. Open **Transactions** and start recording real transactions or transfers.
6. Open **Budget** and enter planned monthly amounts for your expense categories.
7. Use **Accounts** to review balances and account history.
8. Use **Forecast** to review projected balances from recurring rules.
9. Use **Dashboard** to review the month and manually generate recurring transactions when needed.
10. Open **Settings** if you want to export/import backups, reset seed data, or optionally enable cloud sync with a magic link.
11. Use the header theme toggle if you prefer light or dark mode.

If there is no saved data yet, the app starts with demo seed data so you can see how it works.

## 3. Recommended monthly workflow

Use this order each month:

1. **Check your setup in Accounts, Categories, and Transactions > Recurring**
   - Make sure the accounts and categories you need already exist.
   - Add or update opening balances if you are starting from an existing real-world balance.
   - Add a credit limit for credit accounts if you want available-credit display.
   - Add or update recurring rules before the month gets busy.

2. **Generate recurring transactions for the month range you need**
   - Go to **Dashboard**.
   - Pick the start month and month count.
   - Click **generate recurring**.
   - This creates real transactions for active recurring rules that match the selected range.
   - The app prevents duplicate recurring transactions for the same rule on the same date.

3. **Record manual transactions as they happen**
   - Go to **Transactions**.
   - Add income, expense, transfer, and split transactions.
   - Choose the correct account, category, date, and optional merchant or note.
   - Edit or delete transactions if you made a mistake.

4. **Set or update monthly budgets**
   - Go to **Budget**.
   - Pick the month.
   - Enter planned amounts for each expense category.
   - Save individual rows or use **save all budgets**.

5. **Review progress on the dashboard**
   - Check income, expenses, net, and unassigned for the month.
   - Review over-budget categories.
   - Review the recent transactions list.

6. **Review account health**
   - Open **Accounts** to see current balances and recent monthly history.
   - Open **Forecast** to see how recurring activity may affect balances in future months.

7. **Adjust during the month**
   - Add missed transactions.
   - Update budgets if your plan changes.
   - Generate recurring transactions again later in the month if additional rule dates have become due.

## 4. Page-by-page guide

### Dashboard

Use the dashboard for a month-level snapshot.

What you can do:
- Pick a month.
- See summary cards for:
  - **income**
  - **expenses**
  - **net**
  - **unassigned**
- See an **over budget** list for categories that have spent more than planned.
- See a **category snapshot** comparing spent vs planned amounts.
- See a **recent transactions** table.
- Click **generate recurring** for the selected month.

How to read the numbers:
- **Income** is the total of positive transactions in that month.
- **Expenses** is the total of negative transactions in that month, shown as a positive spending total.
- **Net** is income minus expenses.
- **Unassigned** is income minus planned budget amounts for that month.
  - This is about how much income has not been assigned to budgets yet.
  - It is not the same thing as account balance.

Recurring action on this page:
- The dashboard is where recurring rules turn into real transactions.
- Clicking **generate recurring** only creates transactions for active rules that match the selected month and date pattern.
- Rules do not run automatically in the background.

Current caveat:
- The recent transactions list shows the latest transactions overall, not only transactions from the selected month.

### Accounts

Use the accounts page to review ledger-derived balances and monthly history.

What you can do:
- See all accounts in a current balances table.
- Add, edit, and delete accounts inline.
- Click an account to review its monthly history.
- Switch history range between **last 6 months**, **last 12 months**, and **all**.
- Set or update optional opening balances and opening balance dates.
- Set or update optional credit limits for credit accounts.

How to read balances:
- Every account shows a signed **balance**.
   - Positive values are shown in green.
   - Negative values are shown in red.
   - Zero stays in the default text color.
- If a credit account has a credit limit, the page also shows:
   - **limit**
   - **available credit**

How to read history:
- **Inflows** are positive amounts into that account.
- **Outflows** are negative amounts out of that account, shown as positive movement totals.
- **Net change** is inflows minus outflows for that month.
- The final column is the month-end **closing balance** for that account.

Delete behavior on this page:
- Deleting an account also deletes linked transactions and linked recurring rules.
- The page shows a confirmation panel with the expected cascade impact before you confirm.

### Categories

Use the categories page to manage income and expense categories without losing history.

What you can do:
- Add, edit, archive, and restore categories.
- Review simple usage metadata before archiving.
- Keep old categories available in history while hiding them from new-use pickers.

Important behavior:
- Category names must be unique.
- Each category is either **income** or **expense**.
- Archiving is the normal way to retire a category.
- Archived categories keep linked transactions, split allocations, budgets, and recurring rules intact.
- Archived categories remain visible in historical displays and in edit forms for existing records.
- Archived categories are removed from new transaction, split, recurring-rule, and budget selection by default until restored.

### Recurring

Use the recurring tools inside the **Transactions** page to manage repeating income, bills, and transfers.

Compatibility note:
- The old **/recurring** route still exists, but it forwards into the transactions recurring subview.

What you can do:
- Pick a start month and month count for manual recurring generation.
- Click **generate recurring** for the selected range.
- Review summary counts for rules, active rules, and generated transactions.
- Add, edit, duplicate, and delete recurring rules inline.
- Create either **standard** recurring rules or **transfer** recurring rules.
- Choose monthly, weekly, biweekly, or yearly frequency.

How recurring rules behave:
- Standard recurring rules require an account, category, start date, and amount.
- Transfer recurring rules require a source account, destination account, start date, and amount.
- For standard recurring rules, the saved sign follows the selected category kind:
   - income category -> positive amount
   - expense category -> negative amount
- Transfer recurring rules generate linked transfer pairs.
- Saving a recurring rule does **not** create a transaction yet.
- Transactions are only created when you manually run **generate recurring**.

Helpful feedback on this page:
- The page shows whether rules are active or inactive.
- It shows how many transactions were already generated from each rule.
- After a recurring run, the feedback panel summarizes what was created and what was skipped.

### Forecast

Use the forecast page to project future balances from current saved transactions plus future recurring activity.

What you can do:
- Pick a starting month.
- Pick a horizon of **3**, **6**, or **12** months.
- Review projected income, expenses, and net by month.
- Review projected ending balances by account.

Important behavior:
- Forecast math starts from current actual account ledger balances.
- Only recurring rules affect future projections.
- Budgets do not affect forecast balances.
- Transfer recurring rules affect projected account balances but do not count as projected income or projected expenses.
- Credit accounts keep the same signed projected balance display and, if a limit exists, also show projected **available credit**.

### Transactions

Use the transactions page as the main ledger.

What you can do:
- Filter by month.
- Filter by account.
- Filter by category.
- Search merchant or note text.
- Clear active filters.
- Add a transaction.
- Edit a standard transaction or transfer.
- Create and edit split transactions.
- Delete a standard transaction or transfer.

How to record a transaction:
1. Click **add transaction**.
2. Choose **type**:
   - **income** saves as a positive amount.
   - **expense** saves as a negative amount.
   - **transfer** creates a linked pair between two accounts.
3. Enter the amount as normal currency, such as `125.00`.
4. Enter the date.
5. Choose the account.
6. Choose the category.
   - Category choices are filtered by the selected type.
   - Income transactions only show income categories.
   - Expense transactions only show expense categories.
   - Archived categories are excluded from new selections by default.
   - If you edit an existing transaction that already uses an archived category, that current value still stays visible.
7. Optionally add a merchant and note.
8. Save the transaction.

How to record a split transaction:
1. Click **add transaction**.
2. Choose **income** or **expense**.
3. Enter the parent amount, date, and account.
4. Turn on **split transaction**.
5. Add at least two split rows.
6. Pick a category and amount for each row.
7. Keep the split rows balanced with the parent transaction total.
8. Optionally add split notes plus any parent merchant/note.
9. Save the transaction.

How to record a transfer:
1. Click **add transaction**.
2. Choose **transfer**.
3. Enter a positive amount.
4. Enter the date.
5. Choose the **from account**.
6. Choose the **to account**.
7. Optionally add a note.
8. Save the transfer.

Transfer behavior:
- The app creates exactly two transactions:
  - a negative entry on the source account
  - a positive entry on the destination account
- Transfers affect account balances and account history.
- Transfers do **not** count as income or expenses in dashboard/budget reporting.

Split behavior:
- A split transaction is still one saved standard transaction in the ledger.
- The parent transaction amount continues to drive account balances and ledger history.
- Split rows drive category reporting and budget actuals.
- Split rows do not create additional child transactions.
- Archived categories are hidden from new split-line choices by default, but remain visible when editing a saved split that already references them.

Opening-balance behavior on this page:
- Opening balances may appear in the transactions list as labeled rows.
- They are part of the account ledger.
- They are edited from **Accounts**, not from the general transaction form.

Credit account behavior on this page:
- Credit accounts use the same transaction signs as every other account.
- A credit expense is still a negative transaction.
- A payment, refund, or transfer into a credit account is a positive transaction.
- The special behavior is in how balances are displayed elsewhere, not in transaction entry rules.

Why this page matters:
- Transactions are the source of truth.
- Budget calculations, dashboard totals, and actual spending all come from saved transactions.
- If a number looks wrong elsewhere in the app, check the transactions first.

### Budget

Use the budget page to plan monthly spending by expense category.

What you can do:
- Pick a month.
- Enter planned amounts for each expense category.
- Save one category at a time.
- Save all category budgets at once.
- See summary cards for planned, spent, and unassigned.
- See each category's planned, actual, and remaining amounts.

How budgeting works here:
- Budgets are monthly planned amounts per category.
- Only expense categories are budgeted on this page.
- Every expense category gets a row automatically.
- Archived expense categories do not show up as fresh planning rows by default.
- If the selected month already has saved budgets or transaction history for an archived category, that row still stays visible.
- Actual spending is based on expense transactions in the selected month.
- Remaining = planned minus actual.
- A negative remaining amount means the category is over budget.

Useful behavior to know:
- As you type new planned amounts, row totals and summary values update immediately, even before saving.
- You do not add or remove budgets manually; the page is driven by the current expense categories.
- Saving creates a monthly budget record if one does not exist yet.
- Saving updates the existing monthly budget record if it already exists.

Recommended use:
- Set budgets after your categories are in place.
- Revisit the page during the month if your plan changes.
- Use the dashboard afterward to review whether actual spending is staying inside the plan.

### Settings

Use settings for data-management utilities and optional cloud sync.

What you can do:
- Sign in with a magic email link.
- Sign out.
- Review cloud sync status.
- Push local data to the cloud.
- Pull cloud data to this device.
- Use **sync now** for the obvious safe action.
- Export a local backup before a cloud pull.
- Export a JSON backup.
- Import a JSON backup that replaces the current dataset.
- Use **reset seed data**.

#### Cloud sync
- Local storage stays primary even if you sign in.
- Signed-out use still works normally on one device.
- If cloud sync is enabled, the app compares full local and remote snapshots.
- Cloud sync is explicit and snapshot-based:
   - **push local to cloud** overwrites the remote snapshot with this device's current local data.
   - **pull cloud to this device** replaces this device's local data with the validated cloud snapshot.
   - **sync now** chooses the obvious safe path when one side is clearly newer.
- If the local and remote snapshots diverge, the app does not auto-merge them.
- If a cloud pull could overwrite local data, the app shows **backup local before pull** so you can export a restore point first.
- If Supabase env vars are missing or sync is not configured, the app disables auth/sync actions and keeps local-only use available.

#### Backup import/export
- **export json backup** downloads the full current persisted dataset.
- **import json backup** replaces the current accounts, categories, transactions, budgets, and recurring rules.
- Importing asks for confirmation first.
- Import does not merge; it replaces.
- **backup local before pull** uses the same export path as a normal JSON backup, just positioned next to the cloud pull workflow.

#### Reset seed data
- **reset seed data** is a user-facing reset action in settings.
- It replaces the current in-app data with the built-in demo seed data.
- That includes accounts, categories, transactions, budgets, and recurring rules.
- Use it carefully, especially if you have entered real data you want to keep.
- The current UI asks for confirmation before resetting.

## 5. How recurring transactions work

Recurring rules are managed in **Transactions > Recurring**, and they can be generated from the recurring subview or from **Dashboard**.

Recommended recurring workflow:
1. Create the needed accounts first, plus a category if you are creating a standard recurring rule.
2. Add a recurring rule in **Transactions > Recurring**.
3. Choose the correct kind and frequency:
   - standard or transfer
   - monthly
   - weekly
   - biweekly
   - yearly
4. Make sure the rule is active.
5. When you are ready to populate one or more months, go to **Dashboard** or **Transactions > Recurring**.
6. Select the start month and month count.
7. Click **generate recurring**.
8. Review the created transactions on the **Transactions** page.

You can also run **generate recurring** from the recurring subview if you are already working there.

Important behavior:
- Generated recurring entries become normal saved transactions with source `recurring`.
- Once generated, they count in dashboard totals and budget actuals just like manual transactions.
- The app prevents duplicate generation for the same rule on the same date.
- If a rule date is outside the start or end date bounds, it will not generate.
- Transfer recurring rules generate linked transfer pairs.
- If nothing qualifies for that month, clicking the button does not create anything.

## 6. Tips and common gotchas

- Set up accounts and categories before entering lots of transactions.
- Add opening balances when you first set up real accounts so ledger-derived balances start from the right place.
- Set your preferred light or dark theme from the header toggle; the app remembers it on this device.
- Use income categories only for money coming in, and expense categories only for money going out.
- Enter amounts as normal currency values. The app handles cents internally for accuracy.
- On transaction forms, enter a positive amount and let the selected type decide whether it becomes income or expense.
- For transfers, enter a positive amount and let the app create the negative/positive pair.
- For credit accounts, remember that purchases usually push the signed balance further negative, while payments or refunds move it back toward zero or positive.
- If a budget looks off, check whether the related transactions were categorized correctly.
- If an account balance looks off, check for transfers and opening-balance entries as well as standard transactions.
- If a recurring transaction is missing, confirm all of these:
  - the rule is active
   - the rule has valid account references and, for standard rules, a valid category
  - the selected month contains a matching occurrence
   - you manually clicked **generate recurring** on the dashboard or recurring page
- If you delete an account, linked records are removed too.
- If you retire a category, archive it so linked history stays intact.
- Export a backup before doing major cleanup or importing replacement data.
- The app is local-first, so data stays in this browser storage unless you reset it or clear browser storage.

## 7. Current limitations

This guide describes the app as it exists now.

Current MVP limitations:
- Local storage is still the primary data store on this device.
- Optional magic-link auth and one-user snapshot sync exist, but they are intentionally narrow and explicit.
- There is no merge engine, realtime sync, or background sync.
- There is no bank sync.
- There is no CSV import.
- Recurring rules do not auto-run; you must generate them manually.
- Credit account support is limited to signed balance display, credit limits, and available-credit display.
- There is no interest, APR, statement cycle, due-date, or minimum-payment logic.
- The app is best treated as a manual budgeting ledger, not a fully automated finance system.
