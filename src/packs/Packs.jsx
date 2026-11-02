import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import PackSymbol, { QualitySymbol } from './PackSymbol.jsx';
import ExpansionManager from './ExpansionManager.jsx';
import HistoryTable from './HistoryTable.jsx';
import PackAnalysis from './PackAnalysis.jsx';
import PackOverview from './PackOverview.jsx';
import { PACK_MOTION } from './pack-motion.js';
import RecentPacks from './RecentPacks.jsx';
import PackArt from './PackArt.jsx';
import RecordCardDetails from './RecordCardDetails.jsx';
import SelectedRecord from './SelectedRecord.jsx';
import PendingPacks from './PendingPacks.jsx';
import usePacks from './usePacks.js';
import { comparePackExpansions } from './expansion-order.js';
import { matchesRecordSearch } from './record-search.js';
import { PACK_TYPES, QUALITY_FIELDS, summarize, pityPreview } from './demo.js';
import './packs.css';
import './packs-refinements.css';

const fmt = value => Number(value).toLocaleString('zh-CN');
const RARITY_NAMES = { COMMON: '普通', RARE: '稀有', EPIC: '史诗', LEGENDARY: '传说' };
const Gem = PackSymbol;
function Metrics({ records, set, type }) {
  const stats = summarize(records);
  return <div className="pack-metrics">
    {[['累计开包', stats.count, '包', 'pack'], ['获得传说', stats.legendary, '张', 'legendary'], ['获得史诗', stats.epic, '张', 'epic'], ['平均每包尘值', stats.average, '尘', 'dust']].map(([label, value, unit, icon]) =>
      <div className="pack-metric" key={label}>{icon === 'pack' ? <PackArt set={set} type={type || 'normal'} assetName={records.find(record => record.set === set)?.artName} /> : <Gem rarity={icon} />}<div><span>{label}</span><strong>{fmt(value)}<small>{unit}</small></strong></div></div>)}
  </div>;
}
function PityPanel({ set, type, records, onChooseSet }) {
  const panel = useRef(null), previous = useRef({ set, type });
  const selectedType = type || 'normal';
  const rows = set ? pityPreview(records, set, selectedType) : [];
  useLayoutEffect(() => {
    if (previous.current.set === set && previous.current.type === type) return;
    previous.current = { set, type };
    panel.current?.animate([{ opacity: 0.12, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 320, easing: 'ease-in-out' });
  }, [set, type]);
  return <section ref={panel} className="pack-pity"><div className="pack-section-heading"><h2>保底进度</h2></div>
    {!set ? <div className="pack-pity-empty"><Gem /><h3>先选择一个扩展包</h3><p>不同扩展包与卡包类型分别计算，全部记录没有统一保底。</p><button className="simple-button" onClick={onChooseSet}>选择扩展包</button></div> : <>
      <p className="pack-muted">{set} · {PACK_TYPES[selectedType]}</p>
      {rows.map(({ quality, total, since }) => <div className="pity-item" key={quality}><div><span><QualitySymbol quality={quality} />{QUALITY_FIELDS.find(([key]) => key === quality)?.[1]}</span><b>{since}<small> / {total}</small></b></div>
        <div className={`pity-track ${quality === 'epic' ? 'epic' : ''}`} role="meter" aria-label={`${quality}保底进度`} aria-valuenow={Math.min(since, total)} aria-valuemin={0} aria-valuemax={total}><span style={{ width: `${Math.min(100, since / total * 100)}%` }} /></div>
      </div>)}
    </>}
  </section>;
}
export default function Packs({ view, cards, onNavigate, onNotice }) {
  const api = usePacks();
  const { records, pending } = api;
  const expansions = useMemo(() => [...api.expansions].sort(comparePackExpansions), [api.expansions]);
  const setNames = [...new Set(expansions.map(expansion => expansion.name))];
  const [set, setSet] = useState('');
  const [selectedType, setType] = useState('');
  const availableTypes = Object.entries(PACK_TYPES).filter(([key]) => expansions.some(expansion => (!set || expansion.name === set) && expansion.defaultType === key));
  const type = availableTypes.some(([key]) => key === selectedType) ? selectedType : '';
  const [range, setRange] = useState('all');
  const [source, setSource] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('r1');
  const [dialog, setDialog] = useState(null);
  const monitor = api.monitor.enabled;
  const [checked, setChecked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState('count');
  const filterContentRef = useRef(null);
  function transitionFilteredContent(update, search = false) {
    update();
    requestAnimationFrame(() => filterContentRef.current?.animate(
      [{ opacity: .2 }, { opacity: 1 }],
      { duration: search ? 220 : PACK_MOTION.contentFade, easing: PACK_MOTION.easing },
    ));
  }
  const today = new Date().toLocaleDateString('sv-SE');
  const start = new Date();
  start.setDate(start.getDate() - ({ today: 0, week: 6, month: 29 }[range] || 0));
  const cutoff = range === 'all' ? '' : start.toLocaleDateString('sv-SE');
  const inRange = record => !cutoff || (record.date >= cutoff && record.date.slice(0, 10) <= today);
  const statsFiltered = api.statsRecords.filter(record => (!set || record.set === set) && (!type || record.type === type) && inRange(record));
  const filtered = useMemo(() => records.filter(record => (!set || record.set === set) && (!type || record.type === type)
    && inRange(record)
    && (view !== 'pack-records' || ((!source || record.source === source) && matchesRecordSearch(record, query)))), [records, set, type, source, range, query, view, cutoff, today]);
  const active = filtered.find(record => record.id === selected) || filtered[0];
  const selectedSheet = useRef(null), previousRecord = useRef(active?.id);
  useLayoutEffect(() => {
    if (!active || previousRecord.current === active.id) return;
    previousRecord.current = active.id;
    selectedSheet.current?.animate([{ opacity: 0.12, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 320, easing: 'ease-in-out' });
  }, [active?.id]);
  const isRecords = view === 'pack-records';
  const isAnalysis = view === 'pack-analysis';
  async function save(record) {
    const expansion = expansions.find(item => item.name === record.set && item.defaultType === record.type);
    if (!expansion) throw new Error('请先在扩展包管理中添加该系列与卡包类型。');
    await api.mutate('record/save', { record: { ...record, expansionId: expansion.id } });
    setDialog(null); onNotice('开包记录已保存，统计与保底已更新。');
  }
  async function saveExpansion({ previous, previousType, name, defaultType }) {
    const existing = expansions.find(item => item.name === previous && item.defaultType === previousType);
    await api.mutate('expansion/save', { id: existing?.id, name, defaultType });
    if (set === previous) setSet(name);
    onNotice('扩展包已保存到本机。');
  }
  async function toggleMonitor() {
    if (busy) return; setBusy(true);
    try { await api.mutate('monitor', { enabled: !monitor }); }
    catch (error) { onNotice(error.message); }
    finally { setBusy(false); }
  }
  async function confirmQueue(discard = false) {
    if (busy) return; setBusy(true);
    try {
      await api.mutate(discard ? 'discard' : 'confirm', { ids: checked, expansionId: dialog.expansionId });
      setChecked([]); setDialog(null); onNotice(discard ? '所选卡包已放弃。' : '卡包与单卡明细已一起保存。');
    } catch (error) { onNotice(error.message); } finally { setBusy(false); }
  }
  async function removeRecord() {
    setBusy(true);
    try { await api.mutate('record/delete', { id: dialog.record.id, revision: dialog.record.revision }); setDialog(null); onNotice('记录已删除，统计已同步，删除前备份已保留。'); }
    catch (error) { onNotice(error.message); } finally { setBusy(false); }
  }
  return <section className="packs-workspace" aria-label={isRecords ? '开包记录' : isAnalysis ? '开包分析' : '开包总览'}>
    {isRecords ? <div className="pack-page-toolbar"><div className="pack-page-intro"><p>每一次开包，都有迹可循。</p></div>
      <div className="pack-actions"><button className="simple-button" onClick={() => setDialog({ kind: 'expansions' })}><Icon name="settings" />扩展包管理</button><button className={`simple-button ${monitor ? 'monitor-on' : ''}`} disabled={busy} onClick={toggleMonitor}><span className="monitor-dot" />{monitor ? '监控中' : '日志监控'}</button>
        <button className="gold-button" disabled={api.loading || !expansions.length} title={!expansions.length ? "请先添加扩展包" : undefined} onClick={() => setDialog({ kind: 'edit' })}>＋ 新增记录</button></div>
    </div> : null}
    {api.error ? <div className="pack-api-error" role="alert">{api.error}<button onClick={() => api.refresh().catch(() => {})}>重新加载</button></div> : null}
    <div className={`pack-layout ${isRecords ? '' : 'pack-layout-wide'}`}><div className="paper pack-main-paper">
      <div className="pack-filters"><label><span>扩展包</span><select value={set} onChange={event => transitionFilteredContent(() => { setSet(event.target.value); setType(''); })}><option value="">全部扩展包</option>{setNames.map(name => <option key={name}>{name}</option>)}</select></label>
        <label><span>卡包类型</span><select value={type} onChange={event => transitionFilteredContent(() => setType(event.target.value))}><option value="">全部类型</option>{availableTypes.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
        <label><span>时间范围</span><select value={range} onChange={event => transitionFilteredContent(() => setRange(event.target.value))}><option value="all">全部时间</option><option value="today">今天</option><option value="week">最近 7 天</option><option value="month">最近 30 天</option></select></label>
        {isRecords ? <label className="pack-search"><span>搜索记录</span><div><Icon name="search" /><input value={query} onChange={event => transitionFilteredContent(() => setQuery(event.target.value), true)} placeholder="搜索品质、系列、来源、备注" /></div></label> : <div className="pack-filter-note">统计口径 <strong>当前筛选范围</strong></div>}
      </div>
      <div ref={filterContentRef} className="pack-filter-content">
      {isRecords ? <><Metrics records={statsFiltered} set={set} type={type} />
        <div className="pack-section-heading"><h2>开包明细 <span>{filtered.length} 条记录</span></h2><div className="pack-history-tools"><button className="simple-button" onClick={() => setDialog({ kind: "recent" })}><Icon name="collection" />最近开包记录</button><label className="pack-source-filter"><span className="sr-only">记录来源</span><select value={source} onChange={event => transitionFilteredContent(() => setSource(event.target.value))}><option value="">全部来源</option>{[...new Set(records.map(record => record.source))].map(source => <option key={source}>{source}</option>)}</select></label></div></div>
        <HistoryTable records={filtered} pityRecords={records} catalog={cards} active={active?.id} onSelect={setSelected} onDetails={record => setDialog({ kind: 'details', record })} fillRows animatePages />
        {!filtered.length ? <div className="pack-empty"><Icon name="pack" /><h3>还没有符合条件的记录</h3><p>试试其他筛选，或新增一条开包记录。</p><button className="simple-button" onClick={() => transitionFilteredContent(() => { setSet(''); setType(''); setSource(''); setRange('all'); setQuery(''); })}>重置筛选</button></div> : null}
        {active ? <SelectedRecord ref={selectedSheet} record={active} catalog={cards} onDetails={() => setDialog({ kind: 'details', record: active })} /> : null}
      </> : isAnalysis ? <PackAnalysis cycles={api.cycles.filter(cycle => (!set || cycle.set === set) && (!type || cycle.type === type))} records={records.filter(record => (!set || record.set === set) && (!type || record.type === type))} dateFrom={cutoff} dateTo={cutoff ? today : ""} onDetails={cycle => setDialog({ kind: 'cycle', cycle })} /> : <PackOverview records={statsFiltered} sort={sort} onSort={setSort} onTransition={transitionFilteredContent} />}
      </div>
      <footer className="pack-paper-footer"><span>{api.loading ? "正在读取数据库…" : "本地数据库 · 自动保存"}</span><span>{api.migration.length ? "旧累计统计与原始单次明细分别保留" : "每包 5 张 · 按卡包类型独立累计"}</span></footer>
    </div>{isRecords ? <aside className="pack-sidebar"><section className="pack-monitor-panel"><div className="pack-section-heading"><h2>日志监控</h2><button className={`pack-switch ${monitor ? 'on' : ''}`} role="switch" aria-label="切换日志监控" aria-checked={monitor} disabled={busy} onClick={toggleMonitor}><span /></button></div>
      <div className="pack-monitor-status"><span className={`monitor-dot ${monitor ? 'on' : ''}`} /><strong>{api.monitor.message.replace(/Hearthstone_(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})[\\/]Net\.log/, '$2/$3 $4:$5:$6')}</strong></div><p>日志增量识别，确认后加入记录。<br />待确认卡包会保留到重启之后。</p>
      <button className={`pack-queue-button ${pending.length ? 'has-pending' : ''}`} onClick={() => { setChecked(pending.map(event => event.id)); setDialog({ kind: 'queue', expansionId: expansions.find(item => item.name === set && (!type || item.defaultType === type))?.id || expansions[0]?.id || '' }); }}><PackArt set="" type="normal" className="pack-queue-art" /><span>待确认卡包</span><b>{pending.length}</b><Icon name="right" /></button>
    </section><PityPanel set={set} type={type} records={records} onChooseSet={() => { setSet(setNames[0]); setType("normal"); }} />{!set ? <figure className="pack-sidebar-art" aria-hidden="true"><img src="/assets/ui-skin/pack-tavern-vignette.webp" alt="" loading="lazy" /></figure> : null}<section className="pack-sidebar-note"><h3>{isRecords ? '留住每一次惊喜' : isAnalysis ? '读懂这些数字' : '你的开包档案'}</h3><p>{isRecords ? '自动识别与手动录入汇入同一本记录。点击历史记录，可查看数量、来源和卡牌详情。' : '传说、史诗均合并各品质统计。筛选范围会同时作用于指标、图表和表格。'}</p></section></aside> : null}</div>
    {dialog?.kind === 'recent' ? <RecentPacks records={api.recentRecords.filter(record => (!set || record.set === set) && (!type || record.type === type))} cards={cards} onClose={() => setDialog(null)} /> : null}
    {dialog?.kind === 'cycle' ? <Modal title="合并区间明细" className="pack-dialog pack-cycle-dialog" onClose={() => setDialog(null)}><div className="pack-section-heading"><h3>{dialog.cycle.set} · {PACK_TYPES[dialog.cycle.type]}</h3><span className={`cycle-state ${dialog.cycle.closed ? 'closed' : 'open'}`}>{dialog.cycle.closed ? '已结束' : '合并中'}</span></div><p className="pack-muted">{dialog.cycle.start.replace('T', ' ')} 至 {dialog.cycle.date.replace('T', ' ')} · {dialog.cycle.count} 包 · {dialog.cycle.records.length} 次录入</p><HistoryTable catalog={cards} records={dialog.cycle.records} onSelect={() => {}} fillRows animatePages rowHeight={58} onDetails={record => setDialog({ kind: 'details', record, returnToCycle: dialog.cycle })} /><div className="dialog-actions"><button className="gold-button" onClick={() => setDialog(null)}>完成</button></div></Modal> : null}
    {dialog?.kind === 'expansions' ? <ExpansionManager expansions={expansions} records={records} onSave={saveExpansion} onClose={() => setDialog(null)} /> : null}
    {dialog?.kind === 'edit' ? <RecordForm expansions={expansions} record={dialog.record} defaultSet={set} defaultType={type} onClose={() => setDialog(dialog.returnToCycle ? { kind: 'details', record: dialog.record, returnToCycle: dialog.returnToCycle } : null)} onSave={save} /> : null}
    {dialog?.kind === 'details' ? <Modal title="开包记录详情" className="pack-dialog pack-detail-dialog" onClose={() => setDialog(dialog.returnToCycle ? { kind: 'cycle', cycle: dialog.returnToCycle } : null)}><div className="pack-detail-heading"><div className="pack-detail-identity"><PackArt set={dialog.record.set} type={dialog.record.type} assetName={dialog.record.artName} /><div><h3>{dialog.record.set}</h3><p>{dialog.record.date.replace('T', ' ')} · {PACK_TYPES[dialog.record.type]} · {dialog.record.source}</p></div></div><strong>{dialog.record.count}<small> 包</small></strong></div>
      <div className="pack-detail-counts">{QUALITY_FIELDS.map(([key, label], index) => <div key={key} className={`pack-quality-detail quality-${key}`} style={{ gridColumn: key === 'signature' ? 5 : index % 4 + 1, gridRow: key === 'signature' ? '1 / span 2' : index < 4 ? 1 : 2 }}><span><QualitySymbol quality={key} />{label}</span><b>{dialog.record.qualities[key] || 0}</b></div>)}</div><RecordCardDetails key={dialog.record.id} record={dialog.record} catalog={cards} />{dialog.record.note ? <p>备注：{dialog.record.note}</p> : null}
      <div className="dialog-actions pack-detail-actions"><button className="pack-link danger" onClick={() => setDialog({ kind: 'delete', record: dialog.record, returnToCycle: dialog.returnToCycle })}>删除记录</button><button className="simple-button" onClick={() => setDialog({ kind: 'edit', record: dialog.record, returnToCycle: dialog.returnToCycle })}>编辑记录</button><button className="gold-button" onClick={() => setDialog(dialog.returnToCycle ? { kind: 'cycle', cycle: dialog.returnToCycle } : null)}>完成</button></div></Modal> : null}
    {dialog?.kind === 'delete' ? <Modal title="删除开包记录？" onClose={() => setDialog({ kind: 'details', record: dialog.record, returnToCycle: dialog.returnToCycle })}><p>将删除本机数据库中的 {dialog.record.set} 的 {dialog.record.count} 包记录，相关统计会一并更新。</p><div className="dialog-actions"><button className="simple-button" onClick={() => setDialog({ kind: 'details', record: dialog.record, returnToCycle: dialog.returnToCycle })}>取消</button><button className="gold-button" disabled={busy} onClick={removeRecord}>确认删除</button></div></Modal> : null}
    {dialog?.kind === 'queue' ? <PendingPacks pending={pending} expansions={expansions} checked={checked} setChecked={setChecked} expansionId={dialog.expansionId} setExpansionId={expansionId => setDialog(previous => ({ ...previous, expansionId }))} busy={busy} onConfirm={() => confirmQueue()} onDiscard={() => confirmQueue(true)} onClose={() => setDialog(null)} /> : null}
  </section>;
}

function RecordForm({ expansions, record, defaultSet, defaultType, onClose, onSave }) {
  const setNames = [...new Set(expansions.map(expansion => expansion.name))];
  const [set, setSet] = useState(record?.set || defaultSet || setNames[0]);
  const [type, setType] = useState(record?.type || defaultType || expansions.find(expansion => expansion.name === (defaultSet || setNames[0]))?.defaultType || 'normal');
  const [date, setDate] = useState(record?.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState('');
  const [count, setCount] = useState(record?.count || 1);
  const [qualities, setQualities] = useState(record?.qualities || { [type === 'normal' ? 'rare' : 'goldRare']: 1 });
  const [note, setNote] = useState(record?.note || '');
  const availableTypes = Object.entries(PACK_TYPES).filter(([key]) => expansions.some(expansion => expansion.name === set && expansion.defaultType === key));
  const baseQuality = type === 'normal' ? 'common' : 'goldCommon';
  const editableFields = QUALITY_FIELDS.filter(([key]) => key !== baseQuality && (type === 'normal' || key.startsWith('gold') || key === 'signature'));
  const special = editableFields.reduce((sum, [key]) => sum + Number(qualities[key] || 0), 0);
  const invalid = special > Number(count) * 5;
  async function submit(event) {
    event.preventDefault(); if (invalid || saving) return;
    setSaving(true); setSaveError('');
    try { await onSave({ id: record?.id, revision: record?.revision, set, type, date, count: Number(count), qualities: record && Number(count) === record.count && editableFields.every(([key]) => (qualities[key] || 0) === (record.qualities[key] || 0)) ? record.qualities : { ...Object.fromEntries(editableFields.map(([key]) => [key, qualities[key] || 0])), [baseQuality]: Number(count) * 5 - special }, note }); }
    catch (error) { setSaveError(error.message); } finally { setSaving(false); }
  }

  return <Modal title={record ? '编辑开包记录' : '新增开包记录'} className="pack-dialog" onClose={onClose}><form onSubmit={submit}><p className="pack-muted">录入后保存到本机数据库，统计和保底同步更新。</p><div className="pack-form-grid"><label className="pack-form-label">扩展包<select value={set} onChange={event => { const name = event.target.value; setSet(name); setType(expansions.find(expansion => expansion.name === name)?.defaultType || 'normal'); if (!record) setQualities({}); }}>{setNames.map(name => <option key={name}>{name}</option>)}</select></label><label className="pack-form-label">卡包类型<select value={type} onChange={event => setType(event.target.value)}>{availableTypes.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label className="pack-form-label">开包时间<input required step="1" type="datetime-local" value={date} onChange={event => setDate(event.target.value)} /></label><label className="pack-form-label">卡包数量<input type="number" required min="1" max="9999" value={count} onChange={event => setCount(event.target.value)} /></label></div><h3>出货数量 <small>按卡牌品质分别填写</small></h3><div className="pack-quality-inputs">{editableFields.map(([key, name]) => <label className="pack-form-label" key={key}><span><QualitySymbol quality={key} />{name}</span><input type="number" min="0" max="49995" step="1" value={qualities[key] || 0} onChange={event => setQualities(previous => ({ ...previous, [key]: Number(event.target.value) }))} /></label>)}</div><p className={`pack-form-total ${invalid ? 'invalid' : ''}`} role="status">{invalid ? '品质数量之和不能超过每包 5 张。' : `共 ${Number(count) * 5} 张卡牌 · ${type === 'normal' ? '普通卡' : '金色普通卡'}自动补足 ${Math.max(0, Number(count) * 5 - special)} 张`}</p><label className="pack-form-label">备注（选填）<input maxLength={150} value={note} onChange={event => setNote(event.target.value)} placeholder="例如：预购卡包、活动奖励" /></label>{saveError ? <p className="error-message" role="alert">{saveError}</p> : null}<div className="dialog-actions"><button type="button" className="simple-button" onClick={onClose}>取消</button><button className="gold-button" disabled={invalid || saving}>{saving ? "保存中…" : "保存记录"}</button></div></form></Modal>;
}





