// Keep the timing for pack data changes together so future animation edits
// don't drift between sort, page, and pack-detail interactions.
export const PACK_MOTION = Object.freeze({
  contentFade: 520,
  historyPageExit: 260,
  historyPageEnter: 420,
  cardPackSwitch: 520,
  easing: 'cubic-bezier(.2,.75,.25,1)',
});
