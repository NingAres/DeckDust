const KEY = 'deck-dust-sync-preferences-v1';

export const DEFAULT_SYNC_PREFERENCES = {
  defaultMethod: 'hsreplay',
  autoSyncOnLaunch: true,
};

export function readSyncPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      defaultMethod: value.defaultMethod === 'file' ? 'file' : 'hsreplay',
      autoSyncOnLaunch: value.autoSyncOnLaunch !== false,
    };
  } catch {
    return { ...DEFAULT_SYNC_PREFERENCES };
  }
}

export function saveSyncPreferences(value) {
  const next = {
    defaultMethod: value.defaultMethod === 'file' ? 'file' : 'hsreplay',
    autoSyncOnLaunch: value.autoSyncOnLaunch !== false,
  };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Local storage may be unavailable. */ }
  return next;
}

