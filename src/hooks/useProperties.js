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
  const addProperty = useCallback((property) => {
    const newProperties = [...properties, property];
    setProperties(newProperties);
    saveRef.current(newProperties);
    showToast('Property added', 'success');
  }, [properties, showToast]);

  const updateProperty = useCallback((propertyId, updates) => {
    const newProperties = properties.map(p => p.id === propertyId ? { ...p, ...updates } : p);
    setProperties(newProperties);
    saveRef.current(newProperties);
  }, [properties]);

  const deleteProperty = useCallback((propertyId) => {
    const newProperties = properties.filter(p => p.id !== propertyId);
    setProperties(newProperties);
    saveRef.current(newProperties);
    showToast('Property deleted', 'info');
    if (selectedProperty?.id === propertyId) {
      setSelectedProperty(null);
    }
  }, [properties, selectedProperty, showToast]);

  // ========== TENANT CRUD ==========
  const updateTenant = useCallback((propertyId, tenantData) => {
    const newProperties = properties.map(p => {
      if (p.id === propertyId) {
        return { ...p, tenant: { ...p.tenant, ...tenantData } };
      }
      return p;
    });
    setProperties(newProperties);
    saveRef.current(newProperties);
    showToast('Tenant updated', 'success');
  }, [properties, showToast]);

  const removeTenant = useCallback((propertyId) => {
    const newProperties = properties.map(p => {
      if (p.id === propertyId) {
        return { ...p, tenant: null };
      }
      return p;
    });
    setProperties(newProperties);
    saveRef.current(newProperties);
    showToast('Tenant removed', 'info');
  }, [properties, showToast]);

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
