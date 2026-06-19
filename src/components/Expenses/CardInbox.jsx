import React, { useState } from 'react';
import { CreditCard, Check, X } from 'lucide-react';
import { expenseCategories } from '../../constants';
import { formatCurrency } from '../../utils';

// One pending Citi •4793 charge that Liam claims → property + category + reason.
function InboxRow({ item, properties, onConfirm, onDismiss }) {
  const [propertyId, setPropertyId] = useState('');
  const [category, setCategory] = useState('maintenance');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const prop = properties.find((p) => String(p.id) === String(propertyId));
    const propertyName = prop ? `${prop.emoji || '🏠'} ${prop.name}` : '';
    try {
      await onConfirm(item, { propertyId, propertyName, category, reason: reason.trim() });
    } catch (e) { setBusy(false); }
  };

  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{item.merchant}</div>
          <div className="text-xs text-white/45">{item.date}{item.rawName && item.rawName !== item.merchant ? ` · ${item.rawName}` : ''}</div>
        </div>
        <div className="text-base font-bold text-rose-300 whitespace-nowrap">{formatCurrency(item.amount)}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="px-2.5 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50"
        >
          <option value="">Select property…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.emoji || '🏠'} {p.name}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-2.5 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50"
        >
          {expenseCategories.filter((c) => c.value !== 'mileage').map((c) => (
            <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What was it for? (optional)"
        className="w-full mt-2 px-2.5 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
      />

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={confirm}
          disabled={busy || !propertyId}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold"
        >
          <Check className="w-3.5 h-3.5" /> {busy ? 'Saving…' : 'Confirm'}
        </button>
        <button
          onClick={() => onDismiss(item)}
          disabled={busy}
          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-semibold"
        >
          <X className="w-3.5 h-3.5 inline mr-1" />Not rental
        </button>
      </div>
    </div>
  );
}

export default function CardInbox({ items, properties, onConfirm, onDismiss }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-6 rounded-2xl border border-rose-400/30 bg-gradient-to-br from-rose-500/12 to-orange-500/8 p-4">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="w-4 h-4 text-rose-300" />
        <h3 className="text-white font-bold">Card charges to confirm</h3>
        <span className="ml-auto text-xs font-bold bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <p className="text-sm text-white/55 mb-3">Citi •4793 charges with your name. Assign a property + category, or mark as not a rental expense.</p>
      <div className="space-y-2.5">
        {items.map((item) => (
          <InboxRow key={item.txnId} item={item} properties={properties} onConfirm={onConfirm} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}
