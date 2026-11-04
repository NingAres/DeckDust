import { useEffect, useRef, useState } from 'react';
import { loadArt } from '../collection/api.js';
import { prepareDeckArtwork } from './artwork.js';

export default function DeckStripArt({ card, mode = 'layered' }) {
  const ref = useRef(null);
  const [state, setState] = useState({});
  useEffect(() => {
    let current = true, started = false;
    setState({});
    function load() {
      if (started) return;
      started = true;
      loadArt(card.id, 'strip').catch(() => loadArt(card.id, 'tile'))
        .then(image => prepareDeckArtwork(image.url, { stripType: card.type || 'SPELL' }))
        .then(url => { if (current) setState({ url }); })
        .catch(() => { if (current) setState({ failed: true }); });
    }
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { load(); observer.disconnect(); } }, { rootMargin: '80px' });
    observer.observe(ref.current);
    return () => { current = false; observer.disconnect(); };
  }, [card.id, card.type]);
  const focusY = card.type === 'MINION' || card.type === 'HERO' ? '24%' : '50%';
  return <span ref={ref} className={`strip-art-layer strip-art-layer--${mode}`} style={{ '--strip-focus-y': focusY }} aria-hidden="true">
    {state.url && mode === 'layered' && <>
      <span className="strip-art-frame">
        <img className="strip-art" src={state.url} alt="" onError={() => setState({ failed: true })} />
      </span>
    </>}
    {state.url && mode !== 'layered' && <img className="strip-art" src={state.url} alt="" onError={() => setState({ failed: true })} />}
    {state.failed && <span className="strip-art-status">插画暂不可用</span>}
  </span>;
}

