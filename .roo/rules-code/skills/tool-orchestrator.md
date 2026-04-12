---
name: tool-orchestrator
description: Enforces proper tool usage, markdown formatting, todo tracking, and MCP server coordination for Roo
---

# Tool Orchestrator Skill for Roo

## Core Rules (Non-Negotiable)
- **Must call at least 1 tool per response** (no exceptions)
- Use exact markdown format: [`example.function()`](relative/path/to/file.js:42)
- Update todo list on every multi-step task using [`update_todo_list`](.kilocode/workflows/improve-roo.md:1)
- Confirm tool success before using `attempt_completion`
- Never end `attempt_completion` with questions

## Recommended Tool Patterns
1. **Exploration**: Start with [`list_files`](.kilocode/:1) (recursive when needed)
2. **Reading**: Use [`read_file`](.roo/rules-code/rules.md:1) with indentation mode when possible
3. **Searching**: Use [`search_files`](.kilocode/rules.md:1) for patterns
4. **Editing**: Use [`search_replace`](.roo/rules-code/rules.md:1) with 3-5 lines context before AND after
5. **MCP Usage**:
   - `mcp--memory--*` for persistent knowledge
   - `mcp--context7--resolve-library-id` then `mcp--context7--query-docs` for documentation
   - `mcp--puppeteer--*` for UI testing

## Anti-Looping Rule
If you find yourself repeating the same action or getting error messages about tool usage, immediately call a tool (even [`list_files`](.roo/:1)) to break the cycle.

This skill is loaded by Roo Code and should govern all interactions with this workspace.