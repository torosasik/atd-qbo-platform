---
name: qbo-integration
description: Expert patterns for QuickBooks Online integration including OAuth2, actor system, module templates, and API entity handling in atd-qbo-platform
---

# QBO Integration Skill for Roo

## Purpose
Deep expertise in QuickBooks Online patterns used throughout this codebase (functions/core/qbo-auth.js, modules/*/index.js, rules-engine).

## Core Patterns
- **Actor System**: All QBO operations must go through registered actors, never direct calls
- **Module Template**: Each module (bill, invoice, purchase-order, etc.) has index.js + prompts.js
- **Auth**: OAuth2 token refresh using core/qbo-auth.js and google-auth.js
- **Middleware**: Always use validateRequest with Joi schemas
- **Error Handling**: Include intuit_tid in logs and responses

## Recommended Context7 Queries
- "QuickBooks Online OAuth2 token refresh best practices Node.js"
- "QuickBooks API v3 Invoice, Bill, PurchaseOrder schemas"
- "Intuit webhook handling for QBO"

## Usage Rules
1. Before editing any QBO related file: Query memory for "QBOIntegration" patterns
2. Use browser-ui-testing skill for visual confirmation of QBO dashboard changes
3. Record new observations after successful implementations
4. Combine with firebase-cloud skill for full backend flows

This skill will be duplicated to .roo/rules-code/skills/ in final implementation phase.
