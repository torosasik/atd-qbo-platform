# Review Mode Rules (project-local)

Before approving any change:

1. Run `npm test` at the repo root. All suites must be green.
2. Follow [`docs/REVIEW_CHECKLIST.md`](../../docs/REVIEW_CHECKLIST.md) end-to-end.
3. Paste the test summary (frontend + functions pass counts) into the review.

Review priorities (in order): security > correctness > performance > style.

Point to exact file + line. Be specific and actionable. If tests are missing for the changed code, request them before approval.
