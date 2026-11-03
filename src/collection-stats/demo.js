// Illustrative UI fixtures only. Never merge these counts into user collection data.
export const RARITIES = [
  { key: 'common', name: '普通', color: '#807b69' },
  { key: 'rare', name: '稀有', color: '#397da1' },
  { key: 'epic', name: '史诗', color: '#8d5aa0' },
  { key: 'legendary', name: '传说', color: '#ba792a' },
];

const fixtures = [
  ['time', '穿越时间流', 'standard', [68, 47, 18, 16], [14, 8, 4, 3]],
  ['city', '安戈洛龟途', 'standard', [72, 51, 23, 21], [21, 12, 6, 5]],
  ['dream', '漫游翡翠梦境', 'standard', [72, 54, 25, 23], [27, 16, 8, 6]],
  ['space', '深暗领域', 'wild', [72, 52, 24, 22], [32, 20, 9, 8]],
  ['island', '胜地历险记', 'wild', [72, 54, 27, 25], [38, 24, 12, 10]],
  ['workshop', '威兹班的工坊', 'wild', [72, 54, 27, 27], [43, 29, 15, 12]],
];

export const DEMO_SETS = fixtures.map(([id, name, format, normal, golden], index) => ({
  id, name, format,
  rarities: RARITIES.map((rarity, i) => {
    const total = [72, 54, 27, 27][i];
    // A golden version may cover a type missing from the normal collection.
    const any = Math.min(total, normal[i] + (index < 4 ? [0, 1, 1, 2][i] : 0));
    return { ...rarity, total, normal: normal[i], golden: golden[i], any };
  }),
}));

export const sum = (rows, key) => rows.reduce((value, row) => value + row[key], 0);
export const completion = (owned, total) => total ? Math.round(owned / total * 1000) / 10 : 0;
export const number = value => value.toLocaleString('zh-CN');
