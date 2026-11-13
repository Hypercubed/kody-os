# Proposal

## Why

The Nov 6 catalog-restructure spec said listing summaries SHALL be
driven by the generated index (`catalog/catalog.json`), with
definitions fetched only for install. The code drifted away from
that: opening the Store now fetches every `definition.json`
twice — once in `list_catalog` to build the summaries, and
again per row in `buildStoreRows` (via
`get_catalog_definition_meta`) for the version gates and
capabilities. That is ~38 definition fetches plus 2 manifest
fetches per Store open (verified Nov 12, 2026, against
`main` at `24f6c3a`), against Kody Free's 1,000 outbound
fetches/day. The feeds are a handful per day by comparison;
the catalog listing is the dominant consumer.

The manifest never caught up with what the rows need. An
entry today carries only id, label, catalogVersion,
fingerprint, installMode, definitionPath, recipePath,
bundleFiles. A row also displays name, icon, category,
description, minPackageVersion, schemaVersion, and the
capabilities summary — all of which still live only in the
definitions, so the shell fetches them.

## What Changes

The generator copies the display fields into each manifest
entry, and the Store builds its rows from the manifest
alone:

- Each `catalog.json` entry gains `name`, `icon`,
  `category`, `description`, `schemaVersion`,
  `minPackageVersion` (when the definition carries one),
  and `capabilities` (the `summarizeCapabilities` shape:
  manageApps, feedHosts, proxyHosts, themeView, themeSet).
- `list_catalog` builds its summaries from the manifest
  entries with no definition fetch.
- `buildStoreRows` stops calling
  `get_catalog_definition_meta` per row and reads the
  version gates and capabilities from the summary.
- `getStoreSelfUpdate` reads the App Store entry from the
  discovery manifest instead of fetching its definition.
- A Store open then costs 2 outbound fetches (listing
  manifest + discovery manifest), down from ~40, with
  definitions fetched only on install, update, restore,
  or absorb (`get_catalog_definition`).

## What Does Not Change

- No definition file changes, so no app's `catalogVersion`
  bumps. The Store definition does not change (no pin
  move, Store stays v32).
- `CatalogSummary` gains one additive field, `capabilities`
  (the manifest entry's capabilities summary); MCP
  `list_catalog` responses carry it. No other MCP shape
  changes.
- `get_catalog_definition_meta` stays as a public export
  (agents and `get_catalog_definition` still use it); it
  still fetches one definition. Only the Store rows and
  self-update paths stop calling it.
- The update-confirmation gate (`capabilityAdditions`)
  still compares full definitions fetched by
  `get_catalog_definition`; the manifest capabilities
  summary is display-only and never feeds that gate.
- Manifest caching is unchanged (30-second in-memory TTL,
  stale fallback labeled cached). No definition cache is
  added, because listing no longer fetches definitions.
- The manifest size cap is unchanged: the enriched
  `catalog.json` measures 17.7 KB pretty-printed for
  the current 19 apps (up from 6.2 KB), well under the
  64 KiB `MANIFEST_MAX_BYTES` cap.
