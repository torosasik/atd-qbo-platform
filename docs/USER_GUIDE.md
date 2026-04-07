# ATD QBO Platform - User Guide

Welcome to the ATD QBO Platform. This guide is for American Tile Depot team members who use the platform through a web browser. No technical background is needed.

---

## What This App Does

The ATD QBO Platform automates accounting tasks that would otherwise need to be done manually in QuickBooks Online. Right now the main feature is creating Purchase Orders. Instead of logging into QuickBooks and filling out forms by hand, you can create and approve POs directly from this app, and they are sent to QuickBooks automatically.

---

## How to Access the App

Open any web browser (Chrome, Safari, Edge) and go to the URL that Toros has shared with your team. The app works on desktop computers and laptops. Bookmark it so you can find it easily.

---

## Dashboard

The Dashboard is the first page you see when you open the app. It gives you a quick overview of recent activity.

### Stat Cards

At the top of the Dashboard you will see several cards showing numbers:

- **Pending Drafts**: POs that have been created but not yet sent to QuickBooks. These need someone to review and approve them.
- **Approved Today**: POs that were approved and sent to QuickBooks today.
- **Total This Week**: All POs processed this week.

### Recent Activity Table

Below the cards is a table showing the most recent actions taken in the platform. Each row shows:

- **Date and Time**: When the action happened.
- **Action**: What was done (for example, "PO Created" or "PO Approved").
- **Vendor**: The vendor the PO was for.
- **Status**: Whether it succeeded or if there was a problem.

---

## Creating a Purchase Order

1. Click **Purchase Orders** in the left sidebar.
2. Click the **Create PO** tab at the top.
3. Fill in the form:

   **Vendor**: Click the dropdown and select the vendor you are ordering from. If you do not see the vendor you need, see the FAQ section at the bottom of this guide.

   **Date**: The date for the purchase order. It defaults to today.

   **Memo (optional)**: A short note about this order, such as a project name or reference number.

4. Add line items. Each line item is one product you are ordering.
   - Click **Add Row** to add a new line.
   - In the **Item** column, select the product from the dropdown.
   - Enter the **Quantity** (how many units you are ordering).
   - Enter the **Unit Price** (cost per unit). The total for that line calculates automatically.
   - To remove a line, click the trash icon on the right side of that row.

5. When you are ready, choose how to submit:

   - **Submit for Review**: Saves the PO as a draft. A manager will review and approve it before it goes to QuickBooks. Use this if you want someone to check your work first.
   - **Submit and Approve**: Sends the PO directly to QuickBooks without a separate approval step. Use this only if you have permission to approve POs.

### What Happens After You Submit

- If you chose **Submit for Review**: The PO is saved as a draft. You will see a confirmation message. The PO will appear in the Pending Drafts tab for someone to approve.
- If you chose **Submit and Approve**: The PO is sent to QuickBooks immediately. You will see a confirmation with the QuickBooks PO number. The PO will appear in the History tab.

---

## Reviewing and Approving Drafts

Drafts are POs that have been submitted but not yet sent to QuickBooks. A manager or authorized team member needs to review and approve them.

1. Click **Purchase Orders** in the left sidebar.
2. Click the **Pending Drafts** tab.
3. You will see a table of all POs waiting for approval. Each row shows:
   - **Vendor**: Who the order is for.
   - **Date**: The PO date.
   - **Lines**: How many line items are in the PO.
   - **Total**: The estimated total value.
   - **Created By / Source**: Who created it, or whether it came from Google Sheets.

4. To approve a PO, click the **Approve** button on that row. The PO is sent to QuickBooks and moves to the History tab.
5. To reject a PO, click the **Reject** button. The PO is removed from the drafts list and is not sent to QuickBooks.

After you click Approve, the PO is created in QuickBooks Online and you will see a confirmation with the QuickBooks PO number.

---

## Importing from Google Sheets

If your team tracks POs in a Google Sheet, you can import them into the platform in bulk instead of creating them one by one.

1. Click **Purchase Orders** in the left sidebar.
2. Click the **Import from Sheets** tab.
3. Click **Load from Google Sheets**. The platform reads the connected spreadsheet and shows you a preview of the data.
4. Review the data in the preview table. Check that the vendors, items, quantities, and prices look correct.
5. If everything looks good, click **Import All as Drafts**. The platform creates one draft PO for each group of rows in the sheet.
6. Go to the **Pending Drafts** tab to review and approve the imported POs.

Note: The Google Sheet must be set up in the format that Toros has configured. If the import shows no data or shows incorrect data, contact Toros.

---

## Viewing PO History

The History tab shows all POs that have been successfully sent to QuickBooks.

1. Click **Purchase Orders** in the left sidebar.
2. Click the **History** tab.
3. The table shows:
   - **Date**: When the PO was sent to QuickBooks.
   - **QBO PO Number**: The ID assigned by QuickBooks. You can use this to find the PO in QuickBooks Online.
   - **Vendor**: Who the order is for.
   - **Total**: The value of the PO.
   - **Status**: Green means it was created successfully. Red means there was a problem.

To find a specific PO, scroll through the list or use your browser's find function (press Ctrl+F on Windows or Command+F on Mac) and type the vendor name or PO number.

---

## AI Chat

The AI Chat is a built-in assistant that can answer questions about your PO data.

