# ATD QBO Platform — Full Platform Review

**Date**: 2026-03-31  
**Scope**: All 8 frontend pages, 5 shared components, backend API routes, and core modules  
**Previous reviews**: `UI_REVIEW_PART1.md`, `UI_REVIEW_PART2.md`, `UI_REVIEW_PART3.md`

---

## 🔴 Item Search Regression — Root Cause Analysis

### Summary
The item search in **Manual Purchase Order** is broken and returning no results. This is a regression caused by missing optional chaining in the backend cache layer.

### Chain of Failure

```
QBO returns null/malformed QueryResponse
        ↓
refreshItems() throws TypeError on `queryResponse.Item`
        ↓
getCachedItems() catch block silently returns []
        ↓
GET /items returns { success: true, items: [] }
        ↓
Frontend sets items = []
        ↓
items.length === 0 → renders "Create first item" button
        ↓
SearchableItemDropdown never mounts → search broken
```

### Root Cause

In [`cache.js` line 112](../functions/core/cache.js:112):
```js
// BROKEN — missing optional chaining:
const items = queryResponse.Item || [];

// COMPARE to refreshVendors at line 83 which works:
const vendors = queryResponse?.Vendor || [];
```

When `queryResponse` is `null` or `undefined` (auth error, rate limit, network failure), `queryResponse.Item` throws a `TypeError`. This error is caught by `getCachedItems()` which silently returns `[]`, hiding the real problem.

### Recommended Fix

**Fix 1 (Critical)** — Add optional chaining in [`cache.js:112`](../functions/core/cache.js:112):
```js
const items = queryResponse?.Item || [];
```

**Fix 2** — Also fix [`cache.js:140`](../functions/core/cache.js:140) for consistency:
```js
const accounts = queryResponse?.Account || [];
```

**Fix 3** — Stop swallowing errors in [`PurchaseOrders.jsx:1350`](../frontend/src/pages/PurchaseOrders.jsx:1350):
```js
// Before: catch {} (silent)
// After:
catch (err) {
  console.error('[PurchaseOrders] Failed to load vendors/items:', err.message);
}
```

---

## 📊 Review by Screen / Section

---

### 1. Dashboard (`/`)

**File**: [`Dashboard.jsx`](../frontend/src/pages/Dashboard.jsx)

#### 🐛 Bugs

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | **Critical** | **Duplicate health-warning banner** — Two separate `healthWarning` blocks render simultaneously (lines 150–173 and 176–211). First uses raw `"X"` text; second uses Lucide `<X>` icon. Both show at once. | Lines 150–211 |
| 2 | **Medium** | **`systemOk` defaults to `null` but icon assumes boolean** — `systemOk ? 'bg-green-500' : 'bg-red-500'` evaluates to red during initial load before data arrives, causing a misleading red flash. | Line 264 |
| 3 | **Low** | **`systemOk` set to `true` even when health is degraded** — After successful fetch, `systemOk` is set to `true` unconditionally, even when `healthRes.status` is `'degraded'` or `'unhealthy'`. | Line 105 |

#### ➕ Missing Features

- No "last updated" timestamp on stat cards
- No quick-action buttons or getting-started prompt when dashboard is empty
- Dashboard doesn't show QBO PO number in Recent Activity — only internal entity IDs

#### 💡 UX/UI Improvements

- First duplicate banner uses raw `"X"` instead of icon — inconsistent with platform style
- Large empty space below Recent Activity when no data exists
- `[...history].slice(0, 10)` unnecessarily copies array — use `history.slice(0, 10)`

---

### 2. Purchase Orders (`/purchase-orders`)

**File**: [`PurchaseOrders.jsx`](../frontend/src/pages/PurchaseOrders.jsx)

