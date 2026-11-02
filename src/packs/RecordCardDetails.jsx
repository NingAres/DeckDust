import { useState } from 'react';
import CardArt from './PackCardArt.jsx';
import Icon from '../components/Icon.jsx';
import { QualitySymbol } from './PackSymbol.jsx';
import { recordedCards } from './recorded-cards.js';
import { PACK_MOTION } from './pack-motion.js';

export default function RecordCardDetails({ record, catalog }) {
  const details = recordedCards(record, catalog);
  const eventPacks = Array.isArray(record.cardPacks) ? record.cardPacks.map(pack => ({ id: pack.id, cards: pack.cards || [] })).filter(pack => pack.cards.length) : [];
  const packs = eventPacks.length
    ? eventPacks
    : record.count > 1 && details.length > 5 && details.length % 5 === 0
      ? Array.from({ length: details.length / 5 }, (_, index) => ({ id: `${record.id}-${index}`, cards: details.slice(index * 5, index * 5 + 5) }))
      : [{ id: record.id, cards: details }];
  const [activePack, setActivePack] = useState(0);
  const selectedPack = packs[Math.min(activePack, packs.length - 1)];
  const changePack = nextPack => {
    if (nextPack < 0 || nextPack >= packs.length || nextPack === activePack) return;
    setActivePack(nextPack);
  };
  if (!details.length) return <div className="pack-no-card-details"><Icon name="collection" /><div><strong>本条记录没有单卡明细</strong><p>{record.source === '手动录入' ? '手动录入仅保存品质数量，不生成卡牌图片。' : '这条日志记录未保留卡牌明细，仅可查看数量。'}</p></div></div>;
  return <section className="record-card-details"><div className="pack-section-heading"><h3>本包卡牌 {packs.length > 1 ? <small>第 {activePack + 1} / {packs.length} 包</small> : null}</h3>
    {packs.length > 1 ? <label className="record-pack-picker record-pack-picker-compact"><select value={activePack} aria-label="快速选择卡包" onChange={event => changePack(Number(event.target.value))}>{packs.map((pack, index) => <option key={pack.id || index} value={index}>{index + 1}</option>)}</select><Icon name="right" className="record-pack-picker-chevron" /></label> : null}
  </div>
    <div className="pack-card-line pack-card-line-switch" key={selectedPack.id || activePack} style={{ '--pack-switch-duration': `${PACK_MOTION.cardPackSwitch}ms`, '--pack-switch-easing': PACK_MOTION.easing }}>{selectedPack.cards.map((entry, index) => <div className="pack-card-preview" key={`${entry.card.id}-${entry.qualityKey}-${index}`} data-card-id={entry.card.id} data-quality={entry.qualityKey}><CardArt card={entry.card} quality={entry.quality} /><span><QualitySymbol quality={entry.qualityKey} />{entry.card.name}</span></div>)}</div>
    {packs.length > 1 ? <nav className="record-pack-arrows" aria-label="切换卡包"><button type="button" className="record-pack-arrow" aria-label="上一包" disabled={activePack === 0} onClick={() => changePack(activePack - 1)}><Icon name="left" /></button><span className="sr-only" aria-live="polite">第 {activePack + 1} / {packs.length} 包</span><button type="button" className="record-pack-arrow" aria-label="下一包" disabled={activePack >= packs.length - 1} onClick={() => changePack(activePack + 1)}><Icon name="right" /></button></nav> : null}
  </section>;
}

