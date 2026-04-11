# Parallel Agent Prompts for ATD QBO Platform Finalization

Run these 4 agents simultaneously in Code mode. They touch different files and will not conflict.

---

## AGENT 1: Backend Fixes (functions/ files only)

```
Read CLAUDE.md first. Then fix these backend issues:

1. In functions/core/settings.js DEFAULT_SETTINGS:
   - Change po_sheet_id from '1TJDsUcabGjC4kYmQAdVAH2CJACN5D9jrjnsUVlp1W9U' to '' (empty string). Users will enter it via Settings UI.
   - Add to the qbo section: default_income_account: '', default_expense_account: '', default_cogs_account: '', default_asset_account: ''
   - Add expense to the modules section: expense: { enabled: true, auto_approve: false }

2. In functions/api/routes.js POST /items/create route (around line 672-681):
   - Replace hardcoded account refs { value: '80' }, { value: '81' }, { value: '67' } with values from settings
   - Read settings at the top of the route handler: const settings = await getSettings();
   - Use: settings.qbo.default_income_account || '80' as fallback
   - Use: settings.qbo.default_expense_account || '67' as fallback  
   - Use: settings.qbo.default_asset_account || '81' as fallback
   - Use: settings.qbo.default_cogs_account || '67' as fallback

3. In the root package.json:
   - Change "dev": "cd frontend && npm start" to "dev": "cd frontend && npm run dev"

4. In the root .env.example:
   - Rewrite to clarify that functions/.env is the correct location
   - List: QBO_CLIENT_ID, QBO_CLIENT_SECRET, CLAUDE_API_KEY
   - Note that these go in functions/.env (not root .env)
   - Remove the firebase functions:config:set instructions (that's v1 pattern, this project uses v2 .env)

5. Run: node --check functions/core/settings.js
6. Run: node --check functions/api/routes.js
7. Run: node --check functions/index.js
```

---

## AGENT 2: Frontend Fixes (frontend/ files only)

```
Read CLAUDE.md first. The project convention says: "No em dashes in any user-facing text". Fix these frontend issues:

1. Replace all em-dash characters (the long dash character) in these files. Replace with regular dash (-) or reword using commas, colons, or periods:

   - frontend/src/pages/Settings.jsx line 414: replace the em-dash
   - frontend/src/pages/Expenses.jsx: replace all instances of the standalone em-dash character used as empty-value placeholder (lines ~453, 462, 553, 577, 649-666) with a regular dash "-"
   - frontend/src/pages/QBOConnect.jsx line 228: replace the em-dash with " - " (space dash space)
   - frontend/src/pages/Help.jsx lines 142, 256-261: replace em-dashes with regular dashes
   - frontend/src/pages/AIChat.jsx lines 179, 277: replace em-dashes in code comments with regular dashes
   - frontend/src/pages/PurchaseOrders.jsx line 1611: replace em-dash in code comment with regular dash
   - frontend/src/components/shared/AppLayout.jsx line 23: replace em-dash in code comment with regular dash

2. Create frontend/public/ directory and add a simple ATD favicon. Create the file frontend/public/atd-icon.svg with a simple blue square SVG with "ATD" text (use color #0462AC which is the atd-blue brand color).

3. Fix version display: In frontend/src/components/shared/AppLayout.jsx line 5, change fallback from 'v0.1.0' to 'v1.0.0'.

4. In frontend/src/components/shared/AppLayout.jsx: The comingSoonItems array on line 41 is empty, making the "Coming Soon" section show just a header with no items. Either:
   - Add { label: 'Notifications', icon: Bell } to the array (import Bell from lucide-react), OR
   - Remove the entire Coming Soon section (lines 90-110) to avoid an empty section

5. Run: cd frontend && npm run build
   Verify no build errors.
```

---

## AGENT 3: Documentation Updates (markdown files only)

