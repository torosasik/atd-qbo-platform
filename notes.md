Read CLAUDE.md first. Improve the Create PO form with SKU search, Unit of Measure, custom PO number, and better layout.

STEP 1: Read the current code first
Read frontend/src/pages/PurchaseOrders.jsx completely
Read functions/modules/purchase-order/index.js completely
Read frontend/src/utils/api.js
Understand the current form structure before making changes.

STEP 2: Update the Item dropdown to a searchable combobox

When loading items from GET /api/items, each item has Name, Id, and Sku fields.

Replace the basic item select with a searchable input:
- Show items as: "SKU - Item Name" (e.g., "M3931 - Penny Marble Crystal Ocean 11 x 11.5")
- If item has no SKU, show just the name
- Add a text filter input: user types SKU or part of item name, dropdown filters instantly
- Show max 20 filtered results at a time (we have 6,000+ items in QBO)
- Use a text input that shows a dropdown list below it, filtering as user types
- When item is selected, auto-fill Description with the item name
- Clicking outside the dropdown closes it

STEP 3: Add Unit of Measure column to line items

Add a "Unit" dropdown column after Qty with these options:
- Sq Ft (default)
- Box
- Piece
- Each
- Linear Ft
- Pallet
- Sheet
- Case
- Roll
- Other

Simple select dropdown per line item.

STEP 4: Show SKU in the line items table

Add a narrow "SKU" read-only column after Item that auto-fills when an item is selected.
Table columns: # (row number), Item (searchable, 25% width), SKU (read-only gray text, 10%), Description (text input, 25%), Qty (8%), Unit (select, 10%), Unit Price ($ prefix, 10%), Total ($, 7%), Delete (trash icon, 5%)

STEP 5: PO Details layout

Vendor section (top card):
- Vendor dropdown (required)
- Below dropdown when vendor is selected, show Ship To in a light gray box:
  "American Tile Depot
   1440 S State College Blvd Ste 6G
   Anaheim, CA 92806"

PO Details (second card):
- Row 1: PO Number (text input, required, placeholder "Shopify Order #"), PO Date (date picker, default today)
- Row 2: Memo (text input, placeholder "Internal note"), Message to Vendor (text input, placeholder "Printed on PO PDF sent to vendor")
- Remove Due Date field completely if it exists
- Remove any "Auto-assigned by QBO" text

Line Items (third card):
- Table with columns as described in Step 4
- "+ Add Line" button top right
- Working trash icon per row (disabled when only 1 row exists)
- "Grand Total: $XX.XX" right-aligned below table

Submit section:
- AI Review toggle (default ON)
- Auto Approve toggle (default OFF)
- "Submit for Review" button

STEP 6: Update submit payload

The frontend should send:
{
  poNumber: "12345",
  vendorId: "42",
  vendorName: "Elysium Tiles",
  date: "2026-03-31",
  memo: "internal note",
  vendorMessage: "message printed on PO PDF",
  lines: [
    {
      itemId: "9122",
      sku: "M3931",
      description: "Penny Marble Crystal Ocean 11 x 11.5",
      quantity: 2,
      unit: "Box",
      unitPrice: 19.49
    }
  ]
}

Validate before submit:
- poNumber is required and not empty
- vendor is selected
- at least one line has description and quantity > 0

On success: green toast with QBO PO number, switch to History tab after 2 seconds
On error: red toast with error message and fix suggestion

STEP 7: Update backend purchase-order/index.js

In the createPO function that builds the QBO PurchaseOrder JSON:

- Set DocNumber from poNumber (this is the custom PO number matching Shopify order)
- Set PrivateNote from memo (internal note, not printed)
- Set Memo from vendorMessage (this gets printed on the PO PDF)
- For each line item, if unit is provided, append the unit to the Description:
  Description becomes: "Penny Marble Crystal Ocean 11 x 11.5 - M3931 (2 Boxes)"
  Format: "{description} ({quantity} {unit})"
  Only append if unit is not empty

Make sure validate() checks that poNumber is provided.
Make sure ensureValidToken() is called before the QBO API call.

STEP 8: Syntax check all modified files
Run: node --check functions/modules/purchase-order/index.js
Run: node --check functions/api/routes.js (if modified)

STEP 9: Build frontend
cd /Users/torosasik/Projects/atd-qbo-platform/frontend && npm run build
Check for build errors. If any, fix them before proceeding.

STEP 10: Deploy to Firebase
cd /Users/torosasik/Projects/atd-qbo-platform && firebase deploy --force
Verify deployment succeeds.

STEP 11: Test the endpoints
curl -s https://atd-qbo-platform.web.app/api/health | python3 -m json.tool
curl -s https://atd-qbo-platform.web.app/api/items | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('items',[]); print(f'Items loaded: {len(items)}'); [print(f'  {i.get(\"Sku\",\"no-sku\")} - {i[\"Name\"]}') for i in items[:5]]"

STEP 12: Report
List all files modified, what was changed, and test results.