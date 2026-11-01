import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './components/Icon.jsx';
import useViewTransition from './useViewTransition.js';
import CollectionGrid from './collection/CollectionGrid.jsx';
import Filters, { ClassSelector } from './collection/Filters.jsx';
import CardDetails from './collection/CardDetails.jsx';
import SyncDialog from './collection/SyncDialog.jsx';
import ProgressDialog from './collection/ProgressDialog.jsx';
import MoreFilters from './collection/MoreFilters.jsx';
import { request } from './collection/api.js';
import { attachCollection, expandQualityCards, scopeCards, filterAndSort, progress, CLASSES, DEFAULT_FILTERS, PREFERENCE_KEY, loadFilters, SET_NAMES, validateImport } from './collection/model.js';
const brand = '/assets/ui-skin/hearthstone-crest.png';
import Decks from './decks/Decks.jsx';
import DeckEditor from './decks/DeckEditor.jsx';
import DeckDialogs from './decks/DeckDialogs.jsx';
import { readDeckArtMode, saveDeckArtMode } from './decks/artPreferences.js';
import useDecks from './decks/useDecks.js';
import { DECK_REFERENCE_IDS, eligibleForDeck, deckCollectionCards } from './decks/model.js';
import Packs from './packs/Packs.jsx';
import { compareSetsByRelease } from './collection/set-order.js';
import { readSyncPreferences, saveSyncPreferences } from './collection/syncPreferences.js';
import Compare from './decks/Compare.jsx';

const EMPTY_SNAPSHOT = { collection: {}, meta: {}, hasBackup: false };
const PACK_PAGES = [['pack', '开包记录', 'pack-records'], ['chart', '开包分析', 'pack-analysis'], ['collection', '开包总览', 'pack-overview']];

