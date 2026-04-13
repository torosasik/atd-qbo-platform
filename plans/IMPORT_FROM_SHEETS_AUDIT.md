# Import from Sheets — Audit Report

**Date:** 2026-04-13  
**Auditor:** Kilo Code (Architect mode)  
**Scope:** Backend diagnostics, frontend UI states, API client

---

## 1. Backend Diagnostics — [`sheets-routes.js`](../functions/api/sheets-routes.js)

### 1.1 Preview endpoint diagnostic states

| # | Scenario | Status | Details |
|---|----------|--------|---------|
| 1 | No sheet configured | ✅ PASS | Line 237-245: Returns `code: 'NO_SHEET_CONFIGURED'` with fix text. HTTP 400. |
| 2 | Sheet not found | ✅ PASS | [`classifySheetsError()`](../functions/api/sheets-routes.js:99) line 105-112: Returns `code: 'SHEET_NOT_FOUND'`, HTTP 404. |
| 3 | Permission denied | ✅ PASS | Line 114-121: Returns `code: 'PERMISSION_DENIED'`, HTTP 403. |
| 4 | Tab not found | ✅ PASS | Line 123-130: Returns `code: 'TAB_NOT_FOUND'`, HTTP 404. |
| 5 | Fetch failed | ✅ PASS | Line 132-149: Returns `code: 'FETCH_FAILED'`, HTTP 502. Covers timeout, network, DNS errors. |
| 6 | Sheet empty | ⚠️ PARTIAL | No explicit `SHEET_EMPTY` code. Backend returns success with `totalRows: 0`. Frontend infers empty state from `rows.length === 0`. |
| 7 | No valid rows | ⚠️ PARTIAL | No explicit `NO_VALID_ROWS` code. Backend returns success with `validRows: 0`. Frontend infers from `validRows === 0`. |
| 8 | Valid rows ready | ✅ PASS | Returns `sendSuccess` with full diagnostics object including `poGroups` count. |

### 1.2 Preview response fields

| Field | Present? | Key |
|-------|----------|-----|
| sheetId | ✅ | `diagnostics.sheetId` |
| tabName | ✅ | `diagnostics.tabName` |
| totalRows | ✅ | `diagnostics.totalRows` |
| validRows | ✅ | `diagnostics.validRows` |
| invalidRows | ✅ | `diagnostics.invalidRows` |
| poGroups | ✅ | `diagnostics.poGroups` |
| invalidReasons | ✅ | `diagnostics.invalidReasons` — array of `{reason, count}` |
| checkedTime | ✅ | `diagnostics.checkedAt` — note: named `checkedAt` not `checkedTime` |

### 1.3 Import endpoint response fields

| Field | Present? | Key |
|-------|----------|-----|
| importedCount | ✅ | `imported` |
| skippedCount | ✅ | `skipped` |
| draftIds | ✅ | `draftIds` — array of Firestore doc IDs |
| skippedReasons | ✅ | `skippedReasons` — array of `{reason, count}` |

### 1.4 Error response consistency

✅ PASS — All classified errors follow the shape `{ success: false, error, code, fix }` via [`sendClassifiedSheetsError()`](../functions/api/sheets-routes.js:159). HTTP status codes are appropriate (400, 403, 404, 502, 500).

---

## 2. Frontend UI — [`PurchaseOrders.jsx`](../frontend/src/pages/PurchaseOrders.jsx)

### 2.1 Diagnostic state handling in [`ImportFromSheetsTab`](../frontend/src/pages/PurchaseOrders.jsx:1586)

| # | State | Handled? | Location | Details |
|---|-------|----------|----------|---------|
| 1 | No sheet configured | ✅ | Line 1618-1622 | `NO_SHEET_CONFIGURED` → icon, title, message, Go to Settings link |
| 2 | Sheet not found | ✅ | Line 1623-1627 | `SHEET_NOT_FOUND` → icon, title, message, Go to Settings link |
| 3 | Permission denied | ✅ | Line 1628-1632 | `PERMISSION_DENIED` → icon, title, message, Go to Settings link |
| 4 | Tab not found | ✅ | Line 1633-1637 | `TAB_NOT_FOUND` → icon, title, message, Go to Settings link |
| 5 | Fetch failed | ✅ | Line 1638-1642 | `FETCH_FAILED` → icon, title, message, Retry button |
| 6 | Sheet empty | ✅ | Line 1653-1658 | Checks `rows.length === 0`, shows message |
| 7 | No valid rows | ✅ | Line 1661-1666 | Checks `validRows === 0`, shows count |
| 8 | Valid rows ready | ✅ | Returns `null` from `getStateCard()`, shows preview table + Import button |

