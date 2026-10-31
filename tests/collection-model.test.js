import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCollection, bestQuality, expandQualityCards, ownedCount, filterAndSort, scopeCards, progress, DEFAULT_FILTERS, validateImport } from '../src/collection/model.js';
import { compareSetsByRelease } from '../src/collection/set-order.js';

test('expansions follow newest release order, with evergreen sets after expansions', () => {
  const sets = ['CORE', 'TGT', 'CATACLYSM', 'BE', 'ESCAPEFROM_VIOLET_HOLD', 'EXPERT1'];
  assert.deepEqual(sets.sort(compareSetsByRelease), ['BE', 'ESCAPEFROM_VIOLET_HOLD', 'CATACLYSM', 'TGT', 'EXPERT1', 'CORE']);
});

test('missing thresholds combine four qualities unless one quality is selected', () => {
  const cards = attachCollection([{ dbfId: 7, id: 'CARD', name: '示例', rarity: 'COMMON' }], { '7': [0, 1, 1, 0, 99] });
  const filters = { ...DEFAULT_FILTERS, ownership: 'missing', threshold: '2' };
  assert.equal(filterAndSort(cards, filters).length, 0);
  assert.equal(filterAndSort(cards, { ...filters, quality: 'golden' }).length, 1);
  assert.equal(progress(cards).copies, 2);
  assert.equal(progress(cards, 'golden').copies, 1);
});

test('card art prefers the highest owned quality, including diamond ETC', () => {
  assert.equal(bestQuality({ counts: [1, 1, 1, 0, 0, 0, 0, 0] }), 'diamond');
  assert.equal(bestQuality({ counts: [2, 2, 0, 1] }), 'signature');
  assert.equal(bestQuality({ counts: [2, 1, 0, 0] }), 'golden');
  assert.equal(bestQuality({ counts: [0, 0, 0, 0] }), 'normal');
});

test('collection displays each owned quality separately with its own quantity', () => {
  const cards = attachCollection([{ dbfId: 7, name: '示例' }], { '7': [1, 0, 1, 1] });
  const rows = expandQualityCards(cards);
  assert.deepEqual(rows.map(card => [card.displayQuality, ownedCount(card, card.displayQuality)]),
    [['normal', 1], ['diamond', 1], ['signature', 1]]);
  assert.equal(progress(cards).types, 1);
  assert.equal(cards[0].displayQuality, undefined);
});

test('quality filter selects one version and unowned cards appear once', () => {
  const cards = attachCollection([{ dbfId: 7, name: '示例' }], { '7': [2, 1, 1, 0] });
  const rows = expandQualityCards(cards, 'golden');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].displayQuality, 'golden');
  assert.equal(ownedCount(rows[0], rows[0].displayQuality), 1);
  const empty = attachCollection([{ dbfId: 8, name: '未拥有' }], {});
  assert.deepEqual(expandQualityCards(empty).map(card => card.displayQuality), ['normal']);
  assert.deepEqual(expandQualityCards(empty, 'diamond').map(card => card.displayQuality), ['diamond']);
});

test('quality expansion follows combined missing thresholds and precedes pagination', () => {
  const cards = attachCollection(Array.from({ length: 4 }, (_, index) => ({ dbfId: index + 1, id: `C${index}`, name: '示例', rarity: 'COMMON' })),
    { '1': [1, 1, 1, 0], '2': [1, 1, 1, 0], '3': [1, 1, 1, 0], '4': [1, 1, 1, 0] });
  assert.equal(expandQualityCards(filterAndSort(cards, { ...DEFAULT_FILTERS, ownership: 'missing', threshold: '2' })).length, 0);
  const rows = expandQualityCards(filterAndSort(cards, DEFAULT_FILTERS));
  assert.equal(rows.length, 12);
  assert.equal(rows.slice(0, 10).length, 10);
  assert.equal(rows.slice(10).length, 2);
  assert.equal(new Set(rows.map(card => `${card.dbfId}-${card.displayQuality}`)).size, 12);
});

test('completion caps duplicate copies and uses one copy for legendary cards', () => {
  const cards = attachCollection([
    { dbfId: 1, id: 'A', name: '传说', rarity: 'LEGENDARY' },
    { dbfId: 2, id: 'B', name: '普通', rarity: 'COMMON' },
  ], { '1': [1, 4, 0, 0], '2': [5, 0, 0, 0] });
  const result = progress(cards);
  assert.equal(result.percent, 100);
  assert.equal(result.needed, 3);
  assert.equal(result.copies, 3);
  assert.equal(result.missing, 0);
});

test('class, set, rarity, cost, text and type filters compose for multiclass cards', () => {
  const cards = attachCollection([
    { dbfId: 7, id: 'A', name: '双职业', classes: ['MAGE', 'ROGUE'], cost: 7, text: '<b>战吼</b>：获得护甲', rarity: 'RARE', type: 'MINION', set: 'CORE' },
    { dbfId: 8, id: 'B', name: '其他', cardClass: 'ROGUE', cost: 1, rarity: 'COMMON', type: 'SPELL', set: 'CORE' },
  ], {});
  const filters = { ...DEFAULT_FILTERS, class: 'MAGE', set: 'CORE', rarity: 'RARE', mana: '7+', query: '战吼 护甲', type: 'MINION' };
  assert.deepEqual(scopeCards(cards, filters).map(card => card.dbfId), [7]);
});

test('core and free cards are excluded from missing dust estimates', () => {
  const cards = attachCollection([
    { dbfId: 1, id: 'A', name: '核心', rarity: 'LEGENDARY', set: 'CORE' },
    { dbfId: 2, id: 'B', name: '免费', rarity: 'FREE', set: 'LEGACY' },
    { dbfId: 3, id: 'C', name: '史诗', rarity: 'EPIC', set: 'TGT' },
  ], {});
  assert.equal(progress(cards).dust, 800);
});

test('preview rejects empty, negative, boolean and malformed collection data', () => {
  for (const raw of [{}, { collection: {} }, { collection: { '1': [-1] } }, { collection: { '1': [true] } }, { collection: { '1': [0] } }]) {
    assert.throws(() => validateImport(raw));
  }
  assert.deepEqual(validateImport({ collection: { '1': [0, 1, 0, 2] } }), { types: 1, ownedTypes: 1, copies: 3 });
});

