# ATD QBO Platform - Finalization Audit Report

**Date:** 2026-04-09  
**Auditor:** Kilo Code (Architect Mode)  
**Scope:** Full codebase audit covering security, code quality, architecture, documentation, and deployment readiness.

---

## Overall Assessment

The platform is **functional but not production-hardened**. Phase 1 was completed and deployed. Phase 2 modules (Invoices, Bills, Payments, Expenses) have full backend and frontend code but need end-to-end testing. The codebase has solid fundamentals but carries several security risks, coding convention violations, dead code, and oversized files that should be addressed before this is treated as production-ready.

---

## 1. SECURITY ISSUES (Must Fix)

### 1.1 No Authentication on API Routes
- **Location:** [`functions/index.js`](../functions/index.js:28) - Express app has no auth middleware
- **Risk:** All API routes are publicly accessible. Anyone who knows the URL can read/write settings, create POs, access vendor data, disconnect QBO, etc.
- **Fix:** Add Firebase Auth middleware (or at minimum an API key check) to protect all `/api/*` routes. For an internal-only tool, at least add IP allowlisting or a shared secret header.

### 1.2 Firestore Rules Are Too Permissive
- **Location:** [`firestore.rules`](../firestore.rules:5) - `allow read, write: if request.auth != null`
- **Risk:** Any authenticated Firebase user can read/write ALL documents. There are no collection-level rules, no field validation, no role-based access.
- **Fix:** Write granular rules per collection (settings, drafts, logs, cache, qbo_tokens). The `settings/qbo_tokens` document containing OAuth tokens should have restricted write access.

### 1.3 Hardcoded QBO Account IDs
- **Location:** [`routes.js`](../functions/api/routes.js:673) - `value: '80'`, `value: '81'`, `value: '67'` hardcoded for item creation
- **Location:** Multiple modules use `value: '1'` as fallback ItemRef
- **Risk:** These account IDs are specific to the current QBO company. They will break if the company chart of accounts changes or if used with a different QBO company.
- **Fix:** Make these configurable via settings (e.g., `qbo.default_income_account`, `qbo.default_expense_account`, `qbo.default_cogs_account`).

### 1.4 Hardcoded Google Sheet ID in Default Settings
- **Location:** [`settings.js`](../functions/core/settings.js:9) - `po_sheet_id: '1TJDsUcabGjC4kYmQAdVAH2CJACN5D9jrjnsUVlp1W9U'`
- **Risk:** Real Sheet ID committed to source code. If the repo becomes public, anyone can attempt to access the sheet.
- **Fix:** Set default to empty string `''`; require configuration via Settings UI.

---

## 2. BUGS AND ERRORS (Must Fix)

### 2.1 Missing Favicon File
- **Location:** [`index.html`](../frontend/index.html:5) references `/atd-icon.svg` but no such file exists in the project
- **Impact:** 404 on every page load for the favicon
- **Fix:** Add the SVG favicon file to `frontend/public/` directory, or remove the favicon link.

### 2.2 Vite Proxy Path Mismatch
- **Location:** [`vite.config.js`](../frontend/vite.config.js:8) proxies `/api` to `http://localhost:5001`
- **Issue:** The Firebase emulator serves functions at `http://localhost:5001/atd-qbo-platform/us-central1/api`, not at `http://localhost:5001/api`. The proxy target needs to include the function path prefix.
- **Fix:** Update the proxy `rewrite` or target to match the emulator URL pattern.

### 2.3 README Module Statuses Are Outdated
- **Location:** [`README.md`](../README.md:7) says Invoices, Bills, Payments are "Coming soon"
- **Reality:** All these modules have full backend and frontend implementations
- **Fix:** Update README to reflect current status.

### 2.4 CLAUDE.md Architecture Section Is Outdated 
- **Location:** [`CLAUDE.md`](../CLAUDE.md:53) shows flat module files (purchase-order.js, invoice.js) but actual structure uses directories (purchase-order/index.js, invoice/index.js)
- **Fix:** Update the architecture tree to match reality.

