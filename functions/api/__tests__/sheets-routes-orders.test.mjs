// ESM test (.mjs) so vitest 2.x's import works. Source module is CJS, so we
// pull it in via createRequire and monkey-patch its dependencies BEFORE the
// require() destructure at the top of sheets-routes.js captures them.
//
// Covers:
//   - GET /orders?debug=1          (cheap cache-metadata probe)
//   - GET /orders?refresh=1        (force-bypass of a fresh cache)
//   - GET /orders stale-cache      (classified errorCode/errorFix/warning)
//   - POST /invalidate             (resets cachedAtMs + schemaVersion)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Fake Firestore — a single `cache/sheets_orders` doc plus a `logs` collection.
// The cache doc's state is mutated per-test via `cacheSnap`.
// ---------------------------------------------------------------------------
let cacheSnap = { exists: false, data: {} };
const cacheSetMock = vi.fn().mockResolvedValue(undefined);
const cacheGetMock = vi.fn().mockImplementation(async () => ({
  exists: cacheSnap.exists,
  data: () => cacheSnap.data,
}));
const fakeDocRef = { get: cacheGetMock, set: cacheSetMock };

const fakeLogCollection = { add: vi.fn().mockResolvedValue({ id: 'log-id' }) };
const fakeDraftsCollection = { doc: vi.fn(() => ({ id: 'draft-id' })) };

const fakeDb = {
  doc: vi.fn(() => fakeDocRef),
  collection: vi.fn((name) =>
    name === 'logs' ? fakeLogCollection : fakeDraftsCollection
  ),
  batch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
};

// ---------------------------------------------------------------------------
// Stub deps BEFORE requiring sheets-routes. sheets-routes does
//   const { getFirestore, FieldValue } = require('firebase-admin/firestore');
//   const { getSettings } = require('../core/settings');
//   const { readSheetData, groupByPO, testConnection } = require('../core/sheets-connector');
//   const { logAction } = require('../core/logger');
// at module load, so we must have the replacements in place before that.
// ---------------------------------------------------------------------------
const firestore = require('firebase-admin/firestore');
// firebase-admin/firestore exposes its exports as getter-only properties,
// so plain assignment throws. Redefine each property as a configurable
// data descriptor before sheets-routes destructures them.
Object.defineProperty(firestore, 'getFirestore', {
  value: vi.fn(() => fakeDb),
  writable: true,
  configurable: true,
});
Object.defineProperty(firestore, 'FieldValue', {
  value: { serverTimestamp: () => 'TS' },
  writable: true,
  configurable: true,
});

const settingsModule = require('../../core/settings');
settingsModule.getSettings = vi.fn().mockResolvedValue({
  google_sheets: {
    po_sheet_id: 'SHEET_ID',
    po_sheet_tab: 'Tab',
    header_row: 1,
    data_start_row: 2,
  },
});

const sheetsConnector = require('../../core/sheets-connector');
sheetsConnector.readSheetData = vi.fn();
sheetsConnector.groupByPO = vi.fn(() => []);
sheetsConnector.testConnection = vi.fn();

const logger = require('../../core/logger');
logger.logAction = vi.fn().mockResolvedValue(undefined);

// Now load the router — its destructure captures the stubs above.
const router = require('../sheets-routes.js');
const { CACHE_SCHEMA_VERSION } = router.__test__;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(router);
  // Minimal error handler matching the real middleware shape so
  // `next(err)` paths return JSON instead of HTML.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    res
      .status(err.status || 500)
      .json({ success: false, error: err.message, code: err.code || 'ERR' });
  });
  return app;
}

beforeEach(() => {
  cacheSnap = { exists: false, data: {} };
  cacheSetMock.mockClear();
  cacheGetMock.mockClear();
  sheetsConnector.readSheetData.mockReset();
  sheetsConnector.readSheetData.mockResolvedValue({ headers: [], rows: [] });
  logger.logAction.mockClear();
  settingsModule.getSettings.mockClear();
});

