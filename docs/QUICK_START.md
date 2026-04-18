# ATD QBO Platform - Quick Start Guide

Welcome to the team! This guide will get you up and running with the ATD QBO Platform in about 10 minutes.

---

## Kilo Code post-completion menu

Whenever Kilo Code finishes a task in this repo, the result ends with a clickable menu:

| Command | What it does |
|---|---|
| [`/push-github`](../.kilocode/commands/push-github.md) | Stage, conventional commit, push current branch, optional `gh pr create` |
| [`/deploy-firebase`](../.kilocode/commands/deploy-firebase.md) | Build frontend + `firebase deploy` (hosting, functions, firestore rules & indexes) |
| [`/test-code`](../.kilocode/commands/test-code.md) | Run all unit/integration tests and print a pass/fail table |
| [`/test-ui`](../.kilocode/commands/test-ui.md) | Headed Playwright; walks every core flow in a real Chromium window |

Click the link or type the command after the `---` divider in the chat. Defined in [`.kilocode/rules/post-completion-menu.md`](../.kilocode/rules/post-completion-menu.md).

---

## Before You Begin

1. Copy `functions/.env.example` to `functions/.env` and fill in your keys:
   ```
   QBO_CLIENT_ID=your_intuit_oauth_client_id
   QBO_CLIENT_SECRET=your_intuit_oauth_client_secret
   CLAUDE_API_KEY=your_anthropic_claude_api_key
   ```
2. Make sure you have the app URL. If you do not have it yet, ask Toros.

---

## Step 1: Open the App

Open Chrome, Safari, or Edge on your computer. Type the app URL into the address bar and press Enter.

You should see the Dashboard page with stat cards at the top and a recent activity table below.

[Screenshot: Dashboard overview]

Bookmark the page so you can find it quickly next time.

---

## Step 2: Check the Dashboard

Take a moment to look at the Dashboard.

- The **Pending Drafts** card shows how many POs are waiting for approval.
- The **Recent Activity** table shows the latest actions taken by your team.

[Screenshot: Stat cards and activity table]

If the page looks blank or shows an error, go to System Health (in the left sidebar) to check if all services are running. If something shows red, contact Toros before continuing.

---

## Step 3: Create Your First Purchase Order

1. Click **Purchase Orders** in the left sidebar.
2. Click the **Create PO** tab.
3. Select a vendor from the dropdown.
4. The date defaults to today. Change it if needed.
5. Click **Add Row** to add your first line item.
6. Select the item, enter a quantity, and enter the unit price.
7. Add more rows if this order has multiple items.
8. Click **Submit for Review** to save it as a draft for approval.

[Screenshot: Create PO form with a vendor selected and one line item filled in]

You will see a green confirmation message at the top of the screen when the draft is saved.

---

## Step 4: Review and Approve the Draft

1. Click the **Pending Drafts** tab (you should still be in the Purchase Orders section).
2. Find the draft you just created.
3. Check that the vendor, items, quantities, and prices are correct.
4. Click **Approve** to send the PO to QuickBooks.

[Screenshot: Pending Drafts tab with one draft and the Approve button highlighted]

You will see a confirmation with the QuickBooks PO number once it is approved.

---

## Step 5: Verify It Appeared in QuickBooks

1. Click the **History** tab in Purchase Orders.
2. Find your PO in the list. The Status column should show green.
3. Note the QBO PO Number shown in the table.

[Screenshot: History tab with a successful PO entry]

4. Open QuickBooks Online in another browser tab.
5. Go to Expenses, then Purchase Orders.
6. Search for the PO number you noted. It should appear there.

---

## You Are Ready

You now know how to create, approve, and verify a Purchase Order. For more detail on any feature, see the full [User Guide](USER_GUIDE.md).

For problems or questions, contact Toros Asik.
