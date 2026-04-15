# ATD QBO Platform: 5-Fix Deployment Plan

## Context

Fixing 5 issues in the ATD QBO Platform (React + Firebase + Node.js Cloud Functions). After each fix group, build, deploy, and verify.

---

## ISSUE 1: Dashboard — Replace placeholder with useful KPI widgets

**Files to modify:**
- `frontend/src/pages/NewDashboard.jsx` — redesign OverviewSection

### 1.1 Build PO Activity Widgets (top row — 4 stat cards)

Add to `OverviewSection` component:

| Card | Color | Data Source | Click Action |
|------|-------|-------------|--------------|
| POs Created Today | blue `#0462AC` | Count `purchase_orders` where `createdAt` >= today midnight | None |
| Drafts | gray | Count `po_drafts` where `status === 'pending'` | None |
| Pending Sync | orange | Count `po_drafts` where `status === 'pending'` OR `status === 'queued'` | None |
| Failed | red | Count `po_drafts` where `status === 'error'` OR `status === 'failed'` | Navigate to `/purchase-orders?filter=failed` |

**API calls needed (new backend endpoints):**
- `GET /api/po/stats` → returns `{ todayCreated, drafts, pendingSync, failed }`
- Implement in `functions/api/po-routes.js`

### 1.2 Build Connection Status Panel (middle row)

| Indicator | Green Condition | Orange/Red Condition |
|-----------|-----------------|----------------------|
| QuickBooks | `settings/qbo_tokens` has `access_token` AND `token_expires_at` > now | No token or expired |
| AI Assistant | `GET /api/health` returns AI status "connected" | AI off/unavailable |
| Vendor List | `settings/sync_status.vendors_last_synced` exists | Never synced (show "Never synced" + orange dot) |
| Product/Item List | `settings/sync_status.items_last_synced` exists | Never synced |

- Green dot = `#22c55e`, Orange dot = `#f97316`, Gray dot = `#6b7280`, Red dot = `#ef4444`

### 1.3 Build Recent Activity (bottom row)

- Call `GET /api/activity-log?limit=5`
- Show timestamp, action text, type badge
- If collection empty, show "No recent activity."

### 1.4 Add skeleton loaders

While loading each section, show animated gray placeholder divs:
```jsx
<div className="animate-pulse bg-gray-200 rounded h-20 w-full" />
```

---

## ISSUE 2: Orders Page — Fix data not loading / not refreshing

**Files to modify:**
- `frontend/src/pages/Orders.jsx`
- `frontend/src/utils/api.js`

### 2.1 Add order count to toolbar

Line ~679 already shows "X rows from Google Sheets". Ensure this displays the actual count from `rows.length` and shows next to Refresh button.

### 2.2 Ensure Refresh button works correctly

The Refresh button at line 714 calls `loadData()`. Verify this bypasses any client-side caching and re-fetches from `/api/sheets/orders`.

### 2.3 Ensure auto-refresh is working

Lines 492-498 already have `setInterval(loadData, 5 * 60 * 1000)`. Verify the interval is cleared on unmount.

### 2.4 Fix cache busting (if needed)

Add `?bust=${Date.now()}` to the API call in `api.getOrders()` to force fresh data:
```js
getOrders: () => api.get(`/sheets/orders?t=${Date.now()}`),
```

### 2.5 Add "Orders refreshed" toast

When Refresh button is clicked and data loads successfully, show toast: "Orders refreshed at [time]"

---

## ISSUE 3: Purchase Orders Page — Fix "Import from Sheets" section

**Files to modify:**
- `frontend/src/pages/PurchaseOrders.jsx` — redesign `ImportFromSheetsTab`
- `functions/api/sheets-routes.js` — add date range support to preview endpoint
- `functions/api/po-routes.js` — ensure bulk-create endpoint exists

### 3.1 Step 1 — Select Sheet Range

- Text input pre-filled with configured Google Sheet tab name (from settings)
- Date range picker: "From Date" and "To Date" inputs
- "Preview" button → `GET /api/sheets/preview?from=DATE&to=DATE`
- Update backend to support `from` and `to` query params

### 3.2 Step 2 — Preview Orders

- Show table: Order #, SKU, Qty, Vendor columns
- Row count: "X orders found"
- "Select All" checkbox + individual checkboxes
- "Create POs for Selected" button (disabled until 1+ selected)

### 3.3 Step 3 — Create POs

- POST selected rows to `POST /api/po/bulk-create`
- Show progress: "Processing X of Y..."
- Summary: "X POs created, Y failed" with links

### 3.4 Backend: Add date range support to preview

In `functions/api/sheets-routes.js` `GET /preview`:
- Accept `from` and `to` query params
- Filter rows by date column if params provided

### 3.5 Backend: Ensure bulk-create endpoint exists

