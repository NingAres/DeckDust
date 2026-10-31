import { useMemo } from 'react';
import Modal from '../components/Modal.jsx';
import { QUALITIES, SET_NAMES, progress } from './model.js';
import { compareSetsByRelease } from './set-order.js';

export default function ProgressDialog({ cards, meta, onClose, onChooseSet }) {
  const stats = useMemo(() => progress(cards), [cards]);
  const groups = useMemo(() => {
    const sets = Map.groupBy ? Map.groupBy(cards, card => card.set) : cards.reduce((map, card) => map.set(card.set, [...(map.get(card.set) || []), card]), new Map());
    return [...sets].map(([set, list]) => ({ set, ...progress(list) })).sort((a, b) => compareSetsByRelease(a.set, b.set));
  }, [cards]);
  return <Modal title="我的收藏进度" onClose={onClose} className="progress-modal">
    <div className="progress-summary"><div><strong>{stats.percent}%</strong><span>构筑收藏完成度</span></div>
      <div><strong>{stats.ownedTypes.toLocaleString()} / {stats.types.toLocaleString()}</strong><span>已拥有卡牌种类</span></div>
      <div><strong>{stats.missing.toLocaleString()}</strong><span>尚缺构筑张数</span></div>
    </div>
    <div className="progress-track large" role="progressbar" aria-label="整体收藏进度" aria-valuenow={stats.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${stats.percent}%` }} /></div>
    <div className="quality-totals">{QUALITIES.map(([key, label, index]) => <span className={key} key={key}>{label}<b>{stats.quality[index].toLocaleString()} 张</b></span>)}</div>
    <p className="help-text">普通、金色、钻石和异画合并计算。传说需要 1 张，其他卡牌需要 2 张；重复持有不增加完成度。英雄皮肤、佣兵及经典模式副本不计入。</p>
    <p className="dust-estimate">缺卡合成估算 <b>{stats.dust.toLocaleString()} 粉尘</b><small>按普通卡合成价格计算，不含核心系列和免费卡。</small></p>
    <h3>扩展包进度</h3><div className="set-progress-list">{groups.map(row => <button className="set-progress-row" key={row.set} onClick={() => onChooseSet(row.set)}>
      <span>{SET_NAMES[row.set] || row.set}</span><div className="progress-track"><span style={{ width: `${row.percent}%` }} /></div><span>{row.ownedTypes} / {row.types} 种</span><b>{row.percent}%</b>
    </button>)}</div>
    {meta.lastModified ? <p className="help-text">收藏来源时间：{new Date(meta.lastModified).toLocaleString('zh-CN')}</p> : null}
  </Modal>;
}

