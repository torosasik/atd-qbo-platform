---
name: module-template
description: Standard pattern for building a new QBO module with backend Cloud Function, frontend React components, and Firestore logging
---

# Module Template

Every module in the ATD QBO Platform follows this exact pattern. Copy this structure when building a new module.

## Backend (Cloud Function)

File: `functions/modules/{module-name}.js`

```javascript
const { getFirestore } = require('firebase-admin/firestore');
const { getQboClient } = require('../core/qbo-auth');
const { aiReview } = require('../core/ai-router');
const { logAction } = require('../core/logger');

// Validate input data
async function validate(data) {
  const errors = [];
  // Check required fields
  // Match vendor/item IDs against cache
  // Return { valid: boolean, errors: string[] }
  return { valid: errors.length === 0, errors };
}

// Create entity in QBO
async function create(data) {
  try {
    const qbo = await getQboClient();
    const response = await qbo.post('/{entity}', formatForQbo(data));
    const intuitTid = response.headers['intuit_tid'];
    
    await logAction({
      module: '{module-name}',
      action: 'create',
      status: 'success',
      entityId: response.data.Id,
      intuitTid,
      data
    });
    
    return { success: true, data: response.data };
  } catch (err) {
    await logAction({
      module: '{module-name}',
      action: 'create',
      status: 'error',
      error: err.message,
      data
    });
    return { success: false, error: err.message };
  }
}

// Format data from app format to QBO API format
function formatForQbo(data) {
  // Transform app-friendly data structure to QBO entity format
  // Return QBO-compatible JSON
}

module.exports = { validate, create };
```

## Frontend (React Components)

Folder: `frontend/src/modules/{ModuleName}/`

### ModulePage.jsx (main container)
- Tab layout: Input | Review | History
- Controls manual/auto mode toggle
- Manages state flow between form, preview, and execution

### ModuleForm.jsx (input form)
- Form fields specific to this module
- Client-side validation
- Submit triggers validation + optional AI review

### ModulePreview.jsx (review before push)
- Shows formatted preview of what will be sent to QBO
- AI suggestions displayed here (if enabled)
- Approve / Edit / Reject buttons
- Approve triggers Cloud Function to push to QBO

### ModuleLog.jsx (history table)
- Firestore query for this module's audit log
- Shows: date, status, entity ID, any errors
- Click to view full details

## Firestore Collections

### auditLog (shared across all modules)
```
{
  module: string,          // 'purchase-order', 'invoice', etc.
  action: string,          // 'create', 'update', 'delete'
  status: string,          // 'success', 'error', 'rejected'
  entityId: string,        // QBO entity ID (if successful)
  intuitTid: string,       // QBO response header for debugging
  data: object,            // Input data that was sent
  aiReview: object|null,   // AI review result (if used)
  userId: string,          // Who triggered it
  timestamp: timestamp
}
```
