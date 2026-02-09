import React, { useState } from 'react';
import { ArrowLeft, Edit3, MapPin, User, DollarSign, Calendar, Phone, Mail, FileText, Image, Trash2, Plus } from 'lucide-react';
import { tenantStatuses } from '../../constants';

const PropertyDetail = ({ property, onBack, onEdit, onDelete, onEditTenant, onAddTenant, onRemoveTenant }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'tasks' | 'photos' | 'notes'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!property) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p>Select a property to view details</p>
      </div>
    );
  }

  // Get tenant status info
  const getTenantStatusInfo = (status) => {
    return tenantStatuses.find(s => s.value === status);
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
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-800/95 border-b border-white/15">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{property.name}</h1>
              <div className="flex items-center gap-1 text-slate-400 text-sm mt-1">
                <MapPin className="w-4 h-4" />
                <span>{property.street}, {property.city}, {property.state} {property.zip}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(property)}
              className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white"
            >
              <Edit3 className="w-6 h-6" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 hover:bg-red-500/10 rounded-lg transition text-slate-400 hover:text-red-400"
            >
              <Trash2 className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 px-6 border-t border-white/10">
          {['overview', 'tasks', 'photos', 'notes'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 transition capitalize ${
                activeTab === tab
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Photo */}
            {property.photo && (
              <div className="aspect-video rounded-xl overflow-hidden">
                <img src={property.photo} alt={property.name} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Property Information */}
            <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Property Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Property Type</p>
                  <p className="text-white font-medium">{property.type}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Number of Units</p>
                  <p className="text-white font-medium">{property.units}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Purchase Date</p>
                  <p className="text-white font-medium">{property.purchaseDate || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Purchase Price</p>
                  <p className="text-white font-medium">
                    ${property.purchasePrice ? parseFloat(property.purchasePrice).toLocaleString() : '0'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Current Value</p>
                  <p className="text-white font-medium">
                    ${property.currentValue ? parseFloat(property.currentValue).toLocaleString() : '0'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Monthly Rent</p>
                  <p className="text-white font-medium">
                    ${property.monthlyRent ? parseFloat(property.monthlyRent).toLocaleString() : '0'}/month
                  </p>
                </div>
              </div>
            </div>

            {/* Tenant Section */}
            <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Tenant Information</h2>
                {property.tenant ? (
                  <button
                    onClick={() => onRemoveTenant()}
                    className="text-sm px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => onAddTenant()}
                    className="text-sm px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Tenant
                  </button>
                )}
              </div>

              {property.tenant ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
                        <User className="w-4 h-4" />
                        Name
                      </p>
                      <p className="text-white font-medium">{property.tenant.name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Status</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${getTenantStatusInfo(property.tenant.status)?.color}`}>
                          {getTenantStatusInfo(property.tenant.status)?.label}
                        </span>
                      </div>
                    </div>
                    {property.tenant.email && (
                      <div>
                        <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          Email
                        </p>
                        <p className="text-white font-medium">{property.tenant.email}</p>
                      </div>
                    )}
                    {property.tenant.phone && (
                      <div>
                        <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          Phone
                        </p>
                        <p className="text-white font-medium">{property.tenant.phone}</p>
                      </div>
                    )}
                  </div>

                  {/* Lease Information */}
                  {(property.tenant.leaseStart || property.tenant.leaseEnd) && (
                    <div className="pt-4 border-t border-white/10">
                      <h3 className="text-white font-semibold mb-4">Lease Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {property.tenant.leaseStart && (
                          <div>
                            <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Lease Start
                            </p>
                            <p className="text-white font-medium">{property.tenant.leaseStart}</p>
                          </div>
                        )}
                        {property.tenant.leaseEnd && (
                          <div>
                            <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Lease End
                            </p>
                            <p className="text-white font-medium">{property.tenant.leaseEnd}</p>
                            {daysLeft !== null && (
                              <p className={`text-sm mt-2 ${daysLeft <= 30 ? 'text-orange-400' : 'text-slate-400'}`}>
                                {daysLeft} days remaining
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Financial Information */}
                  {(property.tenant.monthlyRent || property.tenant.securityDeposit) && (
                    <div className="pt-4 border-t border-white/10">
                      <h3 className="text-white font-semibold mb-4">Financial Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {property.tenant.monthlyRent && (
                          <div>
                            <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              Monthly Rent
                            </p>
                            <p className="text-white font-medium">
                              ${parseFloat(property.tenant.monthlyRent).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {property.tenant.securityDeposit && (
                          <div>
                            <p className="text-slate-400 text-sm mb-1">Security Deposit</p>
                            <p className="text-white font-medium">
                              ${parseFloat(property.tenant.securityDeposit).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      onClick={() => onEditTenant(property.tenant)}
                      className="w-full px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition font-medium"
                    >
                      Edit Tenant
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <User className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-slate-400 mb-4">No tenant assigned to this property</p>
                  <button
                    onClick={() => onAddTenant()}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-medium inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Tenant
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            {property.notes && (
              <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notes
                </h2>
                <p className="text-slate-300 whitespace-pre-wrap">{property.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="py-8 text-center text-slate-400">
            <p>Tasks feature coming soon</p>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="py-8">
            {property.photo ? (
              <div className="space-y-4">
                <div className="aspect-video rounded-xl overflow-hidden">
                  <img src={property.photo} alt={property.name} className="w-full h-full object-cover" />
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No photos yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            {property.notes ? (
              <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
                <p className="text-slate-300 whitespace-pre-wrap">{property.notes}</p>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No notes yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/95 border border-white/15 rounded-2xl p-6 max-w-sm">
            <h3 className="text-xl font-bold text-white mb-2">Delete Property?</h3>
            <p className="text-slate-400 mb-6">
              This action cannot be undone. All data associated with this property will be permanently deleted.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(property.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetail;
