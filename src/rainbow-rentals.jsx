import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Search, LogOut, User, Loader, MoreVertical, ChevronDown, Edit3, Trash2, Eye, DollarSign, MapPin, Calendar, FileText, CheckSquare } from 'lucide-react';

// Constants and utilities
import {
  ownerEmails, propertyAccess, propertyTypes, propertyColors, documentTypes,
  expenseCategories, incomeCategories, taskPriorities, timeHorizons,
  listCategories, ideaCategories, tenantStatuses, rentStatuses
} from './constants';
import {
  formatDate, formatCurrency, validateFileSize, isHeicFile, getSafeFileName,
  isTaskDueToday, isTaskDueThisWeek, taskMatchesHorizon, getDaysUntil, getLeaseStatus, todayLocalStr
} from './utils';

// Components
import LoginScreen from './components/LoginScreen';
import RupertBanner from './components/RupertBanner';
import ConfirmDialog from './components/ConfirmDialog';

// Hub components (tasks still used on Dashboard)
import AddTaskModal from './components/SharedHub/AddTaskModal';
import SharedListModal from './components/SharedHub/SharedListModal';
import AddIdeaModal from './components/SharedHub/AddIdeaModal';
import TaskCard from './components/SharedHub/TaskCard';
import ListCard from './components/SharedHub/ListCard';
import IdeaCard from './components/SharedHub/IdeaCard';

// Checklist components
import ChecklistInitModal from './components/Checklists/ChecklistInitModal';
import ChecklistDetailModal from './components/Checklists/ChecklistDetailModal';

// Rentals components
import PropertyCard from './components/Rentals/PropertyCard';
import NewPropertyModal from './components/Rentals/NewPropertyModal';
import PropertyDetail from './components/Rentals/PropertyDetail';
import PropertyFinancialBreakdownModal from './components/Rentals/PropertyFinancialBreakdownModal';
import TenantModal from './components/Rentals/TenantModal';

// Ownership components
import OwnershipView from './components/Ownership/OwnershipView';
import InvestorModal from './components/Ownership/InvestorModal';

// Tenants components
import TenantsList from './components/Tenants/TenantsList';

// Rent components
import RentLedger from './components/Rent/RentLedger';
import AddRentPaymentModal from './components/Rent/AddRentPaymentModal';
import RentReconciliation from './components/Rent/RentReconciliation';

// Expenses components
import ExpensesList from './components/Expenses/ExpensesList';
import AddExpenseModal from './components/Expenses/AddExpenseModal';
import CardInbox from './components/Expenses/CardInbox';

// Documents components
import DocumentCard from './components/Documents/DocumentCard';
import AddDocumentModal from './components/Documents/AddDocumentModal';
import DocumentViewer from './components/Documents/DocumentViewer';

// Financials components (kept for backward compat)
import TransactionCard from './components/Financials/TransactionCard';
import AddTransactionModal from './components/Financials/AddTransactionModal';
import FinancialSummary from './components/Financials/FinancialSummary';

// Hooks
import { useSharedHub } from './hooks/useSharedHub';
import { useProperties, getPropertyTenants } from './hooks/useProperties';
import { useDocuments } from './hooks/useDocuments';
import { useFinancials } from './hooks/useFinancials';
import { useRent } from './hooks/useRent';
import { useExpenses, autoCreateRecurringExpenses, sanitizeForFirestore } from './hooks/useExpenses';
import { useOwnership } from './hooks/useOwnership';

// Contexts
import { SharedHubProvider } from './contexts/SharedHubContext';
import BuildInfo from './components/BuildInfo';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, onSnapshot, runTransaction, arrayUnion } from 'firebase/firestore';
import { requestPushToken } from './messaging';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import heic2any from 'heic2any';

// Import Firebase config
import { firebaseConfig } from './firebase-config';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Rainbow bar
const RainbowBar = () => (
  <div className="h-1 w-full bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500" />
);


