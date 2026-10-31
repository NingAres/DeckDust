import { CLASSES, ownedCount, requiredCopies } from '../collection/model.js';
export const HEROES = { WARRIOR: 7, DRUID: 274, HUNTER: 31, ROGUE: 930, MAGE: 637, PALADIN: 671, SHAMAN: 1066, PRIEST: 813, WARLOCK: 893, DEMONHUNTER: 56550, DEATHKNIGHT: 78065 };
export const HERO_ART = { WARRIOR: 'HERO_01', SHAMAN: 'HERO_02', ROGUE: 'HERO_03', PALADIN: 'HERO_04', HUNTER: 'HERO_05', DRUID: 'HERO_06', WARLOCK: 'HERO_07', MAGE: 'HERO_08', PRIEST: 'HERO_09', DEMONHUNTER: 'HERO_10', DEATHKNIGHT: 'HERO_11' };
export const FORMATS = { 1: '狂野', 2: '标准', 3: '经典' };
export const RENATHAL_DBF_ID = 79767;
export const RAFAM_DBF_ID = 119432;
export const ETC_DBF_ID = 90749;
export const SEWER_KING_DBF_ID = 125998;
export const GARONA_DBF_ID = 119814;
// Explicit, card-specific deck construction rules. The 奇闻 keyword alone is
// not a deck-size rule; only cards with a documented construction effect go here.
export const DECK_RULES = {
  [RENATHAL_DBF_ID]: { capacity: 40 },
  [RAFAM_DBF_ID]: { capacity: 40, maxCopies: 1, deckCopies: 10 },
  [ETC_DBF_ID]: { sideboardSize: 3 },
  [SEWER_KING_DBF_ID]: { sideboardSize: 3, sideboardRace: 'BEAST' },
  // These two non-collectible cards are serialized as entries in the official
  // deck code, but are supplied by Garona and should not be treated as owned cards.
  [GARONA_DBF_ID]: { includedCards: [{ id: 119815, count: 1 }, { id: 119816, count: 1 }] },
};
export const DECK_REFERENCE_IDS = [...new Set(Object.values(DECK_RULES).flatMap(rule => (rule.includedCards || []).map(card => card.id)))];
const INCLUDED_CARD_OWNER = new Map(Object.entries(DECK_RULES).flatMap(([ownerId, rule]) => (rule.includedCards || []).map(card => [card.id, Number(ownerId)])));
export function isDeckCompanion(id) { return INCLUDED_CARD_OWNER.has(Number(id)); }
export function deckCompanionOwner(id) { return INCLUDED_CARD_OWNER.get(Number(id)); }
export const DECK_QUALITIES = ['diamond', 'signature', 'golden', 'normal'];
// Allocation prefers the highest owned finish; presentation follows the order
// used by the collection and the game when showing duplicate copies.
export const DECK_QUALITY_DISPLAY_ORDER = ['normal', 'golden', 'signature', 'diamond'];
const DECK_QUALITY_DISPLAY_INDEX = Object.fromEntries(DECK_QUALITY_DISPLAY_ORDER.map((quality, index) => [quality, index]));
export function orderDeckVariantsForDisplay(rows) {
  return [...rows].sort((a, b) => DECK_QUALITY_DISPLAY_INDEX[a.quality] - DECK_QUALITY_DISPLAY_INDEX[b.quality]);
}
const QUALITY_INDEX = { normal: 0, golden: 1, diamond: 2, signature: 3 };
const DUST = { FREE: 0, COMMON: 40, RARE: 100, EPIC: 400, LEGENDARY: 1600 };
const GOLDEN_DUST = { FREE: 0, COMMON: 400, RARE: 800, EPIC: 1600, LEGENDARY: 3200 };

// Codes contain copy counts only; allocate owned copies once, never mark both
// copies golden just because the collection contains one golden copy.
export function deckEntryVariants(entry, card) {
  let variants = entry.variants;
  if (!variants) {
    variants = {}; let remaining = entry.count;
    for (const quality of DECK_QUALITIES) {
      const count = Math.min(remaining, card?.counts?.[QUALITY_INDEX[quality]] || 0);
      if (count) variants[quality] = count;
      remaining -= count;
    }
    if (remaining) variants.normal = (variants.normal || 0) + remaining;
  }
  return DECK_QUALITIES.filter(quality => variants[quality] > 0).map(quality => ({
    quality, count: variants[quality], missing: isDeckCompanion(entry.id) ? 0 : Math.max(0, variants[quality] - (card?.counts?.[QUALITY_INDEX[quality]] || 0)),
  }));
}

