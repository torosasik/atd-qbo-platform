---
name: memory-manager
description: Uses MCP Memory server to build persistent knowledge graph about ATD QBO project patterns, common issues, and module templates
---

# Memory Manager Skill

## Purpose
Prevent repetition and looping by maintaining persistent knowledge about:
- QBO API patterns and entity schemas
- Module template structure (prompts.js + index.js + routes)
- Common bugs (actor bypass, in-memory cache, missing error context)
- Successful patterns and fixes

## Key Usage Patterns

**Creating Entities:**
Use `mcp--memory--create_entities` to record module patterns, QBO requirements, and architectural rules.

**Adding Observations:**
Use `mcp--memory--add_observations` after fixing bugs or discovering new patterns (e.g. "Fixed looping by enforcing tool call in every response").

**Searching Knowledge:**
Use `mcp--memory--search_nodes` at the start of complex tasks to recall relevant past solutions.

**Anti-Looping Mechanism:**
Before responding, check memory for similar past situations. If a loop is detected, immediately call a tool (even a simple [`list_files`](.roo/:1)) to break the cycle.

This skill is critical for preventing the repetitive "You did not use a tool" errors by maintaining context across responses.