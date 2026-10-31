import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import CardArt from './PackCardArt.jsx';
import PackArt from './PackArt.jsx';
import { QualitySymbol } from './PackSymbol.jsx';
import { PACK_TYPES, QUALITY_FIELDS } from './demo.js';

export default function PendingPacks({ pending, expansions, checked, setChecked, expansionId, setExpansionId, busy, onConfirm, onDiscard, onClose }) {
  const [choosingExpansion, setChoosingExpansion] = useState(false);
  const selectedExpansion = expansions.find(item => item.id === expansionId);
  const selected = pending.filter(event => checked.includes(event.id));
  const counts = Object.fromEntries(QUALITY_FIELDS.map(([key]) => [key, selected.flatMap(event => event.cards).filter(entry => entry.qualityKey === key).length]));
  return <Modal title="待确认卡包" className="pack-dialog pack-queue-dialog" onClose={onClose}>
    <fieldset className="pending-expansion-picker">
      <legend>所属卡包</legend>
      {expansions.length ? <>
        <button type="button" className="pending-expansion-current" aria-expanded={choosingExpansion} onClick={() => setChoosingExpansion(open => !open)}>
          {selectedExpansion ? <PackArt set={selectedExpansion.name} type={selectedExpansion.defaultType} assetName={selectedExpansion.artName} /> : null}
          <span>{selectedExpansion ? <><strong>{selectedExpansion.name}</strong><small>{PACK_TYPES[selectedExpansion.defaultType]}</small></> : <strong>请选择卡包</strong>}</span>
          <small>{choosingExpansion ? '收起' : '更换'}</small>
        </button>
        <div className={`pending-expansion-disclosure ${choosingExpansion ? 'open' : ''}`} aria-hidden={!choosingExpansion} inert={!choosingExpansion}>
          <div className="pending-expansion-grid" aria-label="选择所属卡包">
            {expansions.map(item => <button type="button" key={item.id} className="pending-expansion-option" aria-pressed={expansionId === item.id} onClick={() => { setExpansionId(item.id); setChoosingExpansion(false); }}>
              <PackArt set={item.name} type={item.defaultType} assetName={item.artName} />
              <span className="pending-expansion-name">{item.name}</span>
              <small>{PACK_TYPES[item.defaultType]}</small>
            </button>)}
          </div>
        </div>
      </> : <p className="pack-muted">请先在“扩展包管理”中添加卡包。</p>}
    </fieldset>
    <section className="pending-summary" aria-label="选中卡包总览"><strong>已选 {selected.length} 包 <small>共 {selected.reduce((sum, event) => sum + event.cards.length, 0)} 张</small></strong><div>{QUALITY_FIELDS.filter(([key]) => counts[key]).map(([key, label]) => <span key={key}><QualitySymbol quality={key} /><span>{label}</span><b>{counts[key]}</b></span>)}</div></section>
    <div className="pending-pack-list">{pending.map((event, index) => <article className="pending-pack" key={event.id}><header><label><input type="checkbox" checked={checked.includes(event.id)} onChange={change => setChecked(previous => change.target.checked ? [...previous, event.id] : previous.filter(id => id !== event.id))} />第 {index + 1} 包</label><time>{event.date.replace('T', ' ')}</time></header><div className="pack-card-line">{event.cards.map((entry, cardIndex) => <div className="pack-card-preview" key={cardIndex}><CardArt card={entry.card} quality={entry.quality} /><span><QualitySymbol quality={entry.qualityKey || 'common'} />{entry.card.name}</span></div>)}</div></article>)}</div>
    {!pending.length ? <p className="pack-muted">所有卡包都已处理。</p> : null}
    <div className="dialog-actions"><button className="simple-button" disabled={busy || !checked.length} onClick={onDiscard}>放弃所选</button><button className="gold-button" disabled={busy || !checked.length || !expansionId} onClick={onConfirm}>确认加入记录</button></div>
  </Modal>;
}

