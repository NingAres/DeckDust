import Modal from '../components/Modal.jsx';
import PackArt from '../packs/PackArt.jsx';
import useComparisonMotion from '../decks/useComparisonMotion.js';
import CollectionBreakdown from './CollectionBreakdown.jsx';

export default function CollectionSetDialog({ set, initialQuality, onClose }) {
  const [quality, setQuality, surface] = useComparisonMotion(initialQuality);
  return <Modal title={`${set.name} · 收藏详情`} className="cs-set-dialog" onClose={onClose}>
    <div className="cs-dialog-identity"><PackArt set={set.name} /><div><h3>{set.name}</h3><p>{set.format === 'standard' ? '标准 / 狂野' : set.format === 'other' ? '活动系列' : '狂野'} · 按卡牌种类统计</p></div></div>
    <div ref={surface}><CollectionBreakdown sets={[set]} title={set.name} quality={quality} onQuality={setQuality} /></div>
    <p className="cs-dialog-note">收藏数量为界面示例；金色传说包含钻石与异画传说，并按卡牌种类去重。</p>
  </Modal>;
}
