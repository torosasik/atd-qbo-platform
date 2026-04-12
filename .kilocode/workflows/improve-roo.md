---
name: improve-roo
description: Workflow for systematically improving Roo's own capabilities (tool use, MCP integration, rules, skills, prompts)
trigger: /improve-roo
---

# Improve Roo Capabilities Workflow

## Steps

1. **Analysis Phase** (use `orchestrator` or `code` mode)
   - Run [`list_files`](.kilocode/:1) on `.kilocode/`, `.roo/`, `plans/`
   - Read current [`rules.md`](.kilocode/rules.md:1), [`system-prompt-code`](.kilocode/system-prompt-code:1), [`mcp.json`](.kilocode/mcp.json:1)
   - Query memory graph with [`mcp--memory--search_nodes`](.kilocode/skills/memory-manager.md:39) for "tool-usage-looping" or "anti-looping"
   - Review [`plans/ATD_QBO_KILO_CODE_CONFIG.md`](plans/ATD_QBO_KILO_CODE_CONFIG.md:1) for ideas (but keep separate from Kilo Code)
   - Update todo list with discovered gaps

2. **MCP Configuration**
   - Ensure [`mcp.json`](.kilocode/mcp.json:1) includes memory, context7, puppeteer, time
   - Test MCP connectivity using available tools

3. **Core Prompt & Rules**
   - Update [`system-prompt-code`](.kilocode/system-prompt-code:1) with strict tool usage and markdown rules
   - Enhance [`rules.md`](.kilocode/rules.md:1) with Roo-specific requirements (clickable links, mandatory tool use, todo tracking)

4. **Skills Creation**
   - Create `tool-orchestrator.md` - enforces tool rules and markdown format
   - Create `memory-manager.md` - leverages MCP memory for persistent knowledge
   - Create `context7-helper.md` - gets latest documentation before coding
   - Create additional skills as needed (qbo-module-specialist, debug-enhancer, etc.)

5. **Workflow & Validation**
   - Create self-improvement workflow (this file)
   - Add test cases that verify tool usage, markdown format, and todo tracking
   - Run the workflow periodically to keep Roo capabilities current

## Success Criteria
- All responses use proper [`clickable links`](.kilocode/rules.md:6)
- **Every response calls at least one tool** (enforced by updated tool-orchestrator and system prompts)
- Todo list is maintained on complex tasks using [`update_todo_list`](.kilocode/workflows/improve-roo.md:1)
- Memory graph contains project knowledge including "tool-usage-looping" patterns
- Context7 is used for documentation before coding
- Clear separation between Roo (`.roo/rules-code/`) and Kilo Code (`.kilocode/`) configurations
- Anti-looping triggers successfully break repetitive behavior

## New Self-Diagnostic Steps (added)
- After any task, query memory for recent "looping" observations
- If looping detected, force tool call + update memory with solution
- Run periodic validation with multi-tool test task

Run this workflow whenever Roo's behavior deviates from the rules (especially tool usage errors) or when new MCP capabilities become available.

**This workflow makes Roo self-improving and self-healing.**