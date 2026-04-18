# /deploy-firebase

Full Firebase deploy: build frontend, then deploy hosting + functions + firestore rules.

## What to do when invoked

Execute these steps in order, using `execute_command`:

1. **Preflight** —
   - `firebase --version` — abort with a clear error if not installed (`npm i -g firebase-tools`).
   - `firebase projects:list` — abort if not logged in (`firebase login`).
   - Confirm active project matches [`.firebaserc`](../../.firebaserc:1).
2. **Lint & test** — run `npm test` at the repo root. Abort deploy if any suite fails.
3. **Build frontend** — `npm --prefix frontend run build`. Abort if build fails.
4. **Install functions deps** — `npm --prefix functions ci` (only if `functions/node_modules` is missing or `package-lock.json` changed).
5. **Deploy** — `firebase deploy --only hosting,functions,firestore:rules,firestore:indexes`.
6. **Report** —
   - Print the hosting URL from the deploy output.
   - Print the functions endpoint URL.
   - Run `firebase hosting:channel:list` to show any active preview channels.

## Acceptance criteria

- `npm test` passes before anything deploys.
- Frontend build artifacts land in `frontend/dist/`.
- Deploy completes with no `failed` lines in the output.
- Hosting URL and functions region are printed for the user.

## Safety

- If on a branch other than `main` or `release/*`, warn the user and require an explicit "yes" before deploying to the production project.
- Never run `firebase projects:delete` or `firebase functions:delete`.
- Never deploy if `.env` files are untracked and contain production secrets — ask the user to confirm they've set Firebase Functions config via `firebase functions:config:set`.
