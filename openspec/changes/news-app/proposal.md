# Proposal

## Why

There is no general news app in the shipped catalog. The existing
feed readers are single-feed apps (xkcd, Daily Brief): one feed,
one presentation. ReKindle's News app shows the shape that is
missing — a fixed set of public news sections, one tap per section,
ten headlines per section, plain-text summaries — but it cannot be
lifted as-is: it fetches feeds through a third-party JSON service
and articles through an external readability worker, neither of
which fits a catalog bundle.

This change adds that missing app in the shape the shell already
supports: a stateless catalog bundle that reads declared feeds
through the shell's same-origin feed proxy, exactly as xkcd does.

## What Changes

- One new catalog app, id `news`: a fully JS-driven news bundle in
  `pkg/catalog/news.bundle.json`, listed in
  `pkg/src/apps/catalog.ts` like every other catalog app.
- Six fixed sections (World, Technology, Business, Science, Arts,
  Finance), each mapped to one declared public RSS feed in
  `capabilities.feeds` (at most 8 allowed; 6 used), fetched via
  `GET /feed/news/<name>` and parsed as XML in the bundle.
- The bundle renders a newspaper-style list: masthead, device-local
  date line, section buttons, section title, then at most 10
  headlines per section with plain-text summaries.
- Tapping a headline opens the source article externally. There is
  no in-app cleaned article reader in this change (see Design:
  the reader is deferred, not silently dropped).
- Nothing else changes: no registry change, no new effect op, no
  stateSchema field, no action, no MCP surface change, no
  storage-key or export-format change, no shell route change.
  The feed proxy (`pkg/src/feeds.ts`) already exists; this change
  only declares feeds that use it.

## Capabilities

### New Capabilities

- `news-app`: a multi-section news app in the shipped catalog.

### Modified Capabilities

(none)

## Impact

- `pkg/catalog/news.bundle.json` (new), `pkg/src/apps/catalog.ts`
  (one import line, alphabetical), `pkg/catalog/README.md` (one
  entry).
- No `pkg/src/` logic change. The catalog harness covers the new
  bundle automatically once it is imported (validate + install +
  initial state + directory/import match).
- Publish as MINOR (a new catalog app), shared with the pending
  open-mode / agent-tools / calendar MINOR if they land together —
  not a second bump.
- This change is spec only until implemented: no bundle, catalog
  registration, or publish is done by writing it. The earlier
  standalone spec at `~/workspace/your_files/news-app-clone-spec.md`
  remains the fuller reference for the deferred reader; this
  change adapts it to catalog constraints and does not replace
  its reader design, which belongs to a future change.
