import { useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import ClassEmblem from '../components/ClassEmblem.jsx';
import { CLASSES, QUALITIES } from '../collection/model.js';
import { HEROES, FORMATS, allocateDeckVariants, decodeDeck, deckEntryVariants, orderDeckVariantsForDisplay, encodeDeck, isDeckCompanion, parseDeckFile, deckClass } from './model.js';
import { request } from '../collection/api.js';

function ImportDeck({ cards, cardReferences, controller, onReferences }) {
  const [code, setCode] = useState(''), [pending, setPending] = useState([]), [error, setError] = useState('');
  const [selectedDeckIndex, setSelectedDeckIndex] = useState(0);
  const [lookupCards, setLookupCards] = useState(cardReferences);
  const [reading, setReading] = useState(false);
  const knownCards = useMemo(() => [...cards, ...lookupCards], [cards, lookupCards]);
  async function resolveReferences(decks) {
    const ids = [...new Set(decks.flatMap(deck => [...deck.entries.map(entry => entry.id), deck.hero, ...(deck.sideboards || []).map(item => item.id)])
      .filter(id => Number.isSafeInteger(id) && !knownCards.some(card => card.dbfId === id)))];
    if (!ids.length) return;
    try {
      const result = await request(`cards/lookup?ids=${ids.slice(0, 100).join(',')}`);
      const next = [...lookupCards.filter(card => !result.cards.some(found => found.dbfId === card.dbfId)), ...result.cards];
      setLookupCards(next); onReferences(next);
    } catch { /* Keep import available; unresolved cards use the ID fallback. */ }
  }
  async function readFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    setPending([]); setError(''); setReading(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('套牌文件不能超过 5 MB。');
      const decks = parseDeckFile(await file.text(), knownCards);
      setPending(decks); setSelectedDeckIndex(0); await resolveReferences(decks);
    } catch(e) { setError(e.message); } finally { setReading(false); event.target.value = ''; }
  }
  return <>
    <p>粘贴游戏内卡组代码，或选择已有套牌 JSON 文件。导入会新增记录，保留原有套牌。</p>
    <label className="deck-import-label" htmlFor="import-deck-code">卡组代码</label>
    <textarea id="import-deck-code" value={code} disabled={controller.busy || reading} placeholder="粘贴 AAE… 代码或完整分享文本" onChange={e => { setCode(e.target.value); setPending([]); setError(''); }} />
    <div className="deck-import-actions"><button className="simple-button" disabled={!code.trim() || controller.busy || reading} onClick={async () => {
      setReading(true);
      try { const deck = decodeDeck(code); setPending([deck]); setSelectedDeckIndex(0); setError(''); await resolveReferences([deck]); } catch(e) { setPending([]); setError(e.message); } finally { setReading(false); }
    }}>解析卡组代码</button><label className="simple-button deck-file-button">选择 JSON 文件<input type="file" accept=".json,application/json" disabled={controller.busy || reading} onChange={readFile} /></label></div>
    {reading && <p role="status">正在读取文件…</p>}
    {(error || controller.error) && <p className="deck-error" role="alert">{error || controller.error}</p>}
    {!!pending.length && <div className="deck-import-preview"><div className="deck-import-preview-list"><h3>待导入 {pending.length} 套</h3>{pending.map((deck, i) => {
      const resolved = allocateDeckVariants(deck, knownCards);
      const missing = resolved.entries.reduce((sum, entry) => sum + (isDeckCompanion(entry.id) ? 0 : knownCards.find(card => card.dbfId === entry.id)
        ? deckEntryVariants(entry, knownCards.find(card => card.dbfId === entry.id)).reduce((n, row) => n + row.missing, 0)
        : entry.count), 0);
      return <section className="deck-analysis" key={i}>
        <p><b>{deck.name}</b> · {CLASSES.find(([key]) => key === deckClass(deck, knownCards))?.[1] || '自定义英雄'} · {FORMATS[deck.format]} · {deck.entries.reduce((n, e) => n + e.count, 0)} 张 · 缺少 {missing} 张</p>
        <details><summary>查看卡牌持有品质</summary><ul>{resolved.entries.map(entry => {
          const card = knownCards.find(item => item.dbfId === entry.id);
          if (isDeckCompanion(entry.id)) return <li className="deck-companion-preview" key={entry.id}><span>{card?.name || `卡牌 #${entry.id}`} <small>随卡携带</small></span><span>×{entry.count}</span></li>;
          const variants = card ? orderDeckVariantsForDisplay(deckEntryVariants(entry, card)) : [];
          const qualityText = variants.length ? variants.map(row => {
            const label = QUALITIES.find(([key]) => key === row.quality)?.[1] || row.quality;
            return `${label} ×${row.count}${row.missing ? `（缺 ${row.missing}）` : ''}`;
          }).join('，') : `卡牌资料待更新 · ×${entry.count}`;
          return <li key={entry.id}><span>{card?.name || `未知卡牌 #${entry.id}`}</span><span>{qualityText}</span></li>;
        })}</ul></details>
      </section>;
    })}</div>
      {pending.length > 1 && <label className="deck-edit-target">直接编辑<select value={selectedDeckIndex} onChange={event => setSelectedDeckIndex(Number(event.target.value))}>{pending.map((deck, index) => <option key={index} value={index}>{deck.name}</option>)}</select></label>}
      <div className="deck-import-confirm-actions"><button className="gold-button" disabled={controller.busy || reading} onClick={() => controller.importDecks(pending)}>{controller.busy ? '导入中…' : '确认导入'}</button><button className="simple-button" disabled={controller.busy || reading} onClick={() => controller.start(pending[selectedDeckIndex])}>编辑构筑</button></div>
    </div>}
  </>;
}

