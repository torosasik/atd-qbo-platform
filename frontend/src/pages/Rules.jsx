import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import Toggle from '../components/shared/Toggle';

const RULE_TYPES = ['SKU_MAPPING', 'PRICING', 'NAMING', 'UNIT_CONVERSION'];

function typeBadgeClass(type) {
  const map = {
    SKU_MAPPING: 'bg-blue-100 text-blue-700',
    PRICING: 'bg-emerald-100 text-emerald-700',
    NAMING: 'bg-purple-100 text-purple-700',
    UNIT_CONVERSION: 'bg-amber-100 text-amber-700',
  };
  return map[type] || 'bg-gray-100 text-gray-600';
}

function initialRuleByType(type) {
  if (type === 'SKU_MAPPING') return { atd_sku: '', vendor_sku: '' };
  if (type === 'PRICING') return { discount_percent: 0, start_date: '', end_date: '' };
  if (type === 'NAMING') return { atd_name: '', vendor_name: '' };
  return { atd_unit: '', vendor_unit: '', conversion_factor: 1 };
}

function ruleSummary(type, rule) {
  if (!rule) return '—';
  if (type === 'SKU_MAPPING') return `${rule.atd_sku || '—'} → ${rule.vendor_sku || '—'}`;
  if (type === 'PRICING') return `${rule.discount_percent ?? 0}% (${rule.start_date || 'now'} to ${rule.end_date || 'open'})`;
  if (type === 'NAMING') return `${rule.atd_name || '—'} → ${rule.vendor_name || '—'}`;
  return `${rule.atd_unit || '—'} → ${rule.vendor_unit || '—'} x${rule.conversion_factor ?? 1}`;
}

function RuleFields({ type, value, onChange }) {
  if (type === 'SKU_MAPPING') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="ATD SKU" value={value.atd_sku || ''} onChange={(e) => onChange({ ...value, atd_sku: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Vendor SKU" value={value.vendor_sku || ''} onChange={(e) => onChange({ ...value, vendor_sku: e.target.value })} />
      </div>
    );
  }

  if (type === 'PRICING') {
    return (
      <div className="grid grid-cols-3 gap-3">
        <input type="number" min="0" max="100" className="border rounded-lg px-3 py-2 text-sm" placeholder="Discount %" value={value.discount_percent ?? 0} onChange={(e) => onChange({ ...value, discount_percent: Number(e.target.value) })} />
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={value.start_date || ''} onChange={(e) => onChange({ ...value, start_date: e.target.value })} />
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={value.end_date || ''} onChange={(e) => onChange({ ...value, end_date: e.target.value })} />
      </div>
    );
  }

  if (type === 'NAMING') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="ATD Name" value={value.atd_name || ''} onChange={(e) => onChange({ ...value, atd_name: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Vendor Name" value={value.vendor_name || ''} onChange={(e) => onChange({ ...value, vendor_name: e.target.value })} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <input className="border rounded-lg px-3 py-2 text-sm" placeholder="ATD Unit" value={value.atd_unit || ''} onChange={(e) => onChange({ ...value, atd_unit: e.target.value })} />
      <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Vendor Unit" value={value.vendor_unit || ''} onChange={(e) => onChange({ ...value, vendor_unit: e.target.value })} />
      <input type="number" min="0" step="0.0001" className="border rounded-lg px-3 py-2 text-sm" placeholder="Factor" value={value.conversion_factor ?? 1} onChange={(e) => onChange({ ...value, conversion_factor: Number(e.target.value) })} />
    </div>
  );
}

function RuleModal({ open, onClose, onSubmit, vendors, initial }) {
  const [form, setForm] = useState({ type: 'SKU_MAPPING', vendor: '', active: true, rule: initialRuleByType('SKU_MAPPING') });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({ type: initial.type, vendor: initial.vendor, active: initial.active !== false, rule: initial.rule || initialRuleByType(initial.type) });
    } else {
      setForm({ type: 'SKU_MAPPING', vendor: '', active: true, rule: initialRuleByType('SKU_MAPPING') });
    }
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Rule' : 'Add Rule'}</h3>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <select className="border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, rule: initialRuleByType(e.target.value) }))}>
              {RULE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm" value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}>
              <option value="">Select vendor</option>
              {vendors.map((v) => <option key={v.qbo_id || v.Id} value={v.qbo_name || v.DisplayName}>{v.qbo_name || v.DisplayName}</option>)}
            </select>
            <div className="flex items-center">
              <Toggle id="rule-active" checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Active" />
            </div>
          </div>
          <RuleFields type={form.type} value={form.rule} onChange={(rule) => setForm((f) => ({ ...f, rule }))} />
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => onSubmit(form)} className="px-4 py-2 text-sm bg-atd-blue text-white rounded-lg">Save Rule</button>
        </div>
      </div>
    </div>
  );
}

export default function Rules() {
  const [rules, setRules] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rulesRes, mappingsRes] = await Promise.all([
        api.getRules({ active: 'true' }),
        api.getVendorMappings(),
      ]);
      setRules(rulesRes.data?.rules || []);
      setVendors(mappingsRes.data?.mappings?.vendors || []);
    } catch (err) {
      setError(err.message || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sortedRules = useMemo(() => [...rules].sort((a, b) => String(a.vendor).localeCompare(String(b.vendor))), [rules]);

  async function submitRule(form) {
    try {
      if (editingRule?.id) {
        await api.updateRule(editingRule.id, form);
      } else {
        await api.createRule(form);
      }
      setModalOpen(false);
      setEditingRule(null);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to save rule');
    }
  }

  async function toggleRule(rule) {
    try {
      await api.updateRule(rule.id, { active: !rule.active });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to update rule');
    }
  }

  async function deleteRule(id) {
    try {
      await api.deleteRule(id);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete rule');
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atd-dark">Business Rules</h1>
          <p className="text-sm text-gray-500">Vendor-level SKU, pricing, naming, and unit conversion rules</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" />Refresh</button>
          <button onClick={() => { setEditingRule(null); setModalOpen(true); }} className="px-3 py-2 bg-atd-blue text-white rounded-lg text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Add Rule</button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Vendor</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Active</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : sortedRules.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No rules found.</td></tr>
            ) : sortedRules.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeClass(r.type)}`}>{r.type}</span></td>
                <td className="px-4 py-3">{r.vendor}</td>
                <td className="px-4 py-3 text-gray-600">{ruleSummary(r.type, r.rule)}</td>
                <td className="px-4 py-3"><Toggle id={`active-${r.id}`} checked={r.active !== false} onChange={() => toggleRule(r)} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingRule(r); setModalOpen(true); }} className="p-1.5 text-gray-500 hover:text-atd-blue"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => deleteRule(r.id)} className="p-1.5 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RuleModal open={modalOpen} onClose={() => { setModalOpen(false); setEditingRule(null); }} onSubmit={submitRule} vendors={vendors} initial={editingRule} />
    </div>
  );
}

