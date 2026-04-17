/**
 * Unit tests for PaginationControls and ReceiptModal internal components
 * exported from Orders.jsx. Uses the same lightweight render pattern as
 * smoke.test.js (react-dom/client + jsdom) since @testing-library/react
 * is not a project dependency.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { PaginationControls, ReceiptModal } from './Orders.jsx';

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(node) {
  act(() => {
    root.render(<StrictMode>{node}</StrictMode>);
  });
}

function fireClick(el) {
  act(() => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

describe('PaginationControls', () => {
  it('renders "0 rows" and disables both arrows when totalItems is 0', () => {
    render(
      <PaginationControls
        page={1}
        pageSize={50}
        totalItems={0}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    );
    expect(container.textContent).toContain('0 rows');
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].disabled).toBe(true); // Previous
    expect(buttons[1].disabled).toBe(true); // Next
  });

  it('renders range "51–100 of 120" and "Page 2 of 3" with both arrows enabled', () => {
    render(
      <PaginationControls
        page={2}
        pageSize={50}
        totalItems={120}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    );
    expect(container.textContent).toContain('51–100 of 120');
    expect(container.textContent).toContain('Page 2 of 3');
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].disabled).toBe(false);
  });

  it('calls onPageChange(2) when Next is clicked from page 1', () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        page={1}
        pageSize={50}
        totalItems={100}
        onPageChange={onPageChange}
        onPageSizeChange={() => {}}
      />
    );
    const next = container.querySelector('button[aria-label="Next page"]');
    fireClick(next);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables Next on last page and Previous on first page', () => {
    render(
      <PaginationControls
        page={1}
        pageSize={50}
        totalItems={50}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    );
    expect(container.querySelector('button[aria-label="Previous page"]').disabled).toBe(true);
    expect(container.querySelector('button[aria-label="Next page"]').disabled).toBe(true);
  });

  it('calls onPageSizeChange with a numeric value when the select changes', () => {
    const onPageSizeChange = vi.fn();
    render(
      <PaginationControls
        page={1}
        pageSize={25}
        totalItems={100}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />
    );
    const select = container.querySelector('select');
    act(() => {
      select.value = '100';
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
    expect(typeof onPageSizeChange.mock.calls[0][0]).toBe('number');
  });
});

describe('ReceiptModal', () => {
  it('renders nothing when receipt is null', () => {
    render(<ReceiptModal receipt={null} onClose={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('auto receipt with 1 draft + 2 orders uses singular "draft" and plural "rows"', () => {
    const receipt = {
      type: 'auto',
      createdAt: '2026-04-17',
      drafts: [{ draftId: 'a' }],
      orders: [{ orderNumber: '1' }, { orderNumber: '2' }],
    };
    render(<ReceiptModal receipt={receipt} onClose={() => {}} />);
    expect(container.textContent).toContain('1 purchase order draft created from 2 order rows.');
  });

  it('manual receipt with 1 order uses singular "row"', () => {
    const receipt = {
      type: 'manual',
      createdAt: '2026-04-17',
      drafts: [],
      orders: [{ orderNumber: '1' }],
    };
    render(<ReceiptModal receipt={receipt} onClose={() => {}} />);
    expect(container.textContent).toContain('1 order row ready for manual purchase order creation.');
  });

  it('invokes onClose on Close click and onContinue on Continue click', () => {
    const onClose = vi.fn();
    const onContinue = vi.fn();
    const receipt = {
      type: 'auto',
      createdAt: '2026-04-17',
      drafts: [{ draftId: 'a' }],
      orders: [{ orderNumber: '1' }],
    };
    render(<ReceiptModal receipt={receipt} onClose={onClose} onContinue={onContinue} />);
    const buttons = Array.from(container.querySelectorAll('button'));
    const closeBtn = buttons.find((b) => b.textContent.trim() === 'Close');
    const continueBtn = buttons.find((b) => b.textContent.includes('View Purchase Orders'));
    fireClick(closeBtn);
    fireClick(continueBtn);
    expect(onClose).toHaveBeenCalled();
    expect(onContinue).toHaveBeenCalled();
  });
});
