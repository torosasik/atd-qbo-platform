import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  X,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  Trash2,
  MapPin,
  Mail,
  Search,
} from 'lucide-react';
import { api } from '../utils/api';
import Toggle from '../components/shared/Toggle';
import LoadingSpinner from '../components/shared/LoadingSpinner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function StatusBadge({ status }) {
  const map = {
    success: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    draft: 'bg-blue-100 text-blue-700',
    error: 'bg-red-100 text-red-700',
    flagged: 'bg-yellow-100 text-yellow-700',
    clean: 'bg-green-100 text-green-700',
    skipped: 'bg-gray-100 text-gray-500',
  };
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  const cls = map[status?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function formatDateTime(ts) {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ts; }
}

const SHIP_TO_ADDRESS = 'American Tile Depot, 1440 S State College Blvd Ste 6G, Anaheim, CA 92806';

const UNIT_OPTIONS = ['Sq Ft', 'Box', 'Piece', 'Each', 'Linear Ft', 'Pallet', 'Sheet', 'Case', 'Roll', 'Other'];

const emptyLine = () => ({
  _id: Math.random().toString(36).slice(2),
  itemId: '',
  itemName: '',
  sku: '',
  description: '',
  qty: 1,
  unit: 'Sq Ft',
  unitPrice: '',
});

