import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import ClassEmblem from '../components/ClassEmblem.jsx';
import { CLASSES, QUALITIES } from '../collection/model.js';
import { HEROES, FORMATS, allocateDeckVariants, decodeDeck, deckEntryVariants, orderDeckVariantsForDisplay, isDeckCompanion, parseDeckFile, deckClass } from './model.js';
import { request, saveDeckExport } from '../collection/api.js';
import { exportDeckPng } from './deckPngExport.js';

function ImportDeck({ cards, cardReferences, controller, onReferences }) {
  const [code, setCode] = useState(''), [pending, setPending] = useState([]), [error, setError] = useState('');
  const [selectedDeckIndex, setSelectedDeckIndex] = useState(0);
  const [lookupCards, setLookupCards] = useState(cardReferences);
  const [exportFiles, setExportFiles] = useState([]), [showExportFiles, setShowExportFiles] = useState(false);
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
  async function readText(text) {
    setPending([]); setError(''); setReading(true);
    try {
      const decks = parseDeckFile(text, knownCards);
      setPending(decks); setSelectedDeckIndex(0); await resolveReferences(decks);
    } catch(e) { setError(e.message); } finally { setReading(false); }
  }
  async function readFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('套牌文件不能超过 5 MB。'); event.target.value = ''; return; }
    await readText(await file.text());
    event.target.value = '';
  }
  async function chooseDeckFile() {
    setError(''); setReading(true);
    try {
      if (window.pywebview?.api?.choose_deck_json) {
        const selected = await window.pywebview.api.choose_deck_json();
        if (selected) await readText(selected.text);
        return;
      }
      const result = await request('deck-exports');
      setExportFiles(result.files || []); setShowExportFiles(true);
    } catch (e) { setError(e.message || '无法读取套牌导出文件夹。'); }
    finally { setReading(false); }
  }
  async function chooseExportedFile(name) {
    setReading(true); setError('');
    try {
      const result = await request(`deck-exports?name=${encodeURIComponent(name)}`);
      await readText(result.text);
      setShowExportFiles(false);
    } catch (e) { setError(e.message || '无法读取套牌 JSON 文件。'); }
    finally { setReading(false); }
  }
  return <>
    <p>粘贴游戏内卡组代码，或选择已有套牌 JSON 文件。导入会新增记录，保留原有套牌。</p>
    <label className="deck-import-label" htmlFor="import-deck-code">卡组代码</label>
    <textarea id="import-deck-code" value={code} disabled={controller.busy || reading} placeholder="粘贴 AAE… 代码或完整分享文本" onChange={e => { setCode(e.target.value); setPending([]); setError(''); }} />
    <div className="deck-import-actions"><button className="simple-button" disabled={!code.trim() || controller.busy || reading} onClick={async () => {
      setReading(true);
      try { const deck = decodeDeck(code); setPending([deck]); setSelectedDeckIndex(0); setError(''); await resolveReferences([deck]); } catch(e) { setPending([]); setError(e.message); } finally { setReading(false); }
    }}>解析卡组代码</button><button type="button" className="simple-button" disabled={controller.busy || reading} onClick={chooseDeckFile}>选择 JSON 文件</button><label className="simple-button deck-file-button">从其他位置选择<input type="file" accept=".json,application/json" disabled={controller.busy || reading} onChange={readFile} /></label></div>
    {showExportFiles && <div className="deck-export-picker"><header><strong>套牌导出文件夹</strong><button type="button" onClick={() => setShowExportFiles(false)}>关闭</button></header>{exportFiles.length ? <ul>{exportFiles.map(name => <li key={name}><button type="button" disabled={reading} onClick={() => chooseExportedFile(name)}>{name}</button></li>)}</ul> : <p>文件夹中还没有 JSON 文件。你也可以从其他位置选择。</p>}</div>}
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

