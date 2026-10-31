import { forwardRef } from 'react';
import Icon from '../components/Icon.jsx';
import CardArt from './PackCardArt.jsx';
import PackArt from './PackArt.jsx';
import { QualitySymbol } from './PackSymbol.jsx';
import QualityCardPreview from './QualityCardPreview.jsx';
import { recordedCards } from './recorded-cards.js';
import { PACK_TYPES, QUALITY_FIELDS } from './demo.js';

const HIGH = ['signature', 'goldLegendary', 'legendary', 'goldEpic', 'epic'];
const SelectedRecord = forwardRef(function SelectedRecord({ record, catalog, onDetails }, ref) {
  const highest = HIGH.find(key => record.qualities[key] > 0);
  const cards = recordedCards(record, catalog).filter(entry => entry.qualityKey === highest);
  const unique = [...new Map(cards.map(entry => [entry.card.id, entry])).values()];
  return <section ref={ref} className="selected-record-sheet" aria-label="当前选中记录摘要">
    <div className="selected-record-body"><div className="pack-selected-identity"><PackArt set={record.set} type={record.type} assetName={record.artName} /><div><span className="pack-selected-eyebrow">当前选中 · {record.count} 包</span><h3>{record.set}</h3><p>{PACK_TYPES[record.type]} · {record.source}</p><time>{record.date.replace('T', ' ')}</time></div></div>
    <div className="pack-selected-counts"><span className="pack-selected-eyebrow">本次开包 · {record.count * 5} 张</span><div>{QUALITY_FIELDS.filter(([key]) => record.qualities[key] > 0).map(([key, label]) => <span className={`selected-quality quality-${key}`} key={key} title={`${label} ${record.qualities[key]} 张`}><QualitySymbol quality={key} /><span>{label}</span><b>{record.qualities[key]}</b></span>)}</div></div>
    <div className="pack-selected-highlights"><span className="pack-selected-eyebrow">Lucky</span>{highest ? <div className="pack-selected-lucky-label" title={QUALITY_FIELDS.find(([key]) => key === highest)[1]}><QualitySymbol quality={highest} /></div> : null}{unique.length ? <div className="pack-selected-card-names">{unique.slice(0, 3).map(entry => <QualityCardPreview key={entry.card.id} count={cards.filter(card => card.card.id === entry.card.id).length} label={entry.card.name} cards={cards.filter(card => card.card.id === entry.card.id)}><CardArt card={entry.card} quality={entry.quality} /></QualityCardPreview>)}{unique.length > 3 ? <small>另 {unique.length - 3} 种 · 详情查看</small> : null}</div> : <p>{highest ? '已记录品质数量，未保存对应卡牌明细' : "I'm not lucky 😢"}</p>}</div>
    <button className="simple-button selected-record-details" onClick={onDetails}>查看详情 <Icon name="right" /></button></div>
  </section>;
});
export default SelectedRecord;

