import { useId, useState } from 'react';
import Icon from '../components/Icon.jsx';
import PackSymbol from '../packs/PackSymbol.jsx';
import { RARITIES, completion, number, sum } from './demo.js';

export const QUALITIES = [['any', '全部品质'], ['normal', '普通卡'], ['golden', '金卡']];

export function Meter({ owned, total, color }) {
  return <span className="cs-meter" aria-hidden="true"><span style={{ width: `${completion(owned, total)}%`, background: color }} /></span>;
}

function Metric({ icon, label, owned, total, note, golden }) {
  return <div className={`cs-metric ${golden ? 'cs-metric-gold' : ''}`}>
    <span className="cs-metric-icon">{icon}</span><div><span>{label}</span>
      <strong>{completion(owned, total)}%<small className="cs-metric-count">{number(owned)} / {number(total)} 种</small></strong>
      <p>{note}</p>
    </div>
  </div>;
}

function RarityDistribution({ rarities, quality }) {
  const [hovered, setHovered] = useState(null);
  const owned = sum(rarities, quality);
  const active = rarities.find(row => row.key === hovered);
  const label = row => quality === 'golden' ? `金色${row.name}` : row.name;
  const share = row => owned ? (row[quality] / owned * 100).toFixed(2) : '0.00';
  const radius = 79, circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="cs-distribution-body">
    <div className="cs-donut" role="group" aria-label="已拥有卡牌的稀有度占比分布">
      <svg viewBox="0 0 180 180" aria-label="将鼠标移到色块或聚焦图例查看比例">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#b49a7144" strokeWidth="22" />
        {rarities.filter(row => row[quality] > 0).map(row => {
          const dash = row[quality] / owned * circumference, start = offset;
          offset += dash;
          return <circle key={row.key} data-rarity={row.key} className={active && active.key !== row.key ? 'is-muted' : ''}
            cx="90" cy="90" r={radius} fill="none" stroke={row.color} strokeWidth="22"
            strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-start} transform="rotate(-90 90 90)"
            onPointerEnter={() => setHovered(row.key)} onPointerLeave={() => setHovered(null)}>
            <title>{label(row)}：{number(row[quality])} 种，占 {share(row)}%</title>
          </circle>;
        })}
      </svg>
      <div className="cs-donut-center" aria-live="polite"><span>{active ? label(active) : '已拥有'}</span>
        <strong>{active ? `${share(active)}%` : number(owned)}</strong><small>{active ? `${number(active[quality])} 种卡牌` : '种卡牌'}</small></div>
    </div>
    <div className="cs-legend">{rarities.map(row => <button key={row.key} aria-label={`${label(row)} ${number(row[quality])} 种，占 ${share(row)}%`}
      onPointerEnter={() => setHovered(row.key)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(row.key)} onBlur={() => setHovered(null)} onClick={() => setHovered(row.key)}>
      <span className="cs-dot" style={{ background: row.color }} /><span>{label(row)}</span><b>{number(row[quality])}<small> 种</small></b><em>{share(row)}%</em>
    </button>)}</div>
  </div>;
}

export default function CollectionBreakdown({ sets, title, quality, onQuality }) {
  const id = useId();
  const rarities = RARITIES.map((rarity, i) => ({ ...rarity,
    ...Object.fromEntries(['total', 'any', 'normal', 'golden', 'goldenOnly', 'diamond', 'signature'].map(key =>
      [key, sets.reduce((n, set) => n + (set.rarities[i][key] || 0), 0)])),
  }));
  const total = sum(rarities, 'total'), any = sum(rarities, 'any');
  const golden = quality === 'golden';
  return <>
    <div className="cs-metrics">
      <Metric icon={<Icon name="collection" />} label="收藏完成度" owned={any} total={total} note="任一品质持有即计入" />
      <Metric icon={<PackSymbol rarity="common" />} label="普通卡收藏" owned={sum(rarities, 'normal')} total={total} note="非金色版本" />
      <Metric golden icon={<PackSymbol golden />} label="金卡收藏" owned={sum(rarities, 'golden')} total={total} note="含钻石、异画传说 · 种类去重" />
      <div className="cs-metric cs-missing"><span className="cs-metric-icon"><Icon name="search" /></span><div><span>尚未拥有</span><strong>{number(total - any)}<small> 种</small></strong><p>距离收齐，还差这些新面孔</p></div></div>
    </div>
    <div className="cs-analysis-heading"><div><h2>{title}<span>收藏分布</span></h2><p>{golden ? '金色传说包含金色、钻石与异画传说，同一卡牌只计一种。' : '同一卡牌的多个品质不重复计入「全部品质」。'}</p></div>
      <div className="cs-quality" role="group" aria-label="统计品质">{QUALITIES.map(([key, label]) => <button key={key} aria-pressed={quality === key} onClick={() => onQuality(key)}>{label}</button>)}</div>
    </div>
    <div className="cs-chart-grid">
      <section className="cs-distribution" aria-labelledby={`${id}-distribution`}><h3 id={`${id}-distribution`}>稀有度分布<small>已拥有种类的构成</small></h3>
        <RarityDistribution key={`${quality}-${title}`} rarities={rarities} quality={quality} />
      </section>
      <section className="cs-rarities" aria-labelledby={`${id}-rarities`}><h3 id={`${id}-rarities`}>各稀有度完成度<small>已拥有 / 可收藏种类</small></h3>
        {rarities.map(row => <div className="cs-rarity-row" key={row.key}>
          <span title={golden && row.key === 'legendary' ? `金色 ${row.goldenOnly} 种、钻石 ${row.diamond} 种、异画 ${row.signature} 种，合并去重后 ${row.golden} 种` : undefined}>
            <PackSymbol rarity={row.key} golden={golden} />{golden ? `金色${row.name}` : row.name}
          </span><div><Meter owned={row[quality]} total={row.total} color={row.color} /><small>{number(row[quality])} / {number(row.total)} 种</small></div><b>{completion(row[quality], row.total)}%</b>
        </div>)}
      </section>
    </div>
  </>;
}
