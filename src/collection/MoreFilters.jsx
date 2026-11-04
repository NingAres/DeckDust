import Modal from '../components/Modal.jsx';
import WheelSelect from '../components/WheelSelect.jsx';
import { TYPES, QUALITIES, DEFAULT_FILTERS } from './model.js';

export default function MoreFilters({ filters, onChange, onClose }) {
  return <Modal title="更多收藏筛选" onClose={onClose} className="filter-modal">
    <div className="filter-form">
    <label>模式范围<WheelSelect aria-label="模式范围" value={filters.format || ''} onValueChange={format => onChange({ format })}>
      <option value="">全部模式</option><option value="@standard">标准模式</option><option value="@wild">狂野模式</option>
    </WheelSelect></label>
    <label>卡牌品质<WheelSelect aria-label="卡牌品质" value={filters.quality} onValueChange={quality => onChange({ quality })}>
      <option value="">所有品质（分别展示）</option>{QUALITIES.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
    </WheelSelect></label>
    <label>持有状态<WheelSelect aria-label="持有状态" value={filters.ownership} onValueChange={ownership => onChange({ ownership })}>
      <option value="">全部卡牌</option><option value="owned">已拥有</option><option value="missing">按数量查缺卡</option><option value="incomplete">构筑数量未齐</option>
    </WheelSelect></label>
    {filters.ownership === 'missing' ? <label>缺卡数量门槛<WheelSelect aria-label="缺卡数量门槛" value={filters.threshold} onValueChange={threshold => onChange({ threshold })}>
      <option value="1">少于 1 张</option><option value="2">少于 2 张</option>
    </WheelSelect></label> : null}
    <label>卡牌类型<WheelSelect aria-label="卡牌类型" value={filters.type} onValueChange={type => onChange({ type })}>
      <option value="">所有类型</option>{Object.entries(TYPES).map(([key, name]) => <option value={key} key={key}>{name}</option>)}
    </WheelSelect></label><label>排序方式<WheelSelect aria-label="排序方式" value={filters.sort} onValueChange={sort => onChange({ sort })}>
      <option value="cost">法力消耗：从低到高</option><option value="name">卡牌名称</option><option value="rarity">稀有度：从高到低</option><option value="owned">持有数量：从多到少</option>
    </WheelSelect></label></div>
    <p className="help-text">搜索支持卡牌名称、描述、卡牌 ID 和 DBF ID。按数量查缺卡时，选择品质后仅比较该品质的持有数量。</p>
    <div className="dialog-actions"><button className="simple-button" onClick={() => onChange({ ...DEFAULT_FILTERS })}>重置全部筛选</button><button className="gold-button" onClick={onClose}>完成</button></div>
  </Modal>;
}

