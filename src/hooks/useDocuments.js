import { useState, useCallback, useRef } from 'react';

/**
 * useDocuments Hook
 * Manages all Documents data and operations in one place
 * Returns an object with state and callbacks ready to use
 */

export const useDocuments = (currentUser, saveDocuments, showToast) => {
  // Keep a ref to saveDocuments so callbacks always use the latest version
  // without needing it in their dependency arrays (avoids stale closure bugs)
  const saveRef = useRef(saveDocuments);
  saveRef.current = saveDocuments;

  // ========== STATE ==========
  const [documents, setDocuments] = useState([]);
  const [documentViewMode, setDocumentViewMode] = useState('all'); // 'all' | 'byProperty' | 'byType'
  const [documentTypeFilter, setDocumentTypeFilter] = useState('all');
  const [documentPropertyFilter, setDocumentPropertyFilter] = useState('all');
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(null); // null | 'create' | doc object (edit)

  // ========== DOCUMENT CRUD ==========
  const addDocument = useCallback((doc) => {
    const newDocs = [...documents, doc];
    setDocuments(newDocs);
    saveRef.current(newDocs);
    showToast('Document added', 'success');
  }, [documents, showToast]);

  const updateDocument = useCallback((docId, updates) => {
    const newDocs = documents.map(d => d.id === docId ? { ...d, ...updates } : d);
    setDocuments(newDocs);
    saveRef.current(newDocs);
  }, [documents]);

  const deleteDocument = useCallback((docId) => {
    const newDocs = documents.filter(d => d.id !== docId);
    setDocuments(newDocs);
    saveRef.current(newDocs);
    showToast('Document removed', 'info');
  }, [documents, showToast]);

  // ========== RETURN CONTEXT VALUE ==========
  return {
    // Data
    documents,
    documentViewMode,
    documentTypeFilter,
    documentPropertyFilter,
    showAddDocumentModal,

    // Document operations
    addDocument,
    updateDocument,
    deleteDocument,

    // Setters for UI state
    setDocumentViewMode,
    setDocumentTypeFilter,
    setDocumentPropertyFilter,
    setShowAddDocumentModal,

    // Setters for loading data from Firebase
    setDocuments,

    // Utilities
    showToast,
  };
};

export default useDocuments;
