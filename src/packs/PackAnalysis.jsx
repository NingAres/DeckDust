import Icon from '../components/Icon.jsx';
import PackArt from './PackArt.jsx';
import { QualitySymbol } from './PackSymbol.jsx';
import { PACK_TYPES, QUALITY_FIELDS, QUALITY_SHORT_NAMES, groupCycles } from './demo.js';

export default function PackAnalysis({ records, cycles: suppliedCycles, dateFrom, dateTo, onDetails }) {
  const cycles = (suppliedCycles || groupCycles(records)).filter(cycle => (!dateFrom || cycle.date >= dateFrom) && (!dateTo || cycle.date.slice(0, 10) <= dateTo));
  return <><div className="pack-section-heading"><h2>传说出货区间 <span>{cycles.length} 段</span></h2><span>按系列与卡包类型独立合并</span></div>
    <div className="pack-analysis-scroll" tabIndex={0} role="region" aria-label="传说合并区间，可左右滚动"><table className="pack-ledger pack-cycle-table"><colgroup><col style={{ width: '18%' }} /><col style={{ width: '5%' }} /><col style={{ width: '5%' }} />{QUALITY_FIELDS.map(([key]) => <col key={key} style={{ width: '5%' }} />)}<col style={{ width: '7%' }} /><col style={{ width: '13%' }} /><col style={{ width: '7%' }} /></colgroup><thead><tr><th>扩展包 / 类型</th><th>累计包数</th><th>总卡数</th>{QUALITY_FIELDS.map(([key, label]) => <th key={key} title={label}><span className="pack-quality-heading"><QualitySymbol quality={key} />{QUALITY_SHORT_NAMES[key]}</span></th>)}<th>合并状态</th><th>最后开包时间</th><th /></tr></thead><tbody>{cycles.map(cycle => <tr key={cycle.id}>
      <td><div className="pack-set-identity"><PackArt set={cycle.set} type={cycle.type} assetName={cycle.records[0]?.artName} /><span><strong>{cycle.set}</strong><small className="pack-cell-note">{PACK_TYPES[cycle.type]}</small></span></div></td><td><b>{cycle.count}</b></td><td>{cycle.count * 5}</td>{QUALITY_FIELDS.map(([key]) => <td key={key} className={`quality-${key} ${cycle.qualities[key] ? 'has-cards' : 'zero-cards'}`}>{cycle.qualities[key] || '–'}</td>)}<td><span className={`cycle-state ${cycle.closed ? 'closed' : 'open'}`}>{cycle.closed ? '已结束' : '合并中'}</span></td><td className="pack-time-cell">{cycle.date.replace('T', ' ')}</td><td>{cycle.records.length ? <button className="pack-link" disabled={!cycle.records.length} title={!cycle.records.length ? "旧库未保留区间与逐次明细的可靠关联，原始明细在开包记录中保留" : undefined} onClick={() => onDetails(cycle)}>{cycle.records.length ? "区间明细" : "旧合并区间"} <Icon name="right" /></button> : null}</td>
    </tr>)}</tbody></table>{!cycles.length ? <div className="pack-empty"><h3>当前范围暂无合并区间</h3><p>请选择其他扩展包或卡包类型。</p></div> : null}</div>
    <p className="pack-footnote">选择扩展包后查看该系列；未选择时查看全部。各卡包类型分别累计。新记录可追溯区间明细；旧合并区间保留原统计，逐次历史在开包记录中独立保留。旧历史修改的差额计入总览，不重写旧合并区间。</p>
  </>;
}

