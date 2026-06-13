import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { rentStatuses, incomeCategories } from '../../constants';
import { getPropertyTenants } from '../../hooks/useProperties';
import { todayLocalStr } from '../../utils';

export default function AddRentPaymentModal({ payment, properties, onSave, onDelete, onClose }) {
  const isEditing = payment && payment.id;

  const [form, setForm] = useState({
    incomeType: 'rent',
    propertyId: '',
    tenantName: '',
    propertyName: '',
    month: '',
    amount: '',
    datePaid: '',
    status: 'paid',
    notes: '',
  });

  useEffect(() => {
    // Prefill from any provided payment object (editing OR a reconciliation prefill).
    if (payment) {
      const now = new Date();
      setForm({
        incomeType: payment.incomeType || 'rent',
        propertyId: payment.propertyId || '',
        tenantName: payment.tenantName || '',
        propertyName: payment.propertyName || '',
        month: payment.month || '',
        amount: payment.amount ?? '',
        datePaid: payment.datePaid || todayLocalStr(),
        status: payment.status || 'paid',
        notes: payment.notes || '',
      });
    } else {
      // Default month to current
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setForm(f => ({ ...f, month: currentMonth, datePaid: todayLocalStr() }));
    }
  }, [payment, isEditing]);

  // Auto-fill tenant/property name when property selected
  const handlePropertyChange = (propertyId) => {
    const prop = properties.find(p => String(p.id) === String(propertyId));
    const tenants = prop ? getPropertyTenants(prop) : [];
    const tenantNames = tenants.map(t => t.name).filter(Boolean).join(', ');
    // Use property-level monthlyRent (total for the property, not per-tenant)
    setForm(f => ({
      ...f,
      propertyId,
      propertyName: prop ? `${prop.emoji || '🏠'} ${prop.name}` : '',
      tenantName: tenantNames || '',
      amount: f.amount || (prop?.monthlyRent || ''),
    }));
  };

  const handleSave = () => {
    if (form.incomeType === 'rent' && !form.propertyId) return;
    if (!form.amount) return;
    onSave({
      ...form,
      amount: parseFloat(form.amount) || 0,
    });
  };

  const isRentType = form.incomeType === 'rent';

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{isEditing ? 'Edit Payment' : 'Record Income'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Income Type */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Income Type</label>
            <div className="flex flex-wrap gap-1.5">
              {incomeCategories.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setForm(f => ({ ...f, incomeType: cat.value }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                    form.incomeType === cat.value
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/[0.05] border-white/[0.08] text-white/40 hover:bg-white/10'
                  }`}
                >
                  <span className="mr-1">{cat.emoji}</span>{cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Property */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Property {!isRentType && <span className="text-white/20">(optional)</span>}</label>
            <select
              value={form.propertyId}
              onChange={e => handlePropertyChange(e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Select property...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.emoji || '🏠'} {p.name}</option>
              ))}
            </select>
          </div>

          {/* Tenant — only for rent */}
          {isRentType && (
            <div>
              <label className="text-xs text-white/40 mb-1 block">Tenant</label>
              <input
                type="text"
                value={form.tenantName}
                onChange={e => setForm(f => ({ ...f, tenantName: e.target.value }))}
                placeholder="Tenant name"
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          )}

          {/* Month — for rent; Description — for other income */}
          {isRentType ? (
            <div>
              <label className="text-xs text-white/40 mb-1 block">Rent Month</label>
              <input
                type="month"
                value={form.month}
                onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-white/40 mb-1 block">Description</label>
              <input
                type="text"
                value={form.description || ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={`e.g., ${form.incomeType === 'interest' ? 'Savings account interest' : 'Description'}`}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Amount</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Date Paid */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Date Paid</label>
            <input
              type="date"
              value={form.datePaid}
              onChange={e => setForm(f => ({ ...f, datePaid: e.target.value }))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Status — only for rent */}
          {isRentType && (
            <div>
              <label className="text-xs text-white/40 mb-1 block">Status</label>
              <div className="flex gap-2">
                {rentStatuses.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setForm(f => ({ ...f, status: s.value }))}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition border ${
                      form.status === s.value
                        ? `${s.bg} ${s.border} ${s.color}`
                        : 'bg-white/[0.05] border-white/[0.08] text-white/40 hover:bg-white/10'
                    }`}
                  >{s.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes..."
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6">
          {isEditing && onDelete ? (
            <button
              onClick={() => onDelete(payment.id)}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20 transition"
            >
              <Trash2 className="w-4 h-4 inline mr-1" /> Delete
            </button>
          ) : <div />}
          <button
            onClick={handleSave}
            disabled={isRentType ? !form.propertyId : !form.amount}
            className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Update' : 'Record Income'}
          </button>
        </div>
      </div>
    </div>
  );
}
