// Illustrative UI fixtures only. Never merge these counts into user collection data.
import { SET_NAMES } from '../collection/model.js';
import { SET_RELEASE_ORDER } from '../collection/set-order.js';

// Current catalogue rotation: 2025 + 2026 releases and Core. Wild includes
// Standard expansions too; it is not the complement of the Standard pool.
export const STANDARD_SET_IDS = new Set([
  'CORE', 'EMERALD_DREAM', 'THE_LOST_CITY', 'TIME_TRAVEL',
  'CATACLYSM', 'ESCAPEFROM_VIOLET_HOLD', 'BE',
]);
export const RARITIES = [
  { key: 'common', name: '普通', color: '#807b69' },
  { key: 'rare', name: '稀有', color: '#397da1' },
  { key: 'epic', name: '史诗', color: '#8d5aa0' },
  { key: 'legendary', name: '传说', color: '#ba792a' },
];

// Variant lists contain card identities, so overlapping premium finishes count once.
export const premiumLegendaryTypes = ({ golden = [], diamond = [], signature = [] }) =>
  new Set([...golden, ...diamond, ...signature]).size;

export const DEMO_SETS = SET_RELEASE_ORDER.filter(id => SET_NAMES[id]).map((id, index) => ({
  id, name: SET_NAMES[id], format: STANDARD_SET_IDS.has(id) ? 'standard' : id === 'EVENT' ? 'other' : 'wild',
  rarities: RARITIES.map((rarity, i) => {
    const total = [72, 54, 27, 27][i];
    const normal = Math.round(total * (0.6 + ((index * 7 + i * 3) % 39) / 100));
    const goldenOnly = Math.round(total * (0.08 + ((index * 3 + i * 5) % 35) / 100));
    const diamond = i === 3 ? 2 : 0, signature = i === 3 ? 2 : 0;
    const golden = i === 3 ? premiumLegendaryTypes({
      golden: Array.from({ length: goldenOnly }, (_, card) => card),
      diamond: [goldenOnly - 1, goldenOnly], signature: [goldenOnly, goldenOnly + 1],
    }) : goldenOnly;
    // A golden version may cover a type missing from the normal collection.
    const any = Math.min(total, normal + [0, 1, 1, 2][i]);
    return { ...rarity, total, normal, golden, goldenOnly, diamond, signature, any };
  }),
}));

export const setsForMode = mode => DEMO_SETS.filter(set =>
  mode === 'all' || (mode === 'standard' ? set.format === 'standard' : set.format !== 'other'));

export const sum = (rows, key) => rows.reduce((value, row) => value + row[key], 0);
export const completion = (owned, total) => total ? Math.round(owned / total * 1000) / 10 : 0;
export const number = value => value.toLocaleString('zh-CN');
