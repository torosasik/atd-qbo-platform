# /test-code

Run all unit/integration test suites and report pass/fail counts. Does NOT run Playwright (use `/test-ui` for that).

## What to do when invoked

Execute, using `execute_command`:

1. **Root suite** — `npm test` (runs frontend + functions via the root [`package.json`](../../package.json:13) script).
2. If step 1 fails, also run the two suites independently to isolate the failure:
   - `npm run test:frontend`
   - `npm run test:functions`
3. **Report** — print a table:
   ```
   Suite      | Passed | Failed | Skipped | Duration
   frontend   | N      | N      | N       | Xs
   functions  | N      | N      | N       | Xs
   TOTAL      | N      | N      | N       | Xs
   ```
4. **On failure** — open the first failing test file with `read_file`, print the failure message + assertion diff, and suggest the minimum fix. Do NOT auto-fix; that's a separate task the user can request.

## Acceptance criteria

- Numeric pass/fail/skipped counts printed for both suites.
- Total duration printed.
- If any suite fails, at least one failing test file is identified with line numbers.
- Exit code is non-zero on failure so chained commands can react.

## Notes

- Frontend uses Vitest ([`frontend/vitest.config.js`](../../frontend/vitest.config.js:1)).
- Functions uses Vitest ([`functions/vitest.config.js`](../../functions/vitest.config.js:1)).
- For e2e/visual/a11y tests, use `/test-ui`.
