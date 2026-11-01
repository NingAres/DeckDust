import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import PackSymbol from './PackSymbol.jsx';
import PackArt from './PackArt.jsx';
import PackCharts from './PackCharts.jsx';
import { PACK_TYPES, overviewRows, summarize } from './demo.js';
import { comparePackExpansions } from './expansion-order.js';

const percent = value => `${(value * 100).toFixed(2)}%`;
const SORT_COLUMNS = [
  ['set', '扩展包名称'], ['type', '卡包类型'], ['count', '总累计开包数'],
  ['goldLegendary', '总金色传说'], ['signature', '总异画传说'], ['legendary', '总传说数量'],
  ['epicRatio', '史诗卡概率'], ['legendaryRatio', '传说卡概率'], ['average', '平均每包尘值'], ['packsPerLegendary', '平均每传说包数'],
];
const COLUMNS = SORT_COLUMNS.filter(([key]) => key !== 'type');
function sortValue(row, key) {
  if (key === 'type') return PACK_TYPES[row.type];
  if (key === 'goldLegendary' || key === 'signature') return row.qualities[key] || 0;
  if (key === 'packsPerLegendary') return row.legendary ? row.count / row.legendary : null;
  return key === 'set' ? row.set : Number(row[key]);
}
export default function PackOverview({ records, sort, onSort, onTransition = update => update() }) {
  const [analysisKey, setAnalysisKey] = useState(null);
  const [direction, setDirection] = useState('desc');
  const [lastClicked, setLastClicked] = useState(null);
  function changeSort(key, fromHeader = false) {
    const nextDirection = fromHeader && lastClicked === key && direction === 'desc' ? 'asc' : 'desc';
    onTransition(() => {
      setDirection(nextDirection);
      setLastClicked(fromHeader ? key : null);
      onSort(key);
    });
  }
  const rows = overviewRows(records).sort((a, b) => {
    const left = sortValue(a, sort), right = sortValue(b, sort);
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    // The release registry is newest-first. Keep that as the header's descending order.
    const comparison = sort === 'set'
      ? -comparePackExpansions({ name: a.set, defaultType: a.type }, { name: b.set, defaultType: b.type })
      : typeof left === 'string' ? left.localeCompare(right, 'zh-CN') : left - right;
    return (direction === 'desc' ? -comparison : comparison) || a.set.localeCompare(b.set, 'zh-CN') || a.type.localeCompare(b.type);
  });
  const totals = summarize(records);
  const analyzedRow = rows.find(row => row.key === analysisKey);
  return <><div className="pack-section-heading"><h2>开包数据统计 <span>{rows.length} 类卡包</span></h2><label className="pack-source-filter"><span className="sr-only">总览排序</span><select value={sort} onChange={event => changeSort(event.target.value)}>{SORT_COLUMNS.map(([key, label]) => <option key={key} value={key}>按{label}排序</option>)}</select></label></div>
    <div className="pack-overview-table" tabIndex={0} role="region" aria-label="完整开包总览，可左右滚动"><table className="pack-ledger pack-full-overview"><colgroup>{[20, 8, 8, 8, 9, 9, 9, 10, 10, 9].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><thead><tr>{COLUMNS.map(([key, label]) => <th key={key} aria-sort={sort === key ? direction === 'desc' ? 'descending' : 'ascending' : 'none'}><button className="pack-sort-heading" aria-label={`${label}排序`} title={`点击按${label}排序；首次降序，再点升序`} onClick={() => changeSort(key, true)}>{key === 'goldLegendary' ? <PackSymbol golden /> : key === 'signature' ? <PackSymbol signature /> : key === 'legendary' || key === 'legendaryRatio' ? <PackSymbol rarity="legendary" /> : key === 'epicRatio' ? <PackSymbol rarity="epic" /> : key === 'average' ? <PackSymbol rarity="dust" /> : null}<span>{label}</span><i className="pack-sort-arrow" aria-hidden="true">{sort === key ? direction === 'desc' ? '▾' : '▴' : '↕'}</i></button></th>)}<th><span className="sr-only">操作</span></th></tr></thead><tbody>{rows.map(row => <tr key={row.key}><td><div className="pack-set-identity"><PackArt set={row.set} type={row.type} assetName={row.records[0]?.artName} /><span className="pack-set-label"><strong>{row.set}</strong><small>{PACK_TYPES[row.type]}</small></span></div></td><td>{row.count}</td><td className="quality-goldLegendary">{row.qualities.goldLegendary || 0}</td><td className="quality-signature">{row.qualities.signature || 0}</td><td className="legendary">{row.legendary}</td><td>{percent(row.epicRatio)}</td><td>{percent(row.legendaryRatio)}</td><td>{row.average}</td><td>{row.legendary ? (row.count / row.legendary).toFixed(1) : '–'}</td><td><button className="pack-link" aria-label={`查看${row.set} · ${PACK_TYPES[row.type]}详情`} onClick={() => setAnalysisKey(row.key)}>详情 <Icon name="right" /></button></td></tr>)}</tbody><tfoot><tr className="pack-overview-total"><th scope="row">筛选合计</th><td>{totals.count}</td><td className="quality-goldLegendary">{totals.qualities.goldLegendary || 0}</td><td className="quality-signature">{totals.qualities.signature || 0}</td><td className="legendary">{totals.legendary}</td><td>{percent(totals.epicRatio)}</td><td>{percent(totals.legendaryRatio)}</td><td>{totals.average}</td><td>{totals.legendary ? (totals.count / totals.legendary).toFixed(1) : '–'}</td><td /></tr></tfoot></table>{!rows.length ? <div className="pack-empty"><h3>当前筛选范围没有记录</h3></div> : null}</div>
    <div className="pack-overview-definitions"><p><b>史诗卡概率</b> = 史诗总张数 ÷ 总卡牌数；<b>传说卡概率</b> = 传说总张数 ÷ 总卡牌数。两者分母统一为总卡牌数（包数 × 5）。</p><p>传说总数包含普通、金色及异画。同一系列的不同卡包类型分别统计；平均尘值沿用旧系统估值与取整方式，特殊品质实际分解规则待接入时核对。</p></div>
    {analyzedRow ? <PackCharts row={analyzedRow} onClose={() => setAnalysisKey(null)} /> : null}
  </>;
}


