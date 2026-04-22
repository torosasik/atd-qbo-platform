'use strict';

const Joi = require('joi');

// CORS middleware to allow frontend and Cloud Functions domains for OAuth redirect and API calls
const cors = (req, res, next) => {
  const allowedOrigins = [
    'https://atd-qbo-platform.web.app',
    'https://atd-ops-hub.web.app',
    'https://us-central1-atd-qbo-platform.cloudfunctions.net'
  ];
  const origin = req.get('Origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // For same-origin or no Origin header (like direct CF calls)
    res.set('Access-Control-Allow-Origin', '*');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  next();
};

// Validation middleware factory
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      const validationError = new Error(`Validation error: ${errorMessage}`);
      validationError.code = 'VALIDATION_ERROR';
      validationError.status = 400;
      return next(validationError);
    }
    next();
  };
};

// Consistent error response helper
const sendError = (res, error, status = 500, code = 'UNKNOWN_ERROR') => {
  res.status(status).json({
    success: false,
    error: error.message || error,
    code,
  });
};

// Consistent success response helper
const sendSuccess = (res, data = null, message = null) => {
  const response = { success: true };
  if (data !== null) response.data = data;
  if (message) response.message = message;
  res.status(200).json(response);
};

// Retry mechanism for operations
const retryOperation = async (operation, maxRetries = 3, delayMs = 1000) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError;
};

// Shared line item schema — matches frontend payload field names exactly.
// Frontend sends: itemId, itemName, sku, description, quantity, qty, unitPrice, unit
const lineItemSchema = Joi.object({
  itemId: Joi.string().trim().allow('').optional(),
  itemName: Joi.string().trim().allow('').optional(),
  sku: Joi.string().trim().allow('').optional(),
  description: Joi.string().trim().required(),
  quantity: Joi.number().positive().optional(),
  qty: Joi.number().positive().optional(),
  unitPrice: Joi.number().min(0).required(),
  unit: Joi.string().trim().allow('').optional(),
  accountId: Joi.string().trim().allow('').optional(),
}).options({ stripUnknown: true });

