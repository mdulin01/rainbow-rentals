import { useState, useCallback, useRef } from 'react';

/**
 * Get the last day of a given month.
 */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Format a month string like "2026-02" from year and month (1-indexed).
 */
function toMonthStr(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Subtract N months from a given year/month. Returns { year, month } (month is 1-indexed).
 */
function subtractMonths(year, month, n) {
  let m = month - n;
  let y = year;
  while (m < 1) { m += 12; y--; }
  return { year: y, month: m };
}

/**
 * Check if a given month matches the recurring frequency schedule.
 * For monthly: every month qualifies.
 * For quarterly: months that are 0, 3, 6, 9 months from the template's start month.
 * For annually: only the same month as the template's start month.
 */
function monthMatchesFrequency(targetYear, targetMonth, frequency, startMonth) {
  if (frequency === 'monthly') return true;
  if (frequency === 'quarterly') {
    const diff = ((targetMonth - startMonth) % 3 + 3) % 3;
    return diff === 0;
  }
  if (frequency === 'annually') {
    return targetMonth === startMonth;
  }
  return false;
}

/**
 * Auto-create recurring expense instances from templates.
 * Checks current month and backfills up to 2 prior months.
 * Returns array of new expense objects to add. Does not mutate input.
 */
export function autoCreateRecurringExpenses(expenses) {
  const templates = expenses.filter(e => e.isTemplate === true);
  if (templates.length === 0) return [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  const newExpenses = [];

  templates.forEach(template => {
    const dueDay = template.dueDay || 1;
    const frequency = template.recurringFrequency || 'monthly';
    // Determine start month for quarterly/annually — use the month the template was created
    const createdDate = template.createdAt ? new Date(template.createdAt) : now;
    const startMonth = createdDate.getMonth() + 1;

    // Check current month and 2 prior months
    for (let offset = 0; offset < 3; offset++) {
      const { year: tYear, month: tMonth } = subtractMonths(currentYear, currentMonth, offset);
      const monthStr = toMonthStr(tYear, tMonth);

      // Skip if this month doesn't match the frequency schedule
      if (!monthMatchesFrequency(tYear, tMonth, frequency, startMonth)) continue;

      // Skip if instance already exists for this template + month
      const exists = expenses.some(e =>
        e.generatedFromTemplate === template.id && e.generatedForMonth === monthStr
      );
      if (exists) continue;

      // Don't generate for months before the template was created
      const templateCreatedMonth = toMonthStr(createdDate.getFullYear(), createdDate.getMonth() + 1);
      if (monthStr < templateCreatedMonth) continue;

      // Calculate actual due date, capping dueDay to last day of month
      const maxDay = daysInMonth(tYear, tMonth);
      const actualDay = Math.min(dueDay, maxDay);
      const dateStr = `${tYear}-${String(tMonth).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;

      newExpenses.push({
        id: `${Date.now()}-${template.id}-${monthStr}`,
        createdAt: new Date().toISOString(),
        createdBy: 'System (auto-generated)',
        propertyId: template.propertyId || '',
        propertyName: template.propertyName || '',
        category: template.category || 'other',
        description: template.description || '',
        amount: template.amount || 0,
        date: dateStr,
        vendor: template.vendor || '',
        notes: template.notes || '',
        receiptPhoto: '',
        recurring: false,
        isTemplate: false,
        generatedFromTemplate: template.id,
        generatedForMonth: monthStr,
      });
    }
  });

  return newExpenses;
}

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
