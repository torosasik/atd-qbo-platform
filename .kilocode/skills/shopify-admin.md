---
name: shopify-admin
description: Patterns and automation strategies for Shopify Admin panel using browser automation, order processing, and integration with QBO/Firestore
---

# Shopify Admin Skill for Roo

## Purpose
Enable reliable automation and monitoring of Shopify Admin interfaces (orders, products, payments) with visual screenshot validation.

## Key Capabilities
- Navigation to specific admin sections (Orders, Products, Payments, Settings)
- Form automation with screenshots before/after
- Integration with QBO for order syncing
- Data extraction to Firestore

## Recommended Patterns
- Use [`browser-ui-testing`](.kilocode/skills/browser-ui-testing.md:1) skill for all interactions
- Take screenshots named like `shopify-orders-list-2026-04-12`
- Store results in memory under "ShopifyAdmin" entity
- Combine with QBO workflows for end-to-end order processing

## Common Tasks
- Monitor new orders and sync to QBO
- Update product inventory based on QBO data
- Automate payment reconciliation
- Visual regression testing of admin UI changes

Use this skill whenever the task involves Shopify Admin panel interaction or verification.
