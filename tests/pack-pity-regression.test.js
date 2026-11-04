import test from 'node:test';
import assert from 'node:assert/strict';
import { pityPreview } from '../src/packs/demo.js';

test('every legendary variant resets the normal-pack legendary counter', () => {
  for (const quality of ['legendary', 'goldLegendary', 'signature']) {
    const records = [
      { id: 'old', set: '测试', type: 'normal', date: '2026-10-01', count: 28, qualities: {} },
      { id: 'new', set: '测试', type: 'normal', date: '2026-10-02', count: 1, qualities: { [quality]: 1 } },
    ];
    assert.equal(pityPreview(records, '测试', 'normal').find(row => row.quality === 'legendary').since, 0, quality);
  }
});

test('same-second log packs use numeric event order across records', () => {
  const pack = (version, qualityKey) => ({ id: version, version, date: '2026-10-02T12:00:00', cards: [{ qualityKey }] });
  const records = [
    { id: 'z', set: '测试', type: 'normal', date: '2026-10-02T12:00:00', count: 2, qualities: { signature: 1 }, cardPacks: [pack('100_8', 'common'), pack('100_9', 'signature')] },
    { id: 'a', set: '测试', type: 'normal', date: '2026-10-02T12:00:00', count: 1, qualities: {}, cardPacks: [pack('100_10', 'common')] },
  ];
  assert.equal(pityPreview(records, '测试', 'normal').find(row => row.quality === 'legendary').since, 1);
});
