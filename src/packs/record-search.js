const groups = [
  [['异画传说', '异化传说', '异画橙卡', '异化橙卡', '异画', '异化'], ['signature']],
  [['金色传说', '金色橙卡', '金橙卡', '金橙'], ['goldLegendary']],
  [['金色史诗', '金色紫卡', '金紫卡', '金紫'], ['goldEpic']],
  [['金色稀有', '金色蓝卡', '金蓝卡', '金蓝'], ['goldRare']],
  [['金色普通', '金色白卡', '金白卡', '金白'], ['goldCommon']],
  [['普通传说', '普通橙卡'], ['legendary']],
  [['普通史诗', '普通紫卡'], ['epic']],
  [['普通稀有', '普通蓝卡'], ['rare']],
  [['传说', '橙卡'], ['legendary', 'goldLegendary', 'signature']],
  [['史诗', '紫卡'], ['epic', 'goldEpic']],
  [['稀有', '蓝卡'], ['rare', 'goldRare']],
  [['普通', '白卡'], ['common', 'goldCommon']],
  [['金色', '金卡'], ['goldCommon', 'goldRare', 'goldEpic', 'goldLegendary']],
];
const aliases = new Map(groups.flatMap(([names, keys]) => names.map(name => [name, keys])));

export function matchesRecordSearch(record, query) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const text = `${record.set || ''} ${record.source || ''} ${record.note || ''}`.toLocaleLowerCase();
  return terms.every(term => {
    const keys = aliases.get(term);
    return keys ? keys.some(key => Number(record.qualities?.[key] || 0) > 0) : text.includes(term.toLocaleLowerCase());
  });
}

