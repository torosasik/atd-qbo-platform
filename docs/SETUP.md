# ATD QBO Platform - First Time Setup

## Prerequisites

- Node.js v22 or later
- Firebase CLI: `npm install -g firebase-tools`
- A QuickBooks Online Developer account with a connected app (Client ID and Client Secret)
- Optionally: Ollama running locally for free AI reviews

---

## Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Create a project"
3. Name it: `atd-qbo-platform` (or any name you prefer)
4. Disable Google Analytics (not needed)
5. Click "Create project"
6. Once created, go to Project Settings > General and copy the **Project ID**

---

## Step 2: Enable Firestore

1. In Firebase Console, click "Build" > "Firestore Database"
2. Click "Create database"
3. Select "Start in test mode" (rules will be tightened after setup)
4. Choose `us-west1` or `us-central1` as location
5. Click "Enable"

---

## Step 3: Connect Your Local Project

Open terminal in the project root and run:

```bash
firebase login
firebase use --add
```

Select your project when prompted. Choose `default` as the alias.

Then update `.firebaserc` to confirm your project ID is set correctly:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

---

## Step 4: Set Credentials

Copy the example env file and fill in your credentials:

```bash
cp functions/.env.example functions/.env
```

Edit `functions/.env`:

```
QBO_CLIENT_ID=your_intuit_client_id
QBO_CLIENT_SECRET=your_intuit_client_secret
CLAUDE_API_KEY=your_claude_api_key
```

Get your QBO credentials from the [Intuit Developer Portal](https://developer.intuit.com).
Get your Claude API key from [console.anthropic.com](https://console.anthropic.com).

This file is gitignored and works for both local emulator and deployed functions (Firebase automatically loads `functions/.env` at runtime).

---

## Step 5: (Optional) Legacy Runtime Config

If you have an existing `functions/.runtimeconfig.json` from a previous setup, it can be deleted. The `.env` file replaces it entirely.

---

## Step 6: Install Dependencies

```bash
cd functions && npm install
cd ../frontend && npm install
```

---

## Step 7: Build the Frontend

```bash
cd frontend && npm run build
```

---

## Step 8: Start Local Emulators

From the project root:

```bash
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"  # if using Homebrew OpenJDK
firebase emulators:start
```

This starts:

| Service | URL |
|---|---|
| Frontend (Hosting) | http://localhost:5002 |
| API (Functions) | http://localhost:5001 |
| Firestore | http://localhost:8080 |
| Emulator UI | http://localhost:4000 |

Note: Port 5002 is used for hosting because macOS AirPlay Receiver occupies port 5000.
To reclaim port 5000: System Settings > General > AirDrop and Handoff > disable AirPlay Receiver,
then change the hosting port in `firebase.json` back to 5000 and update `DEFAULT_SETTINGS.oauth.redirect_uri`
in `functions/core/settings.js` to match.

---

## Step 9: Connect to QuickBooks

1. Open http://localhost:5002 in your browser
2. Navigate to the QBO Connect page
3. Click "Connect to QuickBooks"
4. Sign in with your Intuit account and authorize the app
5. You will be redirected back to the Settings page on success

For the OAuth callback to work locally, make sure your Intuit app has this redirect URI registered:

```
http://localhost:5002/api/auth/callback
```

Add it in the Intuit Developer Portal under your app's "Keys and OAuth" settings.

---

## Step 10: Deploy to Production

```bash
cd frontend && npm run build
cd ..
firebase deploy
```

For production, update the OAuth redirect URI in Settings to your live URL. If using Firebase Hosting rewrites (recommended):

```
https://YOUR_PROJECT_ID.web.app/api/auth/callback
```

Register this URL in your Intuit Developer Portal app settings as well.

---

## Firestore Collections Reference

| Collection | Purpose |
|---|---|
| `settings/app_config` | Application settings (AI config, QBO env, module toggles) |
| `settings/qbo_tokens` | OAuth tokens (access, refresh, expiry, realmId) |
| `po_drafts` | PO drafts pending human approval |
| `logs` | Audit log for all module actions and AI reviews |
| `cache/vendors_{realmId}` | Cached vendor list from QBO (24h TTL) |
| `cache/items_{realmId}` | Cached item list from QBO (24h TTL) |
| `cache/accounts_{realmId}` | Cached chart of accounts from QBO (24h TTL) |
