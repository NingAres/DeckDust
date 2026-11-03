import Modal from '../components/Modal.jsx';
import PackArt from '../packs/PackArt.jsx';
import { useState } from 'react';
import CollectionBreakdown, { QualityTabs } from './CollectionBreakdown.jsx';

export default function CollectionSetDialog({ set, initialQuality, initialShowGoldSegments, onShowMissing, onClose }) {
  const [quality, setQuality] = useState(initialQuality);
  const [showGoldSegments, setShowGoldSegments] = useState(initialShowGoldSegments);
  const chartQuality = quality === 'any' && showGoldSegments ? 'mixed' : quality;
  return <Modal title={`${set.name} · 收藏详情`} className="cs-set-dialog" onClose={onClose}>
    <div className="cs-dialog-identity"><PackArt set={set.name} /><div><h3>{set.name}</h3><p>{set.format === 'standard' ? '标准 / 狂野' : set.format === 'other' ? '活动系列' : '狂野'} · 按卡牌种类统计</p></div><QualityTabs quality={chartQuality} onQuality={setQuality} showGoldSegments={showGoldSegments} onShowGoldSegments={setShowGoldSegments} /></div>
    <CollectionBreakdown sets={[set]} title="稀有度" quality={chartQuality} onQuality={setQuality} showQualityControl={false} onShowMissing={onShowMissing} />
    <p className="cs-dialog-note">与我的收藏使用相同的真实持有数据；金色传说包含钻石与异画传说，并按卡牌种类去重。</p>
  </Modal>;
}
