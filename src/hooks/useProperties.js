import { useState, useCallback, useRef } from 'react';

/**
 * Helper: get tenants array from a property, handling legacy single-tenant data.
 * Legacy: property.tenant = { name, email, ... }
 * New:    property.tenants = [{ id, name, email, ... }, ...]
 */
export const getPropertyTenants = (property) => {
  if (!property) return [];
  if (Array.isArray(property.tenants) && property.tenants.length > 0) return property.tenants;
  if (property.tenant && property.tenant.name) return [{ id: 'legacy', ...property.tenant }];
  return [];
};

/**
 * Lease terms for a property: rent due day, grace period, late fee. Stored on the
 * tenant (the lease), so take the first active tenant that has any set; fall back
 * to the app-wide defaults in `defaults` (from rentalData/comms settings).
 */
export const getLeaseTerms = (property, defaults = {}) => {
  const tenants = getPropertyTenants(property);
  const active = tenants.filter(t => !t.status || ['active', 'notice', 'pending'].includes(t.status));
  const src = [...active, ...tenants].find(t => t.rentDueDay || t.graceDays || t.lateFee) || {};
  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
  return {
    dueDay: Math.min(Math.max(parseInt(src.rentDueDay || defaults.dueDay || 1, 10) || 1, 1), 28),
    graceDays: Math.max(parseInt(src.graceDays ?? defaults.graceDays ?? 5, 10) || 0, 0),
    lateFee: num(src.lateFee, num(defaults.lateFee, 0)),
  };
};

/**
 * useProperties Hook
 * Manages all Properties data and operations in one place
 * Supports multiple tenants per property via property.tenants array.
 */
export const useProperties = (currentUser, saveProperties, showToast) => {
  const saveRef = useRef(saveProperties);
  saveRef.current = saveProperties;

  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertyViewMode, setPropertyViewMode] = useState('grid');
  const [showNewPropertyModal, setShowNewPropertyModal] = useState(null);
  const [showTenantModal, setShowTenantModal] = useState(null);

  // ========== PROPERTY CRUD ==========
  const addProperty = useCallback((property) => {
    setProperties(prev => {
      const newProperties = [...prev, property];
      saveRef.current(newProperties);
      return newProperties;
    });
    showToast('Property added', 'success');
  }, [showToast]);

  const updateProperty = useCallback((propertyId, updates) => {
    setProperties(prev => {
      const newProperties = prev.map(p => {
        if (String(p.id) === String(propertyId)) {
          const resolved = typeof updates === 'function' ? updates(p) : updates;
          return { ...p, ...resolved };
        }
        return p;
      });
      saveRef.current(newProperties);
      return newProperties;
    });
  }, []);

  const deleteProperty = useCallback((propertyId) => {
    setProperties(prev => {
      const newProperties = prev.filter(p => String(p.id) !== String(propertyId));
      saveRef.current(newProperties);
      return newProperties;
    });
    showToast('Property deleted', 'info');
    if (selectedProperty?.id === propertyId) {
      setSelectedProperty(null);
    }
  }, [selectedProperty, showToast]);

  // ========== TENANT CRUD (multi-tenant) ==========

  // Add or update a tenant. If tenantData.id exists, updates that tenant; otherwise adds new.
  const addOrUpdateTenant = useCallback((propertyId, tenantData) => {
    let matched = false;
    setProperties(prev => {
      const newProperties = prev.map(p => {
        if (String(p.id) === String(propertyId)) {
          matched = true;
          const currentTenants = getPropertyTenants(p);

          let newTenants;
          if (tenantData.id && tenantData.id !== 'legacy') {
            // Update existing tenant
            newTenants = currentTenants.map(t =>
              String(t.id) === String(tenantData.id) ? { ...t, ...tenantData } : t
            );
          } else {
            // Add new tenant (assign ID, strip legacy id)
            const newTenant = { ...tenantData, id: Date.now().toString() };
            delete newTenant._isNew;
            newTenants = [...currentTenants.filter(t => t.id !== 'legacy'), newTenant];
            // If editing the legacy tenant, replace it
            if (tenantData.id === 'legacy') {
              newTenants = [{ ...tenantData, id: Date.now().toString() }];
              // Re-add any non-legacy tenants
              const nonLegacy = currentTenants.filter(t => t.id !== 'legacy');
              newTenants = [...newTenants, ...nonLegacy];
            }
          }

          // Also set legacy .tenant to first tenant for backward compat
          const firstTenant = newTenants[0] || null;
          return { ...p, tenants: newTenants, tenant: firstTenant };
        }
        return p;
      });
      if (matched) {
        saveRef.current(newProperties);
        return newProperties;
      }
      return prev;
    });
    if (matched) {
      showToast('Tenant saved', 'success');
    } else {
      console.error('addOrUpdateTenant: no property matched id', propertyId);
      showToast('Error: property not found', 'error');
    }
  }, [showToast]);

  // Remove a specific tenant by ID
  const removeTenant = useCallback((propertyId, tenantId) => {
    setProperties(prev => {
      const newProperties = prev.map(p => {
        if (String(p.id) === String(propertyId)) {
          const currentTenants = getPropertyTenants(p);
          const newTenants = tenantId
            ? currentTenants.filter(t => String(t.id) !== String(tenantId))
            : []; // If no tenantId, remove all (backward compat)
          const firstTenant = newTenants[0] || null;
          return { ...p, tenants: newTenants, tenant: firstTenant };
        }
        return p;
      });
      saveRef.current(newProperties);
      return newProperties;
    });
    showToast('Tenant removed', 'info');
  }, [showToast]);

  return {
    properties,
    selectedProperty,
    propertyViewMode,
    showNewPropertyModal,
    showTenantModal,
    addProperty,
    updateProperty,
    deleteProperty,
    addOrUpdateTenant,
    removeTenant,
    setSelectedProperty,
    setPropertyViewMode,
    setShowNewPropertyModal,
    setShowTenantModal,
    setProperties,
    showToast,
  };
};

export default useProperties;
