import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import ClassEmblem from '../components/ClassEmblem.jsx';
import { deckClass, deckStats, encodeDeck, FORMATS, HERO_ART } from './model.js';
import Icon from '../components/Icon.jsx';
import PackSymbol from '../packs/PackSymbol.jsx';
import DeckClassArt from './DeckClassArt.jsx';
import PackCardArt from '../packs/PackCardArt.jsx';
import './decks.css';

function DustBreakdown({ kind, value, entries, craftEntries = [], loading }) {
  const [open, setOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const anchorRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipTimer = useRef(null);
  const tooltipId = useId();
  useEffect(() => () => clearTimeout(tooltipTimer.current), []);
  const golden = kind === 'golden';
  const label = golden ? '待镀金粉尘' : '缺卡合成粉尘';
  const allEntries = [...entries, ...craftEntries];
  const totalCopies = allEntries.reduce((sum, entry) => sum + (entry.missing || 0), 0);
  const rarityOrder = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
  const rarityLabels = { COMMON: '普通', RARE: '稀有', EPIC: '史诗', LEGENDARY: '传说' };
  const rarityIcons = { COMMON: 'common', RARE: 'rare', EPIC: 'epic', LEGENDARY: 'legendary' };
  const raritySummary = rarityOrder.map(rarity => ({
    rarity,
    count: allEntries.reduce((sum, entry) => sum + ((entry.card?.rarity || 'COMMON') === rarity ? (entry.missing || 0) : 0), 0),
  })).filter(item => item.count > 0);
  const renderEntries = (list, upgradeToGolden = false) => list.length ? <div className="dust-tooltip-grid">
    {list.map(entry => {
      const unowned = entry.owned === 0;
      const rarity = entry.card?.rarity || 'COMMON';
      const amount = entry.missing || 0;
      const ownedCounts = entry.card?.counts || [];
      const displayQuality = upgradeToGolden && (ownedCounts[0] || 0) > 0 ? 'normal'
        : ['diamond', 'signature', 'golden', 'normal'].find((quality, index) => ownedCounts[{ diamond: 2, signature: 3, golden: 1, normal: 0 }[quality]] > 0) || 'normal';
      const missingStyle = golden ? unowned : entry.missing > 0 || unowned;
      return <div className={`dust-breakdown-card ${missingStyle ? 'is-missing' : ''}`} key={entry.id} title={`${entry.name} · ${rarityLabels[rarity] || '普通'} ×${amount}`}>
        {entry.card ? <PackCardArt card={entry.card} quality={displayQuality} /> : <div className="dust-unknown-card">未知卡牌</div>}
        <div className="dust-breakdown-info"><b>{entry.name}</b><span><PackSymbol rarity={rarityIcons[rarity] || 'common'} golden={displayQuality === 'golden'} signature={displayQuality === 'signature'} diamond={displayQuality === 'diamond'} />{rarityLabels[rarity] || '普通'}</span></div>
        <strong className="dust-breakdown-count">×{amount}</strong>
      </div>;
    })}
  </div> : <div className="dust-tooltip-empty">没有卡牌</div>;
  function showTooltip(element) {
    clearTimeout(tooltipTimer.current);
    anchorRef.current = element.querySelector('.dust-value') || element;
    tooltipTimer.current = setTimeout(() => {
      setTooltipPosition(null);
      setOpen(true);
    }, 500);
  }
  function hideTooltip() { clearTimeout(tooltipTimer.current); setOpen(false); }
  function openTooltipImmediately(event) {
    clearTimeout(tooltipTimer.current);
    setOpen(current => event.detail === 0 ? !current : true);
  }
  useLayoutEffect(() => {
    if (!open) {
      setTooltipPosition(null);
      return undefined;
    }
    const tooltip = tooltipRef.current;
    const anchor = anchorRef.current;
    if (!tooltip || !anchor) return undefined;

    const placeTooltip = () => {
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const margin = 12, gap = 8;
      const pageRect = anchor.closest('.main')?.getBoundingClientRect();
      const bounds = pageRect || { left: 0, right: viewportWidth, top: 0, bottom: viewportHeight };
      const leftEdge = Math.max(margin, bounds.left + margin);
      const rightEdge = Math.min(viewportWidth - margin, bounds.right - margin);
      const topEdge = Math.max(margin, bounds.top + margin);
      const bottomEdge = Math.min(viewportHeight - margin, bounds.bottom - margin);
      const anchorRect = anchor.getBoundingClientRect();
      const maxWidth = Math.max(1, Math.min(440, rightEdge - leftEdge));
      const maxViewportHeight = Math.max(1, bottomEdge - topEdge);
      tooltip.style.width = `${maxWidth}px`;
      tooltip.style.maxWidth = `${maxWidth}px`;
      tooltip.style.maxHeight = `${maxViewportHeight}px`;
      const width = tooltip.getBoundingClientRect().width;
      const height = tooltip.getBoundingClientRect().height;
      const belowSpace = Math.max(0, bottomEdge - anchorRect.bottom - gap);
      const aboveSpace = Math.max(0, anchorRect.top - topEdge - gap);
      const side = height <= belowSpace ? 'below'
        : height <= aboveSpace ? 'above'
          : belowSpace >= aboveSpace ? 'below' : 'above';
      const availableHeight = side === 'above' ? aboveSpace : belowSpace;
      const maxHeight = Math.max(1, Math.min(maxViewportHeight, availableHeight));
      tooltip.style.maxHeight = `${maxHeight}px`;
      const placedHeight = tooltip.getBoundingClientRect().height;
      const preferredLeft = kind === 'golden' ? anchorRect.right - width : anchorRect.left;
      const left = Math.max(leftEdge, Math.min(preferredLeft, rightEdge - width));
      const preferredTop = side === 'above'
        ? anchorRect.top - gap - placedHeight
        : anchorRect.bottom + gap;
      const top = Math.max(topEdge, Math.min(preferredTop, bottomEdge - placedHeight));
      const next = { left, top, width: maxWidth, maxWidth, maxHeight, side };
      setTooltipPosition(current => current
        && current.left === next.left && current.top === next.top
        && current.width === next.width
        && current.maxWidth === next.maxWidth && current.maxHeight === next.maxHeight
        && current.side === next.side ? current : next);
    };

    placeTooltip();
    window.addEventListener('resize', placeTooltip);
    window.addEventListener('scroll', placeTooltip, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(placeTooltip);
    observer?.observe(tooltip);
    observer?.observe(anchor);
    return () => {
      window.removeEventListener('resize', placeTooltip);
      window.removeEventListener('scroll', placeTooltip, true);
      observer?.disconnect();
    };
  }, [open, kind, entries, craftEntries, loading]);
  return <div className={`dust ${golden ? 'golden-dust' : 'normal-dust'} dust-breakdown ${golden ? 'golden-breakdown' : 'missing-breakdown'}`}
    onMouseEnter={event => showTooltip(event.currentTarget)} onFocus={event => showTooltip(event.currentTarget)} onMouseLeave={event => {
      clearTimeout(tooltipTimer.current);
      if (event.relatedTarget?.closest?.('.pack-card-lightbox')) return;
      if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
    }} onBlur={event => {
      const nextTarget = event.relatedTarget;
      if (!event.currentTarget.contains(nextTarget) && !nextTarget?.closest?.('.pack-card-lightbox')) hideTooltip();
    }}>
    <button type="button" className="dust-value" aria-label={`${label} ${loading && !golden ? '—' : value.toLocaleString()}`}
      aria-expanded={open} aria-describedby={open ? tooltipId : undefined} title="悬浮半秒或点击查看卡牌明细" onClick={openTooltipImmediately}
      onKeyDown={event => { if (event.key === 'Escape') hideTooltip(); }}>
      <PackSymbol rarity="dust" />{loading && !golden ? '—' : value.toLocaleString()}
    </button>
      {open && <div ref={tooltipRef} className={`dust-tooltip ${tooltipPosition?.side === 'above' ? 'opens-above' : 'opens-below'}`}
        style={tooltipPosition ? {
          left: tooltipPosition.left,
          top: tooltipPosition.top,
          width: tooltipPosition.width,
          maxWidth: tooltipPosition.maxWidth,
          maxHeight: tooltipPosition.maxHeight,
        } : { visibility: 'hidden' }} id={tooltipId} role="tooltip">
      <header><strong>{golden ? '金卡制作清单' : '普通卡缺卡清单'}</strong>
        <span>{golden ? `缺少 ${totalCopies} 张` : `缺少 ${totalCopies} 张`}</span></header>
      {!loading && raritySummary.length > 0 && <div className="dust-tooltip-summary" aria-label="按卡牌稀有度汇总">
        {raritySummary.map(item => <span key={item.rarity} title={`${rarityLabels[item.rarity]} ×${item.count}`}>
          <PackSymbol rarity={rarityIcons[item.rarity]} golden={golden} /><b>×{item.count}</b>
        </span>)}
        <strong className="dust-breakdown-total" title="缺少的合成粉尘"><span className="dust-deficit-label">缺</span><PackSymbol rarity="dust" />{value.toLocaleString()} <small>尘</small></strong>
      </div>}
      {loading ? <div className="dust-tooltip-empty">卡牌资料载入中…</div> : golden ? <div className="golden-card-lists">
        <section><h4>待镀金卡清单 <small>{entries.reduce((sum, entry) => sum + entry.missing, 0)} 张</small></h4>{renderEntries(entries, true)}</section>
        <section><h4>待合成金卡清单 <small>{craftEntries.reduce((sum, entry) => sum + entry.missing, 0)} 张</small></h4>{renderEntries(craftEntries)}</section>
      </div> : entries.length ? renderEntries(entries) : <div className="dust-tooltip-empty">没有缺卡</div>}
    </div>}
  </div>;
}

export default function Decks({ cards, cardReferences = [], loading, controller, onNotice }) {
  const { decks, draft, ready, busy, refreshing, refreshDecks, error, setDialog } = controller;
  return <section className="decks-library" aria-label="我的套牌记录">
    <div className="saved-heading"><div><small>YOUR DECKS</small><h2 className="page-title">我的套牌</h2><p>新建或选择套牌，在我的收藏中构筑。</p></div><span className="deck-record-count">{decks.length} 套</span>
      <div className="deck-library-actions"><button type="button" className={`deck-refresh-icon${refreshing ? ' is-refreshing' : ''}`} aria-label="刷新套牌列表" title="刷新套牌列表" disabled={!ready || busy || refreshing || loading} onClick={refreshDecks}><Icon name="refresh" /></button><button className="simple-button" disabled={!ready || busy || loading} onClick={() => setDialog({ type: 'import' })}>导入套牌</button><button className="gold-button" disabled={!ready || busy || loading} onClick={() => setDialog({ type: 'new' })}>新建套牌</button></div></div>
    {error && <p className="deck-error" role="alert">{error}</p>}
    {draft && <div className="draft-resume"><span>当前草稿：<b>{draft.name || '未命名套牌'}</b>{controller.dirty ? ' · 未保存' : ''}</span><button className="simple-button" onClick={() => controller.start(draft)} disabled={busy}>继续构筑</button></div>}
    {!ready ? <p role="status">{error ? '套牌读取失败，请重启后重试。' : '正在读取本机套牌…'}</p> : !decks.length ? <div className="deck-empty"><h3>开始你的第一套构筑</h3><p>选择职业新建，或通过卡组代码 / JSON 文件导入。</p><small>新建后会进入我的收藏，直接点卡添加。</small></div> : <div className="saved-list">{decks.map(deck => {
      const stats = deckStats(deck, cards), cls = deckClass(deck, [...cards, ...cardReferences]);
      const ownershipState = stats.missing > 0 ? 'is-missing' : stats.owned >= stats.limit ? 'is-complete' : 'is-partial';
      return <article key={deck.id} className={`saved-card ${draft?.id === deck.id ? 'selected' : ''}`}>
        <DeckClassArt cardId={cardReferences.find(card => card.dbfId === deck.hero)?.id || HERO_ART[cls]} fallbackCardId={HERO_ART[cls]} className="saved-class-art" />
        <header className="saved-head"><ClassEmblem cardClass={cls} /><div className="saved-title">
          <div className="saved-title-line"><h3>{deck.name}</h3><div className="saved-tags" aria-label="卡组模式与进度">
            <span className={`saved-tag saved-tag-format format-${deck.format}`}>{FORMATS[deck.format]}</span>
            <span className={`saved-tag saved-tag-progress ${ownershipState}`}
              aria-label={stats.missing > 0 ? `已拥有 ${stats.owned} 张，卡组上限 ${stats.limit} 张，缺少 ${stats.missing} 张` : `已拥有 ${stats.owned} 张，卡组上限 ${stats.limit} 张`}
              title={stats.missing > 0 ? `已拥有 ${stats.owned} 张，卡组上限 ${stats.limit} 张，缺少 ${stats.missing} 张` : `已拥有 ${stats.owned} 张，卡组上限 ${stats.limit} 张`}>
              {stats.owned}/{stats.limit}
            </span>
          </div></div>
        </div></header>
        <div className="dust-grid"><DustBreakdown kind="missing" value={stats.dust} entries={stats.missingCards} loading={loading} /><DustBreakdown kind="golden" value={stats.fullDust} entries={stats.goldenCards} craftEntries={stats.goldenCraftCards} loading={loading} /></div>
        <div className="saved-actions">
          <button className="saved-icon-action" aria-label="构筑" title="构筑" disabled={busy || loading} onClick={() => controller.start(structuredClone(deck))}><Icon name="build" /></button>
          <button className="saved-icon-action" aria-label="复制卡组代码" title="复制卡组代码" onClick={async () => {
            const code = deck.code || encodeDeck(deck);
            try {
              await navigator.clipboard.writeText(code);
              if (!deck.code) {
                const saved = await controller.saveCode(deck, code);
                onNotice(saved ? '卡组代码已复制并保存。' : '卡组代码已复制，但保存失败。');
              } else onNotice('卡组代码已复制。');
            } catch { onNotice('复制失败，请从“导出”中选中代码手动复制。'); }
          }}><Icon name="copy" /></button>
          <button className="saved-icon-action" aria-label="导出" title="导出" onClick={() => setDialog({ type: 'export', deck })}><Icon name="export" /></button>
          <button className="saved-icon-action danger" aria-label="删除" title="删除" disabled={busy} onClick={() => setDialog({ type: 'delete', deck })}><Icon name="trash" /></button>
        </div>
      </article>;
    })}</div>}
  </section>;
}

