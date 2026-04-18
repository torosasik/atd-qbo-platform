import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { api, humanizeError } from '../utils/api';
import { logActivity } from '../utils/activityLogger';
import Toggle from '../components/shared/Toggle';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const RULE_TYPES = ['SKU_MAPPING', 'PRICING', 'NAMING', 'UNIT_CONVERSION', 'NATURAL_STONE_CONVERSION', 'QUANTITY_THRESHOLD_DISCOUNT'];

function typeBadgeClass(type) {
  const map = {
    SKU_MAPPING: 'bg-blue-100 text-blue-700',
    PRICING: 'bg-emerald-100 text-emerald-700',
    NAMING: 'bg-purple-100 text-purple-700',
    UNIT_CONVERSION: 'bg-amber-100 text-amber-700',
    NATURAL_STONE_CONVERSION: 'bg-stone-100 text-stone-700',
    QUANTITY_THRESHOLD_DISCOUNT: 'bg-rose-100 text-rose-700',
  };
  return map[type] || 'bg-gray-100 text-gray-600';
}

function initialRuleByType(type) {
  if (type === 'SKU_MAPPING') return { atd_sku: '', vendor_sku: '' };
  if (type === 'PRICING') return { discount_percent: 0, start_date: '', end_date: '' };
  if (type === 'NAMING') return { atd_name: '', vendor_name: '' };
  if (type === 'NATURAL_STONE_CONVERSION') return { piece_sqft: 2.0 };
  if (type === 'QUANTITY_THRESHOLD_DISCOUNT') return { min_quantity: 100, discount_percent: 0, unit: '' };
  return { atd_unit: '', vendor_unit: '', conversion_factor: 1 };
}

