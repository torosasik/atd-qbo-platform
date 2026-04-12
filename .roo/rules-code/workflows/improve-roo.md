---
name: improve-roo
description: Self-improvement workflow for Roo to fix looping, tool usage, and capability gaps
trigger: /improve-roo
---

# Improve Roo Workflow

## Purpose
This workflow fixes the exact problem you are experiencing - repetitive responses and tool usage errors.

## Steps

1. **Diagnosis** 
   - Use [`list_files`](.roo/:1) to see current configuration
   - Read the latest [`rules.md`](.roo/rules-code/rules.md:1) and [`system-prompt.md`](.roo/rules-code/system-prompt.md:1)

2. **Fix Tool Usage**
   - Ensure `tool-orchestrator.md` is loaded and emphasizes "MUST call at least one tool per response"
   - Add anti-looping logic to break repetitive patterns

3. **Update Memory**
   - Use memory-manager to record this looping issue and its solution
   - Add observations about successful patterns

4. **Verify**
   - Test with a command that requires multiple tools
   - Confirm no more "You did not use a tool" errors

## Anti-Looping Rule
If this workflow is triggered repeatedly, immediately call a tool (even a simple list_files) rather than explaining the workflow again.

This workflow makes Roo self-healing. Trigger it with `/improve-roo` whenever looping or tool usage issues occur.