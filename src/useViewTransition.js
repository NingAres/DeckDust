import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const surfaces = root => [...(root?.children || [])].filter(element =>
  !element.hidden && element.matches('.top, .pack-page-host, .content-grid, .decks-library'));

export default function useViewTransition(initialView) {
  const [view, commitView] = useState(initialView);
  const mainRef = useRef(null);
  const current = useRef(view);
  const sequence = useRef(0);
  const active = useRef([]);
  const entering = useRef(false);
  const cancel = () => { active.current.forEach(animation => animation.cancel()); active.current = []; };

  const navigate = useCallback(next => {
    const ticket = ++sequence.current;
    // Read the current frame before cancelling, including during rapid clicks.
    const nodes = surfaces(mainRef.current);
    const frames = nodes.map(node => ({ opacity: getComputedStyle(node).opacity, transform: getComputedStyle(node).transform }));
    cancel();
    if (next === current.current) {
      active.current = nodes.map((node, index) => node.animate([frames[index], { opacity: 1, transform: 'none' }],
        { duration: 160, easing: 'ease-in-out' }));
      return;
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    active.current = nodes.map((node, index) => node.animate([frames[index],
      { opacity: 0, transform: reduced ? 'none' : 'translateY(-10px)' }],
    { duration: reduced ? 100 : 180, easing: 'ease-in-out', fill: 'forwards' }));
    Promise.all(active.current.map(animation => animation.finished)).then(() => {
      if (ticket !== sequence.current) return;
      current.current = next;
      entering.current = true;
      commitView(next);
    }).catch(() => { /* A newer navigation cancelled this transition. */ });
  }, []);

  useLayoutEffect(() => {
    if (!entering.current) return;
    entering.current = false;
    cancel();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    active.current = surfaces(mainRef.current).map(node => node.animate([
      { opacity: 0, transform: reduced ? 'none' : 'translateY(18px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: reduced ? 160 : 360, easing: 'ease-in-out' }));
  }, [view]);

  useLayoutEffect(() => () => { ++sequence.current; cancel(); }, []);
  return [view, navigate, mainRef];
}

