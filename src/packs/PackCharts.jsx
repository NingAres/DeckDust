import { flushSync } from 'react-dom';
import { useMemo, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import PackArt from './PackArt.jsx';
import { QualitySymbol } from './PackSymbol.jsx';
import { PACK_TYPES, QUALITY_FIELDS } from './demo.js';
import './pack-charts.css';

const COLORS = { common: '#8e8a79', rare: '#2875ad', epic: '#9253b3', legendary: '#bd7024', goldCommon: '#a98b40', goldRare: '#408dab', goldEpic: '#a46bb2', goldLegendary: '#da962c', signature: '#319b98' };
const GROUP_COLORS = { A: '#317b52', B: '#65459a' };
const PACK_SIZE = 5;
const fmt = value => Number(value).toLocaleString('zh-CN');
const percent = (value, total) => total ? `${(value / total * 100).toFixed(2)}%` : '0.00%';

function PieChart({ items }) {
  const [hovered, setHovered] = useState(null);
  const chartTotal = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 69, circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="pack-quality-pie pack-chart-transition" aria-label="当前显示品质的卡牌占比分布"><svg viewBox="0 0 180 180" aria-hidden="true">{items.filter(item => item.value > 0).map(item => {
    const fraction = item.value / Math.max(1, chartTotal), dash = fraction * circumference, start = offset;
    offset += dash;
    const hoverLabel = item.group ? `分组 ${item.group}` : item.label;
    const paintedDash = Math.max(0, dash - 1.5);
    return <g key={item.id}><circle cx="90" cy="90" r={radius} fill="none" stroke={item.color} strokeWidth="42" strokeDasharray={`${paintedDash} ${circumference - paintedDash}`} strokeDashoffset={-start} transform="rotate(-90 90 90)" onMouseEnter={() => setHovered({ ...item, hoverLabel, probability: fraction })} onMouseLeave={() => setHovered(null)}><title>{hoverLabel} · {(fraction * 100).toFixed(2)}%</title></circle></g>;
  })}</svg><span aria-live="polite"><b>{hovered ? `${(hovered.probability * 100).toFixed(2)}%` : fmt(chartTotal)}</b><small>{hovered ? hovered.hoverLabel : '张卡牌'}</small></span></div>;
}

export default function PackCharts({ row, onClose }) {
  const [showPrediction, setShowPrediction] = useState(false);
  const [chartType, setChartType] = useState('pie');
  const [chartSwitching, setChartSwitching] = useState(false);
  const chartVisualRef = useRef(null);
  const [hiddenQualities, setHiddenQualities] = useState([]);
  const [groupAssignments, setGroupAssignments] = useState({});
  const total = QUALITY_FIELDS.reduce((sum, [key]) => sum + (row.qualities[key] || 0), 0);
  const q = row.qualities;
  const isGoldPack = row.type === 'gold' || row.type === 'variant_gold';
  const goldenCount = ['goldCommon', 'goldRare', 'goldEpic', 'goldLegendary'].reduce((sum, key) => sum + (q[key] || 0), 0);
  const specialCount = isGoldPack
    ? ['goldRare', 'goldEpic', 'goldLegendary'].reduce((sum, key) => sum + (q[key] || 0), 0)
    : ['rare', 'epic', 'legendary', 'goldRare', 'goldEpic', 'goldLegendary', 'signature'].reduce((sum, key) => sum + (q[key] || 0), 0);
  const dates = row.records.map(record => record.date).filter(Boolean).sort();
  const predicted = useMemo(() => QUALITY_FIELDS.map(([key, label]) => {
    const count = q[key] || 0;
    const average = row.count ? count / row.count : 0;
    return { key, label, count, average, probability: average / PACK_SIZE };
  }), [q, row.count]);
  const shownKeys = QUALITY_FIELDS.map(([key]) => key).filter(key => !hiddenQualities.includes(key));
  const shownTotal = shownKeys.reduce((sum, key) => sum + Math.max(0, q[key] || 0), 0);
  const groupSizes = { A: Object.values(groupAssignments).filter(group => group === 'A').length, B: Object.values(groupAssignments).filter(group => group === 'B').length };
  const chartItems = [];
  for (const [key, label] of QUALITY_FIELDS) {
    if (!shownKeys.includes(key)) continue;
    const group = groupAssignments[key];
    if (!group) chartItems.push({ id: key, label, value: Math.max(0, q[key] || 0), color: COLORS[key], keys: [key] });
    else if (!chartItems.some(item => item.group === group)) {
      const keys = shownKeys.filter(itemKey => groupAssignments[itemKey] === group);
      chartItems.push({ id: `group-${group}`, label: `分组 ${group}`, value: keys.reduce((sum, itemKey) => sum + Math.max(0, q[itemKey] || 0), 0), color: GROUP_COLORS[group], keys, group });
    }
  }
  const allChartItems = QUALITY_FIELDS.map(([key, label]) => ({ id: key, label, value: Math.max(0, q[key] || 0), color: COLORS[key] }));
  const legendItems = [];
  for (const [key, label] of QUALITY_FIELDS) {
    const group = groupAssignments[key];
    if (!group) legendItems.push({ id: key, key, label, color: COLORS[key], value: hiddenQualities.includes(key) ? 0 : Math.max(0, q[key] || 0), active: !hiddenQualities.includes(key), keys: [key] });
    else if (!legendItems.some(item => item.group === group)) {
      const keys = QUALITY_FIELDS.map(([itemKey]) => itemKey).filter(itemKey => groupAssignments[itemKey] === group);
      const active = keys.every(itemKey => !hiddenQualities.includes(itemKey));
      legendItems.push({ id: `group-${group}`, label: `分组 ${group}`, members: keys.map(itemKey => QUALITY_FIELDS.find(([quality]) => quality === itemKey)?.[1]).join('、'), color: GROUP_COLORS[group], value: active ? keys.reduce((sum, itemKey) => sum + Math.max(0, q[itemKey] || 0), 0) : 0, active, keys, group });
    }
  }
  function toggleQuality(key) {
    setHiddenQualities(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  }
  function toggleLegendItem(item) {
    if (item.keys.length === 1) return toggleQuality(item.keys[0]);
    setHiddenQualities(current => item.keys.every(key => !current.includes(key)) ? [...new Set([...current, ...item.keys])] : current.filter(key => !item.keys.includes(key)));
  }
  const cycleGroup = item => setGroupAssignments(current => {
    const next = { ...current };
    const keys = item.keys;
    const oldGroup = item.group || next[keys[0]];
    const newGroup = oldGroup === 'A' ? 'B' : oldGroup === 'B' ? null : 'A';
    for (const key of keys) {
      if (newGroup) next[key] = newGroup;
      else delete next[key];
    }
    return next;
  });
  async function switchChart(next) {
    if (next === chartType || chartSwitching) return;
    const element = chartVisualRef.current;
    setChartSwitching(true);
    try {
      if (element) await element.animate([
        { opacity: 1, transform: 'translateX(0) scale(1)', filter: 'blur(0)' },
        { opacity: 0, transform: `translateX(${next === 'pie' ? '-18px' : '18px'}) scale(.94)`, filter: 'blur(3px)' },
      ], { duration: 220, easing: 'cubic-bezier(.4,0,.8,.4)', fill: 'forwards' }).finished;
      flushSync(() => setChartType(next));
      if (element) {
        element.getAnimations().forEach(animation => animation.cancel());
        await element.animate([
          { opacity: 0, transform: `translateX(${next === 'pie' ? '18px' : '-18px'}) scale(.94)`, filter: 'blur(3px)' },
          { opacity: 1, transform: 'translateX(0) scale(1)', filter: 'blur(0)' },
        ], { duration: 480, easing: 'cubic-bezier(.18,.72,.22,1)' }).finished;
      }
    } finally { setChartSwitching(false); }
  }
  return <>
    <Modal title="开包图表分析" className="pack-dialog pack-charts-dialog" onClose={onClose}>
      <div className="pack-charts-identity"><PackArt set={row.set} type={row.type} assetName={row.records[0]?.artName} /><div><h3>{row.set}</h3><p>{PACK_TYPES[row.type]} · 当前总览筛选范围</p></div><span>{dates[0]?.slice(0, 10)} — {dates.at(-1)?.slice(0, 10)}</span></div>
      <div className="pack-charts-metrics">{[["累计开包", fmt(row.count), "包", <PackArt key="pack" set={row.set} type={row.type} assetName={row.records[0]?.artName} />], ["获得传说", fmt(row.legendary), "张", <QualitySymbol key="legendary" quality="legendary" />], ["获得史诗", fmt((q.epic || 0) + (q.goldEpic || 0)), "张", <QualitySymbol key="epic" quality="epic" />], ["平均每包尘值", row.average, "尘", <QualitySymbol key="dust" quality="dust" />]].map(([label, value, unit, symbol]) => <div key={label}>{symbol}<span>{label}</span><strong>{value}<small>{unit}</small></strong></div>)}</div>
      {!total ? <div className="pack-empty"><h3>暂无可分析的卡牌数量</h3><p>该范围的记录尚未包含品质统计。</p></div> : <div className="pack-charts-grid">
        <section className="pack-chart-panel"><h3>额外开包指标</h3><p>{isGoldPack ? '金色卡包按金色稀有及以上品质计算特殊卡率' : '展示总览表之外的品质概率与数量'} · 按已记录卡牌统计</p>
          <div className="pack-insight-list">{!isGoldPack ? <article className="pack-insight-golden"><div><QualitySymbol quality="goldRare" /><b>金卡率</b></div><strong>{percent(goldenCount, total)}</strong><small>{fmt(goldenCount)} 张金卡 / {fmt(total)} 张</small></article> : null}<article><div><QualitySymbol quality={isGoldPack ? 'goldRare' : 'rare'} /><b>{isGoldPack ? '特殊卡率' : '非普通卡率'}</b></div><strong>{percent(specialCount, total)}</strong><small>{fmt(specialCount)} 张 / {fmt(total)} 张 · {isGoldPack ? '金色稀有及以上品质' : '稀有及以上卡牌'}</small></article>
            <button className="pack-prediction-card" onClick={() => setShowPrediction(true)} aria-haspopup="dialog"><span className="pack-prediction-icon"><QualitySymbol quality="legendary" /></span><span><b>每包开卡预测</b><small>查看九种品质的平均张数</small></span><strong>查看详情 <span aria-hidden="true">›</span></strong></button>
          </div>
        </section>
        <section className="pack-chart-panel pack-pie-panel">
          <div className="pack-chart-panel-heading"><div><h3>卡牌品质分布</h3><p>{chartType === 'pie' ? '隐藏与分组仅影响饼图 · 右键循环切换分组' : '各品质开包比例横向对比'}</p></div><div className="pack-chart-switch" role="group" aria-label="图表类型"><button type="button" aria-label="柱状图" title="柱状图" aria-pressed={chartType === 'bar'} disabled={chartSwitching} onClick={() => switchChart('bar')}><Icon name="chart" /></button><i aria-hidden="true"/><button type="button" aria-label="饼图" title="饼图" aria-pressed={chartType === 'pie'} disabled={chartSwitching} onClick={() => switchChart('pie')}><Icon name="pie" /></button></div></div>
          <div className={`pack-pie-content ${chartType === 'bar' ? 'horizontal-bar-mode' : ''}`}>
            <div ref={chartVisualRef} className="pack-chart-visual">{chartType === 'pie' ? <PieChart items={chartItems} /> : <div className="pack-quality-horizontal-bars" aria-label="品质概率横向柱状图">{allChartItems.map(item => <div className="pack-horizontal-bar-row" key={item.id}><span><QualitySymbol quality={item.id}/>{item.label}</span><div><i style={{ width: `${total ? Math.max(0, item.value / total * 100) : 0}%`, background: item.color }}/></div><b>{percent(item.value, total)}</b></div>)}</div>}</div>
            {chartType === 'pie' ? <div className="pack-chart-legend">{legendItems.map(item => {
              const shade = item.group ? Math.min(0x48, 0x18 + (groupSizes[item.group] - 1) * 0x0c).toString(16).padStart(2, '0') : '';
              return <button className={`${item.group ? `pack-quality-group-${item.group.toLowerCase()}` : ''} ${item.active ? '' : 'is-muted'}`} style={item.group ? { backgroundColor: `${GROUP_COLORS[item.group]}${shade}` } : undefined} type="button" key={item.id} aria-pressed={item.active} onClick={() => toggleLegendItem(item)} onContextMenu={event => { event.preventDefault(); cycleGroup(item); }} title={`左键隐藏/恢复 · 右键循环切换分组（当前：${item.group || '无'}）`}>
                <i style={{ background: item.color }}/><span>{item.group ? <em className="pack-chart-group-label">分组 {item.group}<small>{item.members}</small></em> : <><QualitySymbol quality={item.key}/>{item.label}</>}</span><small>{item.active ? percent(item.value, shownTotal) : '—'}</small>
              </button>;
            })}</div> : null}
          </div>
        </section>
      </div>}
      <p className="pack-chart-footnote">饼图按已记录卡牌数量展示品质占比；每包预测按包数均分，单卡概率以每包 5 个卡位为分母。传说包含普通、金色及异画版本。</p>
    </Modal>
    {showPrediction ? <Modal title="每包开卡预测" className="pack-dialog pack-prediction-modal" onClose={() => setShowPrediction(false)}><div className="pack-detail-heading pack-prediction-heading"><div className="pack-detail-identity"><PackArt set={row.set} type={row.type} assetName={row.records[0]?.artName}/><div><h3>{row.set}</h3><p>{PACK_TYPES[row.type]} · 基于 {fmt(row.count)} 包、{fmt(total)} 张已记录卡牌估算</p></div></div><strong>{row.count}<small> 包</small></strong></div><div className="pack-detail-counts pack-prediction-grid">{predicted.map((item, index) => <div key={item.key} className={`pack-quality-detail quality-${item.key}`} style={{ gridColumn: item.key === 'signature' ? 5 : index % 4 + 1, gridRow: item.key === 'signature' ? '1 / span 2' : index < 4 ? 1 : 2 }}><span><QualitySymbol quality={item.key}/>{item.label}</span><b>{item.average.toFixed(3)}</b></div>)}</div><p className="pack-chart-footnote">数字表示每包该品质的平均张数（保留三位小数），基于当前记录统计。</p></Modal> : null}
  </>;
}
