import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Save, Search, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Toast from '../components/shared/Toast';

export default function VendorManagement() {
  const [vendors, setVendors] = useState([]);
  const [savedVendors, setSavedVendors] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const hasUnsavedChanges = savedVendors !== null && JSON.stringify(vendors) !== JSON.stringify(savedVendors);

  const showToast = (message, type = 'success') => setToast({ message, type });
  const dismissToast = useCallback(() => setToast(null), []);

  // Warn on tab close / refresh when there are unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    loadMappings();
  }, []);

  async function loadMappings() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/vendor-mappings');
      const data = res.data ?? res;
      const mappings = data.mappings || {};
      const loadedVendors = Array.isArray(mappings.vendors) ? mappings.vendors : [];
      setVendors(loadedVendors);
      setSavedVendors(JSON.parse(JSON.stringify(loadedVendors)));
      setLastSynced(mappings.last_synced || null);
    } catch (err) {
      setLoadError(err.message || 'Failed to load vendor mappings.');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await api.post('/vendor-mappings/sync', {});
      const data = res.data ?? res;
      const mappings = data.mappings || {};
      const vendorList = Array.isArray(mappings.vendors) ? mappings.vendors : [];
      setVendors(vendorList);
      setSavedVendors(JSON.parse(JSON.stringify(vendorList)));
      setLastSynced(mappings.last_synced || new Date().toISOString());
      if (vendorList.length === 0) {
        showToast('No vendors found in QuickBooks. Check your QBO connection and environment.', 'error');
      } else {
        showToast(`Synced ${vendorList.length} vendors from QuickBooks.`);
      }
    } catch (err) {
      showToast(err.message || 'Failed to sync vendors.', 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/vendor-mappings', { vendors });
      setSavedVendors(JSON.parse(JSON.stringify(vendors)));
      showToast('Vendor settings saved.');
    } catch (err) {
      showToast(err.message || 'Failed to save vendor settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function toggleActive(index) {
    setVendors((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], active: !next[index].active };
      return next;
    });
  }

  function setShopifyCode(index, value) {
    setVendors((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], shopify_code: value };
      return next;
    });
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return vendors.map((v, i) => ({ ...v, _idx: i }));
    const q = search.toLowerCase();
    return vendors
      .map((v, i) => ({ ...v, _idx: i }))
      .filter(
        (v) =>
          (v.qbo_name || '').toLowerCase().includes(q) ||
          (v.shopify_code || '').toLowerCase().includes(q) ||
          (v.qbo_id != null && v.qbo_id.toString().includes(search))
      );
  }, [vendors, search]);

  function selectAll() {
    const filteredIds = new Set(filtered.map((v) => v.qbo_id));
    setVendors((prev) =>
      prev.map((v) => (filteredIds.has(v.qbo_id) ? { ...v, active: true } : v))
    );
  }

  function deselectAll() {
    const filteredIds = new Set(filtered.map((v) => v.qbo_id));
    setVendors((prev) =>
      prev.map((v) => (filteredIds.has(v.qbo_id) ? { ...v, active: false } : v))
    );
  }

  const activeCount = vendors.filter((v) => v.active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 p-6">
        <LoadingSpinner size="lg" color="atd-blue" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-atd-dark">Vendor Management</h1>
        <p className="text-gray-500 text-sm mt-1">
          Map QuickBooks vendors to Shopify codes
        </p>
      </div>

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-2.5 text-sm font-medium">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
          You have unsaved changes
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {loadError}
        </div>
      )}

      {/* Top bar */}
      <div className="bg-white rounded-xl shadow-sm px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-atd-blue hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from QuickBooks'}
            </button>
            {lastSynced && (
              <span className="text-xs text-gray-400">
                Last synced: {new Date(lastSynced).toLocaleString()}
              </span>
            )}
          </div>
          {vendors.length > 0 && (
            <span className="text-sm text-gray-500">
              {activeCount} of {vendors.length} vendors active
            </span>
          )}
        </div>
      </div>

      {/* Vendor table */}
      {vendors.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm px-6 py-12 text-center">
          <p className="text-gray-400 text-sm">
            No vendors synced yet. Click Sync from QuickBooks to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm">
          {/* Search + bulk actions */}
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter vendors by name..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-atd-blue hover:text-blue-700 font-medium px-2 py-1"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={deselectAll}
                className="text-xs text-atd-blue hover:text-blue-700 font-medium px-2 py-1"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3 w-12">Active</th>
                  <th className="px-6 py-3">QBO Vendor Name</th>
                  <th className="px-6 py-3 w-32">QBO Vendor ID</th>
                  <th className="px-6 py-3 w-48">Shopify Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((v) => (
                  <tr key={v._idx} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <input
                        type="checkbox"
                        checked={!!v.active}
                        onChange={() => toggleActive(v._idx)}
                        className="h-4 w-4 rounded border-gray-300 text-atd-blue focus:ring-atd-blue"
                      />
                    </td>
                    <td className="px-6 py-3 font-medium text-atd-dark">{v.qbo_name}</td>
                    <td className="px-6 py-3 text-xs text-gray-400">{v.qbo_id}</td>
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={v.shopify_code || ''}
                        onChange={(e) => setShopifyCode(v._idx, e.target.value)}
                        placeholder="e.g., OTS"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Save button */}
          <div className="px-6 py-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-atd-blue hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? <LoadingSpinner size="sm" color="white" /> : <Save className="h-4 w-4" />}
              Save Vendor Settings {hasUnsavedChanges && <span className="ml-1 inline-block w-2 h-2 bg-amber-500 rounded-full" />}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />
      )}
    </div>
  );
}
