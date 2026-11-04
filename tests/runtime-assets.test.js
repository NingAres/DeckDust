import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRuntimeAssets } from '../scripts/runtime-assets.js';

test('runtime assets are complete and a missing-resource build fails', () => {
  assert.doesNotThrow(() => validateRuntimeAssets());
  const empty = mkdtempSync(join(tmpdir(), 'deck-dust-assets-'));
  try { assert.throws(() => validateRuntimeAssets('.', empty), /mana-crystals\/mana-2\.png/); }
  finally { rmSync(empty, { recursive: true }); }
});
