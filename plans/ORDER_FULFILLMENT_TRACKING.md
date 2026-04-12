# Order Fulfillment Tracking Plan

## Problem
Orders page shows data from a **read-only** Google Sheet. User needs to track procurement/fulfillment details per order line that cannot be stored on the sheet.

## Decision: Firestore for Storage
- Google Sheet is READ-ONLY — cannot write to it
- Firestore already used for `order_statuses` — same key pattern
- No API rate limits, real-time queries, already integrated

## Data Model

**Collection:** `order_fulfillment`  
**Document ID:** `{orderNumber}_{lineItem}`

| Field | Type | Description |
|-------|------|-------------|
| source | string | `in_stock` or `vendor_purchase` |
| vendorName | string | Which vendor we ordered from |
| orderDate | timestamp | When PO was placed to vendor |
| cost | number | How much it cost |
| shippingMethod | string | `pickup`, `drop_ship`, `vendor_dropoff`, `ups`, `fedex`, `other` |
| trackingNumber | string | Shipping tracking number |
| received | boolean | Did we receive the product? |
| receivedDate | timestamp | When received |
| poNumber | string | Our purchase order number |
| vendorInvoiceNumber | string | Vendor invoice number |
| paid | boolean | Is the PO paid? |
| paidDate | timestamp | When paid |
| notes | string | Free-form notes |
| updatedAt | timestamp | Server timestamp |

## Architecture

```
Google Sheet (READ-ONLY) ──> Orders Page <──── Firestore order_statuses
                                  │
                                  ├──── Firestore order_fulfillment (NEW)
                                  │         GET /order-fulfillment
                                  │         PUT /order-fulfillment/:orderNumber/:lineItem
                                  │
                                  └──── UI: Expandable row detail panel
```

## Implementation Steps

### Backend (parallelizable)
1. `functions/api/order-fulfillment-routes.js` — New route file
   - `GET /` — Return all fulfillment documents
   - `PUT /:orderNumber/:lineItem` — Upsert fulfillment for one order line
   - AC: Both endpoints return JSON, validate input

2. `functions/index.js` — Register routes
   - `apiRouter.use('/order-fulfillment', orderFulfillmentRoutes)`
   - AC: `/api/order-fulfillment` returns 200

### Frontend (parallelizable with backend)
3. `frontend/src/utils/api.js` — Add API helpers
   - `getOrderFulfillment()` → GET `/order-fulfillment`
   - `setOrderFulfillment(orderNumber, lineItem, data)` → PUT
   - AC: Functions exist and are callable

4. `frontend/src/pages/Orders.jsx` — Expandable row detail panel
   - Click row → expand to show fulfillment form
   - Form fields: source, vendor, order date, cost, shipping method, tracking #, received, received date, PO #, vendor invoice #, paid, notes
   - Save button persists to Firestore
   - AC: Can expand row, fill form, save, and see saved data on reload

5. `frontend/src/pages/Orders.jsx` — Fulfillment status indicators on table rows
   - Color-coded badges: In Stock, Ordered, Received, Paid
   - AC: Badges visible in table without expanding

### Deploy & Test
6. Build frontend, deploy functions + hosting, verify end-to-end
