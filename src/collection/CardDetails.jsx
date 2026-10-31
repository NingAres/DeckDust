import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import CardArt from './CardArt.jsx';
import { bestQuality, CLASSES, QUALITIES, RARITIES, TYPES, SET_NAMES, requiredCopies, ownedCount, textOnly } from './model.js';
import PackArt from '../packs/PackArt.jsx';

export default function CardDetails({ card, preferredQuality, onClose }) {
  const [quality, setQuality] = useState(preferredQuality || bestQuality(card));
  const classNames = (card.classes || [card.cardClass]).map(key => CLASSES.find(([value]) => key === value)?.[1] || key).join(' / ');
  const total = ownedCount(card);
  return <Modal title={card.name} onClose={onClose} className="card-detail-modal">
    <div className="card-details"><div className="detail-art-column"><div className={`detail-art quality-${quality}`}><CardArt card={card} quality={quality} detail /></div></div>
      <div className="detail-info">
        <p className="detail-class">{classNames} · {RARITIES[card.rarity]} · {TYPES[card.type]}</p>
        <p className="card-rules">{textOnly(card.text) || '这张卡牌没有额外描述。'}</p>
        <dl className="card-facts"><div><dt>法力消耗</dt><dd>{card.cost || 0}</dd></div>
          {card.attack !== undefined ? <div><dt>攻击力</dt><dd>{card.attack}</dd></div> : null}
          {card.health !== undefined ? <div><dt>生命值</dt><dd>{card.health}</dd></div> : null}
          {card.durability !== undefined ? <div><dt>耐久度</dt><dd>{card.durability}</dd></div> : null}
        </dl>
        <h3>我的持有数量</h3>
        <div className="quality-options" role="group" aria-label="卡面品质预览">{QUALITIES.map(([key, label, index]) =>
          <button type="button" key={key} className={`quality-choice ${key}`} aria-pressed={quality === key} onClick={() => setQuality(key)}>
            <span>{label}</span><strong className={card.counts[index] > 0 ? 'has-copies' : 'no-copies'}>×{card.counts[index]}</strong>
          </button>)}
        </div>
        <p className="ownership-note">合计 {total} 张 · {total >= requiredCopies(card) ? '已集齐构筑数量' : `还缺 ${requiredCopies(card) - total} 张即可满足构筑数量`}</p>
        <dl className="detail-meta"><div className="detail-expansion"><dt>所属扩展包</dt><dd className="detail-expansion-name"><PackArt set={SET_NAMES[card.set] || card.set} className="detail-expansion-art" /><span>{SET_NAMES[card.set] || card.set}</span></dd></div><div className="detail-card-id"><dt>卡牌 ID</dt><dd className="card-identifier">{card.id} / {card.dbfId}</dd></div></dl>
        {card.flavor ? <p className="flavor-text">{textOnly(card.flavor)}</p> : null}
      </div>
    </div>
  </Modal>;
}

