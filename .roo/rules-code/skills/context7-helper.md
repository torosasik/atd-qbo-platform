---
name: context7-helper
description: Uses Context7 MCP server to get up-to-date documentation and code examples for QBO, Firebase, React, and other libraries before implementation
---

# Context7 Helper Skill

## Strict Usage Protocol
1. **Always start with** `mcp--context7--resolve-library-id`
2. Use the returned libraryId with `mcp--context7--query-docs`
3. Add the results to memory using the memory-manager skill

## Recommended Queries for This Project
- "QuickBooks Online v3 PurchaseOrder, Invoice, Bill, Payment entity schemas and OAuth2 token refresh"
- "Firebase Cloud Functions Express best practices with error context preservation"
- "React + Vite + Tailwind best practices for data fetching with proper error handling and loading states"

## Anti-Looping Integration
If you detect you are repeating the same response or getting tool usage errors, immediately call a Context7 tool to get fresh information rather than repeating previous responses.

This skill helps prevent stale or repetitive answers by ensuring Roo always has the latest documentation before responding to technical questions.