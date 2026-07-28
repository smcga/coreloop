# Presentation and localisation

Authoritative packages store stable IDs, numbers, rules and gameplay state. Player-facing names, instructions, labels, icons and currency formatting belong in a `LocalePresentationPack`. The selected pack is application preference state: it must not be written into a run save or replay, so changing language or terminology cannot affect canonical hashes or deterministic outcomes.

## Adding a locale

Create a pack with a unique namespaced `id` and a valid BCP 47 `locale` (the maintained starter uses `en-GB`). Supply every terminology and action key, and maps for referenced content, gameplay modules, special rules and named score tracks. Module implementations expose only stable identity, version and capabilities; their name, description and instructions live in the locale pack.

At startup, call `validatePresentationPacks`. Diagnostics identify the locale pack and exact property path. Select data with `selectPresentation`: lookup order is selected locale, application default locale, then a visible `[stable:id]` placeholder plus a development diagnostic. A missing translation therefore does not prevent play or corrupt a save.

```ts
const selection = selectPresentation(packs, "my-game:en-gb", requestedId);
const item = resolvePresentation(selection, "content", offer.definitionId);
```

## Terms and money

`formatLocalisedTerm` uses the runtime's `Intl.PluralRules`, rather than an English-only `count === 1` test. `formatCurrency` supports ISO currency codes (for example GBP renders as `£12` under `en-GB`), themed symbols, and localised currency nouns. Core continues to store only the numeric value.

The initial API deliberately does not implement ICU MessageFormat, grammatical gender, or right-to-left layout. Add those only when a shipped locale demonstrates a concrete need. Supported browsers and Node 22 provide `Intl`; the stable-ID placeholder is the deterministic missing-data fallback used by tests.

## View models

Pure helpers such as `createEncounterHeaderViewModel`, `createRunProgressViewModel`, and `createShopOfferViewModel` combine authoritative numbers/IDs with selected presentation data. Common screens should render these ready-to-display values rather than inspect concrete content or module IDs. Encounter-specific presenters may still consume their module's validated state.

To translate a generated starter, copy its `en-GB` presentation pack, change only its pack ID, locale and display values, validate both packs, and add preference selection in the browser host. Do not rename content/module/rule IDs: saves and replays remain compatible precisely because presentation is external.
