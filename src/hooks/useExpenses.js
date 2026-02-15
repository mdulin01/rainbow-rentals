import { useState, useCallback, useRef } from 'react';

/**
 * useExpenses Hook
 * Manages expense data and operations
 * All CRUD uses functional state updates (prev =>) to avoid stale closure bugs.
 */
export const useExpenses = (currentUser, saveExpenses, showToast) => {
  const saveRef = useRef(saveExpenses);
  saveRef.current = saveExpenses;

  const [expenses, setExpenses] = useState([]);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(null);

  const addExpense = useCallback((expense) => {
    const newExpense = {
      ...expense,
      id: expense.id || Date.now().toString(),
      createdAt: expense.createdAt || new Date().toISOString(),
    };
    setExpenses(prev => {
      const updated = [...prev, newExpense];
      saveRef.current(updated);
      return updated;
    });
    showToast('Expense recorded', 'success');
  }, [showToast]);

  const updateExpense = useCallback((expenseId, updates) => {
    setExpenses(prev => {
      const updated = prev.map(e => e.id === expenseId ? { ...e, ...updates } : e);
      saveRef.current(updated);
      return updated;
    });
    showToast('Expense updated', 'success');
  }, [showToast]);

  const deleteExpense = useCallback((expenseId) => {
    setExpenses(prev => {
      const updated = prev.filter(e => e.id !== expenseId);
      saveRef.current(updated);
      return updated;
    });
    showToast('Expense deleted', 'info');
  }, [showToast]);

  return {
    expenses,
    showAddExpenseModal,
    addExpense,
    updateExpense,
    deleteExpense,
    setShowAddExpenseModal,
    setExpenses,
  };
};

export default useExpenses;
