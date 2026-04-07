# Project: ATD QBO Platform

## Tech Stack
- Frontend: React + Vite + Tailwind CSS (Firebase Hosting)
- Backend: Firebase Cloud Functions (Node.js)
- Database: Firestore
- API: QuickBooks Online API (OAuth 2.0)

## Coding Conventions
- Backend (functions/): CommonJS (require/module.exports)
- Frontend (frontend/src/): ES modules (import/export)
- Always use async/await, never raw promises
- Wrap QBO API calls in try/catch with error logging
- No em dashes in user-facing text (use commas, colons, or periods)

## Naming
- Files: kebab-case (purchase-order.js)
- Functions: camelCase (createPurchaseOrder)
- Components: PascalCase (PurchaseOrderModule)
- Firestore collections: camelCase (vendorCache)
- Environment variables: SCREAMING_SNAKE (QBO_CLIENT_ID)

## Return Format
Every Cloud Function returns: { success: boolean, data?: any, error?: string }

## Cost Awareness
- Minimize QBO GET calls (cache vendor/item lists in Firestore)
- QBO POST calls are free and unlimited
- QBO GET calls are metered (500K/month free limit)
