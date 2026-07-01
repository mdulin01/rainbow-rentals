import { useState, useCallback, useRef } from 'react';

/**
 * useOwnership Hook
 * Manages investor/partner ownership stakes in the rental portfolio
 * (e.g. a family member who contributed cash toward a property purchase).
 *
 * Each investor record stores a FIXED historical anchor:
 *   contributionAmount         — cash they put in
 *   contributionDate           — when they put it in
 *   equityBasisAtContribution  — total portfolio equity at that moment (the denominator)
 *
 * Their ownership % = contributionAmount / equityBasisAtContribution, fixed forever.
 * Their current stake value is computed LIVE elsewhere (OwnershipView) from
 * today's property values/mortgage balances, so it grows/shrinks with the portfolio
 * without ever needing to re-enter data here.
 */
export const useOwnership = (currentUser, saveOwnership, showToast) => {
  const saveRef = useRef(saveOwnership);
  saveRef.current = saveOwnership;

  const [investors, setInvestors] = useState([]);
  const [showInvestorModal, setShowInvestorModal] = useState(null);

  const addInvestor = useCallback((investor) => {
    setInvestors(prev => {
      const newInvestors = [...prev, investor];
      saveRef.current(newInvestors);
      return newInvestors;
    });
    showToast('Investor stake added', 'success');
  }, [showToast]);

  const updateInvestor = useCallback((investorId, updates) => {
    setInvestors(prev => {
      const newInvestors = prev.map(inv => {
        if (String(inv.id) === String(investorId)) {
          const resolved = typeof updates === 'function' ? updates(inv) : updates;
          return { ...inv, ...resolved };
        }
        return inv;
      });
      saveRef.current(newInvestors);
      return newInvestors;
    });
    showToast('Investor stake updated', 'success');
  }, [showToast]);

  const deleteInvestor = useCallback((investorId) => {
    setInvestors(prev => {
      const newInvestors = prev.filter(inv => String(inv.id) !== String(investorId));
      saveRef.current(newInvestors);
      return newInvestors;
    });
    showToast('Investor stake removed', 'info');
  }, [showToast]);

  return {
    investors,
    setInvestors,
    showInvestorModal,
    setShowInvestorModal,
    addInvestor,
    updateInvestor,
    deleteInvestor,
  };
};

export default useOwnership;
