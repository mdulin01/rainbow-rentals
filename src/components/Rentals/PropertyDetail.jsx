import React, { useState } from 'react';
import { ArrowLeft, Edit3, MapPin, User, DollarSign, Calendar, Phone, Mail, FileText, Image, Trash2, Plus, Lightbulb, X } from 'lucide-react';
import { tenantStatuses } from '../../constants';
import { getPropertyTenants } from '../../hooks/useProperties';

const PropertyDetail = ({ property, onBack, onEdit, onDelete, onEditTenant, onAddTenant, onRemoveTenant, onUpdateProperty }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddIdea, setShowAddIdea] = useState(false);
  const [ideaForm, setIdeaForm] = useState({ title: '', description: '', priority: 'medium' });

  if (!property) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p>Select a property to view details</p>
      </div>
    );
  }

  const tenants = getPropertyTenants(property);

  const getTenantStatusInfo = (status) => {
    return tenantStatuses.find(s => s.value === status);
  };

  const getDaysUntilExpiration = (leaseEnd) => {
    if (!leaseEnd) return null;
    const end = new Date(leaseEnd);
    const today = new Date();
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-800/95 border-b border-white/15">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white">
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
            <button onClick={() => onEdit(property)} className="p-2 hover:bg-white/10 rounded-lg transition text-slate-400 hover:text-white">
              <Edit3 className="w-6 h-6" />
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 hover:bg-red-500/10 rounded-lg transition text-slate-400 hover:text-red-400">
              <Trash2 className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 px-6 border-t border-white/10 overflow-x-auto">
          {['overview', 'ideas', 'photos', 'notes'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 transition capitalize ${
                activeTab === tab ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-white'
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
                  <p className="text-white font-medium">${property.purchasePrice ? parseFloat(property.purchasePrice).toLocaleString() : '0'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Current Value</p>
                  <p className="text-white font-medium">${property.currentValue ? parseFloat(property.currentValue).toLocaleString() : '0'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-1">Monthly Rent</p>
                  <p className="text-white font-medium">${property.monthlyRent ? parseFloat(property.monthlyRent).toLocaleString() : '0'}/month</p>
                </div>
              </div>
            </div>

            {/* Tenants Section */}
            <div className="bg-slate-800/50 border border-white/15 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Tenants ({tenants.length})</h2>
                <button
                  onClick={() => onAddTenant()}
                  className="text-sm px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Tenant
                </button>
              </div>

              {tenants.length > 0 ? (
                <div className="space-y-4">
                  {tenants.map((tenant, idx) => {
                    const daysLeft = getDaysUntilExpiration(tenant.leaseEnd);
                    return (
                      <div key={tenant.id || idx} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <User className="w-5 h-5 text-slate-400" />
                            <h3 className="text-white font-semibold">{tenant.name}</h3>
                            <span className={`text-xs font-medium ${getTenantStatusInfo(tenant.status)?.color || 'text-slate-400'}`}>
                              {getTenantStatusInfo(tenant.status)?.label || tenant.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onEditTenant(tenant)}
                              className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onRemoveTenant(tenant.id)}
                              className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {tenant.email && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <Mail className="w-3.5 h-3.5" /> {tenant.email}
                            </div>
                          )}
                          {tenant.phone && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <Phone className="w-3.5 h-3.5" /> {tenant.phone}
                            </div>
                          )}
                          {tenant.leaseStart && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <Calendar className="w-3.5 h-3.5" /> Start: {tenant.leaseStart}
                            </div>
                          )}
                          {tenant.leaseEnd && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <Calendar className="w-3.5 h-3.5" /> End: {tenant.leaseEnd}
                              {daysLeft !== null && daysLeft <= 60 && (
                                <span className={`text-xs ml-1 ${daysLeft <= 30 ? 'text-orange-400' : 'text-yellow-400'}`}>
                                  ({daysLeft}d left)
                                </span>
                              )}
                            </div>
                          )}
                          {tenant.monthlyRent && (
                            <div className="flex items-center gap-1.5 text-emerald-400">
                              <DollarSign className="w-3.5 h-3.5" /> ${parseFloat(tenant.monthlyRent).toLocaleString()}/mo
                            </div>
                          )}
                          {tenant.securityDeposit && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <DollarSign className="w-3.5 h-3.5" /> Deposit: ${parseFloat(tenant.securityDeposit).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <User className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-slate-400 mb-4">No tenants assigned to this property</p>
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

        {activeTab === 'ideas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                Upgrade Ideas
              </h2>
              <button
                onClick={() => { setShowAddIdea(true); setIdeaForm({ title: '', description: '', priority: 'medium' }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded-lg text-sm font-medium hover:bg-yellow-500/30 transition"
              >
                <Plus className="w-4 h-4" /> Add Idea
              </button>
            </div>

            {showAddIdea && (
              <div className="bg-slate-800/80 border border-white/15 rounded-xl p-4 space-y-3">
                <input type="text" value={ideaForm.title} onChange={e => setIdeaForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Idea title (e.g., New kitchen countertops)"
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50" autoFocus />
                <textarea value={ideaForm.description} onChange={e => setIdeaForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Details, estimated cost, notes..." rows={2}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 resize-none" />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/40">Priority:</label>
                  {['high', 'medium', 'low'].map(p => (
                    <button key={p} onClick={() => setIdeaForm(f => ({ ...f, priority: p }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition capitalize ${
                        ideaForm.priority === p
                          ? p === 'high' ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : p === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                            : 'bg-white/10 text-white/60 border border-white/20'
                          : 'bg-white/[0.05] text-white/40 border border-transparent hover:bg-white/10'
                      }`}>{p}</button>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddIdea(false)} className="px-3 py-1.5 text-white/50 hover:text-white text-sm transition">Cancel</button>
                  <button
                    onClick={() => {
                      if (!ideaForm.title.trim()) return;
                      const ideas = [...(property.ideas || []), {
                        id: Date.now().toString(), title: ideaForm.title, description: ideaForm.description,
                        priority: ideaForm.priority, status: 'idea', createdAt: new Date().toISOString(),
                      }];
                      onUpdateProperty(property.id, { ideas });
                      setShowAddIdea(false);
                      setIdeaForm({ title: '', description: '', priority: 'medium' });
                    }}
                    disabled={!ideaForm.title.trim()}
                    className="px-4 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition disabled:opacity-50"
                  >Save</button>
                </div>
              </div>
            )}

            {(property.ideas || []).length === 0 && !showAddIdea && (
              <div className="py-12 text-center text-slate-400">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No upgrade ideas yet</p>
                <p className="text-xs text-white/30 mt-1">Add ideas for potential improvements to this property</p>
              </div>
            )}

            {(property.ideas || []).map(idea => (
              <div key={idea.id} className="bg-slate-800/50 border border-white/15 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        idea.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                        idea.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/10 text-white/50'
                      }`}>{idea.priority}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        idea.status === 'done' ? 'bg-green-500/20 text-green-300' :
                        idea.status === 'in-progress' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-white/50'
                      }`}>{idea.status || 'idea'}</span>
                    </div>
                    <h3 className="text-white font-medium">{idea.title}</h3>
                    {idea.description && <p className="text-sm text-white/50 mt-1">{idea.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {idea.status !== 'done' && (
                      <button onClick={() => {
                        const ideas = (property.ideas || []).map(i => i.id === idea.id ? { ...i, status: i.status === 'in-progress' ? 'done' : 'in-progress' } : i);
                        onUpdateProperty(property.id, { ideas });
                      }} className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/40 hover:text-green-400 text-xs"
                        title={idea.status === 'in-progress' ? 'Mark done' : 'Start'}>
                        {idea.status === 'in-progress' ? '✅' : '▶️'}
                      </button>
                    )}
                    <button onClick={() => {
                      const ideas = (property.ideas || []).filter(i => i.id !== idea.id);
                      onUpdateProperty(property.id, { ideas });
                    }} className="p-1.5 hover:bg-red-500/10 rounded-lg transition text-white/40 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
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

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/95 border border-white/15 rounded-2xl p-6 max-w-sm">
            <h3 className="text-xl font-bold text-white mb-2">Delete Property?</h3>
            <p className="text-slate-400 mb-6">This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition">Cancel</button>
              <button onClick={() => { onDelete(property.id); setShowDeleteConfirm(false); }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetail;
