import Icon from '../components/Icon.jsx';
import ClassEmblem from '../components/ClassEmblem.jsx';
import { CLASSES, QUALITIES, RARITIES, SET_NAMES, DEFAULT_FILTERS } from './model.js';

const COLLECTION_CLASS_ORDER = [
  'DEATHKNIGHT', 'DEMONHUNTER', 'DRUID', 'HUNTER', 'MAGE', 'PALADIN',
  'PRIEST', 'ROGUE', 'SHAMAN', 'WARLOCK', 'WARRIOR', 'NEUTRAL',
];
const COLLECTION_CLASSES = COLLECTION_CLASS_ORDER
  .map(key => CLASSES.find(([classKey]) => classKey === key))
  .filter(Boolean);

export function ClassSelector({ value, onChange, allowedClasses }) {
  return <div className="class-banner"><div className="class-icon-buttons" role="group" aria-label="按职业筛选">
    {COLLECTION_CLASSES.map(([key, name]) => <button type="button" key={key} className="class-icon-button"
      title={`${name}${value === key ? '（再次点击显示全部职业）' : ''}`} aria-label={name} aria-pressed={value === key}
      disabled={allowedClasses && !allowedClasses.includes(key)}
      onClick={() => onChange({ class: value === key ? '' : key })}>
      <ClassEmblem cardClass={key} />
    </button>)}
  </div></div>;
}

export default function Filters({ filters, sets, onChange, onMore }) {
  const advanced = ['quality', 'ownership', 'threshold', 'type', 'sort'].some(key => filters[key] !== DEFAULT_FILTERS[key]);
  return <footer className="filters-bottom">
      <div className="expansion-control"><img className="set-selector-art" src="/assets/native-ui/extracted/set-book-emblem.png" alt="" />
        <select className="set-select" aria-label="扩展包筛选" value={filters.set} onChange={event => onChange({ set: event.target.value })}>
          <option value="">所有扩展包</option>{sets.map(set => <option value={set} key={set}>{SET_NAMES[set] || set}</option>)}
        </select>
      </div>
      <div className="mana-row" role="group" aria-label="法力值筛选">
        {['0', '1', '2', '3', '4', '5', '6', '7+'].map(mana => <button type="button" className={`mana ${filters.mana === mana ? 'active' : ''}`} key={mana}
          aria-label={mana === '7+' ? '7 费及以上' : `${mana} 费`} aria-pressed={filters.mana === mana}
          onClick={() => onChange({ mana: filters.mana === mana ? '' : mana })}>
          <img src={`/assets/mana-crystals/mana-${mana === '7+' ? '7' : mana}.png`} alt="" draggable="false" />{mana === '7+' ? <span className="mana-plus">+</span> : null}
        </button>)}
      </div>
    <div className="collection-tools">
      <label className="search-box"><Icon name="search" /><input className="search native-search" type="search" value={filters.query}
        onChange={event => onChange({ query: event.target.value })} placeholder="查找" aria-label="搜索卡牌" /></label>
      <div className="filter-actions">
      <select className="rarity-select" aria-label="稀有度" value={filters.rarity} onChange={event => onChange({ rarity: event.target.value })}>
        <option value="">所有稀有度</option>{Object.entries(RARITIES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
      <label className="owned-toggle"><input type="checkbox" checked={filters.ownership !== 'owned'}
        onChange={event => onChange({ ownership: event.target.checked ? '' : 'owned' })} />显示未拥有</label>
      <button className={`simple-button more-filter ${advanced ? 'has-filters' : ''}`} aria-label="更多筛选" title={filters.quality ? `当前仅显示${QUALITIES.find(([key]) => key === filters.quality)?.[1]}品质，点击更改` : advanced ? '更多筛选（已启用额外筛选）' : '更多筛选'} onClick={onMore}>{filters.quality ? `${QUALITIES.find(([key]) => key === filters.quality)?.[1]} · 筛选` : '更多筛选'}{advanced ? <span className="filter-indicator" aria-hidden="true" /> : null}</button>
      <span className="collection-count">10 张 / 页</span>
      </div>
    </div>
  </footer>;
}

