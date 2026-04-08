/**
 * Generate a unique identifier string.
 * Uses crypto.randomUUID() if available, falls back to a timestamp + random string.
 * @returns {string} A unique identifier
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Format a number as USD currency.
 * @param {number|string} value - The value to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value) {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

/**
 * Format a timestamp to a human-readable date/time string.
 * @param {string|number|Date} timestamp - The timestamp to format
 * @returns {string} Formatted date/time string
 */
export function formatDateTime(timestamp) {
  if (!timestamp) return '-';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(timestamp);
  }
}

/**
 * Check if a timestamp is from today.
 * @param {string|number|Date} timestamp - The timestamp to check
 * @returns {boolean} True if the timestamp is from today
 */
export function isToday(timestamp) {
  if (!timestamp) return false;
  try {
    const date = new Date(timestamp);
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Get today's date as an ISO date string (YYYY-MM-DD).
 * @returns {string} Today's date
 */
export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Debounce a function call.
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce delay in milliseconds
 * @returns {Function} The debounced function
 */
export function debounce(func, wait) {
  let timeoutId;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeoutId);
      func(...args);
    };
    clearTimeout(timeoutId);
    timeoutId = setTimeout(later, wait);
  };
}
