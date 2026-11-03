import test from 'node:test';
import assert from 'node:assert/strict';
import { metricLeaders, overallPackLeaders } from '../src/packs/pack-comparison-ranking.js';

test('metric awards support ties, lower intervals and missing values without awarding equal rows', () => {
  assert.deepEqual(metricLeaders([3, 3, 1]), [0, 1]);
  assert.deepEqual(metricLeaders([null, 18, 12], true), [2]);
  assert.deepEqual(metricLeaders([0, 0]), []);
  assert.deepEqual(metricLeaders([null, 18], true), []);
  assert.deepEqual(metricLeaders([NaN, Infinity, null]), []);
});

test('overall award uses independent rates and value, excluding opening volume', () => {
  const rows = [
    { count: 1000, legendary: 20, epicRatio: .04, legendaryRatio: .004, average: '90.0' },
    { count: 40, legendary: 4, epicRatio: .05, legendaryRatio: .02, average: '120.0' },
  ];
  assert.deepEqual(overallPackLeaders(rows), { scores: [0, 3], leaders: [1] });
});

test('overall awards allow joint leaders and leave equal or empty comparisons unawarded', () => {
  const a = { epicRatio: .05, legendaryRatio: .01, average: '100.0' };
  const b = { epicRatio: .04, legendaryRatio: .02, average: '100.0' };
  assert.deepEqual(overallPackLeaders([a, b]), { scores: [1, 1], leaders: [0, 1] });
  assert.deepEqual(overallPackLeaders([a, a]), { scores: [0, 0], leaders: [] });
  assert.deepEqual(overallPackLeaders([]), { scores: [], leaders: [] });
});