### 2.5 CLAUDE.md Module Statuses Are Outdated
- **Location:** [`CLAUDE.md`](../CLAUDE.md:139) shows Invoice/Bill/Payment as "Building", Vendor Management as "Planned"
- **Reality:** All are implemented. Vendor Management page exists.
- **Fix:** Update the roadmap table.

---

## 3. CODING CONVENTION VIOLATIONS (Should Fix)

### 3.1 Em Dashes in User-Facing Text (15 instances)
- **Rule:** CLAUDE.md says "No em dashes in any user-facing text"
- **Files affected:**
  - [`Settings.jsx`](../frontend/src/pages/Settings.jsx:414) - 1 instance
  - [`Expenses.jsx`](../frontend/src/pages/Expenses.jsx:453) - 8 instances (used as empty-value placeholder)
  - [`QBOConnect.jsx`](../frontend/src/pages/QBOConnect.jsx:228) - 1 instance
  - [`Help.jsx`](../frontend/src/pages/Help.jsx:142) - 2 instances
  - [`AppLayout.jsx`](../frontend/src/components/shared/AppLayout.jsx:23) - 1 instance (in code comment, less critical)
  - [`AIChat.jsx`](../frontend/src/pages/AIChat.jsx:179) - 2 instances (in code comments)
  - [`PurchaseOrders.jsx`](../frontend/src/pages/PurchaseOrders.jsx:1611) - 1 instance (in code comment)
- **Fix:** Replace all `—` with `-` or reword using commas/colons/periods.

### 3.2 Inconsistent Error Handling in Frontend
- **Issue:** `console.error` used in 11 places across frontend components instead of displaying errors to users via Toast
- **Fix:** Replace raw `console.error` with proper Toast notifications or at minimum structured error logging.

---

## 4. DEAD CODE AND UNUSED FILES (Should Clean Up)

### 4.1 Empty Directories
- `frontend/src/modules/` - empty directory, never used
- `frontend/src/shared/` - empty directory, never used
- **Fix:** Delete both empty directories.

### 4.2 `notes.md` Is a Scratch File
- **Location:** [`notes.md`](../notes.md:1) - 131-line task description that was already executed
- **Fix:** Delete or move to `plans/` archive.

### 4.3 `plans/G.js` Referenced in .gitignore
- **Location:** [`.gitignore`](../.gitignore:48) has `plans/G.js` entry
- **Issue:** Suggests there was/is a scratch JS file in plans. The gitignore entry is fine but unusual.
- **Fix:** Verify file doesn't exist; clean the gitignore entry if not needed.

### 4.4 `comingSoonItems` Array Is Empty
- **Location:** [`AppLayout.jsx`](../frontend/src/components/shared/AppLayout.jsx:41) - `const comingSoonItems = [];`
- **Issue:** The "Coming Soon" section renders with a divider and header but no items, creating an empty section with just a header.
- **Fix:** Either remove the Coming Soon section entirely or populate it with planned features (e.g., Notifications).

### 4.5 Stale Documentation Files
- `docs/FRONTEND_REVIEW.md`, `docs/FULL_PLATFORM_REVIEW.md`, `docs/UI_REVIEW_PART1-3.md` are review documents from earlier phases
- **Decision:** Keep for reference or archive; they document the review process but contain fixes that have already been applied.

---

## 5. ROUTES FILE IS A MONOLITH (Code Quality)

### 5.1 `routes.js` Is 1,644 Lines
- **Location:** [`functions/api/routes.js`](../functions/api/routes.js:1) at 58,051 chars
- **Issue:** Every API route for every module (PO, Invoice, Bill, Payment, Expense, Vendor, Auth, Health, Settings, Sheets, Items, Accounts) is in a single file.
- **Fix:** Split into route groups: `routes/po.js`, `routes/invoice.js`, `routes/bill.js`, `routes/payment.js`, `routes/expense.js`, `routes/vendor.js`, `routes/auth.js`, `routes/health.js`, `routes/settings.js`, `routes/sheets.js`.

