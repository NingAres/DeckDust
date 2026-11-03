import { useId, useState } from 'react';
import Icon from '../components/Icon.jsx';
import PackSymbol from '../packs/PackSymbol.jsx';
import Changing from './Changing.jsx';
import { GOLD_COLORS, ownedKey, raritySegments, RARITIES, completion, number, sum } from './model.js';

export const QUALITIES = [['any', '全部品质'], ['normal', '普通卡'], ['golden', '金卡']];

const EXPLANATIONS = [
  '同一卡牌的多个品质不重复计入「全部品质」。',
  '金色传说包含金色、钻石与异画传说，同一卡牌只计一种。',
  '金色段优先计入，非金色段为其余已拥有种类；两段相加等于全部收藏，不重复计数。',
];
const DISTRIBUTION_CAPTIONS = ['已拥有种类的构成', '非金色 / 金色 · 种类去重'];

function StableText({ as: Tag = 'p', text, variants }) {
  return <Tag className="cs-stable-copy"><span>{text}</span>{variants.map(copy =>
    <span key={copy} className="cs-copy-reserve" aria-hidden="true">{copy}</span>)}</Tag>;
}

export function QualityTabs({ quality, onQuality, showGoldSegments, onShowGoldSegments }) {
  const selected = quality === 'mixed' ? 'any' : quality;
  return <div className="cs-quality-controls"><div className="cs-quality" role="group" aria-label="统计品质">{QUALITIES.map(([key, label]) => <button key={key} aria-pressed={selected === key} onClick={() => onQuality(key)}>{label}</button>)}</div>
    <label className="cs-gold-toggle" title={selected === 'any' ? '在全部品质中分段显示金卡' : '金卡分段仅用于全部品质'}><input type="checkbox" role="switch" disabled={selected !== 'any'} checked={showGoldSegments} onChange={event => onShowGoldSegments(event.target.checked)} /><span>显示金卡分段</span></label>
  </div>;
}

export function Meter({ owned, total, color, premium = 0, premiumColor }) {
  return <span className="cs-meter" aria-hidden="true"><span style={{ width: `${completion(owned, total)}%`, background: color }}>
    {premium > 0 ? <i className="cs-meter-premium" style={{ width: `${completion(premium, owned)}%`, background: premiumColor || 'rgba(255,210,31,1)' }} /> : null}
  </span></span>;
}

function Metric({ icon, label, owned, total, note, golden }) {
  return <div className={`cs-metric ${golden ? 'cs-metric-gold' : ''}`}>
    <span className="cs-metric-icon">{icon}</span><div><span>{label}</span>
      <Changing as="strong" valueKey={`${owned}-${total}`}><span>{number(owned)}<small className="cs-metric-denominator"> / {number(total)} 种</small></span><small className="cs-metric-count">{completion(owned, total)}%</small></Changing>
      <p>{note}</p>
    </div>
  </div>;
}

function RarityDistribution({ rarities, quality }) {
  const [hovered, setHovered] = useState(null);
  const key = ownedKey(quality), owned = sum(rarities, key);
  const segments = rarities.flatMap(row => raritySegments(row, quality));
  const activePart = segments.find(part => part.id === hovered);
  const activeRow = rarities.find(row => row.key === hovered);
  const active = activePart || (activeRow ? { label: quality === 'golden' ? `金色${activeRow.name}` : activeRow.name, value: activeRow[key] } : null);
  const share = value => owned ? (value / owned * 100).toFixed(2) : '0.00';
  const radius = 79, circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <Changing as="div" className="cs-distribution-body" valueKey={`${quality}-${rarities.map(row => row[key]).join(',')}`}>
    <div className="cs-donut" role="group" aria-label="已拥有卡牌的稀有度占比分布">
      <svg viewBox="0 0 180 180" aria-label="悬浮色块或图例查看数量与占比，色块会向外展开">
        {segments.filter(part => part.value > 0).map(part => {
          const dash = part.value / owned * circumference, start = offset;
          offset += dash;
          const siblings = segments.filter(item => item.rarity === part.rarity);
          const groupValue = siblings.reduce((n, item) => n + item.value, 0);
          const groupStart = start - siblings.slice(0, siblings.findIndex(item => item.id === part.id)).reduce((n, item) => n + item.value / owned * circumference, 0);
          const midpoint = hovered === part.rarity ? groupStart + groupValue / owned * circumference / 2 : start + dash / 2;
          const angle = midpoint / circumference * Math.PI * 2 - Math.PI / 2;
          const pulled = hovered === part.id || hovered === part.rarity;
          const gap = Math.min(2.5, dash * .16), painted = dash - gap;
          return <g key={part.id}><g className="cs-donut-segment" data-selected={pulled} style={{ transform: `translate(${pulled ? Math.cos(angle) * 8 : 0}px, ${pulled ? Math.sin(angle) * 8 : 0}px)` }}>
            <circle data-rarity={part.rarity} data-segment={part.id} cx="90" cy="90" r={radius} fill="none" stroke={part.color} strokeWidth="22"
              strokeDasharray={`${painted} ${circumference - painted}`} strokeDashoffset={-(start + gap / 2)} transform="rotate(-90 90 90)"
              pointerEvents="none">
              <title>{part.label}：{number(part.value)} 种，占 {share(part.value)}%</title>
            </circle>
          </g><circle className="cs-donut-hit" data-hit={part.id} cx="90" cy="90" r={radius} fill="none" stroke="transparent" strokeWidth="28"
            strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-start} transform="rotate(-90 90 90)" pointerEvents="stroke"
            onPointerEnter={() => setHovered(part.id)} onPointerLeave={() => setHovered(null)} />
          </g>;
        })}
      </svg>
      <div className="cs-donut-center" aria-live="polite"><span>{active ? active.label : '已拥有'}</span>
        <strong>{number(active ? active.value : owned)}</strong><small>{active ? `种卡牌 · ${share(active.value)}%` : '种卡牌'}</small></div>
    </div>
    <div className="cs-legend">{rarities.map(row => <button key={row.key} aria-label={`${row.name} ${number(row[key])} 种，占 ${share(row[key])}%`} data-active={hovered === row.key}
      onPointerEnter={() => setHovered(row.key)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(row.key)} onBlur={() => setHovered(null)} onClick={() => setHovered(row.key)}>
      <span className="cs-dot" style={{ background: row.color }} /><span className="cs-legend-name">{quality === 'golden' ? `金色${row.name}` : row.name}<small aria-hidden={quality !== 'mixed'} style={{ visibility: quality === 'mixed' ? 'visible' : 'hidden' }}>非金 {row.any - row.golden} · 金 {row.golden}</small></span><b>{number(row[key])}<small> 种</small></b><em>{share(row[key])}%</em>
    </button>)}</div>
  </Changing>;
}

