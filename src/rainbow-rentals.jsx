import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Search, LogOut, User, Loader, MoreVertical, ChevronDown, Edit3, Trash2, Eye, DollarSign, MapPin, Calendar, FileText, CheckSquare } from 'lucide-react';

// Constants and utilities
import {
  ownerEmails, propertyTypes, propertyColors, documentTypes,
  expenseCategories, incomeCategories, taskPriorities, timeHorizons,
  listCategories, ideaCategories, tenantStatuses
} from './constants';
import {
  formatDate, formatCurrency, validateFileSize, isHeicFile, getSafeFileName,
  isTaskDueToday, isTaskDueThisWeek, taskMatchesHorizon, getDaysUntil, getLeaseStatus
} from './utils';

// Components
import LoginScreen from './components/LoginScreen';
import ConfirmDialog from './components/ConfirmDialog';

// Hub components
import AddTaskModal from './components/SharedHub/AddTaskModal';
import SharedListModal from './components/SharedHub/SharedListModal';
import AddIdeaModal from './components/SharedHub/AddIdeaModal';
import TaskCard from './components/SharedHub/TaskCard';
import ListCard from './components/SharedHub/ListCard';
import IdeaCard from './components/SharedHub/IdeaCard';

// Rentals components
import PropertyCard from './components/Rentals/PropertyCard';
import NewPropertyModal from './components/Rentals/NewPropertyModal';
import PropertyDetail from './components/Rentals/PropertyDetail';
import TenantModal from './components/Rentals/TenantModal';

// Documents components
import DocumentCard from './components/Documents/DocumentCard';
import AddDocumentModal from './components/Documents/AddDocumentModal';
import DocumentViewer from './components/Documents/DocumentViewer';

// Financials components
import TransactionCard from './components/Financials/TransactionCard';
import AddTransactionModal from './components/Financials/AddTransactionModal';
import FinancialSummary from './components/Financials/FinancialSummary';

// Hooks
import { useSharedHub } from './hooks/useSharedHub';
import { useProperties } from './hooks/useProperties';
import { useDocuments } from './hooks/useDocuments';
import { useFinancials } from './hooks/useFinancials';

