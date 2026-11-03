import test from 'node:test';
import assert from 'node:assert/strict';
import { SET_NAMES } from '../src/collection/model.js';
import { SET_RELEASE_ORDER } from '../src/collection/set-order.js';
import { DEMO_SETS, premiumLegendaryTypes, setsForMode } from '../src/collection-stats/demo.js';

test('statistics include the complete project set registry in release order', () => {
  assert.deepEqual(DEMO_SETS.map(set => set.id), SET_RELEASE_ORDER.filter(id => SET_NAMES[id]));
  assert.equal(new Set(DEMO_SETS.map(set => set.id)).size, DEMO_SETS.length);
});

test('Standard includes Core and all six current-rotation expansions', () => {
  assert.deepEqual(setsForMode('standard').map(set => set.id), [
    'BE', 'ESCAPEFROM_VIOLET_HOLD', 'CATACLYSM', 'TIME_TRAVEL', 'THE_LOST_CITY', 'EMERALD_DREAM', 'CORE',
  ]);
  assert.equal(setsForMode('standard').some(set => set.id === 'SPACE'), false);
});

test('Wild contains the Standard pool as well as historical expansions and adventures', () => {
  const wild = new Set(setsForMode('wild').map(set => set.id));
  for (const set of setsForMode('standard')) assert.ok(wild.has(set.id));
  for (const id of ['SPACE', 'WHIZBANGS_WORKSHOP', 'NAXX', 'BRM', 'LEGACY', 'WONDERS']) assert.ok(wild.has(id));
  assert.equal(wild.has('EVENT'), false);
  assert.ok(setsForMode('all').some(set => set.id === 'EVENT'));
});

test('premium legendary types merge golden, diamond and signature identities without double counting', () => {
  assert.equal(premiumLegendaryTypes({ golden: [1, 2, 3], diamond: [2, 4], signature: [3, 4, 5] }), 5);
  assert.equal(premiumLegendaryTypes({}), 0);
  for (const set of DEMO_SETS) {
    const legendary = set.rarities.find(row => row.key === 'legendary');
    assert.equal(legendary.golden, legendary.goldenOnly + 2);
    assert.ok(legendary.golden <= legendary.any);
    for (const row of set.rarities) assert.ok(row.golden <= row.total);
  }
});