// Included cards share their owner's finish; they have no separate inventory.
export function inheritCompanionVariants(deck, cards = []) {
  const byId = new Map(cards.map(card => [card.dbfId, card]));
  return { ...deck, entries: deck.entries.map(entry => {
    const ownerId = deckCompanionOwner(entry.id);
    const owner = deck.entries.find(item => item.id === ownerId);
    if (!owner) return entry;
    const copies = DECK_RULES[ownerId].includedCards.find(item => item.id === entry.id).count;
    let remaining = entry.count;
    const variants = {};
    for (const row of deckEntryVariants(owner, byId.get(ownerId))) {
      const count = Math.min(remaining, row.count * copies);
      if (count) variants[row.quality] = count;
      remaining -= count;
    }
    return { ...entry, variants };
  }) };
}

// Quality is a presentation/allocation detail, not part of the deck code.
// Resolve every loaded deck against the current collection, preferring the
// highest owned quality and falling back through signature, golden and normal.
export function allocateDeckVariants(deck, cards) {
  const byId = new Map(cards.map(card => [card.dbfId, card]));
  return inheritCompanionVariants({ ...deck, entries: deck.entries.map(entry => {
    const card = byId.get(entry.id);
    if (!card) return entry;
    const variants = Object.fromEntries(deckEntryVariants({ ...entry, variants: undefined }, card).map(row => [row.quality, row.count]));
    return { ...entry, variants };
  }) }, cards);
}

export function deckCollectionCards(deck, cards, retainedIds = []) {
  const byId = new Map(cards.map(c => [c.dbfId, c]));
  const entries = new Map(deck.entries.map(entry => [entry.id, entry]));
  for (const id of retainedIds) if (!entries.has(id)) entries.set(id, { id, count: 0, variants: {} });
  return [...entries.values()].flatMap(entry => {
    const card = byId.get(entry.id);
    if (!card) return [];
    const assigned = new Map(deckEntryVariants(entry, card).map(row => [row.quality, row]));
    const retainedOnly = entry.count === 0;
    if (retainedOnly && !DECK_QUALITY_DISPLAY_ORDER.some(quality => assigned.has(quality) || ownedCount(card, quality) > 0)) assigned.set('normal', { quality: 'normal', count: 0, missing: 0 });
    return DECK_QUALITY_DISPLAY_ORDER.filter(quality => assigned.has(quality) || ownedCount(card, quality) > 0).map(quality => {
      const row = assigned.get(quality);
      const deckCount = row?.count || 0;
      return { ...card, displayQuality: quality, deckCount,
        deckMissing: Math.max(0, deckCount - ownedCount(card, quality)) };
    });
  }).sort((a, b) => Number(b.deckMissing > 0) - Number(a.deckMissing > 0)
    || (a.cost || 0) - (b.cost || 0) || a.name.localeCompare(b.name, 'zh-CN') || a.dbfId - b.dbfId);
}

