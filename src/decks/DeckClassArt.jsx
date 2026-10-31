import { useEffect, useState } from 'react';
import { loadArt } from '../collection/api.js';
import { prepareDeckArtwork } from './artwork.js';

export default function DeckClassArt({ cardId, fallbackCardId, className }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    setUrl('');
    if (!cardId) return () => { active = false; };
    loadArt(cardId, 'tile').then(image => prepareDeckArtwork(image.url)).then(source => { if (active) setUrl(source); }).catch(async () => {
      if (!active || !fallbackCardId || fallbackCardId === cardId) return;
      try { const image = await loadArt(fallbackCardId, 'tile'); const source = await prepareDeckArtwork(image.url); if (active) setUrl(source); } catch { /* Keep the CSS surface fallback. */ }
    });
    return () => { active = false; };
  }, [cardId, fallbackCardId]);
  return url ? <img className={className} src={url} alt="" aria-hidden="true" /> : null;
}

