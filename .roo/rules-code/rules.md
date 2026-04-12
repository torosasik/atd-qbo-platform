# ATD QBO Platform - Roo Code Rules

## Core Roo Rules (MANDATORY)
- **Markdown Format**: Every code or file reference MUST be a clickable link in this exact format: [`functionName()`](relative/path/to/file.js:42)
- **Tool Usage**: You MUST call at least one tool in EVERY response
- **Todo Tracking**: Use [`update_todo_list`](.kilocode/workflows/improve-roo.md:1) on all multi-step tasks
- **Confirmation**: Always confirm tool success before using attempt_completion
- **No Trailing Questions**: Never end attempt_completion with questions

## Tool Usage Priority
1. [`list_files`](.kilocode/:1) (recursive when exploring directories)
2. [`read_file`](.kilocode/rules.md:1) with indentation mode when anchor line known
3. [`search_files`](.kilocode/rules.md:1) for finding patterns
4. [`search_replace`](.kilocode/rules.md:1) for edits (must include 3-5 lines context before and after)
5. MCP tools (memory, context7, puppeteer, time)

## Project Architecture Rules
- Use actor system pattern - never bypass with direct calls
- All errors must preserve full context (intuit_tid, originalError, stack)
- All cache must use Firestore or localStorage - no in-memory state
- All AI calls must go through core/ai-router.js
- All QBO calls must go through core/qbo-auth.js
- Minimize QBO GET calls through aggressive caching
- All comments MUST be in English
- Backend: CommonJS, Frontend: ES Modules

## MCP Server Usage
- **Memory**: Use to build knowledge graph of QBO entities, module patterns, and past issues
- **Context7**: Always resolve library ID first, then query for latest docs before coding
- **Puppeteer**: Use for automated UI testing of React dashboard pages
- **Time**: Use for timezone-aware logging and scheduling

## Return Format for Cloud Functions
Every Cloud Function must return: { success: boolean, data?: any, error?: string }

This file is loaded by Roo Code for the Code mode. All responses must follow these rules.