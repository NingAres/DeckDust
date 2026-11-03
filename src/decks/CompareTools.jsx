import { useState } from 'react';
import Compare from './Compare.jsx';
import PackCompare from '../packs/PackCompare.jsx';
import Icon from '../components/Icon.jsx';
import useComparisonMotion from './useComparisonMotion.js';
import './compare-tools.css';

export default function CompareTools(props) {
  const [tab, setTab, stageRef] = useComparisonMotion('decks');
  const [packsOpened, setPacksOpened] = useState(false);
  function choose(next) { setTab(next); if (next === 'packs') setPacksOpened(true); }
  return <section className="comparison-tool-suite">
    <div className="comparison-tool-tabs" role="tablist" aria-label="对比类型">
      {[['decks', 'compare', '卡组对比'], ['packs', 'pack', '开包数据对比']].map(([key, icon, label], index) => <button key={key} id={`compare-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`compare-page-${key}`} tabIndex={tab === key ? 0 : -1} onClick={() => choose(key)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'decks' : event.key === 'End' ? 'packs' : index === 0 ? 'packs' : 'decks';
        choose(next); document.getElementById(`compare-tab-${next}`)?.focus();
      }}><Icon name={icon}/>{label}</button>)}
    </div>
    <div className="comparison-tool-stage" ref={stageRef}>
      <div className="comparison-tool-body" id="compare-page-decks" role="tabpanel" aria-labelledby="compare-tab-decks" hidden={tab !== 'decks'}><Compare {...props}/></div>
      <div className="comparison-tool-body" id="compare-page-packs" role="tabpanel" aria-labelledby="compare-tab-packs" hidden={tab !== 'packs'}>{packsOpened && <PackCompare/>}</div>
    </div>
  </section>;
}
