import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldDeferWheelToGrid } from '../src/collection/pageTurnLogic.js';

test('hidden vertical overflow does not swallow collection page turns', () => {
  assert.equal(shouldDeferWheelToGrid({
    overflowY: 'hidden', scrollHeight: 720, clientHeight: 680, scrollTop: 0,
  }, 120), false);
});

test('a genuinely scrollable card grid keeps wheel input until it reaches an edge', () => {
  const grid = { overflowY: 'auto', scrollHeight: 900, clientHeight: 600, scrollTop: 0 };
  assert.equal(shouldDeferWheelToGrid(grid, 120), true);
  assert.equal(shouldDeferWheelToGrid({ ...grid, scrollTop: 300 }, 120), false);
  assert.equal(shouldDeferWheelToGrid({ ...grid, scrollTop: 300 }, -120), true);
  assert.equal(shouldDeferWheelToGrid({ ...grid, scrollTop: 0 }, -120), false);
});

