// constants.js - Rainbow Reality constants

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Authorized owner emails
export const ownerEmails = [
  'mdulin@gmail.com',
  'dulinliam@gmail.com',
  'adamjosephbritten@gmail.com', // property owner — restricted to Brookhurst (see propertyAccess)
];

// Per-property owner access: email -> substring matched against a property's name/address.
// A restricted owner sees ONLY their matching property across the whole app (UI filter on
// the shared docs — convenient, not hard isolation). Emails NOT listed here are full managers
// (Mike, Liam) who see and manage everything.
export const propertyAccess = {
  'adamjosephbritten@gmail.com': 'brookhurst',
};

// Property types
export const propertyTypes = [
  { value: 'single-family', label: 'Single Family', emoji: '🏠' },
  { value: 'multi-family', label: 'Multi Family', emoji: '🏘️' },
  { value: 'condo', label: 'Condo', emoji: '🏢' },
  { value: 'apartment', label: 'Apartment', emoji: '🏬' },
  { value: 'townhouse', label: 'Townhouse', emoji: '🏡' },
  { value: 'duplex', label: 'Duplex', emoji: '🏚️' },
  { value: 'mobile-home', label: 'Mobile Home', emoji: '🏕️' },
];

// Tenant status options
export const tenantStatuses = [
  { value: 'active', label: 'Active', color: 'text-green-400' },
  { value: 'pending', label: 'Pending', color: 'text-yellow-400' },
  { value: 'vacant', label: 'Vacant', color: 'text-red-400' },
  { value: 'notice', label: 'Notice Given', color: 'text-orange-400' },
];

// Property status options
export const propertyStatuses = [
  { value: 'occupied', label: 'Occupied', color: 'text-green-400', bg: 'bg-green-500/90' },
  { value: 'owner-occupied', label: 'Owner Occupied', color: 'text-teal-400', bg: 'bg-teal-500/90' },
  { value: 'vacant', label: 'Vacant', color: 'text-red-400', bg: 'bg-red-500/80' },
  { value: 'lease-expired', label: 'Lease Expired', color: 'text-orange-400', bg: 'bg-orange-500/80' },
  { value: 'month-to-month', label: 'Month-to-Month', color: 'text-blue-400', bg: 'bg-blue-500/80' },
  { value: 'renovation', label: 'Renovation', color: 'text-purple-400', bg: 'bg-purple-500/80' },
  { value: 'listed', label: 'Listed', color: 'text-yellow-400', bg: 'bg-yellow-500/80' },
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
  { value: 'condo-bylaws', label: 'Condo By Laws', emoji: '📑' },
  { value: 'photo', label: 'Photo/Evidence', emoji: '📸' },
  { value: 'other', label: 'Other', emoji: '📁' },
];