export default function CollectionBreakdown({ sets, title, quality, onQuality, showQualityControl = true, showGoldSegments, onShowGoldSegments, onShowMissing }) {
  const id = useId();
  const rarities = RARITIES.map((rarity, i) => ({ ...rarity,
    ...Object.fromEntries(['total', 'any', 'normal', 'golden', 'goldenOnly', 'diamond', 'signature'].map(key =>
      [key, sets.reduce((n, set) => n + (set.rarities[i][key] || 0), 0)])),
  })).filter(row => row.total > 0);
  const total = sum(rarities, 'total'), any = sum(rarities, 'any');
  const golden = quality === 'golden', mixed = quality === 'mixed', key = ownedKey(quality);
  return <>
    <div className="cs-metrics">
      <Metric icon={<Icon name="collection" />} label="收藏完成度" owned={any} total={total} note="任一品质持有即计入" />
      <Metric icon={<PackSymbol rarity="common" />} label="普通卡收藏" owned={sum(rarities, 'normal')} total={total} note="非金色版本" />
      <Metric golden icon={<PackSymbol golden />} label="金卡收藏" owned={sum(rarities, 'golden')} total={total} note="含钻石、异画传说 · 种类去重" />
      <div className="cs-metric cs-missing"><button className="cs-metric-icon cs-missing-icon" aria-label="查看当前范围尚未拥有的卡牌" title="前往我的收藏，查看尚未拥有的卡牌" onClick={onShowMissing}><Icon name="search" /></button><div><span>尚未拥有</span><Changing as="strong" valueKey={total - any}>{number(total - any)}<small> 种</small></Changing><p>距离收齐，还差这些新面孔</p></div></div>
    </div>
    <div className="cs-analysis-heading"><div><h2>{title}<span>收藏分布</span></h2><StableText text={EXPLANATIONS[mixed ? 2 : golden ? 1 : 0]} variants={EXPLANATIONS} /></div>
      <>{showQualityControl ? <QualityTabs quality={quality} onQuality={onQuality} showGoldSegments={showGoldSegments} onShowGoldSegments={onShowGoldSegments} /> : null}</>
    </div>
    <div className="cs-chart-grid">
      <section className="cs-distribution" aria-labelledby={`${id}-distribution`}><h3 id={`${id}-distribution`}>稀有度分布<StableText as="small" text={DISTRIBUTION_CAPTIONS[mixed ? 1 : 0]} variants={DISTRIBUTION_CAPTIONS} /></h3>
        <RarityDistribution key={title} rarities={rarities} quality={quality} />
      </section>
      <section className="cs-rarities" aria-labelledby={`${id}-rarities`}><h3 id={`${id}-rarities`}>各稀有度完成度<small>已拥有 / 可收藏种类</small></h3>
        {rarities.map(row => <Changing as="div" className="cs-rarity-row" data-rarity={row.key} key={row.key} valueKey={`${quality}-${row[key]}-${row.total}`}>
          <span title={golden && row.key === 'legendary' ? `金色 ${row.goldenOnly} 种、钻石 ${row.diamond} 种、异画 ${row.signature} 种，合并去重后 ${row.golden} 种` : undefined}>
            <PackSymbol rarity={row.key === 'free' ? 'common' : row.key} golden={golden} />{golden ? `金色${row.name}` : row.name}
          </span><div><Meter owned={row[key]} total={row.total} color={golden ? GOLD_COLORS[row.key] : row.color} premium={mixed ? row.golden : 0} premiumColor={GOLD_COLORS[row.key]} /><small>{number(row[key])} / {number(row.total)} 种</small></div><b>{completion(row[key], row.total)}%</b>
        </Changing>)}
      </section>
    </div>
  </>;
}
