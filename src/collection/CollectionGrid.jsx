import { memo, useEffect, useState } from 'react';
import CardArt from './CardArt.jsx';
import { prefetchArt } from './api.js';
import { bestQuality, ownedCount, QUALITIES, requiredCopies } from './model.js';
import Icon from '../components/Icon.jsx';
import usePageTurn from './usePageTurn.js';
import { deckEntryVariants } from '../decks/model.js';

const CollectionCard = memo(function CollectionCard({ card, quality, onSelect, deckCount, deckTotal, onDetails, addMode, dragMode, onNotice }) {
  const [aspectRatio, setAspectRatio] = useState(256 / 333);
  const visualQuality = card.displayQuality || quality || bestQuality(card);
  const count = ownedCount(card, visualQuality);
  const qualityUsedUp = dragMode && count > 0 && deckCount >= count && deckTotal >= requiredCopies(card);
  const label = QUALITIES.find(([key]) => key === visualQuality)?.[1];
  return <button type="button" draggable={dragMode} className={`card quality-${visualQuality} ${dragMode ? 'deck-draggable' : ''} ${qualityUsedUp ? 'quality-used-up' : ''} ${count && !card.deckMissing ? '' : 'unowned'}`}
    data-card-id={card.dbfId}
    aria-disabled={qualityUsedUp || undefined}
    title={`${card.name} · ${label} · ${count ? `已拥有 ${count} 张` : '未拥有'}${qualityUsedUp ? ' · 此品质数量已用完' : addMode ? ' · 点击或拖拽加入套牌' : ''}${onDetails ? ' · 右键查看详情' : ''}`}
    aria-label={`${card.name}，${label}，${count ? `已拥有 ${count} 张` : '未拥有'}，${qualityUsedUp ? '此品质数量已用完' : addMode ? `添加到套牌，已加入 ${deckCount} 张` : '查看详情'}`}
    onContextMenu={onDetails ? event => { event.preventDefault(); onDetails(card); } : undefined}
    onDragStart={dragMode ? event => {
      if (qualityUsedUp) {
        event.preventDefault();
        onNotice?.(`${card.name}的${label}卡牌数量已用完。`);
        return;
      }
      const payload = JSON.stringify({ dbfId: card.dbfId, quality: visualQuality });
      event.dataTransfer.setData('application/x-deck-dust-card', payload);
      event.dataTransfer.setData('text/plain', payload);
      event.dataTransfer.effectAllowed = 'copy';
      event.currentTarget.classList.add('dragging-card');
    } : undefined}
    onDragEnd={dragMode ? event => event.currentTarget.classList.remove('dragging-card') : undefined}
    onClick={() => onSelect(card)}>
    <div className="collection-card-face" style={{ '--face-ratio': aspectRatio }}><CardArt card={card} quality={visualQuality} trim onAspectRatio={setAspectRatio} />
    <span className="owned">{card.deckMissing ? `缺 ${card.deckMissing} 张` : count ? `×${count}` : '未拥有'}</span>
    {onDetails && deckCount > 0 && <span className="deck-card-count">已加入 ×{deckCount}</span>}</div>
  </button>;
});

export default function CollectionGrid({ cards, nextPageCards = [], quality, page, total, filterKey, onPage, onSelect, onReset, loading, deckEntries, onDetails, addMode, dragMode, onNotice }) {
  const pages = Math.max(1, Math.ceil(total / 10));
  const turn = usePageTurn({ page, filterKey, loading, pages, onPage });
  useEffect(() => {
    if (!loading && nextPageCards.length) prefetchArt(nextPageCards, quality);
  }, [nextPageCards, quality, loading]);
  return <>
    <div className="collection-page" ref={turn.stage} role="region" aria-label="收藏卡牌页面，支持滚轮翻页" aria-busy={turn.busy || loading}>
    {loading ? <div className="cards skeleton-grid" aria-label="正在载入收藏" aria-busy="true">{Array.from({ length: 10 }, (_, index) => <div className="skeleton-card" key={index} />)}</div> :
      cards.length ? <div className="cards" id="collection-cards" ref={turn.grid} onLoadCapture={turn.remember} aria-label="收藏卡牌">
        {cards.map(card => <CollectionCard key={`${card.dbfId}-${card.displayQuality || quality}`} card={card} quality={quality} onSelect={onSelect} addMode={addMode} dragMode={dragMode} onNotice={onNotice}
          deckTotal={deckEntries?.find(entry => entry.id === card.dbfId)?.count || 0}
          deckCount={deckEntries ? deckEntryVariants(deckEntries.find(e => e.id === card.dbfId) || {id:card.dbfId,count:0,variants:{}}, card).find(row => row.quality === (card.displayQuality || quality || bestQuality(card)))?.count || 0 : 0} onDetails={onDetails} />)}
      </div> : <div className="empty-state"><Icon name="search" /><h2>没有符合条件的卡牌</h2><p>试试其他职业、扩展包或搜索词。</p><button className="simple-button" onClick={onReset}>重置筛选</button></div>}
    </div>
    <div className="pagination" aria-label="收藏分页" title="支持鼠标滚轮翻页和左右方向键翻页">
      <span className="result-count">{total.toLocaleString()} 个版本</span>
      <button type="button" aria-label="上一页" disabled={page === 0 || loading || turn.busy} onClick={() => onPage(page - 1)}><Icon name="left" /></button>
      <label className="page-label">第 <input aria-label="页码" type="number" min="1" max={pages} key={`${page}-${pages}`} defaultValue={page + 1}
        onBlur={event => { const value = Number(event.target.value); onPage(Number.isFinite(value) ? Math.min(pages - 1, Math.max(0, Math.trunc(value) - 1)) : 0); event.target.value = String(page + 1); }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /> / {pages.toLocaleString()} 页</label>
      <button type="button" aria-label="下一页" disabled={page >= pages - 1 || loading || turn.busy} onClick={() => onPage(page + 1)}><Icon name="right" /></button>
      <span className="page-size">每页 10 张</span>
      <button type="button" className="page-motion-toggle" aria-label="结果动画" aria-pressed={turn.motionEnabled}
        title="筛选、翻页和收藏更新时淡入淡出；设置会自动保存" onClick={turn.toggleMotion}>结果动画{turn.motionEnabled ? '：开' : '：关'}</button>
    </div>
  </>;
}

