import { useState } from 'react';
import { PACK_ASSETS } from './pack-assets.js';

// Version the generated, pixel-aligned pack art so WebView/browser caches cannot keep old PNGs.
const ROOT = '/assets/pack-art/';
const ART_VERSION = 'aligned-20261027';
export default function PackArt({ set = '', type = 'normal', assetName, className = '', title: customTitle }) {
  const [failed, setFailed] = useState('');
  const asset = PACK_ASSETS[assetName || set];
  const id = asset?.[type === 'gold' || type === 'variant_gold' ? 'gold' : 'normal'];
  const src = `${ROOT}${id ? `${id}.png` : 'pack-stack.png'}?v=${ART_VERSION}`;
  const fallback = `${ROOT}pack-stack.png?v=${ART_VERSION}`;
  return <span className={`pack-expansion-art ${className}`} title={customTitle ?? (set ? `${set}${id ? '' : '（通用卡包图）'}` : '全部扩展包')}><img src={failed === src ? fallback : src} alt="" draggable="false" onError={() => setFailed(src)} />{type === 'variant_gold' ? <small>异画</small> : null}</span>;
}