#### 🐛 Bugs

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | **Critical** | **Item search broken** (see Root Cause Analysis above) | `cache.js:112` |
| 2 | **High** | **Draft approval broken** — `handleApproveDraft` reads `draft.data` but draft data is spread at root level, not nested | `purchase-order/index.js:362` |
| 3 | **High** | **Vendor dropdown doesn't close on outside click** — No `mousedown` listener like `SearchableItemDropdown` has | Line 596 |
| 4 | **Medium** | **Import count always shows 0** — Reads `res.count` but backend returns `res.imported` | Line 1199 |
| 5 | **Medium** | **Sheet preview always empty** — Reads `res.data` but backend returns `res.rows` | Line 1187 |
| 6 | **Medium** | **`onSwitchToHistory` may redirect to empty History** if QBO push fails mid-process | Line 519 |
| 7 | **Low** | **Duplicate toast implementations** — `CreateTab` has inline toast + shared Toast component | Lines 897–908 |
| 8 | **Low** | **Silent failures on initial data load** — Empty `catch {}` in `loadLists()` | Line 1350 |

#### ➕ Missing Features

- **No "Reject" functionality for drafts** — Button exists but permanently disabled with "Coming soon"
- **No draft detail view** — Can't expand draft to see line items before approving
- **No form reset after successful submission**
- **No pagination** — History loads max 100, Drafts max 50, no controls to see more
- **No confirmation dialog for auto-approve** — Irreversible action with no confirmation step

#### 💡 UX/UI Improvements

- Line items table overflows at < 1100px — needs responsive card layout for mobile
- `SearchableItemDropdown` shows "Create new item" even when search matches existing item
- **Ship To address is hardcoded** at line 60 — should come from settings
- Vendor email lookup requires separate API call that may fail silently

---

### 3. Vendor Management (`/vendor-management`)

**File**: [`VendorManagement.jsx`](../frontend/src/pages/VendorManagement.jsx)

#### 🐛 Bugs

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | **Medium** | **Select All applies to ALL vendors, not just filtered results** — `selectAll()` maps over `vendors` (full list), not `filtered` (search-filtered subset) | Lines 93–99 |

#### ➕ Missing Features

- No unsaved changes warning when navigating away
- No bulk Shopify code editing (CSV import or pattern-based assignment)
- No count indicator showing how many vendors are active vs inactive

#### 💡 UX/UI Improvements

- Search filter only matches `qbo_name` — should also match `shopify_code` and `qbo_id`
- No visual indicator that there are unsaved changes (dirty state badge)

---

### 4. QBO Connect (`/qbo-connect`)

**File**: [`QBOConnect.jsx`](../frontend/src/pages/QBOConnect.jsx)

#### 🐛 Bugs

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | **Medium** | **"Connect to QuickBooks" uses hardcoded relative path** — `href="/api/auth/connect"` ignores `VITE_API_BASE_URL` | Line 153 |
| 2 | **Low** | **Token expiry not highlighted when expired** — Shows raw timestamp with no visual warning | Lines 131–135 |

#### ➕ Missing Features

- No token expiry countdown or warning (e.g., "Expires in 47 minutes")
- No auto-refresh of status (only fetches on mount)
- OAuth callback error/success not displayed to user — redirect params are ignored

#### 💡 UX/UI Improvements

- Add green/red status dot next to "Connection Status" heading
- Show relative time for token expiry instead of raw timestamp

---

### 5. Settings (`/settings`)

**File**: [`Settings.jsx`](../frontend/src/pages/Settings.jsx)

#### 🐛 Bugs

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | **Medium** | **Frontend/backend DEFAULT_SETTINGS out of sync** — `max_tokens`: 1024 vs 2000; `ai.review_prompt` differs; `qbo.default_memo_template` empty vs actual template; `qbo.default_po_terms` empty vs "Net 30" | Lines 35–70 vs `settings.js:7–62` |
| 2 | **Medium** | **Settings response parsing fragile** — Reads `res.data ?? res` but backend returns `res.settings` | Line 204 |
| 3 | **Low** | **`NaN` possible for number inputs** — `parseInt` on empty string produces `NaN` that gets saved | Lines 370, 383, 552, 601 |
| 4 | **Low** | **QBO token info shows static "(unavailable)"** — Never fetches real data from `/auth/status` | Lines 697–702 |

#### ➕ Missing Features

- No settings export/import for backup/migration
- No per-section dirty indicator showing unsaved changes
- Ollama status indicator is static — never actually pings Ollama
- No validation on `min_confidence` range beyond HTML attributes

