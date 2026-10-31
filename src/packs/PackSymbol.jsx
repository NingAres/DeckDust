const ROOT = '/assets/pack-icons/';

// Original client-style raster assets, bundled locally; no CSS-drawn gems.
export default function PackSymbol({ rarity = 'legendary', golden = false, signature = false, diamond = false }) {
  const hasVariant = golden || signature || diamond;
  return <span className={`pack-symbol ${golden ? 'is-golden' : ''} ${signature ? 'is-signature' : ''} ${diamond ? 'is-diamond' : ''}`} aria-hidden="true">
    <img src={`${ROOT}${rarity}.png`} alt="" draggable="false" />
    {hasVariant ? <span className="pack-symbol-quality-dot" /> : null}
  </span>;
}

export function QualitySymbol({ quality }) {
  const rarity = quality === 'signature' ? 'legendary' : quality.replace(/^gold/, '').toLowerCase();
  return <PackSymbol rarity={rarity} golden={quality.startsWith('gold')} signature={quality === 'signature'} />;
}

