# User guide

## 1. Overview

Budget MVP is a local-first personal budgeting app for tracking transactions, transfers, account balances, monthly category budgets, forecasts, and month-by-month progress.

What it does today:
- Lets you manage your own accounts, categories, transactions, budgets, and recurring rules.
- Lets you track balances on checking, savings, cash, and credit accounts.
- Lets you move money between accounts with linked transfer entries.
- Lets you keep opening balances as special transactions tied to accounts.
- Lets you review account history and a recurring-based forecast.
- Stores data in your browser's local storage on this device.
- Uses transactions as the source of truth for actual money movement.
- Lets you generate recurring transactions manually for a selected month.
- Lets you export a JSON backup and import a replacement backup.

Important rules to know:
- You enter money as normal currency values like `12.34`, but the app stores amounts internally as integer cents.
- Positive amounts are income.
- Negative amounts are expenses.
- On forms, you usually enter a positive number and the app applies the sign based on the type you choose.
- Transfers are stored as a linked negative/positive pair between two accounts.
- Opening balances are stored as special transactions, not as mutable account fields.
- Budgets are monthly planned amounts per category.
- Only expense categories appear on the budget page.
- Recurring rules are templates. They do not change your totals until you generate real transactions from them.
- Credit cards use the same ledger model as every other account.
   - Negative ledger balance on a credit account means money owed.
   - Positive payments, refunds, and transfers into a credit account reduce what is owed.

## 2. Quick start

Recommended first-time setup:
1. Open **Settings**.
2. Add your accounts, such as checking, savings, cash, or credit card.
   - You can optionally set an opening balance and date.
   - For credit accounts, you can optionally set a credit limit.
3. Add your categories.
   - Use **income** categories for paychecks or other income.
   - Use **expense** categories for spending categories like rent, groceries, or dining.
4. If you have repeating income or bills, add recurring rules in **Settings**.
5. Open **Transactions** and start recording real transactions or transfers.
6. Open **Budget** and enter planned monthly amounts for your expense categories.
7. Use **Accounts** to review balances and account history.
8. Use **Forecast** to review projected balances from recurring rules.
9. Use **Dashboard** to review the month and manually generate recurring transactions when needed.

If there is no saved data yet, the app starts with demo seed data so you can see how it works.

## 3. Recommended monthly workflow

Use this order each month:

1. **Check your setup in Settings**
   - Make sure the accounts and categories you need already exist.
   - Add or update opening balances if you are starting from an existing real-world balance.
   - Add a credit limit for credit accounts if you want available-credit display.
   - Add or update recurring rules before the month gets busy.

2. **Generate recurring transactions for the month**
   - Go to **Dashboard**.
   - Pick the month.
   - Click **generate recurring**.
   - This creates real transactions for active recurring rules that match that month.
   - The app prevents duplicate recurring transactions for the same rule on the same date.

3. **Record manual transactions as they happen**
   - Go to **Transactions**.
   - Add income, expense, and transfer transactions.
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
- Click an account to review its monthly history.
- Switch history range between **last 6 months**, **last 12 months**, and **all**.

How to read balances:
- For checking, savings, and cash accounts, the app shows a standard **balance**.
- For credit accounts, the app shows **owed** instead of a signed negative balance.
   - If the ledger balance is `-50.00`, the account displays **owed 50.00**.
   - If the ledger balance is `0.00` or positive, the account displays **owed 0.00**.
- If a credit account has a credit limit, the page also shows:
   - **limit**
   - **available credit**

How to read history:
- **Inflows** are positive amounts into that account.
- **Outflows** are negative amounts out of that account, shown as positive movement totals.
- **Net change** is inflows minus outflows for that month.
- The final column is the month-end balance view:
   - **closing balance** for non-credit accounts
   - **closing owed** for credit accounts

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
- Credit accounts display projected **owed** and, if a limit exists, projected **available credit**.

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
7. Optionally add a merchant and note.
8. Save the transaction.

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

Opening-balance behavior on this page:
- Opening balances may appear in the transactions list as labeled rows.
- They are part of the account ledger.
- They are edited from **Settings**, not from the general transaction form.

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
- Actual spending is based on expense transactions in the selected month.
- Remaining = planned minus actual.
- A negative remaining amount means the category is over budget.

Useful behavior to know:
- As you type new planned amounts, row totals and summary values update immediately, even before saving.
- Saving creates a monthly budget record if one does not exist yet.
- Saving updates the existing monthly budget record if it already exists.

Recommended use:
- Set budgets after your categories are in place.
- Revisit the page during the month if your plan changes.
- Use the dashboard afterward to review whether actual spending is staying inside the plan.

### Settings

