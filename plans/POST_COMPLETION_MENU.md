# Add post-completion action menu to Kilo Code

## Approach

Kilo Code's built-in "Review" button is hard-coded in the extension UI — we can't add sibling buttons without forking the extension. Instead, we install **project-level slash commands** + a **global rule** that prints a clickable menu at the end of every `attempt_completion`. One click/type runs the command.

Trade-offs vs alternatives:
- **Custom modes** in [`.kilocodemodes`](../.kilocodemodes:1) — heavier, requires mode switch per action. Rejected.
- **Fork the VS Code extension** — real buttons, but TypeScript work on upstream Kilo. Out of scope.

## Files (1–4 parallelizable, 5–7 sequential)

| # | Path | Responsibility |
|---|------|----------------|
| 1 | `.kilocode/commands/push-github.md` | `git status` → stage → conventional commit → push current branch → optional `gh pr create` |
| 2 | `.kilocode/commands/deploy-firebase.md` | `npm --prefix frontend run build` → `firebase deploy --only hosting,functions,firestore:rules` → print live URL |
| 3 | `.kilocode/commands/test-code.md` | Root `npm test` + `npm --prefix functions test` + `npm --prefix frontend test` → pass/fail summary, open failures |
| 4 | `.kilocode/commands/test-ui.md` | Emulators + dev server → `npx playwright test tests/e2e` headed → capture screenshots → walk auth → dashboard → orders → PO → invoices |
| 5 | `.kilocode/rules/post-completion-menu.md` | Global rule: every `attempt_completion` result ends with:<br>`---`<br>`**Next:** [Review] · [/push-github] · [/deploy-firebase] · [/test-code] · [/test-ui]` |
| 6 | [`CLAUDE.md`](../CLAUDE.md:1) + [`docs/QUICK_START.md`](../docs/QUICK_START.md:1) | Document the 4 commands and how to invoke |
| 7 | manual | Finish a trivial task in Code mode, verify menu renders, run each command end-to-end |

## Acceptance criteria

- Every `attempt_completion` footer renders 5 menu items.
- `/push-github` pushes current branch without extra prompts beyond auth.
- `/deploy-firebase` builds + deploys + prints hosting URL; aborts cleanly if `firebase login` missing.
- `/test-code` returns numeric pass/fail for all three suites.
- `/test-ui` opens headed browser, walks 5 core flows, saves screenshots to `DO NOT UPLOAD - SCREENSHOTS/`.
- All 4 command files match the structure of existing [`.kilocode/workflows/improve-roo.md`](../.kilocode/workflows/improve-roo.md:1).

## Flow

```mermaid
flowchart LR
    A[Task done] --> B[attempt_completion]
    B --> C[Footer menu]
    C --> D[Review]
    C --> E[/push-github]
    C --> F[/deploy-firebase]
    C --> G[/test-code]
    C --> H[/test-ui]
    E --> I[git push + gh pr]
    F --> J[build + firebase deploy]
    G --> K[npm test x3]
    H --> L[playwright e2e]
```

## Open questions (resolve before Code mode)

1. **Push:** direct to current branch, or always create feature branch + PR?
2. **Deploy:** full deploy vs hosting-only default with flag for functions?
3. **UI test:** run against local emulators ([`scripts/start-emulators.sh`](../scripts/start-emulators.sh:1)) or Firebase preview channel?
4. **Menu scope:** all modes, or only Code/Debug (skip Ask/Architect)?

## Next step

Switch to Code mode to create the 7 files above.