`POST /api/po/bulk-create` already exists at lines 214-241 in `po-routes.js`. Verify it accepts array of PO data and returns `{ created, failed, errors }`.

---

## ISSUE 4: Business Rules Page — Fix "failed precondition" error

**Files to modify:**
- `firestore.indexes.json` — add missing composite index
- `frontend/src/pages/Rules.jsx` — add human-readable error UI

### 4.1 Add missing Firestore composite index

The query in `functions/api/rules.js` line 86:
```js
query = query.where('vendor', '==', ...).where('type', '==', ...).where('active', '==', ...).orderBy('updated_at', 'desc')
```

Add to `firestore.indexes.json`:
```json
{
  "collectionGroup": "business_rules",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "vendor", "order": "ASCENDING" },
    { "fieldPath": "type", "order": "ASCENDING" },
    { "fieldPath": "active", "order": "ASCENDING" },
    { "fieldPath": "updated_at", "order": "DESCENDING" }
  ]
}
```

### 4.2 Add human-readable error UI to Rules.jsx

Add error display component:
```jsx
{error && (
  <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 text-sm">
    <div className="flex items-start gap-2">
      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
      <div>
        <p className="font-medium text-yellow-800">Failed to load rules</p>
        <p className="text-yellow-700 mt-1">{humanizeError(error)}</p>
      </div>
    </div>
    <button onClick={loadData} className="mt-2 text-xs font-semibold text-yellow-800 bg-yellow-100 hover:bg-yellow-200 px-2.5 py-1 rounded">
      Try Again
    </button>
  </div>
)}
```

---

## ISSUE 5: General — Human-readable error messages

**Files to modify:**
- `frontend/src/utils/api.js` — add `humanizeError()` helper
- Search and update all `setError()` calls across pages

### 5.1 Add humanizeError helper to api.js

```js
export function humanizeError(err) {
  if (!err) return 'An unknown error occurred.';
  const msg = err.message || err.toString();
  if (msg.includes('FAILED_PRECONDITION')) return 'Database index is being built. Please wait a moment and try again.';
  if (msg.includes('PERMISSION_DENIED')) return 'You do not have permission to do this. Check your QuickBooks connection.';
  if (msg.includes('NOT_FOUND')) return 'The requested data was not found.';
  if (msg.includes('UNAVAILABLE')) return 'Service temporarily unavailable. Please try again in a moment.';
  if (msg.includes('UNAUTHENTICATED')) return 'Session expired. Please reconnect QuickBooks.';
  if (msg.includes('fetch')) return 'Could not reach the server. Check your internet connection.';
  return msg;
}
```

### 5.2 Apply humanizeError in Rules.jsx

In `Rules.jsx`, change:
```js
setError(err.message || 'Failed to load rules');
```
To:
```js
setError(humanizeError(err));
```

### 5.3 Search for other setError calls

Find all pages with `setError(` and ensure they use `humanizeError()`:
- `grep -r "setError(" frontend/src/pages/`
- Apply `humanizeError()` to each

---

## Deployment Workflow

### After Issues 1 + 2 (Dashboard + Orders):
```bash
cd /Users/torosasik/Projects/atd-qbo-platform
cd frontend && npm run build && cd ..
firebase deploy --only hosting
git add -A && git commit -m "fix: dashboard KPIs, orders refresh, human-readable errors"
git push origin main
```

### After Issues 3 + 4 (Import from Sheets + Business Rules):
```bash
cd /Users/torosasik/Projects/atd-qbo-platform
cd frontend && npm run build && cd ..
firebase deploy --only hosting,functions
git add -A && git commit -m "fix: import from sheets UX, business rules precondition error"
git push origin main
```

---

## Acceptance Criteria

### Issue 1 - Dashboard
- [ ] 4 PO Activity stat cards visible in top row
- [ ] Connection Status panel with colored dots visible
- [ ] Recent Activity showing last 5 entries
- [ ] Skeleton loaders while data loads

### Issue 2 - Orders
- [ ] Refresh button triggers re-fetch
- [ ] Order count displayed in toolbar
- [ ] Auto-refresh every 5 minutes
- [ ] "Orders refreshed" toast on manual refresh

### Issue 3 - Import from Sheets
- [ ] 3-step UI: Select Range → Preview → Create
- [ ] Date range picker functional
- [ ] Row selection with checkboxes
- [ ] Bulk create shows progress and summary

### Issue 4 - Business Rules
- [ ] Rules page loads without FAILED_PRECONDITION error
- [ ] Human-readable error message shown if error occurs
- [ ] "Try Again" button re-fetches data

### Issue 5 - Human-readable errors
- [ ] No raw Firestore gRPC codes shown to users
- [ ] All `setError()` calls use `humanizeError()`
