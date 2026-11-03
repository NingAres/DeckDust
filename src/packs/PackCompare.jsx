import { useMemo, useState } from 'react';
import usePacks from './usePacks.js';
import PackArt from './PackArt.jsx';
import PackSymbol from './PackSymbol.jsx';
import Icon from '../components/Icon.jsx';
import useComparisonMotion from '../decks/useComparisonMotion.js';
import { metricLeaders, overallPackLeaders } from './pack-comparison-ranking.js';
import { overviewRows, PACK_TYPES } from './demo.js';

const LETTERS = 'ABCDE';
const METRICS = [
  { key: 'count', label: '累计开包数', unit: '包', value: row => row.count, digits: 0 },
  { key: 'goldLegendary', label: '金色传说', unit: '张', value: row => row.qualities.goldLegendary || 0, digits: 0, symbol: <PackSymbol golden/> },
  { key: 'signature', label: '异画传说', unit: '张', value: row => row.qualities.signature || 0, digits: 0, symbol: <PackSymbol signature/> },
  { key: 'legendary', label: '传说总数', unit: '张', value: row => row.legendary, digits: 0, symbol: <PackSymbol rarity="legendary"/> },
  { key: 'epicRatio', label: '史诗卡概率', value: row => row.epicRatio * 100, digits: 2, unit: '%', rate: true, symbol: <PackSymbol rarity="epic"/> },
  { key: 'legendaryRatio', label: '传说卡概率', value: row => row.legendaryRatio * 100, digits: 2, unit: '%', rate: true, symbol: <PackSymbol rarity="legendary"/> },
  { key: 'average', label: '平均每包尘值', value: row => Number(row.average), digits: 1, unit: '尘', symbol: <PackSymbol rarity="dust"/> },
  { key: 'interval', label: '平均每传说包数', value: row => row.legendary ? row.count / row.legendary : null, digits: 1, unit: '包', lower: true },
];
function format(value, digits) { return value === null ? '—' : value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
const identity = row => `${row.set} · ${PACK_TYPES[row.type] || row.type}`;

export default function PackCompare() {
  const api = usePacks();
  const rows = useMemo(() => overviewRows(api.statsRecords).sort((a, b) => b.count - a.count || a.set.localeCompare(b.set, 'zh-CN')), [api.statsRecords]);
  const [selection, setSelection, dataRef] = useComparisonMotion(null);
  const [query, setQuery] = useState('');
  const keys = selection ?? rows.slice(0, 2).map(row => row.key);
  const selected = keys.map(key => rows.find(row => row.key === key)).filter(Boolean);
  const pair = selected.length === 2;
  const filtered = rows.filter(row => identity(row).toLowerCase().includes(query.trim().toLowerCase()));
  function toggle(key) {
    setSelection(current => {
      const previous = (current ?? rows.slice(0, 2).map(row => row.key)).filter(value => rows.some(row => row.key === value));
      return previous.includes(key) ? previous.filter(value => value !== key) : previous.length < 5 ? [...previous, key] : previous;
    });
  }
  function leader(key) {
    const metric = METRICS.find(item => item.key === key);
    const values = selected.map((row, index) => ({ row, index, value: metric.value(row) })).filter(item => item.value !== null);
    const best = values.length ? Math.max(...values.map(item => item.value)) : null;
    return values.filter(item => item.value === best);
  }
  const rateLeaders = leader('legendaryRatio'), dustLeaders = leader('average');
  const labelLeaders = items => items.map(item => `${LETTERS[item.index]} ${item.row.set}${new Set(selected.map(row => row.type)).size > 1 ? `（${PACK_TYPES[item.row.type]}）` : ''}`).join('、');
  const total = selected.reduce((sum, row) => sum + row.count, 0);
  const mixedTypes = new Set(selected.map(row => row.type)).size > 1;
  const smallSamples = selected.filter(row => row.count < 40);
  const overall = overallPackLeaders(selected);
  return <section className="pack-comparison-workspace">
    <div className="pack-comparison-main">
      <header className="pack-comparison-intro"><div><small>PACK COMPARISON</small><h2>开包数据对比</h2><p>{pair ? '两包直接对照，差值按 B − A 展示。' : '把卡包放在同一张表里，看总量，也看每包表现。'}</p></div><div className="pack-comparison-total"><b>{format(total, 0)}</b><span>本次对比累计包数 · {selected.length} 类卡包</span></div></header>
      {api.error && <p className="pack-comparison-error" role="alert">{api.error}<button className="pack-link" onClick={() => api.refresh().catch(() => {})}>重新加载</button></p>}
      <div className="pack-comparison-data" ref={dataRef}>
      {api.loading ? <div className="pack-comparison-empty">正在读取开包统计…</div> : selected.length < 2 ? <div className="pack-comparison-empty"><h3>选择至少两种卡包</h3><p>在右侧加入卡包，即可查看数据差异和分析。</p></div> : <>
        <div className="pack-comparison-table-scroll"><table className="pack-comparison-table" style={{ minWidth: `${155 + selected.length * 125 + (pair ? 123 : 0)}px` }}><thead><tr><th scope="col">统计指标</th>{selected.map((row, index) => <th scope="col" key={row.key}><div className={`pack-comparison-identity tone-${index}`}><span className="pack-comparison-letter">{LETTERS[index]}</span><span className="pack-comparison-art"><PackArt set={row.set} type={row.type} assetName={row.records[0]?.artName}/>{overall.leaders.includes(index) && <span className="pack-overall-winner" role="img" aria-label={`${overall.leaders.length > 1 ? '并列' : ''}综合领先，${overall.scores[index]} 项领先`} title={`${overall.leaders.length > 1 ? '并列' : ''}综合领先 · 3 项表现指标中 ${overall.scores[index]} 项领先`}><Icon name="crown"/></span>}</span><strong>{row.set}</strong><small>{PACK_TYPES[row.type]}</small></div></th>)}{pair && <th scope="col" className="pack-difference-head">差值 <small>B − A</small></th>}</tr></thead><tbody>{METRICS.map(metric => {
          const values = selected.map(metric.value);
          const winning = metricLeaders(values, metric.lower);
          const delta = values[0] === null || values[1] === null ? null : Number((values[1] - values[0]).toFixed(metric.digits));
          return <tr key={metric.key}><th scope="row">{metric.symbol}<span>{metric.label}</span></th>{values.map((value, index) => <td key={selected[index].key} className={winning.includes(index) ? 'is-leading' : ''}><span className="pack-metric-value">{winning.includes(index) && <span className="pack-metric-award" role="img" aria-label={metric.lower ? '本项最低' : '本项最高'} title={metric.lower ? '当前对比中最低' : '当前对比中最高'}><Icon name="crown"/></span>}<b>{format(value, metric.digits)}</b>{value !== null && <small>{metric.unit}</small>}</span></td>)}{pair && <td className={`pack-metric-difference ${delta === 0 || delta === null ? 'is-equal' : delta > 0 ? 'is-positive' : 'is-negative'}`}><b>{delta !== null && delta > 0 ? '+' : ''}{format(delta, metric.digits)}</b>{delta !== null && <small>{metric.rate ? '百分点' : metric.unit}</small>}</td>}</tr>;
        })}</tbody></table></div>
        <section className="pack-comparison-analysis"><header><h3>差异分析</h3><span>基于当前历史记录</span></header><div className="pack-comparison-findings"><article><span>01 / 传说表现</span><h4>{rateLeaders.length === selected.length ? '传说卡概率持平' : `${labelLeaders(rateLeaders)}${rateLeaders.length > 1 ? '并列' : ''}领先`}</h4><p>传说卡概率为 {format(rateLeaders[0]?.value ?? null, 2)}%。{pair ? `两包相差 ${format(Math.abs((selected[1].legendaryRatio - selected[0].legendaryRatio) * 100), 2)} 个百分点。` : '表内标记各项的最高值，平均每传说包数标记最低值。'}传说总数包含普通、金色和异画。</p></article><article><span>02 / 每包价值</span><h4>{dustLeaders.length === selected.length ? '平均尘值持平' : `${labelLeaders(dustLeaders)}${dustLeaders.length > 1 ? '并列' : ''}最高`}</h4><p>平均每包 {format(dustLeaders[0]?.value ?? null, 1)} 尘。{pair ? `两包每包相差 ${format(Math.abs(Number(selected[1].average) - Number(selected[0].average)), 1)} 尘。` : '按每包口径比较，避免累计开包量掩盖单包差异。'}此处沿用总览的尘值估算。</p></article></div><p className="pack-comparison-context">{mixedTypes ? '本次含不同卡包类型，金色与异画卡包的品质结构不同，尘值差异不等同于出卡运气。' : '当前卡包类型相同，可结合开包量与出卡概率观察差异。'}{smallSamples.length > 0 ? ` ${smallSamples.map(row => row.set).join('、')}的样本少于 40 包，短期波动较大。` : ' 历史结果只描述已有记录，不预测下一包的结果。'}</p></section>
      </>}
      </div>
      <footer className="pack-comparison-definitions">与开包总览使用同一份统计数据。史诗／传说卡概率 = 对应品质总张数 ÷（包数 × 5）；平均每传说包数 = 包数 ÷ 传说总数，无传说时显示“—”。卡包旁的皇冠表示综合领先：按史诗卡概率、传说卡概率、平均每包尘值三项的领先数统计，同分并列；不计累计开包量。</footer>
    </div>
    <aside className="pack-comparison-controls"><header><h3>选择对比卡包</h3><span>{selected.length} / 5</span></header><p>选择 2–5 类卡包，同系列不同类型分别统计。</p><input type="search" aria-label="搜索对比卡包" placeholder="搜索扩展包或卡包类型…" value={query} onChange={event => setQuery(event.target.value)}/><div className="pack-comparison-options">{filtered.map(row => {
      const index = selected.findIndex(item => item.key === row.key), checked = index >= 0;
      return <button className={`pack-comparison-option ${checked ? `is-selected tone-${index}` : ''}`} key={row.key} aria-pressed={checked} disabled={!checked && selected.length >= 5} onClick={() => toggle(row.key)}><PackArt set={row.set} type={row.type} assetName={row.records[0]?.artName}/><span><b>{row.set}</b><small>{PACK_TYPES[row.type]} · {format(row.count, 0)} 包</small></span><i>{checked ? LETTERS[index] : '+'}</i></button>;
    })}{!filtered.length && !api.loading && <p className="pack-comparison-no-options">{rows.length ? '没有匹配的卡包' : '暂无开包统计记录'}</p>}</div><div className="pack-comparison-selection"><span>已选卡包</span>{selected.map((row, index) => <button key={row.key} onClick={() => toggle(row.key)} aria-label={`移除 ${identity(row)}`}><b>{LETTERS[index]}</b><span>{identity(row)}</span><i aria-hidden="true">×</i></button>)}</div><small className="pack-comparison-hint">{pair ? '两包模式 · 直接显示差值' : selected.length > 2 ? '多包模式 · 标记各项领先值' : '再加入一种卡包即可开始对比'}</small></aside>
  </section>;
}
