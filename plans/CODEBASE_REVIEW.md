# Full Codebase Review — ATD QBO Platform

## Review Date: 2026-04-01
## Reviewer: Kilo Code (Architect Mode)

---

## Executive Summary

The codebase is well-structured for a Firebase-based platform with a React frontend and Express-based Cloud Functions backend. The project has solid fundamentals—clean separation of concerns, consistent error handling patterns, and a good logging system. However, the audit uncovered **3 critical/high-priority bugs**, **4 medium-priority issues**, and several code quality improvements.

---

## Critical & High Priority Findings

### 1. QBO Cache Queries Limited to 100 Results (CRITICAL)

**File:** `functions/core/cache.js` lines 108-111  
**Issue:** The `SELECT * FROM Item`, `SELECT * FROM Vendor`, and `SELECT * FROM Account` queries use the QBO query endpoint without pagination. QBO's default `maxResults` is 100. Companies with >100 items or vendors will silently miss records.

**Impact:** Tile retailers often have hundreds of items. The item search dropdown can only find the first 100 items, making the rest invisible and impossible to select when creating POs.

**Fix:** Implement paginated QBO queries using `STARTPOSITION` and `MAXRESULTS` to fetch all records in batches.

---

### 2. Internal Objects Leaked to Firestore Drafts (HIGH)

**File:** `functions/modules/purchase-order/index.js` lines 325-330  
**Issue:** When saving a draft, the entire `resolvedData` object (which contains `_matchedVendor` and `_matchedItem` internal references from QBO cache) is spread into the Firestore document. These are large objects with full QBO vendor/item data.

**Impact:** Bloated Firestore documents, potential data inconsistency if cache changes, unnecessary storage costs.

**Fix:** Strip `_matchedVendor` and `_matchedItem` internal fields before saving to `po_drafts`.

---

### 3. NonInventory Item Creation Missing Required Account Refs (HIGH)

**File:** `functions/api/routes.js` lines 148-165  
**Issue:** When creating NonInventory items via `POST /items/create`, the code only specifies `IncomeAccountRef` for Inventory items. NonInventory items require either `IncomeAccountRef` or `ExpenseAccountRef` to be created in QBO.

**Impact:** Creating NonInventory items will fail with a QBO API error about missing required fields.

**Fix:** Add `ExpenseAccountRef` for NonInventory items (cost of goods sold or expense account).

---

## Medium Priority Findings

### 4. Vendor Sync Returns Stale Cache (MEDIUM)

**File:** `functions/api/routes.js` line 565  
**Issue:** The `/vendor-mappings/sync` endpoint calls `getCachedVendors(realmId)`. If the cache is still fresh (within 24-hour TTL), it returns stale data rather than fetching fresh data from QBO. This defeats the purpose of a sync.

**Fix:** Use `refreshVendors(realmId)` instead of `getCachedVendors(realmId)` in the sync endpoint.

---

### 5. Missing 404 Catch-All Route (MEDIUM)

**File:** `frontend/src/App.jsx`  
**Issue:** No catch-all route for unmatched URLs. Navigating to an invalid path shows a blank page.

**Fix:** Add a `<Route path="*" element={<Navigate to="/" />} />` catch-all.

---

### 6. Hardcoded APAccountRef in PO Payload (MEDIUM)

**File:** `functions/modules/purchase-order/index.js` line 198-201  
**Issue:** The `buildPayload` function hardcodes `APAccountRef: { value: '33', name: 'Accounts Payable (A/P)' }`. This assumes account ID 33 exists in every QBO company.

**Fix:** Make this configurable via settings (`default_ap_account`), with fallback to the hardcoded value.

---

### 7. Leftover Test File (LOW)

**File:** `greet_and_date.js`  
**Issue:** Appears to be a leftover test/scratch file not used by the application.

**Fix:** Delete it.

---

## Code Quality Observations

### Good Patterns Observed
- Consistent `{ success, error }` response shape across all API endpoints
- Global error handler in `functions/index.js` with error codes and fix suggestions
- Logger that never throws (safe `try/catch` wrapping)
- AI router with graceful fallback chain (Ollama → Claude → None)
- Deep merge for settings with auto-migration of new default keys
- CSRF state token for OAuth callback
- Proper use of Firestore server timestamps

### Areas for Future Improvement
- **Code duplication:** `StatusBadge` and `formatDateTime` are duplicated in `Dashboard.jsx` and `PurchaseOrders.jsx`
- **File size:** `PurchaseOrders.jsx` is 1400+ lines — could be split into sub-components
- **No authentication middleware:** API routes are publicly accessible (acceptable for internal tool but a risk if exposed)
- **No rate limiting:** No rate limiting on any endpoints
- **Firestore indexes:** The `/po/history` query needs a composite index (`module` + `action` + `timestamp`)

---

## Implementation Plan

1. Fix QBO cache pagination (cache.js)
2. Strip internal fields from draft saves (purchase-order/index.js)  
3. Fix NonInventory item creation (routes.js)
4. Force refresh in vendor sync (routes.js)
5. Add 404 route (App.jsx)
6. Delete greet_and_date.js
7. Rebuild and redeploy
