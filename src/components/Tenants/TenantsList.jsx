import React, { useState, useMemo } from 'react';
import { Search, Plus, ChevronDown, ChevronUp, User, Phone, Mail, Calendar, DollarSign, ClipboardPaste, X, Trash2, MessageSquare } from 'lucide-react';
import { normalizePhone } from '../../utils';
import { parsePastedTenants as parsePasted, matchPropertyByAddress as matchProperty, leaseState, tenantRent, getPropertyTenants as propTenants } from '../../rentLogic.js';
import { tenantStatuses } from '../../constants';
import { formatDate, formatCurrency } from '../../utils';
import { getPropertyTenants } from '../../hooks/useProperties';

export default function TenantsList({ properties, onEditTenant, onAddTenant, onViewProperty, onImportTenants, onDeleteTenant, onTextTenant, canManage = true }) {
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState(null); // [{ name, phone, address, propertyId, exists }]

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // Flatten tenants from all properties (supports multi-tenant)
  const allTenants = useMemo(() => {
    const result = [];
    properties.forEach(p => {
      getPropertyTenants(p).forEach(t => {
        result.push({
          ...t,
          propertyId: p.id,
          propertyName: p.name,
          propertyEmoji: p.emoji || '🏠',
          rentDisplay: tenantRent(t, p),
        });
      });
    });
    return result;
  }, [properties]);

  // Filter
  const filtered = useMemo(() => {
    let result = [...allTenants];
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.phone || '').includes(q) ||
        (t.propertyName || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [allTenants, statusFilter, searchQuery]);

  // Sort
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortCol) {
        case 'name': return dir * (a.name || '').localeCompare(b.name || '');
        case 'property': return dir * (a.propertyName || '').localeCompare(b.propertyName || '');
        case 'status': return dir * (a.status || '').localeCompare(b.status || '');
        case 'rent': return dir * ((a.rentDisplay || 0) - (b.rentDisplay || 0));
        case 'deposit': return dir * ((parseFloat(a.securityDeposit) || 0) - (parseFloat(b.securityDeposit) || 0));
        case 'leaseEnd': return dir * (a.leaseEnd || '9999').localeCompare(b.leaseEnd || '9999');
        default: return 0;
      }
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronDown className="w-3 h-3 opacity-30 inline ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-teal-400 inline ml-1" />
      : <ChevronDown className="w-3 h-3 text-teal-400 inline ml-1" />;
  };

  const getStatusBadge = (status) => {
    const s = tenantStatuses.find(ts => ts.value === status);
    if (!s) return <span className="text-xs text-white/40">{status}</span>;
    return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const vacantCount = properties.filter(p => propTenants(p).filter(t => t.status !== 'former').length === 0 && p.propertyStatus !== 'owner-occupied').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Tenants</h2>
          <p className="text-xs text-white/40">{allTenants.length} tenants across {properties.length} properties</p>
        </div>
        <div className="flex gap-2">
          {canManage && onImportTenants && (
            <button
              onClick={() => { setShowImport(true); setPreview(null); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition"
              title="Paste a list of names, addresses and phones"
            >
              <ClipboardPaste className="w-4 h-4" /> Paste list
            </button>
          )}
          <button
            onClick={onAddTenant}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition"
          >
            <Plus className="w-4 h-4" /> Add Tenant
          </button>
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowImport(false)} />
          <div className="relative w-full max-w-2xl bg-slate-800 border border-white/10 rounded-t-3xl md:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">Paste a tenant list</h2>
              <button onClick={() => setShowImport(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"><X className="w-4 h-4 text-white/60" /></button>
            </div>
            {!preview ? (
              <>
                <p className="text-xs text-white/40 mb-2">One tenant per line: name, property address, mobile. Columns can be separated by | , or tabs. A header row is fine.</p>
                <textarea rows={8} value={pasteText} onChange={e => setPasteText(e.target.value)}
                  placeholder={'Jane Doe | 412 Hillcrest Dr | (336) 555-1234\nJohn Roe | 2819 Green Crest Ct | 336-555-9876'}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50 font-mono" />
                <div className="flex gap-2 mt-4">
                  <button onClick={() => {
                    const rows = parsePasted(pasteText);
                    setPreview(rows.map(r => {
                      const prop = matchProperty(r.address, properties);
                      const existing = prop ? allTenants.find(t => String(t.propertyId) === String(prop.id) && ((r.phone && normalizePhone(t.phone) === normalizePhone(r.phone)) || (t.name || '').toLowerCase() === r.name.toLowerCase())) : null;
                      // Already listed with a phone → skip. Listed without one → add the phone. Otherwise → new tenant.
                      const action = !existing ? 'add' : (normalizePhone(existing.phone) ? 'skip' : 'update');
                      return { ...r, propertyId: prop ? String(prop.id) : '', existing, action };
                    }));
                  }} disabled={!pasteText.trim()}
                    className="flex-1 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition">Preview</button>
                  <button onClick={() => setShowImport(false)} className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition">Cancel</button>
                </div>
              </>
            ) : (
              <>
                {preview.length === 0 && <p className="text-sm text-white/50">Nothing I could read. Each line needs at least a name and a phone or address.</p>}
                <div className="space-y-2">
                  {preview.map((r, i) => (
                    <div key={i} className={`grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr] gap-2 items-center rounded-xl px-3 py-2 ${r.action === 'skip' ? 'bg-white/[0.03] opacity-60' : 'bg-white/[0.05]'}`}>
                      <div className="min-w-0"><p className="text-sm text-white truncate">{r.name}</p><p className="text-[11px] text-white/40 truncate">{r.address || 'no address'}</p></div>
                      <p className="text-xs text-white/70">{r.phone || <span className="text-orange-300">no phone</span>}
                        {r.action === 'skip' && <span className="text-white/40"> · already listed, skipped</span>}
                        {r.action === 'update' && <span className="text-teal-300"> · adds phone to existing</span>}
                        {r.action === 'add' && <span className="text-emerald-300"> · new</span>}</p>
                      <select value={r.propertyId} onChange={e => setPreview(pv => pv.map((x, j) => j === i ? { ...x, propertyId: e.target.value } : x))}
                        className="w-full px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-teal-500/50">
                        <option value="" className="bg-slate-800">— skip (no property match) —</option>
                        {properties.map(p => <option key={p.id} value={String(p.id)} className="bg-slate-800">{p.emoji || '🏠'} {p.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => {
                    const items = preview.filter(r => r.propertyId && r.action !== 'skip').map(r => {
                      if (r.action === 'update') {
                        // Keep everything on the existing record; only fill the phone (and allow texting).
                        const { propertyId: _p, propertyName: _n, propertyEmoji: _e, ...rest } = r.existing;
                        return { propertyId: r.propertyId, tenant: { ...rest, phone: r.phone, smsOk: true } };
                      }
                      const parts = r.name.trim().split(/\s+/);
                      return { propertyId: r.propertyId, tenant: {
                        name: r.name.trim(), firstName: parts[0] || '', lastName: parts.slice(1).join(' '),
                        phone: r.phone, email: '', status: 'active', smsOk: true, leaseStart: '', leaseEnd: '', monthlyRent: '', securityDeposit: '',
                      } };
                    });
                    onImportTenants(items);
                    setShowImport(false); setPasteText(''); setPreview(null);
                  }} disabled={!preview.some(r => r.propertyId && r.action !== 'skip')}
                    className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition">
                    Apply to {preview.filter(r => r.propertyId && r.action !== 'skip').length} tenant{preview.filter(r => r.propertyId && r.action !== 'skip').length === 1 ? '' : 's'}
                  </button>
                  <button onClick={() => setPreview(null)} className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition">Back</button>
                </div>
                <p className="text-[11px] text-white/30 mt-3">Added tenants are marked active and OK to text. Open each one afterwards to add lease dates, due day and late fee.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search tenants, properties..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition ${statusFilter === 'all' ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
          >All</button>
          {tenantStatuses.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition ${statusFilter === s.value ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Total Tenants</p>
          <p className="text-xl font-bold text-teal-400">{allTenants.length}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Active</p>
          <p className="text-xl font-bold text-green-400">{allTenants.filter(t => t.status === 'active').length}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Vacant Units</p>
          <p className="text-xl font-bold text-red-400">{vacantCount}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3">
          <p className="text-white/40 text-xs mb-1">Monthly Rent</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(properties.reduce((sum, p) => sum + (parseFloat(p.monthlyRent) || 0), 0))}</p>
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">👤</p>
          <p className="text-white/30">No tenants found</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('name')}>
                    Tenant <SortIcon col="name" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('property')}>
                    Property <SortIcon col="property" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('status')}>
                    Status <SortIcon col="status" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('leaseEnd')}>
                    Lease End <SortIcon col="leaseEnd" />
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('rent')}>
                    Rent <SortIcon col="rent" />
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/60" onClick={() => handleSort('deposit')}>
                    Deposit <SortIcon col="deposit" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide">
                    Contact
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((tenant, idx) => {
                  return (
                    <tr
                      key={`${tenant.propertyId}-${idx}`}
                      className="border-b border-white/[0.05] hover:bg-white/[0.03] transition cursor-pointer"
                      onClick={() => onEditTenant(tenant.propertyId, tenant)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-white">{tenant.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); onViewProperty(tenant.propertyId); }}
                          className="text-sm text-teal-400 hover:text-teal-300 transition"
                        >
                          {tenant.propertyEmoji} {tenant.propertyName}
                        </button>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(tenant.status)}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const st = leaseState(tenant);
                          if (st.kind === 'month-to-month') {
                            return (
                              <div>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/70">Month-to-month</span>
                                {tenant.leaseEnd && <span className="block text-[11px] text-white/35 mt-1">term ended {formatDate(tenant.leaseEnd)}</span>}
                              </div>
                            );
                          }
                          if (!tenant.leaseEnd) return <span className="text-sm text-white/30" title="No lease end date entered">No end date</span>;
                          return (
                            <div>
                              <span className="text-sm text-white/70">{formatDate(tenant.leaseEnd)}</span>
                              {st.short && <span className={`text-xs ml-2 ${st.color}`}>{st.short}</span>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-emerald-400">
                          {tenant.rentDisplay ? formatCurrency(tenant.rentDisplay) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-white/60">
                          {tenant.securityDeposit ? formatCurrency(tenant.securityDeposit) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {tenant.email && (
                            <a href={`mailto:${tenant.email}`} onClick={e => e.stopPropagation()} className="text-white/40 hover:text-white/70">
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          {tenant.phone && (
                            <a href={`tel:${tenant.phone}`} onClick={e => e.stopPropagation()} className="text-white/40 hover:text-white/70">
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          {canManage && onTextTenant && tenant.phone && tenant.smsOk !== false && (
                            <button onClick={e => { e.stopPropagation(); onTextTenant(tenant.propertyId, tenant); }}
                              className="text-teal-300/80 hover:text-teal-300" title={`Text ${tenant.name}`}>
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}
                          {canManage && onDeleteTenant && (
                            <button onClick={e => { e.stopPropagation(); onDeleteTenant(tenant.propertyId, tenant); }}
                              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-red-300/70 hover:text-red-300 hover:bg-red-500/10 text-xs" title={`Remove ${tenant.name}`}>
                              <Trash2 className="w-4 h-4" /> Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
