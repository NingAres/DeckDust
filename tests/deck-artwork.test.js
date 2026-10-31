import test from 'node:test';
import assert from 'node:assert/strict';
import { artworkContentBounds, stripArtworkBounds } from '../src/decks/artwork.js';

function art(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { data, width, height };
}
test('hero artwork removes uniform white borders while retaining the full illustration', () => {
  assert.deepEqual(artworkContentBounds(art(40, 40, (x, y) => x < 2 || x >= 38 || y < 2 || y >= 38
    ? [255,255,255,255] : [30,110,80,255])), {left:2,top:2,width:36,height:36});
});
test('portrait art with broad white side margins is cropped before cover sizing', () => {
  assert.deepEqual(artworkContentBounds(art(40,40,(x,y)=>x<6 || x>=34 || y<2 || y>=38
    ? [255,255,255,255] : [30,110,80,255])), {left:6,top:2,width:28,height:36});
});
test('bright details and broad white scenery are not mistaken for a narrow image border', () => {
  for (const fixture of [art(40, 40, (x,y) => y < 20 ? [255,255,255,255] : [30,110,80,255]),
    art(40,40,(x,y) => x===0 && y!==20 ? [255,255,255,255] : [30,110,80,255])]) {
    assert.deepEqual(artworkContentBounds(fixture),{left:0,top:0,width:40,height:40});
  }
});
test('curated horizontal art remains intact; fallback minions focus higher than weapons and spells', () => {
  assert.deepEqual(stripArtworkBounds(256,59,'MINION'),{left:0,top:0,width:256,height:59});
  const head=stripArtworkBounds(256,256,'MINION');
  const weapon=stripArtworkBounds(256,256,'WEAPON');
  assert.ok(head.top < weapon.top);
  assert.equal(head.width,256); assert.equal(head.height,60);
  assert.deepEqual(stripArtworkBounds(256,256,'SPELL'),weapon);
});