export default function DeckDialogs({ controller, cards, cardReferences = [], onReferences = () => {}, onNotice, artMode = 'cover' }) {
  const [exportingPng, setExportingPng] = useState(false), [savingJson, setSavingJson] = useState(false);
  const [exportReferences, setExportReferences] = useState([]);
  const exportLookupKey = useRef('');
  const { dialog, setDialog, busy } = controller;
  useEffect(() => {
    if (dialog?.type !== 'export') return undefined;
    const known = new Set([...cards, ...cardReferences, ...exportReferences].map(card => card.dbfId));
    const ids = [...new Set([...(dialog.deck.entries || []).map(entry => entry.id), dialog.deck.hero])]
      .filter(id => Number.isSafeInteger(id) && !known.has(id));
    if (!ids.length) return undefined;
    const key = ids.join(',');
    if (exportLookupKey.current === key) return undefined;
    exportLookupKey.current = key;
    let active = true;
    request(`cards/lookup?ids=${ids.slice(0, 100).join(',')}`).then(result => {
      if (active && result.cards.length) setExportReferences(current => [...new Map([...current, ...result.cards].map(card => [card.dbfId, card])).values()]);
    }).catch(() => {});
    return () => { active = false; };
  }, [dialog?.type, dialog?.deck?.hero, dialog?.deck?.entries, cards, cardReferences, exportReferences]);
  const exportCards = useMemo(() => {
    const byId = new Map(cards.map(card => [card.dbfId, card]));
    for (const card of [...cardReferences, ...exportReferences]) if (!byId.has(card.dbfId)) byId.set(card.dbfId, card);
    return [...byId.values()];
  }, [cards, cardReferences, exportReferences]);
  if (!dialog) return null;
  const close = () => { if (!busy) setDialog(null); };
  const titles = { new: '新建套牌 · 选择职业', import: '导入套牌', delete: '删除套牌', switch: '切换构筑', export: '导出套牌' };
  const exportDeck = dialog.type === 'export' ? allocateDeckVariants(dialog.deck, exportCards) : null;
  return <Modal title={titles[dialog.type]} onClose={close}><div className="deck-dialog">
    {dialog.type === 'new' && <><p>选择职业后进入我的收藏，直接点卡加入套牌。</p><div className="new-deck-classes">{CLASSES.filter(([key]) => HEROES[key]).map(([key, label]) => <button className="simple-button new-deck-class" key={key} onClick={() => controller.start({ name: `${label}新套牌`, hero: HEROES[key], format: 1, entries: [] })}><ClassEmblem cardClass={key} /><span>{label}</span></button>)}</div></>}
    {dialog.type === 'import' && <ImportDeck cards={cards} cardReferences={cardReferences} onReferences={onReferences} controller={controller} />}
    {dialog.type === 'switch' && <><p>当前套牌有未保存修改，切换将放弃这些修改。已保存记录仍会保留。</p><div className="deck-switch-actions"><button className="gold-button" onClick={() => controller.activate(dialog.next)}>放弃修改并切换</button><button className="simple-button" onClick={close}>继续当前构筑</button></div></>}
    {dialog.type === 'delete' && <><p>确定删除「{dialog.deck.name}」？此操作无法撤销。</p><button className="gold-button" disabled={busy} onClick={() => controller.deleteDeck(dialog.deck)}>{busy ? '删除中…' : '确认删除'}</button><button className="simple-button" disabled={busy} onClick={close}>取消</button></>}
    {dialog.type === 'export' && <><p>导出为两列卡组图片或套牌 JSON 文件。</p><div className="deck-import-actions"><button className="gold-button" disabled={exportingPng || savingJson} onClick={async () => {
      setExportingPng(true);
      try { await exportDeckPng(dialog.deck, exportCards, artMode); onNotice('卡组 PNG 已保存到“套牌导出”文件夹。'); }
      catch (error) { onNotice(error.message || 'PNG 图片导出失败。'); }
      finally { setExportingPng(false); }
    }}>{exportingPng ? '正在生成 PNG…' : '导出 PNG 图片'}</button><button className="simple-button" disabled={exportingPng || savingJson} onClick={async () => {
      setSavingJson(true);
      try {
        const name = `${exportDeck.name.replace(/[<>:"/\\|?*]/g, '_')}.json`;
        const blob = new Blob([JSON.stringify({ decks: [exportDeck] }, null, 2)], { type: 'application/json' });
        await saveDeckExport(name, blob); onNotice('套牌 JSON 已保存到“套牌导出”文件夹。');
      } catch (error) { onNotice(error.message || 'JSON 文件导出失败。'); }
      finally { setSavingJson(false); }
    }}>{savingJson ? '正在保存 JSON…' : '导出 JSON 文件'}</button></div></>}
  </div></Modal>;
}