```
Read CLAUDE.md first. Update these documentation files to match the current state of the project:

1. Update README.md:
   - Change "Invoices: (Coming soon)" to "Invoices: Create and manage invoices"
   - Change "Bills: (Coming soon)" to "Bills: Create and manage vendor bills"  
   - Change "Payments: (Coming soon)" to "Payments: Apply customer payments"
   - Add "Expenses: Categorize and manage expenses"
   - Add "Vendor Management: QBO vendor mapping and sync"
   - Remove the "For Claude Code Users" section at the bottom (lines 44-49) as it references .claude/ internals

2. Update CLAUDE.md architecture tree (around line 53-80) to match actual structure:
   Replace the old tree with:
   ```
   atd-qbo-platform/
   ├── CLAUDE.md
   ├── functions/
   │   ├── index.js              (Express app entry point)
   │   ├── api/
   │   │   └── routes.js         (all API route handlers)
   │   ├── core/
   │   │   ├── qbo-auth.js       (OAuth token management)
   │   │   ├── ai-router.js      (Ollama/Claude routing)
   │   │   ├── logger.js         (Firestore logging)
   │   │   ├── cache.js          (vendor/item/customer caching)
   │   │   ├── settings.js       (app settings with defaults)
   │   │   ├── google-auth.js    (QBO OAuth flow)
   │   │   └── sheets-connector.js (Google Sheets read-only access)
   │   └── modules/
   │       ├── purchase-order/    (PO create/approve/push to QBO)
   │       │   ├── index.js
   │       │   └── prompts.js
   │       ├── invoice/           (Invoice create/approve/push to QBO)
   │       │   ├── index.js
   │       │   └── prompts.js
   │       ├── bill/              (Bill create/approve/push to QBO)
   │       │   ├── index.js
   │       │   └── prompts.js
   │       ├── payment/           (Payment create/approve/push to QBO)
   │       │   ├── index.js
   │       │   └── prompts.js
   │       ├── expense/           (Expense categorization)
   │       │   ├── index.js
   │       │   └── prompts.js
   │       └── ai-chat/           (AI chat assistant)
   │           ├── index.js
   │           └── system-prompts.js
   ├── frontend/
   │   └── src/
   │       ├── pages/             (one file per page/view)
   │       ├── components/shared/ (AppLayout, Toast, Toggle, etc.)
   │       └── utils/             (api.js, helpers.js, useFeatures.js)
   ├── firestore.rules
   ├── firebase.json
   └── docs/
   ```

3. Update CLAUDE.md roadmap table (around line 139-148):
   | Module | Priority | Status |
   |--------|----------|--------|
   | Purchase Order Create | 1 | Complete |
   | Invoice Create | 2 | Complete |
   | Bill Create | 3 | Complete |
   | Payment Apply | 4 | Complete |
   | Expense Categorize | 5 | Complete |
   | Vendor Management | 6 | Complete |

4. Update CLAUDE.md "Current Phase" (line 137) from "Phase 2: Full Platform (Invoice, Bill, Payment, Expense modules)" to "Phase 2: Complete. All modules operational."
```

---

## AGENT 4: Cleanup and Delete (delete files, fix .gitignore)

```
Perform these cleanup tasks:

1. Delete the file: notes.md (it's a completed scratch task file, no longer needed)

2. Delete the empty directory: frontend/src/modules/ (empty, never used)

3. Delete the empty directory: frontend/src/shared/ (empty, never used)

4. In .gitignore, remove this line (line 48): plans/G.js
   This was a temporary entry for a scratch file that no longer exists.

5. In functions/core/settings.js DEFAULT_SETTINGS.google_sheets section:
   - Remove the invoice_sheet_id and invoice_sheet_tab and invoice_column_mapping fields (lines 51-61)
   - These are placeholder settings with no corresponding backend routes or import logic
   - NOTE: Only do this if AGENT 1 has NOT already modified this file. If the file was already changed by Agent 1, skip this step to avoid conflicts.
```

---

## AFTER ALL AGENTS COMPLETE: Final Build and Deploy

```
After all 4 agents finish, run:

1. cd frontend && npm run build
2. cd .. && node --check functions/index.js
3. node --check functions/api/routes.js
4. node --check functions/core/settings.js
5. firebase deploy --force
6. curl -s https://atd-qbo-platform.web.app/api/health | python3 -m json.tool
```

