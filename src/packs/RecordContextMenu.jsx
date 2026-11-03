import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../components/Icon.jsx';

export default function RecordContextMenu({ record, x, y, actions, onClose, host }) {
  const menuRef = useRef(null);
  useLayoutEffect(() => {
    const menu = menuRef.current;
    menu.showPopover();
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8))}px`;
    menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [x, y]);
  useEffect(() => {
    const menu = menuRef.current;
    const dismiss = () => onClose();
    const toggle = event => { if (event.newState === 'closed') onClose(); };
    menu.addEventListener('toggle', toggle);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      menu.removeEventListener('toggle', toggle);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [onClose]);
  function moveFocus(event) {
    const buttons = [...menuRef.current.querySelectorAll('button:not(:disabled)')];
    const current = buttons.indexOf(document.activeElement);
    const next = { ArrowDown: (current + 1) % buttons.length, ArrowUp: (current - 1 + buttons.length) % buttons.length, Home: 0, End: buttons.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    buttons[next]?.focus();
  }
  return createPortal(<div ref={menuRef} popover="auto" role="menu" aria-label={`${record.set}的记录操作`} className="pack-record-context-menu" onKeyDown={moveFocus} onContextMenu={event => event.preventDefault()}>
    <div className="pack-record-context-heading">{record.set}<small>{record.date.replace('T', ' ')}</small></div>
    {actions.map(action => <button key={action.label} type="button" role="menuitem" disabled={action.disabled} title={action.title} onClick={() => { onClose(); action.run(); }}><Icon name={action.icon} /><span>{action.label}</span><Icon name="right" /></button>)}
  </div>, host || document.body);
}
