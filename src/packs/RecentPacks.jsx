import { useMemo, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import CardArt from './PackCardArt.jsx';
import { QualitySymbol } from './PackSymbol.jsx';
import { PACK_TYPES } from './demo.js';
import RecordedDatePicker from './RecordedDatePicker.jsx';
import { recordedCards } from './recorded-cards.js';

export default function RecentPacks({ records, cards, onClose }) {
  const [date, setDate] = useState('');
  const [limit, setLimit] = useState(10);
  const resultsRef = useRef(null);
  const events = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)).flatMap(record => {
    const details = recordedCards(record, cards);
    const packCount = Math.floor(details.length / 5);
    return Array.from({ length: packCount }, (_, pack) => ({ ...record, eventId: `${record.id}-${pack}`, entries: details.slice(pack * 5, pack * 5 + 5), pack: pack + 1, packCount }));
  }), [records, cards]);
  const matching = events.filter(event => !date || event.date.startsWith(date));
  const visible = matching.slice(0, limit);
  async function transitionResults(update) {
    const element = resultsRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (element) {
      const exitFrames = reduced ? [{ opacity: 1 }, { opacity: .55 }] : [{ opacity: 1, transform: 'translateY(0)' }, { opacity: .45, transform: 'translateY(-8px)' }];
      await element.animate(exitFrames, { duration: reduced ? 120 : 130, easing: 'ease-out' }).finished.catch(() => {});
    }
    update();
    requestAnimationFrame(() => {
      if (!element) return;
      const enterFrames = reduced ? [{ opacity: .55 }, { opacity: 1 }] : [{ opacity: .45, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }];
      element.animate(enterFrames, { duration: reduced ? 120 : 240, easing: 'cubic-bezier(.2,.75,.25,1)' });
    });
  }
  return <Modal title="最近开包记录" className="pack-dialog pack-recent-dialog" onClose={onClose}>
    <div className="pack-recent-controls"><RecordedDatePicker value={date} events={events} onChange={value => transitionResults(() => { setDate(value); setLimit(10); })} /><span>{date || '最近记录'} · 展示 {visible.length} 包</span></div>
    <p className="pack-footnote">展示已保存的逐包卡牌明细。未能可靠关联到旧单次历史的实包独立保留，不猜测归属。</p>
    <div ref={resultsRef} className="pack-recent-list">{visible.map(event => <article className="pack-real-event" key={event.eventId}><header><div><time>{event.date.replace('T', ' ')}</time><span>{event.set} · {PACK_TYPES[event.type] || '未关联卡包类型'}</span></div><small>{event.packCount > 1 ? `第 ${event.pack} / ${event.packCount} 包` : '本次开包'} · 5 张</small></header><div className="pack-card-line">{event.entries.map(({ card, quality, qualityKey }, index) => {
      return <div className={`pack-card-preview real-${quality}`} key={`${card.id}-${index}`}><CardArt card={card} quality={quality} /><span><QualitySymbol quality={qualityKey} />{quality === 'golden' ? '金色' : quality === 'signature' ? '异画' : ''}{card.name}</span></div>;
    })}</div></article>)}</div>
    {!visible.length ? <div className="pack-empty"><h3>这一天没有实包记录</h3><p>试试其他日期，或切回全部日期。</p></div> : null}
    <div className="dialog-actions">{matching.length > limit ? <button className="simple-button" onClick={() => transitionResults(() => setLimit(previous => previous + 10))}>再展示 10 包</button> : null}<button className="gold-button" onClick={onClose}>关闭</button></div>
  </Modal>;
}

