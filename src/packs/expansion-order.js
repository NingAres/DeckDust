import { SET_NAMES } from '../collection/model.js';
import { SET_RELEASE_ORDER } from '../collection/set-order.js';
import { PACK_ASSETS } from './pack-assets.js';

const positions = new Map(SET_RELEASE_ORDER.map((key, index) => [SET_NAMES[key], index]));
const setPositions = new Map(SET_RELEASE_ORDER.map((key, index) => [key, index]));
const position = name => positions.get(name) ?? setPositions.get(PACK_ASSETS[name]?.set) ?? Infinity;

// Evergreen, class and custom packs have no expansion release date and follow dated sets.
export function comparePackExpansions(a, b) {
  return position(a.name) - position(b.name)
    || a.name.localeCompare(b.name, 'zh-CN')
    || ['normal', 'gold', 'variant_gold'].indexOf(a.defaultType) - ['normal', 'gold', 'variant_gold'].indexOf(b.defaultType);
}

