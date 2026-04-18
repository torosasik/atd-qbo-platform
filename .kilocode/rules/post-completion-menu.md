# Post-completion menu (all modes)

After EVERY `attempt_completion` result, append the following footer verbatim as the last content of the `result` parameter. This gives the user a one-click/one-type menu next to Kilo's built-in "Review" button.

```
---
**Next:** [/push-github](.kilocode/commands/push-github.md) · [/deploy-firebase](.kilocode/commands/deploy-firebase.md) · [/test-code](.kilocode/commands/test-code.md) · [/test-ui](.kilocode/commands/test-ui.md)
```

## Rules

- Applies to ALL modes (Code, Debug, Ask, Architect, Orchestrator, Review, and any custom mode).
- The menu is the LAST thing in the `result`. Nothing after it — no period, no trailing sentence.
- Do NOT add the menu to intermediate `ask_followup_question` responses. Only to `attempt_completion`.
- Do NOT include it when the task itself IS one of those actions (committing, deploying, running tests) — it would be recursive. In that case the completion already describes the action that ran.
- If the user has asked to suppress the menu ("skip the menu", "no footer"), omit it for that task only.

## Why

Kilo Code's native "Review" button is hard-coded in the extension UI; we can't add sibling buttons without forking the extension. This footer is the project-level equivalent: each item is a slash command under [`.kilocode/commands/`](../commands/) that the user can click or type to trigger the action.
