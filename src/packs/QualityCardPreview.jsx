import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CardArt from './PackCardArt.jsx';

function PreviewCard({ entry }) {
  const ref = useRef(null), [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([event]) => {
      if (event.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { root: ref.current.closest('.quality-hover-cards'), rootMargin: '80px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div className="quality-hover-card" ref={ref}>
    {visible ? <CardArt card={entry.card} quality={entry.quality} /> : <div className="quality-hover-loading">载入卡面…</div>}
    <span>{entry.card.name}</span>
  </div>;
}

export default function QualityCardPreview({ count, label, cards, children }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null), popup = useRef(null), timer = useRef(null);
  const animation = useRef(null), closing = useRef(false);
  const mode = useRef('hover'), origin = useRef(null);
  const id = useId();

  function show(modeName = 'hover') {
    clearTimeout(timer.current);
    mode.current = modeName;
    origin.current = anchor.current?.getBoundingClientRect();
    setOpen(true);
  }

  function close() {
    clearTimeout(timer.current);
    const element = popup.current;
    if (!element || closing.current) { if (!element) setOpen(false); return; }
    const source = origin.current;
    const box = { left: Number.parseFloat(element.style.left) || element.offsetLeft,
      top: Number.parseFloat(element.style.top) || element.offsetTop,
      width: element.offsetWidth, height: element.offsetHeight };
    const frame = { opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform };
    const endTransform = source
      ? `translate(${source.left - box.left}px, ${source.top - box.top}px) scale(${source.width / box.width}, ${source.height / box.height})`
      : 'scale(0.2)';
    animation.current?.cancel();
    closing.current = true;
    animation.current = element.animate([frame, { opacity: 0, transform: endTransform }],
      { duration: 360, easing: 'ease-in-out', fill: 'forwards' });
    animation.current.finished.then(() => {
      closing.current = false;
      element.hidePopover();
      setOpen(false);
    }).catch(() => {});
  }

  function leave() {
    clearTimeout(timer.current);
    if (mode.current === 'hover') timer.current = setTimeout(close, 240);
  }

  useEffect(() => () => {
    clearTimeout(timer.current);
    animation.current?.cancel();
  }, []);

  useLayoutEffect(() => {
    if (!open || !popup.current) return;
    const element = popup.current;
    element.showPopover();
    const source = origin.current || anchor.current?.getBoundingClientRect();
    const natural = element.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - natural.width - 8,
      source.left + source.width / 2 - natural.width / 2));
    const centeredTop = source.top + source.height / 2 - natural.height / 2;
    const top = Math.max(8, Math.min(window.innerHeight - natural.height - 8,
      source.top >= natural.height + 16 ? source.top - natural.height - 10 : centeredTop));
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.transformOrigin = 'top left';
    const box = element.getBoundingClientRect();
    closing.current = false;
    animation.current?.cancel();
    const start = source
      ? `translate(${source.left - box.left}px, ${source.top - box.top}px) scale(${source.width / box.width}, ${source.height / box.height})`
      : 'scale(0.2)';
    animation.current = element.animate([
      { opacity: 0, transform: start }, { opacity: 1, transform: 'none' },
    ], { duration: 380, easing: 'ease-in-out' });

    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    }
    function onPointer(event) {
      if (!element.contains(event.target) && !anchor.current?.contains(event.target)) close();
    }
    function onScroll() { close(); }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  if (!count || !cards.length) return <span>{children || count || '–'}</span>;
  return <>
    <button ref={anchor} className="pack-quality-preview-trigger" aria-label={`${label} ${count} 张，查看卡牌记录`}
      aria-describedby={open ? id : undefined}
      onPointerEnter={() => { clearTimeout(timer.current); timer.current = setTimeout(() => show('hover'), 140); }}
      onPointerLeave={leave} onFocus={() => show('hover')} onBlur={leave} onClick={() => show('click')}>
      {children || count}
    </button>
    {open ? createPortal(
      <div ref={popup} id={id} popover="manual" role="tooltip" className="quality-hover-preview"
        onPointerEnter={() => clearTimeout(timer.current)} onPointerLeave={leave}>
        <header><strong>{label} · {cards.length} 张</strong><small>已保存卡牌明细</small></header>
        <div className="quality-hover-cards">{cards.map((entry, index) =>
          <PreviewCard key={`${entry.card.id}-${index}`} entry={entry} />)}</div>
        {cards.length > 4 ? <footer>左右滚动查看全部 {cards.length} 张</footer> : null}
      </div>, document.body) : null}
  </>;
}

