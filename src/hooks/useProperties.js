import { useState, useCallback, useRef } from 'react';

/**
 * useProperties Hook
 * Manages all Properties data and operations in one place
 * Returns an object with state and callbacks ready to use
 */

export const useProperties = (currentUser, saveProperties, showToast) => {
  // Keep a ref to saveProperties so callbacks always use the latest version
  // without needing it in their dependency arrays (avoids stale closure bugs)
  const saveRef = useRef(saveProperties);
  saveRef.current = saveProperties;

  // ========== STATE ==========
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertyViewMode, setPropertyViewMode] = useState('grid'); // 'grid' | 'tasks' | 'overview'
  const [showNewPropertyModal, setShowNewPropertyModal] = useState(null); // null | 'create' | property object (edit)
  const [showTenantModal, setShowTenantModal] = useState(null); // null | { propertyId, tenantData } (edit) | { propertyId } (create)

  // ========== PROPERTY CRUD ==========
  // All CRUD functions use functional state updates (prev =>) to avoid stale closure bugs.
  // This is critical because async operations (e.g. photo uploads) can complete after
  // properties state has changed, and stale closures would overwrite newer data.

  const addProperty = useCallback((property) => {
    setProperties(prev => {
      const newProperties = [...prev, property];
      saveRef.current(newProperties);
      return newProperties;
    });
    showToast('Property added', 'success');
  }, [showToast]);

  // updates can be an object OR a function (currentProperty) => partialUpdates
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

  // ========== TENANT CRUD ==========
  const updateTenant = useCallback((propertyId, tenantData) => {
    let matched = false;
    setProperties(prev => {
      const newProperties = prev.map(p => {
        if (String(p.id) === String(propertyId)) {
          matched = true;
          return { ...p, tenant: { ...p.tenant, ...tenantData } };
        }
        return p;
      });
      if (matched) {
        saveRef.current(newProperties);
        return newProperties;
      }
      return prev; // don't update state if nothing matched
    });
    // Toast after setState (matched will be set by the updater since it runs sync)
    if (matched) {
      showToast('Tenant saved', 'success');
    } else {
      console.error('updateTenant: no property matched id', propertyId);
      showToast('Error: property not found', 'error');
    }
  }, [showToast]);

  const removeTenant = useCallback((propertyId) => {
    setProperties(prev => {
      const newProperties = prev.map(p => {
        if (String(p.id) === String(propertyId)) {
          return { ...p, tenant: null };
        }
        return p;
      });
      saveRef.current(newProperties);
      return newProperties;
    });
    showToast('Tenant removed', 'info');
  }, [showToast]);

  // ========== RETURN CONTEXT VALUE ==========
  return {
    // Data
    properties,
    selectedProperty,
    propertyViewMode,
    showNewPropertyModal,
    showTenantModal,

    // Property operations
    addProperty,
    updateProperty,
    deleteProperty,

    // Tenant operations
    updateTenant,
    removeTenant,

    // Setters for UI state
    setSelectedProperty,
    setPropertyViewMode,
    setShowNewPropertyModal,
    setShowTenantModal,

    // Setters for loading data from Firebase
    setProperties,

    // Utilities
    showToast,
  };
};

export default useProperties;
