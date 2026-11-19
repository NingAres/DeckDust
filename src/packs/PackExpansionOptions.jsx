import PackArt from './PackArt.jsx';
import { PACK_TYPES } from './demo.js';

export default function PackExpansionOptions({ expansions, selectedId, onSelect, onSelectAll }) {
  return <div className="pending-expansion-grid" aria-label="选择扩展包">
    {onSelectAll ? <button type="button" className="pending-expansion-option" aria-pressed={selectedId === ''} onClick={onSelectAll}>
      <PackArt />
      <span className="pending-expansion-name">全部扩展包</span>
      <small>全部卡包类型</small>
    </button> : null}
    {expansions.map(item => <button type="button" key={item.id} className="pending-expansion-option" aria-pressed={selectedId === item.id} onClick={() => onSelect(item)}>
      <PackArt set={item.name} type={item.defaultType} assetName={item.artName} />
      <span className="pending-expansion-name">{item.name}</span>
      <small>{PACK_TYPES[item.defaultType]}</small>
    </button>)}
  </div>;
}
