import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLASSES } from '../src/collection/model.js';
import { PACK_ASSETS } from '../src/packs/pack-assets.js';

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(jsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

export function runtimeAssets(root = '.') {
  const paths = new Set();
  for (const path of sourceFiles(join(root, 'src'))) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/\/assets\/[^\s'"`)]+\.(?:png|webp|svg|ico|jpe?g)/g)) {
      if (!match[0].includes('${')) paths.add(match[0].slice(1));
    }
  }
  for (const [, , slug] of CLASSES) paths.add(`assets/native-ui/class-emblems/${slug}.png`);
  for (let mana = 0; mana <= 7; mana++) paths.add(`assets/mana-crystals/mana-${mana}.png`);
  for (const icon of ['common', 'rare', 'epic', 'legendary', 'dust']) paths.add(`assets/pack-icons/${icon}.png`);
  paths.add('assets/pack-art/pack-stack.png');
  paths.add('assets/app-icons/deck-dust.ico');
  for (const pack of Object.values(PACK_ASSETS)) {
    for (const type of ['normal', 'gold', 'variant_gold']) {
      if (pack[type]) paths.add(`assets/pack-art/${pack[type]}.png`);
    }
  }
  return [...paths].sort();
}

export function validateRuntimeAssets(root = '.', assetRoot = root) {
  const missing = runtimeAssets(root).filter(path => !existsSync(join(assetRoot, path)));
  if (missing.length) throw new Error(`Missing runtime assets\n${missing.join('\n')}`);
}
