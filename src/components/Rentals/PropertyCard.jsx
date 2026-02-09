import React, { useState } from 'react';
import { MoreVertical, MapPin, User, DollarSign, Calendar, Trash2, Edit3, Eye } from 'lucide-react';
import { tenantStatuses } from '../../constants';

const PropertyCard = ({ property, onEdit, onDelete, onViewDetails }) => {
  const [showMenu, setShowMenu] = useState(false);

  // Get tenant status color
  const getStatusColor = (status) => {
    const statusObj = tenantStatuses.find(s => s.value === status);
    return statusObj ? statusObj.color : 'text-slate-400';
  };

  // Get status label
  const getStatusLabel = (status) => {
    const statusObj = tenantStatuses.find(s => s.value === status);
    return statusObj ? statusObj.label : 'Unknown';
  };

  // Calculate days until lease expiration
  const getDaysUntilExpiration = () => {
    if (!property.tenant?.leaseEnd) return null;
    const leaseEnd = new Date(property.tenant.leaseEnd);
    const today = new Date();
    const diffTime = leaseEnd - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysLeft = getDaysUntilExpiration();

  return (
    <div className="relative bg-slate-700/50 border border-white/15 rounded-2xl overflow-hidden hover:shadow-lg transition group">
      {/* Photo/Gradient Placeholder */}
      <div className={`h-48 bg-gradient-to-br ${property.color || 'from-slate-600 to-slate-700'} flex items-center justify-center overflow-hidden`}>
        {property.photo ? (
          <img src={property.photo} alt={property.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-6xl opacity-60">{property.emoji || '🏠'}</div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Header with menu */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg mb-1">{property.name}</h3>
            <div className="flex items-center gap-1 text-slate-400 text-sm">
              <MapPin className="w-4 h-4" />
              <span>{property.street}, {property.city}</span>
            </div>
          </div>

          {/* 3-dot Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-slate-800/95 border border-white/15 rounded-xl shadow-xl z-50 min-w-max overflow-hidden">
                <button
                  onClick={() => {
                    onEdit(property);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-slate-200 hover:bg-white/10 transition text-sm"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    onViewDetails(property);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-slate-200 hover:bg-white/10 transition text-sm border-t border-white/10"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
                <button
                  onClick={() => {
                    onDelete(property.id);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-red-500/10 transition text-sm border-t border-white/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tenant Section */}
        {property.tenant ? (
          <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-white font-medium text-sm">{property.tenant.name}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getStatusColor(property.tenant.status)}`}>
                {getStatusLabel(property.tenant.status)}
              </span>
            </div>
            {daysLeft !== null && (
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Calendar className="w-3 h-3" />
                <span>{daysLeft} days until lease end</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400 text-sm italic">No tenant</span>
            </div>
          </div>
        )}

        {/* Rent Amount */}
        <div className="flex items-center gap-2 text-white font-semibold text-lg">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <span>{property.monthlyRent?.toLocaleString() || '0'}/mo</span>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
