---
name: ai-router
description: Pattern for routing AI requests between Ollama (local, free) and Claude API (cloud, paid) with confidence scoring and fallback logic
---

# AI Router Pattern

The AI router selects the best AI provider for each request based on availability and cost.

## Decision Flow
```
1. Check if Ollama is running locally (GET http://localhost:11434/api/tags)
2. If yes: send request to Ollama
3. If Ollama returns low confidence (<90): escalate to Claude API
4. If Ollama unreachable: fall back to Claude API
5. If Claude API also fails: skip AI review, flag for human review
6. If AI is disabled for this module: skip entirely
```

## Ollama Integration
```javascript
async function callOllama(prompt, model = 'llama3') {
  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      })
    });
    if (!response.ok) throw new Error('Ollama error: ' + response.status);
    const data = await response.json();
    return { provider: 'ollama', model, response: data.message.content };
  } catch (err) {
    return { provider: 'ollama', error: err.message, fallback: true };
  }
}
```

## Claude API Integration
```javascript
async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  return { provider: 'claude', model: 'sonnet', response: data.content[0].text };
}
```

## Settings (stored in Firestore)
```
Collection: settings
Document: aiConfig
Fields:
  ollamaEnabled: boolean (default true)
  ollamaUrl: string (default http://localhost:11434)
  ollamaModel: string (default llama3)
  claudeEnabled: boolean (default true)
  claudeModel: string (default claude-sonnet-4-20250514)
  confidenceThreshold: number (default 90)
  moduleOverrides: {
    purchase-order: { aiEnabled: true },
    invoice: { aiEnabled: true }
  }
```
