# ATD QBO Platform - Troubleshooting Guide

Use this guide when something is not working as expected. Each issue lists what you see, why it happens, and how to fix it.

For anything not listed here, or if the steps below do not work, contact Toros Asik.

---

## Orders Page Shows Old Data After Editing the Google Sheet

**Problem:** You edited the Google Sheet (added a new order, fixed a row, etc.) but the Orders page in the app is still showing the old data.

**Cause:** The app caches sheet data in two places to avoid hammering the Google Sheets API on every page load:

1. **Server cache** in Firestore (`cache/sheets_orders`): up to **60 seconds** old.
2. **Browser cache** in localStorage (`atd.orders.last_payload.v1`): up to **24 hours** old, used only as a fallback when the live pull fails.

So a sheet edit may take up to 60 seconds to appear through the regular **Refresh** button, and longer if the backend is currently falling back to the stale cache (e.g. sheet was temporarily unreachable).

**Fix — in order:**

1. On the Orders page, click **Force Refresh** (the blue button next to Refresh). This bypasses the server cache and re-reads the sheet live.
2. If rows are still missing, look at the yellow banner at the top of the Orders page. If it says "Showing outdated cached data — live pull from Google Sheets failed," the backend could not reach the sheet. Open **Settings → Google Sheets** and:
   - Verify the **Sheet ID** is correct (copy it from the sheet URL).
   - Verify the **tab name** matches exactly (case-sensitive).
   - Verify the sheet is still shared with the service account email shown on that page (Editor or Viewer access is fine).
3. If the sheet is shared correctly and tab/ID match but you see an "Order # looks like prose" style issue where only some orders appear, check the "Order #" cell of the missing orders — free-form notes in that cell (longer than 50 chars, or multiple prose-style words) are filtered out. Replace the note with the actual order number and Force Refresh.
4. Still stuck? As a last resort, clear the browser-side cache by opening DevTools (F12) → Application → Local Storage → your domain → delete the `atd.orders.last_payload.v1` entry, then reload the page.

**For support / debug:** Hit `GET /sheets/orders?debug=1` (from a tool like the Health Check page) to see `{ cachedAtMs, rowCount, schemaVersion, cacheAgeMs }` — this shows exactly how stale the server cache is and whether the schema matches the current code.

---

## Page Won't Load / Blank Screen

**Problem:** You open the app URL and see a blank white page, a loading spinner that never goes away, or a browser error like "This site can't be reached."

**Cause:** The app server may be temporarily offline, or there may be a network issue on your computer.

**Fix:**
1. Wait 30 seconds and refresh the page (press F5 or click the reload button in your browser).
2. Check your internet connection by opening another website such as google.com.
3. Try opening the app in a different browser (Chrome instead of Safari, for example).
4. Clear your browser cache: in Chrome, press Ctrl+Shift+Delete (Windows) or Command+Shift+Delete (Mac), select "Cached images and files," and click Clear.
5. Try again after clearing the cache.

**If that does not work:** Contact Toros and tell him the page will not load. Include what browser you are using and whether other websites work normally.

---

## "Not Connected" Error on QBO Connect Page

**Problem:** You see a red "Disconnected" status on the QBO Connect page or when looking at System Health under QBO API.

**Cause:** The connection between the platform and QuickBooks Online has expired or was never set up. QuickBooks connections expire periodically and need to be reconnected.

**Fix:**
1. Go to **Settings** in the left sidebar.
2. Click the **QBO Connect** section or tab.
3. Click **Connect to QuickBooks**.
4. A QuickBooks login page will open. Sign in with your QuickBooks credentials.
5. Follow the prompts to authorize the connection.
6. You will be redirected back to the app. Check System Health to confirm QBO shows green.

**If that does not work:** Contact Toros. The QuickBooks credentials or app configuration may need to be updated.

---

## Vendor Dropdown Is Empty

**Problem:** When creating a PO, you click the Vendor dropdown and see nothing, or it says "No vendors found."

**Cause:** The vendor list is stored locally in the app and may not have been loaded yet, or it may be out of date.

**Fix:**
1. Go to **Settings** in the left sidebar.
2. Find the **Cache** or **Refresh** section.
3. Click **Refresh Vendor List** (or **Refresh Cache**).
4. Wait a few seconds, then go back to Create PO and try the dropdown again.

**If the vendor you need is still missing:** The vendor does not exist in QuickBooks Online yet. Ask your QuickBooks manager to add the vendor in QuickBooks, then repeat the steps above to refresh the vendor list.

**If the dropdown is still empty after refreshing:** Check System Health. If QBO API shows red, the platform cannot connect to QuickBooks to retrieve the vendor list. Contact Toros.

---

## Item Dropdown Is Empty

**Problem:** When adding a line item to a PO, the Item dropdown shows nothing.

**Cause:** Same as the vendor list. The item list may not be loaded or may be out of date.

**Fix:**
1. Go to **Settings** in the left sidebar.
2. Click **Refresh Item List** (or **Refresh Cache**).
3. Wait a few seconds, then go back to Create PO and try adding a line item again.

**If the item you need is missing:** The item does not exist in QuickBooks Online. Ask your QuickBooks manager to add it, then refresh the item list.

**If the dropdown is still empty:** Check System Health for QBO API status. Contact Toros if it shows red.

---

## PO Submission Fails with an Error

**Problem:** You click Submit and see a red error message instead of a success confirmation.

