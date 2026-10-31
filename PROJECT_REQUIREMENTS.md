# Deck Dust project requirements

## Product

Deck Dust is a Windows-first Hearthstone collection, deck and pack tracking utility. User data belongs in a per-user local data directory; migration and import must preserve a recoverable backup.

## Collection

- Collection ownership is keyed by DBF ID. The first four quantity slots represent normal, golden, diamond and signature cards; preserve additional imported slots.
- By default, missing-card checks combine the first four variants. When a quality is selected, compare only that quality.
- Distinguish thresholds for fewer than one copy, fewer than two copies and incomplete deck construction.
- Dust estimates use ordinary card crafting prices and exclude core and free cards. Explain that the estimate does not imply every event card is craftable.
- Validate imports fully before writing. Back up first and replace data transactionally. Invalid or empty data must not overwrite a valid collection.

## Decks

- Summarize entries by DBF ID and preserve per-quality counts in JSON exports. Deck codes do not encode quality.
- For deck progress, count one copy for legendary cards and two for other cards. Exclude hero skins, mercenaries and Classic duplicates from the denominator; reprints with different DBF IDs remain separate.
- New or imported decks use the collection view for adding cards. Assign owned variants using current collection counts and show missing quantities clearly.

## Images and data

- Keep shipped static assets under the root `assets/` directory and document their source and license.
- Treat third-party card image sources as optional. Handle missing images without corrupting collection data.
- Keep runtime caches and personal databases in the user's data directory, outside the source tree and distribution assets.

## Privacy

Do not commit collection exports, SQLite databases, account sessions, cloud credentials, local filesystem paths, or screenshots with user data.
