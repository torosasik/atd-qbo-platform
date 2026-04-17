import { describe, it, expect } from 'vitest';
import sheetsRoutesModule from '../sheets-routes.js';

const { transposeSheetData } = sheetsRoutesModule.__test__;

/**
 * Regression tests for the "Orders page only shows 2 orders" bug.
 *
 * The column-oriented master sheet stores each order as its own column.
 * transposeSheetData must surface every column that contains data — even
 * when the header text is long, duplicated, or missing entirely.
 */
describe('transposeSheetData', () => {
  function rows(...entries) {
    // Build { [labelColumn]: 'Order #', col1: '123', col2: '124', ... }
    return entries.map((obj) => ({ ...obj }));
  }

  it('returns every column with data, not just those with short header text', () => {
    // Six orders, one with a header longer than the old 30-char limit.
    const longHeader = 'Order placed 10/31/2024 — Jane Doe, invoice A-1234';
    const headers = [
      'Field',
      '2024-10-31',
      '2024-11-02',
      '2024-11-05',
      longHeader,
      '2024-11-10',
      '2024-11-12',
    ];

    const data = [
      { Field: 'Order #',   '2024-10-31': '1001', '2024-11-02': '1002', '2024-11-05': '1003', [longHeader]: '1004', '2024-11-10': '1005', '2024-11-12': '1006' },
      { Field: 'SKU',       '2024-10-31': 'A',    '2024-11-02': 'B',    '2024-11-05': 'C',    [longHeader]: 'D',    '2024-11-10': 'E',    '2024-11-12': 'F' },
      { Field: 'Vendor',    '2024-10-31': 'V1',   '2024-11-02': 'V2',   '2024-11-05': 'V3',   [longHeader]: 'V4',   '2024-11-10': 'V5',   '2024-11-12': 'V6' },
      { Field: 'Item Name', '2024-10-31': 'Tile', '2024-11-02': 'Tile', '2024-11-05': 'Tile', [longHeader]: 'Tile', '2024-11-10': 'Tile', '2024-11-12': 'Tile' },
      { Field: 'Qty',       '2024-10-31': '1',    '2024-11-02': '2',    '2024-11-05': '3',    [longHeader]: '4',    '2024-11-10': '5',    '2024-11-12': '6' },
    ];

    const result = transposeSheetData(headers, rows(...data));

    expect(result.headers).toEqual(['Order #', 'SKU', 'Vendor', 'Item Name', 'Qty']);
    // All six orders should survive — previously the long-header one was dropped.
    expect(result.rows).toHaveLength(6);
    expect(result.rows.map((r) => r['Order #'])).toEqual(['1001', '1002', '1003', '1004', '1005', '1006']);
  });

  it('preserves orders whose header cell is empty (synthetic \\x00__col_* key)', () => {
    // Simulates readSheetData passing through a blank header cell as '\x00__col_3'.
    const synthetic = '\x00__col_3';
    const headers = ['Field', '2024-10-31', '2024-11-02']; // visible headers, synthetic not included
    const data = [
      { Field: 'Order #',   '2024-10-31': '1001', [synthetic]: '1002', '2024-11-02': '1003' },
      { Field: 'SKU',       '2024-10-31': 'A',    [synthetic]: 'B',    '2024-11-02': 'C' },
      { Field: 'Vendor',    '2024-10-31': 'V1',   [synthetic]: 'V2',   '2024-11-02': 'V3' },
      { Field: 'Item Name', '2024-10-31': 'T',    [synthetic]: 'T',    '2024-11-02': 'T' },
      { Field: 'Qty',       '2024-10-31': '1',    [synthetic]: '2',    '2024-11-02': '3' },
    ];

    const result = transposeSheetData(headers, rows(...data));
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((r) => r['Order #']).sort()).toEqual(['1001', '1002', '1003']);
  });

  it('drops columns that have no data in any field', () => {
    const headers = ['Field', '2024-10-31', '2024-11-02'];
    const data = [
      { Field: 'Order #',   '2024-10-31': '1001', '2024-11-02': '' },
      { Field: 'SKU',       '2024-10-31': 'A',    '2024-11-02': '' },
      { Field: 'Vendor',    '2024-10-31': 'V1',   '2024-11-02': '' },
      { Field: 'Item Name', '2024-10-31': 'Tile', '2024-11-02': '' },
      { Field: 'Qty',       '2024-10-31': '1',    '2024-11-02': '' },
    ];

    const result = transposeSheetData(headers, rows(...data));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]['Order #']).toBe('1001');
  });

  it('returns the original shape when the sheet is not column-oriented', () => {
    // Regular row-oriented sheet — too few matching field labels to trigger
    // the transpose path.
    const headers = ['Customer', 'Total', 'Notes'];
    const data = [
      { Customer: 'Acme', Total: '100', Notes: 'first' },
      { Customer: 'Globex', Total: '200', Notes: 'second' },
    ];
    const result = transposeSheetData(headers, data);
    expect(result.headers).toEqual(headers);
    expect(result.rows).toEqual(data);
  });

  it('handles empty input safely', () => {
    expect(transposeSheetData([], [])).toEqual({ headers: [], rows: [] });
    expect(transposeSheetData(['A'], [])).toEqual({ headers: ['A'], rows: [] });
  });
});
