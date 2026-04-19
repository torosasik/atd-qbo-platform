#!/bin/bash
# Auto-run at end of every job. Runs build + deploy + commit + push in one go.

set -e

# Load FIREBASE_TOKEN from ~/.hermes/.env if not already set
if [ -z "$FIREBASE_TOKEN" ] && [ -f "$HOME/.hermes/.env" ]; then
  export $(grep FIREBASE_TOKEN "$HOME/.hermes/.env" | xargs)
fi

if [ -z "$FIREBASE_TOKEN" ]; then
  echo "ERROR: FIREBASE_TOKEN is not set. Check ~/.hermes/.env"
  exit 1
fi

PROJECT="atd-qbo-platform"
echo "=== Starting finish_job.sh for $PROJECT ==="

# Build if there's a build script
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  echo "Running npm build..."
  npm run build
fi

# Build frontend separately if this is the QBO Platform (frontend subdir)
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
  echo "Running frontend npm build..."
  cd frontend && npm run build && cd ..
fi

# Commit & push
echo "Staging changes..."
git add -A
if ! git diff-index --quiet HEAD --; then
  git commit -m "chore: automated commit from finish_job.sh"
  git push
else
  echo "No changes to commit."
fi

# Deploy
echo "Deploying to Firebase project: $PROJECT..."
firebase deploy --token "$FIREBASE_TOKEN" --project "$PROJECT" --only hosting

echo "=== finish_job.sh completed successfully ==="
