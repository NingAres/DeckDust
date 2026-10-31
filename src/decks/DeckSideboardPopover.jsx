import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { QUALITIES } from '../collection/model.js';
import { deckEntryVariants, orderDeckVariantsForDisplay, sideboardRule } from './model.js';
import DeckStripArt from './DeckStripArt.jsx';

export default function DeckSideboardPopover({ ownerId, anchor, controller, cards, onCard, onEnter, onLeave, onClose, artMode }) {
  const [choice, setChoice] = useState('');
  const byId = useMemo(() => new Map(cards.map(card => [card.dbfId, card])), [cards]);
  const rule = sideboardRule(ownerId);
  const owner = byId.get(ownerId);
  const selected = (controller.draft.sideboards || []).filter(item => item.ownerId === ownerId);
  const choices = cards.filter(card => card.dbfId !== ownerId && !selected.some(item => item.id === card.dbfId)
    && (!rule.sideboardRace || (card.races || []).includes(rule.sideboardRace) || card.race === rule.sideboardRace));
  const width = Math.min(310, window.innerWidth - 24);
  const height = 55 + selected.length * 45 + (selected.length < rule.sideboardSize ? 50 : 0);
  const left = Math.max(12, anchor.left - width - 12);
  const top = Math.max(12, Math.min(anchor.top, window.innerHeight - height - 12));
  return createPortal(<section className="deck-editor deck-sideboard-popover" role="dialog" aria-label={`${owner?.name || '构筑卡'}备选牌`}
    style={{ left, top, width }} onMouseEnter={onEnter} onMouseLeave={onLeave}
    onFocusCapture={onEnter} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) onLeave(); }}
    onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <header><strong>备选牌</strong><span>{selected.length} / {rule.sideboardSize}</span></header>
    {selected.flatMap(item => {
      const card = byId.get(item.id);
      return orderDeckVariantsForDisplay(deckEntryVariants({ ...item, variants: undefined }, card)).map(({ quality, count, missing }) => <div key={`${item.id}-${quality}`}
        className={`row quality-${quality} ${missing ? 'deck-missing' : ''}`} role="button" tabIndex={0} aria-disabled={controller.busy || undefined}
        aria-label={`${card?.name || item.id}，${QUALITIES.find(([key]) => key === quality)?.[1]}，${count}张备选牌，单击移除，右键查看详情`}
        onClick={() => { if (!controller.busy) controller.removeSideboard(item.id, ownerId); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!controller.busy) controller.removeSideboard(item.id, ownerId); } }}
        onContextMenu={event => { event.preventDefault(); if (card) onCard({ ...card, displayQuality: quality }); }}>
        {card && <DeckStripArt card={card} mode={artMode} />}
        <b className="cost">{card?.cost ?? '?'}</b>
        <span className="card-name">{card?.name || `卡牌 #${item.id}`}</span>
        <span className="deck-count">×{count}</span>
      </div>);
    })}
    {selected.length < rule.sideboardSize && <div className="deck-sideboard-add">
      <select aria-label={`${owner?.name || '构筑卡'}备选牌选择`} value={choice} onChange={event => setChoice(event.target.value)}>
        <option value="">选择备选牌{rule.sideboardRace === 'BEAST' ? '（野兽）' : ''}</option>
        {choices.map(card => <option key={card.dbfId} value={card.dbfId}>{card.name} · {card.cost ?? '?'} 费</option>)}
      </select><button className="simple-button" disabled={controller.busy || !choice} onClick={() => {
        const card = byId.get(Number(choice));
        if (card) controller.addSideboard(ownerId, card);
        setChoice('');
      }}>添加</button>
    </div>}
  </section>, document.body);
}

