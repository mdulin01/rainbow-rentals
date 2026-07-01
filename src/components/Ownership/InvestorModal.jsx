import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';

export default function InvestorModal({ investor, onSave, onDelete, onClose }) {
  const isEditing = investor && investor.id && investor.id !== 'create';

  const [form, setForm] = useState({
    name: '',
    email: '',
    contributionAmount: '',
    contributionDate: '',
    equityBasisAtContribution: '',
    basisNotes: '',
    notes: '',
  });

  useEffect(() => {
    if (isEditing) {
      setForm({
        name: investor.name || '',
        email: investor.email || '',
        contributionAmount: investor.contributionAmount ?? '',
        contributionDate: investor.contributionDate || '',
        equityBasisAtContribution: investor.equityBasisAtContribution ?? '',
        basisNotes: investor.basisNotes || '',
        notes: investor.notes || '',
      });
    }
  }, [investor, isEditing]);

  const canSave = form.name.trim() &&
    parseFloat(form.contributionAmount) > 0 &&
    parseFloat(form.equityBasisAtContribution) > 0;

  const pctPreview = canSave
    ? ((parseFloat(form.contributionAmount) / parseFloat(form.equityBasisAtContribution)) * 100)
    : null;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      ...form,
      contributionAmount: parseFloat(form.contributionAmount) || 0,
      equityBasisAtContribution: parseFloat(form.equityBasisAtContribution) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{isEditing ? 'Edit Investor Stake' : 'Add Investor Stake'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name + email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Liam"
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Email (optional)</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="dulinliam@gmail.com"
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Contribution amount + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Contribution Amount *</label>
              <input
                type="number"
                step="0.01"
                value={form.contributionAmount}
                onChange={e => setForm(f => ({ ...f, contributionAmount: e.target.value }))}
                placeholder="20000"
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Contribution Date</label>
              <input
                type="date"
                value={form.contributionDate}
                onChange={e => setForm(f => ({ ...f, contributionDate: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Equity basis — the critical anchor number */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
            <label className="text-xs text-amber-300/90 mb-1 block font-medium">
              Total portfolio equity on contribution date *
            </label>
            <p className="text-[11px] text-white/40 mb-2">
              The total cash/equity the business had right when this contribution came in
              (e.g., your equity in N. Elm + any cash on hand, before Green Crest closed).
              This sets a FIXED ownership % = contribution ÷ this number — it never changes,
              but their dollar stake grows or shrinks with the portfolio's value over time.
            </p>
            <input
              type="number"
              step="0.01"
              value={form.equityBasisAtContribution}
              onChange={e => setForm(f => ({ ...f, equityBasisAtContribution: e.target.value }))}
              placeholder="e.g., 80000"
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
            {pctPreview !== null && (
              <p className="text-xs text-amber-300 mt-2 font-medium">
                → Fixed ownership stake: {pctPreview.toFixed(2)}%
              </p>
            )}
            <textarea
              value={form.basisNotes}
              onChange={e => setForm(f => ({ ...f, basisNotes: e.target.value }))}
              placeholder="Optional: how you arrived at this number..."
              rows={2}
              className="w-full mt-2 px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes about this stake..."
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6">
          {isEditing && onDelete ? (
            <button
              onClick={() => onDelete(investor.id)}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20 transition"
            >
              <Trash2 className="w-4 h-4 inline mr-1" /> Delete
            </button>
          ) : <div />}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Update' : 'Save Stake'}
          </button>
        </div>
      </div>
    </div>
  );
}