export function removeDeckCard(deck, id, quality, card) {
  const ownerId = deckCompanionOwner(id);
  const removeIds = new Set(ownerId ? [ownerId, ...DECK_RULES[ownerId].includedCards.map(item => item.id)]
    : [id, ...(DECK_RULES[id]?.includedCards || []).map(item => item.id)]);
  return { ...deck, entries: deck.entries.flatMap(entry => {
    if (!removeIds.has(entry.id)) return [entry];
    if (entry.id !== id || ownerId) return [];
    const variants = Object.fromEntries(deckEntryVariants(entry, card).map(row => [row.quality, row.count]));
    if (!variants[quality]) return [entry];
    if (!--variants[quality]) delete variants[quality];
    return entry.count > 1 ? [{ ...entry, count: entry.count - 1, variants }] : [];
  }) };
}
export function deckClass(deck, cards) {
  const heroClass = Object.keys(HEROES).find(key => HEROES[key] === deck?.hero) || cards.find(c => c.dbfId === deck?.hero)?.cardClass;
  if (heroClass && HEROES[heroClass]) return heroClass;
  const classes = new Set((deck?.entries || []).flatMap(entry => {
    const card = cards.find(item => item.dbfId === entry.id);
    return (card?.classes || [card?.cardClass]).filter(key => key && key !== 'NEUTRAL' && HEROES[key]);
  }));
  return classes.size === 1 ? [...classes][0] : '';
}
export function eligibleForDeck(card, heroClass) {
  return !!heroClass && (card.classes || [card.cardClass]).some(key => key === 'NEUTRAL' || key === heroClass);
}
export function addDeckCard(deck, card, heroClass) {
  if (!eligibleForDeck(card, heroClass)) throw new Error('只能添加当前职业或中立卡牌。');
  const previous = deck.entries.find(e => e.id === card.dbfId)?.count || 0;
  const existing = deck.entries.find(e => e.id === card.dbfId);
  const quality = card.displayQuality || DECK_QUALITIES.find(q => (card.counts?.[QUALITY_INDEX[q]] || 0) > 0) || 'normal';
  const variants = existing ? Object.fromEntries(deckEntryVariants(existing, card).map(row => [row.quality, row.count])) : {};
  const copyLimit = DECK_RULES[card.dbfId]?.maxCopies || requiredCopies(card);
  if (previous >= copyLimit) throw new Error(`${card.name}已达到可添加数量。`);
  variants[quality] = (variants[quality] || 0) + 1;
  let entries = previous
    ? deck.entries.map(e => e.id === card.dbfId ? { ...e, count: e.count + 1, variants } : e)
    : [...deck.entries, { id: card.dbfId, count: 1, variants }];
  for (const linked of DECK_RULES[card.dbfId]?.includedCards || []) {
    if (!entries.some(entry => entry.id === linked.id)) entries.push({ id: linked.id, count: linked.count });
  }
  const next = { ...deck, entries };
  if (effectiveDeckTotal(next) > deckLimit(next)) throw new Error(`套牌最多 ${deckLimit(next)} 张（按特殊构筑卡的实际牌库占位计算）。`);
  return inheritCompanionVariants(next, [card]);
}

export function deckLimit(deck) {
  if (deck.format === 3) return 30;
  return deck.entries.some(entry => DECK_RULES[entry.id]?.capacity === 40) ? 40 : 30;
}
export function effectiveEntryCount(entry) {
  const rule = DECK_RULES[entry.id];
  return rule?.deckCopies ? entry.count * rule.deckCopies : entry.count;
}
export function effectiveDeckTotal(deck) {
  return deck.entries.reduce((sum, entry) => sum + effectiveEntryCount(entry), 0);
}
export function sideboardRule(ownerId) { return DECK_RULES[ownerId]?.sideboardSize ? DECK_RULES[ownerId] : null; }
export function addSideboardCard(deck, ownerId, card) {
  const rule = sideboardRule(ownerId);
  if (!rule || !deck.entries.some(entry => entry.id === ownerId)) throw new Error('这张卡没有可配置的备选牌。');
  if (rule.sideboardRace && !(card.races || []).includes(rule.sideboardRace) && card.race !== rule.sideboardRace) throw new Error('下水道之王的备选牌必须是野兽。');
  const sideboards = [...(deck.sideboards || [])];
  const owned = sideboards.filter(item => item.ownerId === ownerId);
  if (owned.length >= rule.sideboardSize) throw new Error(`这张卡最多选择 ${rule.sideboardSize} 张备选牌。`);
  if (owned.some(item => item.id === card.dbfId)) throw new Error('同一张牌不能重复作为备选牌。');
  return { ...deck, sideboards: [...sideboards, { id: card.dbfId, count: 1, ownerId }] };
}
export function removeSideboardCard(deck, id, ownerId) {
  return { ...deck, sideboards: (deck.sideboards || []).filter(item => !(item.id === id && item.ownerId === ownerId)) };
}

