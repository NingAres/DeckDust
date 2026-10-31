import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import PackArt from './PackArt.jsx';
import { QualitySymbol } from './PackSymbol.jsx';
import { PACK_TYPES, QUALITY_FIELDS } from './demo.js';
import './pack-charts.css';

const COLORS = { common: '#8e8a79', rare: '#2875ad', epic: '#9253b3', legendary: '#bd7024', goldCommon: '#a98b40', goldRare: '#408dab', goldEpic: '#a46bb2', goldLegendary: '#da962c', signature: '#319b98' };
const fmt = value => Number(value).toLocaleString('zh-CN');
const percent = (value, total) => total ? `${(value / total * 100).toFixed(2)}%` : '0.00%';

export default function PackCharts({ row, onClose }) {
  const total = QUALITY_FIELDS.reduce((sum, [key]) => sum + (row.qualities[key] || 0), 0);
  const hasCorrections = QUALITY_FIELDS.some(([key]) => row.qualities[key] < 0);
  const highest = Math.max(1, ...QUALITY_FIELDS.map(([key]) => Math.abs(row.qualities[key] || 0)));
  const q = row.qualities;
  const isGoldPack = row.type === 'gold' || row.type === 'variant_gold';
  const goldenCount = ['goldCommon', 'goldRare', 'goldEpic', 'goldLegendary'].reduce((sum, key) => sum + (q[key] || 0), 0);
  const specialCount = isGoldPack ? (q.common || 0) : ['rare', 'epic', 'legendary', 'goldRare', 'goldEpic', 'goldLegendary', 'signature'].reduce((sum, key) => sum + (q[key] || 0), 0);
  const dates = row.records.map(record => record.date).filter(Boolean).sort();
  return <Modal title="开包图表分析" className="pack-dialog pack-charts-dialog" onClose={onClose}>
    <div className="pack-charts-identity"><PackArt set={row.set} type={row.type} assetName={row.records[0]?.artName} /><div><h3>{row.set}</h3><p>{PACK_TYPES[row.type]} · 当前总览筛选范围</p></div><span>{dates[0]?.slice(0, 10)} — {dates.at(-1)?.slice(0, 10)}</span></div>
    <div className="pack-charts-metrics">{[["累计开包", fmt(row.count), "包", <PackArt key="pack" set={row.set} type={row.type} assetName={row.records[0]?.artName} />], ["获得传说", fmt(row.legendary), "张", <QualitySymbol key="legendary" quality="legendary" />], ["获得史诗", fmt((q.epic || 0) + (q.goldEpic || 0)), "张", <QualitySymbol key="epic" quality="epic" />], ["平均每包尘值", row.average, "尘", <QualitySymbol key="dust" quality="dust" />]].map(([label, value, unit, symbol]) => <div key={label}>{symbol}<span>{label}</span><strong>{value}<small>{unit}</small></strong></div>)}</div>
    {!total ? <div className="pack-empty"><h3>暂无可分析的卡牌数量</h3><p>该范围的记录尚未包含品质统计。</p></div> : <div className="pack-charts-grid">
      <section className="pack-chart-panel"><h3>额外开包指标</h3><p>{isGoldPack ? '金色卡包不计算必然为 100% 的金卡率' : '展示总览表之外的品质概率与数量'} · 按已记录卡牌统计</p>
        <div className="pack-insight-list">{!isGoldPack ? <article className="pack-insight-golden"><div><QualitySymbol quality="goldRare" /><b>金卡率</b></div><strong>{percent(goldenCount, total)}</strong><small>{fmt(goldenCount)} 张金卡 / {fmt(total)} 张</small></article> : null}<article><div><QualitySymbol quality={isGoldPack ? 'common' : 'rare'} /><b>{isGoldPack ? '特殊卡率' : '非普通卡率'}</b></div><strong>{percent(specialCount, total)}</strong><small>{fmt(specialCount)} 张 / {fmt(total)} 张 · {isGoldPack ? '非金色普通卡' : '稀有及以上卡牌'}</small></article></div>
      </section>
      <section className="pack-chart-panel"><h3>各品质出货数量</h3><p>普通、金色与异画分别展示 · 横轴为卡牌张数</p><div className="pack-quality-bars">{QUALITY_FIELDS.map(([key, label]) => {
        const count = row.qualities[key] || 0;
        const width = Math.abs(count) / highest * (hasCorrections ? 50 : 100);
        return <div className="pack-quality-bar-row" key={key}><span><QualitySymbol quality={key} />{label}</span><div className={`pack-chart-bar-track ${hasCorrections ? 'signed' : ''}`}><span style={{ width: `${width}%`, left: hasCorrections ? `${count < 0 ? 50 - width : 50}%` : 0, background: COLORS[key] }} /></div><b>{fmt(count)}</b><small>{hasCorrections ? (count < 0 ? '校正' : '张') : percent(count, total)}</small></div>;
      })}</div><div className="pack-chart-axis"><span>{hasCorrections ? `−${fmt(highest)}` : '0'} 张</span>{hasCorrections ? <span>0</span> : null}<span>{fmt(highest)} 张</span></div></section>
    </div>}
    <p className="pack-chart-footnote">金卡率按金色普通、稀有、史诗与传说统计；金包特殊卡率按非金色普通卡统计。传说卡包括普通、金色及异画版本。比例以本次已记录卡牌总张数为分母。</p>
  </Modal>;
}

