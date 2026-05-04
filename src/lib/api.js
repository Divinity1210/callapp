/**
 * NLP Campaign API Client
 * Communicates with Google Apps Script Web App via GET requests.
 * Uses ?action=X&data=encodedJSON pattern (proven cross-origin GAS pattern).
 * 
 * No Supabase. No auth. Just a name and a Sheet.
 */

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || '';

async function callGAS(action, params = {}) {
  if (!GAS_URL) {
    throw new Error('GAS_URL not configured. Set NEXT_PUBLIC_GAS_URL in .env.local');
  }

  // Use GET with URL params — the only reliable cross-origin GAS pattern.
  // doPost fails cross-origin because Google's 302 redirect drops the body.
  const dataParam = encodeURIComponent(JSON.stringify(params));
  const url = `${GAS_URL}?action=${encodeURIComponent(action)}&data=${dataParam}`;

  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();

  // GAS may return HTML error page on misconfigured deployments
  if (text.includes('<!DOCTYPE') || text.includes('Page not found')) {
    throw new Error(
      'GAS endpoint returned error page. Please redeploy with New Version.'
    );
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid response from server: ' + text.substring(0, 200));
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

// ============================================================
// PUBLIC API FUNCTIONS
// ============================================================

/**
 * Get the next uncalled contact and lock it for this caller.
 * Returns contact object with { id, name, phone, status, rowIndex }
 * or { empty: true } if the queue is clear.
 */
export async function getNextContact(callerName) {
  return callGAS('getNext', { callerName });
}

/**
 * Search contacts by name, phone, or ID.
 * Returns array of matching contacts (max 15).
 */
export async function searchContacts(query) {
  return callGAS('search', { query });
}

/**
 * Load a specific contact by ID and lock it for this caller.
 * Returns contact object or lock info.
 */
export async function getContactById(id, callerName) {
  return callGAS('getById', { id, callerName });
}

/**
 * Save call outcome data to the Google Sheet.
 * @param {Object} payload - { id, rowIndex, status, callerInitials, comment, incentives, transport, children, otherAdults }
 */
export async function submitCallData(payload) {
  return callGAS('save', { payload });
}

/**
 * Skip a contact — releases the lock so someone else can call them.
 */
export async function skipContactAPI(id, rowIndex) {
  return callGAS('skip', { id, rowIndex });
}

/**
 * Get dashboard statistics.
 * @param {string} selectedDate - 'allTime' or 'YYYY-MM-DD'
 */
export async function getDashboardData(selectedDate) {
  return callGAS('dashboard', { selectedDate });
}

// ============================================================
// LOCAL BACKUP — Proven pattern from the GAS version.
// Every save is backed up in localStorage first.
// If the server fails, data is NOT lost. Retries on next load.
// ============================================================

export function backupSave(payload) {
  try {
    const pending = JSON.parse(localStorage.getItem('pendingSaves') || '[]');
    payload._savedAt = new Date().toISOString();
    pending.push(payload);
    localStorage.setItem('pendingSaves', JSON.stringify(pending));
  } catch (e) { /* localStorage unavailable */ }
}

export function removeBackup(id) {
  try {
    let pending = JSON.parse(localStorage.getItem('pendingSaves') || '[]');
    pending = pending.filter(p => p.id !== id);
    localStorage.setItem('pendingSaves', JSON.stringify(pending));
  } catch (e) { /* localStorage unavailable */ }
}

export function getPendingSaves() {
  try {
    return JSON.parse(localStorage.getItem('pendingSaves') || '[]');
  } catch (e) {
    return [];
  }
}

export async function retryPendingSaves() {
  const pending = getPendingSaves();
  if (pending.length === 0) return 0;

  let recovered = 0;
  for (const payload of pending) {
    try {
      await submitCallData({
        id: payload.id,
        rowIndex: payload.rowIndex,
        status: payload.status,
        callerInitials: payload.callerInitials,
        comment: payload.comment || '',
        incentives: payload.incentives,
        transport: payload.transport,
        children: payload.children,
        otherAdults: payload.otherAdults,
        numAdults: payload.numAdults,
      });
      removeBackup(payload.id);
      recovered++;
    } catch (e) {
      // Will retry next time
    }
  }
  return recovered;
}
