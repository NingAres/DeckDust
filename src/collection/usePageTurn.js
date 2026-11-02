import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { shouldDeferWheelToGrid } from './pageTurnLogic.js';

export default function usePageTurn({ page, filterKey, loading, pages, onPage }) {
  const stage = useRef(null);
  const grid = useRef(null);
  const last = useRef({ page, filterKey, html: '', emptyHTML: '' });
  const turning = useRef(false);
  const gesture = useRef({ accumulated: 0, previous: 0, latched: false, lockedUntil: 0 });
  const [busy, setBusy] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('deck-dust-page-motion');
      if (saved !== null) return saved === 'on';
    } catch { /* Storage may be unavailable in private windows. */ }
    return true;
  });
  const toggleMotion = () => setMotionEnabled(current => {
    try { localStorage.setItem('deck-dust-page-motion', current ? 'off' : 'on'); } catch { /* Keep the session preference. */ }
    return !current;
  });
  const remember = () => {
    if (!stage.current) return;
    last.current.html = grid.current?.innerHTML || '';
    last.current.emptyHTML = stage.current.querySelector('.empty-state')?.innerHTML || '';
  };

  useLayoutEffect(() => {
    const old = last.current;
    // Keep the last rendered result while the loading skeleton is shown. This
    // lets a collection refresh animate from the cards the user was viewing.
    if (loading) return;
    const oldScrollTop = grid.current?.scrollTop || 0;
    if (grid.current && old.page !== page) grid.current.scrollTop = 0;
    const currentEmpty = stage.current?.querySelector('.empty-state');
    const currentSurface = grid.current || currentEmpty;
    const next = { page, filterKey, html: grid.current?.innerHTML || '', emptyHTML: currentEmpty?.innerHTML || '' };
    last.current = next;
    const changed = old.page !== page || old.filterKey !== filterKey;
    if (!stage.current || !currentSurface || !changed || (!old.html && !old.emptyHTML) || !motionEnabled) return;
    const leaf = document.createElement('div');
    const previousGrid = !!old.html;
    leaf.className = previousGrid ? 'cards page-fade' : 'empty-state page-fade';
    leaf.innerHTML = previousGrid ? old.html : old.emptyHTML;
    // Load cloned images immediately so the outgoing page stays visible.
    leaf.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
    leaf.setAttribute('aria-hidden', 'true');
    leaf.setAttribute('inert', '');
    stage.current.append(leaf);
    leaf.scrollTop = oldScrollTop;
    turning.current = true;
    setBusy(true);
    const timing = { duration: 380, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' };
    const fade = leaf.animate([
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-5px)' },
    ], timing);
    const reveal = currentSurface.animate([
      { opacity: 0, transform: 'translateY(7px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { ...timing, fill: 'both' });
    reveal.finished.then(() => reveal.cancel()).catch(() => {});
    function finish() { leaf.remove(); turning.current = false; setBusy(false); remember(); }
    fade.finished.then(finish).catch(() => {});
    return () => { fade.cancel(); reveal.cancel(); leaf.remove(); turning.current = false; setBusy(false); };
  }, [page, filterKey, loading, motionEnabled]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const state = gesture.current;
    function wheel(event) {
      if (loading || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || document.querySelector('dialog[open]')) return;
      const cards = grid.current;
      if (!cards) return;
      const overflowY = getComputedStyle(cards).overflowY;
      if (shouldDeferWheelToGrid({
        overflowY,
        scrollHeight: cards.scrollHeight,
        clientHeight: cards.clientHeight,
        scrollTop: cards.scrollTop,
      }, event.deltaY)) return;
      event.preventDefault();
      const now = performance.now();
      if (now - state.previous > 200) { state.accumulated = 0; state.latched = false; }
      state.previous = now;
      if (turning.current || now < state.lockedUntil || state.latched) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? cards.clientHeight : 1);
      if (Math.sign(delta) !== Math.sign(state.accumulated)) state.accumulated = 0;
      state.accumulated += delta;
      if (Math.abs(state.accumulated) < 48) return;
      const target = Math.min(pages - 1, Math.max(0, page + Math.sign(state.accumulated)));
      state.accumulated = 0; state.latched = true; state.lockedUntil = now + 400;
      if (target !== page) onPage(target);
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [page, pages, loading, onPage]);

  return { stage, grid, remember, busy, motionEnabled, toggleMotion };
}

