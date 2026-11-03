import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// Use the same 18px/360ms entrance as main-page navigation. Web Animations
// also keeps these explicitly requested transitions above the global CSS reset.
export default function useComparisonMotion(initialValue) {
  const [value, commit] = useState(initialValue);
  const surface = useRef(null);
  const committed = useRef(initialValue);
  const target = useRef(initialValue);
  const sequence = useRef(0);
  const active = useRef(null);
  const entering = useRef(false);
  const change = useCallback(update => {
    const next = typeof update === 'function' ? update(target.current) : update;
    if (JSON.stringify(next) === JSON.stringify(target.current)) return;
    target.current = next;
    const ticket = ++sequence.current;
    const node = surface.current;
    const frame = node ? { opacity: getComputedStyle(node).opacity, transform: getComputedStyle(node).transform } : null;
    active.current?.cancel();
    if (JSON.stringify(next) === JSON.stringify(committed.current)) {
      if (node) active.current = node.animate([frame, { opacity: 1, transform: 'none' }], { duration: 160, easing: 'ease-in-out' });
      return;
    }
    const finish = () => {
      if (ticket !== sequence.current) return;
      committed.current = next;
      entering.current = true;
      commit(next);
    };
    if (!node) { finish(); return; }
    active.current = node.animate([frame, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 140, easing: 'ease-in-out', fill: 'forwards' });
    active.current.finished.then(finish).catch(() => {});
  }, []);
  useLayoutEffect(() => {
    if (!entering.current) return;
    entering.current = false;
    active.current?.cancel();
    if (surface.current) active.current = surface.current.animate([
      { opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' },
    ], { duration: 360, easing: 'ease-in-out' });
  }, [value]);
  useLayoutEffect(() => () => { ++sequence.current; active.current?.cancel(); }, []);
  return [value, change, surface];
}
