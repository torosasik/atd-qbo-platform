---
name: context7-helper
description: Skill for using Context7 MCP server to get up-to-date documentation and code examples for QBO API, Firebase, React, and other libraries
---

# Context7 Helper Skill

## Purpose
Get current, high-quality documentation and code examples before implementing features or fixing issues.

## Usage Protocol (Strict Order)

1. **Resolve Library ID First**
   - ALWAYS call `mcp--context7--resolve-library-id` first
   - Use official names: "QuickBooks", "Firebase", "React", "Next.js", "Tailwind CSS", etc.
   - Pass relevant query context

2. **Query Documentation**
   - Use the libraryId returned from step 1
   - Be specific in query: "How to implement OAuth2 token refresh for QuickBooks Online v3" or "React best practices for data fetching with error boundaries"

## Recommended Queries for This Project

**QBO Related:**
- OAuth2 token refresh flow
- PurchaseOrder, Invoice, Bill, Payment entity schemas
- Query language for GET requests
- Error handling and intuit_tid header usage

**Firebase Related:**
- Cloud Functions best practices with Express
- Firestore rules and security
- Firebase Admin SDK usage in functions

**Frontend Related:**
- React patterns with Vite + Tailwind
- Proper error handling with Toast notifications
- Data fetching with the custom api.js wrapper

## Integration Rule
Before writing any code that uses an external API or framework, use this skill to get the latest patterns and examples. This prevents using outdated approaches and improves code quality significantly.

Add results from Context7 queries to the memory graph using the memory-manager skill.