#### 💡 UX/UI Improvements

- "Coming Soon" badge wraps at narrow widths — add `whitespace-nowrap`
- Header Row / Data Start Row inputs could share a line
- Reset to Defaults dialog doesn't show what will change — add diff summary

---

### 6. AI Chat (`/ai-chat`)

**File**: [`AIChat.jsx`](../frontend/src/pages/AIChat.jsx)

#### 🐛 Bugs

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | **Low** | **Stale closure in `sendMessage`** — `useCallback` depends on `[input, isLoading]` but accesses `input` directly | Lines 131–179 |
| 2 | **Low** | **Array index used as React key** — Would break if messages could be reordered/deleted | Lines 231–233 |

#### ➕ Missing Features

- **No "Clear chat" button** — Must refresh page to start over
- **No chat persistence** — Messages lost on navigation or refresh
- **No markdown rendering** — AI responses use `whitespace-pre-wrap` only
- **No copy-to-clipboard** for AI responses
- **No error retry** — Failed messages must be retyped

#### 💡 UX/UI Improvements

- AI source check runs once on mount — won't update if Ollama starts later
- Suggested prompts shown both centered AND in bottom bar on first load — redundant
- `max-w-sm lg:max-w-xl` too narrow for data-heavy responses — use `max-w-2xl`

---

### 7. System Health (`/health`)

**File**: [`HealthCheck.jsx`](../frontend/src/pages/HealthCheck.jsx)

#### 🐛 Bugs

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | **High** | **Health endpoint makes real Claude API call** — Sends `{ messages: [{ content: 'ping' }] }` to Claude on every check. With 60-second auto-refresh, that's ~1,440 paid API calls/day per open tab. | `routes.js:846–860` |
| 2 | **Low** | **Auto-refresh continues when tab is hidden** — `setInterval` doesn't check `document.visibilityState` | Line 185 |
| 3 | **Low** | **Version number inconsistency** — Sidebar hardcodes `v0.1.0`, backend returns version in health response — no single source of truth | `AppLayout.jsx:102` |

#### ➕ Missing Features

- No "Refresh Token" action button in QBO card when expired
- No visual countdown for auto-refresh (progress bar or timer)

#### 💡 UX/UI Improvements

- Service cards are single-column — use 2-column grid on wider screens
- Add `sheet_name` display alongside `sheet_id` in Google Sheets card

---

### 8. Help & Docs (`/help`)

**File**: [`Help.jsx`](../frontend/src/pages/Help.jsx)

#### 🐛 Bugs

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | **Low** | **Button label mismatch** — Help says "Submit and Approve" but actual button is "Auto Approve and Submit" | Line 150 |
| 2 | **Low** | **Outdated stat card names** — References "Approved Today" and "Total This Week" but actual names are "POs Today" and "AI Reviews Today" | Lines 114–116 |

#### ➕ Missing Features

- No documentation for Vendor Management page
- No documentation for "Create New Item" modal in PO form
- No keyboard shortcut reference

#### 💡 UX/UI Improvements

- Search results don't highlight matched terms
- Tab buttons too small at < 375px — consider vertical stacking

---

### 9. Shared Components

#### [`AppLayout.jsx`](../frontend/src/components/shared/AppLayout.jsx)
- Version `v0.1.0` hardcoded — should read from a central constant
- Mobile overlay uses `bg-opacity-50` (Tailwind v3) — may not work in v4, use `bg-black/50`

#### [`Toast.jsx`](../frontend/src/components/shared/Toast.jsx)
- Imports `useNavigate` unconditionally — crashes if rendered outside Router context
- Uses `tailwindcss-animate` classes that may leave toast invisible if plugin not installed

#### [`InfoTooltip.jsx`](../frontend/src/components/shared/InfoTooltip.jsx)
- `pointer-events-none` prevents text selection in tooltips
- Fixed `w-64` width — should be `max-w-64 w-auto`

#### [`Toggle.jsx`](../frontend/src/components/shared/Toggle.jsx)
- No `aria-checked` attribute for screen reader accessibility

---

## 🔧 Backend / API Issues

