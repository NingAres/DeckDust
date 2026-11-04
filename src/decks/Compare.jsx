import { useEffect, useMemo, useState } from 'react';
import ClassEmblem from '../components/ClassEmblem.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import CardArt from '../packs/PackCardArt.jsx';
import PackSymbol from '../packs/PackSymbol.jsx';
import DeckStripArt from './DeckStripArt.jsx';
import DeckClassArt from './DeckClassArt.jsx';
import { deckClass, deckStats, decodeDeck, FORMATS, HERO_ART, deckEntryVariants, orderDeckVariantsForDisplay, inheritCompanionVariants, isDeckCompanion } from './model.js';
import { request } from '../collection/api.js';
import './compare.css';

const RARITY_KEYS = { COMMON: 'common', RARE: 'rare', EPIC: 'epic', LEGENDARY: 'legendary', FREE: 'common' };
const RARITY_LABELS = { COMMON: '普通', RARE: '稀有', EPIC: '史诗', LEGENDARY: '传说', FREE: '免费' };
function resultQualityLabel(quality, rarity) {
  if (quality === 'diamond') return '钻石';
  if (quality === 'signature') return '异画传说';
  const rarityLabel = RARITY_LABELS[rarity] || '';
  if (quality === 'golden') return `金色${rarityLabel}`;
  return rarityLabel || '普通';
}
function ResultQualitySymbol({ quality, rarity }) {
  return <PackSymbol rarity={RARITY_KEYS[rarity] || 'common'} golden={quality === 'golden'} signature={quality === 'signature'} diamond={quality === 'diamond'} />;
}

