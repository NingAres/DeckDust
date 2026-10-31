import Modal from '../components/Modal.jsx';
import { TYPES, QUALITIES, DEFAULT_FILTERS } from './model.js';

export default function MoreFilters({ filters, onChange, onClose }) {
  return <Modal title="更多收藏筛选" onClose={onClose} className="filter-modal">
    <div className="filter-form">
    <label>卡牌品质<select aria-label="卡牌品质" value={filters.quality} onChange={event => onChange({ quality: event.target.value })}>
      <option value="">所有品质（分别展示）</option>{QUALITIES.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
    </select></label>
    <label>持有状态<select aria-label="持有状态" value={filters.ownership} onChange={event => onChange({ ownership: event.target.value })}>
      <option value="">全部卡牌</option><option value="owned">已拥有</option><option value="missing">按数量查缺卡</option><option value="incomplete">构筑数量未齐</option>
    </select></label>
    {filters.ownership === 'missing' ? <label>缺卡数量门槛<select aria-label="缺卡数量门槛" value={filters.threshold} onChange={event => onChange({ threshold: event.target.value })}>
      <option value="1">少于 1 张</option><option value="2">少于 2 张</option>
    </select></label> : null}
    <label>卡牌类型<select aria-label="卡牌类型" value={filters.type} onChange={event => onChange({ type: event.target.value })}>
      <option value="">所有类型</option>{Object.entries(TYPES).map(([key, name]) => <option value={key} key={key}>{name}</option>)}
    </select></label><label>排序方式<select aria-label="排序方式" value={filters.sort} onChange={event => onChange({ sort: event.target.value })}>
      <option value="cost">法力消耗：从低到高</option><option value="name">卡牌名称</option><option value="rarity">稀有度：从高到低</option><option value="owned">持有数量：从多到少</option>
    </select></label></div>
    <p className="help-text">搜索支持卡牌名称、描述、卡牌 ID 和 DBF ID。按数量查缺卡时，选择品质后仅比较该品质的持有数量。</p>
    <div className="dialog-actions"><button className="simple-button" onClick={() => onChange({ ...DEFAULT_FILTERS })}>重置全部筛选</button><button className="gold-button" onClick={onClose}>完成</button></div>
  </Modal>;
}

