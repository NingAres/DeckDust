export const CLASSES = [
  ['WARRIOR', '战士', 'Warrior'],
  ['DRUID', '德鲁伊', 'Druid'], ['HUNTER', '猎人', 'Hunter'], ['ROGUE', '潜行者', 'Rogue'], ['MAGE', '法师', 'Mage'],
  ['PALADIN', '圣骑士', 'Paladin'], ['SHAMAN', '萨满祭司', 'Shaman'], ['PRIEST', '牧师', 'Priest'],
  ['WARLOCK', '术士', 'Warlock'], ['DEMONHUNTER', '恶魔猎手', 'DemonHunter'], ['DEATHKNIGHT', '死亡骑士', 'DeathKnight'],
  ['NEUTRAL', '中立', 'Neutral'],
];
export const QUALITIES = [
  ['normal', '普通', 0], ['golden', '金色', 1], ['diamond', '钻石', 2], ['signature', '异画', 3],
];
export const RARITIES = { FREE: '免费', COMMON: '普通', RARE: '稀有', EPIC: '史诗', LEGENDARY: '传说' };
export const TYPES = { MINION: '随从', SPELL: '法术', WEAPON: '武器', HERO: '英雄', LOCATION: '地标' };
export const SET_NAMES = {
  CORE: '核心系列', LEGACY: '怀旧', EXPERT1: '经典', NAXX: '纳克萨玛斯的诅咒', GVG: '地精大战侏儒',
  BRM: '黑石山的火焰', TGT: '冠军的试炼', LOE: '探险者协会', OG: '上古之神的低语', KARA: '卡拉赞之夜',
  GANGS: '龙争虎斗加基森', UNGORO: '勇闯安戈洛', ICECROWN: '冰封王座的骑士', LOOTAPALOOZA: '狗头人与地下世界',
  GILNEAS: '女巫森林', BOOMSDAY: '砰砰计划', TROLL: '拉斯塔哈的大乱斗', DALARAN: '暗影崛起',
  ULDUM: '奥丹姆奇兵', DRAGONS: '巨龙降临', YEAR_OF_THE_DRAGON: '迦拉克隆的觉醒', BLACK_TEMPLE: '外域的灰烬',
  DEMON_HUNTER_INITIATE: '恶魔猎手新兵', SCHOLOMANCE: '通灵学园', DARKMOON_FAIRE: '疯狂的暗月马戏团',
  THE_BARRENS: '贫瘠之地的锤炼', STORMWIND: '暴风城下的集结', ALTERAC_VALLEY: '奥特兰克的决裂',
  THE_SUNKEN_CITY: '探寻沉没之城', REVENDRETH: '纳斯利亚堡的悬案', RETURN_OF_THE_LICH_KING: '巫妖王的进军',
  PATH_OF_ARTHAS: '阿尔萨斯之路', BATTLE_OF_THE_BANDS: '传奇音乐节', TITANS: '泰坦诸神', WONDERS: '时光之穴',
  WILD_WEST: '决战荒芜之地', WHIZBANGS_WORKSHOP: '威兹班的工坊', ISLAND_VACATION: '胜地历险记',
  SPACE: '深暗领域', EMERALD_DREAM: '漫游翡翠梦境', THE_LOST_CITY: '安戈洛龟途', TIME_TRAVEL: '穿越时间流',
  BE: '黑暗帝国的统治', CATACLYSM: '大地的裂变', EVENT: '活动卡牌', ESCAPEFROM_VIOLET_HOLD: '紫罗兰监狱',
};
export const DEFAULT_FILTERS = {
  class: '', set: '', mana: '', query: '', rarity: '', quality: '', ownership: '', threshold: '1', type: '', sort: 'cost',
};
export const PREFERENCE_KEY = 'deck-dust-collection-filters-v1';
const EMPTY_COUNTS = [0, 0, 0, 0];
const QUALITY_INDEX = Object.fromEntries(QUALITIES.map(([key, , index]) => [key, index]));
const DUST = { FREE: 0, COMMON: 40, RARE: 100, EPIC: 400, LEGENDARY: 1600 };

