import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import PackArt from '../packs/PackArt.jsx';
import PackSymbol from '../packs/PackSymbol.jsx';
import { DEMO_SETS, RARITIES, completion, number, sum } from './demo.js';
import './collection-stats.css';

const QUALITIES = [['any', '全部品质'], ['normal', '普通卡'], ['golden', '金卡']];

function Meter({ owned, total, color }) {
  return <span className="cs-meter" aria-hidden="true"><span style={{ width: `${completion(owned, total)}%`, background: color }} /></span>;
}

function Metric({ icon, label, owned, total, note, golden }) {
  return <div className={`cs-metric ${golden ? 'cs-metric-gold' : ''}`}>
    <span className="cs-metric-icon">{icon}</span><div><span>{label}</span>
      <strong>{number(owned)}<small> / {number(total)} 种</small></strong>
      <p><b>{completion(owned, total)}%</b><span>{note}</span></p>
    </div>
  </div>;
}

export default function CollectionStats() {
  const [scope, setScope] = useState('all');
  const [selected, setSelected] = useState('all');
  const [quality, setQuality] = useState('any');
  const [sort, setSort] = useState('release');
  const sets = DEMO_SETS.filter(set => scope === 'all' || set.format === scope);
  const selectedSets = sets.filter(set => selected === 'all' || set.id === selected);
  const rarities = RARITIES.map((rarity, i) => ({ ...rarity,
    total: selectedSets.reduce((n, set) => n + set.rarities[i].total, 0),
    any: selectedSets.reduce((n, set) => n + set.rarities[i].any, 0),
    normal: selectedSets.reduce((n, set) => n + set.rarities[i].normal, 0),
    golden: selectedSets.reduce((n, set) => n + set.rarities[i].golden, 0),
  }));
  const total = sum(rarities, 'total'), owned = sum(rarities, quality);
  const any = sum(rarities, 'any');
  const title = selected === 'all' ? '全部扩展包' : selectedSets[0]?.name;
  const sortedSets = [...sets].sort((a, b) => sort === 'release' ? 0 :
    (sort === 'completion' ? completion(sum(b.rarities, quality), sum(b.rarities, 'total')) - completion(sum(a.rarities, quality), sum(a.rarities, 'total'))
      : sum(b.rarities, 'total') - sum(b.rarities, quality) - (sum(a.rarities, 'total') - sum(a.rarities, quality))));
  const ringTotal = owned || 1;
  let offset = 0;
  const ringStops = rarities.map(row => {
    const start = offset;
    offset += row[quality] / ringTotal * 100;
    return `${row.color} ${start}% ${offset}%`;
  });

  function changeScope(value) { setScope(value); setSelected('all'); }

  return <section className="cs-workspace" aria-label="收藏统计设计预览">
    <div className="cs-toolbar">
      <div className="cs-intro"><h2>收藏全景</h2><p>从一张卡牌，到一整个扩展包。</p></div>
      <span className="cs-preview"><Icon name="pie" /> 界面预览 · 示例数据</span>
    </div>
    <div className="cs-paper">
      <div className="cs-filters">
        <div className="cs-scope" role="group" aria-label="示例模式范围">
          {[['all', '全部模式'], ['standard', '标准模式'], ['wild', '狂野模式']].map(([key, label]) => <button key={key} aria-pressed={scope === key} onClick={() => changeScope(key)}>{label}</button>)}
        </div>
        <label className="cs-set-filter"><span>扩展包</span><select value={selected} onChange={event => setSelected(event.target.value)}><option value="all">全部扩展包</option>{sets.map(set => <option value={set.id} key={set.id}>{set.name}</option>)}</select></label>
        <span className="cs-filter-hint">{selectedSets.length} 个示例扩展包 · 按卡牌种类统计</span>
      </div>

      <div className="cs-metrics">
        <Metric icon={<Icon name="collection" />} label="收藏完成度" owned={any} total={total} note="任一品质持有即计入" />
        <Metric icon={<PackSymbol rarity="common" />} label="普通卡收藏" owned={sum(rarities, 'normal')} total={total} note="非金色版本" />
        <Metric golden icon={<PackSymbol golden />} label="金卡收藏" owned={sum(rarities, 'golden')} total={total} note="金色版本单独统计" />
        <div className="cs-metric cs-missing"><span className="cs-metric-icon"><Icon name="search" /></span><div><span>尚未拥有</span><strong>{number(total - any)}<small> 种</small></strong><p>距离收齐，还差这些新面孔</p></div></div>
      </div>

      <div className="cs-analysis-heading"><div><h2>{title}<span>收藏分布</span></h2><p>同一卡牌的多个品质不重复计入「全部品质」。</p></div>
        <div className="cs-quality" role="group" aria-label="统计品质">{QUALITIES.map(([key, label]) => <button key={key} aria-pressed={quality === key} onClick={() => setQuality(key)}>{label}</button>)}</div>
      </div>

      <div className="cs-chart-grid">
        <section className="cs-distribution" aria-labelledby="cs-distribution-title"><h3 id="cs-distribution-title">稀有度分布<small>已拥有种类的构成</small></h3>
          <div className="cs-distribution-body">
            <div className="cs-donut" role="img" aria-label={`已拥有 ${owned} 种；${rarities.map(row => `${row.name} ${row[quality]} 种`).join('，')}`} style={{ background: owned ? `conic-gradient(${ringStops.join(',')})` : '#b49a71' }}><div><span>已拥有</span><strong>{number(owned)}</strong><small>种卡牌</small></div></div>
            <div className="cs-legend">{rarities.map(row => <div key={row.key}><span className="cs-dot" style={{ background: row.color }} /><span>{row.name}</span><b>{number(row[quality])}<small> 种</small></b><em>{completion(row[quality], owned)}%</em></div>)}</div>
          </div>
        </section>
        <section className="cs-rarities" aria-labelledby="cs-rarities-title"><h3 id="cs-rarities-title">各稀有度完成度<small>已拥有 / 可收藏种类</small></h3>
          {rarities.map(row => <div className="cs-rarity-row" key={row.key}><span><PackSymbol rarity={row.key} />{row.name}</span><div><Meter owned={row[quality]} total={row.total} color={row.color} /><small>{number(row[quality])} / {number(row.total)} 种</small></div><b>{completion(row[quality], row.total)}%</b></div>)}
        </section>
      </div>

      <section className="cs-expansions" aria-labelledby="cs-expansions-title">
        <div className="cs-section-heading"><div><h2 id="cs-expansions-title">扩展包收藏进度</h2><p>点击柱状图或扩展包名称，查看该系列的收藏分布。</p></div><label><span className="sr-only">扩展包排序</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="release">按发行顺序</option><option value="completion">按完成度排序</option><option value="missing">按缺失种类排序</option></select></label></div>
        <div className="cs-expansion-chart"><div className="cs-axis" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div><div className="cs-columns">
          {sortedSets.map(set => {
            const count = sum(set.rarities, quality), target = sum(set.rarities, 'total'), rate = completion(count, target);
            return <button className={`cs-column ${selected === set.id ? 'is-selected' : ''}`} key={set.id} aria-label={`${set.name}，已拥有 ${count} / ${target} 种，完成度 ${rate}%，查看分布`} aria-pressed={selected === set.id} onClick={() => setSelected(set.id)}><span className="cs-column-plot"><span className={`cs-column-fill ${quality === 'golden' ? 'is-gold' : ''}`} style={{ height: `${rate}%` }}><b>{rate}%</b></span></span><span className="cs-column-label">{set.name}</span></button>;
          })}
        </div></div>
        <div className="cs-chart-caption"><span><i />{QUALITIES.find(([key]) => key === quality)[1]}完成度</span><span>同一口径 · 同一比例 · 不同系列</span></div>

        <div className="cs-table-scroll" role="region" aria-label="扩展包收藏明细，可横向滚动" tabIndex={0}><table className="cs-table"><thead><tr><th scope="col">扩展包</th><th scope="col">全部品质</th><th scope="col">普通卡</th><th scope="col">金卡</th><th scope="col">尚未拥有</th><th scope="col">当前品质完成度</th></tr></thead><tbody>{sortedSets.map(set => {
          const target = sum(set.rarities, 'total'), all = sum(set.rarities, 'any'), rate = completion(sum(set.rarities, quality), target);
          return <tr key={set.id} className={selected === set.id ? 'is-selected' : ''}><th scope="row"><button aria-pressed={selected === set.id} onClick={() => setSelected(set.id)}><PackArt set={set.name} /><span>{set.name}<small>{set.format === 'standard' ? '标准' : '狂野'} · {target} 种</small></span><Icon name="right" /></button></th><td>{all}<small> / {target}</small></td><td>{sum(set.rarities, 'normal')}<small> / {target}</small></td><td className="cs-gold-number">{sum(set.rarities, 'golden')}<small> / {target}</small></td><td>{target - all}<small> 种</small></td><td><span className="cs-table-progress"><Meter owned={sum(set.rarities, quality)} total={target} /><b>{rate}%</b></span></td></tr>;
        })}</tbody></table></div>
      </section>
      <footer className="cs-footnote"><Icon name="alert" /><p><b>设计预览</b>　以上数量、扩展包范围与模式归属均为示例，尚未接入真实收藏。当前按至少拥有 1 张的卡牌种类展示，不代表构筑满编进度。普通卡指非金色版本；普通稀有度另行统计。</p></footer>
    </div>
  </section>;
}
