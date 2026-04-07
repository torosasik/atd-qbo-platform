'use strict';

// ---------------------------------------------------------------------------
// buildChatSystemPrompt
// Returns the base system prompt for the ATD QBO AI chat assistant.
// ---------------------------------------------------------------------------

function buildChatSystemPrompt() {
  return `You are an AI assistant for American Tile Depot's QuickBooks Online automation platform.

American Tile Depot (ATD) is a tile and natural stone retailer in Anaheim, California. The platform automates accounting operations: purchase orders, invoices, bills, and payments through QuickBooks Online.

Your role:
- Help the ATD team with questions about purchasing, vendors, order history, and QBO operations
- Answer questions using only the data provided in the context section below
- Keep responses concise and actionable
- Never make up data or reference vendors, items, or orders that are not listed in the context
- If data is not available in the context, say so clearly rather than guessing

What you can help with:
- Recent purchase order activity and pending drafts
- Vendor names and IDs from the QuickBooks vendor list
- Item names and IDs from the QuickBooks item list
- Recent system logs and error history
- Guidance on how to use the platform features

What you cannot do:
- Access real-time QBO data outside of what is provided in the context
- Create, approve, or modify records directly
- Access banking feed transactions or QuickBooks tags`;
}

// ---------------------------------------------------------------------------
// detectDataNeeds
// Analyzes the user message with keyword matching to determine what Firestore
// or cache data should be fetched before answering.
// Returns an array of data type strings: 'recent_pos', 'vendors', 'items', 'logs'
// ---------------------------------------------------------------------------

function detectDataNeeds(message) {
  const lower = message.toLowerCase();
  const needs = new Set();

  // Purchase order related
  if (/\b(po|purchase\s*order|draft|pending|order|approve|approved|submitted|submit)\b/.test(lower)) {
    needs.add('recent_pos');
  }

  // Vendor related
  if (/\b(vendor|supplier|company|companies|suppliers|who\s+do\s+we\s+buy|buy\s+from)\b/.test(lower)) {
    needs.add('vendors');
  }

  // Item / product related
  if (/\b(item|product|sku|tile|stone|material|inventory|catalog)\b/.test(lower)) {
    needs.add('items');
  }

  // Log / activity / error related
  if (/\b(log|error|activity|history|recent|last|status|failed|fail|success|pushed)\b/.test(lower)) {
    needs.add('logs');
  }

  return [...needs];
}

// ---------------------------------------------------------------------------
// enrichWithData
// Adds fetched QBO and Firestore data as a context block prepended to the
// user message so the AI can reference real data when answering.
// ---------------------------------------------------------------------------

function enrichWithData(message, data) {
  const sections = [];

  if (data.recent_pos && data.recent_pos.length > 0) {
    const poLines = data.recent_pos.map((po) => {
      const vendor = po.vendorName || po.data?.vendorName || 'Unknown vendor';
      const status = po.status || 'unknown';
      const date = po.createdAt ? new Date(po.createdAt).toLocaleDateString() : 'unknown date';
      const id = po.id || '';
      const qboId = po.qboEntityId ? ` (QBO ID: ${po.qboEntityId})` : '';
      return `  - Draft ID: ${id} | Vendor: ${vendor} | Status: ${status} | Date: ${date}${qboId}`;
    });
    sections.push(`Recent Purchase Orders (last 10):\n${poLines.join('\n')}`);
  }

  if (data.vendors && data.vendors.length > 0) {
    const vendorLines = data.vendors
      .slice(0, 50)
      .map((v) => `  - ${v.DisplayName || v.CompanyName || 'Unnamed'} (ID: ${v.Id})`);
    const extra = data.vendors.length > 50 ? `\n  ... and ${data.vendors.length - 50} more` : '';
    sections.push(`QuickBooks Vendor List (${data.vendors.length} total):\n${vendorLines.join('\n')}${extra}`);
  }

  if (data.items && data.items.length > 0) {
    const itemLines = data.items
      .slice(0, 50)
      .map((item) => `  - ${item.Name || 'Unnamed'} (ID: ${item.Id}, Type: ${item.Type || 'unknown'})`);
    const extra = data.items.length > 50 ? `\n  ... and ${data.items.length - 50} more` : '';
    sections.push(`QuickBooks Item List (${data.items.length} total):\n${itemLines.join('\n')}${extra}`);
  }

  if (data.logs && data.logs.length > 0) {
    const logLines = data.logs.map((entry) => {
      const date = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'unknown time';
      return `  - [${date}] ${entry.module} / ${entry.action}: ${entry.status}${entry.details?.error ? ' - ' + entry.details.error : ''}`;
    });
    sections.push(`Recent System Logs (last 20):\n${logLines.join('\n')}`);
  }

  if (sections.length === 0) {
    return message;
  }

  return `--- QBO Platform Data Context ---\n${sections.join('\n\n')}\n--- End Context ---\n\nUser question: ${message}`;
}

module.exports = { buildChatSystemPrompt, detectDataNeeds, enrichWithData };
