import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, LogOut, Loader, ChevronDown, HelpCircle } from 'lucide-react';

// Constants and utilities
import { ownerEmails, propertyAccess, documentTypes, expenseCategories, timeHorizons } from './constants';
import {
  formatDate, formatCurrency, validateFileSize, isHeicFile, getSafeFileName,
  taskMatchesHorizon
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

// Checklist components
import ChecklistInitModal from './components/Checklists/ChecklistInitModal';
import ChecklistDetailModal from './components/Checklists/ChecklistDetailModal';

// Rentals components
import PropertyCard from './components/Rentals/PropertyCard';
import NewPropertyModal from './components/Rentals/NewPropertyModal';
import PropertyDetail from './components/Rentals/PropertyDetail';
import SellVsHold from './components/Rentals/SellVsHold';
import TenantModal from './components/Rentals/TenantModal';

// Ownership components
import OwnershipView from './components/Ownership/OwnershipView';
import InvestorModal from './components/Ownership/InvestorModal';

// Tenants components
import TenantsList from './components/Tenants/TenantsList';

// Rent components
import RentLedger from './components/Rent/RentLedger';
import AddRentPaymentModal from './components/Rent/AddRentPaymentModal';
import RentDay from './components/Tenants/RentDay';
import ReminderComposer from './components/Tenants/ReminderComposer';
import RentReconciliation from './components/Rent/RentReconciliation';

// Expenses components
import ExpensesList from './components/Expenses/ExpensesList';
import AddExpenseModal from './components/Expenses/AddExpenseModal';
import CardInbox from './components/Expenses/CardInbox';

// Documents components
import DocumentCard from './components/Documents/DocumentCard';
import AddDocumentModal from './components/Documents/AddDocumentModal';
import DocumentViewer from './components/Documents/DocumentViewer';

// Hooks
import { useSharedHub } from './hooks/useSharedHub';
import { useProperties, getPropertyTenants } from './hooks/useProperties';
import { leaseAlerts } from './rentLogic.js';
import { useDocuments } from './hooks/useDocuments';
import { useRent } from './hooks/useRent';
import { useExpenses, autoCreateRecurringExpenses, sanitizeForFirestore } from './hooks/useExpenses';
import { useOwnership } from './hooks/useOwnership';

// Contexts
import { SharedHubProvider } from './contexts/SharedHubContext';
import BuildInfo from './components/BuildInfo';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, runTransaction, arrayUnion } from 'firebase/firestore';
import { requestPushToken, listenForeground } from './messaging';
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


