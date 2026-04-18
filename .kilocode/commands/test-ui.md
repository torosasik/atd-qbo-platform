# /test-ui

Walk the app as a real user in a real Chromium window. Runs headed Playwright against a local build and captures screenshots of every major flow.

## What to do when invoked

Execute, using `execute_command`:

1. **Preflight** —
   - `npx playwright --version` — if missing, run `npx playwright install chromium`.
   - Check port 5002 is free: `lsof -i :5002 -P -t || true`. Playwright will start the emulator via [`playwright.config.js`](../../playwright.config.js:29) if nothing is running there.
2. **Build frontend** — `npm --prefix frontend run build` so the Firebase hosting emulator serves the latest code.
3. **Run full e2e suite headed** —
   ```
   npx playwright test --headed --workers=1 --reporter=list,html
   ```
   This runs every spec under [`tests/e2e/flows`](../../tests/e2e/flows:1) plus [`tests/e2e/visual.spec.js`](../../tests/e2e/visual.spec.js:1) and [`tests/e2e/a11y.spec.js`](../../tests/e2e/a11y.spec.js:1), covering:
   - auth + navigation
   - dashboard
   - orders
   - purchase orders
   - invoices
   - bills
   - payments
   - expenses
   - AI chat
   - activity search
   - vendors & rules
   - settings & health
4. **Capture screenshots** — Playwright already saves failure screenshots under `test-results/`. Additionally copy the final state of each flow into `DO NOT UPLOAD - SCREENSHOTS/ui-test-<timestamp>/`.
5. **Open report** — if any test failed, `npx playwright show-report`. Otherwise just print the report path.
6. **Report** — table of spec file → passed/failed count + link to the HTML report.

## Acceptance criteria

- A real Chromium window opens and walks at least the 11 flows above.
- Every spec either passes or produces a screenshot + trace under `test-results/`.
- Final summary prints pass/fail/flaky counts per project (`chromium-desktop`, `chromium-mobile`).
- On failure, the HTML report path is printed so the user can open it.

## Notes

- Playwright already has API mocks in [`tests/e2e/fixtures/qbo-mocks.js`](../../tests/e2e/fixtures/qbo-mocks.js:1) — no live QBO credentials needed.
- If port 5002 is occupied by a real dev server, Playwright reuses it (`reuseExistingServer: true` outside CI).
- For a single-flow smoke, the user can ask: `npx playwright test tests/e2e/flows/purchase-order.spec.js --headed`.