// ---------------------------------------------------------------------------
// Searchable Item Dropdown Component
// ---------------------------------------------------------------------------
function SearchableItemDropdown({ items, value, onChange, onCreateNew }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const selectedItem = items.find((item) => item.Id === value);

  function displayText(item) {
    if (!item) return '';
    return item.Sku ? `${item.Sku} - ${item.Name}` : item.Name;
  }

  // Advanced search: multi-token, prefix-aware, dimension-normalized, relevance-scored.
  //
  // Features:
  //   1. Each search word is matched independently (any order)
  //   2. Each token can match as an exact substring OR as a prefix of any word in the item
  //   3. Dimension shorthand "12x24" is matched against "12 X 24" style names
  //   4. Partial matches (most-but-not-all tokens) are shown below full matches
  //   5. Results sorted by relevance; up to 30 shown
  const filteredItems = (() => {
    const raw = search.trim().toLowerCase();
    if (!raw) return items.slice(0, 30);

    // Normalize dimension expressions: "12x24" → "12x24", "12 X 24" → "12x24"
    const normalizeDims = (s) => s.replace(/(\d+)\s*[xX×]\s*(\d+)/g, '$1x$2');

    const normalizedRaw = normalizeDims(raw);
    const tokens = normalizedRaw.split(/\s+/).filter(Boolean);

    // Returns a per-token match score: 2=exact substring, 1=prefix of a word, 0=no match
    function tokenMatchScore(token, haystack, haystackWords) {
      if (haystack.includes(token)) return 2;
      if (haystackWords.some((w) => w.startsWith(token))) return 1;
      return 0;
    }

    const scored = items.map((item) => {
      const name = normalizeDims((item.Name || '').toLowerCase());
      const sku  = normalizeDims((item.Sku  || '').toLowerCase());
      const desc = normalizeDims((item.Description || '').toLowerCase());
      const haystack = `${name} ${sku} ${desc}`;
      const haystackWords = haystack.split(/[\s\-\/,()+]+/).filter(Boolean);

      const tScores = tokens.map((t) => tokenMatchScore(t, haystack, haystackWords));
      const matchedCount = tScores.filter((s) => s > 0).length;
      if (matchedCount === 0) return null;

      // Base relevance score
      let score = tScores.reduce((sum, s) => sum + s, 0);

      // Bonus for matching all tokens
      if (matchedCount === tokens.length) {
        score += 20;
        // Extra bonus: full phrase found in name or sku
        if (name.includes(normalizedRaw) || sku.includes(normalizedRaw)) score += 10;
        // Extra bonus: name/sku starts with query
        if (name.startsWith(normalizedRaw) || sku.startsWith(normalizedRaw)) score += 5;
        // Extra bonus: tokens all in name (not just description)
        if (tScores.every((_, i) => tokenMatchScore(tokens[i], name, name.split(/[\s\-\/,()+]+/).filter(Boolean)) > 0)) score += 3;
      }

      return { item, score, matchedCount };
    }).filter(Boolean);

    // Sort: full matches first (by score), then partial matches (by score)
    scored.sort((a, b) => {
      if (a.matchedCount !== b.matchedCount) return b.matchedCount - a.matchedCount;
      return b.score - a.score;
    });

    return scored.slice(0, 30).map(({ item }) => item);
  })();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsFocused(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(item) {
    onChange({ id: item.Id, name: item.Name, sku: item.Sku || '' });
    setIsOpen(false);
    setIsFocused(false);
    setSearch('');
  }

  function handleInputFocus() {
    setIsFocused(true);
    setIsOpen(true);
    setSearch('');
  }

  function handleInputChange(e) {
    setSearch(e.target.value);
    if (!isOpen) setIsOpen(true);
  }

  function handleCreateClick(e) {
    e.stopPropagation();
    setIsOpen(false);
    setIsFocused(false);
    setSearch('');
    onCreateNew(search);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        value={isFocused ? search : displayText(selectedItem)}
        placeholder="Search by SKU or name..."
        onFocus={handleInputFocus}
        onChange={handleInputChange}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-atd-blue hover:border-gray-300 transition-colors"
      />

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* Items list */}
          <div className="overflow-y-auto max-h-60">
            {filteredItems.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400 text-center">
                No items found
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.Id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-atd-blue hover:text-white transition-colors ${
                    item.Id === value ? 'bg-blue-50 text-atd-blue' : 'text-gray-700'
                  }`}
                  onClick={() => handleSelect(item)}
                >
                  <div className="font-medium">{displayText(item)}</div>
                  {item.Description && (
                    <div className="text-xs opacity-70 truncate">{item.Description}</div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Create new option */}
          {search && (
            <div className="border-t border-gray-100">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-atd-blue hover:bg-blue-50 transition-colors flex items-center gap-2"
                onClick={handleCreateClick}
              >
                <Plus className="h-4 w-4" />
                <span>Create new item: "<strong>{search}</strong>"</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create New Item Modal Component
// ---------------------------------------------------------------------------
function CreateNewItemModal({ isOpen, onClose, onSuccess, initialName }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'NonInventory',
    description: '',
    unitPrice: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialName || '',
        type: 'NonInventory',
        description: '',
        unitPrice: '',
      });
      setError(null);
    }
  }, [isOpen, initialName]);

  function handleChange(field, value) {
    setFormData((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Item name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await api.createItem({
        name: formData.name.trim(),
        type: formData.type,
        description: formData.description.trim(),
        unitPrice: formData.unitPrice || null,
      });

      if (res.success) {
        onSuccess(res.item);
      } else {
        setError(res.error || 'Failed to create item.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create item.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-atd-dark">Create New Item</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter item name"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
              autoFocus
            />
          </div>

          {/* Item Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
            >
              <option value="NonInventory">Non-Inventory</option>
              <option value="Inventory">Inventory</option>
              <option value="Service">Service</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {formData.type === 'NonInventory' && 'Item not tracked in inventory'}
              {formData.type === 'Inventory' && 'Tracked in inventory (requires QBO setup)'}
              {formData.type === 'Service' && 'A service provided'}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue resize-none"
            />
          </div>

          {/* Unit Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={formData.unitPrice}
                onChange={(e) => handleChange('unitPrice', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-atd-blue hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving && <LoadingSpinner size="sm" color="white" />}
              Create Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Create New
// ---------------------------------------------------------------------------
function CreateTab({ vendors, qboVendors, items, vendorsLoading, onSwitchToHistory, onRefreshItems }) {
  const [form, setForm] = useState({
    vendorId: '',
    vendorName: '',
    vendorEmail: '',
    txnDate: today(),
    memo: '',
    vendorMessage: '',
    poNumber: '',
    lines: [emptyLine()],
    autoApprove: false,
    aiEnabled: true,
  });
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorOpen, setVendorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [createItemModalOpen, setCreateItemModalOpen] = useState(false);
  const [createItemSearchTerm, setCreateItemSearchTerm] = useState('');
  const [showAutoApproveConfirm, setShowAutoApproveConfirm] = useState(false);

  function resetForm() {
    setForm({
      vendorId: '',
      vendorName: '',
      vendorEmail: '',
      txnDate: today(),
      memo: '',
      vendorMessage: '',
      poNumber: '',
      lines: [emptyLine()],
      autoApprove: false,
      aiEnabled: true,
    });
    setVendorSearch('');
    setVendorOpen(false);
  }

  const filteredVendors = vendors.filter((v) =>
    v.DisplayName?.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const vendorDropdownRef = useRef(null);

  // Close vendor dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(event.target)) {
        setVendorOpen(false);
        setVendorSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle creating a new item
  function handleCreateNewItem(searchTerm) {
    setCreateItemSearchTerm(searchTerm);
    setCreateItemModalOpen(true);
  }

  // Handle successful item creation
  async function handleItemCreated(newItem) {
    setCreateItemModalOpen(false);
    // Refresh items list
    if (onRefreshItems) {
      await onRefreshItems();
    }
    // Select the new item in the first empty line
    setForm((f) => {
      const lines = f.lines.map((l) => {
        if (!l.itemId) {
          return {
            ...l,
            itemId: newItem.Id,
            itemName: newItem.Name,
            sku: newItem.Sku || '',
            description: newItem.Name,
            unitPrice: newItem.UnitPrice || '',
          };
        }
        return l;
      });
      return { ...f, lines };
    });
    setResult({ type: 'success', message: `Item "${newItem.Name}" created successfully!` });
  }

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function setLine(id, key, val) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => {
        if (l._id !== id) return l;
        if (key === 'item') {
          // val is { id, name, sku } from SearchableItemDropdown
          return {
            ...l,
            itemId: val.id,
            itemName: val.name,
            sku: val.sku,
            description: val.name,
          };
        }
        return { ...l, [key]: val };
      }),
    }));
  }

  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  }

  function removeLine(id) {
    if (form.lines.length <= 1) return;
    setForm((f) => ({ ...f, lines: f.lines.filter((l) => l._id !== id) }));
  }

  const grandTotal = form.lines.reduce(
    (sum, l) => sum + (parseFloat(l.qty) || 0) * (parseFloat(l.unitPrice) || 0),
    0
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.poNumber?.trim()) { setResult({ type: 'error', message: 'PO Number is required.' }); return; }
    if (!form.vendorId) { setResult({ type: 'error', message: 'Please select a vendor.' }); return; }
    const validLines = form.lines.filter((l) => l.description.trim() && parseFloat(l.qty) > 0);
    if (validLines.length === 0) {
      setResult({ type: 'error', message: 'At least one line item needs a description and quantity greater than 0.' });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const payload = {
        poNumber: form.poNumber.trim(),
        vendorId: form.vendorId,
        vendorName: form.vendorName,
        date: form.txnDate,
        memo: form.memo,
        vendorMessage: form.vendorMessage,
        lines: validLines.map((l) => ({
          itemId: l.itemId,
          sku: l.sku,
          description: l.description,
          quantity: parseFloat(l.qty) || 1,
          unit: l.unit,
          unitPrice: parseFloat(l.unitPrice) || 0,
        })),
        autoApprove: form.autoApprove,
        aiEnabled: form.aiEnabled,
      };
      const res = await api.createPo(payload);

      if (res.aiReview?.flagged) {
        setResult({ type: 'ai', message: 'AI flagged this PO.', data: res });
      } else if (form.autoApprove) {
        const poId = res.data?.DocNumber || res.data?.Id || form.poNumber;
        setResult({ type: 'success', message: `PO #${poId} pushed to QBO successfully.`, data: res });
        resetForm();
        setTimeout(() => onSwitchToHistory?.(), 2000);
      } else {
        setResult({ type: 'success', message: `Draft saved for review. Draft ID: ${res.draftId || 'N/A'}`, data: res });
        resetForm();
        setTimeout(() => onSwitchToHistory?.(), 2000);
      }
    } catch (err) {
      const fix = err.fix ? ` ${err.fix}` : '';
      setResult({ type: 'error', message: (err.message || 'Failed to submit PO.') + fix });
    } finally {
      setSubmitting(false);
    }
  }

  // When PO date changes
  function handleTxnDateChange(val) {
    setForm((f) => ({ ...f, txnDate: val }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Result banners */}
      {result?.type === 'success' && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-300 rounded-lg px-4 py-3 text-green-800 text-sm">
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <span>{result.message}</span>
        </div>
      )}
      {result?.type === 'error' && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-red-800 text-sm">
          <X className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <span>{result.message}</span>
        </div>
      )}
      {result?.type === 'ai' && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 text-sm">
          <div className="flex items-start gap-3 text-yellow-800 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <strong>AI Review Flagged This PO</strong>
          </div>
          {result.data?.aiResult?.suggestions?.length > 0 && (
            <ul className="list-disc list-inside text-yellow-700 space-y-1 ml-8">
              {result.data.aiResult.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 ml-8 text-xs text-yellow-600 space-x-4">
            {result.data?.aiResult?.confidence != null && (
              <span>Confidence: {Math.round(result.data.aiResult.confidence * 100)}%</span>
            )}
            {result.data?.aiResult?.source && (
              <span>Source: {result.data.aiResult.source}</span>
            )}
          </div>
          {result.data?.draftId && (
            <p className="mt-2 ml-8 text-yellow-700 text-xs">
              Draft saved for review. ID: {result.data.draftId}
            </p>
          )}
        </div>
      )}

      {/* Vendor Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        {/* Vendor dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vendor <span className="text-red-500">*</span>
          </label>
          {!vendorsLoading && vendors.length === 0 ? (
            <p className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              No vendors configured. Go to Vendor Management to sync.
            </p>
          ) : (
          <div className="relative" ref={vendorDropdownRef}>
            <button
              type="button"
              onClick={() => setVendorOpen((o) => !o)}
              className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
            >
              <span className={form.vendorName ? 'text-atd-dark font-medium' : 'text-gray-400'}>
                {form.vendorName || (vendorsLoading ? 'Loading vendors...' : 'Select a vendor')}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
            {vendorOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <input
                    type="text"
                    placeholder="Search vendors..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-atd-blue"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto max-h-48">
                  {filteredVendors.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-400">No vendors found.</div>
                  ) : (
                    filteredVendors.map((v) => (
                      <button
                        key={v.Id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-atd-blue hover:text-white transition-colors"
                        onClick={() => {
                          setField('vendorId', v.Id);
                          setField('vendorName', v.DisplayName);
                          // Look up email from QBO vendor data
                          const qboVendor = qboVendors.find((qv) => String(qv.Id) === String(v.Id));
                          const email = qboVendor?.PrimaryEmailAddr?.Address || '';
                          setField('vendorEmail', email);
                          setVendorOpen(false);
                          setVendorSearch('');
                        }}
                      >
                        <div className="font-medium">{v.DisplayName}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Ship To address box - shown only when vendor is selected */}
        {form.vendorId && (
          <div className="mt-4 p-3 bg-gray-100 rounded-lg border border-gray-200">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" />
              <div>
                <div className="font-medium text-gray-700">Ship To:</div>
                <div>American Tile Depot</div>
                <div>1440 S State College Blvd Ste 6G</div>
                <div>Anaheim, CA 92806</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PO Details */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-atd-dark mb-4">PO Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* PO Number - First and required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PO Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.poNumber}
              onChange={(e) => setField('poNumber', e.target.value)}
              placeholder="Shopify Order #"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
            />
          </div>

          {/* PO Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PO Date</label>
            <input
              type="date"
              value={form.txnDate}
              onChange={(e) => handleTxnDateChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
            />
          </div>
        </div>

        {/* Memo and Message */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Memo</label>
            <input
              type="text"
              value={form.memo}
              onChange={(e) => setField('memo', e.target.value)}
              placeholder="Internal note"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message to Vendor</label>
            <input
              type="text"
              value={form.vendorMessage}
              onChange={(e) => setField('vendorMessage', e.target.value)}
              placeholder="Printed on PO PDF sent to vendor"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-atd-dark">Line Items</h2>
          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1.5 text-sm text-atd-blue hover:text-blue-700 font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Line
          </button>
        </div>

        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th style={{ width: '4%' }} className="pb-3 pr-2">#</th>
                <th style={{ width: '24%' }} className="pb-3 pr-2">Item</th>
                <th style={{ width: '10%' }} className="pb-3 pr-2">SKU</th>
                <th style={{ width: '23%' }} className="pb-3 pr-2">Description</th>
                <th style={{ width: '8%' }} className="pb-3 pr-2">Qty</th>
                <th style={{ width: '10%' }} className="pb-3 pr-2">Unit</th>
                <th style={{ width: '10%' }} className="pb-3 pr-2">Unit Price</th>
                <th style={{ width: '7%' }} className="pb-3 pr-2">Total</th>
                <th style={{ width: '4%' }} className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {form.lines.map((line, idx) => {
                const lineTotal = (parseFloat(line.qty) || 0) * (parseFloat(line.unitPrice) || 0);
                return (
                  <tr key={line._id}>
                    <td className="py-2 pr-2 text-gray-400 font-mono text-xs">{idx + 1}</td>
                    <td className="py-2 pr-2">
                      {items.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleCreateNewItem('')}
                          className="w-full text-left border border-gray-200 rounded px-2 py-1.5 text-sm text-atd-blue hover:bg-blue-50 flex items-center gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create first item
                        </button>
                      ) : (
                        <SearchableItemDropdown
                          items={items}
                          value={line.itemId}
                          onChange={(selected) => setLine(line._id, 'item', selected)}
                          onCreateNew={handleCreateNewItem}
                        />
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <span className="text-sm text-gray-400">{line.sku || '-'}</span>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => setLine(line._id, 'description', e.target.value)}
                        placeholder="Description"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-atd-blue"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        value={line.qty}
                        min="1"
                        onChange={(e) => setLine(line._id, 'qty', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-atd-blue"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={line.unit}
                        onChange={(e) => setLine(line._id, 'unit', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-atd-blue bg-white"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          value={line.unitPrice}
                          min="0"
                          step="0.01"
                          onChange={(e) => setLine(line._id, 'unitPrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-gray-200 rounded pl-5 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-atd-blue"
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-gray-700 font-medium whitespace-nowrap">
                      {formatCurrency(lineTotal)}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => removeLine(line._id)}
                        disabled={form.lines.length === 1}
                        className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Grand total */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
          <div className="text-base font-bold text-atd-dark">
            Grand Total: <span className="ml-2">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Options + Submit */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-8 mb-6">
          <Toggle
            id="aiEnabled"
            checked={form.aiEnabled}
            onChange={(v) => setField('aiEnabled', v)}
            label="AI Review"
          />
          <Toggle
            id="autoApprove"
            checked={form.autoApprove}
            onChange={(v) => setField('autoApprove', v)}
            label="Auto Approve (push directly to QBO)"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {!form.autoApprove ? (
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-atd-blue hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting && <LoadingSpinner size="sm" color="white" />}
              Submit for Review
            </button>
          ) : (
            <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowAutoApproveConfirm(true)}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting && <LoadingSpinner size="sm" color="white" />}
                  Auto Approve and Submit
                </button>
          )}
        </div>
      </div>

      {/* Create New Item Modal */}
      <CreateNewItemModal
        isOpen={createItemModalOpen}
        onClose={() => setCreateItemModalOpen(false)}
        onSuccess={handleItemCreated}
        initialName={createItemSearchTerm}
      />

      {/* Auto Approve Confirmation Modal */}
      {showAutoApproveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Auto-Approve</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to submit this PO directly to QuickBooks? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAutoApproveConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowAutoApproveConfirm(false); handleSubmit({ preventDefault: () => {} }); }}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Yes, Submit to QBO
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Pending Drafts
// ---------------------------------------------------------------------------
function DraftsTab() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [actionResult, setActionResult] = useState(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPoDrafts();
      setDrafts(Array.isArray(res.drafts ?? res.data?.drafts) ? (res.drafts ?? res.data?.drafts) : []);
    } catch (err) {
      setError(err.message || 'Failed to load drafts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  async function handleApprove(draftId) {
    setApprovingId(draftId);
    setActionResult(null);
    try {
      const res = await api.approveDraft(draftId);
      setActionResult({ type: 'success', message: `Draft approved. QBO ID: ${res.qboEntityId || res.data?.Id || 'N/A'}` });
      await fetchDrafts();
    } catch (err) {
      setActionResult({ type: 'error', message: err.message || 'Approval failed.' });
    } finally {
      setApprovingId(null);
    }
  }

  function calcEstTotal(draft) {
    const lines = draft.lines || [];
    return lines.reduce((sum, l) => sum + (parseFloat(l.qty) || 0) * (parseFloat(l.unitPrice) || 0), 0);
  }

  function aiStatusBadge(draft) {
    const s = draft.aiStatus || draft.ai_status;
    if (!s) return <StatusBadge status="skipped" />;
    return <StatusBadge status={s} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-atd-dark">Pending Drafts</h2>
        <button
          onClick={fetchDrafts}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-atd-blue transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {actionResult && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
            actionResult.type === 'success'
              ? 'bg-green-50 border border-green-300 text-green-800'
              : 'bg-red-50 border border-red-300 text-red-800'
          }`}
        >
          {actionResult.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-green-500" />
          ) : (
            <X className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />
          )}
          {actionResult.message}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" color="atd-blue" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No pending drafts.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Vendor</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Lines</th>
                  <th className="px-6 py-3">Est. Total</th>
                  <th className="px-6 py-3">AI Status</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {drafts.map((draft) => (
                  <tr key={draft.id || draft.draftId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-atd-dark">
                      {draft.vendorName || draft.vendor?.DisplayName || '-'}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{draft.txnDate || '-'}</td>
                    <td className="px-6 py-3 text-gray-500">{(draft.lines || []).length}</td>
                    <td className="px-6 py-3 text-gray-700 font-medium">
                      {formatCurrency(calcEstTotal(draft))}
                    </td>
                    <td className="px-6 py-3">{aiStatusBadge(draft)}</td>
                    <td className="px-6 py-3 text-gray-500">
                      {formatDateTime(draft.createdAt || draft.created_at)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(draft.id || draft.draftId)}
                          disabled={approvingId === (draft.id || draft.draftId)}
                          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {approvingId === (draft.id || draft.draftId) ? (
                            <LoadingSpinner size="sm" color="white" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </button>
                        <button
                          disabled
                          title="Coming soon"
                          className="flex items-center gap-1 bg-red-100 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium cursor-not-allowed"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: History
// ---------------------------------------------------------------------------
function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPoHistory();
      setHistory(Array.isArray(res.history ?? res.data?.history) ? (res.history ?? res.data?.history) : []);
    } catch (err) {
      setError(err.message || 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-atd-dark">PO History</h2>
        <button
          onClick={fetchHistory}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-atd-blue transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" color="atd-blue" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No history yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">PO #</th>
                  <th className="px-6 py-3">Vendor</th>
                  <th className="px-6 py-3">QBO ID</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">intuit_tid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((item, idx) => {
                  const tid = item.intuitTid || item.intuit_tid || '';
                  const tidShort = tid.slice(0, 12);
                  const tidFull = tid;
                  return (
                    <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                        {formatDateTime(item.timestamp || item.createdAt)}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-gray-600">
                        {item.poNumber || '-'}
                      </td>
                      <td className="px-6 py-3 font-medium text-atd-dark">
                        {item.vendorName || '-'}
                      </td>
                      <td className="px-6 py-3 text-gray-600 font-mono text-xs">
                        {item.qboEntityId || '-'}
                      </td>
                      <td className="px-6 py-3 text-gray-600">
                        {item.total != null ? formatCurrency(item.total) : '-'}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-6 py-3">
                        {tidFull ? (
                          <span
                            title={tidFull}
                            className="font-mono text-xs text-gray-500 cursor-help"
                          >
                            {tidShort}{tid.length > 12 ? '...' : ''}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Import from Sheets
// ---------------------------------------------------------------------------
function ImportFromSheetsTab() {
  const [preview, setPreview] = useState({ data: null, loading: false, error: null });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  async function handleLoadFromSheets() {
    setPreview({ data: null, loading: true, error: null });
    setImportResult(null);
    try {
      const res = await api.previewSheetData();
      const rows = Array.isArray(res.rows) ? res.rows : [];
      setPreview({ data: rows, loading: false, error: null });
    } catch (err) {
      setPreview({ data: null, loading: false, error: err.message || 'Failed to load from Google Sheets.' });
    }
  }

  async function handleImportAll() {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.importFromSheets();
      const count = res.imported ?? res.data?.imported ?? 0;
      setImportResult({ type: 'success', message: `Imported ${count} PO${count !== 1 ? 's' : ''} as drafts.` });
    } catch (err) {
      setImportResult({ type: 'error', message: err.message || 'Import failed.' });
    } finally {
      setImporting(false);
    }
  }

  const columns = preview.data?.length > 0 ? Object.keys(preview.data[0]) : [];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-atd-dark">Import from Google Sheets</h2>
        <p className="text-sm text-gray-500 mt-1">Load purchase order data from your configured Google Sheet.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleLoadFromSheets}
            disabled={preview.loading}
            className="flex items-center gap-2 bg-atd-blue hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {preview.loading ? <LoadingSpinner size="sm" color="white" /> : <RefreshCw className="h-4 w-4" />}
            Load from Google Sheets
          </button>
          {preview.data && !importResult && (
            <button
              onClick={handleImportAll}
              disabled={importing}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {importing ? <LoadingSpinner size="sm" color="white" /> : <Plus className="h-4 w-4" />}
              Import All as Drafts
            </button>
          )}
        </div>

        {preview.error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-red-800 text-sm">
            <X className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />
            {preview.error}
          </div>
        )}

        {importResult && (
          <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
            importResult.type === 'success'
              ? 'bg-green-50 border border-green-300 text-green-800'
              : 'bg-red-50 border border-red-300 text-red-800'
          }`}>
            {importResult.type === 'success' ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-green-500" />
            ) : (
              <X className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />
            )}
            {importResult.message}
          </div>
        )}

        {preview.data && preview.data.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Preview: {preview.data.length} row{preview.data.length !== 1 ? 's' : ''} found
            </p>
            <div className="overflow-x-auto max-h-96 border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {columns.map((col) => (
                      <th key={col} className="px-4 py-2 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.data.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {columns.map((col) => (
                        <td key={col} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                          {row[col] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {preview.data && preview.data.length === 0 && (
          <p className="text-sm text-gray-400">No data rows found in sheet.</p>
        )}

        {!preview.data && !preview.loading && !preview.error && (
          <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
            Click "Load from Google Sheets" to preview data from your configured sheet.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
const TABS = ['Create New', 'Pending Drafts', 'History', 'Import from Sheets'];

export default function PurchaseOrders({ initialTab }) {
  // If initialTab is provided, set that tab. Otherwise use state.
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab === 'drafts') return 1;
    if (initialTab === 'history') return 2;
    if (initialTab === 'import') return 3;
    return 0;
  });
  const [vendors, setVendors] = useState([]);
  const [qboVendors, setQboVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);

  // Fetch items from API (used to refresh after creating a new item)
  async function fetchItems() {
    try {
      const res = await api.getItems();
      const itemList = res.items || res.data || res;
      setItems(Array.isArray(itemList) ? itemList : []);
    } catch {
      // silently fail, items will remain as they are
    }
  }

  useEffect(() => {
    async function loadLists() {
      setVendorsLoading(true);
      try {
        const [mappingsRes, vendorsRes, iRes] = await Promise.all([
          api.getVendorMappings(),
          api.getVendors(),
          api.getItems(),
        ]);
        // Active vendors for dropdown (from mappings)
        const allVendors = mappingsRes.mappings?.vendors || [];
        const activeVendors = allVendors
          .filter((v) => v.active)
          .map((v) => ({ Id: v.qbo_id, DisplayName: v.qbo_name }));
        setVendors(activeVendors);
        // Full QBO vendor data for email lookup
        const qboVendorList = vendorsRes.vendors || vendorsRes.data?.vendors || [];
        setQboVendors(Array.isArray(qboVendorList) ? qboVendorList : []);
        // Items
        const itemList = iRes.items || iRes.data || iRes;
        setItems(Array.isArray(itemList) ? itemList : []);
      } catch (err) {
        console.error('[PurchaseOrders] Failed to load lists:', err);
      } finally {
        setVendorsLoading(false);
      }
    }
    loadLists();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-atd-dark">Purchase Orders</h1>
        <p className="text-gray-500 text-sm mt-1">Create, review, and manage purchase orders</p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab, idx) => (
            <button
              key={tab}
              onClick={() => setActiveTab(idx)}
              className={`pb-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === idx
                  ? 'border-b-2 border-atd-blue text-atd-blue'
                  : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 0 && (
        <CreateTab vendors={vendors} qboVendors={qboVendors} items={items} vendorsLoading={vendorsLoading} onSwitchToHistory={() => setActiveTab(2)} onRefreshItems={fetchItems} />
      )}
      {activeTab === 1 && <DraftsTab />}
      {activeTab === 2 && <HistoryTab />}
      {activeTab === 3 && <ImportFromSheetsTab />}
    </div>
  );
}