// App sections. `dock: true` = in the 5-slot phone dock; everything is in the desktop nav
// and the phone dropdown. Deep-link with ?section=<id>.
const SECTIONS = [
  { id: 'action-items', label: 'Home', short: 'Home', emoji: '✅', dock: true, gradient: 'from-indigo-400 to-purple-500' },
  { id: 'rentals', label: 'Properties', short: 'Props', emoji: '🏠', dock: true, gradient: 'from-teal-400 to-cyan-500' },
  { id: 'tenants', label: 'Tenants', short: 'Tenants', emoji: '👤', dock: true, gradient: 'from-blue-400 to-indigo-500' },
  { id: 'expenses', label: 'Expenses', short: 'Costs', emoji: '💸', dock: true, gradient: 'from-red-400 to-rose-500' },
  { id: 'money', label: 'Money', short: 'Money', emoji: '💰', dock: true, gradient: 'from-emerald-400 to-green-500' },
  { id: 'ownership', label: 'Ownership', short: 'Own', emoji: '🤝', dock: false, gradient: 'from-amber-400 to-yellow-500' },
  { id: 'documents', label: 'Documents', short: 'Docs', emoji: '📄', dock: false, gradient: 'from-amber-400 to-orange-500' },
];
const MONEY_VIEWS = [
  { id: 'pnl', label: 'P&L', emoji: '📊' },
  { id: 'grid', label: 'Rent grid', emoji: '⚖️' },
  { id: 'ledger', label: 'Ledger', emoji: '🧾' },
];

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
  const [moneyView, setMoneyView] = useState('pnl'); // Money tab: pnl | grid | ledger
  const [currentUser, setCurrentUser] = useState('Mike');
  const [isOwner, setIsOwner] = useState(false);
  const [showMobileSectionDropdown, setShowMobileSectionDropdown] = useState(false);
  const [dashboardReportMonth, setDashboardReportMonth] = useState(null); // null = current month, 0-11 = specific month, 12 = YTD
  const [pushState, setPushState] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [incomeActuals, setIncomeActuals] = useState(null); // bank deposits from mikesmoney (rupert bridge)
  const [cardInbox, setCardInbox] = useState(null); // Citi •4793 charges to confirm (rupert bridge)
  const [handledInboxIds, setHandledInboxIds] = useState([]); // optimistic hide after confirm/dismiss
  const [expenseReviewItems, setExpenseReviewItems] = useState([]); // bank txns pushed from mikes-money for review
  const [dashboardReportYear, setDashboardReportYear] = useState(new Date().getFullYear());
  // Foreground pushes (app open) arrive here instead of the system tray — show them as a toast.
  useEffect(() => {
    if (!user) return;
    listenForeground((payload) => {
      const n = payload?.notification || {};
      showToast && showToast(`${n.title || 'Rainbow Rentals'}${n.body ? ' — ' + n.body : ''}`, 'info');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
  const saveRentRef = useRef(() => {});
  const saveOwnershipRef = useRef(() => {});
  const expensesSaveIdRef = useRef(null); // Track our own saves to avoid onSnapshot overwrite

  // ========== HOOKS ==========
  const sharedHub = useSharedHub(currentUser, saveSharedHubRef.current, showToast);
  const {
    sharedTasks: _allTasks, sharedLists: _allLists, sharedIdeas,
    addTask, updateTask, deleteTask, completeTask, highlightTask,
    addList, updateList, addListItem, toggleListItem, deleteListItem,
    addIdea, updateIdea,
    hubTaskFilter, setHubTaskFilter, hubTaskSort, setHubTaskSort,
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

  // Single navigation entry point: every tab/dock/deep-link/search goes through here.
  const goTo = useCallback((id, opts = {}) => {
    if (!SECTIONS.some(sec => sec.id === id)) id = 'action-items';
    setActiveSection(id);
    if (id === 'rentals') { setSelectedProperty(null); setPropertyViewMode(opts.propertyView || 'grid'); }
    if (id === 'money' && opts.moneyView) setMoneyView(opts.moneyView);
    setShowMobileSectionDropdown(false);
    setShowSearch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const documentsHook = useDocuments(currentUser, saveDocumentsRef.current, showToast);
  const {
    documents: _allDocuments, setDocuments,
    documentViewMode, setDocumentViewMode,
    showAddDocumentModal, setShowAddDocumentModal,
    addDocument: _addDocument, updateDocument: _updateDocument, deleteDocument: _deleteDocument,
  } = documentsHook;

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
  // every downstream `properties/rentPayments/expenses/documents/sharedTasks`
  // is the filtered view for a restricted owner; full managers (no match) see everything. ----
  const _accessMatch = propertyAccess[(user?.email || '').toLowerCase()];
  const canManage = !_accessMatch; // managers can edit rents/leases/expenses; restricted owners can't
  const _match = (p) => `${p.name || ''} ${p.street || ''} ${p.city || ''}`.toLowerCase().includes(_accessMatch);
  const properties = _accessMatch ? _allProperties.filter(_match) : _allProperties;
  const _visibleIds = new Set(properties.map((p) => String(p.id)));
  const _inScope = (pid) => _visibleIds.has(String(pid));
  const rentPayments = _accessMatch ? _allRent.filter((r) => _inScope(r.propertyId)) : _allRent;
  const expenses = _accessMatch ? _allExpenses.filter((e) => _inScope(e.propertyId)) : _allExpenses;
  const documents = _accessMatch ? _allDocuments.filter((d) => _inScope(d.propertyId)) : _allDocuments;
  const sharedTasks = _accessMatch ? _allTasks.filter((t) => _inScope(t.linkedTo?.propertyId)) : _allTasks;
  const sharedLists = _accessMatch ? _allLists.filter((l) => _inScope(l.linkedTo?.itemId)) : _allLists;

  const ownershipHook = useOwnership(currentUser, saveOwnershipRef.current, showToast);
  const {
    investors, setInvestors,
    showInvestorModal, setShowInvestorModal,
    addInvestor, updateInvestor, deleteInvestor,
  } = ownershipHook;

  // ========== TENANT COMMS (Rent Day) ==========
  // rentalData/comms — { settings: { payInstructions, fromName, dueDay, graceDays, lateFee },
  // log: [...] } — every reminder/text/email/call/note logged by either operator (capped 500,
  // newest first) so "did anyone nudge them yet?" has an answer.
  const [commsSettings, setCommsSettings] = useState({});
  const [commsLog, setCommsLog] = useState([]);
  const [showReminder, setShowReminder] = useState(null); // { property, tenant, monthKey, templateId, ... }
  // Message log writes go through a transaction so two devices (or the server cron and
  // the phone) can't overwrite each other's entries. Local state is updated optimistically;
  // the onSnapshot above reconciles.
  const commsRef = doc(db, 'rentalData', 'comms');
  const logComm = useCallback(async (entry) => {
    if (!user) return;
    setCommsLog(prev => [entry, ...prev.filter(e => e.id !== entry.id)].slice(0, 500));
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(commsRef);
        const log = snap.exists() && Array.isArray(snap.data().log) ? snap.data().log : [];
        const next = [entry, ...log.filter(e => e.id !== entry.id)].slice(0, 500);
        tx.set(commsRef, JSON.parse(JSON.stringify({ log: next, lastUpdated: entry.at })), { merge: true });
      });
    } catch (e) { console.error('comms save:', e); showToast && showToast('Message not logged — ' + e.message, 'error'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const patchComm = useCallback(async (id, patch) => {
    setCommsLog(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(commsRef);
        const log = snap.exists() && Array.isArray(snap.data().log) ? snap.data().log : [];
        const next = log.map(e => e.id === id ? { ...e, ...patch } : e);
        tx.set(commsRef, JSON.parse(JSON.stringify({ log: next, lastUpdated: new Date().toISOString() })), { merge: true });
      });
    } catch (e) { console.error('comms patch:', e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send a text through the server (Twilio). The function logs to rentalData/comms itself;
  // the onSnapshot above picks it up. Needs the manager's Firebase ID token.
  const sendSmsViaServer = useCallback(async (payload) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not signed in');
    const r = await fetch('/api/sms/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    logActivity('sms', `→ ${payload.tenantName || payload.to} (${payload.propertyName || ''})`);
    return j;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCommsSettings = useCallback(async (settings) => {
    setCommsSettings(settings);
    try {
      await setDoc(doc(db, 'rentalData', 'comms'), JSON.parse(JSON.stringify({ settings, lastUpdated: new Date().toISOString() })), { merge: true });
      showToast && showToast('Reminder settings saved', 'success');
    } catch (e) { console.error('comms settings save:', e); showToast && showToast('Not saved — ' + e.message, 'error'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const restoreTrashItem = useCallback((item) => {
    const p = item.payload || {};
    if (item.type === 'rent') _addRentPayment(p);
    else if (item.type === 'expense') _addExpense(p);
    else if (item.type === 'property') _addProperty(p);
    else if (item.type === 'document') _addDocument(p);
    removeFromTrash(item.trashId);
    logActivity('restore', `${item.type}: ${p.name || p.description || p.propertyName || ''}`);
  }, [_addRentPayment, _addExpense, _addProperty, _addDocument, removeFromTrash, logActivity]);

  // ========== EXPORT ==========
  const buildExportPayload = useCallback(() => ({
    exportedAt: new Date().toISOString(), exportedBy: currentUser || 'unknown',
    properties: _allProperties, rentPayments: _allRent, expenses: _allExpenses,
    documentsIndex: _allDocuments.map(({ fileData, ...meta }) => meta),
    investors, sharedTasks: _allTasks, sharedLists: _allLists, sharedIdeas, commsLog, commsSettings,
  }), [currentUser, _allProperties, _allRent, _allExpenses, _allDocuments, investors, _allTasks, _allLists, sharedIdeas, commsLog, commsSettings]);

  const exportAllData = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildExportPayload(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rainbow-rentals-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    logActivity('export', 'full JSON export downloaded');
    showToast('Export downloaded', 'success');
  }, [buildExportPayload, logActivity, showToast]);

  // Weekly Firestore snapshot (rentalData/backup-YYYY-MM-DD, keeps 8) is written by the
  // daily cron in api/cron/reminders.js — nothing to do client-side.

  // Document viewer
  const [viewingDocument, setViewingDocument] = useState(null);

  // Checklist modals
  const [showChecklistInitModal, setShowChecklistInitModal] = useState(null);
  const [showChecklistDetailModal, setShowChecklistDetailModal] = useState(null);

  // Deep-link: ?section=<id> (push notifications, help links). Aliases: analysis → Properties
  // overview, rentday → Home.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const sec = p.get('section');
      if (!sec) return;
      if (sec === 'analysis') goTo('rentals', { propertyView: 'overview' });
      else if (sec === 'rentday') goTo('action-items');
      else if (['pnl', 'grid', 'ledger'].includes(sec)) goTo('money', { moneyView: sec });
      else goTo(sec);
      window.history.replaceState({}, '', window.location.pathname);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          const displayName = userEmail?.includes('mdulin') ? 'Mike' : userEmail?.includes('adam') ? 'Adam' : userEmail?.includes('liam') ? 'Liam' : (userEmail || '').split('@')[0];
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
          if (Array.isArray(data.expenses) && (data.expenses.length > 0 || data.clearedAt)) {
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
    const u4 = onSnapshot(doc(db, 'rentalData', 'comms'),
      (snap) => { if (snap.exists()) { const d = snap.data(); setCommsLog(d.log || []); setCommsSettings(d.settings || {}); } },
      (e) => console.error('comms load:', e));
    return () => { u1(); u2(); u4(); };
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

  // ========== SEARCH ==========
  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results = [];

    sharedTasks.filter(t => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .forEach(t => results.push({ type: 'task', item: t, section: 'action-items' }));
    properties.filter(p => p.name?.toLowerCase().includes(q) || (p.street || '').toLowerCase().includes(q) || getPropertyTenants(p).some(t => t.name?.toLowerCase().includes(q)))
      .forEach(p => results.push({ type: 'property', item: p, section: 'rentals' }));
    documents.filter(d => d.title?.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q))
      .forEach(d => results.push({ type: 'document', item: d, section: 'documents' }));
    rentPayments.filter(r => (r.tenantName || '').toLowerCase().includes(q) || (r.propertyName || '').toLowerCase().includes(q) || (r.month || '').includes(q))
      .forEach(r => results.push({ type: 'rent', item: r, section: 'money' }));
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
          <p className="text-sm text-white/50 mb-6">You're signed in as {user.email}, which doesn't have access to Rainbow Rentals. Ask Michael if you think you should.</p>
          <button onClick={handleLogout} className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold">Sign out</button>
        </div>
      </div>
    );
  }

  // Check if any modal is open (to hide nav)
  const anyModalOpen = showAddTaskModal || showSharedListModal || showAddIdeaModal ||
    showNewPropertyModal || showTenantModal || showAddDocumentModal ||
    showAddRentModal || showAddExpenseModal || viewingDocument || selectedProperty ||
    showChecklistInitModal || showChecklistDetailModal || showInvestorModal || showReminder;

  const activeSectionInfo = SECTIONS.find(sec => sec.id === activeSection) || SECTIONS[0];

  // Filter properties by status - use propertyStatus if set, otherwise derive from tenant
  const getEffectiveStatus = (p) => p.propertyStatus || (getPropertyTenants(p).length > 0 ? 'occupied' : 'vacant');
  // "owner-occupied" counts as occupied/rented for dashboard purposes
  const vacantProperties = properties.filter(p => getEffectiveStatus(p) === 'vacant');
  const renovationProperties = properties.filter(p => getEffectiveStatus(p) === 'renovation');
  const notCollectingRent = properties.filter(p => ['vacant', 'renovation'].includes(getEffectiveStatus(p)));
  const activeProperties = properties.filter(p => ['occupied', 'owner-occupied'].includes(getEffectiveStatus(p)));

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
                      {SECTIONS.map(section => (
                        <button
                          key={section.id}
                          onClick={() => goTo(section.id)}
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
                <h1 className="text-lg font-bold text-white leading-tight">Rainbow Rentals</h1>
              </div>
              {/* Desktop nav tabs */}
              <nav className="hidden md:flex items-center gap-1 ml-6">
                {SECTIONS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => goTo(tab.id)}
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
              <a href="/help.html" target="_blank" rel="noopener" title="How to use this app"
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                <HelpCircle className="w-4 h-4 text-white/60" />
              </a>
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
                      goTo(result.section, result.type === 'rent' ? { moneyView: 'ledger' } : {});
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
              {/* ========== MONEY SECTION: P&L / rent grid / ledger ========== */}
              {activeSection === 'money' && (
                <div className="flex gap-1.5 mb-4 items-center sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                  {MONEY_VIEWS.map(v => (
                    <button key={v.id} onClick={() => setMoneyView(v.id)} aria-pressed={moneyView === v.id}
                      className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition ${
                        moneyView === v.id ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      }`}><span className="mr-1">{v.emoji}</span>{v.label}</button>
                  ))}
                </div>
              )}

              {activeSection === 'money' && moneyView === 'grid' && (
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

              {activeSection === 'money' && moneyView === 'pnl' && (
                <div>
                  <h2 className="text-xl font-bold text-white">Profit & Loss</h2>
                  <p className="text-xs text-white/40 mb-4">Income by the rent month a payment is for; expenses by expense date. Cash received by date is on the Rent grid.</p>

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
                            { id: 'grid', emoji: '🏠', label: 'Property cards' },
                            { id: 'tasks', emoji: '📋', label: 'Tasks by property' },
                            { id: 'overview', emoji: '📊', label: 'Portfolio overview' },
                          ].map(tab => (
                            <button key={tab.id} onClick={() => setPropertyViewMode(tab.id)} aria-label={tab.label} title={tab.label} aria-pressed={propertyViewMode === tab.id}
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

                          {/* Sell vs hold analysis + Rupert review (managers only) */}
                          <SellVsHold db={db} properties={properties} expenses={expenses} canManage={canManage} currentUser={currentUser} showToast={showToast} />
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
                  canManage={canManage}
                  onTextTenant={(propertyId, tenant) => {
                    const prop = properties.find(p => String(p.id) === String(propertyId));
                    if (prop) setShowReminder({ property: prop, tenant, monthKey: new Date().toISOString().slice(0, 7), templateId: 'custom' });
                  }}
                  onDeleteTenant={(propertyId, tenant) => {
                    const prop = properties.find(p => String(p.id) === String(propertyId));
                    setConfirmDialog({
                      title: 'Remove tenant',
                      message: `Remove ${tenant.name} from ${prop?.name || 'this property'}? Their rent history stays; only the tenant record goes.`,
                      onConfirm: () => { removeTenant(propertyId, tenant.id); setConfirmDialog(null); showToast(`${tenant.name} removed`, 'info'); },
                    });
                  }}
                  onImportTenants={(items) => {
                    items.forEach(({ propertyId, tenant }) => addOrUpdateTenant(propertyId, tenant));
                    showToast(`${items.length} tenant${items.length === 1 ? '' : 's'} updated`, 'success');
                  }}
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
                    if (prop) { goTo('rentals'); setSelectedProperty(prop); }
                  }}
                />
              )}

              {/* ---- Money: ledger ---- */}
              {activeSection === 'money' && moneyView === 'ledger' && (
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

                  {/* ---- Rent Day: this month's collections, replies, reminders, earlier months owed ---- */}
                  <div className="mb-8">
                    <RentDay
                      properties={properties}
                      rentPayments={rentPayments}
                      commsLog={commsLog}
                      settings={commsSettings}
                      currentUser={currentUser}
                      canManage={canManage}
                      onSaveSettings={saveCommsSettings}
                      onCompose={(target) => setShowReminder(target)}
                      onRecord={(prefill) => setShowAddRentModal(prefill)}
                      onPatchLog={patchComm}
                      onSendSms={sendSmsViaServer}
                      onEnableAlerts={enableAlerts}
                      pushState={pushState}
                      incomeActuals={incomeActuals}
                    />
                  </div>

                  {/* Lease Alerts — fixed-term leases expired, or any lease ending within 30 days.
                      Leases past their end date are month-to-month unless marked fixed-term. */}
                  {(() => {
                    const alerts = leaseAlerts(properties);
                    if (alerts.length === 0) return null;
                    return (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Lease Alerts</h3>
                        <div className="space-y-2">
                          {alerts.map(alert => (
                            <button
                              key={`${alert.property.id}-${alert.tenant.id || alert.tenant.name}`}
                              onClick={() => setShowTenantModal({ ...alert.property, _editTenant: alert.tenant })}
                              className={`w-full text-left p-3 rounded-2xl border transition ${
                                alert.kind === 'expired' ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15' : 'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/15'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{alert.property.emoji || '🏠'}</span>
                                  <span className={`text-sm font-medium ${alert.color}`}>{alert.property.name}</span>
                                  {alert.tenant.name && <span className="text-xs text-white/40">({alert.tenant.name})</span>}
                                </div>
                                <span className={`text-xs font-semibold ${alert.color}`}>{alert.label}</span>
                              </div>
                              <p className="text-[11px] text-white/40 mt-1">
                                {alert.kind === 'expired' ? 'Fixed-term lease ended — renew, or mark it month-to-month' : 'Lease ends soon — renew or let it roll to month-to-month'}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* To-Do List */}
                  <div className="mb-6">
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

                  {/* Active Move-In/Move-Out Checklists */}
                  {(() => {
                    const activeChecklists = sharedLists.filter(l =>
                      (l.category === 'move-in' || l.category === 'move-out' || l.category === 'leasing') && l.status !== 'archived'
                    );
                    return (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Checklists</h3>
                          <button onClick={() => setShowChecklistInitModal('create')} className="text-xs text-teal-400 hover:text-teal-300 font-medium">+ New</button>
                        </div>
                        {activeChecklists.length === 0 ? (
                          <p className="text-center text-white/30 py-6">No checklists in progress</p>
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
                                  description: item.description,
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

                  {/* ---- Less-used: this week's changes, export, recently deleted ---- */}
                  {canManage && (
                    <details className="mb-6">
                      <summary className="cursor-pointer select-none text-sm font-semibold text-white/40 uppercase tracking-wide hover:text-white/60">More — this week, export, recently deleted</summary>
                      <div className="mt-3">
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
                              <button onClick={exportAllData} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-xs font-semibold" title="Download a full JSON export of all data (a snapshot is also saved to Firestore weekly)">⬇ Export data</button>
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
                            {recent.length === 0 && <p className="text-xs text-white/30">Change history starts now — your edits will appear here.</p>}
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

                      </div>
                    </details>
                  )}

                </div>
              )}

              {/* ========== DOCUMENTS SECTION ========== */}
              {activeSection === 'documents' && (
                <div>
                  {/* Sub-nav */}
                  <div className="flex gap-1.5 mb-4 items-center justify-between sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                    <div className="flex gap-1.5">
                      {[
                        { id: 'byType', emoji: '📁', label: 'By type' },
                        { id: 'byProperty', emoji: '🏠', label: 'By property' },
                        { id: 'all', emoji: '📄', label: 'All documents' },
                      ].map(tab => (
                        <button key={tab.id} onClick={() => setDocumentViewMode(tab.id)} aria-label={tab.label} title={tab.label} aria-pressed={documentViewMode === tab.id}
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
            onDelete={(tenant) => {
              const pid = showTenantModal?.id;
              const prop = properties.find(p => String(p.id) === String(pid));
              setConfirmDialog({
                title: 'Remove tenant',
                message: `Remove ${tenant.name} from ${prop?.name || 'this property'}? Their rent history stays; only the tenant record goes.`,
                onConfirm: () => {
                  removeTenant(pid, tenant.id);
                  setConfirmDialog(null);
                  setShowTenantModal(null);
                  if (selectedProperty && String(selectedProperty.id) === String(pid)) {
                    const left = getPropertyTenants(selectedProperty).filter(t => String(t.id) !== String(tenant.id));
                    setSelectedProperty({ ...selectedProperty, tenants: left, tenant: left[0] || null });
                  }
                  showToast(`${tenant.name} removed`, 'info');
                },
              });
            }}
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

        {/* Rent Payment Modal */}
        {showReminder && (
          <ReminderComposer
            target={showReminder}
            settings={commsSettings}
            currentUser={currentUser}
            showToast={showToast}
            onLog={(entry) => { logComm(entry); logActivity('reminder', `${entry.channel} → ${entry.tenantName} (${entry.propertyName})`); }}
            onSendSms={sendSmsViaServer}
            onClose={() => setShowReminder(null)}
          />
        )}

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
                {SECTIONS.filter(sec => sec.dock).map((section) => (
                  <button
                    key={section.id}
                    onClick={() => goTo(section.id)}
                    className="relative flex flex-col items-center justify-center py-2 rounded-xl transition-all active:scale-95 min-w-[56px]"
                  >
                    <span className={`text-xl mb-0.5 transition-transform ${activeSection === section.id ? 'scale-110' : ''}`}>
                      {section.emoji}
                    </span>
                    <span className={`text-[10px] font-medium transition-colors ${activeSection === section.id ? 'text-white' : 'text-white/40'}`}>
                      {section.short}
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
              {item.reason === 'liam' ? '🏦 bank txn' : item.reason === 'fifth-third' ? '🏦 5/3 acct' : '🏘️ tagged rental'}
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
