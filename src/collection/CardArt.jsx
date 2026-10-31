import { useEffect, useState } from 'react';
import { loadArt } from './api.js';

const trimmedBounds = new Map();
function artworkBounds(img) {
  if (trimmedBounds.has(img.src)) return trimmedBounds.get(img.src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(img, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (data[(y * canvas.width + x) * 4 + 3] <= 8) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  const bounds = right < left ? null : {
    left: Math.max(0, left - 2), top: Math.max(0, top - 2),
    width: Math.min(canvas.width, right + 3) - Math.max(0, left - 2),
    height: Math.min(canvas.height, bottom + 3) - Math.max(0, top - 2),
  };
  if (trimmedBounds.size >= 200) trimmedBounds.delete(trimmedBounds.keys().next().value);
  trimmedBounds.set(img.src, bounds);
  return bounds;
}

export default function CardArt({ card, quality, detail = false, trim = false, onAspectRatio }) {
  const [image, setImage] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    setImage(null); setFailed(false); setBounds(null);
    loadArt(card.id, quality).then(value => { if (current) setImage(value); }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [card.id, quality]);
  return <div className={`card-art ${image ? 'loaded' : ''} ${failed ? 'art-unavailable' : ''}`}>
    {image ? <img src={image.url} alt={`${card.name}卡面`} draggable="false"
      onLoad={trim ? event => {
        try {
          const img = event.currentTarget;
          const next = artworkBounds(img);
          if (!next) return;
          setBounds({ ...next, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
          onAspectRatio?.(next.width / next.height);
        } catch { /* Keep the uncropped preview if pixel access is unavailable. */ }
      } : undefined}
      style={trim && bounds ? { left: `${-bounds.left / bounds.width * 100}%`, top: `${-bounds.top / bounds.height * 100}%`,
        right: 'auto', bottom: 'auto', width: `${bounds.naturalWidth / bounds.width * 100}%`, height: `${bounds.naturalHeight / bounds.height * 100}%` } : undefined} /> :
      <div className={`card-placeholder ${failed ? '' : 'loading-art'}`}><span>{card.cost || 0}</span><strong>{card.name}</strong><small>{failed ? '卡面暂不可用' : '正在载入卡面'}</small></div>}
    {image && image.quality !== quality ? <span className="fallback-note">{detail ? '该品质卡面暂缺，展示普通卡面' : '普通卡面预览'}</span> : null}
  </div>;
}