Use settings to manage the app's core setup.

What you can do:
- Export a JSON backup.
- Import a JSON backup that replaces the current dataset.
- Add, edit, and delete accounts.
- Add, edit, and delete categories.
- Add, edit, and delete recurring rules.
- Review simple usage counts before deleting items.
- Use **reset seed data**.

#### Accounts
- Accounts are the places transactions belong to, such as checking, savings, cash, or credit card.
- Account names must be unique.
- You can optionally set an opening balance and opening balance date.
   - A non-zero opening balance creates or updates a special opening-balance transaction.
   - Clearing the amount removes that opening-balance transaction.
- For credit accounts, you can optionally set a credit limit.
- Deleting an account also deletes linked transactions and linked recurring rules.

Credit account notes:
- The app does not use a special credit transaction model.
- It uses the same signed ledger as all other accounts.
- What changes is the display:
   - negative ledger balance -> money owed
   - positive inflows into the credit account -> reduced owed
   - optional limit -> available credit display

#### Categories
- Categories classify income and spending.
- Category names must be unique.
- Each category is either **income** or **expense**.
- Deleting a category also deletes linked budgets, linked transactions, and linked recurring rules.

#### Recurring rules
- Recurring rules are templates for future repeating activity.
- They can be monthly, weekly, biweekly, or yearly.
- They can be either:
   - **standard** recurring rules
   - **transfer** recurring rules
- Standard recurring rules require an account, category, start date, and amount.
- Transfer recurring rules require a source account, destination account, start date, and amount.
- You can optionally set an end date, merchant, note, and whether the rule is active.
- For standard recurring rules, the amount sign follows the selected category kind:
  - Income category -> positive amount
  - Expense category -> negative amount
- For transfer recurring rules, the amount is stored as a positive transfer amount and generated as a linked pair.
- Saving a recurring rule does **not** create a transaction immediately.
- You still need to go to **Dashboard** and run **generate recurring** for a month.
- Deleting a recurring rule removes the rule only. Previously generated transactions stay in history.

#### Backup import/export
- **export json backup** downloads the full current persisted dataset.
- **import json backup** replaces the current accounts, categories, transactions, budgets, and recurring rules.
- Importing asks for confirmation first.
- Import does not merge; it replaces.

#### Reset seed data
- **reset seed data** is a user-facing reset action in settings.
- It replaces the current in-app data with the built-in demo seed data.
- That includes accounts, categories, transactions, budgets, and recurring rules.
- Use it carefully, especially if you have entered real data you want to keep.
- The current UI does not show a confirmation step before resetting.

## 5. How recurring transactions work

Recurring rules are managed in **Settings**, but generated on **Dashboard**.

Recommended recurring workflow:
1. Create the needed accounts first, plus a category if you are creating a standard recurring rule.
2. Add a recurring rule in **Settings**.
3. Choose the correct kind and frequency:
   - standard or transfer
   - monthly
   - weekly
   - biweekly
   - yearly
4. Make sure the rule is active.
5. When you are ready to populate a month, go to **Dashboard**.
6. Select the month.
7. Click **generate recurring**.
8. Review the created transactions on the **Transactions** page.

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
- Use income categories only for money coming in, and expense categories only for money going out.
- Enter amounts as normal currency values. The app handles cents internally for accuracy.
- On transaction forms, enter a positive amount and let the selected type decide whether it becomes income or expense.
- For transfers, enter a positive amount and let the app create the negative/positive pair.
- For credit accounts, remember that a negative purchase increases **owed**, and a positive payment or refund reduces **owed**.
- If a budget looks off, check whether the related transactions were categorized correctly.
- If an account balance looks off, check for transfers and opening-balance entries as well as standard transactions.
- If a recurring transaction is missing, confirm all of these:
  - the rule is active
   - the rule has valid account references and, for standard rules, a valid category
  - the selected month contains a matching occurrence
  - you manually clicked **generate recurring** on the dashboard
- If you delete an account or category, linked records are removed too.
- Export a backup before doing major cleanup or importing replacement data.
- The app is local-first, so data stays in this browser storage unless you reset it or clear browser storage.

## 7. Current limitations

This guide describes the app as it exists now.

Current MVP limitations:
- Data is stored locally in browser local storage on one device.
- There is no account system or authentication.
- There is no bank sync.
- There is no CSV import.
- There are no split transactions.
- Recurring rule management currently lives in **Settings**.
- Recurring rules do not auto-run; you must generate them manually.
- Credit account support is limited to owed and available-credit display.
- There is no interest, APR, statement cycle, due-date, or minimum-payment logic.
- The app is best treated as a manual budgeting ledger, not a fully automated finance system.
