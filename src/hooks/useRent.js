import { useState, useCallback, useRef } from 'react';

/**
 * useRent Hook
 * Manages rent payment ledger data and operations
 * Each rent payment: { id, propertyId, propertyName, tenantName, month, amount, datePaid, status, notes }
 */
export const useRent = (currentUser, saveRent, showToast) => {
  const saveRef = useRef(saveRent);
  saveRef.current = saveRent;

  // ========== STATE ==========
  const [rentPayments, setRentPayments] = useState([]);
  const [showAddRentModal, setShowAddRentModal] = useState(null); // null | 'create' | payment object (edit)

  // ========== CRUD ==========
  const addRentPayment = useCallback((payment) => {
    const newPayment = {
      ...payment,
      id: payment.id || Date.now().toString(),
      createdAt: payment.createdAt || new Date().toISOString(),
    };
    const updated = [...rentPayments, newPayment];
    setRentPayments(updated);
    saveRef.current(updated);
    showToast('Rent payment recorded', 'success');
  }, [rentPayments, showToast]);

  const updateRentPayment = useCallback((paymentId, updates) => {
    const updated = rentPayments.map(r =>
      r.id === paymentId ? { ...r, ...updates } : r
    );
    setRentPayments(updated);
    saveRef.current(updated);
    showToast('Payment updated', 'success');
  }, [rentPayments, showToast]);

  const deleteRentPayment = useCallback((paymentId) => {
    const updated = rentPayments.filter(r => r.id !== paymentId);
    setRentPayments(updated);
    saveRef.current(updated);
    showToast('Payment deleted', 'info');
  }, [rentPayments, showToast]);

  return {
    rentPayments,
    showAddRentModal,
    addRentPayment,
    updateRentPayment,
    deleteRentPayment,
    setShowAddRentModal,
    setRentPayments,
  };
};

export default useRent;
