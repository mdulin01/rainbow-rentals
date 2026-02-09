// constants.js - Rainbow Reality constants

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Authorized owner emails
export const ownerEmails = [
  'mdulin@gmail.com',
  'liam@placeholder.com', // TODO: Replace with Liam's actual email
];

// Property types
export const propertyTypes = [
  { value: 'single-family', label: 'Single Family', emoji: '🏠' },
  { value: 'multi-family', label: 'Multi Family', emoji: '🏘️' },
  { value: 'condo', label: 'Condo', emoji: '🏢' },
  { value: 'apartment', label: 'Apartment', emoji: '🏬' },
  { value: 'townhouse', label: 'Townhouse', emoji: '🏡' },
  { value: 'commercial', label: 'Commercial', emoji: '🏪' },
];

// Tenant status options
export const tenantStatuses = [
  { value: 'active', label: 'Active', color: 'text-green-400' },
  { value: 'pending', label: 'Pending', color: 'text-yellow-400' },
  { value: 'vacant', label: 'Vacant', color: 'text-red-400' },
  { value: 'notice', label: 'Notice Given', color: 'text-orange-400' },
];

// Document types
export const documentTypes = [
  { value: 'lease', label: 'Lease', emoji: '📋' },
  { value: 'receipt', label: 'Receipt', emoji: '🧾' },
  { value: 'invoice', label: 'Invoice', emoji: '📄' },
  { value: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { value: 'tax', label: 'Tax Document', emoji: '📊' },
  { value: 'inspection', label: 'Inspection', emoji: '🔍' },
  { value: 'permit', label: 'Permit', emoji: '📜' },
  { value: 'photo', label: 'Photo/Evidence', emoji: '📸' },
  { value: 'other', label: 'Other', emoji: '📁' },
];

// Expense categories
export const expenseCategories = [
  { value: 'mortgage', label: 'Mortgage', emoji: '🏦' },
  { value: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { value: 'repairs', label: 'Repairs & Maintenance', emoji: '🔧' },
  { value: 'utilities', label: 'Utilities', emoji: '💡' },
  { value: 'taxes', label: 'Property Taxes', emoji: '📊' },
  { value: 'management', label: 'Management Fees', emoji: '👔' },
  { value: 'landscaping', label: 'Landscaping', emoji: '🌿' },
  { value: 'cleaning', label: 'Cleaning', emoji: '🧹' },
  { value: 'legal', label: 'Legal Fees', emoji: '⚖️' },
  { value: 'advertising', label: 'Advertising', emoji: '📢' },
  { value: 'supplies', label: 'Supplies', emoji: '📦' },
  { value: 'other', label: 'Other', emoji: '📋' },
];

// Income categories
export const incomeCategories = [
  { value: 'rent', label: 'Rent', emoji: '💰' },
  { value: 'late-fee', label: 'Late Fee', emoji: '⏰' },
  { value: 'deposit', label: 'Security Deposit', emoji: '🔒' },
  { value: 'parking', label: 'Parking', emoji: '🅿️' },
  { value: 'laundry', label: 'Laundry', emoji: '🧺' },
  { value: 'other', label: 'Other Income', emoji: '💵' },
];

// Task priorities (same as travel-planner)
export const taskPriorities = [
  { value: 'high', label: 'High', emoji: '🔴' },
  { value: 'medium', label: 'Medium', emoji: '🟡' },
  { value: 'low', label: 'Low', emoji: '⚪' },
];

// Time horizons for task filtering
export const timeHorizons = [
  { value: 'today', label: 'Today' },
  { value: 'this-week', label: 'This Week' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'all', label: 'All' },
];

// List categories
export const listCategories = [
  { value: 'maintenance', label: 'Maintenance', emoji: '🔧' },
  { value: 'shopping', label: 'Shopping', emoji: '🛒' },
  { value: 'renovation', label: 'Renovation', emoji: '🏗️' },
  { value: 'move-in', label: 'Move-in Checklist', emoji: '📋' },
  { value: 'move-out', label: 'Move-out Checklist', emoji: '📦' },
  { value: 'inspection', label: 'Inspection', emoji: '🔍' },
  { value: 'general', label: 'General', emoji: '📝' },
];

// Idea categories
export const ideaCategories = [
  { value: 'improvement', label: 'Property Improvement', emoji: '🏗️' },
  { value: 'investment', label: 'Investment', emoji: '💰' },
  { value: 'marketing', label: 'Marketing', emoji: '📢' },
  { value: 'process', label: 'Process', emoji: '⚙️' },
  { value: 'general', label: 'General', emoji: '💡' },
];

// Idea statuses
export const ideaStatuses = [
  { value: 'inbox', label: 'Inbox', emoji: '📥' },
  { value: 'exploring', label: 'Exploring', emoji: '🔍' },
  { value: 'planned', label: 'Planned', emoji: '📋' },
  { value: 'done', label: 'Done', emoji: '✅' },
  { value: 'parked', label: 'Parked', emoji: '🅿️' },
];

// Property colors for cards
export const propertyColors = [
  'from-teal-400 to-cyan-500',
  'from-blue-400 to-indigo-500',
  'from-emerald-400 to-teal-500',
  'from-purple-400 to-violet-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-cyan-400 to-blue-500',
  'from-green-400 to-emerald-500',
];