export default function DeckDialogs({ controller, cards, cardReferences = [], onReferences = () => {}, onNotice }) {
  const { dialog, setDialog, busy } = controller;
  if (!dialog) return null;
  const close = () => { if (!busy) setDialog(null); };
  const titles = { new: '新建套牌 · 选择职业', import: '导入套牌', delete: '删除套牌', switch: '切换构筑', export: '导出套牌' };
  const exportDeck = dialog.type === 'export' ? allocateDeckVariants(dialog.deck, cards) : null;
  const exported = exportDeck ? `### ${exportDeck.name}\n${encodeDeck(exportDeck)}` : '';
  return <Modal title={titles[dialog.type]} onClose={close}><div className="deck-dialog">
    {dialog.type === 'new' && <><p>选择职业后进入我的收藏，直接点卡加入套牌。</p><div className="new-deck-classes">{CLASSES.filter(([key]) => HEROES[key]).map(([key, label]) => <button className="simple-button new-deck-class" key={key} onClick={() => controller.start({ name: `${label}新套牌`, hero: HEROES[key], format: 1, entries: [] })}><ClassEmblem cardClass={key} /><span>{label}</span></button>)}</div></>}
    {dialog.type === 'import' && <ImportDeck cards={cards} cardReferences={cardReferences} onReferences={onReferences} controller={controller} />}
    {dialog.type === 'switch' && <><p>当前套牌有未保存修改，切换将放弃这些修改。已保存记录仍会保留。</p><div className="deck-switch-actions"><button className="gold-button" onClick={() => controller.activate(dialog.next)}>放弃修改并切换</button><button className="simple-button" onClick={close}>继续当前构筑</button></div></>}
    {dialog.type === 'delete' && <><p>确定删除「{dialog.deck.name}」？此操作无法撤销。</p><button className="gold-button" disabled={busy} onClick={() => controller.deleteDeck(dialog.deck)}>{busy ? '删除中…' : '确认删除'}</button><button className="simple-button" disabled={busy} onClick={close}>取消</button></>}
    {dialog.type === 'export' && <><label className="deck-import-label" htmlFor="export-deck-code">卡组代码</label><textarea id="export-deck-code" readOnly value={exported} onFocus={e => e.target.select()} /><div className="deck-import-actions"><button className="gold-button" onClick={async () => { try { await navigator.clipboard.writeText(exported); onNotice('卡组代码已复制。'); } catch { onNotice('请选中代码手动复制。'); } }}>复制代码</button><button className="simple-button" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ decks: [exportDeck] }, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `${exportDeck.name.replace(/[<>:"/\\|?*]/g, '_')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>导出 JSON 文件</button></div></>}
  </div></Modal>;
}

