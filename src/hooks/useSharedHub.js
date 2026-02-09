import { useState, useCallback, useRef } from 'react';

/**
 * useSharedHub Hook
 * Manages all SharedHub data and operations in one place
 * Returns an object with state and callbacks ready to pass to SharedHubProvider
 */

export const useSharedHub = (currentUser, saveSharedHub, showToast) => {
  // Keep a ref to saveSharedHub so callbacks always use the latest version
  // without needing it in their dependency arrays (avoids stale closure bugs)
  const saveRef = useRef(saveSharedHub);
  saveRef.current = saveSharedHub;

  // ========== STATE ==========
  const [sharedTasks, setSharedTasks] = useState([]);
  const [sharedLists, setSharedLists] = useState([]);
  const [sharedIdeas, setSharedIdeas] = useState([]);

  // Hub UI state
  const [hubSubView, setHubSubView] = useState('home');
  const [hubTaskFilter, setHubTaskFilter] = useState('today');
  const [hubTaskSort, setHubTaskSort] = useState('date');
  const [hubListFilter, setHubListFilter] = useState('all');
  const [hubIdeaFilter, setHubIdeaFilter] = useState('all');
  const [hubIdeaStatusFilter, setHubIdeaStatusFilter] = useState('all');
  const [collapsedSections, setCollapsedSections] = useState({});

  // Hub modal states (for card editing/creation)
  const [showAddTaskModal, setShowAddTaskModal] = useState(null); // null | 'create' | task object (edit)
  const [showSharedListModal, setShowSharedListModal] = useState(null); // null | 'create' | list object (edit)
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(null); // null | 'create' | idea object (edit)

  // ========== TASK CRUD ==========
  const addTask = useCallback((task) => {
    const newTasks = [...sharedTasks, task];
    setSharedTasks(newTasks);
    saveRef.current(null, newTasks, null);
    showToast('Task added', 'success');
  }, [sharedTasks, showToast]);

  const updateTask = useCallback((taskId, updates) => {
    const newTasks = sharedTasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    setSharedTasks(newTasks);
    saveRef.current(null, newTasks, null);
  }, [sharedTasks]);

  const deleteTask = useCallback((taskId) => {
    const newTasks = sharedTasks.filter(t => t.id !== taskId);
    setSharedTasks(newTasks);
    saveRef.current(null, newTasks, null);
    showToast('Task removed', 'info');
  }, [sharedTasks, showToast]);

  const completeTask = useCallback((taskId) => {
    const task = sharedTasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    const newTasks = sharedTasks.map(t => t.id === taskId ? {
      ...t,
      status: newStatus,
      completedBy: newStatus === 'done' ? currentUser : null,
      completedAt: newStatus === 'done' ? new Date().toISOString() : null,
    } : t);
    setSharedTasks(newTasks);
    saveRef.current(null, newTasks, null);
  }, [sharedTasks, currentUser]);

  const highlightTask = useCallback((taskId) => {
    const newTasks = sharedTasks.map(t => t.id === taskId ? { ...t, highlighted: !t.highlighted } : t);
    setSharedTasks(newTasks);
    saveRef.current(null, newTasks, null);
  }, [sharedTasks]);

  // ========== LIST CRUD ==========
  const addList = useCallback((list) => {
    const newLists = [...sharedLists, list];
    setSharedLists(newLists);
    saveRef.current(newLists, null, null);
    showToast('List created', 'success');
  }, [sharedLists, showToast]);

  const updateList = useCallback((listId, updates) => {
    const newLists = sharedLists.map(l => l.id === listId ? { ...l, ...updates } : l);
    setSharedLists(newLists);
    saveRef.current(newLists, null, null);
  }, [sharedLists]);

  const deleteList = useCallback((listId) => {
    const newLists = sharedLists.filter(l => l.id !== listId);
    setSharedLists(newLists);
    saveRef.current(newLists, null, null);
    showToast('List removed', 'info');
  }, [sharedLists, showToast]);

  const addListItem = useCallback((listId, item) => {
    const newLists = sharedLists.map(l => l.id === listId ? { ...l, items: [...(l.items || []), item] } : l);
    setSharedLists(newLists);
    saveRef.current(newLists, null, null);
  }, [sharedLists]);

  const toggleListItem = useCallback((listId, itemId) => {
    const newLists = sharedLists.map(l => {
      if (l.id !== listId) return l;
      return {
        ...l,
        items: l.items.map(i => i.id === itemId ? {
          ...i,
          checked: !i.checked,
          checkedBy: !i.checked ? currentUser : null,
          checkedAt: !i.checked ? new Date().toISOString() : null,
        } : i)
      };
    });
    setSharedLists(newLists);
    saveRef.current(newLists, null, null);
  }, [sharedLists, currentUser]);

  const deleteListItem = useCallback((listId, itemId) => {
    const newLists = sharedLists.map(l => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.filter(i => i.id !== itemId) };
    });
    setSharedLists(newLists);
    saveRef.current(newLists, null, null);
  }, [sharedLists]);

  const highlightList = useCallback((listId) => {
    const newLists = sharedLists.map(l => l.id === listId ? { ...l, highlighted: !l.highlighted } : l);
    setSharedLists(newLists);
    saveRef.current(newLists, null, null);
  }, [sharedLists]);

  // ========== IDEA CRUD ==========
  const addIdea = useCallback((idea) => {
    const newIdeas = [...sharedIdeas, idea];
    setSharedIdeas(newIdeas);
    saveRef.current(null, null, newIdeas);
    showToast('Idea saved', 'success');
  }, [sharedIdeas, showToast]);

  const updateIdea = useCallback((ideaId, updates) => {
    const newIdeas = sharedIdeas.map(i => i.id === ideaId ? { ...i, ...updates } : i);
    setSharedIdeas(newIdeas);
    saveRef.current(null, null, newIdeas);
  }, [sharedIdeas]);

  const deleteIdea = useCallback((ideaId) => {
    const newIdeas = sharedIdeas.filter(i => i.id !== ideaId);
    setSharedIdeas(newIdeas);
    saveRef.current(null, null, newIdeas);
    showToast('Idea removed', 'info');
  }, [sharedIdeas, showToast]);

  const highlightIdea = useCallback((ideaId) => {
    const newIdeas = sharedIdeas.map(i => i.id === ideaId ? { ...i, highlighted: !i.highlighted } : i);
    setSharedIdeas(newIdeas);
    saveRef.current(null, null, newIdeas);
  }, [sharedIdeas]);

  // ========== UI HELPERS ==========
  const toggleDashSection = useCallback((section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // ========== RETURN CONTEXT VALUE ==========
  return {
    // Data
    sharedTasks,
    sharedLists,
    sharedIdeas,

    // Task operations
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    highlightTask,

    // List operations
    addList,
    updateList,
    deleteList,
    addListItem,
    toggleListItem,
    deleteListItem,
    highlightList,

    // Idea operations
    addIdea,
    updateIdea,
    deleteIdea,
    highlightIdea,

    // UI state
    hubSubView,
    setHubSubView,
    hubTaskFilter,
    setHubTaskFilter,
    hubTaskSort,
    setHubTaskSort,
    hubListFilter,
    setHubListFilter,
    hubIdeaFilter,
    setHubIdeaFilter,
    hubIdeaStatusFilter,
    setHubIdeaStatusFilter,
    collapsedSections,
    toggleDashSection,

    // Setters for loading data from Firebase
    setSharedTasks,
    setSharedLists,
    setSharedIdeas,

    // Modal states
    showAddTaskModal,
    setShowAddTaskModal,
    showSharedListModal,
    setShowSharedListModal,
    showAddIdeaModal,
    setShowAddIdeaModal,

    // Utilities
    showToast,
  };
};

export default useSharedHub;