### 2.2 Plain-English explanations and next steps

| State | Explanation | Next Step | Status |
|-------|-------------|-----------|--------|
| NO_SHEET_CONFIGURED | "You haven't connected a Google Sheet yet." | Go to Settings link | ✅ |
| SHEET_NOT_FOUND | "The configured sheet ID doesn't match any Google Sheet." | Go to Settings link | ✅ |
| PERMISSION_DENIED | "The app doesn't have permission to read this sheet." | Go to Settings link | ✅ |
| TAB_NOT_FOUND | "The tab name in your settings doesn't match any tab." | Go to Settings link | ✅ |
| FETCH_FAILED | "Couldn't reach Google Sheets right now." | Retry button | ✅ |
| Sheet empty | "Your Google Sheet is connected but has no data rows." | Go to Settings link | ✅ |
| No valid rows | "Found X rows but none have the required fields." | Go to Settings link | ✅ |
| Generic error | Shows `preview.error` | Shows `preview.fix` if available | ✅ |

### 2.3 Helper text

| Check | Status | Location |
|-------|--------|----------|
| What Load from Google Sheets does | ✅ | Line 1753: "Reads your connected sheet and shows a preview." |
| What Import All as Drafts does | ✅ | Line 1766: "Creates draft POs from the valid rows below." |
| What happens after import | ✅ | Line 1738: "Review and approve them in the Pending Drafts tab." |
| How It Works collapsible section | ✅ | Lines 1727-1741: Step-by-step numbered list |

### 2.4 Post-import results display

| Check | Status | Details |
|-------|--------|---------|
| Imported count shown | ✅ | Line 1820: "Imported X draft purchase orders" |
| Skipped count shown | ✅ | Line 1822: "Skipped X row/groups" with first reason |
| Draft IDs shown | ❌ FAIL | Backend returns `draftIds` array but frontend never displays them. Line 1701-1705 extracts `imported`, `skipped`, `skippedReasons` but ignores `draftIds`. |
| Skipped reasons shown | ✅ | Line 1822: Shows first skipped reason inline |

### 2.5 Jump to Pending Drafts after import

| Check | Status | Details |
|-------|--------|---------|
| Link/button present | ✅ | Line 1824: "Go to Pending Drafts to review and approve them →" |
| Implementation quality | ⚠️ PARTIAL | [`goToPendingDrafts()`](../frontend/src/pages/PurchaseOrders.jsx:1672) uses `document.querySelectorAll('button')` to find the tab by text content, then `.click()`. This is fragile DOM manipulation. Should use React state via a callback prop. |

### 2.6 Non-technical user understandability

✅ PASS — The "How It Works" section, state cards with emoji icons, plain-English messages, and clear action links make this understandable without technical knowledge.

---

## 3. API Client — [`api.js`](../frontend/src/utils/api.js)

### 3.1 Sheets API calls defined

| Call | Defined? | Line |
|------|----------|------|
| `testSheetConnection` | ✅ | Line 124: `api.get('/sheets/test-connection')` |
| `previewSheetData` | ✅ | Line 125: `api.get('/sheets/preview')` |
| `importFromSheets` | ✅ | Line 126: `api.post('/sheets/import', {})` |

### 3.2 Error handling

| Check | Status | Details |
|-------|--------|---------|
| Non-OK responses throw | ✅ | Line 41-48: Throws `Error` with `status`, `code`, `fix`, `data` |
| JSON parse failures handled | ✅ | Lines 13-39: Catches parse errors, provides fallback message |
| Backend `code` preserved | ✅ | Line 44: `err.code = data.code` |
| Backend `fix` preserved | ✅ | Line 45: `err.fix = data.fix` |

---

## 4. Issues Found — Ordered by Priority

### P1: Draft IDs not displayed after import

