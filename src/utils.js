// utils.js - Shared utilities for Rainbow Rentals

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// LOCAL (not UTC) YYYY-MM-DD for "today". Never use toISOString() — after ~8pm ET
// it rolls to tomorrow and keys rent/expense dates to the wrong day.
export const todayLocalStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  if (!date || isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatCurrency = (amount) => {
  const num = parseFloat(amount);
  if (!Number.isFinite(num)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

export const formatCurrencyDetailed = (amount) => {
  const num = parseFloat(amount);
  if (!Number.isFinite(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

export const validateFileSize = (file) => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_FILE_SIZE_MB}MB.`;
  }
  return null;
};

export const getSafeFileName = (name) => {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
};

export const isHeicFile = (file) => {
  return file.type === 'image/heic' || file.type === 'image/heif' ||
    file.name?.toLowerCase().endsWith('.heic') || file.name?.toLowerCase().endsWith('.heif');
};

export const getDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  const target = parseLocalDate(dateStr);
  if (!target) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = target - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const isTaskDueToday = (task) => {
  if (!task.dueDate) return false;
  const today = todayLocalStr();
  return task.dueDate === today;
};

export const isTaskDueThisWeek = (task) => {
  if (!task.dueDate) return false;
  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  const dueDate = parseLocalDate(task.dueDate);
  return dueDate >= today && dueDate <= endOfWeek;
};

export const taskMatchesHorizon = (task, horizon) => {
  if (horizon === 'all') return true;
  if (horizon === 'today') return isTaskDueToday(task);
  if (horizon === 'this-week') return isTaskDueThisWeek(task);
  if (horizon === 'overdue') {
    if (!task.dueDate) return false;
    const today = todayLocalStr();
    return task.dueDate < today && task.status !== 'done';
  }
  return true;
};

export const suggestIdeaCategoryFromUrl = (url) => {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('zillow') || lower.includes('realtor') || lower.includes('redfin')) return 'investment';
  if (lower.includes('homedepot') || lower.includes('lowes') || lower.includes('menards')) return 'improvement';
  if (lower.includes('facebook') || lower.includes('craigslist') || lower.includes('marketplace')) return 'marketing';
  return null;
};

export const fetchUrlMetadata = async (url) => {
  // Simple metadata fetch — returns basic info
  try {
    return { title: getDomainFromUrl(url), description: '', image: null };
  } catch {
    return null;
  }
};

export const getDomainFromUrl = (url) => {
  if (!url) return '';
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return url;
  }
};

export const getLeaseStatus = (leaseEnd) => {
  if (!leaseEnd) return null;
  const days = getDaysUntil(leaseEnd);
  if (days === null) return null;
  if (days < 0) return { label: 'Expired', color: 'text-red-400', urgency: 'high' };
  if (days <= 30) return { label: `${days}d left`, color: 'text-orange-400', urgency: 'medium' };
  if (days <= 90) return { label: `${days}d left`, color: 'text-yellow-400', urgency: 'low' };
  return { label: `${days}d left`, color: 'text-green-400', urgency: 'none' };
};

// ---- Tenant messaging helpers ----

// Digits only, with a leading country code for US numbers.
export const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
};

export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent || '');

// sms: link that opens Messages with the text pre-filled. iOS/macOS want "&body=",
// Android wants "?body=".
export const buildSmsLink = (phone, body) => {
  const num = normalizePhone(phone);
  const sep = isIOS() || /Macintosh/i.test(navigator.userAgent || '') ? '&' : '?';
  return `sms:${num}${sep}body=${encodeURIComponent(body || '')}`;
};

export const buildMailtoLink = (email, subject, body) =>
  `mailto:${email}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;

// "2026-10" → "October"
export const monthName = (monthKey) => {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });
};

// Current month key, local time.
export const currentMonthKey = () => todayLocalStr().slice(0, 7);

// YYYY-MM-DD of the rent due date for a month, clamped to the month's last day.
export const rentDueDateStr = (monthKey, dueDay = 1) => {
  const [y, m] = monthKey.split('-').map(Number);
  const maxDay = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(parseInt(dueDay, 10) || 1, 1), maxDay);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// Fill {placeholders} in a reminder template.
export const fillTemplate = (text, vars) =>
  String(text || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')).replace(/\s{2,}/g, ' ').trim();

// "3d ago" / "today" / "2w ago"
export const timeAgo = (iso) => {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return '';
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

// Properties left out of the pooled ownership/equity calc: the "Exclude from ownership pool"
// checkbox on the property. Name fallback keeps N. Church (Mike's residence) and Brookhurst
// (Adam's home) excluded on records that predate the flag.
const LEGACY_EXCLUDED_NAMES = ['n. church', 'brookhurst'];
export const isExcludedFromOwnership = (property) => {
  if (!property) return false;
  if (property.excludeFromPool != null) return !!property.excludeFromPool;
  const name = (property.name || '').toLowerCase();
  return LEGACY_EXCLUDED_NAMES.some((excluded) => name.includes(excluded));
};
