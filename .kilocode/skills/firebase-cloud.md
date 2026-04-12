---
name: firebase-cloud
description: Specialized patterns for Firebase Cloud Functions, Firestore, Authentication, and Google Cloud integration in the atd-qbo-platform project
---

# Firebase Cloud Skill for Roo

## Purpose
Master Firebase + Google Cloud usage in this project (functions/, firestore.rules, firebase.json). Provide best practices for Cloud Functions with Express, Firestore security, emulators, and integration with QBO modules.

## Key Patterns from Project
- Use functions/core/config.js, google-auth.js, logger.js
- Follow existing module structure (modules/bill/, invoice/, etc.)
- Firestore rules in firestore.rules
- Emulators via scripts/start-emulators.sh

## Recommended Context7 Queries
- "Firebase Cloud Functions best practices with Express.js and Firestore"
- "Firestore security rules for multi-tenant apps"
- "Firebase Admin SDK authentication with Google Cloud"

## Usage in Workflows
1. Before editing functions/index.js or api/*-routes.js: Query memory for similar patterns
2. Use Context7 for latest SDK examples
3. Test with emulators and take screenshots of console/logs using browser-ui-testing skill
4. Record successful patterns in memory graph under "FirebaseExpertise" entity

## Common Tasks
- Deploying Cloud Functions
- Updating Firestore indexes (firestore.indexes.json)
- Securing API routes with middleware.js
- Integrating with QBO OAuth flows

This skill will be mirrored to .roo/rules-code/skills/ during full implementation.
