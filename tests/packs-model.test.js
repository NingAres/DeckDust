import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCycles, overviewRows, pityPreview, summarize, DEMO_RECORDS } from '../src/packs/demo.js';
import { recordedCards } from '../src/packs/recorded-cards.js';

const row = (id, date, count, qualities = {}, type = 'normal', set = '示例') => ({ id, date, count, qualities, type, set });

test('legendary closes its own type cycle including the closing entry, retaining original entries', () => {
  const records = [row('1', '2026-10-01', 3), row('2', '2026-10-02', 1, { goldLegendary: 1 }, 'gold'), row('3', '2026-10-03', 2), row('4', '2026-10-04', 1, { signature: 1 }), row('5', '2026-10-05', 4)];
  const before = JSON.stringify(records);
  const cycles = groupCycles(records);
  assert.equal(cycles.length, 3);
  assert.deepEqual(cycles.map(cycle => [cycle.type, cycle.count, cycle.closed]), [['normal', 4, false], ['normal', 6, true], ['gold', 1, true]]);
  assert.deepEqual(cycles[1].records.map(record => record.id), ['1', '3', '4']);
  assert.equal(JSON.stringify(records), before);
});

test('overview separates the same expansion by type and both rarity probabilities use total cards', () => {
  const records = [row('1', '2026-10-01', 2, { epic: 1, goldEpic: 1, legendary: 1 }), row('2', '2026-10-02', 1, { goldLegendary: 1 }, 'gold')];
  const rows = overviewRows(records);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].epicRatio, 2 / 10);
  assert.equal(rows[0].legendaryRatio, 1 / 10);
  assert.equal(rows[1].qualities.goldLegendary, 1);
  assert.equal(summarize([]).epicRatio, 0);
});

test('pity preview is independent for every expansion, type, and target quality', () => {
  const records = [row('1', '2026-10-01', 1, { legendary: 1, epic: 1 }), row('2', '2026-10-02', 3), row('3', '2026-10-03', 1, { goldLegendary: 1 }, 'gold'), row('4', '2026-10-04', 1, { legendary: 1 }, 'normal', '其他')];
  const normal = pityPreview(records, '示例', 'normal');
  assert.deepEqual(normal.find(item => item.quality === 'legendary'), { quality: 'legendary', total: 40, since: 3, left: 37 });
  assert.equal(normal.length, 4);
  assert.equal(pityPreview(records, '示例', 'gold').length, 2);
  assert.equal(pityPreview(records, '示例', 'variant_gold').find(item => item.quality === 'signature').total, 14);
});

test('all demo entries contain exactly five cards per pack, including each premium quality', () => {
  for (const record of DEMO_RECORDS) {
    assert.equal(Object.values(record.qualities).reduce((sum, count) => sum + count, 0), record.count * 5, record.id);
    assert.ok(Object.values(record.qualities).every(count => count >= 0));
  }
  for (const key of ['goldCommon', 'goldRare', 'goldEpic', 'goldLegendary', 'signature']) assert.ok(summarize(DEMO_RECORDS).qualities[key] > 0);
});

test('card previews require recorded detail and keep exact quality counts, including two or three legendaries', () => {
  const catalog = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].map((rarity, index) => ({ id: `card-${index}`, name: rarity, set: 'THE_LOST_CITY', rarity }));
  for (const [id, count] of [['r1', 1], ['r4', 2], ['r5', 3]]) {
    const record = DEMO_RECORDS.find(item => item.id === id);
    const details = recordedCards(record, catalog);
    assert.equal(details.filter(entry => entry.qualityKey === 'legendary').length, count);
    assert.equal(details.length, record.count * 5);
  }
  assert.deepEqual(recordedCards(DEMO_RECORDS.find(record => record.id === 'r3'), catalog), []);
  assert.deepEqual(recordedCards(DEMO_RECORDS.find(record => record.id === 'r2'), catalog), []);
  const details = recordedCards(DEMO_RECORDS.find(record => record.id === 'r10'), catalog);
  assert.ok(details.every(entry => entry.quality === 'golden'));
});