- **File:** [`frontend/src/pages/PurchaseOrders.jsx`](../frontend/src/pages/PurchaseOrders.jsx:1701)
- **Line:** 1701-1705
- **Problem:** `handleImportAll()` extracts `imported`, `skipped`, `skippedReasons` from the response but never extracts or displays `draftIds`. The backend returns them at [`sheets-routes.js:420`](../functions/api/sheets-routes.js:420).
- **Fix:** Extract `draftIds` in `handleImportAll()` and display them in the success result card, or make them available via a "View Drafts" action.
- **Acceptance:** After import, user can see which draft IDs were created.

### P2: No explicit backend codes for SHEET_EMPTY and NO_VALID_ROWS

- **File:** [`functions/api/sheets-routes.js`](../functions/api/sheets-routes.js:254)
- **Line:** 254-268
- **Problem:** When the sheet is empty or has no valid rows, the backend returns HTTP 200 with `validRows: 0`. No explicit `code` field is set. The frontend must infer the state by checking `rows.length === 0` or `validRows === 0`. This creates a coupling — if the frontend logic changes, states could be misidentified.
- **Fix:** After computing `validRows` and `invalidRows`, add conditional diagnostic codes:
  - If `rows.length === 0`: set `code: 'SHEET_EMPTY'` in diagnostics
  - If `rows.length > 0 && validRows === 0`: set `code: 'NO_VALID_ROWS'` in diagnostics
- **Acceptance:** Backend response includes an explicit `code` for every state, not just error states.

### P3: goToPendingDrafts uses fragile DOM manipulation

- **File:** [`frontend/src/pages/PurchaseOrders.jsx`](../frontend/src/pages/PurchaseOrders.jsx:1672)
- **Line:** 1672-1676
- **Problem:** `document.querySelectorAll('button')` + text match + `.click()` will break if the tab label changes or if React re-renders the button text differently.
- **Fix:** Pass an `onSwitchToDrafts` callback prop from the parent `PurchaseOrders` component to `ImportFromSheetsTab`, similar to how `CreateTab` receives `onSwitchToHistory`. Use `setActiveTab(1)` in the parent.
- **Acceptance:** Tab switch works via React state, not DOM queries.

### P4: Skipped count mixes group-level and row-level units

- **File:** [`functions/api/sheets-routes.js`](../functions/api/sheets-routes.js:388)
- **Line:** 388
- **Problem:** `skipped = pos.length - validPos.length + mappedRows.filter(row without orderNumber).length` adds group-level skips and row-level skips into one number. The frontend displays this as "Skipped X row/groups" which is ambiguous.
- **Fix:** Return separate counts: `skippedGroups` and `skippedRows`, or clearly document the unit in the response.
- **Acceptance:** Frontend can display skipped groups and skipped rows separately.

### P5: Tab not found detection has operator precedence bug

- **File:** [`functions/api/sheets-routes.js`](../functions/api/sheets-routes.js:123)
- **Line:** 123
- **Problem:** `combined.includes('range') && combined.includes('not found')` — the `&&` binds tighter than the surrounding `||`. The condition reads as: `(combined.includes('unable to parse range')) || (combined.includes('range') && combined.includes('not found'))`. This is likely intentional but the missing parentheses make it fragile and hard to read.
- **Fix:** Add explicit parentheses: `(combined.includes('range') && combined.includes('not found'))`.
- **Acceptance:** Condition is unambiguous.

---

## 5. Summary Scorecard

| Area | Score | Notes |
|------|-------|-------|
| Backend diagnostic states | 6/8 PASS, 2 PARTIAL | Missing explicit codes for empty and no-valid-rows |
| Preview response schema | 8/8 PASS | All required fields present |
| Import response schema | 4/4 PASS | All required fields present |
| Error response consistency | PASS | Uniform shape across all error paths |
| Frontend state handling | 8/8 PASS | All states covered |
| Plain-English explanations | PASS | Clear messages with actionable next steps |
| Helper text | PASS | How It Works section + per-button descriptions |
| Post-import results | 3/4 PASS | Draft IDs not displayed |
| Jump to Pending Drafts | PARTIAL | Works but fragile implementation |
| API client | PASS | All calls defined, error handling adequate |

**Overall:** The previous agent's claims are **mostly verified**. Backend diagnostics, UI states, helper text, preview summaries, and import result handling are all implemented. Two gaps found: draft IDs not surfaced to the user, and two diagnostic states rely on frontend inference rather than explicit backend codes.
