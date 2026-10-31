# Design: news-app

## Context

See proposal.md (Why). The shape to copy is xkcd
(`pkg/catalog/xkcd.bundle.json`): a feed app whose bundle fetches
through the shell's same-origin feed proxy
(`capabilities.feeds` → `GET /feed/<app>/<name>`, HTTPS only,
storage-cached in `pkg/src/feeds.ts`), parses the XML in bundle
JavaScript, and renders it with system fonts and inlined CSS/JS.
The News app differs only in scale: six declared feeds instead of
one, a section switcher instead of a single feed, and a list of
headlines instead of one comic.

The reference behaviour is ReKindle's News app
(`newspaper.html` in `ReKindleOS/ReKindle`), described from its
observable behaviour only. Do not copy its code, artwork, masthead
("The Daily Kindling"), or branding. The clone uses its own title
and styling; only the generic section/feed structure and list
behaviour are carried over, and the original's CC BY-NC-SA 4.0
licence would apply to any part adapted directly from it.

## Goals / Non-Goals

- Goals: six public news sections in the shipped catalog; ten
  headlines per section with plain-text summaries; one-tap
  section switching; a legible e-ink list; a working external
  fallback for every article; no account, no tracking, no
  package change.
- Non-goals: custom feed subscriptions (that is a separate RSS
  Reader concept); an in-app cleaned article reader with
  pagination and text-size controls (deferred, see below);
  offline archives, bookmarks, read-history, search, push
  notifications; any shell, registry, or MCP change.

## Decisions

1. **Stateless, like Calendar.** `stateSchema` is
   `{ type: "object", initial: {}, fields: {} }` and `actions`
   is `{}`. The bundle keeps the current section in a page-local
   variable only. Closing or reopening the app returns to World.
   Feed caching is the proxy's job (`ttlSeconds` in the feed
   declaration, served from `packageStorage()` by `feeds.ts`),
   not app state. No stored feed field is needed: a dead feed
   degrades to the proxy's stale cache or a plain error state,
   and the user retries.
2. **Declared feeds, not a third-party JSON service.**
   ReKindle fetches feeds via rss2json. This bundle must not:
   the proxy route takes only a declared feed name, never a URL
   from the request, and bundle code must not call an external
   feed service. Each section therefore declares one feed:
   `world`, `technology`, `business`, `science`, `arts`,
   `finance` — six of the allowed eight.
3. **HTTPS feeds only, and the BBC URLs must be re-verified.**
   The proxy rejects non-HTTPS upstream URLs, and ReKindle's
   BBC feeds are `http://feeds.bbci.co.uk/...`. This change
   declares the `https://` variants of those BBC URLs and the
   existing HTTPS CNBC URL. That is an assumption to verify in
   task 2.1, not a verified fact: if a BBC HTTPS feed does not
   serve RSS, this change is blocked until an HTTPS source for
   that section is found. It must not silently fall back to
   `http://`, which the proxy will 404.
4. **Freshness: 15-minute proxy TTL.** News goes stale faster
   than a comic strip, so `ttlSeconds` is 900 for all six feeds
   (xkcd uses 3600). The proxy still serves a stale cache on an
   upstream failure rather than blanking the list, and the
   bundle shows its error state only when the proxy itself
   returns an error.
5. **Article reading in v1 is external, by design.** Tapping a
   headline opens the source article in the host browser view /
   a new tab. The standalone spec's cleaned, column-paginated
   reader is deferred because it needs something that does not
   exist: a shell reader route that fetches and sanitises an
   arbitrary article URL server-side. An external readability
   worker (ReKindle's approach) would put arbitrary-URL fetching
   and third-party article HTML into a bundle, which is a
   package-level security decision, not a catalog-app detail.
   The deferred reader is a separate future change; this change
   must not claim it, and must not add a reader worker URL to
   the bundle. The list font is the shell/shared style; there is
   no reader text-size control until the reader lands.
6. **Same hosting constraints as every catalog bundle.**
   ES2019 script (no `?.`, no `??`, no `replaceAll`, no `.at(`,
   no template literals in the bundle script — the Scribe
   ceiling in `pkg/docs/scribe-limitations.md`), one inline
   `<style>`, inlined assets only, no external stylesheets or
   scripts, system fonts, high-contrast black-on-white, icon
   per the existing icon rules (plain glyph or sanitized SVG,
   never emoji). Article links are navigation to the source,
   not fetched resources: the bundle never fetches article
   content.
7. **`openAs` omitted (page default).** Like Calculator, Puzzle,
   xkcd, and Calendar, News takes the page default; it declares
   no `openAs` and no `placements`. A newspaper list is a page,
   not an overlay.

## Risks

- **A BBC HTTPS feed does not serve RSS.** Mitigation: task
  2.1 verifies every declared URL through the proxy before the
  bundle is treated as done; a failed section blocks the change
  for that section rather than shipping a permanently empty tab.
- **A user expects the cleaned in-app reader.** Mitigation:
  the app description states plainly that tapping a headline
  opens the source article, and the deferred reader is named in
  the spec's open questions, so the gap is visible, not hidden.
- **Proxy TTL vs. headline freshness.** A 15-minute cache means
  a section switch within that window can show headlines up to
  15 minutes old. That is the stated trade-off for not hitting
  the upstream on every tap; the Retry/section-switch path
  still re-reads through the proxy, it does not bypass it.

## Alternatives considered

- **Keep rss2json as the feed fetcher.** Rejected: it is a
  third-party service with unconfirmed rate limits and terms,
  and it does not use the shell's declared-feed proxy at all.
  The proxy interface exists precisely so a bundle never needs
  it.
- **Ship the cleaned reader in this change via the external
  worker.** Rejected: it would embed an external worker URL in
  a catalog bundle and fetch arbitrary article URLs through a
  third party. That needs its own package-level design and
  security review, not a quiet addition to a catalog app.
- **Store the last fetched feed in app state (xkcd-style
  fallback).** Rejected for v1: the proxy already caches with
  a stale-on-error fallback, and a stored feed field would add
  state, an action, and a sync contract for six feeds with no
  benefit over the proxy cache.
