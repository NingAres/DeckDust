import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CardArt from '../collection/CardArt.jsx';

function Lightbox({ card, quality, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const previous = document.activeElement; ref.current.showModal(); return () => previous?.focus?.(); }, []);
  return createPortal(<dialog ref={ref} className="pack-card-lightbox" aria-label={`${card.name}放大卡面`} onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }} onClick={event => { event.stopPropagation(); if (event.target === ref.current) onClose(); }}>
    <button className="lightbox-close" aria-label="关闭放大卡面" onClick={onClose}>×</button><div className="lightbox-art"><CardArt card={card} quality={quality} detail /></div><p>{card.name}</p>
  </dialog>, document.body);
}
export default function PackCardArt({ card, quality, detail = false }) {
  const [open, setOpen] = useState(false);
  return <><div className="pack-clickable-art" role="button" tabIndex={0} aria-label={`放大查看${card.name}`} onClick={event => { event.stopPropagation(); setOpen(true); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setOpen(true); } }}><CardArt card={card} quality={quality} detail={detail} /></div>{open ? <Lightbox card={card} quality={quality} onClose={() => setOpen(false)} /> : null}</>;
}

