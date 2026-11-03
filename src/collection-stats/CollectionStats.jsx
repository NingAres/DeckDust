import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import PackArt from '../packs/PackArt.jsx';
import CollectionBreakdown, { Meter, QUALITIES } from './CollectionBreakdown.jsx';
import CollectionSetDialog from './CollectionSetDialog.jsx';
import useComparisonMotion from '../decks/useComparisonMotion.js';
import { setsForMode, completion, number, sum } from './demo.js';
import './collection-stats.css';

export default function CollectionStats() {
  const [{ scope, selected, quality, sort }, change, surface] = useComparisonMotion({ scope: 'all', selected: 'all', quality: 'any', sort: 'release' });
  const [detailSet, setDetailSet] = useState(null);
  const update = patch => change(current => ({ ...current, ...patch }));
  const sets = setsForMode(scope);
  const selectedSets = sets.filter(set => selected === 'all' || set.id === selected);
  const title = selected === 'all' ? '全部扩展包' : selectedSets[0]?.name;
  const sortedSets = [...sets].sort((a, b) => sort === 'release' ? 0 :
    (sort === 'completion' ? completion(sum(b.rarities, quality), sum(b.rarities, 'total')) - completion(sum(a.rarities, quality), sum(a.rarities, 'total'))
      : sum(b.rarities, 'total') - sum(b.rarities, quality) - (sum(a.rarities, 'total') - sum(a.rarities, quality))));
  return <section className="cs-workspace" aria-label="收藏统计设计预览">
    <div className="paper cs-paper"><div className="cs-paper-scroll" tabIndex={0} role="region" aria-label="收藏统计内容，可上下滚动">
      <div className="cs-filters">
        <div className="cs-scope" role="group" aria-label="模式范围">
          {[['all', '全部模式'], ['standard', '标准模式'], ['wild', '狂野模式']].map(([key, label]) => <button key={key} aria-pressed={scope === key} onClick={() => update({ scope: key, selected: 'all' })}>{label}</button>)}
        </div>
        <label className="cs-set-filter"><span>扩展包</span><select value={selected} onChange={event => update({ selected: event.target.value })}><option value="all">全部扩展包</option>{sets.map(set => <option value={set.id} key={set.id}>{set.name}</option>)}</select></label>
        <span className="cs-filter-hint">{selectedSets.length} 个卡牌系列 · 数量为示例</span>
      </div>
      <p className="cs-mode-note">{scope === 'standard' ? '标准：核心系列与当前轮换内的 2025、2026 年扩展包。' : scope === 'wild' ? '狂野：包含标准系列，以及历年扩展包、冒险与怀旧系列。' : '全部：项目卡库中的完整系列，包含核心、历年扩展包、冒险与活动卡牌。'}</p>

      <div className="cs-results" ref={surface}>
      <CollectionBreakdown sets={selectedSets} title={title} quality={quality} onQuality={value => update({ quality: value })} />

      <section className="cs-expansions" aria-labelledby="cs-expansions-title">
        <div className="cs-section-heading"><div><h2 id="cs-expansions-title">扩展包收藏进度</h2><p>点击柱状图或扩展包名称，在弹窗中查看该系列的收藏详情。</p></div><label><span className="sr-only">扩展包排序</span><select value={sort} onChange={event => update({ sort: event.target.value })}><option value="release">按发行顺序</option><option value="completion">按完成度排序</option><option value="missing">按缺失种类排序</option></select></label></div>
        <div className="cs-expansion-chart"><div className="cs-axis" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div><div className="cs-columns-scroll" tabIndex={0} role="region" aria-label="扩展包完成度柱状图，可横向滚动"><div className="cs-columns">
          {sortedSets.map(set => {
            const count = sum(set.rarities, quality), target = sum(set.rarities, 'total'), rate = completion(count, target);
            return <button className={`cs-column ${selected === set.id ? 'is-selected' : ''}`} key={set.id} aria-label={`${set.name}，已拥有 ${count} / ${target} 种，完成度 ${rate}%，打开收藏详情`} aria-haspopup="dialog" onClick={() => setDetailSet(set)}><span className="cs-column-plot"><span className={`cs-column-fill ${quality === 'golden' ? 'is-gold' : ''}`} style={{ height: `${rate}%` }}><b>{rate}%</b></span></span><span className="cs-column-label">{set.name}</span></button>;
          })}
        </div></div></div>
        <div className="cs-chart-caption"><span><i />{QUALITIES.find(([key]) => key === quality)[1]}完成度</span><span>同一口径 · 同一比例 · 不同系列</span></div>

        <div className="cs-table-scroll" role="region" aria-label="扩展包收藏明细，可横向滚动" tabIndex={0}><table className="cs-table"><thead><tr><th scope="col">扩展包</th><th scope="col">全部品质</th><th scope="col">普通卡</th><th scope="col" title="包含钻石与异画传说，按卡牌种类去重">金卡</th><th scope="col">尚未拥有</th><th scope="col">当前品质完成度</th></tr></thead><tbody>{sortedSets.map(set => {
          const target = sum(set.rarities, 'total'), all = sum(set.rarities, 'any'), rate = completion(sum(set.rarities, quality), target);
          return <tr key={set.id} className={selected === set.id ? 'is-selected' : ''}><th scope="row"><button aria-haspopup="dialog" onClick={() => setDetailSet(set)}><PackArt set={set.name} /><span>{set.name}<small>{set.format === 'standard' ? '标准 / 狂野' : set.format === 'other' ? '活动系列' : '狂野'} · {target} 种</small></span><Icon name="right" /></button></th><td>{all}<small> / {target}</small></td><td>{sum(set.rarities, 'normal')}<small> / {target}</small></td><td className="cs-gold-number">{sum(set.rarities, 'golden')}<small> / {target}</small></td><td>{target - all}<small> 种</small></td><td><span className="cs-table-progress"><Meter owned={sum(set.rarities, quality)} total={target} /><b>{rate}%</b></span></td></tr>;
        })}</tbody></table></div>
      </section>
      </div>
      <footer className="cs-footnote"><Icon name="alert" /><p><b>设计预览</b>　系列清单复用项目卡库与发行顺序；收藏数量与可收藏种类数仍为示例，尚未接入真实收藏。当前按至少拥有 1 张的卡牌种类展示，不代表构筑满编进度。普通卡指非金色版本；普通稀有度另行统计。</p></footer>
    </div></div>
    {detailSet ? <CollectionSetDialog set={detailSet} initialQuality={quality} onClose={() => setDetailSet(null)} /> : null}
  </section>;
}
