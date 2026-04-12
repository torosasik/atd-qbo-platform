# Fix PO Vendor Dropdown, Order Prefill, and Ollama Default

## Issue 1: Vendor Dropdown Fails to Load (CRITICAL)

### Root Cause
`PurchaseOrders.jsx:1669` reads `mappingsRes.mappings?.vendors` but `sendSuccess()` in `middleware.js:55` wraps data under `.data`, so the actual path is `mappingsRes.data.mappings.vendors`.

### Fix
- **File:** `frontend/src/pages/PurchaseOrders.jsx:1669`
- **Change:** `mappingsRes.mappings?.vendors` → `mappingsRes.data?.mappings?.vendors`
- **AC:** Vendor dropdown populates with active vendors including Daltile

### Secondary Bug: health-routes.js QBO_TOKENS_DOC undefined
- `health-routes.js:6` imports `QBO_TOKENS_DOC` from `qbo-auth.js` — not exported there
- It's exported from `google-auth.js:99`
- Fix: change import source or export from both modules

## Issue 2: PO Form Doesn't Pre-populate Order Data

### Root Cause
`Orders.jsx:460` passes `{ state: { prefillRows: selectedRows } }` via `navigate()`, but `PurchaseOrders.jsx` never reads `location.state`.

### Fix
1. Import `useLocation` in `PurchaseOrders.jsx`
2. Read `location.state?.prefillRows`
3. Pass to `CreateTab` as prop
4. Map order row fields to PO form fields:
   - Vendor column → vendor lookup via `shopify_code` mapping
   - SKU column → `sku`
   - Item Name column → `description` / `itemName`  
   - Qty column → `qty`
- **AC:** Selecting order rows → Create PO → form pre-filled with order data

## Issue 3: Ollama Default Should Be Off

### Root Cause
`settings.js:61` has `ollama_enabled: true` — AI review fails with error when Ollama isn't running.

### Fix
- **File:** `functions/core/settings.js:61`
- **Change:** `ollama_enabled: true` → `ollama_enabled: false`
- `ai-router.js` already returns `{ answer: '', confidence: 0, source: 'none' }` when all providers unavailable
- **AC:** AI review gracefully skips without error when Ollama is off

## Files to Modify

### Parallelizable Group A — Backend
- `functions/core/settings.js` — ollama default
- `functions/api/health-routes.js` — QBO_TOKENS_DOC import fix

### Parallelizable Group B — Frontend  
- `frontend/src/pages/PurchaseOrders.jsx` — vendor path fix + prefill logic

### Sequential
- Run smoke tests after all changes
