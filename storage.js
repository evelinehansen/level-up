// storage.js - localStorage load/save, export payload, backup-age tracking.
// Keys are namespaced and versioned because every family tool shares one
// GitHub Pages origin (and therefore one localStorage).

const DOC_KEY = 'level-up:v1';
const BACKUP_KEY = 'level-up:backup';

// Returns the stored entries array, or null when nothing has been stored yet
// (null is how the app knows to show seed data).
export function loadEntries() {
  let raw = null;
  try {
    raw = localStorage.getItem(DOC_KEY);
  } catch (e) {
    return null;
  }
  if (raw === null) return null;
  try {
    const doc = JSON.parse(raw);
    if (doc && Array.isArray(doc.entries)) return doc.entries;
  } catch (e) {
    // Corrupt document: treat as empty rather than crash.
  }
  return null;
}

// Returns true when the write succeeded. Quota overflow and Safari private
// mode both throw, and then the write did NOT happen; the caller must tell
// the user loudly.
export function saveEntries(entries) {
  try {
    localStorage.setItem(DOC_KEY, JSON.stringify({ schemaVersion: 1, entries }));
    return true;
  } catch (e) {
    return false;
  }
}

// Backup time is device-only state, so it lives outside the document key
// and never appears in an export.
export function loadBackupTime() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (raw === null) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch (e) {
    return null;
  }
}

export function saveBackupTime(ts) {
  try {
    localStorage.setItem(BACKUP_KEY, String(ts));
    return true;
  } catch (e) {
    return false;
  }
}

// The JSON text that Export downloads. The export file is the real home of
// the data; localStorage is just the working copy.
export function exportPayload(entries) {
  return JSON.stringify({ schemaVersion: 1, entries }, null, 2);
}
