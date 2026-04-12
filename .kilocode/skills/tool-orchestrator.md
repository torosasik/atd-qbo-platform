---
name: tool-orchestrator
description: Master skill for Roo to properly use tools, maintain todo lists, follow markdown rules, and coordinate MCP servers
---

# Roo Tool Orchestrator Skill

## Core Principles
- ALWAYS call at least one tool per response
- Use parallel tool calls when multiple pieces of information are needed
- Maintain todo list with update_todo_list on every multi-step task
- Use exact markdown format: [`functionName()`](path/to/file.js:42)
- Confirm tool success before attempt_completion

## Recommended Tool Usage Patterns

### Exploration Phase
1. Start with [`list_files`](.kilocode/rules.md:1) (recursive=true for deep exploration)
2. Use [`read_file`](.kilocode/system-prompt-code:1) with indentation mode when possible
3. Use [`search_files`](.kilocode/rules.md:1) for finding patterns across codebase

### Analysis & Editing Phase
- Use [`read_file`](.kilocode/rules.md:1) first before any edit
- Use [`search_replace`](.kilocode/rules.md:1) with 3-5 lines context before AND after change
- Never use write_to_file for modifications to existing files

### MCP Integration
- Use `mcp--memory--create_entities` and `mcp--memory--add_observations` to build knowledge graph (especially for UI observations)
- Use `mcp--context7--resolve-library-id` + `mcp--context7--query-docs` **before any external API work** (QBO, Firebase, Shopify)
- Use `mcp--puppeteer--*` tools via [`browser-ui-testing`](.kilocode/skills/browser-ui-testing.md:1) skill for all UI tasks with non-headless mode + screenshots
- New skills available: [`browser-ui-testing`](.kilocode/skills/browser-ui-testing.md:1), [`firebase-cloud`](.kilocode/skills/firebase-cloud.md:1), [`qbo-integration`](.kilocode/skills/qbo-integration.md:1), [`shopify-admin`](.kilocode/skills/shopify-admin.md:1)

## Workflow
1. Update todo list
2. Analyze with tools
3. Make changes
4. Verify with tests or additional tools
5. Update todo list
6. Complete with attempt_completion (no questions)

This skill should be automatically applied to all Roo interactions with this project.