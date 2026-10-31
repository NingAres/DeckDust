// Disposable UI fixtures. These never read or write the user's pack history.
export const PACK_SETS = ['安戈洛龟途', '穿越时间流', '黑暗帝国的统治', '漫游翡翠梦境'];
export const PACK_TYPES = { normal: '普通卡包', gold: '金色卡包', variant_gold: '异画金色卡包' };
export const QUALITY_FIELDS = [
  ['common', '普通', 5], ['rare', '稀有', 20], ['epic', '史诗', 100], ['legendary', '传说', 400],
  ['goldCommon', '金色普通', 40], ['goldRare', '金色稀有', 100], ['goldEpic', '金色史诗', 400], ['goldLegendary', '金色传说', 1600], ['signature', '异画传说', 1600],
];
export const QUALITY_SHORT_NAMES = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说', goldCommon: '金白', goldRare: '金蓝', goldEpic: '金紫', goldLegendary: '金橙', signature: '异画传说' };
function withPremium(record, premium) {
  const added = Object.values(premium).reduce((sum, count) => sum + count, 0);
  return { ...record, qualities: { ...record.qualities, ...premium, common: record.qualities.common - added } };
}
export function makeRecord(id, set, date, count, rare, epic, legendary, goldRare = 0, source = '日志识别') {
  return { id, set, date, count, type: 'normal', source,
    qualities: { common: count * 5 - rare - epic - legendary - goldRare, rare, epic, legendary, goldRare },
  };
}
export const DEMO_RECORDS = [
  makeRecord('r1', PACK_SETS[0], '2026-10-26T20:42', 1, 1, 0, 1),
  makeRecord('r2', PACK_SETS[0], '2026-10-26T20:40', 5, 6, 1, 0),
  withPremium(makeRecord('r3', PACK_SETS[0], '2026-10-26T20:35', 10, 11, 2, 0, 1, '手动录入'), { goldCommon: 2, goldEpic: 1, goldLegendary: 1, signature: 1 }),
  makeRecord('r4', PACK_SETS[1], '2026-10-26T19:18', 10, 11, 3, 2),
  withPremium(makeRecord('r5', PACK_SETS[0], '2026-10-25T21:06', 20, 22, 4, 3, 2), { goldCommon: 3, goldEpic: 1, goldLegendary: 1 }),
  makeRecord('r6', PACK_SETS[2], '2026-10-25T20:25', 20, 23, 5, 2, 1, '手动录入'),
  makeRecord('r7', PACK_SETS[1], '2026-10-23T18:12', 15, 16, 3, 1, 2),
  makeRecord('r8', PACK_SETS[3], '2026-10-20T21:32', 30, 34, 7, 2, 3, '手动录入'),
  makeRecord('r9', PACK_SETS[0], '2026-10-18T19:16', 17, 18, 4, 1, 1),
  { id: 'r10', set: PACK_SETS[2], type: 'gold', date: '2026-10-26T18:20', count: 1, qualities: { goldCommon: 3, goldRare: 1, goldLegendary: 1 }, source: '日志识别' },
  { id: 'r11', set: PACK_SETS[1], type: 'variant_gold', date: '2026-10-24T17:30', count: 1, qualities: { goldCommon: 3, goldRare: 1, signature: 1 }, source: '日志识别' },
  makeRecord('r12', PACK_SETS[0], '2026-10-26T20:48', 2, 2, 0, 0),
  makeRecord('r13', PACK_SETS[0], '2026-10-26T20:52', 1, 1, 0, 0),
].map(record => ['r1', 'r4', 'r5', 'r7', 'r10', 'r11', 'r12', 'r13'].includes(record.id) ? { ...record, demoCardDetails: true } : record);
export function summarize(records) {
  const result = { count: 0, dust: 0, qualities: {} };
  for (const record of records) {
    result.count += record.count;
    for (const [key, , dust] of QUALITY_FIELDS) {
      const quantity = record.qualities[key] || 0;
      result.qualities[key] = (result.qualities[key] || 0) + quantity;
      result.dust += quantity * dust;
    }
  }
  result.legendary = (result.qualities.legendary || 0) + (result.qualities.goldLegendary || 0) + (result.qualities.signature || 0);
  result.epic = (result.qualities.epic || 0) + (result.qualities.goldEpic || 0);
  // Match the source calculator's current estimates, including integer truncation.
  result.average = result.count ? Math.floor(result.dust / result.count).toFixed(1) : '0.0';
  result.epicRatio = result.count ? result.epic / (result.count * 5) : 0;
  result.legendaryRatio = result.count ? result.legendary / (result.count * 5) : 0;
  return result;
}

export function groupCycles(records) {
  const open = new Map(), cycles = [];
  for (const record of [...records].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    const key = JSON.stringify([record.set, record.type]);
    let cycle = open.get(key);
    if (!cycle) {
      cycle = { id: `cycle-${record.id}`, set: record.set, type: record.type, records: [], date: record.date, start: record.date, closed: false };
      open.set(key, cycle); cycles.push(cycle);
    }
    cycle.records.push(record); cycle.date = record.date;
    if (summarize([record]).legendary > 0) { cycle.closed = true; open.delete(key); }
  }
  return cycles.map(cycle => ({ ...cycle, ...summarize(cycle.records) })).sort((a, b) => b.date.localeCompare(a.date));
}
export function overviewRows(records) {
  const groups = new Map();
  for (const record of records) {
    const key = JSON.stringify([record.set, record.type]);
    if (!groups.has(key)) groups.set(key, { key, set: record.set, type: record.type, records: [] });
    groups.get(key).records.push(record);
  }
  return [...groups.values()].map(group => ({ ...group, ...summarize(group.records) }));
}
// Source project's configured limits, shown as preview rules pending real integration.
export const PREVIEW_PITY_RULES = {
  normal: [['epic', 10, ['epic', 'goldEpic']], ['legendary', 40, ['legendary']], ['goldLegendary', 361, ['goldLegendary']], ['signature', 361, ['signature']]],
  gold: [['goldLegendary', 40, ['goldLegendary']], ['signature', 40, ['signature']]],
  variant_gold: [['goldLegendary', 40, ['goldLegendary']], ['signature', 14, ['signature']]],
};
export function pityPreview(records, set, type) {
  const ordered = records.filter(record => record.set === set && record.type === type).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return (PREVIEW_PITY_RULES[type] || []).map(([quality, total, keys]) => {
    let since = 0;
    for (const record of ordered) {
      const packs = record.cardPacks?.length
        ? [...record.cardPacks].sort((a, b) => b.date.localeCompare(a.date) || b.version.localeCompare(a.version, undefined, { numeric: true }) || b.id.localeCompare(a.id))
        : null;
      if (packs) {
        let hit = false;
        for (const pack of packs) {
          if (pack.cards.some(card => keys.includes(card.qualityKey))) { hit = true; break; }
          since += 1;
        }
        if (hit) break;
      } else {
        if (keys.some(key => record.qualities[key] > 0)) break;
        since += record.count;
      }
    }
    return { quality, total, since, left: Math.max(0, total - since) };
  });
}
export function previewCards(catalog, seed = 0) {
  const rarities = ['COMMON', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
  return rarities.map((rarity, index) => {
    const candidates = catalog.filter(card => card.rarity === rarity && card.set === 'THE_LOST_CITY');
    const fallback = candidates.length ? candidates : catalog.filter(card => card.rarity === rarity);
    return fallback[(seed + index * 3) % fallback.length] || { id: `preview-${index}`, name: ['林间访客', '远古守卫', '探险补给', '丛林回响', '远征领袖'][index], rarity };
  });
}

