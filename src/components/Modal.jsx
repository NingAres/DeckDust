import { useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export default function Modal({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  const animation = useRef(null);
  const closingRef = useRef(false);
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;
  const [closing, setClosing] = useState(false);
  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    const dialog = ref.current;
    const frame = { opacity: getComputedStyle(dialog).opacity, transform: getComputedStyle(dialog).transform };
    animation.current?.cancel();
    setClosing(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    animation.current = dialog.animate([frame,
      { opacity: 0, transform: reduced ? 'none' : 'translateY(12px) scale(0.96)' }],
    { duration: reduced ? 120 : 200, easing: 'ease-in-out', fill: 'forwards' });
    animation.current.finished.then(() => closeCallback.current()).catch(() => {});
  }
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    animation.current = dialog.animate([
      { opacity: 0, transform: reduced ? 'none' : 'translateY(24px) scale(0.94)' },
      { opacity: 1, transform: 'none' },
    ], { duration: reduced ? 160 : 340, easing: 'ease-in-out' });
    return () => { animation.current?.cancel(); dialog.close(); previous?.focus?.(); };
  }, []);
  return <dialog ref={ref} className={`modal ${className} ${closing ? 'modal-closing' : ''}`} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); requestClose(); }}
    onClick={event => { if (event.target === ref.current) { const box = ref.current.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) requestClose();
    } }}>
    <header className="modal-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="关闭" onClick={requestClose}><Icon name="close" /></button></header>
    {children}
  </dialog>;
}