**Cause:** This can happen for several reasons. The most common are: the QuickBooks connection expired, a required field was left blank, or QuickBooks rejected the data.

**Fix:**
1. Read the error message carefully. It often tells you exactly what went wrong (for example, "Vendor is required" or "Token expired").
2. If the error says something about a token or connection, go to System Health and check QBO API. If it is red, try reconnecting (see "Not Connected" error above).
3. If the error mentions a missing field, scroll up on the form and make sure Vendor, Date, and at least one line item are all filled in.
4. Try submitting again.

**If that does not work:** Take a screenshot of the error message and contact Toros.

---

## Google Sheets Import Shows No Data

**Problem:** You click "Load from Google Sheets" and the preview table is empty, or it says "No rows found."

**Cause:** Either the Google Sheet ID is not configured, the sheet tab name does not match, the sheet is empty, or the data is not in the expected columns.

**Fix:**
1. Make sure there is data in the Google Sheet and that the rows start in row 2 (row 1 is the header).
2. Check that the data is in the columns your team agreed on with Toros (Vendor in column A, Description in B, etc.).
3. Go to **Settings** and check the Google Sheets section. Confirm the Sheet ID is entered correctly.

**If that does not work:** Contact Toros. The column mapping or sheet ID may need to be updated in Settings.

---

## Google Sheets "Test Connection" Fails

**Problem:** On the Import from Sheets tab or in Settings, you click "Test Connection" and see a failure or error message.

**Cause:** The platform cannot access the Google Sheet. This is usually because the Sheet ID is wrong, the sheet is not shared with the service account, or the sheet has been deleted.

**Fix:**
1. Double-check the Sheet ID in Settings. The Sheet ID is the long string of letters and numbers in the Google Sheets URL between `/d/` and `/edit`.
2. Make sure the Google Sheet is set to "Anyone with the link can view" or is shared with the service account email that Toros configured.
3. Confirm the sheet still exists in Google Drive.

**If that does not work:** Contact Toros with the Sheet ID and the exact error message you see.

---

## AI Chat Says "Unavailable" or Does Not Respond

**Problem:** You type a message in AI Chat and get a response saying the AI is unavailable, or the chat does not respond at all.

**Cause:** The local AI service (Ollama) is not running, and the cloud AI backup is also unavailable or not configured.

**Fix:**
1. Go to **System Health** and check the Ollama and Claude API rows.
2. If Ollama is red, the local AI is not running. The app may still work with the cloud AI, but if both are unavailable, the chat will not work.
3. Refresh the page and try again.

**If that does not work:** Contact Toros. The AI service needs to be restarted on the server. The rest of the platform (creating POs, approving, importing) still works even when AI Chat is unavailable.

---

## Settings Won't Save

**Problem:** You make a change in Settings, click Save, and either see an error or the changes disappear when you reload the page.

**Cause:** A connection issue prevented the settings from being written to the database, or you may not have clicked the Save button.

**Fix:**
1. Make sure you clicked the **Save** button after making your changes. Look for a green confirmation message.
2. Check your internet connection.
3. Go to System Health and check the Firestore row. If it is red, the database is not accessible and nothing can be saved.
4. Try refreshing the page, making the change again, and saving.

**If that does not work:** Contact Toros with a description of what setting you tried to change and what error (if any) appeared.

---

## Page Is Very Slow

**Problem:** Pages take more than 10 to 15 seconds to load, or actions like submitting a PO take a very long time.

**Cause:** The app may be under heavy load, your internet connection may be slow, or one of the backend services may be responding slowly.

**Fix:**
1. Check your internet speed by opening another website or running a speed test.
2. Try refreshing the page.
3. Go to System Health. If any service shows a high latency or yellow status, that service may be slowing things down.
4. Wait a few minutes and try again.

**If that does not work:** Contact Toros and describe which page or action is slow.

---

## "Token Expired" Error

**Problem:** You see an error message that says something like "Token expired," "Access token has expired," or the QBO API shows "expired" on System Health.

**Cause:** The QuickBooks connection uses a temporary access token that expires after 60 minutes of inactivity. The platform normally refreshes this automatically, but occasionally it needs to be done manually.

**Fix:**
1. Go to **Settings**, then the **QBO Connect** section.
2. Click **Refresh Token**. This gets a new access token using the stored refresh token, without requiring you to log in to QuickBooks again.
3. If Refresh Token succeeds, try your action again.
4. If Refresh Token fails, click **Connect to QuickBooks** and log in again to establish a fresh connection.

**If that does not work:** Contact Toros. The refresh token itself may have expired (this happens if the platform has not been used for an extended period).

---

## Can't Approve a Draft

**Problem:** You go to Pending Drafts and click Approve, but nothing happens, or you see an error.

**Cause:** The most common causes are: the QBO connection is not active, the vendor or items in the draft no longer exist in QuickBooks, or there was a network issue.

**Fix:**
1. Check System Health and confirm QBO API is green.
2. If QBO shows red or disconnected, reconnect first (see "Not Connected" error above), then try approving again.
3. Open the draft and check that the vendor and all items listed still exist in QuickBooks. If a vendor or item was deleted from QuickBooks, the PO cannot be created.
4. Refresh the page and try again.

**If that does not work:** Take a screenshot of the error message and the draft details, then contact Toros.

---

*For any issue not listed here, contact Toros Asik with a description of the problem and a screenshot if possible.*