export default function App() {
  const [view, setView, mainRef] = useViewTransition(() => ['collection', 'decks', 'compare', ...PACK_PAGES.map(([, , key]) => key)].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'collection');
  const [catalog, setCatalog] = useState([]);
  const [cardReferences, setCardReferences] = useState([]);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [filters, setFilters] = useState(loadFilters);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [modal, setModal] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState('');
  const [notice, setNotice] = useState('');
  const [syncPreferences, setSyncPreferences] = useState(readSyncPreferences);
  const [deckArtMode, setDeckArtMode] = useState(readDeckArtMode);
  const [syncBusy, setSyncBusy] = useState(false);
  const [buildingActive, setBuildingActive] = useState(false);
  const filtersBeforeBuild = useRef(null);
  const mainSyncFile = useRef(null);
  const syncInFlight = useRef(false);
  const startupSyncStarted = useRef(false);
  const query = useDeferredValue(filters.query);
  useEffect(() => {
    const id = filters.query.trim();
    if (!/^\\d+$/.test(id) || !catalog.length) return;
    const card = catalog.find(entry => String(entry.id) === id) || catalog.find(entry => String(entry.dbfId) === id);
    if (!card) return;
    const classes = card.classes?.length ? card.classes : [card.cardClass];
    if (classes.length !== 1 || !classes[0] || classes[0] === 'NEUTRAL') return;
    setFilters(previous => previous.class === classes[0] ? previous : { ...previous, class: classes[0] });
    setPage(0);
  }, [filters.query, catalog]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([request('catalog', undefined, controller.signal), request('collection', undefined, controller.signal),
      request(`cards/lookup?ids=${DECK_REFERENCE_IDS.join(',')}`, undefined, controller.signal)])
      .then(([cards, data, references]) => {
        setCatalog(cards.cards); setSnapshot(data); setLoading(false);
        setCardReferences(references.cards);
      })
      .catch(error => { if (error.name !== 'AbortError') setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    // StrictMode replays mount effects in development. Guard the remote sync so
    // one app launch still produces at most one HSReplay request.
    if (startupSyncStarted.current) return;
    startupSyncStarted.current = true;
    if (!readSyncPreferences().autoSyncOnLaunch) return;
    (async () => {
      let acquired = false;
      try {
        const auth = await request('hsreplay/status');
        if (auth.phase !== 'connected' || syncInFlight.current) return;
        syncInFlight.current = true;
        acquired = true;
        setSyncBusy(true);
        const latest = await request('collection/sync', {});
        setSnapshot(latest);
        setNotice('已在启动时同步 HSReplay 收藏。');
      } catch (error) {
        setNotice(error.message);
      } finally {
        if (acquired) { syncInFlight.current = false; setSyncBusy(false); }
      }
    })();
  }, []);
  useEffect(() => { try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify(filters)); } catch { /* storage may be unavailable */ } }, [filters]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5500); return () => clearTimeout(timer); }, [notice]);
  const cards = useMemo(() => attachCollection(catalog, snapshot.collection), [catalog, snapshot.collection]);
  const beginBuilding = useCallback((heroClass, deckOnly) => {
    if (!filtersBeforeBuild.current) filtersBeforeBuild.current = filters;
    setBuildingActive(true); setView('collection');
    setFilters({ ...DEFAULT_FILTERS, class: deckOnly ? '' : heroClass }); setPage(0);
  }, [filters]);
  const deckController = useDecks({ cards, cardReferences, onBegin: beginBuilding, onNotice: setNotice });
  const building = buildingActive && !!deckController.draft;
  const finishBuilding = () => {
    setBuildingActive(false); setView('decks'); setPage(0);
    if (filtersBeforeBuild.current) setFilters(filtersBeforeBuild.current);
    filtersBeforeBuild.current = null;
  };
  const deckOnly = building && deckController.deckOnly;
  const collectionCards = useMemo(() => !building ? cards : deckOnly
    ? deckCollectionCards(deckController.draft, cards, deckController.deckOnlyRetainedIds) : cards.filter(card => eligibleForDeck(card, deckController.heroClass)),
    [cards, building, deckOnly, deckController.draft, deckController.deckOnlyRetainedIds, deckController.heroClass]);
  const scoped = useMemo(() => scopeCards(collectionCards, { ...filters, query }), [collectionCards, filters, query]);
  const result = useMemo(() => deckOnly ? scoped.filter(card => (!filters.quality || card.displayQuality === filters.quality)
    && (filters.ownership === 'owned' ? !card.deckMissing : ['missing', 'incomplete'].includes(filters.ownership) ? card.deckMissing > 0 : true))
    : expandQualityCards(filterAndSort(scoped, filters), filters.quality), [scoped, filters, deckOnly]);
  const stats = useMemo(() => progress([...new Map(scoped.map(card => [card.dbfId, card])).values()], filters.quality), [scoped, filters.quality]);
  const sets = useMemo(() => [...new Set(catalog.map(card => card.set))].sort(compareSetsByRelease), [catalog]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(result.length / 10) - 1));
  const visible = result.slice(currentPage * 10, currentPage * 10 + 10);
  const nextPageCards = useMemo(() => result.slice((currentPage + 1) * 10, (currentPage + 2) * 10), [result, currentPage]);
  const updateFilters = useCallback(change => { setFilters(previous => ({ ...previous, ...change })); setPage(0); }, []);
  const selectCard = useCallback(card => { setSelectedCard(card.dbfId); setSelectedQuality(card.displayQuality || ''); setModal('card'); }, []);
  const selectDeckCard = selectCard;
  const closeModal = useCallback(() => setModal(null), []);
  const updated = useCallback((value, message) => { setSnapshot(value); setNotice(message); }, []);
  const updateSyncPreferences = useCallback(value => setSyncPreferences(saveSyncPreferences(value)), []);
  const updateDeckArtMode = useCallback(value => setDeckArtMode(saveDeckArtMode(value)), []);
  async function syncDefault() {
    if (syncBusy || syncInFlight.current) return;
    if (syncPreferences.defaultMethod === 'file') {
      mainSyncFile.current?.click();
      return;
    }
    syncInFlight.current = true;
    setSyncBusy(true);
    try {
      const auth = await request('hsreplay/status');
      if (auth.phase !== 'connected') {
        setModal('settings');
        setNotice('请先在设置的“收藏同步”中连接 HSReplay 国服账号。');
        return;
      }
      const result = await request('collection/sync', {});
      updated(result, 'HSReplay 收藏已同步。');
    } catch (error) {
      setNotice(error.message);
      if (/登录|会话|账号地区/.test(error.message)) setModal('settings');
    } finally { syncInFlight.current = false; setSyncBusy(false); }
  }
  async function importMainSyncFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || syncBusy || syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncBusy(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('文件超过 20 MB，请选择 HDT 导出的收藏 JSON。');
      const raw = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      validateImport(raw);
      const result = await request('collection/import', { data: raw, source: file.name });
      updated(result, '收藏文件已导入，进度已更新。');
    } catch (error) {
      setNotice(error instanceof SyntaxError ? '无法解析 JSON，请检查文件是否是有效的收藏导出文件。' : error.message);
    } finally { syncInFlight.current = false; setSyncBusy(false); }
  }
  useEffect(() => {
    function keydown(event) {
      if (view !== 'collection' || modal || event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName)) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); setPage(value => Math.min(Math.max(0, Math.ceil(result.length / 10) - 1), value + 1)); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); setPage(value => Math.max(0, value - 1)); }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [modal, result.length, view]);
  const card = selectedCard ? cards.find(card => card.dbfId === selectedCard) : null;
  const className = CLASSES.find(([key]) => key === filters.class)?.[1];
  const packPage = PACK_PAGES.find(([, , key]) => key === view);
  return <div className="shell">
    <nav className="rail" aria-label="主导航"><div className="crest"><img src={brand} className="hs-brand-sigil" alt="炉石传说" /></div>
      <button className={`nav ${view === "collection" ? "active" : ""}`} aria-current={view === "collection" ? "page" : undefined} onClick={() => setView("collection")}><b><Icon name="collection" /></b><span>我的收藏</span></button>
      <button className={`nav ${view === "decks" ? "active" : ""}`} aria-current={view === "decks" ? "page" : undefined} onClick={() => setView("decks")}><b><Icon name="deck" /></b><span>我的套牌</span></button>
      {PACK_PAGES.map(([icon, name, key], index) => <div className="nav-entry" key={key}>{index === 0 ? <div className="rail-section-label">开包工具</div> : null}
        <button className={`nav pack-nav ${view === key ? 'active' : ''}`} aria-label={name} title={name} aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)}><b><Icon name={icon} /></b><span>{name}</span></button>
      </div>)}
      <button className={`nav ${view === 'compare' ? 'active' : ''}`} onClick={() => setView('compare')}><b><Icon name="compare" /></b><span>对比工具</span></button>
      <div className="rail-spacer" /><button className="nav" onClick={() => setModal('settings')}><b><Icon name="settings" /></b><span>设置</span></button>
    </nav>
    <main className="main" ref={mainRef}><header className="top"><div className="top-title"><small>{packPage ? { 'pack-records': 'PACK HISTORY', 'pack-analysis': 'PACK ANALYSIS', 'pack-overview': 'PACK OVERVIEW' }[view] : view === 'compare' ? 'DECK COMPARISON' : 'HEARTHSTONE COLLECTION'}</small><h1>{packPage ? packPage[1] : view === 'compare' ? '对比工具' : view === 'decks' ? '我的套牌' : className ? `${className}收藏` : '我的收藏'}</h1></div>
      {packPage ? <div className="pack-top-context"><span>开包工具</span><b>记录 · 分析 · 总览</b></div> : view === 'compare' ? <div className="pack-top-context"><span>套牌分析</span><b>差异卡 · 收藏持有</b></div> : <><button className="top-progress" onClick={() => setModal('progress')} title={`已集齐 ${stats.copies.toLocaleString()} / ${stats.needed.toLocaleString()} 张构筑数量，点击查看完整收藏进度`} aria-label="查看收藏进度" disabled={loading || !!error}>
        <span>已拥有 <b>{stats.ownedTypes.toLocaleString()}</b> / {stats.types.toLocaleString()} 种 <em>构筑 {stats.percent}%</em></span>
        <span className="progress-track"><span style={{ width: `${stats.percent}%` }} /></span>
      </button>
      <div className="sync-control"><div className="sync-time-copy"><span>最近同步</span><time className="last-sync-time" dateTime={snapshot.meta.importedAt || undefined} title={snapshot.meta.importedAt ? `最近同步：${new Date(snapshot.meta.importedAt).toLocaleString('zh-CN')}` : '尚未同步'}>
          <span className="sync-time-full">{snapshot.meta.importedAt ? new Date(snapshot.meta.importedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '尚未同步'}</span>
          <span className="sync-time-short">{snapshot.meta.importedAt ? new Date(snapshot.meta.importedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '未同步'}</span>
        </time></div>
        <button className="gold-button sync-button" aria-label={syncBusy ? '正在同步收藏' : syncPreferences.defaultMethod === 'file' ? '导入收藏 JSON 文件' : '立即同步收藏'} disabled={syncBusy} title={syncBusy ? '正在同步收藏' : syncPreferences.defaultMethod === 'file' ? '选择收藏 JSON 文件导入' : '立即从 HSReplay 同步收藏'} onClick={syncDefault}><Icon className={syncBusy ? 'sync-icon is-syncing' : 'sync-icon'} name="sync" /></button>
        <input ref={mainSyncFile} type="file" accept=".json,application/json" aria-label="选择收藏 JSON 文件以同步收藏" hidden onChange={importMainSyncFile} />
      </div></>}
    </header>
    <div className="pack-page-host" hidden={!packPage}><Packs view={packPage ? view : 'pack-records'} cards={cards} onNavigate={setView} onNotice={setNotice} /></div>
    {view === 'decks' && <Decks cards={cards} cardReferences={deckController.cardReferences} loading={loading} controller={deckController} onNotice={setNotice} />}
    {view === 'compare' && <Compare decks={deckController.decks} cards={cards} cardReferences={deckController.cardReferences} loading={loading || !deckController.ready} artMode={deckArtMode} />}
    {view === "collection" && <div id="content-grid" className={`content-grid ${building ? 'deck-mode collection-building' : 'no-deck'}`}><section id="collection-view" className="view active" aria-label="我的收藏">
      <div className="paper"><ClassSelector value={filters.class} onChange={updateFilters} allowedClasses={building ? [deckController.heroClass, 'NEUTRAL'] : undefined} />
        {building && <div className="deck-collection-toolbar"><span>{deckOnly ? '套牌用牌 · 未拥有优先 · 默认排序' : '全部收藏 · 点击卡牌加入套牌'}</span>
          <button className="simple-button" onClick={() => { deckController.setDeckOnly(!deckOnly); updateFilters({ ...DEFAULT_FILTERS }); }}>{deckOnly ? '浏览全部收藏' : '只看套牌用牌'}</button></div>}
        {error ? <div className="empty-state" role="alert"><h2>收藏暂时无法载入</h2><p>{error}</p><button className="gold-button" onClick={() => setReload(value => value + 1)}>重新加载</button></div> :
          <CollectionGrid cards={visible} nextPageCards={nextPageCards} quality={filters.quality} page={currentPage} total={result.length} filterKey={JSON.stringify({ ...filters, query, deckOnly,
            cards: visible.map(card => [card.dbfId, card.displayQuality || '', ...(card.counts || []), card.deckCount || 0, card.deckMissing || 0]),
            draft: building ? deckController.draft.entries.map(({ id, count, variants }) => [id, count, variants]) : null })} onPage={setPage} onSelect={building && !deckOnly ? deckController.addCard : selectCard}
            deckEntries={building ? deckController.draft.entries : undefined} onDetails={building ? selectCard : undefined} addMode={building && !deckOnly} dragMode={building} onNotice={setNotice}
            onReset={() => updateFilters({ ...DEFAULT_FILTERS })} loading={loading} />}
      </div>
      <Filters filters={filters} sets={sets} total={result.length} onChange={updateFilters} onMore={() => setModal('filters')} />
    </section>{building && <DeckEditor controller={deckController} cards={cards} cardReferences={deckController.cardReferences} onCard={selectDeckCard} onFinish={finishBuilding} artMode={deckArtMode} />}</div>}
    </main>
    {notice ? <div className="toast" role="status">{notice}<button aria-label="关闭通知" onClick={() => setNotice('')}><Icon name="close" /></button></div> : null}
    <span className="sr-only" role="status">{loading ? '正在载入收藏' : `已找到 ${result.length} 个卡牌版本，第 ${currentPage + 1} 页`}</span>
    <DeckDialogs controller={deckController} cards={cards} cardReferences={deckController.cardReferences} onReferences={setCardReferences} onNotice={setNotice} artMode={deckArtMode} />
    {modal === 'card' && card ? <CardDetails card={card} preferredQuality={selectedQuality || filters.quality} onClose={closeModal} /> : null}
    {modal === 'settings' ? <SyncDialog snapshot={snapshot} onUpdated={updated} onClose={closeModal} syncPreferences={syncPreferences} onSyncPreferencesChange={updateSyncPreferences} deckArtMode={deckArtMode} onDeckArtModeChange={updateDeckArtMode} onNotice={setNotice} /> : null}
    {modal === 'progress' ? <ProgressDialog cards={cards} meta={snapshot.meta} onClose={closeModal} onChooseSet={set => { updateFilters({ ...DEFAULT_FILTERS, set }); closeModal(); }} /> : null}
    {modal === 'filters' ? <MoreFilters filters={filters} onChange={updateFilters} onClose={closeModal} /> : null}
  </div>;
}