// Expense categories
export const expenseCategories = [
  { value: 'repair', label: 'Repair', emoji: '🔧' },
  { value: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { value: 'maintenance', label: 'Maintenance', emoji: '🔩' },
  { value: 'mortgage', label: 'Mortgage', emoji: '🏦' },
  { value: 'utilities', label: 'Utilities', emoji: '💡' },
  { value: 'internet', label: 'Internet', emoji: '📡' },
  { value: 'software', label: 'Software', emoji: '💻' },
  { value: 'taxes', label: 'Property Taxes', emoji: '📊' },
  { value: 'landscaping', label: 'Landscaping', emoji: '🌿' },
  { value: 'hoa', label: 'HOA', emoji: '🏘️' },
  { value: 'legal', label: 'Legal Fees', emoji: '⚖️' },
  { value: 'mileage', label: 'Mileage', emoji: '🚗' },
  { value: 'other', label: 'Other', emoji: '📋' },

];

// Recurring expense frequencies
export const recurringFrequencies = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

// Capital item condition ratings
export const capitalConditions = [
  { value: 'good', label: 'Good', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
  { value: 'fair', label: 'Fair', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
  { value: 'poor', label: 'Poor', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
  { value: 'critical', label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
];

// IRS standard mileage rate (2025/2026)
export const MILEAGE_RATE = 0.70;

// Income categories
export const incomeCategories = [
  { value: 'rent', label: 'Rent', emoji: '💰' },
  { value: 'late-fee', label: 'Late Fee', emoji: '⏰' },
  { value: 'deposit', label: 'Security Deposit', emoji: '🔒' },
  { value: 'interest', label: 'Interest', emoji: '🏦' },
  { value: 'parking', label: 'Parking', emoji: '🅿️' },
  { value: 'laundry', label: 'Laundry', emoji: '🧺' },
  { value: 'reimbursement', label: 'Reimbursement', emoji: '🔄' },
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

// Move-in checklist template items (real estate best practices)
export const MOVE_IN_TEMPLATE_ITEMS = [
  { text: 'Lease agreement signed', icon: '📝' },
  { text: 'Collect copy of renter ID (photo)', icon: '🪪' },
  { text: 'Renters insurance proof collected', icon: '🛡️' },
  { text: 'Security deposit received', icon: '💰' },
  { text: 'First month rent received', icon: '💵' },
  { text: 'Provide keys and entry codes', icon: '🔑' },
  { text: 'Provide garage door opener / gate code', icon: '🚗' },
  { text: 'Utilities transferred to renter name', icon: '💡' },
  { text: 'Walk-through completed with tenant', icon: '🚶' },
  { text: 'Property condition photos taken (move-in)', icon: '📸' },
  { text: 'Smoke detectors tested and working', icon: '🔥' },
  { text: 'Carbon monoxide detectors tested', icon: '⚠️' },
  { text: 'Emergency contacts exchanged', icon: '📞' },
  { text: 'Mailbox key / info provided', icon: '📬' },
  { text: 'Trash / recycling schedule provided', icon: '🗑️' },
  { text: 'Appliance instructions provided', icon: '🏠' },
  { text: 'HOA rules reviewed (if applicable)', icon: '📋' },
  { text: 'Maintenance request process explained', icon: '🔧' },
];

// Move-out checklist template items (real estate best practices)
export const MOVE_OUT_TEMPLATE_ITEMS = [
  { text: 'Written move-out notice received', icon: '📝' },
  { text: 'Move-out date confirmed', icon: '📅' },
  { text: 'Return all keys and entry devices', icon: '🔑' },
  { text: 'Return garage door opener / gate remote', icon: '🚗' },
  { text: 'Utilities transferred back to owner', icon: '💡' },
  { text: 'Forwarding address collected', icon: '📬' },
  { text: 'Final walk-through scheduled', icon: '🚶' },
  { text: 'Final walk-through completed', icon: '✅' },
  { text: 'Property condition photos taken (move-out)', icon: '📸' },
  { text: 'Compare move-in vs move-out photos', icon: '🔍' },
  { text: 'Document any damages beyond normal wear', icon: '📋' },
  { text: 'Final rent payment confirmed', icon: '💵' },
  { text: 'Outstanding charges calculated', icon: '🧮' },
  { text: 'Security deposit disposition prepared', icon: '💰' },
  { text: 'Security deposit returned / deductions sent', icon: '✉️' },
  { text: 'Property cleaned and ready for next tenant', icon: '🧹' },
  { text: 'Locks changed / re-keyed', icon: '🔒' },
  { text: 'Listing updated (if re-renting)', icon: '📢' },
];

export const LEASING_TEMPLATE_ITEMS = [
  { text: 'Final make-ready repairs completed', icon: '🔧' },
  { text: 'Interior painted / touched up', icon: '🎨' },
  { text: 'Deep clean (incl. carpets)', icon: '🧹' },
  { text: 'Landscaping / curb appeal tidied', icon: '🌿' },
  { text: 'New listing photos taken', icon: '📸' },
  { text: 'Listing description written', icon: '📝' },
  { text: 'Rent price set', icon: '🏷️' },
  { text: 'Listed on Avail', icon: '📣' },
  { text: 'Listed on Zillow / Apartments.com', icon: '🌐' },
  { text: 'Posted to Facebook Marketplace / groups', icon: '📱' },
  { text: 'Yard / window sign posted', icon: '🪧' },
  { text: 'Showings scheduled', icon: '📅' },
  { text: 'Applicants screened (credit / background)', icon: '🔍' },
  { text: 'Application & lease sent', icon: '📄' },
  { text: 'Lease signed + deposit collected', icon: '✍️' },
  { text: 'Move-in scheduled / keys ready', icon: '🔑' },
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

// Rent payment statuses
export const rentStatuses = [
  { value: 'paid', label: 'Paid', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  { value: 'partial', label: 'Partial', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { value: 'unpaid', label: 'Unpaid', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { value: 'late', label: 'Late', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
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