### What You Can Ask

- "Show me today's PO activity"
- "What vendors do we order from most often?"
- "Do we have any duplicate POs this week?"
- "How many POs are pending approval?"
- "What was the last PO we created for supplier X?"

### What the AI Source Indicator Means

After the AI responds, you may see a small label:

- **Ollama**: The answer came from the local AI running on the ATD server. This is the default and does not use the internet.
- **Claude**: The answer came from a cloud AI service. This is used as a backup when the local AI is unavailable.

### Important Limits

The AI only sees data inside the ATD QBO Platform. It cannot browse the internet or access QuickBooks directly. It works with the logs and records stored in this app.

---

## Settings (For Managers Only)

The Settings page lets authorized users configure how the platform works. Regular team members do not need to change anything here.

### Google Sheets

This section lets you change which Google Sheet the platform reads from when importing POs. If your team moves the data to a new spreadsheet, update the Sheet ID here. Contact Toros if you are unsure what to enter.

### AI Settings

- **AI Enabled**: Turns the AI review feature on or off for the whole platform.
- **Auto Review**: When on, the AI automatically checks each PO before it is submitted. When off, POs skip the AI check.
- **Minimum Confidence**: A number from 0 to 100. The AI will only flag a PO as suspicious if it is at least this confident there is a problem. A higher number means fewer (but more reliable) flags.
- **Ollama Model**: Which local AI model to use. Leave this as is unless Toros says to change it.
- **Claude Model**: Which cloud AI model to use as a backup. Leave this as is.

### QBO Settings

- **Sandbox**: Test mode. POs created in Sandbox go to a practice version of QuickBooks, not your real company data. Use this for testing.
- **Production**: Live mode. POs go directly to your real QuickBooks company. This is the normal setting for day-to-day use.

Always confirm with Toros before switching between Sandbox and Production.

### Modules

Each module can be turned on or off independently. For example, if you want to disable invoice creation temporarily, you can turn it off here without affecting the purchase order module.

- **Auto Approve**: When turned on for a module, submissions go directly to QuickBooks without waiting for manual approval. Only enable this if your team has agreed it is appropriate.

### Reset to Defaults

This button resets all settings back to the original values. Use it only if settings were changed incorrectly and things are not working. It will not delete any POs or history. Contact Toros before using this if you are unsure.

---

## System Health

The System Health page shows whether all the pieces of the platform are working correctly.

### Reading the Status Indicators

Each service shows a colored status:

- **Green (Connected / Configured / Healthy)**: Everything is working normally.
- **Yellow (Degraded / Unavailable)**: Something is not working perfectly but the main features may still work.
- **Red (Error / Disconnected / Not Configured)**: Something is broken and needs attention.

### Services Explained

- **Firestore**: The database that stores your drafts, logs, and settings. If this is red, the whole app will not work.
- **QBO API**: The connection to QuickBooks Online. If this is red, POs cannot be sent to QuickBooks.
- **Ollama**: The local AI. If this is yellow or red, the AI Chat and AI review features will use the cloud backup instead or may be unavailable.
- **Claude API**: The cloud AI backup. If this shows "not configured," the CLAUDE_API_KEY has not been set up.
- **Google Sheets**: Shows whether a Sheet ID has been configured. It does not test the actual connection unless you use the test button on the Import page.

### What to Do If Something Is Red

1. Refresh the page and check again. Sometimes a short network hiccup causes a temporary error.
2. Check the error message shown under the red service for a hint about what is wrong.
3. If the problem persists, contact Toros with a screenshot of the System Health page.

---

## Frequently Asked Questions

**I submitted a PO but it is not showing up in QuickBooks.**
Check the Pending Drafts tab. If you used "Submit for Review," the PO is waiting for someone to approve it. It will not appear in QuickBooks until it is approved.

**The vendor I need is not in the dropdown.**
The vendor must exist in QuickBooks Online first. Ask whoever manages your QuickBooks account to add the vendor there. After it is added, Toros or a manager can refresh the vendor list in Settings so it appears in the dropdown.

**The item I need is not in the dropdown.**
Same as above. The item must exist in QuickBooks Online first. Ask your QuickBooks manager to add it, then refresh the item list in Settings.

**I got an error message when submitting a PO.**
Write down the error message. Try refreshing the page and submitting again. If it happens again, check the System Health page to see if QBO is connected. If QBO shows red, contact Toros.

**How do I know if my PO was created successfully in QuickBooks?**
Go to the History tab. Find your PO and check the Status column. A green status means it was created successfully. You will also see the QuickBooks PO number, which you can use to look it up directly in QuickBooks Online.

**Can I edit a PO after it has been sent to QuickBooks?**
No. Once a PO is approved and sent to QuickBooks, it cannot be edited from this platform. You must open QuickBooks Online directly and edit it there.

**The AI Chat says it cannot connect or is unavailable.**
Go to the System Health page. Check the Ollama and Claude API rows. If both are red or unavailable, the AI service is down. The rest of the platform will still work normally. Contact Toros to get the AI back online.

**The import from Google Sheets shows no data.**
Make sure the Google Sheet is set up in the correct format. Check that you are looking at the right tab. Contact Toros to verify the Sheet ID and column mapping are configured correctly.

---

*For any issue you cannot resolve, contact Toros Asik.*
