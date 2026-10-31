export const DECK_ART_MODES = Object.freeze({ COVER: 'cover', LAYERED: 'layered' });
const STORAGE_KEY = 'deckDust.deckArtMode';

export function readDeckArtMode() {
  try { return localStorage.getItem(STORAGE_KEY) === DECK_ART_MODES.LAYERED ? DECK_ART_MODES.LAYERED : DECK_ART_MODES.COVER; }
  catch { return DECK_ART_MODES.COVER; }
}

export function saveDeckArtMode(mode) {
  const value = mode === DECK_ART_MODES.LAYERED ? DECK_ART_MODES.LAYERED : DECK_ART_MODES.COVER;
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Keep the current session usable if storage is unavailable. */ }
  return value;
}

