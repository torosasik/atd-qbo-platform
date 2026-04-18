# /push-github

Push the current branch to GitHub with a conventional commit message. Offers to open a PR via `gh` if installed.

## What to do when invoked

Execute these steps in order, using `execute_command`:

1. **Show status** — `git status --short` and `git diff --stat` so the user sees what will be committed.
2. **Detect current branch** — `git rev-parse --abbrev-ref HEAD`. Abort if on `main` or `master` and ask the user to create a feature branch first (suggest `git switch -c fix/<slug>`).
3. **Stage all changes** — `git add -A`.
4. **Commit** — generate a Conventional Commits message based on the staged diff. Format:
   ```
   <type>(<scope>): <subject>

   <body: 1-3 bullet points describing what & why>
   ```
   Valid `<type>`: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`.
   Use `git commit -m "..." -m "..."`. No Claude/AI attribution lines.
5. **Pull with rebase** — `git pull --rebase --autostash` to pick up remote commits. If conflicts, abort rebase and report to user.
6. **Push** — `git push -u origin <current-branch>`.
7. **Offer PR** — if `gh --version` succeeds and branch is not `main`/`master`, run:
   ```
   gh pr create --fill --web
   ```
   Otherwise print the compare URL: `https://github.com/<owner>/<repo>/compare/<branch>`.

## Acceptance criteria

- Current branch is pushed to `origin`.
- Commit message follows Conventional Commits.
- No secrets are committed (scan diff for `.env`, API keys, tokens before staging).
- If `gh` is available, a PR draft is opened in the browser.

## Safety

- Never force-push (`--force` / `-f`) unless the user explicitly asks.
- Never commit files matching the `.kilocodeignore` patterns.
- Reject if `git status` shows merge conflicts.