function ruleSummary(type, rule) {
  if (!rule) return '—';
  if (type === 'SKU_MAPPING') return `${rule.atd_sku || '—'} → ${rule.vendor_sku || '—'}`;
  if (type === 'PRICING') return `${rule.discount_percent ?? 0}% (${rule.start_date || 'now'} to ${rule.end_date || 'open'})`;
  if (type === 'NAMING') return `${rule.atd_name || '—'} → ${rule.vendor_name || '—'}`;
  if (type === 'NATURAL_STONE_CONVERSION') return `${rule.piece_sqft ?? 0} sq ft/piece`;
  if (type === 'QUANTITY_THRESHOLD_DISCOUNT') return `${rule.discount_percent ?? 0}% off when qty >= ${rule.min_quantity ?? 0}${rule.unit ? ` (${rule.unit})` : ''}`;
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

  if (type === 'NATURAL_STONE_CONVERSION') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sq Ft per Piece</label>
            <input type="number" min="0" step="0.01" className="border rounded-lg px-3 py-2 text-sm w-full" placeholder="e.g. 2.0" value={value.piece_sqft ?? 2.0} onChange={(e) => onChange({ ...value, piece_sqft: Number(e.target.value) })} />
            <p className="text-xs text-gray-400 mt-1">e.g. 2.0 for 12x24, 4.0 for 24x24</p>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'QUANTITY_THRESHOLD_DISCOUNT') {
    return (
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Minimum Quantity</label>
          <input type="number" min="0" className="border rounded-lg px-3 py-2 text-sm w-full" placeholder="100" value={value.min_quantity ?? 0} onChange={(e) => onChange({ ...value, min_quantity: Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Discount %</label>
          <input type="number" min="0" max="100" className="border rounded-lg px-3 py-2 text-sm w-full" placeholder="10" value={value.discount_percent ?? 0} onChange={(e) => onChange({ ...value, discount_percent: Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Unit (optional)</label>
          <input className="border rounded-lg px-3 py-2 text-sm w-full" placeholder="e.g. Sq Ft" value={value.unit || ''} onChange={(e) => onChange({ ...value, unit: e.target.value })} />
        </div>
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

function AIRuleModal({ open, onClose, onGenerated }) {
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    if (open) {
      setDescription('');
      setAiError('');
      setGenerating(false);
    }
  }, [open]);

  async function handleGenerate() {
    if (!description.trim()) return;
    setGenerating(true);
    setAiError('');
    try {
      const instructions = 'You are a business rules assistant for a tile company. Parse the following description into a JSON rule object with this exact shape: { type: one of SKU_MAPPING|PRICING|NAMING|UNIT_CONVERSION|NATURAL_STONE_CONVERSION|QUANTITY_THRESHOLD_DISCOUNT, vendor: string, active: true, rule: object }. For SKU_MAPPING rule contains { atd_sku, vendor_sku }. For PRICING rule contains { discount_percent, start_date, end_date }. For NAMING rule contains { atd_name, vendor_name }. For UNIT_CONVERSION rule contains { atd_unit, vendor_unit, conversion_factor }. For NATURAL_STONE_CONVERSION rule contains { piece_sqft } (sq ft per piece, e.g. 2.0 for 12x24 tiles). For QUANTITY_THRESHOLD_DISCOUNT rule contains { min_quantity, discount_percent, unit (optional) }. Return only valid JSON, no explanation.';
      const combinedMessage = `${instructions}\n\nUser description: ${description.trim()}`;
      const res = await api.post('/ai/chat', {
        message: combinedMessage,
        context: { type: 'rules' },
      });
      const text = res.reply || res.data?.reply || res.message || res.data?.message || '';
      // Try to extract JSON from the response
      let parsed = null;
      try {
        // Try direct parse first
        parsed = JSON.parse(text);
      } catch {
        // Try to find JSON in the text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            parsed = null;
          }
        }
      }
      if (parsed && parsed.type && parsed.rule) {
        onGenerated(parsed);
        onClose();
      } else {
        setAiError(`Could not parse AI response. Raw output:\n${text}`);
      }
    } catch (err) {
      setAiError(err.message || 'AI request failed.');
    } finally {
      setGenerating(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Add Rule via AI
          </h3>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Describe your rule in plain English. For example: "Map SKU ATD-1234 to vendor SKU VND-5678 for Bedrosians" or "Apply 15% discount for Dal-Tile starting January 2025"
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the rule you want to create..."
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          {aiError && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {aiError}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={handleGenerate}
            disabled={generating || !description.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg disabled:opacity-60"
          >
            {generating ? <LoadingSpinner size="sm" color="white" /> : <Sparkles className="h-4 w-4" />}
            Generate Rule
          </button>
        </div>
      </div>
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
  const [aiModalOpen, setAiModalOpen] = useState(false);

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
      setError(humanizeError(err));
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
        logActivity('RULE_CREATED', `Rule created: ${form.name || form.type}`);
      }
      setModalOpen(false);
      setEditingRule(null);
      await load();
    } catch (err) {
      setError(humanizeError(err));
    }
  }

  async function toggleRule(rule) {
    try {
      await api.updateRule(rule.id, { active: !rule.active });
      await load();
    } catch (err) {
      setError(humanizeError(err));
    }
  }

  async function deleteRule(id) {
    if (!window.confirm('Delete this rule? This cannot be undone.')) return;
    try {
      const rule = rules.find((r) => r.id === id);
      await api.deleteRule(id);
      logActivity('RULE_DELETED', `Rule deleted: ${rule?.name || id}`);
      await load();
    } catch (err) {
      setError(humanizeError(err));
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
          <button onClick={() => setAiModalOpen(true)} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" />Add via AI</button>
          <button onClick={() => { setEditingRule(null); setModalOpen(true); }} className="px-3 py-2 bg-atd-blue text-white rounded-lg text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Add Rule</button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">{error}</p>
          </div>
          <button onClick={load} className="text-sm text-amber-700 hover:text-amber-900 font-medium">Try Again</button>
        </div>
      )}

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
      <AIRuleModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onGenerated={(parsed) => {
          setEditingRule(parsed);
          setModalOpen(true);
        }}
      />
    </div>
  );
}

