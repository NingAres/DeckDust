import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { QualitySymbol } from './PackSymbol.jsx';
import { PACK_TYPES, QUALITY_FIELDS, QUALITY_SHORT_NAMES, summarize } from './demo.js';
import PackArt from './PackArt.jsx';
import QualityCardPreview from './QualityCardPreview.jsx';
import { recordedCards } from './recorded-cards.js';
import PackPityPreview from './PackPityPreview.jsx';

function qualityClass(key) { return `quality-${key} ${key.startsWith('gold') ? 'gold-quality' : ''}`; }

export default function HistoryTable({ records, catalog = [], pityRecords = records, active, onSelect, onDetails, fillRows = false }) {
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0), [size, setSize] = useState('auto'), [autoSize, setAutoSize] = useState(5);
  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [records]);
  const recordKey = sorted.map(record => record.id).join('|');
  useEffect(() => { setPage(0); }, [recordKey]);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const measureCapacity = () => {
      const table = element.querySelector('table');
      const parent = element.parentElement;
      const bodyRow = table?.tBodies[0]?.rows[0];
      const headerHeight = table?.tHead?.getBoundingClientRect().height || 40;
      const footerHeight = table?.tFoot?.getBoundingClientRect().height || 38;
      const rowHeight = bodyRow?.getBoundingClientRect().height || 58;
      const children = Array.from(parent?.children || []);
      const elementIndex = children.indexOf(element);
      const anchor = children.slice(elementIndex + 1).find(child => child.matches('.selected-record-sheet, .pack-paper-footer, .dialog-actions'));
      const siblingsBetween = anchor
        ? children.slice(elementIndex + 1, children.indexOf(anchor)).reduce((height, child) => {
          const style = getComputedStyle(child);
          return height + child.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
        }, 0)
        : 0;
      const maxHeight = parseFloat(getComputedStyle(element).maxHeight) || element.clientHeight;
      const availableHeight = anchor
        ? Math.min(maxHeight, anchor.getBoundingClientRect().top - element.getBoundingClientRect().top - siblingsBetween)
        : maxHeight;
      const rowsHeight = Math.max(0, availableHeight - headerHeight - footerHeight - 2);
      const nextSize = Math.max(1, Math.min(12, Math.floor(rowsHeight / rowHeight)));
      setAutoSize(current => current === nextSize ? current : nextSize);
    };
    const observer = new ResizeObserver(measureCapacity);
    const parent = element.parentElement;
    const anchor = Array.from(parent?.children || []).find(child => child.matches('.selected-record-sheet, .pack-paper-footer, .dialog-actions'));
    if (parent) observer.observe(parent);
    if (anchor) observer.observe(anchor);
    measureCapacity();
    return () => observer.disconnect();
  }, [recordKey, active]);
  const perPage = size === 'auto' ? autoSize : Number(size);
  const pages = Math.max(1, Math.ceil(sorted.length / perPage)), current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * perPage, current * perPage + perPage);
  const totals = summarize(records);
  function goPage(next) { setPage(next); scrollRef.current.scrollTop = 0; if (sorted[next * perPage]) onSelect(sorted[next * perPage].id); }
  return <><div ref={scrollRef} className="pack-ledger-scroll" tabIndex={0} role="region" aria-label="开包明细"><table className="pack-ledger pack-history-table"><colgroup><col style={{ width: '22%' }} /><col style={{ width: '5%' }} />{Array.from({ length: 8 }, (_, index) => <col key={index} style={{ width: '6.5%' }} />)}<col style={{ width: '8%' }} /><col style={{ width: '9%' }} /><col style={{ width: '4%' }} /></colgroup><thead><tr className="pack-quality-columns"><th className="pack-sticky-series">时间 / 系列</th><th>包数</th>{QUALITY_FIELDS.map(([key, label]) => <th key={key} title={label} className={qualityClass(key)}><span className="pack-quality-heading"><QualitySymbol quality={key} />{QUALITY_SHORT_NAMES[key]}</span></th>)}<th>来源</th><th className="pack-sticky-actions"><span className="sr-only">操作</span></th></tr></thead>
      <tbody>{visible.map(record => <RecordRow key={record.id} record={record} catalog={catalog} pityRecords={pityRecords} active={active} onSelect={onSelect} onDetails={onDetails} />)}{fillRows ? Array.from({ length: Math.max(0, perPage - visible.length) }, (_, index) => <tr key={`placeholder-${index}`} className="pack-placeholder-row" aria-hidden="true"><td colSpan={13} /></tr>) : null}</tbody>
      <tfoot><tr><th className="pack-sticky-series" scope="row">筛选合计</th><td>{totals.count}</td>{QUALITY_FIELDS.map(([key]) => <td key={key} className={qualityClass(key)}>{totals.qualities[key] || 0}</td>)}<td>—</td><td className="pack-sticky-actions" /></tr></tfoot>
    </table></div><div className="pack-history-pagination"><span>{records.length ? `${current * perPage + 1}–${Math.min((current + 1) * perPage, records.length)}` : '0'} / {records.length} 条</span><label><span className="sr-only">每批记录条数</span><select value={size} onChange={event => { setSize(event.target.value); setPage(0); }}><option value="auto">自动分批（{autoSize} 条）</option><option value="5">每批 5 条</option><option value="10">每批 10 条</option><option value="20">每批 20 条</option></select></label><div><button className="pack-scroll-button" aria-label="上一批记录" disabled={!current} onClick={() => goPage(current - 1)}><Icon name="left" /></button><b>{current + 1} / {pages}</b><button className="pack-scroll-button" aria-label="下一批记录" disabled={current === pages - 1} onClick={() => goPage(current + 1)}><Icon name="right" /></button></div></div></>;
}
function RecordRow({ record, catalog, pityRecords, active, onSelect, onDetails }) {
  const details = useMemo(() => recordedCards(record, catalog), [record, catalog]);
  return <tr className={active === record.id ? 'selected' : ''}>
      <td className="pack-sticky-series"><button className="pack-record-select" aria-pressed={active === record.id} onClick={() => onSelect(record.id)}><PackPityPreview record={record} records={pityRecords}><PackArt set={record.set} type={record.type} assetName={record.artName} title="" /></PackPityPreview><span className="pack-record-identity"><strong>{record.set}</strong><span><time dateTime={record.date} title={record.date.replace('T', ' ')}>{record.date.slice(5, 10).replace('-', '/')} {record.date.slice(11)}</time> · {PACK_TYPES[record.type]}</span></span></button></td>
      <td>{record.count}</td>{QUALITY_FIELDS.map(([key, label]) => {
        const count = record.qualities[key] || 0;
        const previewAllowed = ['epic', 'legendary', 'goldRare', 'goldEpic', 'goldLegendary', 'signature'].includes(key);
        const cards = details.filter(entry => entry.qualityKey === key);
        return <td key={key} className={`${qualityClass(key)} ${count ? 'has-cards' : 'zero-cards'}`}>{previewAllowed ? <QualityCardPreview label={label} count={count} cards={cards} /> : count || '–'}</td>;
      })}
      <td><span className={`pack-source ${record.source === '日志识别' ? 'auto' : ''}`}>{record.source}</span></td><td className="pack-sticky-actions"><button className="pack-row-more" aria-label={`查看 ${record.set} ${record.date.slice(11)} 的记录详情`} onClick={() => onDetails(record)}>•••</button></td>
    </tr>;
}