// Contexts
import { SharedHubProvider } from './contexts/SharedHubContext';
import BuildInfo from './components/BuildInfo';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
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
  const [activeSection, setActiveSection] = useState('home');
  const [currentUser, setCurrentUser] = useState('Mike');
  const [isOwner, setIsOwner] = useState(false);
  const [showAddNewMenu, setShowAddNewMenu] = useState(false);

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

  // ========== HOOKS ==========
  const sharedHub = useSharedHub(currentUser, saveSharedHubRef.current, showToast);
  const {
    sharedTasks, sharedLists, sharedIdeas,
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
    properties, setProperties,
    selectedProperty, setSelectedProperty,
    propertyViewMode, setPropertyViewMode,
    showNewPropertyModal, setShowNewPropertyModal,
    showTenantModal, setShowTenantModal,
    addProperty, updateProperty, deleteProperty, updateTenant, removeTenant,
  } = propertiesHook;

  const documentsHook = useDocuments(currentUser, saveDocumentsRef.current, showToast);
  const {
    documents, setDocuments,
    documentViewMode, setDocumentViewMode,
    documentTypeFilter, setDocumentTypeFilter,
    documentPropertyFilter, setDocumentPropertyFilter,
    showAddDocumentModal, setShowAddDocumentModal,
    addDocument, updateDocument, deleteDocument,
  } = documentsHook;

  const financialsHook = useFinancials(currentUser, saveFinancialsRef.current, showToast);
  const {
    transactions, setTransactions,
    financialViewMode, setFinancialViewMode,
    transactionTypeFilter, setTransactionTypeFilter,
    transactionPropertyFilter, setTransactionPropertyFilter,
    showAddTransactionModal, setShowAddTransactionModal,
    addTransaction, updateTransaction, deleteTransaction,
    getTotalIncome, getTotalExpenses, getProfit, getMonthlyBreakdown, getPropertyBreakdown, getFilteredTransactions,
  } = financialsHook;

  // Document viewer
  const [viewingDocument, setViewingDocument] = useState(null);

  // ========== AUTH ==========
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMountedRef.current) return;
      if (firebaseUser) {
        setUser(firebaseUser);
        const userEmail = firebaseUser.email?.toLowerCase();
        const isOwnerUser = ownerEmails.some(email => userEmail?.includes(email.split('@')[0]));
        setIsOwner(isOwnerUser);
        if (isOwnerUser) {
          const displayName = userEmail?.includes('mdulin') ? 'Mike' : 'Liam';
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
      const updates = { lastUpdated: new Date().toISOString(), updatedBy: currentUser };
      if (newLists !== null && newLists !== undefined) updates.lists = newLists;
      if (newTasks !== null && newTasks !== undefined) updates.tasks = newTasks;
      if (newIdeas !== null && newIdeas !== undefined) updates.ideas = newIdeas;
      await setDoc(doc(db, 'rentalData', 'sharedHub'), updates, { merge: true });
    } catch (error) {
      console.error('Error saving shared hub:', error);
      showToast('Failed to save. Please try again.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveSharedHubRef.current = saveSharedHub; }, [saveSharedHub]);

  const savePropertiesToFirestore = useCallback(async (newProperties) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'rentalData', 'properties'), {
        properties: newProperties,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser
      }, { merge: true });
    } catch (error) {
      console.error('Error saving properties:', error);
      showToast('Failed to save property data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { savePropertiesRef.current = savePropertiesToFirestore; }, [savePropertiesToFirestore]);

  const saveDocumentsToFirestore = useCallback(async (newDocuments) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'rentalData', 'documents'), {
        documents: newDocuments,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser
      }, { merge: true });
    } catch (error) {
      console.error('Error saving documents:', error);
      showToast('Failed to save document data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveDocumentsRef.current = saveDocumentsToFirestore; }, [saveDocumentsToFirestore]);

  const saveFinancialsToFirestore = useCallback(async (newTransactions) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'rentalData', 'financials'), {
        transactions: newTransactions,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser
      }, { merge: true });
    } catch (error) {
      console.error('Error saving financials:', error);
      showToast('Failed to save financial data.', 'error');
    }
  }, [user, currentUser, showToast]);

  useEffect(() => { saveFinancialsRef.current = saveFinancialsToFirestore; }, [saveFinancialsToFirestore]);

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

    return () => {
      hubUnsubscribe();
      propertiesUnsubscribe();
      documentsUnsubscribe();
      financialsUnsubscribe();
    };
  }, [user]);

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
      const property = properties.find(p => p.id === propertyId);
      if (property) {
        const photos = [...(property.photos || []), { id: Date.now(), url, addedAt: new Date().toISOString() }];
        updateProperty(propertyId, { photos });
        showToast('Photo added!', 'success');
      }
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
    properties.filter(p => p.name?.toLowerCase().includes(q) || p.address?.street?.toLowerCase().includes(q) || p.tenant?.name?.toLowerCase().includes(q))
      .forEach(p => results.push({ type: 'property', item: p, section: 'rentals' }));
    documents.filter(d => d.title?.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q))
      .forEach(d => results.push({ type: 'document', item: d, section: 'documents' }));
    transactions.filter(t => t.description?.toLowerCase().includes(q))
      .forEach(t => results.push({ type: 'transaction', item: t, section: 'financials' }));

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

  // Check if any modal is open (to hide nav)
  const anyModalOpen = showAddTaskModal || showSharedListModal || showAddIdeaModal ||
    showNewPropertyModal || showTenantModal || showAddDocumentModal || showAddTransactionModal ||
    viewingDocument || selectedProperty;

  // Filter tasks for Hub dashboard
  const pendingTasks = sharedTasks.filter(t => t.status !== 'done');
  const todayTasks = pendingTasks.filter(isTaskDueToday);
  const overdueTasks = pendingTasks.filter(t => {
    if (!t.dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return t.dueDate < today;
  });

  // Filter properties by status
  const vacantProperties = properties.filter(p => !p.tenant || p.tenant.status === 'vacant');
  const activeProperties = properties.filter(p => p.tenant?.status === 'active');

  return (
    <SharedHubProvider value={sharedHub}>
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
        <RainbowBar />

        {/* Header */}
        <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-white/10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-red-500 via-green-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-sm font-bold text-white">RR</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">Rainbow Reality</h1>
                <p className="text-[10px] text-white/40 leading-tight">{currentUser}'s Dashboard</p>
              </div>
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

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-4 pb-32">
          {dataLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="w-8 h-8 text-teal-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* ========== HUB SECTION ========== */}
              {activeSection === 'home' && (
                <div>
                  {/* Sub-nav */}
                  <div className="flex gap-1.5 mb-4 items-center justify-start sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                    {[
                      { id: 'home', emoji: '🏠' },
                      { id: 'tasks', emoji: '✅' },
                      { id: 'lists', emoji: '📋' },
                      { id: 'ideas', emoji: '💡' },
                    ].map(tab => (
                      <button key={tab.id} onClick={() => setHubSubView(tab.id)}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-xl font-medium transition text-base md:text-lg text-center ${
                          hubSubView === tab.id ? 'bg-purple-500 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}>{tab.emoji}</button>
                    ))}
                  </div>

                  {/* Hub Home Dashboard */}
                  {hubSubView === 'home' && (
                    <div className="space-y-4">
                      {/* Quick stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                          <p className="text-white/40 text-xs mb-1">Properties</p>
                          <p className="text-2xl font-bold text-teal-400">{properties.length}</p>
                          <p className="text-xs text-white/40">{vacantProperties.length} vacant</p>
                        </div>
                        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                          <p className="text-white/40 text-xs mb-1">Tasks Due Today</p>
                          <p className="text-2xl font-bold text-amber-400">{todayTasks.length}</p>
                          <p className="text-xs text-white/40">{overdueTasks.length} overdue</p>
                        </div>
                        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                          <p className="text-white/40 text-xs mb-1">Monthly Income</p>
                          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(getTotalIncome())}</p>
                        </div>
                        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                          <p className="text-white/40 text-xs mb-1">Net Profit</p>
                          <p className={`text-2xl font-bold ${getProfit() >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(getProfit())}</p>
                        </div>
                      </div>

                      {/* Recent tasks */}
                      {pendingTasks.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-white/60 mb-2 uppercase tracking-wide">Upcoming Tasks</h3>
                          <div className="space-y-2">
                            {pendingTasks.slice(0, 5).map(task => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                onComplete={() => completeTask(task.id)}
                                onEdit={() => setShowAddTaskModal(task)}
                                onDelete={() => deleteTask(task.id)}
                                onHighlight={() => highlightTask(task.id)}
                                showToast={showToast}
                                currentUser={currentUser}
                                getEventLabel={() => null}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vacant properties alert */}
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
                    </div>
                  )}

                  {/* Tasks View */}
                  {hubSubView === 'tasks' && (
                    <div>
                      <div className="flex gap-2 mb-4 flex-wrap">
                        {timeHorizons.map(h => (
                          <button key={h.value} onClick={() => setHubTaskFilter(h.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              hubTaskFilter === h.value ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}>{h.label}</button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {sharedTasks
                          .filter(t => t.status !== 'done')
                          .filter(t => taskMatchesHorizon(t, hubTaskFilter))
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
                              getEventLabel={() => null}
                            />
                          ))}
                        {sharedTasks.filter(t => t.status !== 'done').filter(t => taskMatchesHorizon(t, hubTaskFilter)).length === 0 && (
                          <p className="text-center text-white/30 py-8">No tasks match this filter</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Lists View */}
                  {hubSubView === 'lists' && (
                    <div className="space-y-2">
                      {sharedLists.map(list => (
                        <ListCard
                          key={list.id}
                          list={list}
                          onEdit={() => setShowSharedListModal(list)}
                          onDelete={() => deleteList(list.id)}
                          onToggleItem={(itemId) => toggleListItem(list.id, itemId)}
                          onDeleteItem={(itemId) => deleteListItem(list.id, itemId)}
                          onHighlight={() => highlightList(list.id)}
                          showToast={showToast}
                          currentUser={currentUser}
                        />
                      ))}
                      {sharedLists.length === 0 && (
                        <p className="text-center text-white/30 py-8">No lists yet</p>
                      )}
                    </div>
                  )}

                  {/* Ideas View */}
                  {hubSubView === 'ideas' && (
                    <div className="space-y-2">
                      {sharedIdeas.map(idea => (
                        <IdeaCard
                          key={idea.id}
                          idea={idea}
                          onEdit={() => setShowAddIdeaModal(idea)}
                          onDelete={() => deleteIdea(idea.id)}
                          onHighlight={() => highlightIdea(idea.id)}
                          onPromoteToTask={() => promoteIdeaToTask(idea)}
                          showToast={showToast}
                          currentUser={currentUser}
                        />
                      ))}
                      {sharedIdeas.length === 0 && (
                        <p className="text-center text-white/30 py-8">No ideas yet</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ========== RENTALS SECTION ========== */}
              {activeSection === 'rentals' && (
                <div>
                  {selectedProperty ? (
                    <PropertyDetail
                      property={selectedProperty}
                      onBack={() => setSelectedProperty(null)}
                      onEdit={() => setShowNewPropertyModal(selectedProperty)}
                      onEditTenant={() => setShowTenantModal(selectedProperty)}
                      onRemoveTenant={() => {
                        removeTenant(selectedProperty.id);
                        setSelectedProperty({ ...selectedProperty, tenant: null });
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
                    />
                  ) : (
                    <>
                      {/* Sub-nav */}
                      <div className="flex gap-1.5 mb-4 items-center justify-start sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                        {[
                          { id: 'grid', emoji: '🏠' },
                          { id: 'tasks', emoji: '📋' },
                          { id: 'overview', emoji: '📊' },
                        ].map(tab => (
                          <button key={tab.id} onClick={() => setPropertyViewMode(tab.id)}
                            className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-xl font-medium transition text-base md:text-lg text-center ${
                              propertyViewMode === tab.id ? 'bg-teal-500 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                            }`}>{tab.emoji}</button>
                        ))}
                      </div>

                      {/* Properties Grid */}
                      {propertyViewMode === 'grid' && (
                        <div className="space-y-3">
                          {properties.map(property => (
                            <PropertyCard
                              key={property.id}
                              property={property}
                              onSelect={() => setSelectedProperty(property)}
                              onEdit={() => setShowNewPropertyModal(property)}
                              onDelete={() => {
                                setConfirmDialog({
                                  title: 'Delete Property',
                                  message: `Delete "${property.name}"? This cannot be undone.`,
                                  onConfirm: () => { deleteProperty(property.id); setConfirmDialog(null); },
                                });
                              }}
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
                              getEventLabel={() => getPropertyName(task.linkedTo?.propertyId)}
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
                              <p className="text-white/40 text-xs mb-1">Vacant</p>
                              <p className="text-3xl font-bold text-red-400">{vacantProperties.length}</p>
                            </div>
                            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                              <p className="text-white/40 text-xs mb-1">Monthly Rent</p>
                              <p className="text-3xl font-bold text-emerald-400">{formatCurrency(properties.reduce((sum, p) => sum + (p.tenant?.monthlyRent || p.monthlyRent || 0), 0))}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ========== DOCUMENTS SECTION ========== */}
              {activeSection === 'documents' && (
                <div>
                  {/* Sub-nav */}
                  <div className="flex gap-1.5 mb-4 items-center justify-start sticky top-[57px] z-20 bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4">
                    {[
                      { id: 'all', emoji: '📄' },
                      { id: 'byProperty', emoji: '🏠' },
                      { id: 'byType', emoji: '📁' },
                    ].map(tab => (
                      <button key={tab.id} onClick={() => setDocumentViewMode(tab.id)}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-xl font-medium transition text-base md:text-lg text-center ${
                          documentViewMode === tab.id ? 'bg-amber-500 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}>{tab.emoji}</button>
                    ))}
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
            tenant={showTenantModal?.tenant}
            onSave={(tenantData) => {
              updateTenant(showTenantModal.id, tenantData);
              if (selectedProperty?.id === showTenantModal.id) {
                setSelectedProperty({ ...selectedProperty, tenant: tenantData });
              }
              setShowTenantModal(null);
            }}
            onClose={() => setShowTenantModal(null)}
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
                if (url) fileUrl = url;
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

        {/* Desktop FAB */}
        {isOwner && !anyModalOpen && (
          <div className="hidden md:block fixed top-24 left-6 z-[90]">
            {showAddNewMenu && (
              <>
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[89]" onClick={() => setShowAddNewMenu(false)} />
                <div className="absolute top-16 left-0 z-[91] bg-slate-800/95 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-2xl w-[240px]"
                  style={{ animation: 'fabGridIn 0.15s ease-out both' }}>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { action: () => setShowAddTaskModal('create'), icon: '✅', label: 'Task', gradient: 'from-blue-400 to-indigo-500' },
                      { action: () => setShowSharedListModal('create'), icon: '📋', label: 'List', gradient: 'from-emerald-400 to-teal-500' },
                      { action: () => setShowAddIdeaModal('create'), icon: '💡', label: 'Idea', gradient: 'from-yellow-400 to-amber-500' },
                      { action: () => setShowNewPropertyModal('create'), icon: '🏠', label: 'Property', gradient: 'from-teal-400 to-cyan-500' },
                      { action: () => setShowAddDocumentModal('create'), icon: '📄', label: 'Document', gradient: 'from-amber-400 to-orange-500' },
                      { action: () => setShowAddTransactionModal('create'), icon: '💰', label: 'Transaction', gradient: 'from-emerald-400 to-green-500' },
                    ].map((item, idx) => (
                      <button key={item.label} onClick={() => { setShowAddNewMenu(false); item.action(); }}
                        className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl hover:bg-white/10 transition active:scale-95"
                        style={{ animation: `fabItemIn 0.12s ease-out ${idx * 0.02}s both` }}>
                        <span className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-xl shadow-md`}>{item.icon}</span>
                        <span className="text-[11px] text-white/70 font-medium leading-tight">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <style>{`
                  @keyframes fabGridIn { from { opacity: 0; transform: scale(0.9) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                  @keyframes fabItemIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
                `}</style>
              </>
            )}
            <button onClick={() => setShowAddNewMenu(!showAddNewMenu)}
              className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 active:scale-90 ${
                showAddNewMenu ? 'bg-gradient-to-r from-pink-500 to-rose-500 rotate-45' : 'bg-gradient-to-r from-purple-500 to-violet-600 hover:shadow-purple-500/30'
              }`}
              style={{ boxShadow: showAddNewMenu ? '0 8px 32px rgba(236,72,153,0.4)' : '0 8px 32px rgba(139,92,246,0.4)' }}>
              <Plus className="w-6 h-6 text-white transition-transform duration-200" />
            </button>
          </div>
        )}

        {/* Mobile Bottom Navigation with FAB */}
        {!anyModalOpen && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100]" style={{ transform: 'translateZ(0)' }}>
            {/* FAB Menu Popup */}
            {showAddNewMenu && isOwner && (
              <>
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99]" onClick={() => setShowAddNewMenu(false)} />
                <div className="absolute bottom-full left-1/2 mb-[68px] z-[101] bg-slate-800/95 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-2xl w-[240px]"
                  style={{ animation: 'fabGridUp 0.2s cubic-bezier(0.16,1,0.3,1) both', transformOrigin: 'bottom center' }}>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { action: () => setShowAddTaskModal('create'), icon: '✅', label: 'Task', gradient: 'from-blue-400 to-indigo-500' },
                      { action: () => setShowSharedListModal('create'), icon: '📋', label: 'List', gradient: 'from-emerald-400 to-teal-500' },
                      { action: () => setShowAddIdeaModal('create'), icon: '💡', label: 'Idea', gradient: 'from-yellow-400 to-amber-500' },
                      { action: () => setShowNewPropertyModal('create'), icon: '🏠', label: 'Property', gradient: 'from-teal-400 to-cyan-500' },
                      { action: () => setShowAddDocumentModal('create'), icon: '📄', label: 'Document', gradient: 'from-amber-400 to-orange-500' },
                      { action: () => setShowAddTransactionModal('create'), icon: '💰', label: 'Transaction', gradient: 'from-emerald-400 to-green-500' },
                    ].map((item, idx) => {
                      const row = Math.floor(idx / 3);
                      const delay = (1 - row) * 0.04 + (idx % 3) * 0.015;
                      return (
                        <button key={item.label} onClick={() => { setShowAddNewMenu(false); item.action(); }}
                          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl hover:bg-white/10 transition active:scale-95"
                          style={{ animation: `fabItemUp 0.25s cubic-bezier(0.16,1,0.3,1) ${delay}s both` }}>
                          <span className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-xl shadow-md`}>{item.icon}</span>
                          <span className="text-[11px] text-white/70 font-medium leading-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <style>{`
                  @keyframes fabGridUp { from { opacity: 0; transform: translateX(-50%) scaleY(0.3) scaleX(0.8) translateY(20px); } to { opacity: 1; transform: translateX(-50%) scaleY(1) scaleX(1) translateY(0); } }
                  @keyframes fabItemUp { from { opacity: 0; transform: translateY(12px) scale(0.7); } to { opacity: 1; transform: translateY(0) scale(1); } }
                `}</style>
              </>
            )}

            {/* Nav bar */}
            <div className="relative bg-slate-900 border-t border-white/10" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              {/* FAB button */}
              {isOwner && (
                <button
                  onClick={() => setShowAddNewMenu(!showAddNewMenu)}
                  className={`absolute left-1/2 -translate-x-1/2 -top-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 z-[101] ${
                    showAddNewMenu ? 'bg-gradient-to-r from-pink-500 to-rose-500 rotate-45' : 'bg-gradient-to-r from-purple-500 to-violet-600'
                  }`}
                  style={{
                    width: '3.5rem', height: '3.5rem',
                    boxShadow: showAddNewMenu
                      ? '0 4px 30px rgba(236,72,153,0.7), 0 0 0 4px rgba(236,72,153,0.12)'
                      : '0 4px 30px rgba(139,92,246,0.7), 0 0 0 4px rgba(139,92,246,0.12)',
                  }}>
                  <Plus className="w-6 h-6 text-white transition-transform duration-200" />
                </button>
              )}

              {/* Tab buttons */}
              <div className="flex items-end justify-around px-1 pt-1 pb-1">
                {[
                  { id: 'home', label: 'Hub', emoji: '⚛️', gradient: 'from-purple-500 to-violet-500' },
                  { id: 'rentals', label: 'Rentals', emoji: '🏠', gradient: 'from-teal-400 to-cyan-500' },
                  { id: 'documents', label: 'Docs', emoji: '📄', gradient: 'from-amber-400 to-orange-500' },
                  { id: 'financials', label: 'Money', emoji: '💰', gradient: 'from-emerald-400 to-green-500' },
                ].map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id);
                      if (section.id === 'home') setHubSubView('home');
                      if (section.id === 'rentals') { setSelectedProperty(null); setPropertyViewMode('grid'); }
                      setShowAddNewMenu(false);
                    }}
                    className="relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-all active:scale-95 min-w-[52px]"
                  >
                    <span className={`text-lg mb-0.5 transition-transform ${activeSection === section.id ? 'scale-110' : ''}`}>
                      {section.emoji}
                    </span>
                    <span className={`text-[10px] font-medium transition-colors ${activeSection === section.id ? 'text-white' : 'text-white/40'}`}>
                      {section.label}
                    </span>
                    {activeSection === section.id && (
                      <div className={`absolute -bottom-0.5 w-6 h-0.5 rounded-full bg-gradient-to-r ${section.gradient}`} />
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