export default function RainbowRentals() {
  // ========== AUTH STATE ==========
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    if (!isMountedRef.current) return;
    setToast({ message, type });
    setTimeout(() => { if (isMountedRef.current) setToast(null); }, 4000);
  }, []);

  // ========== NAVIGATION ==========
  const [activeSection, setActiveSection] = useState('action-items');
  const [currentUser, setCurrentUser] = useState('Mike');
  const [isOwner, setIsOwner] = useState(false);
  const [showAddNewMenu, setShowAddNewMenu] = useState(false);
  const [showMobileSectionDropdown, setShowMobileSectionDropdown] = useState(false);
  const [dashboardReportMonth, setDashboardReportMonth] = useState(null); // null = current month, 0-11 = specific month, 12 = YTD
  const [weeklySentAt, setWeeklySentAt] = useState(null); // Liam's 'Done & send' for this week
  const [pushState, setPushState] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [availChecked, setAvailChecked] = useState(false); // Liam's weekly 'updated rents in Avail' tick
  const [incomeActuals, setIncomeActuals] = useState(null); // bank deposits from mikesmoney (rupert bridge)
  const [cardInbox, setCardInbox] = useState(null); // Citi •4793 charges to confirm (rupert bridge)
  const [handledInboxIds, setHandledInboxIds] = useState([]); // optimistic hide after confirm/dismiss
  const [expenseReviewItems, setExpenseReviewItems] = useState([]); // Liam-named bank txns + Mike's rental-tagged (mikes-money push)
  const [dashboardReportYear, setDashboardReportYear] = useState(new Date().getFullYear());
  const enableAlerts = async () => {
    const r = await requestPushToken();
    if (r.ok && user) {
      try {
        await setDoc(doc(db, 'pushTokens', user.uid), { uid: user.uid, email: user.email || '', token: r.token, updatedAt: new Date().toISOString() }, { merge: true });
        setPushState('granted');
        showToast && showToast('Alerts on for this device 🔔', 'success');
      } catch (e) { showToast && showToast('Token save failed: ' + e.message, 'error'); }
    } else { showToast && showToast('Could not enable alerts: ' + (r.reason || 'error'), 'error'); }
  };

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState(null);

  // ========== HOOK REFS ==========
  const saveSharedHubRef = useRef(() => {});
  const savePropertiesRef = useRef(() => {});
  const saveDocumentsRef = useRef(() => {});
  const saveFinancialsRef = useRef(() => {});
  const saveRentRef = useRef(() => {});
  const saveOwnershipRef = useRef(() => {});
  const expensesSaveIdRef = useRef(null); // Track our own saves to avoid onSnapshot overwrite

  // ========== HOOKS ==========
  const sharedHub = useSharedHub(currentUser, saveSharedHubRef.current, showToast);
  const {
    sharedTasks: _allTasks, sharedLists: _allLists, sharedIdeas,
    addTask, updateTask, deleteTask, completeTask, highlightTask,
    addList, updateList, deleteList, addListItem, toggleListItem, deleteListItem, highlightList,
    addIdea, updateIdea, deleteIdea, highlightIdea,
    hubSubView, setHubSubView, hubTaskFilter, setHubTaskFilter, hubTaskSort, setHubTaskSort,
    hubListFilter, setHubListFilter, hubIdeaFilter, setHubIdeaFilter, hubIdeaStatusFilter, setHubIdeaStatusFilter,
    collapsedSections, toggleDashSection,
    setSharedTasks, setSharedLists, setSharedIdeas,
    showAddTaskModal, setShowAddTaskModal,
    showSharedListModal, setShowSharedListModal,
    showAddIdeaModal, setShowAddIdeaModal,
  } = sharedHub;

  const propertiesHook = useProperties(currentUser, savePropertiesRef.current, showToast);
  const {
    properties: _allProperties, setProperties,
    selectedProperty, setSelectedProperty,
    propertyViewMode, setPropertyViewMode,
    showNewPropertyModal, setShowNewPropertyModal,
    showTenantModal, setShowTenantModal,
    addProperty: _addProperty, updateProperty: _updateProperty, deleteProperty: _deleteProperty,
    addOrUpdateTenant: _addOrUpdateTenant, removeTenant: _removeTenant,
  } = propertiesHook;

  const documentsHook = useDocuments(currentUser, saveDocumentsRef.current, showToast);
  const {
    documents: _allDocuments, setDocuments,
    documentViewMode, setDocumentViewMode,
    documentTypeFilter, setDocumentTypeFilter,
    documentPropertyFilter, setDocumentPropertyFilter,
    showAddDocumentModal, setShowAddDocumentModal,
    addDocument: _addDocument, updateDocument: _updateDocument, deleteDocument: _deleteDocument,
  } = documentsHook;

  const financialsHook = useFinancials(currentUser, saveFinancialsRef.current, showToast);
  const {
    transactions: _allTxns, setTransactions,
    financialViewMode, setFinancialViewMode,
    transactionTypeFilter, setTransactionTypeFilter,
    transactionPropertyFilter, setTransactionPropertyFilter,
    showAddTransactionModal, setShowAddTransactionModal,
    addTransaction: _addTransaction, updateTransaction: _updateTransaction, deleteTransaction: _deleteTransaction,
    getTotalIncome, getTotalExpenses, getProfit, getMonthlyBreakdown, getPropertyBreakdown, getFilteredTransactions,
  } = financialsHook;

  const rentHook = useRent(currentUser, saveRentRef.current, showToast);
  const {
    rentPayments: _allRent, setRentPayments,
    showAddRentModal, setShowAddRentModal,
    addRentPayment: _addRentPayment, updateRentPayment: _updateRentPayment, deleteRentPayment: _deleteRentPayment,
  } = rentHook;

  // Pass db directly — hook saves to Firestore internally, no ref indirection
  const expensesHook = useExpenses(db, currentUser, showToast);
  const {
    expenses: _allExpenses, setExpenses,
    showAddExpenseModal, setShowAddExpenseModal,
    addExpense: _addExpense, updateExpense: _updateExpense, deleteExpense: _deleteExpense,
  } = expensesHook;

  // ---- Per-property owner access (e.g. Adam → only Brookhurst). Single choke-point:
  // every downstream `properties/rentPayments/expenses/documents/transactions/sharedTasks`
  // is the filtered view for a restricted owner; full managers (no match) see everything. ----
  const _accessMatch = propertyAccess[(user?.email || '').toLowerCase()];
  const canManage = !_accessMatch; // Mike/Liam can edit rents/leases/expenses; restricted owners can't
  const _match = (p) => `${p.name || ''} ${p.address || ''}`.toLowerCase().includes(_accessMatch);
  const properties = _accessMatch ? _allProperties.filter(_match) : _allProperties;
  const _visibleIds = new Set(properties.map((p) => String(p.id)));
  const _inScope = (pid) => _visibleIds.has(String(pid));
  const rentPayments = _accessMatch ? _allRent.filter((r) => _inScope(r.propertyId)) : _allRent;
  const expenses = _accessMatch ? _allExpenses.filter((e) => _inScope(e.propertyId)) : _allExpenses;
  const documents = _accessMatch ? _allDocuments.filter((d) => _inScope(d.propertyId)) : _allDocuments;
  const transactions = _accessMatch ? _allTxns.filter((t) => _inScope(t.propertyId)) : _allTxns;
  const sharedTasks = _accessMatch ? _allTasks.filter((t) => _inScope(t.linkedTo?.propertyId)) : _allTasks;
  const sharedLists = _accessMatch ? _allLists.filter((l) => _inScope(l.linkedTo?.itemId)) : _allLists;

  const ownershipHook = useOwnership(currentUser, saveOwnershipRef.current, showToast);
  const {
    investors, setInvestors,
    showInvestorModal, setShowInvestorModal,
    addInvestor, updateInvestor, deleteInvestor,
  } = ownershipHook;

  // ========== ACTIVITY LOG + SOFT-DELETE (trash) ==========
  // rentalData/activity — append-only who/what/when (capped 300); powers the
  // "This week" digest and gives the two-operator setup an audit trail.
  // rentalData/trash — deleted items park here first (capped 100) with one-tap Restore.
  const [activityEvents, setActivityEvents] = useState([]);
  const [trashItems, setTrashItems] = useState([]);
  const activityRef = useRef([]);
  useEffect(() => { activityRef.current = activityEvents; }, [activityEvents]);
  const trashRef = useRef([]);
  useEffect(() => { trashRef.current = trashItems; }, [trashItems]);

  const logActivity = useCallback(async (action, detail) => {
    if (!user) return;
    const ev = { at: new Date().toISOString(), by: currentUser || 'unknown', action, detail: String(detail || '').slice(0, 120) };
    const next = [ev, ...activityRef.current].slice(0, 300);
    setActivityEvents(next);
    try { await setDoc(doc(db, 'rentalData', 'activity'), JSON.parse(JSON.stringify({ events: next, lastUpdated: ev.at })), { merge: true }); }
    catch (e) { console.error('activity save:', e); }
  }, [user, currentUser]);

  const trashItem = useCallback(async (type, payload) => {
    if (!user || !payload) return;
    const item = { trashId: `${type}-${Date.now()}`, type, payload, deletedBy: currentUser || 'unknown', deletedAt: new Date().toISOString() };
    const next = [item, ...trashRef.current].slice(0, 100);
    setTrashItems(next);
    try { await setDoc(doc(db, 'rentalData', 'trash'), JSON.parse(JSON.stringify({ items: next, lastUpdated: item.deletedAt })), { merge: true }); }
    catch (e) { console.error('trash save:', e); }
  }, [user, currentUser]);

  const removeFromTrash = useCallback(async (trashId) => {
    const next = trashRef.current.filter(i => i.trashId !== trashId);
    setTrashItems(next);
    try { await setDoc(doc(db, 'rentalData', 'trash'), JSON.parse(JSON.stringify({ items: next, lastUpdated: new Date().toISOString() })), { merge: true }); }
    catch (e) { console.error('trash save:', e); }
  }, []);

  // Wrapped CRUD: adds/updates log activity; deletes archive to trash first.
  const addRentPayment = useCallback((p) => { _addRentPayment(p); logActivity('rent.add', `${p.propertyName || ''} ${p.month || ''} $${p.amount}`); }, [_addRentPayment, logActivity]);
  const updateRentPayment = useCallback((id, u) => { _updateRentPayment(id, u); const it = rentPayments.find(r => r.id === id); logActivity('rent.update', `${it?.propertyName || id}${u.status ? ' → ' + u.status : ''}`); }, [_updateRentPayment, logActivity, rentPayments]);
  const deleteRentPayment = useCallback((id) => { const it = rentPayments.find(r => r.id === id); if (it) trashItem('rent', it); _deleteRentPayment(id); logActivity('rent.delete', `${it?.propertyName || ''} ${it?.month || ''} $${it?.amount || ''}`); }, [_deleteRentPayment, rentPayments, trashItem, logActivity]);
  const addExpense = useCallback((e) => { _addExpense(e); logActivity('expense.add', `${e.description || e.category} $${e.amount}`); }, [_addExpense, logActivity]);
  const updateExpense = useCallback((id, u) => { _updateExpense(id, u); const it = expenses.find(x => x.id === id); logActivity('expense.update', it?.description || id); }, [_updateExpense, logActivity, expenses]);
  const deleteExpense = useCallback((id) => { const it = expenses.find(x => x.id === id); if (it) trashItem('expense', it); _deleteExpense(id); logActivity('expense.delete', `${it?.description || ''} $${it?.amount || ''}`); }, [_deleteExpense, expenses, trashItem, logActivity]);
  const addProperty = useCallback((p) => { _addProperty(p); logActivity('property.add', p.name); }, [_addProperty, logActivity]);
  const updateProperty = useCallback((id, u) => { _updateProperty(id, u); const it = properties.find(x => String(x.id) === String(id)); logActivity('property.update', it?.name || id); }, [_updateProperty, logActivity, properties]);
  const deleteProperty = useCallback((id) => { const it = properties.find(x => String(x.id) === String(id)); if (it) trashItem('property', it); _deleteProperty(id); logActivity('property.delete', it?.name || id); }, [_deleteProperty, properties, trashItem, logActivity]);
  const addOrUpdateTenant = useCallback((pid, t) => { _addOrUpdateTenant(pid, t); const p = properties.find(x => String(x.id) === String(pid)); logActivity('tenant.save', `${t?.name || ''} @ ${p?.name || pid}`); }, [_addOrUpdateTenant, logActivity, properties]);
  const removeTenant = useCallback((pid, tid) => { _removeTenant(pid, tid); const p = properties.find(x => String(x.id) === String(pid)); logActivity('tenant.remove', p?.name || pid); }, [_removeTenant, logActivity, properties]);
  const addDocument = useCallback((d) => { _addDocument(d); logActivity('document.add', d.name || d.type); }, [_addDocument, logActivity]);
  const updateDocument = useCallback((id, u) => { _updateDocument(id, u); logActivity('document.update', id); }, [_updateDocument, logActivity]);
  const deleteDocument = useCallback((id) => { const it = documents.find(x => x.id === id); if (it) { const { fileData, ...meta } = it; trashItem('document', it.fileData && String(it.fileData).length > 400000 ? meta : it); } _deleteDocument(id); logActivity('document.delete', it?.name || id); }, [_deleteDocument, documents, trashItem, logActivity]);
  const addTransaction = useCallback((t) => { _addTransaction(t); logActivity('transaction.add', `${t.description || t.type} $${t.amount}`); }, [_addTransaction, logActivity]);
  const updateTransaction = useCallback((id, u) => { _updateTransaction(id, u); logActivity('transaction.update', id); }, [_updateTransaction, logActivity]);
  const deleteTransaction = useCallback((id) => { const it = transactions.find(x => x.id === id); if (it) trashItem('transaction', it); _deleteTransaction(id); logActivity('transaction.delete', `${it?.description || ''} $${it?.amount || ''}`); }, [_deleteTransaction, transactions, trashItem, logActivity]);

  const restoreTrashItem = useCallback((item) => {
    const p = item.payload || {};
    if (item.type === 'rent') _addRentPayment(p);
    else if (item.type === 'expense') _addExpense(p);
    else if (item.type === 'property') _addProperty(p);
    else if (item.type === 'document') _addDocument(p);
    else if (item.type === 'transaction') _addTransaction(p);
    removeFromTrash(item.trashId);
    logActivity('restore', `${item.type}: ${p.name || p.description || p.propertyName || ''}`);
  }, [_addRentPayment, _addExpense, _addProperty, _addDocument, _addTransaction, removeFromTrash, logActivity]);

  // ========== EXPORT + WEEKLY AUTO-BACKUP ==========
  const buildExportPayload = useCallback(() => ({
    exportedAt: new Date().toISOString(), exportedBy: currentUser || 'unknown',
    properties: _allProperties, rentPayments: _allRent, expenses: _allExpenses,
    transactions: _allTxns, documentsIndex: _allDocuments.map(({ fileData, ...meta }) => meta),
    investors, sharedTasks: _allTasks, sharedLists: _allLists, sharedIdeas,
  }), [currentUser, _allProperties, _allRent, _allExpenses, _allTxns, _allDocuments, investors, _allTasks, _allLists, sharedIdeas]);

  const exportAllData = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildExportPayload(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rainbow-reality-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    logActivity('export', 'full JSON export downloaded');
    showToast('Export downloaded', 'success');
  }, [buildExportPayload, logActivity, showToast]);

  // Weekly snapshot into rentalData/backup-YYYY-MM-DD (keeps last 8) — runs on app
  // open when the last backup is >6.5 days old. Client-side so no extra infra.
  useEffect(() => {
    if (!user || dataLoading || !canManage) return;
    (async () => {
      try {
        const metaSnap = await getDoc(doc(db, 'rentalData', 'backupMeta'));
        const meta = metaSnap.exists() ? metaSnap.data() : {};
        if (meta.lastAt && (Date.now() - new Date(meta.lastAt).getTime()) < 6.5 * 86400000) return;
        const dateStr = new Date().toISOString().slice(0, 10);
        await setDoc(doc(db, 'rentalData', `backup-${dateStr}`), {
          json: JSON.stringify(buildExportPayload()), at: new Date().toISOString(), by: currentUser || 'auto',
        });
        const dates = [...new Set([...(meta.dates || []), dateStr])].sort();
        for (const d of dates.slice(0, Math.max(0, dates.length - 8))) {
          try { await deleteDoc(doc(db, 'rentalData', `backup-${d}`)); } catch { /* ignore */ }
        }
        await setDoc(doc(db, 'rentalData', 'backupMeta'), { lastAt: new Date().toISOString(), dates: dates.slice(-8) });
        console.log('[backup] weekly snapshot written:', dateStr);
      } catch (e) { console.error('backup:', e); }
    })();
  }, [user, dataLoading, canManage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Property financial breakdown modal
  const [showPropertyBreakdown, setShowPropertyBreakdown] = useState(false);

  // Document viewer
  const [viewingDocument, setViewingDocument] = useState(null);

  // Checklist modals
  const [showChecklistInitModal, setShowChecklistInitModal] = useState(null);
  const [showChecklistDetailModal, setShowChecklistDetailModal] = useState(null);

  // ========== AUTH ==========
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMountedRef.current) return;
      if (firebaseUser) {
        setUser(firebaseUser);
        const userEmail = firebaseUser.email?.toLowerCase();
        // EXACT email match — the loose substring match could false-positive
        // (rules enforce server-side either way; this is the UI gate).
        const isOwnerUser = ownerEmails.includes(userEmail);
        setIsOwner(isOwnerUser);
        if (isOwnerUser) {
          const displayName = userEmail?.includes('mdulin') ? 'Mike' : userEmail?.includes('adam') ? 'Adam' : 'Liam';
          setCurrentUser(displayName);
        }
      } else {
        setUser(null);
        setIsOwner(false);
      }
      if (isMountedRef.current) setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        showToast('Login failed. Please try again.', 'error');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      showToast('Logout failed', 'error');
    }
  };

  // ========== FIRESTORE SAVE FUNCTIONS ==========
  const hubDataLoadedRef = useRef(false);

  const saveSharedHub = useCallback(async (newLists, newTasks, newIdeas) => {
    if (!user) return;
    if (!hubDataLoadedRef.current) return;
    try {
      const updates = { lastUpdated: new Date().toISOString(), updatedBy: currentUser || 'unknown' };
      if (newLists !== null && newLists !== undefined) updates.lists = newLists;
      if (newTasks !== null && newTasks !== undefined) updates.tasks = newTasks;
      if (newIdeas !== null && newIdeas !== undefined) updates.ideas = newIdeas;
      await setDoc(doc(db, 'rentalData', 'sharedHub'), JSON.parse(JSON.stringify(updates)), { merge: true });
    } catch (error) {
      console.error('Error saving shared hub:', error);
      showToast('Failed to save. Please try again.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveSharedHubRef.current = saveSharedHub; }, [saveSharedHub]);

  const savePropertiesToFirestore = useCallback(async (newProperties) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'rentalData', 'properties'), JSON.parse(JSON.stringify({
        properties: newProperties,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser || 'unknown'
      })), { merge: true });
    } catch (error) {
      console.error('Error saving properties:', error);
      showToast('Failed to save property data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { savePropertiesRef.current = savePropertiesToFirestore; }, [savePropertiesToFirestore]);

  const saveDocumentsToFirestore = useCallback(async (newDocuments) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'rentalData', 'documents'), JSON.parse(JSON.stringify({
        documents: newDocuments,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser || 'unknown'
      })), { merge: true });
    } catch (error) {
      console.error('Error saving documents:', error);
      showToast('Failed to save document data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveDocumentsRef.current = saveDocumentsToFirestore; }, [saveDocumentsToFirestore]);

  const saveFinancialsToFirestore = useCallback(async (newTransactions) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'rentalData', 'financials'), JSON.parse(JSON.stringify({
        transactions: newTransactions,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser || 'unknown'
      })), { merge: true });
    } catch (error) {
      console.error('Error saving financials:', error);
      showToast('Failed to save financial data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveFinancialsRef.current = saveFinancialsToFirestore; }, [saveFinancialsToFirestore]);

  const saveRentToFirestore = useCallback(async (newRentPayments) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'rentalData', 'rent'), JSON.parse(JSON.stringify({
        payments: newRentPayments,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser || 'unknown'
      })), { merge: true });
    } catch (error) {
      console.error('Error saving rent data:', error);
      showToast('Failed to save rent data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveRentRef.current = saveRentToFirestore; }, [saveRentToFirestore]);

  const saveOwnershipToFirestore = useCallback(async (newInvestors) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'rentalData', 'ownership'), JSON.parse(JSON.stringify({
        investors: newInvestors,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser || 'unknown'
      })), { merge: true });
    } catch (error) {
      console.error('Error saving ownership data:', error);
      showToast('Failed to save ownership data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveOwnershipRef.current = saveOwnershipToFirestore; }, [saveOwnershipToFirestore]);

  // NOTE: Expense saving is now handled directly inside the useExpenses hook.
  // No more saveExpensesRef indirection — the hook calls setDoc internally.

  // ========== FIRESTORE LOAD (onSnapshot) ==========
  useEffect(() => {
    if (!user) return;
    setDataLoading(true);

    // Subscribe to shared hub
    const hubUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'sharedHub'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.tasks) setSharedTasks(data.tasks);
          if (data.lists) setSharedLists(data.lists);
          if (data.ideas) setSharedIdeas(data.ideas);
        }
        hubDataLoadedRef.current = true;
        setDataLoading(false);
      },
      (error) => {
        console.error('Error loading hub data:', error);
        setDataLoading(false);
      }
    );

    // Subscribe to properties
    const propertiesUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'properties'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.properties) setProperties(data.properties);
        }
      },
      (error) => console.error('Error loading properties:', error)
    );

    // Subscribe to documents
    const documentsUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'documents'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.documents) setDocuments(data.documents);
        }
      },
      (error) => console.error('Error loading documents:', error)
    );

    // Subscribe to financials
    const financialsUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'financials'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.transactions) setTransactions(data.transactions);
        }
      },
      (error) => console.error('Error loading financials:', error)
    );

    // Subscribe to rent payments
    const rentUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'rent'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.payments) setRentPayments(data.payments);
        }
      },
      (error) => console.error('Error loading rent data:', error)
    );

    // Subscribe to expenses
    const expensesUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'expenses'),
      (docSnap) => {
        console.log('[expenses] onSnapshot fired, exists:', docSnap.exists());
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('[expenses] onSnapshot data: saveId=', data.saveId, 'expenses count=', data.expenses?.length || 0);
          // If this snapshot was triggered by our own save, skip to avoid overwriting local state
          if (data.saveId && data.saveId === expensesSaveIdRef.current) {
            console.log('[expenses] Skipping onSnapshot from our own save');
            return;
          }
          if (data.expenses && data.expenses.length > 0) {
            console.log('[expenses] onSnapshot: applying', data.expenses.length, 'expenses to state');
            setExpenses(data.expenses);
          } else {
            console.warn('[expenses] onSnapshot: document exists but expenses is empty/missing');
          }
        } else {
          console.warn('[expenses] onSnapshot: document does NOT exist in Firestore!');
        }
      },
      (error) => console.error('[expenses] onSnapshot ERROR:', error)
    );

    // Subscribe to ownership/investor stakes
    const ownershipUnsubscribe = onSnapshot(
      doc(db, 'rentalData', 'ownership'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.investors) setInvestors(data.investors);
        }
      },
      (error) => console.error('Error loading ownership data:', error)
    );

    return () => {
      hubUnsubscribe();
      propertiesUnsubscribe();
      documentsUnsubscribe();
      financialsUnsubscribe();
      rentUnsubscribe();
      expensesUnsubscribe();
      ownershipUnsubscribe();
    };
  }, [user]);

  // Bank-deposit reconcile slice written by the mikeslife bridge cron.
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'rentalData', 'incomeActuals'),
      (snap) => { if (snap.exists()) setIncomeActuals(snap.data()); },
      (e) => console.error('incomeActuals load:', e));
    return () => unsub();
  }, [user]);

  // Citi •4793 confirm-inbox slice written by the mikeslife bridge cron.
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'rentalData', 'cardInbox'),
      (snap) => { if (snap.exists()) setCardInbox(snap.data()); },
      (e) => console.error('cardInbox load:', e));
    return () => unsub();
  }, [user]);

  // Expense-review queue pushed by mikes-money's Rentals page: outflows carrying
  // Liam's name (Cash App / ACH INDN) + anything Mike hand-tags class Rental.
  // Complements the Citi •4793 CardInbox (different source: checking/CC descriptors).
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'rentalData', 'expenseReview'),
      (snap) => { if (snap.exists()) setExpenseReviewItems(snap.data().items || []); },
      (e) => console.error('expenseReview load:', e));
    return () => unsub();
  }, [user]);

  // Activity log + trash subscriptions
  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(doc(db, 'rentalData', 'activity'),
      (snap) => { if (snap.exists()) setActivityEvents(snap.data().events || []); },
      (e) => console.error('activity load:', e));
    const u2 = onSnapshot(doc(db, 'rentalData', 'trash'),
      (snap) => { if (snap.exists()) setTrashItems(snap.data().items || []); },
      (e) => console.error('trash load:', e));
    return () => { u1(); u2(); };
  }, [user]);

  const resolveReviewItem = async (itemId, patch) => {
    const updated = expenseReviewItems.map(i => i.id === itemId
      ? { ...i, ...patch, resolvedAt: new Date().toISOString(), resolvedBy: currentUser || 'unknown' }
      : i);
    setExpenseReviewItems(updated);
    try {
      await setDoc(doc(db, 'rentalData', 'expenseReview'), JSON.parse(JSON.stringify({
        items: updated, lastUpdated: new Date().toISOString(), updatedBy: currentUser || 'unknown',
      })), { merge: true });
    } catch (e) { showToast && showToast('Sync issue: ' + e.message, 'error'); }
  };

  // Liam confirms a card charge → create a linked expense (the bridge tags the
  // mikesmoney txn on its next run; moneyTxnId prevents a duplicate).
  // Durably drop a charge from the inbox doc so it doesn't reappear on reload
  // before the next bridge run (which also reconciles via expense links / dismissed).
  const removeInboxItem = async (txnId, extra = {}) => {
    setHandledInboxIds((prev) => [...prev, txnId]);
    const remaining = (cardInbox?.items || []).filter((it) => it.txnId !== txnId);
    try { await setDoc(doc(db, 'rentalData', 'cardInbox'), { items: remaining, ...extra }, { merge: true }); }
    catch (e) { showToast && showToast('Sync issue: ' + e.message, 'error'); }
  };
  const confirmCardCharge = async (item, { propertyId, propertyName, category, reason }) => {
    addExpense({
      propertyId: propertyId || '',
      propertyName: propertyName || '',
      category: category || 'maintenance',
      description: reason || item.merchant || 'Card expense',
      amount: item.amount,
      date: item.date,
      vendor: item.merchant || '',
      notes: '',
      receiptPhoto: '',
      paidWith: 'citi',
      source: 'citi-4793',
      moneyTxnId: item.txnId,
      moneyMatch: 'matched',
    });
    await removeInboxItem(item.txnId);
  };
  const dismissCardCharge = async (item) => {
    await removeInboxItem(item.txnId, { dismissed: arrayUnion(item.txnId) });
  };

  // ========== AUTO-CREATE RECURRING EXPENSES ==========
  // Uses a Firestore TRANSACTION to atomically read-modify-write.
  // This eliminates the race condition where onSnapshot + setState + async save
  // could overwrite each other and lose data.
  const autoCreateDoneRef = useRef(false);
  useEffect(() => {
    if (!user || expenses.length === 0 || autoCreateDoneRef.current) return;
    const timer = setTimeout(async () => {
      if (autoCreateDoneRef.current) return;
      autoCreateDoneRef.current = true;

      try {
        const expensesDocRef = doc(db, 'rentalData', 'expenses');
        await runTransaction(db, async (transaction) => {
          // Read the ACTUAL Firestore data (not React state — avoids stale closures)
          const docSnap = await transaction.get(expensesDocRef);
          const data = docSnap.exists() ? docSnap.data() : {};
          const firestoreExpenses = data.expenses || [];

          console.log('[expenses] Auto-creation: read', firestoreExpenses.length, 'expenses from Firestore');

          const newExpenses = autoCreateRecurringExpenses(firestoreExpenses);
          if (newExpenses.length === 0) {
            console.log('[expenses] Auto-creation: no new expenses needed');
            return; // Nothing to do — transaction aborts cleanly
          }

          const updated = [...firestoreExpenses, ...newExpenses];
          const saveId = `${Date.now()}-auto`;
          expensesSaveIdRef.current = saveId;

          console.log('[expenses] Auto-creation: writing', updated.length, 'expenses (added', newExpenses.length, ')');

          const cleanUpdated = sanitizeForFirestore(updated);
          transaction.set(expensesDocRef, {
            expenses: cleanUpdated,
            lastUpdated: new Date().toISOString(),
            updatedBy: currentUser || 'unknown',
            saveId: saveId,
          }, { merge: true });

          // Update local state AFTER the transaction succeeds
          setExpenses(cleanUpdated);
          showToast(`Auto-created ${newExpenses.length} recurring expense(s)`, 'success');
        });
      } catch (error) {
        console.error('[expenses] Auto-creation transaction FAILED:', error);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [user, expenses.length > 0]);

  // ========== PHOTO UPLOAD HELPER ==========
  const uploadPhoto = async (file, prefix = 'rentals') => {
    let fileToUpload = file;
    let fileName = file.name || 'photo.jpg';

    if (isHeicFile(file)) {
      const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      fileToUpload = new File([convertedBlob], fileName.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' });
      fileName = fileToUpload.name;
    }

    const timestamp = Date.now();
    const safeName = getSafeFileName(fileName);
    const storageRef = ref(storage, `${prefix}/${timestamp}_${safeName}`);
    await uploadBytes(storageRef, fileToUpload);
    return await getDownloadURL(storageRef);
  };

  // ========== PROPERTY PHOTO UPLOAD ==========
  const [uploadingPropertyPhoto, setUploadingPropertyPhoto] = useState(null);

  const handlePropertyPhotoUpload = async (propertyId, file) => {
    if (!file) return;
    const sizeError = validateFileSize(file);
    if (sizeError) { showToast(sizeError, 'error'); return; }

    setUploadingPropertyPhoto(propertyId);
    try {
      const url = await uploadPhoto(file, 'rentals/properties');
      // Use updateProperty with functional update - it will work with latest state
      // No need to find property from stale closure
      updateProperty(propertyId, (currentProperty) => ({
        photos: [...(currentProperty.photos || []), { id: Date.now(), url, addedAt: new Date().toISOString() }],
      }));
      showToast('Photo added!', 'success');
    } catch (error) {
      console.error('Property photo upload failed:', error);
      showToast('Photo upload failed', 'error');
    } finally {
      setUploadingPropertyPhoto(null);
    }
  };

  // ========== DOCUMENT FILE UPLOAD ==========
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const handleDocumentFileUpload = async (file, docData) => {
    if (!file) return null;
    const sizeError = validateFileSize(file);
    if (sizeError) { showToast(sizeError, 'error'); return null; }

    setUploadingDocument(true);
    try {
      const url = await uploadPhoto(file, 'rentals/documents');
      return url;
    } catch (error) {
      console.error('Document upload failed:', error);
      showToast('File upload failed', 'error');
      return null;
    } finally {
      setUploadingDocument(false);
    }
  };

  // ========== PROMOTE IDEA TO TASK ==========
  const promoteIdeaToTask = (idea) => {
    setShowAddIdeaModal(null);
    setShowAddTaskModal({
      title: idea.title,
      description: idea.description || '',
      linkedTo: { section: 'idea', itemId: idea.id },
      _prefill: true,
    });
    updateIdea(idea.id, { status: 'planned' });
  };

  // ========== SEARCH ==========
  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results = [];

    sharedTasks.filter(t => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .forEach(t => results.push({ type: 'task', item: t, section: 'home' }));
    sharedLists.filter(l => l.title?.toLowerCase().includes(q))
      .forEach(l => results.push({ type: 'list', item: l, section: 'home' }));
    sharedIdeas.filter(i => i.title?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))
      .forEach(i => results.push({ type: 'idea', item: i, section: 'home' }));
    properties.filter(p => p.name?.toLowerCase().includes(q) || p.address?.street?.toLowerCase().includes(q) || getPropertyTenants(p).some(t => t.name?.toLowerCase().includes(q)))
      .forEach(p => results.push({ type: 'property', item: p, section: 'rentals' }));
    documents.filter(d => d.title?.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q))
      .forEach(d => results.push({ type: 'document', item: d, section: 'documents' }));
    transactions.filter(t => t.description?.toLowerCase().includes(q))
      .forEach(t => results.push({ type: 'transaction', item: t, section: 'financials' }));
    rentPayments.filter(r => (r.tenantName || '').toLowerCase().includes(q) || (r.propertyName || '').toLowerCase().includes(q) || (r.month || '').includes(q))
      .forEach(r => results.push({ type: 'rent', item: r, section: 'rent' }));
    expenses.filter(e => (e.description || '').toLowerCase().includes(q) || (e.vendor || '').toLowerCase().includes(q) || (e.propertyName || '').toLowerCase().includes(q))
      .forEach(e => results.push({ type: 'expense', item: e, section: 'expenses' }));

    return results;
  };

  // ========== HELPER: Get property name by ID ==========
  const getPropertyName = (propertyId) => {
    if (!propertyId) return null;
    const prop = properties.find(p => String(p.id) === String(propertyId));
    return prop ? prop.name : null;
  };

  // ========== RENDER ==========

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    );
  }

  // Login screen
  if (!user) {
    return <LoginScreen onLogin={handleGoogleLogin} loading={false} />;
  }

  // Signed in, but not on the allowlist — Firestore/Storage rules already block all
  // data server-side; this makes it explicit instead of a silently broken app.
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white/[0.04] border border-white/10 rounded-3xl p-8 text-center">
          <div className="text-5xl mb-4">🌈</div>
          <h1 className="text-xl font-bold text-white mb-2">This app is private</h1>
          <p className="text-sm text-white/50 mb-6">You're signed in as {user.email}, which doesn't have access to Rainbow Reality. Ask Michael if you think you should.</p>
          <button onClick={handleLogout} className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold">Sign out</button>
        </div>
      </div>
    );
  }

  // Check if any modal is open (to hide nav)
  const anyModalOpen = showAddTaskModal || showSharedListModal || showAddIdeaModal ||
    showNewPropertyModal || showTenantModal || showAddDocumentModal || showAddTransactionModal ||
    showAddRentModal || showAddExpenseModal || viewingDocument || selectedProperty ||
    showChecklistInitModal || showChecklistDetailModal || showInvestorModal;

  // Mobile section dropdown
  const allSections = [
    { id: 'action-items', label: 'Action Items', emoji: '✅' },
    { id: 'rentals', label: 'Properties', emoji: '🏠' },
    { id: 'tenants', label: 'Tenants', emoji: '👤' },
    { id: 'rent', label: 'Income', emoji: '💰' },
    { id: 'expenses', label: 'Expenses', emoji: '💸' },
    { id: 'reconcile', label: 'Reconcile', emoji: '⚖️' },
    { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
    { id: 'ownership', label: 'Ownership', emoji: '🤝' },
    { id: 'documents', label: 'Documents', emoji: '📄' },
  ];
  const activeSectionInfo = allSections.find(s => s.id === activeSection) || allSections[0];

  // Filter tasks for Hub dashboard
  const pendingTasks = sharedTasks.filter(t => t.status !== 'done');
  const todayTasks = pendingTasks.filter(isTaskDueToday);
  const overdueTasks = pendingTasks.filter(t => {
    if (!t.dueDate) return false;
    const today = todayLocalStr();
    return t.dueDate < today;
  });

  // Filter properties by status - use propertyStatus if set, otherwise derive from tenant
  const getEffectiveStatus = (p) => p.propertyStatus || (getPropertyTenants(p).length > 0 ? 'occupied' : 'vacant');
  // "owner-occupied" counts as occupied/rented for dashboard purposes
  const isOccupiedStatus = (s) => ['occupied', 'owner-occupied', 'lease-expired', 'month-to-month'].includes(s);
  const vacantProperties = properties.filter(p => getEffectiveStatus(p) === 'vacant');
  const renovationProperties = properties.filter(p => getEffectiveStatus(p) === 'renovation');
  const notCollectingRent = properties.filter(p => ['vacant', 'renovation'].includes(getEffectiveStatus(p)));
  const activeProperties = properties.filter(p => ['occupied', 'owner-occupied'].includes(getEffectiveStatus(p)));
  const leaseExpiredProperties = properties.filter(p => getEffectiveStatus(p) === 'lease-expired');
  const monthToMonthProperties = properties.filter(p => getEffectiveStatus(p) === 'month-to-month');

  // Properties with expiring leases (within 60 days, not already expired)
  const expiringLeases = properties.filter(p => {
    const tenants = getPropertyTenants(p);
    if (tenants.length === 0) return false;
    // Check if any tenant has a lease ending within 60 days
    return tenants.some(t => {
      if (!t.leaseEnd) return false;
      const end = new Date(t.leaseEnd + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 60;
    });
  });

  return (
    <SharedHubProvider value={sharedHub}>
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
        <RainbowBar />

        {/* Header */}
        <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-white/10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile: section name with dropdown */}
              <div className="md:hidden relative">
                <button
                  onClick={() => setShowMobileSectionDropdown(!showMobileSectionDropdown)}
                  className="flex items-center gap-2 px-1 py-1 rounded-lg transition active:scale-95"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-red-500 via-green-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                    <span className="text-xs font-bold text-white">RR</span>
                  </div>
                  <span className="text-lg font-bold text-white">{activeSectionInfo.emoji} {activeSectionInfo.label}</span>
                  <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${showMobileSectionDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showMobileSectionDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMobileSectionDropdown(false)} />
                    <div className="absolute top-full left-0 mt-2 z-50 bg-slate-800/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl min-w-[180px] py-1"
                      style={{ animation: 'dropdownIn 0.15s ease-out both' }}>
                      {allSections.map(section => (
                        <button
                          key={section.id}
                          onClick={() => {
                            setActiveSection(section.id);
                            if (section.id === 'rentals') { setSelectedProperty(null); setPropertyViewMode('grid'); }
                            setShowMobileSectionDropdown(false);
                            setShowAddNewMenu(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                            activeSection === section.id ? 'bg-white/10 text-white font-semibold' : 'text-white/70 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="text-base">{section.emoji}</span>
                          <span>{section.label}</span>
                        </button>
                      ))}
                    </div>
                    <style>{`@keyframes dropdownIn { from { opacity: 0; transform: translateY(-8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
                  </>
                )}
              </div>
              {/* Desktop: logo + title */}
              <div className="hidden md:flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-red-500 via-green-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-sm font-bold text-white">RR</span>
                </div>
                <h1 className="text-lg font-bold text-white leading-tight">Rainbow Reality</h1>
              </div>
              {/* Desktop nav tabs */}
              <nav className="hidden md:flex items-center gap-1 ml-6">
                {[
                  { id: 'action-items', label: 'Action Items', emoji: '✅' },
                  { id: 'rentals', label: 'Properties', emoji: '🏠' },
                  { id: 'tenants', label: 'Tenants', emoji: '👤' },
                  { id: 'rent', label: 'Income', emoji: '💰' },
                  { id: 'expenses', label: 'Expenses', emoji: '💸' },
                  { id: 'reconcile', label: 'Reconcile', emoji: '⚖️' },
                  { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
                  { id: 'ownership', label: 'Ownership', emoji: '🤝' },
                  { id: 'documents', label: 'Documents', emoji: '📄' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveSection(tab.id);
                      if (tab.id === 'rentals') { setSelectedProperty(null); setPropertyViewMode('grid'); }
                      setShowAddNewMenu(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                      activeSection === tab.id
                        ? 'bg-white/15 text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="mr-1.5">{tab.emoji}</span>{tab.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSearch(!showSearch)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                <Search className="w-4 h-4 text-white/60" />
              </button>
              <button onClick={handleLogout} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                <LogOut className="w-4 h-4 text-white/60" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div className="px-4 pb-3">
              <input
                type="text"
                placeholder="Search everything..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                autoFocus
              />
              {searchQuery && (
                <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                  {getSearchResults().map((result, i) => (
                    <button key={i} onClick={() => {
                      setActiveSection(result.section);
                      setShowSearch(false);
                      setSearchQuery('');
                      if (result.type === 'property') setSelectedProperty(result.item);
                      if (result.type === 'document') setViewingDocument(result.item);
                      if (result.type === 'task') setShowAddTaskModal(result.item);
                    }} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                      <span className="text-xs text-white/40 uppercase">{result.type}</span>
                      <p className="text-sm text-white truncate">{result.item.title || result.item.name || result.item.description}</p>
                    </button>
                  ))}
                  {getSearchResults().length === 0 && (
                    <p className="text-center text-white/40 text-sm py-4">No results found</p>
                  )}
                </div>
              )}
            </div>
          )}
        </header>

        <RupertBanner db={db} accent="#fb7185" />

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-4 pb-32">
          {dataLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="w-8 h-8 text-teal-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* ========== DASHBOARD SECTION ========== */}
              {activeSection === 'reconcile' && (
                <RentReconciliation
                  properties={properties}
                  rentPayments={rentPayments}
                  incomeActuals={incomeActuals}
                  getEffectiveStatus={getEffectiveStatus}
                  onRecordRent={(prop, monthKey, cell) => {
                    const shortfall = cell && cell.state === 'short' ? (cell.expected - cell.received) : null;
                    setShowAddRentModal({
                      incomeType: 'rent',
                      propertyId: prop.id,
                      propertyName: `${prop.emoji || '\u{1F3E0}'} ${prop.name}`,
                      tenantName: getPropertyTenants(prop).map(t => t.name).filter(Boolean).join(', '),
                      month: monthKey,
                      amount: shortfall != null ? shortfall : (parseFloat(prop.monthlyRent) || ''),
                      status: 'paid',
                    });
                  }}
                />
              )}

              {activeSection === 'dashboard' && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">Dashboard</h2>

                  {/* Monthly Report Table */}
                  {(() => {
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonthIdx = now.getMonth(); // 0-based
                    const reportYear = dashboardReportYear;
                    const isCurrentYear = reportYear === currentYear;
                    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

                    // State-like behavior using a data attribute on the container
                    // We'll use a simple approach: store selected month in a ref-like pattern
                    const reportMonth = dashboardReportMonth ?? (isCurrentYear ? currentMonthIdx : 12); // null = current month, 12 = YTD/full year
                    const isYTD = reportMonth === 12;
                    const selectedMonthLabel = isYTD ? (isCurrentYear ? `${reportYear} Year-to-Date` : `${reportYear} Full Year`) : `${monthNames[reportMonth]} ${reportYear}`;

                    // Build prefix filter for date matching
                    const getDateFilter = (monthIdx) => {
                      if (monthIdx === 12) return String(reportYear); // YTD / full year
                      return `${reportYear}-${String(monthIdx + 1).padStart(2, '0')}`;
                    };
                    const datePrefix = getDateFilter(reportMonth);

                    // Get expense categories to show as columns (group small ones into "Other")
                    const mainExpenseCats = ['mortgage','repair','maintenance','insurance','utilities','taxes','hoa','landscaping'];
                    const otherCats = expenseCategories.map(c => c.value).filter(v => !mainExpenseCats.includes(v));

                    // Per-property data
                    const propRows = properties.map(p => {
                      const pid = String(p.id);
                      // Income for this property
                      const income = rentPayments
                        .filter(r => String(r.propertyId) === pid && ['paid', 'partial', 'late'].includes(r.status) && (r.month || r.datePaid || '').startsWith(datePrefix))
                        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

                      // Expenses by category
                      const propExpenses = expenses.filter(e => !e.isTemplate && String(e.propertyId) === pid && (e.date || '').startsWith(datePrefix));
                      const expByCat = {};
                      let totalExp = 0;
                      mainExpenseCats.forEach(cat => {
                        const amt = propExpenses.filter(e => e.category === cat).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                        expByCat[cat] = amt;
                        totalExp += amt;
                      });
                      const otherAmt = propExpenses.filter(e => otherCats.includes(e.category)).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                      expByCat['other'] = otherAmt;
                      totalExp += otherAmt;

                      return { property: p, income, expByCat, totalExp, net: income - totalExp };
                    });

                    // General (no property) expenses
                    const generalExpenses = expenses.filter(e => !e.isTemplate && !e.propertyId && (e.date || '').startsWith(datePrefix));
                    const generalExpByCat = {};
                    let generalTotalExp = 0;
                    mainExpenseCats.forEach(cat => {
                      const amt = generalExpenses.filter(e => e.category === cat).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                      generalExpByCat[cat] = amt;
                      generalTotalExp += amt;
                    });
                    const generalOther = generalExpenses.filter(e => otherCats.includes(e.category)).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                    generalExpByCat['other'] = generalOther;
                    generalTotalExp += generalOther;

                    // General income (no property)
                    const generalIncome = rentPayments
                      .filter(r => !r.propertyId && ['paid', 'partial', 'late'].includes(r.status) && (r.month || r.datePaid || '').startsWith(datePrefix))
                      .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

                    // Totals
                    const totalIncome = propRows.reduce((s, r) => s + r.income, 0) + generalIncome;
                    const totalExpenses = propRows.reduce((s, r) => s + r.totalExp, 0) + generalTotalExp;
                    const totalNet = totalIncome - totalExpenses;

                    // Columns for expense categories
                    const expCols = [...mainExpenseCats, 'other'];
                    const expColLabels = {
                      mortgage: 'Mortgage', repair: 'Repairs', maintenance: 'Maint.', insurance: 'Insurance',
                      utilities: 'Utilities', taxes: 'Taxes', hoa: 'HOA', landscaping: 'Landscape', other: 'Other'
                    };

                    // Filter to only show columns that have data
                    const activeExpCols = expCols.filter(cat => {
                      const hasData = propRows.some(r => r.expByCat[cat] > 0) || (generalExpByCat[cat] > 0);
                      return hasData;
                    });

                    const fmtShort = (v) => v === 0 ? '—' : formatCurrency(v);

                    return (
                      <div id="pnl-print" className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-6">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                          <h3 className="text-base font-bold text-white">
                            P&amp;L Report <span className="font-normal text-white/50">— {selectedMonthLabel}</span>
                          </h3>
                          <div className="flex items-center gap-2 no-print">
                            <div className="flex items-center gap-1 bg-white/[0.06] rounded-lg px-1 py-0.5">
                              <button onClick={() => setDashboardReportYear((y) => Math.max(2020, y - 1))}
                                className="px-2 py-1 rounded text-white/70 hover:bg-white/10 text-sm">‹</button>
                              <span className="text-sm font-semibold text-white px-1 tabular-nums">{reportYear}</span>
                              <button onClick={() => setDashboardReportYear((y) => Math.min(currentYear, y + 1))}
                                disabled={reportYear >= currentYear}
                                className="px-2 py-1 rounded text-white/70 hover:bg-white/10 text-sm disabled:opacity-30">›</button>
                            </div>
                            <button onClick={() => window.print()}
                              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold">🖨 Print / PDF</button>
                          </div>
                        </div>

                        {/* Month tabs */}
                        <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                          {monthNames.map((m, idx) => (
                            <button key={m}
                              onClick={() => setDashboardReportMonth(idx)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                                reportMonth === idx
                                  ? 'bg-amber-500 text-slate-900'
                                  : (!isCurrentYear || idx <= currentMonthIdx)
                                    ? 'bg-white/[0.08] text-white/60 hover:bg-white/[0.12]'
                                    : 'bg-white/[0.03] text-white/25'
                              }`}
                            >{m}</button>
                          ))}
                          <button
                            onClick={() => setDashboardReportMonth(12)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                              reportMonth === 12
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-white/[0.08] text-white/60 hover:bg-white/[0.12]'
                            }`}
                          >YTD</button>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto -mx-4 px-4">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/[0.08]">
                                <th className="text-left text-white/40 font-semibold uppercase tracking-wider py-2 pr-3 whitespace-nowrap">Property</th>
                                <th className="text-right text-emerald-400/70 font-semibold uppercase tracking-wider py-2 px-2 whitespace-nowrap">Income</th>
                                {activeExpCols.map(cat => (
                                  <th key={cat} className="text-right text-red-400/60 font-semibold uppercase tracking-wider py-2 px-2 whitespace-nowrap">{expColLabels[cat]}</th>
                                ))}
                                <th className="text-right text-red-400/70 font-semibold uppercase tracking-wider py-2 px-2 whitespace-nowrap">Total Exp</th>
                                <th className="text-right text-white/50 font-semibold uppercase tracking-wider py-2 pl-2 whitespace-nowrap">Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {propRows.map(row => (
                                <tr key={row.property.id} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                                  <td className="py-2 pr-3 text-white/80 font-medium whitespace-nowrap">{row.property.emoji || '🏠'} {row.property.name}</td>
                                  <td className="py-2 px-2 text-right text-emerald-400 font-medium">{fmtShort(row.income)}</td>
                                  {activeExpCols.map(cat => (
                                    <td key={cat} className="py-2 px-2 text-right text-red-400/80">{fmtShort(row.expByCat[cat])}</td>
                                  ))}
                                  <td className="py-2 px-2 text-right text-red-400 font-medium">{fmtShort(row.totalExp)}</td>
                                  <td className={`py-2 pl-2 text-right font-bold ${row.net >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                                    {row.net === 0 ? '—' : `${row.net < 0 ? '-' : ''}${formatCurrency(Math.abs(row.net))}`}
                                  </td>
                                </tr>
                              ))}
                              {/* General row if there are unassigned expenses/income */}
                              {(generalTotalExp > 0 || generalIncome > 0) && (
                                <tr className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                                  <td className="py-2 pr-3 text-white/50 italic whitespace-nowrap">📋 General</td>
                                  <td className="py-2 px-2 text-right text-emerald-400 font-medium">{fmtShort(generalIncome)}</td>
                                  {activeExpCols.map(cat => (
                                    <td key={cat} className="py-2 px-2 text-right text-red-400/80">{fmtShort(generalExpByCat[cat])}</td>
                                  ))}
                                  <td className="py-2 px-2 text-right text-red-400 font-medium">{fmtShort(generalTotalExp)}</td>
                                  <td className={`py-2 pl-2 text-right font-bold ${(generalIncome - generalTotalExp) >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                                    {(generalIncome - generalTotalExp) === 0 ? '—' : `${(generalIncome - generalTotalExp) < 0 ? '-' : ''}${formatCurrency(Math.abs(generalIncome - generalTotalExp))}`}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-white/[0.15]">
                                <td className="py-2.5 pr-3 text-white font-bold uppercase text-[11px] tracking-wide">Total</td>
                                <td className="py-2.5 px-2 text-right text-emerald-400 font-bold">{formatCurrency(totalIncome)}</td>
                                {activeExpCols.map(cat => {
                                  const catTotal = propRows.reduce((s, r) => s + r.expByCat[cat], 0) + (generalExpByCat[cat] || 0);
                                  return <td key={cat} className="py-2.5 px-2 text-right text-red-400 font-bold">{fmtShort(catTotal)}</td>;
                                })}
                                <td className="py-2.5 px-2 text-right text-red-400 font-bold">{formatCurrency(totalExpenses)}</td>
                                <td className={`py-2.5 pl-2 text-right font-bold text-sm ${totalNet >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                                  {totalNet < 0 ? '-' : ''}{formatCurrency(Math.abs(totalNet))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Outstanding rent card — only shows when rent is due */}
                  {(() => {
                    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                    const monthLabel = new Date().toLocaleString('en-US', { month: 'long' });
                    const rentedPropIds = new Set(
                      properties
                        .filter(p => ['occupied', 'lease-expired', 'month-to-month'].includes(getEffectiveStatus(p)))
                        .map(p => String(p.id))
                    );
                    const paidPropIds = new Set(
                      rentPayments
                        .filter(r => ['paid', 'partial', 'late'].includes(r.status) && (r.month || r.datePaid || '').startsWith(currentMonth))
                        .map(r => String(r.propertyId))
                    );
                    const unpaidProps = properties.filter(p => rentedPropIds.has(String(p.id)) && !paidPropIds.has(String(p.id)));
                    const totalDue = unpaidProps.reduce((sum, p) => sum + (parseFloat(p.monthlyRent) || 0), 0);

                    if (unpaidProps.length === 0) return null;
                    return (
                      <button onClick={() => setActiveSection('rent')}
                        className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6 text-left hover:bg-red-500/15 transition cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-red-400">Outstanding Rent — {monthLabel}</h3>
                          <p className="text-xl font-bold text-red-400">{formatCurrency(totalDue)}</p>
                        </div>
                        <div className="space-y-1">
                          {unpaidProps.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-sm">
                              <span className="text-white/60">{p.emoji || '🏠'} {p.name}</span>
                              <span className="text-red-400/70">{formatCurrency(parseFloat(p.monthlyRent) || 0)}</span>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })()}

                  {/* Property status alerts */}
                  {(vacantProperties.length > 0 || leaseExpiredProperties.length > 0 || expiringLeases.length > 0) && (
                    <div className="space-y-3 mb-6">
                      {vacantProperties.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                          <h3 className="text-sm font-semibold text-red-400 mb-2">Vacant Properties</h3>
                          {vacantProperties.map(p => (
                            <button key={p.id} onClick={() => { setActiveSection('rentals'); setSelectedProperty(p); }}
                              className="block text-sm text-white/70 hover:text-white transition py-1">
                              {p.emoji || '🏠'} {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {leaseExpiredProperties.length > 0 && (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
                          <h3 className="text-sm font-semibold text-orange-400 mb-2">Lease Expired</h3>
                          {leaseExpiredProperties.map(p => {
                            const tenants = getPropertyTenants(p);
                            const earliestEnd = tenants.map(t => t.leaseEnd).filter(Boolean).sort()[0];
                            const endLabel = earliestEnd ? ` — ${new Date(earliestEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : '';
                            return (
                              <button key={p.id} onClick={() => { setActiveSection('rentals'); setSelectedProperty(p); }}
                                className="block text-sm text-white/70 hover:text-white transition py-1">
                                {p.emoji || '🏠'} {p.name}<span className="text-orange-400/70">{endLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {expiringLeases.length > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
                          <h3 className="text-sm font-semibold text-yellow-400 mb-2">Leases Expiring Soon</h3>
                          {expiringLeases.map(p => {
                            const tenants = getPropertyTenants(p);
                            const soonestEnd = tenants.map(t => t.leaseEnd).filter(Boolean).sort()[0];
                            const end = soonestEnd ? new Date(soonestEnd + 'T00:00:00') : new Date();
                            const today = new Date(); today.setHours(0,0,0,0);
                            const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                            return (
                              <button key={p.id} onClick={() => { setActiveSection('rentals'); setSelectedProperty(p); }}
                                className="block text-sm text-white/70 hover:text-white transition py-1">
                                {p.emoji || '🏠'} {p.name} <span className="text-yellow-400/70">— {days}d left</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick link to Action Items if there are pending tasks or active checklists */}
                  {(() => {
                    const activeChecklists = sharedLists.filter(l =>
                      (l.category === 'move-in' || l.category === 'move-out' || l.category === 'leasing') && l.status !== 'archived'
                    );
                    const pendingCount = sharedTasks.filter(t => t.status !== 'done').length;
                    const checklistCount = activeChecklists.length;
                    if (pendingCount === 0 && checklistCount === 0) return null;
                    return (
                      <button onClick={() => setActiveSection('action-items')}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-6 text-left hover:bg-white/[0.08] transition">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">✅</span>
                            <div>
                              <div className="text-sm font-semibold text-white">Action Items</div>
                              <div className="text-[11px] text-white/40">
                                {pendingCount > 0 && `${pendingCount} task${pendingCount !== 1 ? 's' : ''}`}
                                {pendingCount > 0 && checklistCount > 0 && ' · '}
                                {checklistCount > 0 && `${checklistCount} checklist${checklistCount !== 1 ? 's' : ''}`}
                              </div>
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-white/30 -rotate-90" />
                        </div>
                      </button>
                    );
                  })()}
                </div>
              )}

              {/* ========== OWNERSHIP SECTION ========== */}
              {activeSection === 'ownership' && (
                <OwnershipView
                  properties={properties}
                  investors={investors}
                  onAdd={() => setShowInvestorModal('create')}
                  onEdit={(inv) => setShowInvestorModal(inv)}
                />
              )}

              {/* ========== RENTALS SECTION ========== */}
              {activeSection === 'rentals' && (
                <div>
                  {selectedProperty ? (
                    <PropertyDetail
                      property={selectedProperty}
                      onBack={() => setSelectedProperty(null)}
                      onEdit={() => setShowNewPropertyModal(selectedProperty)}
                      onEditTenant={(tenant) => setShowTenantModal({ ...selectedProperty, _editTenant: tenant })}
                      onAddTenant={() => setShowTenantModal({ ...selectedProperty, _addNew: true })}
                      onRemoveTenant={(tenantId) => {
                        removeTenant(selectedProperty.id, tenantId);
                        // Refresh selectedProperty
                        const updatedTenants = getPropertyTenants(selectedProperty).filter(t => String(t.id) !== String(tenantId));
                        setSelectedProperty({ ...selectedProperty, tenants: updatedTenants, tenant: updatedTenants[0] || null });
                      }}
                      onDelete={() => {
                        setConfirmDialog({
                          title: 'Delete Property',
                          message: `Are you sure you want to delete "${selectedProperty.name}"?`,
                          onConfirm: () => {
                            deleteProperty(selectedProperty.id);
                            setSelectedProperty(null);
                            setConfirmDialog(null);
                          },
                        });
                      }}
                      onPhotoUpload={(file) => handlePropertyPhotoUpload(selectedProperty.id, file)}
                      uploadingPhoto={uploadingPropertyPhoto === selectedProperty.id}
                      tasks={sharedTasks.filter(t => t.linkedTo?.propertyId === String(selectedProperty.id))}
                      showToast={showToast}
                      expenses={expenses}
                      rentPayments={rentPayments}
                      onUpdateProperty={(propId, updates) => {
                        updateProperty(propId, updates);
                        setSelectedProperty(prev => ({ ...prev, ...updates }));
                      }}
                    />
                  ) : (
                    <>
                      {/* Sub-nav */}
                      <div className="flex gap-1.5 mb-4 items-center justify-between sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                        <div className="flex gap-1.5">
                          {[
                            { id: 'grid', emoji: '🏠' },
                            { id: 'tasks', emoji: '📋' },
                            { id: 'overview', emoji: '📊' },
                          ].map(tab => (
                            <button key={tab.id} onClick={() => setPropertyViewMode(tab.id)}
                              className={`px-3 md:px-4 py-2 rounded-xl font-medium transition text-base md:text-lg text-center ${
                                propertyViewMode === tab.id ? 'bg-teal-500 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                              }`}>{tab.emoji}</button>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowNewPropertyModal('create')}
                          className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition"
                        >
                          <Plus className="w-4 h-4" /> Add Property
                        </button>
                      </div>

                      {/* Properties Grid */}
                      {propertyViewMode === 'grid' && (
                        <div className="grid grid-cols-1 gap-4">
                          {properties.map(property => (
                            <PropertyCard
                              key={property.id}
                              property={property}
                              documents={documents}
                              expenses={expenses}
                              rentPayments={rentPayments}
                              onViewDetails={() => setSelectedProperty(property)}
                              onEdit={() => setShowNewPropertyModal(property)}
                              onDelete={() => {
                                setConfirmDialog({
                                  title: 'Delete Property',
                                  message: `Delete "${property.name}"? This cannot be undone.`,
                                  onConfirm: () => { deleteProperty(property.id); setConfirmDialog(null); },
                                });
                              }}
                              onViewDocument={(doc) => setViewingDocument(doc)}
                            />
                          ))}
                          {properties.length === 0 && (
                            <div className="text-center py-16">
                              <p className="text-4xl mb-3">🏠</p>
                              <p className="text-white/40">No properties yet</p>
                              <button onClick={() => setShowNewPropertyModal('create')} className="mt-3 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm hover:bg-teal-600 transition">
                                Add Your First Property
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Property Tasks */}
                      {propertyViewMode === 'tasks' && (
                        <div className="space-y-2">
                          {sharedTasks.filter(t => t.linkedTo?.propertyId).map(task => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onComplete={() => completeTask(task.id)}
                              onEdit={() => setShowAddTaskModal(task)}
                              onDelete={() => deleteTask(task.id)}
                              onHighlight={() => highlightTask(task.id)}
                              showToast={showToast}
                              currentUser={currentUser}
                              getLinkedLabel={(linked) => linked?.propertyId ? getPropertyName(linked.propertyId) : null}
                            />
                          ))}
                          {sharedTasks.filter(t => t.linkedTo?.propertyId).length === 0 && (
                            <p className="text-center text-white/30 py-8">No property-linked tasks</p>
                          )}
                        </div>
                      )}

                      {/* Property Overview */}
                      {propertyViewMode === 'overview' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                              <p className="text-white/40 text-xs mb-1">Total Properties</p>
                              <p className="text-3xl font-bold text-teal-400">{properties.length}</p>
                            </div>
                            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                              <p className="text-white/40 text-xs mb-1">Occupied</p>
                              <p className="text-3xl font-bold text-green-400">{activeProperties.length}</p>
                            </div>
                            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                              <p className="text-white/40 text-xs mb-1">Not Collecting Rent</p>
                              <p className="text-3xl font-bold text-red-400">{notCollectingRent.length}</p>
                              {(vacantProperties.length > 0 || renovationProperties.length > 0) && (
                                <p className="text-white/30 text-xs mt-1">
                                  {vacantProperties.length > 0 && `${vacantProperties.length} vacant`}
                                  {vacantProperties.length > 0 && renovationProperties.length > 0 && ' · '}
                                  {renovationProperties.length > 0 && `${renovationProperties.length} renovation`}
                                </p>
                              )}
                            </div>
                            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                              <p className="text-white/40 text-xs mb-1">Monthly Rent</p>
                              <p className="text-3xl font-bold text-emerald-400">{formatCurrency(properties.reduce((sum, p) => sum + (parseFloat(p.monthlyRent) || 0), 0))}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ========== TENANTS SECTION ========== */}
              {activeSection === 'tenants' && (
                <TenantsList
                  properties={properties}
                  onEditTenant={(propertyId, tenant) => {
                    const prop = properties.find(p => String(p.id) === String(propertyId));
                    if (prop) setShowTenantModal({ ...prop, _editTenant: tenant || null });
                  }}
                  onAddTenant={() => {
                    // Open tenant modal for first property or show property selector
                    if (properties.length === 1) {
                      setShowTenantModal(properties[0]);
                    } else if (properties.length > 1) {
                      // Create a temp state to pick property first
                      setShowTenantModal({ _pickProperty: true });
                    } else {
                      showToast('Add a property first', 'info');
                    }
                  }}
                  onViewProperty={(propertyId) => {
                    const prop = properties.find(p => String(p.id) === String(propertyId));
                    if (prop) { setActiveSection('rentals'); setSelectedProperty(prop); }
                  }}
                />
              )}

              {/* ========== RENT SECTION ========== */}
              {activeSection === 'rent' && (
                <RentLedger
                  rentPayments={rentPayments}
                  properties={properties}
                  onAdd={() => setShowAddRentModal('create')}
                  onEdit={(payment) => setShowAddRentModal(payment)}
                  onDelete={(paymentId) => {
                    setConfirmDialog({
                      title: 'Delete Payment',
                      message: 'Delete this rent payment record?',
                      onConfirm: () => { deleteRentPayment(paymentId); setConfirmDialog(null); },
                    });
                  }}
                  showToast={showToast}
                />
              )}

              {/* ========== EXPENSES SECTION ========== */}
              {activeSection === 'expenses' && (
                <ExpensesList
                  expenses={expenses}
                  properties={properties}
                  onAdd={() => setShowAddExpenseModal('create')}
                  onEdit={(expense) => setShowAddExpenseModal(expense)}
                  onDelete={(expenseId) => {
                    setConfirmDialog({
                      title: 'Delete Expense',
                      message: 'Delete this expense record?',
                      onConfirm: () => { deleteExpense(expenseId); setConfirmDialog(null); },
                    });
                  }}
                  onGenerateFromTemplate={(template) => {
                    const now = new Date();
                    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    const dueDay = template.dueDay || 1;
                    const maxDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                    const actualDay = Math.min(dueDay, maxDay);
                    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
                    addExpense({
                      id: `${Date.now()}-${template.id}-${monthStr}`,
                      createdAt: new Date().toISOString(),
                      createdBy: currentUser,
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
                  }}
                  showToast={showToast}
                />
              )}

              {/* ========== ACTION ITEMS SECTION ========== */}
              {activeSection === 'action-items' && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">Action Items</h2>

                  {/* Rents Due / Past Due — scans January through the current month (not just
                      the current month) so an unpaid prior month, e.g. June rent still unpaid
                      once July starts, keeps showing up here instead of silently disappearing. */}
                  {(() => {
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonthIdx = now.getMonth(); // 0-based
                    const dayOfMonth = now.getDate();

                    const rentProps = properties.filter(p =>
                      ['occupied', 'lease-expired', 'month-to-month'].includes(
                        p.propertyStatus || (getPropertyTenants(p).length > 0 ? 'occupied' : 'vacant')
                      ) && (parseFloat(p.monthlyRent) || 0) > 0
                    );

                    // Every (property, month) from Jan through this month with no paid/partial
                    // rent recorded — mirrors the Reconcile tab's "Needs attention" logic so a
                    // missed month stays flagged until it's actually paid, not until the month ends.
                    const flags = [];
                    for (let m = 0; m <= currentMonthIdx; m++) {
                      const monthKey = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
                      rentProps.forEach(p => {
                        // Any paid/partial record settles the month — a $0 'paid' record is the
                        // deliberate "unit vacant, no rent due" marker (N. Elm Jan-Feb 2026).
                        const monthRecords = rentPayments
                          .filter(r => String(r.propertyId) === String(p.id)
                            && ['paid', 'partial', 'late'].includes(r.status)
                            && (r.month || r.datePaid || '').startsWith(monthKey));
                        if (monthRecords.length === 0) {
                          const isPastDue = m < currentMonthIdx || dayOfMonth > 5;
                          flags.push({ property: p, monthIdx: m, monthKey, isPastDue });
                        }
                      });
                    }

                    if (flags.length === 0) return null;
                    flags.sort((a, b) => a.monthIdx - b.monthIdx);
                    const pastDueFlags = flags.filter(f => f.isPastDue);
                    const dueFlags = flags.filter(f => !f.isPastDue);

                    const renderRow = (f) => (
                      <div key={`${f.property.id}-${f.monthKey}`}
                        onClick={() => { setActiveSection('rent'); }}
                        className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer ${
                          f.isPastDue
                            ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15'
                            : 'bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/15'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm flex-shrink-0">{f.property.emoji || '🏠'}</span>
                            <span className={`text-sm font-medium truncate ${f.isPastDue ? 'text-red-400' : 'text-yellow-400'}`}>{f.property.name}</span>
                            <span className="text-[11px] text-white/30 flex-shrink-0">
                              {new Date(`${f.monthKey}-01T00:00:00`).toLocaleString('en-US', { month: 'long' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-sm font-bold ${f.isPastDue ? 'text-red-400' : 'text-yellow-400'}`}>
                              {formatCurrency(parseFloat(f.property.monthlyRent) || 0)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAddRentModal({
                                  incomeType: 'rent',
                                  propertyId: f.property.id,
                                  propertyName: `${f.property.emoji || '🏠'} ${f.property.name}`,
                                  tenantName: getPropertyTenants(f.property).map(t => t.name).filter(Boolean).join(', '),
                                  month: f.monthKey,
                                  amount: parseFloat(f.property.monthlyRent) || '',
                                  status: 'paid',
                                });
                              }}
                              className={`px-3 py-1 rounded-lg text-white text-xs font-semibold transition ${
                                f.isPastDue ? 'bg-red-500/90 hover:bg-red-500' : 'bg-emerald-500/90 hover:bg-emerald-500'
                              }`}
                            >
                              Record
                            </button>
                          </div>
                        </div>
                      </div>
                    );

                    return (
                      <div className="mb-6">
                        {pastDueFlags.length > 0 && (
                          <div className="mb-3">
                            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">
                              Rents Past Due{pastDueFlags.length > 1 ? ` (${pastDueFlags.length})` : ''}
                            </h3>
                            <div className="space-y-2">
                              {pastDueFlags.map(renderRow)}
                            </div>
                          </div>
                        )}
                        {dueFlags.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">
                              Rents Due — {now.toLocaleString('en-US', { month: 'long' })}
                            </h3>
                            <div className="space-y-2">
                              {dueFlags.map(renderRow)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}



                  {/* ---- Citi •4793 charges to confirm (managers only) ---- */}
                  {canManage && (
                    <CardInbox
                      items={(cardInbox?.items || []).filter((it) => !handledInboxIds.includes(it.txnId))}
                      properties={properties}
                      onConfirm={confirmCardCharge}
                      onDismiss={dismissCardCharge}
                    />
                  )}

                  {/* ---- Expense review queue from Mike's Money bank data (managers only) ---- */}
                  {canManage && (() => {
                    const pending = expenseReviewItems.filter(i => i.status === 'pending');
                    if (pending.length === 0) return null;
                    return (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">
                          💳 Expenses to Review ({pending.length}) <span className="normal-case font-normal text-white/30">— from Mike's Money bank data</span>
                        </h3>
                        <div className="space-y-2">
                          {pending.map(item => (
                            <ExpenseReviewCard
                              key={item.id}
                              item={item}
                              properties={properties}
                              onApprove={(patch) => {
                                const prop = properties.find(p => String(p.id) === String(patch.propertyId));
                                addExpense({
                                  id: `rev-${item.id}`,
                                  propertyId: patch.propertyId || '',
                                  propertyName: prop ? `${prop.emoji || '🏠'} ${prop.name}` : '',
                                  category: patch.category,
                                  description: item.description + (item.reason === 'liam' ? ' (Liam)' : ''),
                                  amount: item.amount,
                                  date: item.date,
                                  source: 'mikes-money-review',
                                });
                                resolveReviewItem(item.id, { status: 'approved', propertyId: patch.propertyId, category: patch.category });
                              }}
                              onDismiss={() => resolveReviewItem(item.id, { status: 'dismissed' })}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] text-white/30 mt-2">
                          Approve = recorded as a rental expense (Expenses + Schedule E). Dismiss = not a rental expense.
                        </p>
                      </div>
                    );
                  })()}

                  {/* ---- Liam's weekly update card (managers only) ---- */}
                  {canManage && (() => {
                    const now = new Date();
                    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    // ISO week label
                    const dt = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
                    const dayNum = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
                    const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
                    const weekNo = 1 + Math.round(((dt - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
                    const weekId = `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

                    const rentedProps = properties.filter(p =>
                      ['occupied', 'lease-expired', 'month-to-month'].includes(
                        p.propertyStatus || (getPropertyTenants(p).length > 0 ? 'occupied' : 'vacant')
                      )
                    );
                    const paidPropIds = new Set(
                      rentPayments
                        .filter(r => ['paid', 'partial', 'late'].includes(r.status) && (r.month || r.datePaid || '').startsWith(currentMonth))
                        .map(r => String(r.propertyId))
                    );
                    const unpaidProps = rentedProps.filter(p => !paidPropIds.has(String(p.id)));

                    const sendDone = async () => {
                      const at = new Date().toISOString();
                      setWeeklySentAt(at);
                      try {
                        await setDoc(doc(db, 'rentalData', 'liamWeekly'), {
                          week: weekId, by: currentUser || 'Liam', at,
                          counts: { rentsRecorded: rentedProps.length - unpaidProps.length, rentsOpen: unpaidProps.length, todosOpen: pendingTasks.length, availUpdated: availChecked },
                          mikeNotified: false, // push layer flips this when Mike is alerted
                        }, { merge: true });
                        // Ping Mike instantly via mikeslife (his real push token); the daily cron is a backstop.
                        try { fetch('https://mikeslife.app/api/liam-done', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', keepalive: true }).catch(() => {}); } catch (_) { /* best effort */ }
                        showToast && showToast("Sent! Mike will be notified to pay you. 🎉", 'success');
                      } catch (e) { showToast && showToast('Saved locally — sync issue: ' + e.message, 'error'); }
                    };

                    return (
                      <div className="mb-6 rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/15 to-purple-500/10 p-4">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-white font-bold">🗓️ This week's update</h3>
                          <span className="text-xs text-white/50">{weekId}</span>
                        </div>
                        <p className="text-sm text-white/60 mb-3">Record rents, any lease changes, and expenses — then tap <b>Done &amp; send</b>.</p>

                        {/* Rents to record */}
                        <div className="mb-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-1">💰 Rents to record {unpaidProps.length > 0 && `(${unpaidProps.length})`}</div>
                          {unpaidProps.length === 0 ? (
                            <div className="text-sm text-emerald-400/90">All rents recorded for {now.toLocaleString('en-US', { month: 'long' })} ✓</div>
                          ) : unpaidProps.map(p => (
                            <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                              <span className="text-sm text-white/85">{p.emoji || '🏠'} {p.name} <span className="text-white/45">· {formatCurrency(parseFloat(p.monthlyRent) || 0)}</span></span>
                              <button
                                onClick={() => setShowAddRentModal({ propertyId: p.id, propertyName: p.name, amount: parseFloat(p.monthlyRent) || '', month: currentMonth, datePaid: todayStr, status: 'paid', incomeType: 'rent' })}
                                className="px-3 py-1 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white text-xs font-semibold">Record</button>
                            </div>
                          ))}
                        </div>

                        {/* Lease + expense quick actions */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <button onClick={() => setShowTenantModal({ _pickProperty: true })}
                            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold">📝 Update a lease</button>
                          <button onClick={() => setShowAddExpenseModal('create')}
                            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold">🧾 Add expense</button>
                        </div>

                        {/* Action item: update rents in Avail */}
                        <button onClick={() => setAvailChecked(v => !v)}
                          className="w-full flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-left">
                          <span className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center text-xs ${availChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/30 text-transparent'}`}>✓</span>
                          <span className="text-sm text-white/85">🔑 Update rent payments in <b>Avail</b></span>
                        </button>

                        {/* This week's to-dos (shared tasks) */}
                        <div className="mb-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-1">✅ This week's to-dos {pendingTasks.length > 0 && `(${pendingTasks.length})`}</div>
                          {pendingTasks.length === 0 ? (
                            <div className="text-sm text-white/50">No open to-dos.</div>
                          ) : pendingTasks.slice(0, 8).map(t => (
                            <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                              <span className="text-sm text-white/85 min-w-0 truncate pr-2">{t.title}{t.dueDate ? <span className="text-white/40"> · due {t.dueDate}</span> : null}</span>
                              <button onClick={() => completeTask(t.id)}
                                className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-emerald-500/80 text-white text-xs font-semibold">Done</button>
                            </div>
                          ))}
                        </div>

                        {pushState !== 'granted' && (
                          <button onClick={enableAlerts} className="w-full mb-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-sm font-semibold hover:bg-amber-500/25">🔔 Enable weekly reminders on this device</button>
                        )}
                        {weeklySentAt
                          ? <div className="text-center text-sm text-emerald-400 font-semibold py-1">✓ Sent — Mike will be notified to pay you.</div>
                          : <button onClick={sendDone} className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 text-white font-bold">✅ Done &amp; send</button>}
                      </div>
                    );
                  })()}

                  {/* ---- This week digest + export (managers only) ---- */}
                  {canManage && (() => {
                    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
                    const recent = activityEvents.filter(e => e.at >= weekAgo);
                    const rentsThisWeek = rentPayments.filter(r => (r.datePaid || '') >= weekAgo.slice(0, 10) && ['paid', 'partial', 'late'].includes(r.status));
                    const rentTotal = rentsThisWeek.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                    const expThisWeek = expenses.filter(e => (e.createdAt || '') >= weekAgo);
                    const expTotal = expThisWeek.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                    return (
                      <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">🗓️ This Week</h3>
                          <button onClick={exportAllData} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-xs font-semibold" title="Download a full JSON export of all data (auto-backup also runs weekly)">⬇ Export data</button>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/70 mb-2">
                          <span>💰 {rentsThisWeek.length} rent{rentsThisWeek.length === 1 ? '' : 's'} received · <span className="text-emerald-400 font-semibold">{formatCurrency(rentTotal)}</span></span>
                          <span>💸 {expThisWeek.length} expense{expThisWeek.length === 1 ? '' : 's'} added · <span className="text-red-400 font-semibold">{formatCurrency(expTotal)}</span></span>
                          <span>📝 {recent.length} change{recent.length === 1 ? '' : 's'} logged</span>
                        </div>
                        {recent.length > 0 && (
                          <div className="space-y-1">
                            {recent.slice(0, 8).map((e, i) => (
                              <div key={i} className="text-xs text-white/40 flex items-baseline gap-2">
                                <span className="text-white/60 font-medium shrink-0 w-12">{e.by}</span>
                                <span className="shrink-0">{e.action}</span>
                                <span className="truncate">{e.detail}</span>
                                <span className="ml-auto shrink-0">{new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              </div>
                            ))}
                            {recent.length > 8 && <div className="text-[11px] text-white/25">…and {recent.length - 8} more</div>}
                          </div>
                        )}
                        {recent.length === 0 && <p className="text-xs text-white/30">Change history starts now — edits by you and Liam will appear here.</p>}
                      </div>
                    );
                  })()}

                  {/* ---- Recently deleted / restore (managers only) ---- */}
                  {canManage && trashItems.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">🗑️ Recently Deleted ({trashItems.length})</h3>
                      <div className="space-y-2">
                        {trashItems.slice(0, 6).map(item => (
                          <div key={item.trashId} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                            <div className="min-w-0 flex-1 pr-3">
                              <span className="text-sm text-white/70">{item.type}: {item.payload?.name || item.payload?.description || item.payload?.propertyName || item.trashId}</span>
                              <span className="block text-[11px] text-white/30">deleted by {item.deletedBy} · {new Date(item.deletedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{item.payload?.amount ? ` · ${formatCurrency(parseFloat(item.payload.amount) || 0)}` : ''}</span>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => restoreTrashItem(item)} className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25">↩ Restore</button>
                              <button onClick={() => removeFromTrash(item.trashId)} className="px-2.5 py-1.5 rounded-xl bg-white/5 text-white/40 text-xs hover:bg-white/10" title="Remove from trash permanently">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lease Alerts — Expired or Expiring Within 30 Days */}
                  {(() => {
                    const leaseAlerts = [];
                    properties.forEach(p => {
                      const tenants = getPropertyTenants(p);
                      tenants.forEach(t => {
                        if (!t.leaseEnd) return;
                        const end = new Date(t.leaseEnd + 'T00:00:00');
                        const today = new Date(); today.setHours(0, 0, 0, 0);
                        const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                        if (days <= 30) {
                          leaseAlerts.push({ property: p, tenant: t, days, expired: days <= 0 });
                        }
                      });
                    });
                    // Sort: expired first, then by days ascending
                    leaseAlerts.sort((a, b) => a.days - b.days);

                    if (leaseAlerts.length === 0) return null;
                    return (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Lease Alerts</h3>
                        <div className="space-y-2">
                          {leaseAlerts.map((alert, idx) => (
                            <button key={`${alert.property.id}-${alert.tenant.id || idx}`}
                              onClick={() => { setActiveSection('rentals'); setSelectedProperty(alert.property); }}
                              className={`w-full text-left p-3 rounded-2xl border transition ${
                                alert.expired
                                  ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15'
                                  : 'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/15'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{alert.property.emoji || '🏠'}</span>
                                  <div>
                                    <span className={`text-sm font-medium ${alert.expired ? 'text-red-400' : 'text-orange-400'}`}>
                                      {alert.property.name}
                                    </span>
                                    {alert.tenant.name && (
                                      <span className="text-xs text-white/40 ml-2">({alert.tenant.name})</span>
                                    )}
                                  </div>
                                </div>
                                <span className={`text-xs font-semibold ${alert.expired ? 'text-red-400' : 'text-orange-400'}`}>
                                  {alert.expired ? 'Expired' : `${alert.days}d left`}
                                </span>
                              </div>
                              <p className="text-[11px] text-white/40 mt-1">
                                {alert.expired ? 'Lease has expired — renew or update' : 'Lease expiring soon — plan renewal'}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Active Move-In/Move-Out Checklists */}
                  {(() => {
                    const activeChecklists = sharedLists.filter(l =>
                      (l.category === 'move-in' || l.category === 'move-out' || l.category === 'leasing') && l.status !== 'archived'
                    );
                    return (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Active Properties</h3>
                          <button onClick={() => setShowChecklistInitModal('create')} className="text-xs text-teal-400 hover:text-teal-300 font-medium">+ New</button>
                        </div>
                        {activeChecklists.length === 0 ? (
                          <p className="text-center text-white/30 py-6">No active properties</p>
                        ) : (
                          <div className="space-y-2">
                            {activeChecklists.map(list => {
                              const checked = list.items?.filter(i => i.checked).length || 0;
                              const total = list.items?.length || 0;
                              const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
                              const propName = list.linkedTo?.itemId ? getPropertyName(list.linkedTo.itemId) : null;
                              return (
                                <button
                                  key={list.id}
                                  onClick={() => setShowChecklistDetailModal(list)}
                                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 text-left hover:bg-white/[0.08] transition"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl">{list.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-semibold text-white truncate">{list.name}</div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-white/40">{checked}/{total} items</span>
                                        {propName && (
                                          <>
                                            <span className="text-xs text-white/30">•</span>
                                            <span className="text-xs text-teal-400">{propName}</span>
                                          </>
                                        )}
                                        <span className="text-xs text-white/30">•</span>
                                        {list.signature ? (
                                          <span className="text-xs text-teal-400">✓ Signed</span>
                                        ) : (
                                          <span className="text-xs text-yellow-400">Needs signature</span>
                                        )}
                                      </div>
                                    </div>
                                    {/* Progress circle */}
                                    <div className="shrink-0 w-10 h-10 relative">
                                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-700" />
                                        <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                                          strokeDasharray={`${(pct / 100) * 94.2} 94.2`}
                                          strokeLinecap="round"
                                          className={pct === 100 ? 'text-teal-400' : 'text-purple-400'}
                                        />
                                      </svg>
                                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/60">{pct}%</span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* To-Do List */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">To-Do List</h3>
                      <button onClick={() => setShowAddTaskModal('create')} className="text-xs text-teal-400 hover:text-teal-300 font-medium">+ Add Task</button>
                    </div>

                    {/* Task filters + sort */}
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <div className="flex gap-1.5 flex-wrap">
                        {timeHorizons.map(h => (
                          <button key={h.value} onClick={() => setHubTaskFilter(h.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              hubTaskFilter === h.value ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}>{h.label}</button>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => setHubTaskSort('priority')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${
                            hubTaskSort === 'priority' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
                          }`}>Priority</button>
                        <button onClick={() => setHubTaskSort('date')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${
                            hubTaskSort === 'date' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
                          }`}>Due Date</button>
                      </div>
                    </div>

                    {/* Task list */}
                    <div className="space-y-2">
                      {sharedTasks
                        .filter(t => t.status !== 'done')
                        .filter(t => taskMatchesHorizon(t, hubTaskFilter))
                        .sort((a, b) => {
                          if (hubTaskSort === 'date') {
                            const da = a.dueDate || '9999';
                            const db = b.dueDate || '9999';
                            if (da !== db) return da.localeCompare(db);
                            const pOrder = { high: 0, medium: 1, low: 2 };
                            return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
                          } else {
                            const pOrder = { high: 0, medium: 1, low: 2 };
                            const pa = pOrder[a.priority] ?? 2;
                            const pb = pOrder[b.priority] ?? 2;
                            if (pa !== pb) return pa - pb;
                            return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
                          }
                        })
                        .map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onComplete={() => completeTask(task.id)}
                            onEdit={() => setShowAddTaskModal(task)}
                            onDelete={() => deleteTask(task.id)}
                            onHighlight={() => highlightTask(task.id)}
                            showToast={showToast}
                            currentUser={currentUser}
                            getLinkedLabel={(linked) => linked?.propertyId ? getPropertyName(linked.propertyId) : null}
                          />
                        ))}
                      {sharedTasks.filter(t => t.status !== 'done').filter(t => taskMatchesHorizon(t, hubTaskFilter)).length === 0 && (
                        <p className="text-center text-white/30 py-8">No tasks match this filter</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========== DOCUMENTS SECTION ========== */}
              {activeSection === 'documents' && (
                <div>
                  {/* Sub-nav */}
                  <div className="flex gap-1.5 mb-4 items-center justify-between sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                    <div className="flex gap-1.5">
                      {[
                        { id: 'byType', emoji: '📁' },
                        { id: 'byProperty', emoji: '🏠' },
                        { id: 'all', emoji: '📄' },
                      ].map(tab => (
                        <button key={tab.id} onClick={() => setDocumentViewMode(tab.id)}
                          className={`px-3 md:px-4 py-2 rounded-xl font-medium transition text-base md:text-lg text-center ${
                            documentViewMode === tab.id ? 'bg-amber-500 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                          }`}>{tab.emoji}</button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowAddDocumentModal('create')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition"
                    >
                      <Plus className="w-4 h-4" /> Add Document
                    </button>
                  </div>

                  {/* All Documents */}
                  {documentViewMode === 'all' && (
                    <div className="space-y-2">
                      {documents.map(docItem => (
                        <DocumentCard
                          key={docItem.id}
                          document={docItem}
                          propertyName={getPropertyName(docItem.propertyId)}
                          onEdit={() => setShowAddDocumentModal(docItem)}
                          onView={() => setViewingDocument(docItem)}
                          onDelete={() => {
                            setConfirmDialog({
                              title: 'Delete Document',
                              message: `Delete "${docItem.title}"?`,
                              onConfirm: () => { deleteDocument(docItem.id); setConfirmDialog(null); },
                            });
                          }}
                        />
                      ))}
                      {documents.length === 0 && (
                        <div className="text-center py-16">
                          <p className="text-4xl mb-3">📄</p>
                          <p className="text-white/40">No documents yet</p>
                          <button onClick={() => setShowAddDocumentModal('create')} className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm hover:bg-amber-600 transition">
                            Upload Your First Document
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* By Property */}
                  {documentViewMode === 'byProperty' && (
                    <div className="space-y-4">
                      {properties.map(prop => {
                        const propDocs = documents.filter(d => String(d.propertyId) === String(prop.id));
                        if (propDocs.length === 0) return null;
                        return (
                          <div key={prop.id}>
                            <h3 className="text-sm font-semibold text-white/60 mb-2">{prop.emoji || '🏠'} {prop.name}</h3>
                            <div className="space-y-2">
                              {propDocs.map(docItem => (
                                <DocumentCard
                                  key={docItem.id}
                                  document={docItem}
                                  propertyName={prop.name}
                                  onEdit={() => setShowAddDocumentModal(docItem)}
                                  onView={() => setViewingDocument(docItem)}
                                  onDelete={() => deleteDocument(docItem.id)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {/* Unlinked docs */}
                      {documents.filter(d => !d.propertyId).length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-white/60 mb-2">📁 General</h3>
                          <div className="space-y-2">
                            {documents.filter(d => !d.propertyId).map(docItem => (
                              <DocumentCard
                                key={docItem.id}
                                document={docItem}
                                onEdit={() => setShowAddDocumentModal(docItem)}
                                onView={() => setViewingDocument(docItem)}
                                onDelete={() => deleteDocument(docItem.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* By Type */}
                  {documentViewMode === 'byType' && (
                    <div className="space-y-4">
                      {documentTypes.map(dtype => {
                        const typeDocs = documents.filter(d => d.type === dtype.value);
                        if (typeDocs.length === 0) return null;
                        return (
                          <div key={dtype.value}>
                            <h3 className="text-sm font-semibold text-white/60 mb-2">{dtype.emoji} {dtype.label} ({typeDocs.length})</h3>
                            <div className="space-y-2">
                              {typeDocs.map(docItem => (
                                <DocumentCard
                                  key={docItem.id}
                                  document={docItem}
                                  propertyName={getPropertyName(docItem.propertyId)}
                                  onEdit={() => setShowAddDocumentModal(docItem)}
                                  onView={() => setViewingDocument(docItem)}
                                  onDelete={() => deleteDocument(docItem.id)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ========== FINANCIALS SECTION ========== */}
              {activeSection === 'financials' && (
                <div>
                  {/* Sub-nav */}
                  <div className="flex gap-1.5 mb-4 items-center justify-start sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                    {[
                      { id: 'transactions', emoji: '💰' },
                      { id: 'summary', emoji: '📈' },
                      { id: 'byProperty', emoji: '🏠' },
                    ].map(tab => (
                      <button key={tab.id} onClick={() => setFinancialViewMode(tab.id)}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-xl font-medium transition text-base md:text-lg text-center ${
                          financialViewMode === tab.id ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}>{tab.emoji}</button>
                    ))}
                  </div>

                  {/* Transactions */}
                  {financialViewMode === 'transactions' && (
                    <div>
                      <div className="flex gap-2 mb-4">
                        {['all', 'income', 'expense'].map(f => (
                          <button key={f} onClick={() => setTransactionTypeFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                              transactionTypeFilter === f ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}>{f}</button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {(getFilteredTransactions ? getFilteredTransactions() : transactions)
                          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                          .map(txn => (
                            <TransactionCard
                              key={txn.id}
                              transaction={txn}
                              propertyName={getPropertyName(txn.propertyId)}
                              onEdit={() => setShowAddTransactionModal(txn)}
                              onDelete={() => {
                                setConfirmDialog({
                                  title: 'Delete Transaction',
                                  message: 'Delete this transaction?',
                                  onConfirm: () => { deleteTransaction(txn.id); setConfirmDialog(null); },
                                });
                              }}
                            />
                          ))}
                        {transactions.length === 0 && (
                          <div className="text-center py-16">
                            <p className="text-4xl mb-3">💰</p>
                            <p className="text-white/40">No transactions yet</p>
                            <button onClick={() => setShowAddTransactionModal('create')} className="mt-3 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm hover:bg-emerald-600 transition">
                              Log Your First Transaction
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {financialViewMode === 'summary' && (
                    <FinancialSummary
                      transactions={transactions}
                      properties={properties}
                      getTotalIncome={getTotalIncome}
                      getTotalExpenses={getTotalExpenses}
                      getProfit={getProfit}
                      getMonthlyBreakdown={getMonthlyBreakdown}
                      getPropertyBreakdown={getPropertyBreakdown}
                    />
                  )}

                  {/* By Property */}
                  {financialViewMode === 'byProperty' && (
                    <div className="space-y-4">
                      {properties.map(prop => {
                        const propTxns = transactions.filter(t => String(t.propertyId) === String(prop.id));
                        const income = propTxns.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
                        const expenses = propTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
                        return (
                          <div key={prop.id} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                            <h3 className="font-semibold text-white mb-2">{prop.emoji || '🏠'} {prop.name}</h3>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div><span className="text-white/40">Income:</span> <span className="text-emerald-400">{formatCurrency(income)}</span></div>
                              <div><span className="text-white/40">Expenses:</span> <span className="text-red-400">{formatCurrency(expenses)}</span></div>
                              <div><span className="text-white/40">Profit:</span> <span className={income - expenses >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(income - expenses)}</span></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* ========== MODALS ========== */}

        {/* Hub Modals */}
        {showAddTaskModal && (
          <AddTaskModal
            task={typeof showAddTaskModal === 'object' ? showAddTaskModal : null}
            onSave={(taskData) => {
              if (typeof showAddTaskModal === 'object' && showAddTaskModal.id) {
                updateTask(showAddTaskModal.id, taskData);
              } else {
                addTask({ ...taskData, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser, status: 'pending' });
              }
              setShowAddTaskModal(null);
            }}
            onClose={() => setShowAddTaskModal(null)}
            currentUser={currentUser}
            properties={properties}
          />
        )}

        {showSharedListModal && (
          <SharedListModal
            list={typeof showSharedListModal === 'object' ? showSharedListModal : null}
            onSave={(listData) => {
              if (typeof showSharedListModal === 'object' && showSharedListModal.id) {
                updateList(showSharedListModal.id, listData);
              } else {
                addList({ ...listData, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser, items: [] });
              }
              setShowSharedListModal(null);
            }}
            onClose={() => setShowSharedListModal(null)}
            currentUser={currentUser}
          />
        )}

        {showAddIdeaModal && (
          <AddIdeaModal
            idea={typeof showAddIdeaModal === 'object' ? showAddIdeaModal : null}
            onSave={(ideaData) => {
              if (typeof showAddIdeaModal === 'object' && showAddIdeaModal.id) {
                updateIdea(showAddIdeaModal.id, ideaData);
              } else {
                addIdea({ ...ideaData, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser, status: 'inbox' });
              }
              setShowAddIdeaModal(null);
            }}
            onClose={() => setShowAddIdeaModal(null)}
            currentUser={currentUser}
          />
        )}

        {/* Rental Modals */}
        {showNewPropertyModal && (
          <NewPropertyModal
            property={typeof showNewPropertyModal === 'object' ? showNewPropertyModal : null}
            onSave={(propData) => {
              if (typeof showNewPropertyModal === 'object' && showNewPropertyModal.id) {
                updateProperty(showNewPropertyModal.id, propData);
                if (selectedProperty?.id === showNewPropertyModal.id) {
                  setSelectedProperty({ ...showNewPropertyModal, ...propData });
                }
              } else {
                addProperty({ ...propData, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              setShowNewPropertyModal(null);
            }}
            onClose={() => setShowNewPropertyModal(null)}
            onPhotoUpload={handlePropertyPhotoUpload}
          />
        )}

        {showTenantModal && (
          <TenantModal
            property={showTenantModal}
            properties={properties}
            tenant={showTenantModal?._editTenant || (showTenantModal?._addNew ? null : null)}
            onSave={(tenantData, overridePropertyId) => {
              // Determine target property ID
              const targetId = overridePropertyId || showTenantModal.id;
              if (!targetId) {
                showToast('No property selected', 'error');
                return;
              }
              const targetProp = properties.find(p => String(p.id) === String(targetId));
              if (!targetProp) {
                showToast('Property not found', 'error');
                return;
              }
              // If editing an existing tenant, preserve their ID
              const editingTenant = showTenantModal?._editTenant;
              const dataWithId = editingTenant?.id ? { ...tenantData, id: editingTenant.id } : tenantData;
              addOrUpdateTenant(targetProp.id, dataWithId);
              // Refresh selectedProperty if viewing it
              if (selectedProperty && String(selectedProperty.id) === String(targetProp.id)) {
                // Re-fetch from properties after next render
                setTimeout(() => {
                  setProperties(prev => {
                    const updated = prev.find(p => String(p.id) === String(targetProp.id));
                    if (updated) setSelectedProperty({ ...updated });
                    return prev;
                  });
                }, 100);
              }
              setShowTenantModal(null);
            }}
            onClose={() => setShowTenantModal(null)}
            onUploadPhoto={uploadPhoto}
          />
        )}

        {/* Ownership Modal */}
        {showInvestorModal && (
          <InvestorModal
            investor={typeof showInvestorModal === 'object' ? showInvestorModal : null}
            onSave={(invData) => {
              if (typeof showInvestorModal === 'object' && showInvestorModal.id) {
                updateInvestor(showInvestorModal.id, invData);
              } else {
                addInvestor({ ...invData, id: Date.now().toString(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              setShowInvestorModal(null);
            }}
            onDelete={(investorId) => {
              setConfirmDialog({
                title: 'Delete Investor Stake',
                message: 'Delete this ownership stake record? This cannot be undone.',
                onConfirm: () => { deleteInvestor(investorId); setShowInvestorModal(null); setConfirmDialog(null); },
              });
            }}
            onClose={() => setShowInvestorModal(null)}
          />
        )}

        {/* Document Modals */}
        {showAddDocumentModal && (
          <AddDocumentModal
            document={typeof showAddDocumentModal === 'object' ? showAddDocumentModal : null}
            properties={properties}
            onSave={async (docData, file) => {
              let fileUrl = docData.fileUrl;
              if (file) {
                const url = await handleDocumentFileUpload(file, docData);
                if (!url) return; // Upload failed, don't save
                fileUrl = url;
              }
              const finalDoc = { ...docData, fileUrl };
              if (typeof showAddDocumentModal === 'object' && showAddDocumentModal.id) {
                updateDocument(showAddDocumentModal.id, finalDoc);
              } else {
                addDocument({ ...finalDoc, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              setShowAddDocumentModal(null);
            }}
            onClose={() => setShowAddDocumentModal(null)}
            uploading={uploadingDocument}
          />
        )}

        {viewingDocument && (
          <DocumentViewer
            document={viewingDocument}
            propertyName={getPropertyName(viewingDocument.propertyId)}
            onClose={() => setViewingDocument(null)}
          />
        )}

        {/* Financial Modals */}
        {showAddTransactionModal && (
          <AddTransactionModal
            transaction={typeof showAddTransactionModal === 'object' ? showAddTransactionModal : null}
            properties={properties}
            onSave={(txnData) => {
              if (typeof showAddTransactionModal === 'object' && showAddTransactionModal.id) {
                updateTransaction(showAddTransactionModal.id, txnData);
              } else {
                addTransaction({ ...txnData, id: Date.now(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              setShowAddTransactionModal(null);
            }}
            onClose={() => setShowAddTransactionModal(null)}
          />
        )}

        {/* Rent Payment Modal */}
        {showAddRentModal && (
          <AddRentPaymentModal
            payment={typeof showAddRentModal === 'object' ? showAddRentModal : null}
            properties={properties}
            onSave={(paymentData) => {
              const { lateFee, ...payment } = paymentData;
              if (typeof showAddRentModal === 'object' && showAddRentModal.id) {
                updateRentPayment(showAddRentModal.id, payment);
              } else {
                addRentPayment({ ...payment, id: Date.now().toString(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              // Optional late charge → its own income record (type 'late-fee') so rent
              // reconciliation stays clean and the fee shows separately in Income.
              if (parseFloat(lateFee) > 0) {
                addRentPayment({
                  incomeType: 'late-fee', propertyId: payment.propertyId, propertyName: payment.propertyName,
                  tenantName: payment.tenantName || '', month: payment.month,
                  description: `Late fee — ${payment.propertyName || ''} ${payment.month || ''}`.trim(),
                  amount: parseFloat(lateFee), datePaid: payment.datePaid, status: 'paid',
                  id: (Date.now() + 1).toString(), createdAt: new Date().toISOString(), createdBy: currentUser,
                });
              }
              setShowAddRentModal(null);
            }}
            onDelete={(paymentId) => {
              setConfirmDialog({
                title: 'Delete Payment',
                message: 'Delete this rent payment record?',
                onConfirm: () => { deleteRentPayment(paymentId); setShowAddRentModal(null); setConfirmDialog(null); },
              });
            }}
            onClose={() => setShowAddRentModal(null)}
          />
        )}

        {/* Expense Modal */}
        {showAddExpenseModal && (
          <AddExpenseModal
            expense={typeof showAddExpenseModal === 'object' ? showAddExpenseModal : null}
            properties={properties}
            onUploadPhoto={uploadPhoto}
            onSave={(expenseData) => {
              if (typeof showAddExpenseModal === 'object' && showAddExpenseModal.id) {
                updateExpense(showAddExpenseModal.id, expenseData);
              } else {
                addExpense({ ...expenseData, id: Date.now().toString(), createdAt: new Date().toISOString(), createdBy: currentUser });
              }
              setShowAddExpenseModal(null);
            }}
            onDelete={(expenseId) => {
              setConfirmDialog({
                title: 'Delete Expense',
                message: 'Delete this expense record?',
                onConfirm: () => { deleteExpense(expenseId); setShowAddExpenseModal(null); setConfirmDialog(null); },
              });
            }}
            onClose={() => setShowAddExpenseModal(null)}
          />
        )}

        {/* Property Financial Breakdown Modal */}
        {showPropertyBreakdown && (
          <PropertyFinancialBreakdownModal
            properties={properties}
            rentPayments={rentPayments}
            expenses={expenses}
            onPropertyClick={(prop) => {
              setShowPropertyBreakdown(false);
              setActiveSection('rentals');
              setSelectedProperty(prop);
            }}
            onClose={() => setShowPropertyBreakdown(false)}
          />
        )}

        {/* Checklist Init Modal */}
        {showChecklistInitModal && (
          <ChecklistInitModal
            properties={properties}
            currentUser={currentUser}
            initialType={showChecklistInitModal !== 'create' ? showChecklistInitModal : null}
            onCreateChecklist={(checklist) => {
              addList(checklist);
              setShowChecklistInitModal(null);
              // Auto-open the detail modal for the new checklist
              setShowChecklistDetailModal(checklist);
            }}
            onClose={() => setShowChecklistInitModal(null)}
          />
        )}

        {/* Checklist Detail Modal */}
        {showChecklistDetailModal && (
          <ChecklistDetailModal
            checklist={
              // Always use latest data from sharedLists
              sharedLists.find(l => l.id === (showChecklistDetailModal.id || showChecklistDetailModal)) || showChecklistDetailModal
            }
            onClose={() => setShowChecklistDetailModal(null)}
            onToggleItem={toggleListItem}
            onAddItem={addListItem}
            onDeleteItem={deleteListItem}
            onUpdateChecklist={updateList}
            onUploadPhoto={uploadPhoto}
            getPropertyName={getPropertyName}
            currentUser={currentUser}
          />
        )}

        {/* Confirm Dialog */}
        {confirmDialog && (
          <ConfirmDialog
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border transition-all ${
            toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/30 text-white' :
            toast.type === 'error' ? 'bg-red-500/90 border-red-400/30 text-white' :
            'bg-slate-700/90 border-white/20 text-white'
          }`}>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        )}

        {/* Mobile Bottom Navigation with FAB */}
        {!anyModalOpen && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100]" style={{ transform: 'translateZ(0)' }}>
            {/* Nav bar */}
            <div className="relative mx-auto w-fit max-w-[97vw] bg-slate-900/80 backdrop-blur-xl border border-slate-600/40 rounded-full shadow-2xl" style={{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
              {/* Tab buttons — all sections, floating dock */}
              <div className="flex items-end justify-around gap-0.5 px-2 pt-1 pb-1 overflow-x-auto">
                {[
                  { id: 'action-items', label: 'Actions', emoji: '✅', gradient: 'from-indigo-400 to-purple-500' },
                  { id: 'rentals', label: 'Props', emoji: '🏠', gradient: 'from-teal-400 to-cyan-500' },
                  { id: 'tenants', label: 'Tenants', emoji: '👤', gradient: 'from-blue-400 to-indigo-500' },
                  { id: 'rent', label: 'Income', emoji: '💰', gradient: 'from-emerald-400 to-green-500' },
                  { id: 'expenses', label: 'Costs', emoji: '💸', gradient: 'from-red-400 to-rose-500' },
                  { id: 'dashboard', label: 'Home', emoji: '📊', gradient: 'from-purple-500 to-violet-500' },
                  { id: 'ownership', label: 'Own', emoji: '🤝', gradient: 'from-amber-400 to-yellow-500' },
                  { id: 'documents', label: 'Docs', emoji: '📄', gradient: 'from-amber-400 to-orange-500' },
                ].map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id);
                      if (section.id === 'rentals') { setSelectedProperty(null); setPropertyViewMode('grid'); }
                      setShowAddNewMenu(false);
                    }}
                    className="relative flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 min-w-[48px]"
                  >
                    <span className={`text-xl mb-0.5 transition-transform ${activeSection === section.id ? 'scale-110' : ''}`}>
                      {section.emoji}
                    </span>
                    <span className={`text-[10px] font-medium transition-colors ${activeSection === section.id ? 'text-white' : 'text-white/40'}`}>
                      {section.label}
                    </span>
                    {activeSection === section.id && (
                      <div className={`absolute -bottom-0.5 w-5 h-0.5 rounded-full bg-gradient-to-r ${section.gradient}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

          </nav>
        )}

        {/* Footer - desktop only */}
        <div className="hidden md:block text-center py-3 border-t border-white/5">
          <BuildInfo />
        </div>

        {/* Bottom rainbow bar - desktop only */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-orange-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500 hidden md:block" />
      </div>
    </SharedHubProvider>
  );
}

// Card for one pending expense-review item (pushed from Mike's Money bank data).
// Pick property + category, then Approve → expense record, or Dismiss.
function ExpenseReviewCard({ item, properties, onApprove, onDismiss }) {
  const [propertyId, setPropertyId] = useState(item.suggestedPropertyId || '');
  const [category, setCategory] = useState('repair');
  return (
    <div className="p-3 rounded-2xl border bg-sky-500/10 border-sky-500/20">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-sky-300 truncate">{item.description}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 shrink-0">
              {item.reason === 'liam' ? '👷 Liam' : item.reason === 'fifth-third' ? '🏦 5/3 acct' : '🏘️ tagged rental'}
            </span>
          </div>
          <div className="text-xs text-white/40 mt-0.5">{formatDate(item.date)}{item.detail && item.detail !== item.description ? ` · ${item.detail.slice(0, 60)}` : ''}</div>
        </div>
        <span className="text-sm font-bold text-sky-300 shrink-0">{formatCurrency(item.amount || 0)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <select value={propertyId} onChange={e => setPropertyId(e.target.value)}
          className="px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/50">
          <option value="">Property…</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.emoji || '🏠'} {p.name}</option>)}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-sky-500/50">
          {expenseCategories.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => onApprove({ propertyId, category })} disabled={!propertyId}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed">
          ✓ Rental expense
        </button>
        <button onClick={onDismiss}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/10 text-white/60 hover:bg-white/20">
          ✕ Not rental
        </button>
      </div>
    </div>
  );
}