describe('GET /orders?debug=1', () => {
  it('returns cache metadata without calling readSheetData', async () => {
    cacheSnap = {
      exists: true,
      data: {
        cachedAtMs: 1_000,
        rows: [{ a: 1 }, { a: 2 }],
        schemaVersion: CACHE_SCHEMA_VERSION,
      },
    };
    const res = await request(buildApp()).get('/orders?debug=1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      cachedAtMs: 1_000,
      rowCount: 2,
      schemaVersion: CACHE_SCHEMA_VERSION,
      currentSchemaVersion: CACHE_SCHEMA_VERSION,
      cacheTtlMs: expect.any(Number),
    });
    expect(sheetsConnector.readSheetData).not.toHaveBeenCalled();
    expect(settingsModule.getSettings).not.toHaveBeenCalled();
  });

  it('returns zero/null cache fields when no cache doc exists', async () => {
    cacheSnap = { exists: false, data: {} };
    const res = await request(buildApp()).get('/orders?debug=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      cachedAtMs: 0,
      rowCount: 0,
      schemaVersion: null,
      cacheAgeMs: null,
    });
    expect(sheetsConnector.readSheetData).not.toHaveBeenCalled();
  });
});

describe('GET /orders?refresh=1', () => {
  it('bypasses a fresh cache and calls readSheetData', async () => {
    cacheSnap = {
      exists: true,
      data: {
        cachedAtMs: Date.now(),
        rows: [{ old: 1 }],
        headers: ['old'],
        schemaVersion: CACHE_SCHEMA_VERSION,
      },
    };
    sheetsConnector.readSheetData.mockResolvedValue({
      headers: ['Order #', 'SKU'],
      rows: [{ 'Order #': '1001', SKU: 'A' }],
    });
    const res = await request(buildApp()).get('/orders?refresh=1');
    expect(res.status).toBe(200);
    expect(sheetsConnector.readSheetData).toHaveBeenCalledTimes(1);
    expect(res.body.data.source).toBe('live');
    expect(res.body.data.rows).toEqual([{ 'Order #': '1001', SKU: 'A' }]);
    // The live path writes the fresh payload back to the cache.
    expect(cacheSetMock).toHaveBeenCalled();
    const writeArgs = cacheSetMock.mock.calls[0][0];
    expect(writeArgs.schemaVersion).toBe(CACHE_SCHEMA_VERSION);
    expect(typeof writeArgs.cachedAtMs).toBe('number');
  });
});

describe('GET /orders stale-cache fallback', () => {
  it('returns errorCode/errorFix/warning with source=stale-cache on 403', async () => {
    cacheSnap = {
      exists: true,
      data: {
        cachedAtMs: Date.now() - 10 * 60 * 1000, // 10 min old → not fresh
        rows: [{ old: 1 }],
        headers: ['H'],
        schemaVersion: CACHE_SCHEMA_VERSION,
      },
    };
    const err = new Error('The caller does not have permission');
    err.status = 403;
    sheetsConnector.readSheetData.mockRejectedValue(err);

    const res = await request(buildApp()).get('/orders');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      source: 'stale-cache',
      errorCode: 'PERMISSION_DENIED',
      rows: [{ old: 1 }],
    });
    expect(res.body.data.errorFix).toMatch(/Share|service account/i);
    expect(res.body.data.warning).toMatch(/Permission denied/i);
  });

  it('returns a classified error response when no cache exists', async () => {
    cacheSnap = { exists: false, data: {} };
    const err = new Error('Requested entity was not found');
    err.status = 404;
    sheetsConnector.readSheetData.mockRejectedValue(err);

    const res = await request(buildApp()).get('/orders');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      code: 'SHEET_NOT_FOUND',
    });
  });
});

describe('POST /invalidate', () => {
  it('resets cachedAtMs and schemaVersion on the cache doc', async () => {
    const res = await request(buildApp()).post('/invalidate');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ invalidated: true });
    expect(cacheSetMock).toHaveBeenCalledWith(
      { cachedAtMs: 0, schemaVersion: 0 },
      { merge: true }
    );
  });
});
