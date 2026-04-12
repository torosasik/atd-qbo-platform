# Project: ATD QBO Platform (Roo Configuration)

## Tech Stack
- Frontend: React + Vite + Tailwind CSS (Firebase Hosting)
- Backend: Firebase Cloud Functions (Node.js)
- Database: Firestore
- API: QuickBooks Online API (OAuth 2.0)

## Roo Core Rules (CRITICAL - ALWAYS FOLLOW)
- ALL responses MUST use clickable markdown format: [`filename.function()`](relative/path/to/file.ext:line)
- You MUST call at least ONE tool per assistant response (list_files, read_file, etc.)
- Use update_todo_list on every multi-step task
- Confirm tool success before using attempt_completion
- Never end attempt_completion with questions
- Prefer parallel tool calls when appropriate
- Always analyze project structure with list_files before deep exploration

## Tool Usage Guidelines
- Use list_files (recursive when needed) instead of shell ls
- Use read_file with indentation mode when anchor_line is known
- Use search_replace with 3-5 lines of context before AND after changes
- Leverage MCP servers: memory (knowledge graph), context7 (docs), puppeteer (UI), time
- **UI Tasks**: Prioritize [`browser-ui-testing`](.kilocode/skills/browser-ui-testing.md:1) with non-headless puppeteer + screenshots for Firebase, QBO, Shopify Admin, GitHub
- Use mcp--memory--* tools to persist QBO patterns, module templates, UI observations, and lessons learned
- ALWAYS use context7-helper before implementing against external APIs (QBO, Firebase, Shopify)

## Coding Conventions
- Backend (functions/): CommonJS (require/module.exports)
- Frontend (frontend/src/): ES modules (import/export)
- Always use async/await, never raw promises
- Wrap QBO API calls in try/catch with error logging
- No em dashes in user-facing text (use commas, colons, or periods)

## Naming
- Files: kebab-case (purchase-order.js)
- Functions: camelCase (createPurchaseOrder)
- Components: PascalCase (PurchaseOrderModule)
- Firestore collections: camelCase (vendorCache)
- Environment variables: SCREAMING_SNAKE (QBO_CLIENT_ID)

## Return Format
Every Cloud Function returns: { success: boolean, data?: any, error?: string }

## Cost Awareness
- Minimize QBO GET calls (cache vendor/item lists in Firestore)
- QBO POST calls are free and unlimited
- QBO GET calls are metered (500K/month free limit)

## Architecture Rules
- Use actor system pattern - never bypass with direct module calls
- All errors must preserve full context (intuit_tid, originalError, stack)
- All cache must use Firestore or localStorage - no in-memory state
- All AI calls must go through core/ai-router.js
- All QBO calls must go through core/qbo-auth.js
