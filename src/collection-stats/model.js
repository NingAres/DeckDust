import { SET_NAMES, ownedCount } from '../collection/model.js';
import { compareSetsByRelease, matchesSetScope, STANDARD_SET_IDS } from '../collection/set-order.js';

export const RARITIES = [
  { key: 'free', name: '免费', color: '#6c8761' },
  { key: 'common', name: '普通', color: '#807b69' },
  { key: 'rare', name: '稀有', color: '#397da1' },
  { key: 'epic', name: '史诗', color: '#8d5aa0' },
  { key: 'legendary', name: '传说', color: '#ba792a' },
];
const TOTAL_KEYS = ['total', 'any', 'normal', 'golden', 'goldenOnly', 'diamond', 'signature'];

// Input is the same unexpanded, collection-attached catalogue as My Collection.
// Count a DBF identity once, regardless of quantities or owned finish variants.
export function buildCollectionSets(cards) {
  const sets = new Map();
  const unique = new Map(cards.filter(card => card.dbfId).map(card => [String(card.dbfId), card]));
  for (const card of unique.values()) {
    if (!sets.has(card.set)) sets.set(card.set, {
      id: card.set, name: SET_NAMES[card.set] || card.set,
      format: STANDARD_SET_IDS.has(card.set) ? 'standard' : card.set === 'EVENT' ? 'other' : 'wild',
      rarities: RARITIES.map(rarity => ({ ...rarity, ...Object.fromEntries(TOTAL_KEYS.map(key => [key, 0])) })),
    });
    const row = sets.get(card.set).rarities.find(rarity => rarity.key === card.rarity?.toLowerCase());
    if (!row) continue;
    const counted = { ...card, counts: card.counts || [] };
    const normal = ownedCount(counted, 'normal') > 0;
    const golden = ownedCount(counted, 'golden') > 0;
    const diamond = ownedCount(counted, 'diamond') > 0;
    const signature = ownedCount(counted, 'signature') > 0;
    row.total++;
    row.any += Number(ownedCount(counted) > 0);
    row.normal += Number(normal);
    row.goldenOnly += Number(golden);
    row.diamond += Number(diamond);
    row.signature += Number(signature);
    row.golden += Number(golden || (card.rarity === 'LEGENDARY' && (diamond || signature)));
  }
  return [...sets.values()].sort((a, b) => compareSetsByRelease(a.id, b.id));
}

export const setsForMode = (sets, mode) => sets.filter(set =>
  matchesSetScope(set.id, mode === 'all' ? '' : `@${mode}`));

export const sum = (rows, key) => rows.reduce((value, row) => value + row[key], 0);
export const completion = (owned, total) => total ? Math.round(owned / total * 1000) / 10 : 0;
export const number = value => value.toLocaleString('zh-CN');

export const GOLD_COLORS = { free: '#b4a662', common: '#baa04d', rare: '#61a3af', epic: '#b47fba', legendary: '#e2ad40' };
export const ownedKey = quality => quality === 'mixed' ? 'any' : quality;

// Gold takes precedence when a type has both versions. The two visual pieces
// form the existing union rather than adding duplicate normal and gold counts.
export function raritySegments(row, quality) {
  if (quality !== 'mixed') return [{ id: row.key, rarity: row.key, label: quality === 'golden' ? `金色${row.name}` : row.name,
    value: row[ownedKey(quality)], color: quality === 'golden' ? GOLD_COLORS[row.key] : row.color }];
  return [
    { id: `${row.key}-normal`, rarity: row.key, label: row.name, value: row.any - row.golden, color: row.color },
    { id: `${row.key}-golden`, rarity: row.key, label: `金色${row.name}`, value: row.golden, color: GOLD_COLORS[row.key] },
  ];
}