export default function Compare({ decks, cards, cardReferences = [], loading, artMode = 'cover' }) {
  const [sides, setSides] = useState({ A: null, B: null });
  const [open, setOpen] = useState('A');
  const [code, setCode] = useState({ A: '', B: '' });
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [lookedUpCards, setLookedUpCards] = useState([]);
  const deckCards = useMemo(() => {
    const known = new Map(cards.map(card => [card.dbfId, card]));
    for (const card of cardReferences) if (!known.has(card.dbfId)) known.set(card.dbfId, { ...card, counts: [0, 0, 0, 0] });
    for (const card of lookedUpCards) if (!known.has(card.dbfId)) known.set(card.dbfId, { ...card, counts: [0, 0, 0, 0] });
    return [...known.values()];
  }, [cards, cardReferences, lookedUpCards]);
  const cardMap = useMemo(() => new Map(deckCards.map(card => [card.dbfId, card])), [deckCards]);
  const classCards = useMemo(() => [...cards, ...cardReferences], [cards, cardReferences]);
  const getClass = deck => deckClass(deck, classCards);
  const select = (side, deck) => { setSides(current => ({ ...current, [side]: deck })); setError(''); setOpen(side === 'A' ? 'B' : 'A'); };
  const clear = side => { setSides(current => ({ ...current, [side]: null })); setOpen(side); setCode(current => ({ ...current, [side]: '' })); setError(''); };
  const available = side => decks.filter(deck => String(deck.id) !== String(sides[side === 'A' ? 'B' : 'A']?.id));
  useEffect(() => {
    const wanted = [...new Set(['A','B'].flatMap(side => (sides[side]?.entries || []).map(entry => entry.id)))].filter(id => !cardMap.has(id));
    if (!wanted.length) return;
    let active = true;
    request(`cards/lookup?ids=${wanted.slice(0,100).join(',')}`).then(data => { if (active) setLookedUpCards(current => [...new Map([...current,...data.cards].map(card => [card.dbfId,card])).values()]); }).catch(() => {});
    return () => { active = false; };
  }, [sides.A, sides.B, cardMap]);
  const importCode = side => {
    try {
      const parsed = decodeDeck(code[side]);
      const deck = { ...parsed, id: `code-${side}`, name: parsed.name || `代码套牌 ${side}` };
      select(side, deck); setCode(current => ({ ...current, [side]: '' }));
    } catch (e) { setError(e.message); }
  };
  const a = sides.A, b = sides.B;
  const diffs = useMemo(() => {
    const left = new Map((a?.entries || []).map(row => [row.id, row.count]));
    const right = new Map((b?.entries || []).map(row => [row.id, row.count]));
    return [...new Set([...left.keys(), ...right.keys()])].filter(id => !isDeckCompanion(id)).map(id => ({ id, a: left.get(id)||0, b: right.get(id)||0, card: cardMap.get(id) }))
      .filter(row => row.a !== row.b).sort((x,y) => (x.card?.cost ?? 99)-(y.card?.cost ?? 99));
  }, [a,b,cardMap]);
  const owned = id => cardMap.get(id)?.counts?.slice(0,4).reduce((sum,n)=>sum+(n||0),0)||0;
  const total = deck => deck?.entries.reduce((n,row)=>n+row.count,0)||0;
  const qualityRows = row => {
    const difference = Math.abs(row.a-row.b), counts = row.card?.counts || [0,0,0,0];
    const indexes = [['diamond',2],['signature',3],['golden',1],['normal',0]];
    let remaining = difference;
    const result = [];
    for (const [quality,index] of indexes) {
      const count = Math.min(remaining,counts[index]||0);
      if (count) result.push({quality,count,owned:true});
      remaining -= count;
    }
    if (remaining) result.push({quality:'normal',count:remaining,owned:false});
    return result;
  };
  const resultCards = (side) => diffs.filter(row=>side==='A'?row.a>row.b:row.b>row.a).flatMap(row=>qualityRows(row).map(finish=>({...row,...finish,side}))); 
  const renderPanel = (side, deck) => {
    const cls = deck ? getClass(deck) : '';
    const stats = deck ? deckStats(deck, deckCards) : null;
    return <section key={side} className={`comparison-deck-panel ${side.toLowerCase()} ${deck ? 'is-filled' : ''}`}>
      {deck ? <aside key={String(deck.id)} className="deck deck-editor comparison-preview" aria-label={`${side} 套牌预览`}>
        <div className="deck-hero"><DeckClassArt cardId={cardReferences.find(card=>card.dbfId===deck.hero)?.id||HERO_ART[cls]} fallbackCardId={HERO_ART[cls]} className="deck-class-art"/><ClassEmblem cardClass={cls}/><b>{deck.name}</b></div>
        <div className="deck-info">{cls} · {FORMATS[deck.format]||'标准'} · {stats.total}/{stats.limit} 张 <span className={`saved-tag saved-tag-progress ${stats.missing>0?'is-missing':stats.owned>=stats.limit?'is-complete':'is-partial'}`}>{stats.owned}/{stats.limit}</span></div>
        <div className="deck-list comparison-preview-list">{inheritCompanionVariants(deck,deckCards).entries.slice().sort((x,y)=>(cardMap.get(x.id)?.cost??99)-(cardMap.get(y.id)?.cost??99)||x.id-y.id).flatMap(entry=>{const card=cardMap.get(entry.id),companion=isDeckCompanion(entry.id);return orderDeckVariantsForDisplay(deckEntryVariants(entry,card)).map(({quality,count,missing})=><div className={`row quality-${quality} ${missing?'deck-missing':''}`} key={`${entry.id}-${quality}`} title={`${card?.name||`未知卡牌 #${entry.id}`} · ${quality} ×${count}${companion?' · 随携带卡提供':''}`}>
          {card&&<DeckStripArt card={card} mode={artMode}/>}<b className="cost">{card?.cost??'?'}</b><span className="card-name">{card?.name||`未知卡牌 #${entry.id}`}</span>{!companion&&<span className="deck-count">×{count}</span>}
        </div>)})}</div>
      </aside> : <div className="comparison-panel-empty"><div className={`side-letter ${side.toLowerCase()}`}>{side}</div><span>选择已有套牌或粘贴卡组代码<br/>这里会展示完整卡牌列表</span></div>}
    </section>;
  };
  return <section className="compare-workspace">
    <div className="comparison-center"><div className="comparison-panels">{renderPanel('A',a)}{renderPanel('B',b)}</div></div>
    <aside className={`comparison-controls ${a&&b?'has-both-selected':a||b?'has-one-selected':''}`}><div className="control-heading"><h3>选择对比套牌</h3></div>
      {['A','B'].map(side=>{const deck=sides[side], cls=deck?getClass(deck):'', stats=deck?deckStats(deck,deckCards):null;return <section className={`setup-block ${side.toLowerCase()} ${deck?'selected':''}`} key={side}>
        <div className="setup-side-title"><span className={`side-letter ${side.toLowerCase()}`}>{side}</span><b>{side} 套牌</b></div>
        {deck ? <>
          <div className="chosen-deck"><ClassEmblem cardClass={cls}/><div className="chosen-copy"><b>{deck.name}</b><div className="chosen-tags"><span className={`saved-tag saved-tag-format format-${deck.format}`}>{FORMATS[deck.format]||'标准'}</span><span className={`saved-tag saved-tag-progress ${stats.missing>0?'is-missing':stats.owned>=stats.limit?'is-complete':'is-partial'}`}>{stats.owned}/{stats.limit}</span></div></div><button className="undo-selection" onClick={()=>clear(side)} aria-label={`撤回${side}套牌选择`} title="撤回选择">↶</button></div>
          <div className="comparison-selected-overview">
            <div className="comparison-selected-banner"><DeckClassArt cardId={cardReferences.find(card=>card.dbfId===deck.hero)?.id||HERO_ART[cls]} fallbackCardId={HERO_ART[cls]} className="comparison-selected-banner-art"/><div className="comparison-selected-banner-copy"><small>{side} 套牌 · {FORMATS[deck.format]||'标准'}</small><b>{cls || '自定义英雄'}构筑</b><span>{deck.entries.length} 种卡牌 · {stats.total} 张</span></div></div>
            <div className="comparison-selected-metrics"><div><b>{stats.total}</b><span>牌库张数</span></div><div><b>{stats.owned}</b><span>收藏拥有</span></div><div className={stats.missing ? 'has-missing' : ''}><b>{stats.missing}</b><span>缺卡</span></div></div>
          </div>
        </> : <>
          <div className="deck-options">{loading?<p className="control-muted">读取套牌中…</p>:available(side).length?available(side).map(item=>{const stats=deckStats(item,deckCards),itemClass=getClass(item);return <button className="deck-option" key={item.id} onClick={()=>select(side,item)}><ClassEmblem cardClass={itemClass}/><span><b>{item.name}</b></span><div className="option-tags"><i>{FORMATS[item.format]||'标准'}</i><i>{stats.owned} / {stats.limit}</i></div></button>}):<p className="control-muted">{decks.length?'没有其他可选套牌':'还没有已保存套牌'}</p>}</div>
          <div className="code-entry"><label htmlFor={`deck-code-${side}`}>或使用卡组代码</label><textarea id={`deck-code-${side}`} placeholder="粘贴炉石卡组代码…" value={code[side]} onFocus={()=>{setOpen(side);setError('');}} onChange={event=>setCode(current=>({...current,[side]:event.target.value}))}/><button className="simple-button" disabled={!code[side].trim()} onClick={()=>importCode(side)}>载入代码</button></div>
        </>}
      </section>;})}
      {error&&<p className="compare-error" role="alert">{error}</p>}
      <button type="button" className="gold-button compare-submit" disabled={!a||!b} onClick={()=>setShowResults(true)}><Icon name="chart"/>对比</button>
    </aside>
    {showResults&&a&&b&&<Modal title="对比结果" onClose={()=>setShowResults(false)} className="deck-compare-modal"><div className="compare-modal-intro">{a.name} <span>对照</span> {b.name} · 共 {diffs.length} 种卡牌不同</div><div className="compare-result-columns">{['A','B'].map(side=><section className={`compare-result-side ${side.toLowerCase()}`} key={side}><header><b>{side} 套牌更多</b><span>{resultCards(side).length} 张差异</span></header><div className="compare-result-list">{resultCards(side).length?resultCards(side).map((item,index)=><article className={`compare-result-card ${!item.owned?'not-owned':''} quality-${item.quality} rarity-${({COMMON:'common',RARE:'rare',EPIC:'epic',LEGENDARY:'legendary',FREE:'free'})[item.card?.rarity]||'common'}`} key={`${item.id}-${item.quality}-${index}`}>
      {item.card?<CardArt card={item.card} quality={item.quality}/>:<div className="compare-result-art-unknown">?</div>}
      <div className="compare-result-info"><b className="compare-result-name">{item.card?.name||`未知卡牌 #${item.id}`}</b><div className="compare-result-meta"><ResultQualitySymbol quality={item.quality} rarity={item.card?.rarity}/><span>{resultQualityLabel(item.quality,item.card?.rarity)}</span></div></div><strong className="compare-result-count">×{item.count}</strong>
      </article>):<p className="compare-result-empty">这一侧没有更多的卡牌。</p>}</div></section>)}</div></Modal>}
  </section>;
}