### 5.2 Frontend Page Files Are Very Large
- [`PurchaseOrders.jsx`](../frontend/src/pages/PurchaseOrders.jsx:1) - 67,758 chars
- [`Invoices.jsx`](../frontend/src/pages/Invoices.jsx:1) - 58,883 chars
- [`Bills.jsx`](../frontend/src/pages/Bills.jsx:1) - 58,147 chars
- [`Settings.jsx`](../frontend/src/pages/Settings.jsx:1) - 44,967 chars
- [`Payments.jsx`](../frontend/src/pages/Payments.jsx:1) - 42,704 chars
- [`NewDashboard.jsx`](../frontend/src/pages/NewDashboard.jsx:1) - 41,638 chars
- [`Help.jsx`](../frontend/src/pages/Help.jsx:1) - 39,459 chars
- **Fix:** Extract reusable components (StatusBadge, DataTable, DraftCard, FormSection) into `frontend/src/components/` and split pages into smaller sub-components.

---

## 6. TESTING (Major Gap)

### 6.1 Only 2 Test Files Exist
- [`api.test.js`](../frontend/src/utils/api.test.js:1) - tests API utility
- [`helpers.test.js`](../frontend/src/utils/helpers.test.js:1) - tests helper functions
- **Missing:** No backend tests at all. No component tests. No integration tests. No E2E tests.
- **Fix:** Add at minimum:
  - Backend unit tests for each module (purchase-order, invoice, bill, payment, expense)
  - Backend tests for settings.js, cache.js, qbo-auth.js
  - Frontend component tests for critical UI flows

---

## 7. DEPLOYMENT AND CONFIG

### 7.1 Root `package.json` Missing `npm start` Script
- **Location:** [`package.json`](../package.json:7) has `"dev": "cd frontend && npm start"` but frontend uses `npm run dev` (Vite)
- **Fix:** Change to `"dev": "cd frontend && npm run dev"`.

### 7.2 No `functions/.env` File and No Environment Variable Guidance for v2 Functions
- **Issue:** The `.env.example` at root describes `firebase functions:config:set` which is for v1 functions config, but the code uses `process.env.QBO_CLIENT_ID` directly (v2 pattern with dotenv or `.env` file).
- **Fix:** Update `.env.example` to clearly state that `functions/.env` is the correct location and format.

### 7.3 Version Mismatch
- [`functions/api/routes.js`](../functions/api/routes.js:1634) - health endpoint returns `version: '0.1.0'`
- [`AppLayout.jsx`](../frontend/src/components/shared/AppLayout.jsx:5) - shows `APP_VERSION` from env or `'v0.1.0'`
- [`functions/package.json`](../functions/package.json:27) - `version: "0.1.1"`
- **Fix:** Centralize version and keep consistent.

### 7.4 Missing `public/` Folder for Static Assets
- No `frontend/public/` directory for static assets (favicon, robots.txt, etc.)
- **Fix:** Create `frontend/public/` with at minimum `atd-icon.svg` and `robots.txt`.

---

## 8. FEATURE GAPS

### 8.1 No Authentication/Login
- Internal tool with no user authentication at all
- **Status:** Acceptable for internal use behind VPN/firewall, risky if exposed to public internet

### 8.2 No Audit Trail UI
- Logs are written to Firestore but there's no dedicated audit log viewer in the frontend
- Dashboard shows some recent activity but no searchable/filterable log view

### 8.3 `expense` Module Setting Missing from `modules` Config
- **Location:** [`settings.js`](../functions/core/settings.js:84) - `modules` object has PO, Invoice, Bill, Payment but NOT Expense
- **Fix:** Add `expense: { enabled: true, auto_approve: false }` to `modules` defaults.

### 8.4 No Invoice/Bill Google Sheets Import
- PO has Sheets import. Invoice has `invoice_sheet_id` and `invoice_column_mapping` in settings but no actual import route or logic.
- **Decision:** Either implement or remove the placeholder settings.

---

## Summary Counts

| Category | Count |
|----------|-------|
| Security Issues | 4 |
| Bugs/Errors | 5 |
| Convention Violations | 2 |
| Dead Code/Cleanup | 5 |
| Code Quality | 2 |
| Testing Gaps | 1 |
| Deployment/Config | 4 |
| Feature Gaps | 4 |
| **Total Action Items** | **27** |
