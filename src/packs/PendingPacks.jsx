import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import CardArt from './PackCardArt.jsx';
import PackArt from './PackArt.jsx';
import { QualitySymbol } from './PackSymbol.jsx';
import { PACK_TYPES, QUALITY_FIELDS } from './demo.js';
import Icon from '../components/Icon.jsx';

export default function PendingPacks({ pending, expansions, checked, setChecked, expansionId, setExpansionId, busy, onConfirm, onDiscard, onClose }) {
  const [choosingExpansion, setChoosingExpansion] = useState(false);
  const [activePack, setActivePack] = useState(0);
  const [switchDirection, setSwitchDirection] = useState(1);
  const selectedExpansion = expansions.find(item => item.id === expansionId);
  const selected = pending.filter(event => checked.includes(event.id));
  const counts = Object.fromEntries(QUALITY_FIELDS.map(([key]) => [key, selected.flatMap(event => event.cards).filter(entry => entry.qualityKey === key).length]));
  const currentPackIndex = Math.min(activePack, Math.max(0, pending.length - 1));
  const currentPack = pending[currentPackIndex];
  const countsSignature = QUALITY_FIELDS.map(([key]) => counts[key]).join(':');
  const previousPackId = useRef(currentPack?.id);
  const previousSummarySignature = useRef(`${currentPack?.id}:${countsSignature}`);
  const [cardsEntered, setCardsEntered] = useState(true);
  const [summaryEntered, setSummaryEntered] = useState(true);
  useEffect(() => { setActivePack(index => Math.min(index, Math.max(0, pending.length - 1))); }, [pending.length]);
  useLayoutEffect(() => {
    if (previousPackId.current === currentPack?.id) return;
    previousPackId.current = currentPack?.id;
    setCardsEntered(false);
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setCardsEntered(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [currentPack?.id]);
  useLayoutEffect(() => {
    const signature = `${currentPack?.id}:${countsSignature}`;
    if (previousSummarySignature.current === signature) return;
    previousSummarySignature.current = signature;
    setSummaryEntered(false);
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setSummaryEntered(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [currentPack?.id, countsSignature]);
  function changePack(nextPack) {
    if (nextPack < 0 || nextPack >= pending.length || nextPack === currentPackIndex) return;
    setSwitchDirection(nextPack > currentPackIndex ? 1 : -1);
    setActivePack(nextPack);
  }
  return <Modal title="待确认卡包" className={`pack-dialog pack-queue-dialog${pending.length ? ' has-pending-packs' : ''}`} onClose={onClose}>
    {!pending.length ? <section className="pending-empty" aria-label="暂无待确认卡包"><span className="pending-empty-emblem"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="13" y="8" width="22" height="32" rx="2.2"/><path d="M13.5 15h21M13.5 33h21"/><path d="m24 18.5 5.2 5.2-5.2 5.2-5.2-5.2 5.2-5.2Z"/></svg></span><h3>暂无待确认卡包</h3><p>新检测到的开包记录会显示在这里，<br className="pending-empty-break" />确认后即可加入开包记录。</p></section> : <fieldset className="pending-expansion-picker">
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
    </fieldset>}
    {pending.length > 0 ? <section className={`pending-summary${summaryEntered ? '' : ' is-switching'}`} aria-label="选中卡包总览"><strong>已选 <span className="pending-count-value">{selected.length}</span> 包 <small>共 <span className="pending-count-value">{selected.reduce((sum, event) => sum + event.cards.length, 0)}</span> 张</small></strong><div className="pending-quality-counts pack-detail-counts">{QUALITY_FIELDS.map(([key, label], index) => <div key={key} className={`pack-quality-detail quality-${key}`} style={{ gridColumn: key === 'signature' ? 5 : index % 4 + 1, gridRow: key === 'signature' ? '1 / span 2' : index < 4 ? 1 : 2 }}><span><QualitySymbol quality={key} />{label}</span><b className="pending-count-value">{counts[key] || '–'}</b></div>)}</div></section> : null}
    {currentPack ? <section className="pending-pack-view" aria-label="待确认卡包详情"><header className="pending-pack-view-heading"><label><input type="checkbox" checked={checked.includes(currentPack.id)} onChange={change => setChecked(previous => change.target.checked ? [...previous, currentPack.id] : previous.filter(id => id !== currentPack.id))} />第 {currentPackIndex + 1} 包</label>{pending.length > 1 ? <nav className="pending-pack-tabs" aria-label="快速选择卡包">{pending.map((event, index) => <button type="button" key={event.id} className={index === currentPackIndex ? 'is-active' : ''} aria-label={`第 ${index + 1} 包`} aria-current={index === currentPackIndex ? 'page' : undefined} onClick={() => changePack(index)}>{index + 1}</button>)}</nav> : null}<time>{currentPack.date.replace('T', ' ')}</time></header><div className={`pack-card-line pack-card-line-switch${cardsEntered ? '' : ' is-switching'}`} key={currentPack.id} style={{ '--pack-switch-offset': `${switchDirection * 20}px` }}>{currentPack.cards.map((entry, cardIndex) => <div className="pack-card-preview" key={`${entry.card.id}-${entry.qualityKey}-${cardIndex}`}><CardArt card={entry.card} quality={entry.quality} /><span><QualitySymbol quality={entry.qualityKey || 'common'} />{entry.card.name}</span></div>)}</div>{pending.length > 1 ? <nav className="record-pack-arrows pending-pack-arrows" aria-label="切换待确认卡包"><button type="button" className="record-pack-arrow" aria-label="上一包" disabled={currentPackIndex === 0} onClick={() => changePack(currentPackIndex - 1)}><Icon name="left" /></button><span className="sr-only" aria-live="polite">第 {currentPackIndex + 1} / {pending.length} 包</span><button type="button" className="record-pack-arrow" aria-label="下一包" disabled={currentPackIndex >= pending.length - 1} onClick={() => changePack(currentPackIndex + 1)}><Icon name="right" /></button></nav> : null}</section> : null}
    {pending.length > 0 ? <div className="dialog-actions"><button className="simple-button" disabled={busy || !checked.length} onClick={onDiscard}>放弃所选</button><button className="gold-button" disabled={busy || !checked.length || !expansionId} onClick={onConfirm}>确认加入记录</button></div> : null}
  </Modal>;
}

