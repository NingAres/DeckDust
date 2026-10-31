import { createPortal } from 'react-dom';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { PACK_TYPES, QUALITY_FIELDS, pityPreview } from './demo.js';
import PackArt from './PackArt.jsx';
import { QualitySymbol } from './PackSymbol.jsx';

export default function PackPityPreview({ record, records, children }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null), popup = useRef(null), timer = useRef(null);
  const id = useId();
  const rows = pityPreview(records, record.set, record.type);

  function enter() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 180);
  }
  function leave() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 180);
  }

  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!open || !popup.current || !trigger.current) return undefined;
    const element = popup.current;
    element.showPopover();
    const anchor = trigger.current.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - bounds.width - 8, anchor.right + 10));
    const centeredTop = anchor.top + anchor.height / 2 - bounds.height / 2;
    const top = Math.max(8, Math.min(window.innerHeight - bounds.height - 8, centeredTop));
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    const hide = () => setOpen(false);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open]);

  return <span ref={trigger} className="pack-pity-preview-trigger" aria-describedby={open ? id : undefined}
    onPointerEnter={enter} onPointerLeave={leave} onFocus={enter} onBlur={leave}>
    {children}
    {open ? createPortal(<div ref={popup} id={id} popover="manual" role="tooltip" className="pack-pity-hover-preview"
      onPointerEnter={() => clearTimeout(timer.current)} onPointerLeave={leave}>
      <header><div><strong>{record.set}</strong><small>{PACK_TYPES[record.type]}</small></div><PackArt set={record.set} type={record.type} assetName={record.artName} title="" /></header>
      <div className="pack-pity-hover-rows">{rows.map(({ quality, total, since }) => <div className="pack-pity-hover-row" key={quality}>
        <div><span><QualitySymbol quality={quality} />{QUALITY_FIELDS.find(([key]) => key === quality)?.[1]}</span><b>{since}<small> / {total}</small></b></div>
        <div className={`pity-track ${quality === 'epic' ? 'epic' : ''}`} role="meter" aria-label={`${quality}保底进度`} aria-valuenow={Math.min(since, total)} aria-valuemin={0} aria-valuemax={total}><span style={{ width: `${Math.min(100, since / total * 100)}%` }} /></div>
      </div>)}</div>
    </div>, document.body) : null}
  </span>;
}

