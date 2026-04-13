1. [frontend/src/pages/Orders.jsx]
- Replace mixed table/flex row rendering with true table row/cell rendering so header/body alignment remains stable.
- Add deterministic column width mapping and fixed table layout for consistent alignment after refresh/filter/column toggle.
- Preserve row expansion with an additional detail row (`colSpan`) instead of replacing main row structure.
- Keep column visibility toggles while preserving original header order.

2. [frontend/src/pages/Orders.jsx, frontend/src/components/FuzzySearch.jsx]
- Fix search indexing and result selection to avoid index drift between source array and filtered array.
- Add exact + partial fallback match path for SKU, item name, vendor, order number, and line item values.
- Improve empty-state messaging for no results vs no data vs fulfilled-only state.

3. [frontend/src/pages/Orders.jsx]
- Add compact copy buttons with tooltip/feedback next to key fields (SKU, item name, vendor, order number, line item).
- Keep copy controls keyboard accessible and non-disruptive to row click/expand behavior.

4. [functions/api/sheets-routes.js, frontend/src/pages/Orders.jsx]
- Implement durable last successful sync snapshot for orders response in Firestore cache doc and expose `lastSyncedAt` metadata.
- Update frontend to display last synced timestamp and use last successful payload when live pull fails.

5. [functions/core/cache.js, functions/api/cache-routes.js]
- Expose cache metadata (`lastSyncedAt`, `stale`) for products/items, vendors, customers/accounts endpoints.
- Ensure stale-on-failure fallback is explicit and timestamped so UI can show latest successful sync data.

6. [frontend/src/components/shared/AppLayout.jsx]
- Make global AI warning mode-aware by using health payload `ai_mode` and suppressing irrelevant provider warnings.
- Only show AI degradation when it impacts current selected mode (off/ollama/cloud).

7. [frontend/src/pages/Orders.jsx]
- UX cleanup: improve truncation rules, horizontal scroll behavior, sticky header consistency, and key column readability.

8. [frontend/src/smoke.test.js or relevant tests]
- Add/adjust tests for: table alignment DOM structure, search behavior, empty state behavior, copy actions, and last-sync rendering.

9. [repo root via CLI]
- Run frontend/backend tests once after all edits.
- Run lint if available.

10. [repo root via CLI + Firebase]
- Commit, push, deploy Firebase hosting/functions, verify live app with screenshots:
  - aligned orders columns
  - search results correctness
  - copy controls visible/working
  - last synced timestamp + fallback display
  - AI warning mode-aware behavior