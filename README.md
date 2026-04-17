# ATD QBO Platform

Internal automation platform for American Tile Depot connecting Google Sheets and a web app to QuickBooks Online via API, with AI-powered validation and decision-making.

## Modules
- **Purchase Orders**: Create POs from Google Sheets or web app
- **Invoices**: (Coming soon)
- **Bills**: (Coming soon)
- **Payments**: (Coming soon)

## Tech Stack
- React + Tailwind CSS (frontend)
- Firebase Cloud Functions / Node.js (backend)
- Firestore (database)
- QBO REST API v3 (accounting)
- Ollama + Claude API (AI layer)

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project
- QBO Developer account with production keys

### Setup
1. Clone this repo
2. Run `firebase login`
3. Run `firebase use --add` and select your project
4. Set QBO credentials:
   ```
   firebase functions:config:set qbo.client_id="YOUR_ID" qbo.client_secret="YOUR_SECRET"
   ```
5. Install dependencies:
   ```
   cd functions && npm install
   cd ../frontend && npm install
   ```
6. Start emulators: `npm run emulate`

## Testing
Run all unit tests (frontend + functions) from repo root:
```
npm test
```
For reviews, follow [`docs/REVIEW_CHECKLIST.md`](docs/REVIEW_CHECKLIST.md).

## Project Structure
See CLAUDE.md for full architecture documentation.

## For Claude Code Users
This project includes:
- `CLAUDE.md`: Master project brief (auto-read by Claude Code)
- `.claude/agents/`: Subagent definitions for specialized tasks
- `.claude/skills/`: Reusable knowledge patterns
- `.claude/commands/`: Custom slash commands (`/new-module`, `/test-module`)
