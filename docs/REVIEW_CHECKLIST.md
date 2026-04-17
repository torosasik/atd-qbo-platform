# Review Checklist

Run this every time you review a change on this repo.

## 1. Fast (required)

```bash
npm test
```

Runs, in order:
- Frontend unit tests — `cd frontend && npm test -- --run` (Vitest, jsdom).
- Functions unit tests — `cd functions && npm test` (Vitest, node).

Expected: exit code `0`. All suites green.

## 2. E2E smoke (optional, before release)

In one terminal:

```bash
npm run emulate
```

In another (wait until emulators show "All emulators ready"):

```bash
npm run test:e2e
```

Runs Playwright against `http://127.0.0.1:5002`. HTML report lands in `playwright-report/`.

## 3. Manual review gates (priority order)

1. **Security** — no secrets/tokens in diff; [`firestore.rules`](../firestore.rules) not loosened; auth middleware still applied to protected routes.
2. **Correctness** — logic matches the described behavior; edge cases covered.
3. **Performance** — no N+1 Firestore calls in loops; caches invalidated on write.
4. **Style** — consistent with [`CLAUDE.md`](../CLAUDE.md) and mode rules under `.kilocode/rules/`.

## 4. When something fails

- Read the failing test output top-to-bottom.
- Reproduce locally, fix the root cause, add a regression test.
- Re-run `npm test` once. Max 3 fix-test loops; stop and escalate if unresolved.

## 5. Before approving

Paste the `npm test` summary into the review, e.g.:

```
frontend: X passed / 0 failed
functions: Y passed / 0 failed
```
