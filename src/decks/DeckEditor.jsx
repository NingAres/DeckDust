import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ClassEmblem from '../components/ClassEmblem.jsx';
import { CLASSES, QUALITIES } from '../collection/model.js';
import { DECK_RULES, FORMATS, deckStats, deckEntryVariants, orderDeckVariantsForDisplay, inheritCompanionVariants, isDeckCompanion, sideboardRule } from './model.js';
import DeckStripArt from './DeckStripArt.jsx';
import DeckClassArt from './DeckClassArt.jsx';
import DeckSideboardPopover from './DeckSideboardPopover.jsx';
import { HERO_ART } from './model.js';

export default function DeckEditor({ controller, cards, cardReferences = [], onCard, onFinish, artMode }) {
  const { draft, setDraft, heroClass, busy, ready, error, dirty } = controller;
  const [dropActive, setDropActive] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [sideboardAnchor, setSideboardAnchor] = useState(null);
  const nameInput = useRef(null);
  const previousName = useRef('');
  const hoverTimer = useRef(null);
  const keepSideboard = () => clearTimeout(hoverTimer.current);
  const hideSideboard = () => { keepSideboard(); hoverTimer.current = setTimeout(() => setSideboardAnchor(null), 150); };
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    const close = () => setSideboardAnchor(null);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, []);
  useLayoutEffect(() => {
    if (!editingName) return;
    nameInput.current?.focus();
    nameInput.current?.select();
  }, [editingName]);
  const previousCopies = useRef(null);
  const deckCards = useMemo(() => [...cards, ...cardReferences.map(card => ({ ...card, counts: [0, 0, 0, 0] }))], [cards, cardReferences]);
  const byId = useMemo(() => new Map(deckCards.map(c => [c.dbfId, c])), [deckCards]);
  const displayEntries = useMemo(() => draft ? inheritCompanionVariants(draft, deckCards).entries : [], [draft, deckCards]);
  useLayoutEffect(() => {
    const current = new Map();
    for (const entry of displayEntries) {
      for (const row of deckEntryVariants(entry, byId.get(entry.id))) current.set(`${entry.id}-${row.quality}`, row.count);
    }
    const previous = previousCopies.current;
    previousCopies.current = current;
    if (!previous) return;
    const added = [...current].filter(([key, count]) => count > (previous.get(key) || 0));
    if (!added.length) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const [key] of added) {
      const [id, quality] = key.split('-');
      const row = document.querySelector(`.deck-editor .row[data-card-id="${id}"][data-quality="${quality}"]`);
      if (!row) continue;
      const animation = row.animate(reducedMotion ? [{ opacity: 0.75 }, { opacity: 1 }] : [
        { opacity: 0, transform: 'translateY(10px) scale(.97)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ], { duration: reducedMotion ? 100 : 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
      animation.onfinish = () => animation.cancel();
    }
  }, [displayEntries, byId]);
  if (!draft) return null;
  const stats = deckStats(draft, deckCards);
  const label = CLASSES.find(([key]) => key === heroClass)?.[1] || '自定义英雄';
  return <aside className={`deck deck-editor ${dropActive ? 'drop-ready' : ''}`} aria-label="当前套牌"
    onDragOver={event => {
      if (!Array.from(event.dataTransfer.types).includes('application/x-deck-dust-card')) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
      if (!dropActive) setDropActive(true);
    }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropActive(false); }}
    onDrop={event => {
      event.preventDefault(); setDropActive(false);
      try {
        const raw = event.dataTransfer.getData('application/x-deck-dust-card') || event.dataTransfer.getData('text/plain');
        const payload = JSON.parse(raw);
        const card = byId.get(Number(payload.dbfId));
        if (card && QUALITIES.some(([key]) => key === payload.quality)) controller.addCard({ ...card, displayQuality: payload.quality });
      } catch { /* Ignore drops that did not originate from a collection card. */ }
    }}>
    {dropActive && <div className="deck-drop-hint" aria-live="polite">松开鼠标，将卡牌加入套牌</div>}
    <div className="deck-hero"><DeckClassArt cardId={byId.get(draft.hero)?.id || HERO_ART[heroClass]} fallbackCardId={HERO_ART[heroClass]} className="deck-class-art" /><ClassEmblem cardClass={heroClass} />{editingName
      ? <input ref={nameInput} className="deck-title-edit-input" aria-label="套牌名称" maxLength={80} disabled={busy} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} onBlur={() => setEditingName(false)} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') { event.preventDefault(); setDraft({ ...draft, name: previousName.current }); event.currentTarget.blur(); }
      }} />
      : <button type="button" className="deck-title-edit-trigger" title="点击编辑套牌名称" disabled={busy} onClick={() => { previousName.current = draft.name; setEditingName(true); }}><b>{draft.name || '未命名套牌'}</b></button>}</div>
    <div className="deck-info">{label} · <select aria-label="套牌模式" value={draft.format} disabled={busy} onChange={e => setDraft({ ...draft, format: Number(e.target.value) })}>{Object.entries(FORMATS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select> · {stats.total}/{stats.limit} 张{dirty ? ' · 未保存' : ''}</div>
    {error && <p className="deck-error" role="alert">{error}</p>}
    <div className="deck-list" onScroll={() => setSideboardAnchor(null)}>{[...displayEntries].sort((a, b) => (byId.get(a.id)?.cost || 0) - (byId.get(b.id)?.cost || 0) || a.id - b.id).flatMap(e => {
      const c = byId.get(e.id);
      return orderDeckVariantsForDisplay(deckEntryVariants(e, c)).map(({ quality, count, missing }) => {
        const companion = isDeckCompanion(e.id);
        const qualityLabel = QUALITIES.find(([key]) => key === quality)[1];
        const remove = () => { if (!busy && !companion) controller.removeCard(e.id, quality); };
        return <div key={`${e.id}-${quality}`} data-card-id={e.id} data-quality={quality} className={`row quality-${quality} ${missing ? 'deck-missing' : ''}`}
          role="button" tabIndex={0} aria-disabled={busy || companion || undefined}
          aria-label={`${c?.name || e.id}，${qualityLabel}，${count}张${companion ? '，由携带卡提供' : '，单击移除一张'}，右键查看详情`}
          onClick={remove}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); remove(); } }}
          onContextMenu={event => { event.preventDefault(); if (c) onCard({ ...c, displayQuality: quality }); }}
          onMouseEnter={event => { keepSideboard(); setSideboardAnchor(sideboardRule(e.id) ? { id: e.id, rect: event.currentTarget.getBoundingClientRect() } : null); }}
          onMouseLeave={hideSideboard}
          onFocus={event => { if (sideboardRule(e.id)) { keepSideboard(); setSideboardAnchor({ id: e.id, rect: event.currentTarget.getBoundingClientRect() }); } }}
          title={`${c?.name || e.id} · ${qualityLabel} ×${count}${companion ? ' · 随卡携带，继承携带卡品质' : ''}${missing ? ` · 缺少 ${missing} 张此品质` : ''}${DECK_RULES[e.id]?.deckCopies ? ` · 占${DECK_RULES[e.id].deckCopies}格` : ''}`}>
          {c && <DeckStripArt card={c} mode={artMode} />}
          <b className="cost">{c?.cost ?? '?'}</b><span className="card-name">{c?.name || `未知卡牌 #${e.id}`}</span>
          {!companion && <span className="deck-count">×{count}</span>}
        </div>;
      });
    })}{!draft.entries.length && <p className="deck-empty">从左侧收藏中选择卡牌开始构筑。</p>}</div>
    {sideboardAnchor && <DeckSideboardPopover ownerId={sideboardAnchor.id} anchor={sideboardAnchor.rect} controller={controller} cards={deckCards} onCard={onCard} onEnter={keepSideboard} onLeave={hideSideboard} onClose={() => setSideboardAnchor(null)} artMode={artMode} />}
    <div className="deck-foot"><button className="gold-button" disabled={busy || !ready || !draft.name.trim()} onClick={controller.save}>{busy ? '保存中…' : '保存套牌'}</button><button className="simple-button" disabled={busy} onClick={onFinish}>结束构筑</button></div>
    <small>草稿在结束构筑后保留，可返回继续编辑。</small>
  </aside>;
}

