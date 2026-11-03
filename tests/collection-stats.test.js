import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCollection, progress } from '../src/collection/model.js';
import { buildCollectionSets, ownedKey, raritySegments, setsForMode, sum } from '../src/collection-stats/model.js';

const catalog = Array.from({ length: 27 }, (_, i) => ({ dbfId: i + 1, id: `CARD_${i}`, name: `Card ${i}`, set: 'BE', rarity: 'LEGENDARY' }));
const slots = [[1, 1, 0, 0], [2, 0, 0, 0], [0, 2, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1],
  [1, 0, 1, 1], [1, 0, 0, 0], [0, 1, 1, 1], [0, 0, 0, 1, 99], [0, 0, 0, 0, 99]];
const collection = Object.fromEntries(slots.map((counts, i) => [String(i + 1), counts]));
const attached = attachCollection(catalog, collection);
const legendary = sets => sets.find(set => set.id === 'BE').rarities.find(row => row.key === 'legendary');

test('27 legendary catalogue types with 9 owned identities display 9/27, matching My Collection', () => {
  const sets = buildCollectionSets(attached), row = legendary(sets);
  assert.equal(row.total, 27);
  assert.equal(row.any, 9);
  assert.equal(row.any, progress(attached).ownedTypes);
  assert.equal(row.total, progress(attached).types);
});

test('multiple copies and premium finishes never inflate types, and extra imported slots are ignored', () => {
  const row = legendary(buildCollectionSets([...attached, attached[0], { ...attached[1], dbfId: '2' }]));
  assert.equal(row.total, 27);
  assert.equal(row.any, 9);
  assert.equal(row.normal, 4);
  assert.equal(row.goldenOnly, 3);
  assert.equal(row.diamond, 3);
  assert.equal(row.signature, 4);
  assert.equal(row.golden, 7);
});

test('real per-set denominators include FREE cards and zero-owned cards', () => {
  const cards = attachCollection([
    { dbfId: 101, set: 'CORE', rarity: 'FREE' }, { dbfId: 102, set: 'CORE', rarity: 'FREE' },
    { dbfId: 103, set: 'CORE', rarity: 'COMMON' }, { dbfId: 104, set: 'NAXX', rarity: 'EPIC' },
  ], { 101: [2, 0, 0, 0], 103: [0, 1, 0, 0], 104: [0, 0, 1, 0] });
  const sets = buildCollectionSets(cards), core = sets.find(set => set.id === 'CORE');
  assert.equal(sum(core.rarities, 'total'), 3);
  assert.equal(sum(core.rarities, 'any'), 2);
  assert.equal(core.rarities.find(row => row.key === 'free').total, 2);
  assert.equal(sum(sets.flatMap(set => set.rarities), 'total'), progress(cards).types);
  assert.equal(sum(sets.flatMap(set => set.rarities), 'any'), progress(cards).ownedTypes);
  const epic = sets.find(set => set.id === 'NAXX').rarities.find(row => row.key === 'epic');
  assert.equal(epic.any, 1);
  assert.equal(epic.golden, 0); // The requested diamond/signature grouping is legendary-only.
});

test('series and mode lists derive from loaded catalogue rather than fabricated entries', () => {
  const cards = attachCollection(['CORE', 'BE', 'NAXX', 'EVENT'].map((set, i) => ({ dbfId: i + 1, set, rarity: 'COMMON' })), {});
  const sets = buildCollectionSets(cards);
  assert.deepEqual(sets.map(set => set.id), ['BE', 'NAXX', 'CORE', 'EVENT']);
  assert.deepEqual(setsForMode(sets, 'standard').map(set => set.id), ['BE', 'CORE']);
  assert.deepEqual(setsForMode(sets, 'wild').map(set => set.id), ['BE', 'NAXX', 'CORE']);
  assert.equal(setsForMode(sets, 'all').length, 4);
  assert.deepEqual(buildCollectionSets([]), []);
});

test('recomputation follows a new snapshot without changing catalogue denominators', () => {
  const before = legendary(buildCollectionSets(attached));
  const after = legendary(buildCollectionSets(attachCollection(catalog, { ...collection, 27: [0, 1, 0, 0] })));
  assert.equal(before.any, 9);
  assert.equal(after.any, 10);
  assert.equal(after.total, before.total);
  assert.equal(after.golden, before.golden + 1);
});

test('an empty but valid collection reports zero owned against the real catalogue', () => {
  const row = legendary(buildCollectionSets(attachCollection(catalog, {})));
  assert.equal(row.total, 27);
  assert.equal(row.any, 0);
  assert.equal(row.normal, 0);
  assert.equal(row.golden, 0);
});

test('mixed segments partition the real union with gold precedence, without overlap', () => {
  assert.equal(ownedKey('mixed'), 'any');
  for (const set of buildCollectionSets(attached)) for (const row of set.rarities) {
    const parts = raritySegments(row, 'mixed');
    assert.equal(parts.reduce((n, part) => n + part.value, 0), row.any);
    assert.ok(parts.every(part => part.value >= 0));
  }
  const row = legendary(buildCollectionSets(attached));
  assert.deepEqual(raritySegments(row, 'mixed').map(part => part.value), [2, 7]);
});