// Validation schemas
const schemas = {
  // PO create schema — matches PurchaseOrders.jsx handleSubmit payload exactly.
  // Frontend sends: poNumber, vendorId, vendorName, date, memo, vendorMessage,
  //                  lines[{itemId, sku, description, quantity, unit, unitPrice}],
  //                  autoApprove, aiEnabled
  poCreate: Joi.object({
    vendorId: Joi.string().trim().allow('').optional(),
    vendorName: Joi.string().trim().min(1).optional(),     // required if vendorId absent; validated in module
    poNumber: Joi.string().trim().min(1).required(),
    date: Joi.string().isoDate().optional(),               // frontend sends 'date'
    txnDate: Joi.string().isoDate().optional(),            // legacy field name also accepted
    memo: Joi.string().trim().allow('').optional(),
    vendorMessage: Joi.string().trim().allow('').optional(),
    lines: Joi.array().items(lineItemSchema).min(1).required(),
    autoApprove: Joi.boolean().optional(),
    aiEnabled: Joi.boolean().optional(),
  }).options({ stripUnknown: true }),

  // Invoice create schema
  invoiceCreate: Joi.object({
    customerName: Joi.string().trim().min(1).required(),
    lines: Joi.array().items(lineItemSchema).min(1).required(),
    txnDate: Joi.string().isoDate().optional(),
    memo: Joi.string().trim().optional(),
    autoApprove: Joi.boolean().optional(),
    aiEnabled: Joi.boolean().optional(),
  }),

  // Bill create schema
  billCreate: Joi.object({
    vendorName: Joi.string().trim().min(1).required(),
    lines: Joi.array().items(lineItemSchema).min(1).required(),
    txnDate: Joi.string().isoDate().optional(),
    memo: Joi.string().trim().optional(),
    autoApprove: Joi.boolean().optional(),
    aiEnabled: Joi.boolean().optional(),
  }),

  // Payment create schema
  paymentCreate: Joi.object({
    customerId: Joi.string().trim().min(1).required(),
    customerName: Joi.string().trim().min(1).required(),
    totalAmount: Joi.number().positive().required(),
    lines: Joi.array().items(
      Joi.object({
        amount: Joi.number().positive().required(),
        linkedTxn: Joi.object({
          txnId: Joi.string().trim().required(),
          txnType: Joi.string().valid('Invoice').required(),
        }).optional(),
      })
    ).optional(),
    txnDate: Joi.string().isoDate().optional(),
    memo: Joi.string().trim().optional(),
    paymentMethod: Joi.string().trim().optional(),
    referenceNumber: Joi.string().trim().optional(),
    autoApprove: Joi.boolean().optional(),
    aiEnabled: Joi.boolean().optional(),
  }),

  // Expense categorize schema
  expenseCategorize: Joi.object({
    expenseId: Joi.string().trim().min(1).required(),
    suggestedAccountId: Joi.string().trim().optional(),
  }),

  // AI chat schema
  aiChat: Joi.object({
    message: Joi.string().trim().min(1).required(),
    context: Joi.object().optional(),
  }),

  // Item create schema
  itemCreate: Joi.object({
    name: Joi.string().trim().min(1).required(),
    type: Joi.string().valid('Inventory', 'NonInventory', 'Service').optional(),
    description: Joi.string().trim().optional(),
    unitPrice: Joi.number().min(0).optional(),
  }),

  // Settings update schema
  settingsUpdate: Joi.object().pattern(
    Joi.string(),
    Joi.any()
  ).optional(),

  // Vendor mappings update schema
  vendorMappings: Joi.object({
    vendors: Joi.array().items(
      Joi.object({
        qbo_id: Joi.string().trim().required(),
        qbo_name: Joi.string().trim().required(),
        active: Joi.boolean().required(),
        shopify_code: Joi.string().trim().allow('').optional(),
        visible: Joi.boolean().optional(),
      }).options({ stripUnknown: true })
    ).required(),
  }),

  // Bulk operations schemas
  bulkInvoices: Joi.object({
    invoices: Joi.array().items(
      Joi.object({
        customerName: Joi.string().trim().min(1).required(),
        lines: Joi.array().items(lineItemSchema).min(1).required(),
        txnDate: Joi.string().isoDate().optional(),
        memo: Joi.string().trim().optional(),
        autoApprove: Joi.boolean().optional(),
        aiEnabled: Joi.boolean().optional(),
      })
    ).min(1).max(50).required(), // Limit bulk to 50 items
  }),

  bulkBills: Joi.object({
    bills: Joi.array().items(
      Joi.object({
        vendorName: Joi.string().trim().min(1).required(),
        lines: Joi.array().items(lineItemSchema).min(1).required(),
        txnDate: Joi.string().isoDate().optional(),
        memo: Joi.string().trim().optional(),
        autoApprove: Joi.boolean().optional(),
        aiEnabled: Joi.boolean().optional(),
      })
    ).min(1).max(50).required(),
  }),

  bulkPayments: Joi.object({
    payments: Joi.array().items(
      Joi.object({
        customerId: Joi.string().trim().min(1).required(),
        customerName: Joi.string().trim().min(1).required(),
        totalAmount: Joi.number().positive().required(),
        lines: Joi.array().items(
          Joi.object({
            amount: Joi.number().positive().required(),
            linkedTxn: Joi.object({
              txnId: Joi.string().trim().required(),
              txnType: Joi.string().valid('Invoice').required(),
            }).optional(),
          })
        ).optional(),
        txnDate: Joi.string().isoDate().optional(),
        memo: Joi.string().trim().optional(),
        paymentMethod: Joi.string().trim().optional(),
        referenceNumber: Joi.string().trim().optional(),
        autoApprove: Joi.boolean().optional(),
        aiEnabled: Joi.boolean().optional(),
      })
    ).min(1).max(50).required(),
  }),
};

module.exports = {
  cors,
  validateRequest,
  sendError,
  sendSuccess,
  retryOperation,
  schemas,
};