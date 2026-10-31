import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRecordSearch } from '../src/packs/record-search.js';

const record = qualities => ({ set: '测试系列', source: '日志识别', note: '活动奖励', qualities });
test('rarity search includes premium variants without broadening specific aliases', () => {
  for (const key of ['legendary', 'goldLegendary', 'signature']) {
    for (const query of ['传说', '橙卡']) assert.ok(matchesRecordSearch(record({ [key]: 1 }), query));
  }
  for (const query of ['金色传说', '金橙', '金橙卡']) {
    assert.ok(matchesRecordSearch(record({ goldLegendary: 1 }), query));
    assert.equal(matchesRecordSearch(record({ signature: 1, legendary: 1 }), query), false);
  }
  for (const query of ['异画传说', '异化传说']) assert.ok(matchesRecordSearch(record({ signature: 1 }), query));
  assert.equal(matchesRecordSearch(record({ legendary: 0 }), '传说'), false);
});
test('other qualities, text search and combined terms remain supported', () => {
  for (const [query, key] of [['蓝卡', 'goldRare'], ['紫卡', 'epic'], ['金白', 'goldCommon'], ['金蓝', 'goldRare'], ['金紫', 'goldEpic']]) assert.ok(matchesRecordSearch(record({ [key]: 1 }), query));
  assert.ok(matchesRecordSearch(record({ signature: 1 }), '测试系列 异化传说'));
  assert.ok(matchesRecordSearch(record({}), '活动奖励'));
  assert.equal(matchesRecordSearch(record({ rare: 1 }), '测试系列 橙卡'), false);
});

