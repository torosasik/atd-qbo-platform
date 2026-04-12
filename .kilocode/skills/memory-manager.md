---
name: memory-manager
description: Skill for using MCP Memory server to build persistent knowledge graph about the ATD QBO project, common patterns, past issues, and module templates
---

# Memory Manager Skill for Roo

## Purpose
Persist important project knowledge so future Roo sessions can recall QBO API patterns, module structures, common bugs, and architectural decisions.

## Key Entities to Track
- **Modules**: purchase-order, invoice, bill, payment, vendor-management
- **Core Components**: ai-router, qbo-auth, cache, logger, rules-engine
- **Common Issues**: actor system bypass, in-memory cache, missing error context, intuit_tid handling, tool-usage looping ("You did not use a tool" errors), repetitive explanations without tool calls
- **Patterns**: module-template structure, validateRequest middleware, actor registration, strict tool-orchestrator pattern, anti-looping triggers

## Usage Patterns

### Creating Knowledge
```javascript
// Use mcp--memory--create_entities
{
  "entities": [{
    "name": "PurchaseOrderModule",
    "entityType": "Module",
    "observations": [
      "Follows standard module template with prompts.js and index.js",
      "Must use actor system - never direct function calls",
      "Requires validateRequest middleware with Joi schema"
    ]
  }]
}
```

### Adding Observations
Use `mcp--memory--add_observations` to record lessons learned, bug fixes, or new patterns.

### Querying Knowledge
Use `mcp--memory--search_nodes` before starting complex tasks to recall relevant patterns.

### Opening Specific Nodes
Use `mcp--memory--open_nodes` when you need full details about specific modules or components.

## Integration with Rules
- Before editing any file, query memory for related patterns using [`mcp--memory--search_nodes`](.kilocode/skills/memory-manager.md:39)
- After fixing bugs (especially tool looping or rule violations), record the solution using [`mcp--memory--add_observations`](.kilocode/skills/memory-manager.md:36)
- Before creating new modules, load existing module templates from memory
- **New**: Record "tool-usage-looping" observations and successful anti-looping patterns to prevent regression

This skill ensures Roo maintains continuity across sessions and avoids repeating past mistakes like tool-usage looping.