---
name: browser-ui-testing
description: Specialized skill for fast non-headless browser automation using Puppeteer MCP with screenshots for UI problem detection and improvement validation on Firebase, QBO, Shopify Admin, GitHub, and VSCode-related flows
---

# Browser UI Testing Skill for Roo

## Purpose
Enable rapid visual verification of UIs in Firebase Console, QuickBooks Online, Shopify Admin, GitHub, and other web tools. Prioritizes non-headless browser + screenshots to catch visual regressions, layout issues, or workflow problems that headless mode misses.

## Core Principles
- **Screenshot First**: Always take screenshots before/after critical actions for visual diffing and documentation.
- **Non-Headless Preferred**: Use `{ headless: false }` for realistic rendering when debugging UI.
- **Login/Session Handling**: Support persistent contexts for authenticated flows (Firebase, QBO, Shopify, GitHub).
- **Integration**: Combine with [`context7-helper`](.kilocode/skills/context7-helper.md:1) for latest API patterns and [`memory-manager`](.kilocode/skills/memory-manager.md:1) to record UI observations.
- **Anti-Loop**: Every response must call at least one tool (puppeteer, memory, context7, or list_files).

## Available Tools (MCP)
- [`mcp--puppeteer--puppeteer_navigate`](.kilocode/mcp.json:13) - Navigate to URLs (Firebase, QBO, Shopify, GitHub)
- [`mcp--puppeteer--puppeteer_screenshot`](.kilocode/mcp.json:13) - Capture visible UI at specific resolutions
- [`mcp--puppeteer--puppeteer_click`](.kilocode/mcp.json:13), [`mcp--puppeteer--puppeteer_fill`](.kilocode/mcp.json:13), [`mcp--puppeteer--puppeteer_select`](.kilocode/mcp.json:13)
- [`mcp--puppeteer--puppeteer_evaluate`](.kilocode/mcp.json:13) - Run JS for dynamic interactions
- Launch options: `{ headless: false, args: ['--no-sandbox'] }` (use allowDangerous when needed)

## Recommended Workflows

### 1. UI Debugging Flow
1. Navigate to target page (e.g. Firebase console, QBO dashboard, Shopify orders)
2. Take baseline screenshot
3. Perform action (click, fill form)
4. Take comparison screenshot
5. Use [`mcp--memory--add_observations`](.kilocode/skills/memory-manager.md:36) to record "UI issue: X" or "UI improvement verified"
6. Evaluate JS for console errors or React component state

### 2. Common Targets
- **Firebase/Google Cloud**: Console navigation, function logs, Firestore explorer
- **QuickBooks Online**: Dashboard, invoice/bill creation, OAuth flows, reports
- **Shopify Admin**: Orders, products, payments, settings pages
- **GitHub**: Repo PRs, issues, Actions workflows, settings
- **VSCode Related**: Any webviews or integrated web UIs

### 3. Best Practices (from Context7)
- Use high-resolution screenshots (1200x800+) for clarity
- Name screenshots descriptively: `qbo-invoice-form-before`, `shopify-order-ui-after`
- Store screenshot references in memory graph under "BrowserAutomation" or specific tech entities
- Combine with [`mcp--context7--query-docs`](.kilocode/skills/context7-helper.md:19) before complex interactions

## Integration with Other Skills
- Before any UI automation: Query [`memory-manager`](.kilocode/skills/memory-manager.md:39) for existing patterns
- After UI validation: Update memory with visual observations
- Use alongside domain skills (firebase-cloud, qbo-integration, shopify-admin) once created

## Anti-Loop Rule
If repetitive navigation occurs, force a screenshot + memory update instead of repeating the same action.

This skill makes Roo exceptionally effective at visual UI work across the technologies you use most. It will be mirrored to `.roo/rules-code/skills/browser-ui-testing.md` during implementation.