### [`routes.js`](../functions/api/routes.js)

| # | Severity | Issue |
|---|----------|-------|
| 1 | **Critical** | **No authentication middleware** — ALL routes are publicly accessible. Anyone with the API URL can modify settings, create POs, or disconnect QBO. |
| 2 | **Medium** | **PO drafts/history response shape mismatch** — Returns `{ drafts: [...] }` and `{ history: [...] }` but frontend reads `res.data ?? res` |
| 3 | **Medium** | **Vendor endpoint inconsistency** — `/vendors` returns `{ vendors }`, `/vendor-mappings` returns `{ mappings: { vendors } }` |
| 4 | **Low** | **No rate limiting** on any endpoint |
| 5 | **Low** | **Excessive console.log** in vendor sync (lines 561–622) |

### [`cache.js`](../functions/core/cache.js)

| # | Severity | Issue |
|---|----------|-------|
| 1 | **Critical** | Missing `?.` on `queryResponse.Item` (line 112) — the item search regression |
| 2 | **Medium** | Same issue on `queryResponse.Account` (line 140) — `refreshAccounts` lacks `?.` too |
| 3 | **Medium** | **No QBO item pagination** — `SELECT * FROM Item` returns max ~100 results. For 6,000+ items, need `MAXRESULTS` with pagination. |

### [`purchase-order/index.js`](../functions/modules/purchase-order/index.js)

| # | Severity | Issue |
|---|----------|-------|
| 1 | **High** | `handleApproveDraft` reads `draft.data` but data is spread at root — approval is broken |
| 2 | **Medium** | `validate()` mutates the input `data` object — impure side effects |
| 3 | **Low** | `APAccountRef` hardcoded to `{ value: '33' }` — should come from settings |

### [`settings.js`](../functions/core/settings.js)

| # | Severity | Issue |
|---|----------|-------|
| 1 | **Low** | `deepMerge` mutates target in-place — safe currently but fragile |

---

## 📊 API Response Shape Inconsistencies

The most pervasive cross-cutting issue:

| Endpoint | Backend Returns | Frontend Reads | Status |
|----------|----------------|----------------|--------|
| `GET /po/drafts` | `res.drafts` | `res.data ?? res` | ❌ Broken |
| `GET /po/history` | `res.history` | `res.data ?? res` | ❌ Broken |
| `GET /settings` | `res.settings` | `res.data ?? res` | ⚠️ Fragile |
| `GET /vendors` | `res.vendors` | `res.vendors` | ✅ Correct |
| `GET /items` | `res.items` | `res.items` | ✅ Correct |
| `GET /sheets/preview` | `res.rows` | `res.data ?? res` | ❌ Broken |
| `POST /sheets/import` | `res.imported` | `res.count` | ❌ Broken |

---

## 🎯 Priority Action Items

### P0 — Fix Before Any Use
1. ✅ Fix item search regression (`cache.js:112` — add `?.`)
2. Fix draft approval (`purchase-order/index.js:362` — read fields from root, not `draft.data`)
3. Fix API response shape mismatches (drafts, history, preview, import count)
4. Remove duplicate health warning banner (`Dashboard.jsx:150–173`)
5. Add QBO item pagination (`cache.js:110`)

### P1 — Fix Before Production
6. Add authentication middleware to all API routes
7. Stop health endpoint from making real Claude API calls
8. Fix `systemOk` logic to respect degraded/unhealthy health status
9. Sync frontend/backend default settings
10. Fix vendor dropdown outside-click behavior

### P2 — Should Add
11. Draft detail view (expand to see line items before approving)
12. Reject/delete draft functionality
13. Form reset after successful PO submission
14. Confirmation dialog for auto-approve
15. Unsaved changes warnings (Vendor Management, Settings)
16. Chat persistence and clear button
17. Markdown rendering in AI Chat responses
18. Token expiry countdown on QBO Connect

### P3 — Nice to Have
19. Pagination controls for History and Drafts
20. Responsive card layout for PO line items on mobile
21. Settings export/import
22. Bulk Shopify code editing
23. Search highlight in Help page
24. Keyboard shortcut reference
25. Loading skeletons instead of spinner text
