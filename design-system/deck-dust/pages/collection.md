# Collection Page Overrides

> **PROJECT:** Deck Dust
> **Generated:** 2026-10-25 20:07:35
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- No overrides — use Master colors

### Component Overrides

- Avoid: Force all chips into one clipped row or hide overflow values
- Avoid: Flat opaque panels blocking view
- Avoid: Static element until pinch

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: z-index stacking, box-shadow elevation (4 levels), transform: translateZ(), backdrop-filter, parallax
- Layout: Wrap the collection or use an operable +n disclosure for hidden overflow values
- Spatial UI: Use glass material and z-offset
- Spatial UI: Scale/highlight element on look

## User-Approved Product Direction — Takes Precedence Over Generated Defaults

- The reference is the supplied Hearthstone in-game deck-builder screenshot and the concept stored next to this file. Keep the ornate fantasy materials, parchment collection surface, dark carved-wood rails, blue mana gems, and warm gold hardware.
- This is a dense desktop utility used for scanning card art and collection counts, not a marketing page. Remove hero sections, social proof, conversion CTA repetition, WebGL, glass panels, and parallax suggestions from the generic master defaults.
- The primary workspace has compact left navigation, a central collection area, and an optional/right-side deck panel. Collection view shows full vertical card renders in stable slots. Deck lists use horizontal rows only.
- In the collection grid, never stretch cards. Fit the whole card frame to the slot, remove source edge padding only when safe, and keep the natural card ratio. Reserve the slot before image load.
- In horizontal deck rows, show cropped artwork/tile, mana gem, name, count, and compact quality treatment. Gold, diamond, and signature/alternate-art rows use distinct gold, faceted blue, and signature pink/ink frames plus readable labels; do not rely on color alone.
- Use real variant images when the configured image source provides them. For missing variants, use the base image with a clear quality frame/label; never imply the base image is a true premium render.
- Keep interactions restrained and immediate, using stable authored animation timings across environments. Use keyboard-visible focus and semantic controls.
- Use local bundled fonts and assets so the packaged desktop build does not depend on Google Fonts, Tailwind CDN, or an icon CDN at runtime.