export function textOnly(text = '') {
  return text.replace(/<[^>]*>/g, '').replace(/\[x\]/g, '').replace(/\$(\d+)/g, '$1').replace(/#(\d+)/g, '$1');
}
export function ownedCount(card, quality = '') {
  return quality ? card.counts[QUALITY_INDEX[quality]] : card.counts.slice(0, 4).reduce((sum, value) => sum + value, 0);
}
export function bestQuality(card) {
  return ['diamond', 'signature', 'golden', 'normal'].find(key => ownedCount(card, key) > 0) || 'normal';
}
// Expand after ownership filtering so missing-card thresholds still combine qualities.
export function expandQualityCards(cards, quality = '') {
  return cards.flatMap(card => {
    const qualities = quality ? [quality] : QUALITIES.filter(([, , index]) => card.counts[index] > 0).map(([key]) => key);
    return (qualities.length ? qualities : ['normal']).map(displayQuality => ({ ...card, displayQuality }));
  });
}
export function requiredCopies(card) { return card.rarity === 'LEGENDARY' ? 1 : 2; }
export function attachCollection(catalog, collection) {
  return catalog.map(card => ({ ...card, counts: collection[String(card.dbfId)] || EMPTY_COUNTS,
    searchText: `${card.name} ${textOnly(card.text)} ${card.id} ${card.dbfId}`.toLocaleLowerCase('zh-CN') }));
}
export function scopeCards(cards, filters) {
  const terms = filters.query.toLocaleLowerCase('zh-CN').trim().split(/\s+/).filter(Boolean);
  return cards.filter(card =>
    (!filters.class || (card.classes || [card.cardClass]).includes(filters.class)) &&
    (!filters.set || card.set === filters.set) && (!filters.rarity || card.rarity === filters.rarity) &&
    (!filters.type || card.type === filters.type) &&
    (!filters.mana || (filters.mana === '7+' ? (card.cost || 0) >= 7 : (card.cost || 0) === Number(filters.mana))) &&
    terms.every(term => card.searchText.includes(term)));
}
export function filterAndSort(cards, filters) {
  return cards.filter(card => {
    const count = ownedCount(card, filters.quality);
    if (filters.ownership === 'owned') return count > 0;
    if (filters.ownership === 'missing') return count < Number(filters.threshold);
    if (filters.ownership === 'incomplete') return count < requiredCopies(card);
    return true;
  }).sort((a, b) => {
    let difference = 0;
    if (filters.sort === 'name') difference = a.name.localeCompare(b.name, 'zh-CN');
    else if (filters.sort === 'owned') difference = ownedCount(b, filters.quality) - ownedCount(a, filters.quality);
    else if (filters.sort === 'rarity') difference = (DUST[b.rarity] || 0) - (DUST[a.rarity] || 0);
    else difference = (a.cost || 0) - (b.cost || 0);
    return difference || a.name.localeCompare(b.name, 'zh-CN') || a.dbfId - b.dbfId;
  });
}
export function progress(cards, quality = '') {
  const totals = { types: cards.length, ownedTypes: 0, copies: 0, needed: 0, missing: 0, dust: 0, quality: [0, 0, 0, 0] };
  for (const card of cards) {
    const owned = ownedCount(card, quality), required = requiredCopies(card), missing = Math.max(0, required - owned);
    totals.ownedTypes += owned > 0 ? 1 : 0;
    totals.copies += Math.min(required, owned);
    totals.needed += required;
    totals.missing += missing;
    totals.dust += missing * (card.set === 'CORE' ? 0 : (DUST[card.rarity] || 0));
    card.counts.slice(0, 4).forEach((count, index) => { totals.quality[index] += count; });
  }
  totals.percent = totals.needed ? Math.round(totals.copies / totals.needed * 1000) / 10 : 0;
  return totals;
}
export function validateImport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !raw.collection || Array.isArray(raw.collection) || typeof raw.collection !== 'object') {
    throw new Error('请选择包含 collection 对象的 HDT / HSReplay 收藏 JSON 文件。');
  }
  const entries = Object.entries(raw.collection);
  if (!entries.length) throw new Error('收藏数据为空，现有收藏已保留。');
  let ownedTypes = 0, copies = 0;
  for (const [id, counts] of entries) {
    if (!/^[1-9]\d{0,9}$/.test(id) || !Array.isArray(counts) || counts.length < 1 || counts.length > 16 ||
      counts.some(count => !Number.isSafeInteger(count) || count < 0 || count > 1000000)) {
      throw new Error(`卡牌 ${id} 的数据无效，ID 和数量必须为非负整数。`);
    }
    const total = counts.slice(0, 4).reduce((sum, count) => sum + count, 0);
    if (total > 0) ownedTypes++;
    copies += total;
  }
  if (!ownedTypes) throw new Error('文件中没有已拥有卡牌，现有收藏已保留。');
  return { types: entries.length, ownedTypes, copies };
}
export function loadFilters() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFERENCE_KEY) || '{}');
    const filters = Object.fromEntries(Object.entries(DEFAULT_FILTERS).map(([key, value]) => [key, typeof raw[key] === 'string' ? raw[key] : value]));
    if (!['', ...CLASSES.map(([key]) => key)].includes(filters.class)) filters.class = '';
    if (!['', ...QUALITIES.map(([key]) => key)].includes(filters.quality)) filters.quality = '';
    if (!['', 'owned', 'missing', 'incomplete'].includes(filters.ownership)) filters.ownership = '';
    if (!['1', '2'].includes(filters.threshold)) filters.threshold = '1';
    return filters;
  } catch { return { ...DEFAULT_FILTERS }; }
}

