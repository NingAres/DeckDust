import { QUALITY_FIELDS } from './demo.js';
import { PACK_ASSETS } from './pack-assets.js';

const RARITIES = { common: 'COMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY' };
// Only explicit card-detail fixtures get previews. A source label alone is insufficient.
export function recordedCards(record, catalog) {
  if (record.source === '手动录入') return [];
  if (Array.isArray(record.cardDetails)) return record.cardDetails;
  if (!record.demoCardDetails || !catalog.length) return [];
  const set = PACK_ASSETS[record.artName || record.set]?.set;
  return QUALITY_FIELDS.flatMap(([key]) => {
    const base = key === 'signature' ? 'legendary' : key.replace(/^gold/, '').toLowerCase();
    const rarity = RARITIES[base];
    const sameSet = catalog.filter(card => card.set === set && card.rarity === rarity);
    const pool = sameSet.length ? sameSet : catalog.filter(card => card.rarity === rarity);
    if (!pool.length) return [];
    return Array.from({ length: record.qualities[key] || 0 }, (_, index) => ({ card: pool[index % pool.length], qualityKey: key, quality: key === 'signature' ? 'signature' : key.startsWith('gold') ? 'golden' : 'normal' }));
  });
}

