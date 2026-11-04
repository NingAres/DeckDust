import test from 'node:test';
import assert from 'node:assert/strict';

test('a locally cached image bypasses occupied remote-download slots', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    if (url.includes('CACHED')) return new Response(new Blob(['image']), { headers: { 'X-Art-Quality': 'normal' } });
    if (url.includes('cached=1')) return new Response('', { status: 404 });
    return new Promise(() => {});
  };
  try {
    const { loadArt } = await import(`../src/collection/api.js?queue-regression=${Date.now()}`);
    for (let i = 0; i < 4; i++) loadArt(`SLOW_${i}`, 'normal', true);
    await new Promise(resolve => setTimeout(resolve, 10));
    const result = await Promise.race([
      loadArt('CACHED', 'normal').then(() => 'loaded'),
      new Promise(resolve => setTimeout(() => resolve('blocked'), 100)),
    ]);
    assert.equal(result, 'loaded');
  } finally { globalThis.fetch = original; }
});
