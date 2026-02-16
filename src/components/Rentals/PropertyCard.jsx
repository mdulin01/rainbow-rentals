import React, { useState } from 'react';
import { MoreVertical, MapPin, User, DollarSign, Trash2, Edit3, Eye, FileText, Clock, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { propertyStatuses } from '../../constants';
import { getPropertyTenants } from '../../hooks/useProperties';

const PropertyCard = ({ property, onEdit, onDelete, onViewDetails, documents = [], onViewDocument, expenses = [] }) => {
  const [showMenu, setShowMenu] = useState(false);

  const tenants = getPropertyTenants(property);

  // Net income calculation
  const currentYear = new Date().getFullYear();
  const propId = String(property.id);
  const monthsElapsed = Math.max(1, new Date().getMonth() + 1);
  const ytdExpenses = (expenses || [])
    .filter(e => String(e.propertyId) === propId && e.isTemplate !== true)
    .filter(e => e.date && e.date.startsWith(String(currentYear)))
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const avgMonthlyExpenses = ytdExpenses / monthsElapsed;
  const monthlyRent = parseFloat(property.monthlyRent) || 0;
  const monthlyNet = monthlyRent - avgMonthlyExpenses;

  // Find lease document for this property
  const leaseDoc = documents.find(
    d => String(d.propertyId) === String(property.id) && d.type === 'lease' && d.fileUrl
  );

  // Property status
  const propStatus = property.propertyStatus || (tenants.length > 0 ? 'occupied' : 'vacant');
  const statusObj = propertyStatuses.find(s => s.value === propStatus) || propertyStatuses[1];

  // Lease expiry - use earliest expiring lease across all tenants
  const getLeaseInfo = () => {
    const leaseEnds = tenants
      .filter(t => t.leaseEnd)
      .map(t => ({ date: new Date(t.leaseEnd + 'T00:00:00'), raw: t.leaseEnd }));
    if (leaseEnds.length === 0) return null;

    // Sort by date, earliest first
    leaseEnds.sort((a, b) => a.date - b.date);
    const earliest = leaseEnds[0];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((earliest.date - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const month = earliest.date.getMonth() + 1;
      const year = earliest.date.getFullYear();
      return { expired: true, text: `Expired ${month}/${year}`, days: diffDays };
    }
    if (diffDays <= 90) {
      return { expired: false, text: `${diffDays}d left`, days: diffDays };
    }
    const month = earliest.date.getMonth() + 1;
    const year = earliest.date.getFullYear();
    return { expired: false, text: `Ends ${month}/${year}`, days: diffDays };
  };

  const leaseInfo = getLeaseInfo();
  const tenantNames = tenants.map(t => t.name).filter(Boolean).join(', ');

  return (
    <div
      className="relative bg-slate-700/50 border border-white/15 rounded-xl hover:shadow-lg transition group cursor-pointer overflow-visible"
      onClick={() => onViewDetails(property)}
    >
      {/* Compact photo/gradient strip */}
      <div className={`h-20 bg-gradient-to-br ${property.color || 'from-slate-600 to-slate-700'} flex items-center justify-center overflow-hidden relative rounded-t-xl`}>
        {property.photo ? (
          <img src={property.photo} alt={property.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-3xl opacity-60">{property.emoji || '🏠'}</div>
        )}

        {/* Status badge - top left */}
        <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 ${statusObj.bg} text-white text-[10px] font-bold rounded-md`}>
          {statusObj.label.toUpperCase()}
        </span>

        {/* Lease countdown - top right */}
        {leaseInfo && (
          <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 ${
            leaseInfo.expired
              ? 'bg-red-600/90 text-white'
              : leaseInfo.days <= 30
                ? 'bg-orange-500/90 text-white'
                : leaseInfo.days <= 90
                  ? 'bg-yellow-500/90 text-white'
                  : 'bg-black/40 text-white/80'
          }`}>
            <Clock className="w-2.5 h-2.5" />
            {leaseInfo.text}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">{property.name}</h3>
            {property.street && (
              <div className="flex items-center gap-1 text-slate-400 text-xs truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{property.street}{property.city ? `, ${property.city}` : ''}</span>
              </div>
            )}
          </div>

          {/* 3-dot Menu */}
          <div className="relative z-10">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-white/15 rounded-xl shadow-2xl z-50 min-w-[120px]">
                  <button onClick={(e) => { e.stopPropagation(); onEdit(property); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10 transition text-sm">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onViewDetails(property); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10 transition text-sm border-t border-white/10">
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(property.id); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 transition text-sm border-t border-white/10">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tenant row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            {tenants.length > 1 ? <Users className="w-3 h-3 text-slate-400 flex-shrink-0" /> : <User className="w-3 h-3 text-slate-400 flex-shrink-0" />}
            {tenantNames ? (
              <span className="text-white/80 truncate">{tenantNames}</span>
            ) : (
              <span className="text-slate-500 italic">Vacant</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {leaseDoc && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewDocument ? onViewDocument(leaseDoc) : window.open(leaseDoc.fileUrl, '_blank'); }}
                className="p-0.5 text-blue-400 hover:text-blue-300 transition"
                title="View Lease"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="flex items-center gap-1.5">
              {avgMonthlyExpenses > 0 && (
                <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${monthlyNet >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {monthlyNet >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  ${Math.abs(Math.round(monthlyNet)).toLocaleString()}
                </span>
              )}
              <div className="flex items-center gap-0.5 text-emerald-400 font-semibold">
                <DollarSign className="w-3 h-3" />
                <span>{property.monthlyRent ? parseFloat(property.monthlyRent).toLocaleString() : '0'}/mo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