export function parseDeckFile(text, cards) {
  let raw;
  try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('文件不是有效的 JSON。'); }
  const decks = Array.isArray(raw) ? raw : Array.isArray(raw?.decks) ? raw.decks : [raw];
  if (!decks.length || decks.length > 100) throw new Error('请选择包含 1–100 套套牌的文件。');
  const byId = new Map(cards.map(c => [c.dbfId, c]));
  return decks.map(deck => {
    if (!deck || typeof deck.name !== 'string' || !deck.name.trim() || deck.name.trim().length > 80) throw new Error('套牌名称必须为 1–80 字。');
    let entries = deck.entries;
    // Older exports store one object per card copy, including repeated IDs.
    if (!entries && Array.isArray(deck.cards)) {
      const counts = new Map();
      for (const card of deck.cards) {
        if (!card || !Number.isSafeInteger(card.id) || card.id <= 0) throw new Error('旧套牌文件包含无效卡牌 ID。');
        const entry = counts.get(card.id) || { id: card.id, count: 0, variants: {} };
        const quality = card.status === 'gold' ? 'golden' : card.status === 'none' || !card.status ? 'normal' : card.status;
        if (!DECK_QUALITIES.includes(quality)) throw new Error(`无法识别卡牌品质：${card.status}`);
        entry.count++; entry.variants[quality] = (entry.variants[quality] || 0) + 1;
        counts.set(card.id, entry);
      }
      entries = [...counts.values()];
    }
    if (!Array.isArray(entries) || entries.length > 100 || new Set(entries.map(e => e?.id)).size !== entries.length || entries.some(e => !Number.isSafeInteger(e?.id) || e.id <= 0 || !Number.isSafeInteger(e.count) || e.count < 1 || e.count > 40) || entries.reduce((sum,e) => sum+e.count,0) > 100) throw new Error('文件中的卡牌 ID 或数量无效。');
    const classes = new Set(entries.flatMap(e => {
      const c = byId.get(e.id); return c ? (c.classes || [c.cardClass]).filter(k => k !== 'NEUTRAL' && HEROES[k]) : [];
    }));
    const declaredClass = CLASSES.find(([key, name, slug]) => [key, name, slug].includes(deck.heroClass))?.[0];
    const hero = deck.hero ?? HEROES[declaredClass] ?? (classes.size === 1 ? HEROES[[...classes][0]] : undefined);
    if (!Number.isSafeInteger(hero) || hero <= 0) throw new Error(`无法确定「${deck.name}」的职业，请使用含英雄信息的 JSON 或卡组代码。`);
    const format = deck.format ?? 1;
    if (!FORMATS[format] || typeof format !== 'number') throw new Error('套牌模式无效。');
    for (const entry of entries) {
      if (entry.variants !== undefined && (!entry.variants || typeof entry.variants !== 'object' || Array.isArray(entry.variants)
        || Object.entries(entry.variants).some(([q, n]) => !DECK_QUALITIES.includes(q) || !Number.isSafeInteger(n) || n < 1)
        || Object.values(entry.variants).reduce((n, count) => n + count, 0) !== entry.count)) throw new Error('套牌品质数量必须与卡牌数量一致。');
    }
    const sideboards = deck.sideboards ?? [];
    if (!Array.isArray(sideboards) || sideboards.length > 30 || sideboards.some(item => !item || !Number.isSafeInteger(item.id) || item.id <= 0 || !Number.isSafeInteger(item.ownerId) || item.ownerId <= 0 || !Number.isSafeInteger(item.count) || item.count < 1 || item.count > 40)) throw new Error('备选牌数据无效。');
    for (const item of sideboards) {
      const rule = sideboardRule(item.ownerId);
      if (!rule || !entries.some(entry => entry.id === item.ownerId)) throw new Error('备选牌缺少对应的构筑卡。');
      const choice = byId.get(item.id);
      if (rule.sideboardRace && choice && !(choice.races || []).includes(rule.sideboardRace) && choice.race !== rule.sideboardRace) throw new Error('下水道之王的备选牌必须是野兽。');
      if (sideboards.filter(row => row.ownerId === item.ownerId).length > rule.sideboardSize) throw new Error(`该构筑卡最多选择 ${rule.sideboardSize} 张备选牌。`);
      if (sideboards.some(row => row !== item && row.ownerId === item.ownerId && row.id === item.id)) throw new Error('备选牌不能重复。');
    }
    return { name: deck.name.trim(), hero, format, entries: entries.map(({id, count, variants}) => ({ id, count, ...(variants ? { variants: { ...variants } } : {}) })), ...(sideboards.length ? { sideboards } : {}) };
  });
}
export function decodeDeck(text) {
  // Shared deck text often contains Hearthstone log timestamps, localized
  // headings, Deck IDs, and the code on the same line. Find the actual
  // base64 payload first; metadata must never be mistaken for the code.
  const source = String(text ?? '');
  const candidates = source.match(/[A-Za-z0-9+/]{16,}={0,2}/g) || [];
  const code = candidates.find(value => value.startsWith('AAE'))
    || candidates.find(value => value.length >= 24);
  if (!code || code.length > 16000) throw new Error('请粘贴有效的炉石卡组代码。');
  let bytes;
  try { bytes = Uint8Array.from(atob(code), c => c.charCodeAt(0)); } catch { throw new Error('卡组代码不是有效的 Base64。'); }
  let cursor = 0;
  function read() {
    let value = 0, shift = 0;
    for (let i = 0; i < 5; i++) {
      if (cursor >= bytes.length) throw new Error('卡组代码不完整。');
      const b = bytes[cursor++]; value += (b & 127) * 2 ** shift;
      if (!(b & 128)) return value;
      shift += 7;
    }
    throw new Error('卡组代码数值无效。');
  }
  if (read() !== 0 || read() !== 1) throw new Error('不支持此卡组代码版本。');
  const format = read();
  if (!FORMATS[format] || read() !== 1) throw new Error('不支持此模式或英雄数量。');
  const hero = read(), entries = [], seen = new Set();
  for (let group = 1; group <= 3; group++) {
    const size = read();
    if (size > 100) throw new Error('卡牌数量超出限制。');
    for (let i = 0; i < size; i++) {
      const id = read(), count = group === 3 ? read() : group;
      if (!id || !count || count > 40 || seen.has(id)) throw new Error('卡牌 ID 或数量无效。');
      seen.add(id); entries.push({ id, count });
    }
  }
  const sideboards = [];
  if (cursor < bytes.length) {
    const hasSideboards = read();
    if (hasSideboards > 1) throw new Error('卡组备选牌标记无效。');
    if (hasSideboards) {
      for (let group = 1; group <= 3; group++) {
        const size = read();
        if (size > 30 || sideboards.length + size > 30) throw new Error('备选牌数量超出限制。');
        for (let i = 0; i < size; i++) {
          const id = read(), count = group === 3 ? read() : group, ownerId = read();
          if (!id || !ownerId || !count || count > 40) throw new Error('备选牌数据无效。');
          sideboards.push({ id, count, ownerId });
        }
      }
    }
    if (cursor !== bytes.length) throw new Error('卡组代码包含无法识别的扩展数据。');
  }
  if (!entries.length || entries.reduce((n, e) => n + e.count, 0) > 100) throw new Error('卡组为空或超过 100 张。');
  const headerLines = source.split(/\r?\n/).map(line => line
    .replace(/^\s*[A-Z]\s+\d{2}:\d{2}:\d{2}\.\d+\s*/, '')
    .replace(/^\s*\[[^\]]*\]\s*/, '').trim());
  const cleanLabel = value => value?.replace(/^#+\s*/, '')
    .replace(/^(?:卡组名称|套牌名称|Deck\s*Name)\s*[:：]\s*/i, '')
    .replace(/\s*(?:\|?\s*(?:Deck\s*ID|卡组\s*ID)\s*[:：#].*)$/i, '')
    .trim().slice(0, 80);
  const namedHeader = headerLines.find(line => /^#{1,6}\s*\S/.test(line));
  const labeledName = headerLines.find(line => /^(?:卡组名称|套牌名称|Deck\s*Name)\s*[:：]\s*\S/i.test(line));
  const name = cleanLabel(namedHeader || labeledName?.replace(/^(?:卡组名称|套牌名称|Deck\s*Name)\s*[:：]\s*/i, ''));
  const skinLine = headerLines.find(line => /^(?:英雄皮肤|皮肤|Hero\s*Skin|Skin)\s*[:：]\s*\S/i.test(line));
  const heroSkin = skinLine?.replace(/^(?:英雄皮肤|皮肤|Hero\s*Skin|Skin)\s*[:：]\s*/i, '').trim().slice(0, 80);
  return { name: name || '导入的套牌', ...(heroSkin ? { heroSkin } : {}), format, hero, entries, ...(sideboards.length ? { sideboards } : {}) };
}
export function encodeDeck(deck) {
  const bytes = [];
  function write(n) { do { const b = n % 128; n = Math.floor(n / 128); bytes.push(b | (n ? 128 : 0)); } while (n); }
  [0, 1, deck.format, 1, deck.hero].forEach(write);
  for (let group = 1; group <= 3; group++) {
    const entries = deck.entries.filter(e => group === 3 ? e.count > 2 : e.count === group).sort((a, b) => a.id - b.id);
    write(entries.length); entries.forEach(e => { write(e.id); if (group === 3) write(e.count); });
  }
  const sideboards = deck.sideboards || [];
  write(sideboards.length ? 1 : 0);
  if (sideboards.length) {
    for (let group = 1; group <= 3; group++) {
      const entries = sideboards.filter(item => item.count === group || (group === 3 && item.count > 2))
        .sort((a, b) => a.ownerId - b.ownerId || a.id - b.id);
      write(entries.length);
      entries.forEach(item => { write(item.id); if (group === 3) write(item.count); write(item.ownerId); });
    }
  }
  return btoa(String.fromCharCode(...bytes));
}
export function deckStats(deck, catalog) {
  const byId = new Map(catalog.map(c => [c.dbfId, c]));
  const limit = deckLimit(deck);
  const result = { total: 0, owned: 0, limit, remaining: 0, overLimit: 0, copyViolations: [], qualityMissing: 0, missing: 0, dust: 0, fullDust: 0, missingCards: [], goldenCards: [], goldenCraftCards: [], unknown: 0, curve: Array(8).fill(0) };
  for (const entry of deck.entries) {
    const card = byId.get(entry.id); const effectiveCount = effectiveEntryCount(entry); result.total += effectiveCount;
    if (isDeckCompanion(entry.id)) {
      const ownerId = deckCompanionOwner(entry.id);
      const owner = deck.entries.find(item => item.id === ownerId);
      const suppliedCopies = DECK_RULES[ownerId].includedCards.find(item => item.id === entry.id).count;
      const ownerCard = byId.get(ownerId);
      const ownedOwners = owner && ownerCard?.counts ? Math.min(owner.count, ownedCount(ownerCard)) : 0;
      result.owned += Math.min(effectiveCount, ownedOwners * suppliedCopies);
      if (card) result.curve[Math.min(7, card.cost || 0)] += effectiveCount;
      continue;
    }
    if (!card) {
      result.unknown += entry.count;
      result.missing += entry.count;
      const unknown = { id: entry.id, name: `未知卡牌 #${entry.id}`, count: entry.count, owned: 0, goldenOwned: 0, missing: entry.count, unknown: true, craftable: false };
      result.missingCards.push(unknown); result.goldenCraftCards.push({ ...unknown, dust: 0 });
      continue;
    }
    const copyLimit = DECK_RULES[entry.id]?.maxCopies || requiredCopies(card);
    if (entry.count > copyLimit) result.copyViolations.push({ id: entry.id, name: card.name, count: entry.count, limit: copyLimit });
    result.qualityMissing += deckEntryVariants(entry, card).reduce((sum, row) => sum + row.missing, 0);
    const missing = Math.max(0, entry.count - ownedCount(card));
    result.owned += effectiveEntryCount({ ...entry, count: Math.min(entry.count, ownedCount(card)) });
    const craftable = card.set !== 'CORE';
    const normalDust = craftable ? DUST[card.rarity] || 0 : 0;
    const goldenDust = craftable ? GOLDEN_DUST[card.rarity] || 0 : 0;
    const goldenOrBetterOwned = (card.counts?.[1] || 0) + (card.counts?.[2] || 0) + (card.counts?.[3] || 0);
    const goldenMissing = Math.max(0, entry.count - goldenOrBetterOwned);
    const upgradeableGolden = Math.min(goldenMissing, card.counts?.[0] || 0);
    const newlyCraftedGolden = goldenMissing - upgradeableGolden;
    const gildingDust = upgradeableGolden * Math.max(0, goldenDust - normalDust);
    const craftingGoldenDust = newlyCraftedGolden * goldenDust;
    const goldenDustCost = gildingDust + craftingGoldenDust;
    result.missing += missing; result.dust += missing * normalDust; result.fullDust += goldenDustCost;
    const breakdown = { id: entry.id, name: card.name, card, count: entry.count, owned: ownedCount(card), goldenOwned: card.counts?.[1] || 0, craftable: normalDust > 0 };
    if (missing) result.missingCards.push({ ...breakdown, missing, dust: missing * normalDust });
    if (upgradeableGolden) result.goldenCards.push({ ...breakdown, missing: upgradeableGolden, dust: gildingDust });
    if (newlyCraftedGolden) result.goldenCraftCards.push({ ...breakdown, missing: newlyCraftedGolden, dust: craftingGoldenDust });
    result.curve[Math.min(7, card.cost || 0)] += effectiveCount;
  }
  result.remaining = Math.max(0, limit - result.total);
  result.overLimit = Math.max(0, result.total - limit);
  result.owned = Math.min(limit, result.owned);
  return result;
}

