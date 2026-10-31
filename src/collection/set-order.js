// Expansion release sequence, newest first. Evergreen collections follow the releases.
export const SET_RELEASE_ORDER = [
  'BE', 'ESCAPEFROM_VIOLET_HOLD', 'CATACLYSM', 'TIME_TRAVEL', 'THE_LOST_CITY', 'EMERALD_DREAM',
  'SPACE', 'ISLAND_VACATION', 'WHIZBANGS_WORKSHOP', 'WILD_WEST', 'WONDERS', 'TITANS',
  'BATTLE_OF_THE_BANDS', 'RETURN_OF_THE_LICH_KING', 'PATH_OF_ARTHAS', 'REVENDRETH', 'THE_SUNKEN_CITY',
  'ALTERAC_VALLEY', 'STORMWIND', 'THE_BARRENS', 'DARKMOON_FAIRE', 'SCHOLOMANCE', 'BLACK_TEMPLE',
  'DEMON_HUNTER_INITIATE', 'YEAR_OF_THE_DRAGON', 'DRAGONS', 'ULDUM', 'DALARAN', 'TROLL', 'BOOMSDAY',
  'GILNEAS', 'LOOTAPALOOZA', 'ICECROWN', 'UNGORO', 'GANGS', 'KARA', 'OG', 'LOE', 'TGT', 'BRM',
  'GVG', 'NAXX', 'EXPERT1', 'CORE', 'LEGACY', 'EVENT',
];
const positions = new Map(SET_RELEASE_ORDER.map((set, index) => [set, index]));
export function compareSetsByRelease(a, b) {
  return (positions.get(a) ?? Infinity) - (positions.get(b) ?? Infinity) || a.localeCompare(b);
}

