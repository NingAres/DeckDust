// Keep the timing for pack data changes together so future animation edits
// don't drift between sort, page, and pack-detail interactions.
export const PACK_MOTION = Object.freeze({
  contentFade: 520,
  historyPageExit: 220,
  historyPageEnter: 260,
  cardPackSwitch: 520,
  easing: 'cubic-bezier(.2,.75,.25,1)',
  stationaryEasing: 'cubic-bezier(.42,0,.58,1)',
});
