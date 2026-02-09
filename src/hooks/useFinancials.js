import { useState, useCallback, useRef } from 'react';

/**
 * useFinancials Hook
 * Manages all Financials data and operations in one place
 * Tracks income and expenses for rental properties
 * Returns an object with state and callbacks ready to use
 */

export const useFinancials = (currentUser, saveFinancials, showToast) => {
  // Keep a ref to saveFinancials so callbacks always use the latest version
  // without needing it in their dependency arrays (avoids stale closure bugs)
  const saveRef = useRef(saveFinancials);
  saveRef.current = saveFinancials;

  // ========== STATE ==========
  const [transactions, setTransactions] = useState([]);
  const [financialViewMode, setFinancialViewMode] = useState('transactions'); // 'transactions' | 'summary' | 'byProperty'
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all'); // 'all' | 'income' | 'expense'
  const [transactionPropertyFilter, setTransactionPropertyFilter] = useState('all');
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(null); // null | 'create' | transaction object (edit)

  // ========== TRANSACTION CRUD ==========
  const addTransaction = useCallback((transaction) => {
    const newTransaction = {
      ...transaction,
      id: transaction.id || Date.now().toString(),
      createdAt: transaction.createdAt || new Date().toISOString(),
    };
    const newTransactions = [...transactions, newTransaction];
    setTransactions(newTransactions);
    saveRef.current(newTransactions);
    showToast(`${transaction.type === 'income' ? 'Income' : 'Expense'} added`, 'success');
  }, [transactions, showToast]);

  const updateTransaction = useCallback((transactionId, updates) => {
    const newTransactions = transactions.map(t =>
      t.id === transactionId ? { ...t, ...updates } : t
    );
    setTransactions(newTransactions);
    saveRef.current(newTransactions);
    showToast('Transaction updated', 'success');
  }, [transactions, showToast]);

  const deleteTransaction = useCallback((transactionId) => {
    const newTransactions = transactions.filter(t => t.id !== transactionId);
    setTransactions(newTransactions);
    saveRef.current(newTransactions);
    showToast('Transaction deleted', 'info');
  }, [transactions, showToast]);

  // ========== AGGREGATION HELPERS ==========
  const getTotalIncome = useCallback((propertyId = null) => {
    return transactions
      .filter(t => t.type === 'income' && (!propertyId || t.propertyId === propertyId))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions]);

  const getTotalExpenses = useCallback((propertyId = null) => {
    return transactions
      .filter(t => t.type === 'expense' && (!propertyId || t.propertyId === propertyId))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions]);

  const getProfit = useCallback((propertyId = null) => {
    const income = getTotalIncome(propertyId);
    const expenses = getTotalExpenses(propertyId);
    return income - expenses;
  }, [getTotalIncome, getTotalExpenses]);

  const getMonthlyBreakdown = useCallback(() => {
    const breakdown = {};

    transactions.forEach(t => {
      if (!t.date) return;
      const [year, month] = t.date.split('-');
      const key = `${year}-${month}`;

      if (!breakdown[key]) {
        breakdown[key] = { income: 0, expense: 0 };
      }

      if (t.type === 'income') {
        breakdown[key].income += t.amount || 0;
      } else {
        breakdown[key].expense += t.amount || 0;
      }
    });

    return breakdown;
  }, [transactions]);

  const getPropertyBreakdown = useCallback(() => {
    const breakdown = {};

    transactions.forEach(t => {
      const propId = t.propertyId || 'unassigned';
      if (!breakdown[propId]) {
        breakdown[propId] = { income: 0, expense: 0, profit: 0 };
      }

      if (t.type === 'income') {
        breakdown[propId].income += t.amount || 0;
      } else {
        breakdown[propId].expense += t.amount || 0;
      }

      breakdown[propId].profit = breakdown[propId].income - breakdown[propId].expense;
    });

    return breakdown;
  }, [transactions]);

  const getFilteredTransactions = useCallback(() => {
    return transactions.filter(t => {
      const typeMatch = transactionTypeFilter === 'all' || t.type === transactionTypeFilter;
      const propertyMatch = transactionPropertyFilter === 'all' || t.propertyId === transactionPropertyFilter;
      return typeMatch && propertyMatch;
    });
  }, [transactions, transactionTypeFilter, transactionPropertyFilter]);

  // ========== RETURN CONTEXT VALUE ==========
  return {
    // Data
    transactions,
    financialViewMode,
    transactionTypeFilter,
    transactionPropertyFilter,
    showAddTransactionModal,

    // Transaction operations
    addTransaction,
    updateTransaction,
    deleteTransaction,

    // Aggregation helpers
    getTotalIncome,
    getTotalExpenses,
    getProfit,
    getMonthlyBreakdown,
    getPropertyBreakdown,
    getFilteredTransactions,

    // Setters for UI state
    setFinancialViewMode,
    setTransactionTypeFilter,
    setTransactionPropertyFilter,
    setShowAddTransactionModal,

    // Setters for loading data from Firebase
    setTransactions,

    // Utilities
    showToast,
  };
};

export default useFinancials;
