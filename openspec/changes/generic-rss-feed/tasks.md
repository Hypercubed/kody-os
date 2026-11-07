# Generic RSS feed (live) — tasks

## 1. App definition and recipe

- [ ] 1.1 Write `pkg/catalog/generic-rss-feed/definition.json`, modelled on `xkcd` (reader UI) and `generic-feed` (setup prompt): id `generic-rss-feed` (proposed, for review), label `Generic RSS Feed`, category `reading`, `schemaVersion` 5, `catalogVersion` 1, `installMode: recipe-or-json`, no capabilities, one state field `feedUrl` (string, maxLength 2048, initial `""`), one action `set_feed_url`, bundle within the 256 KiB cap, icon a single glyph (proposed `≣`, for review).
- [ ] 1.2 Write `pkg/catalog/generic-rss-feed/RECIPE.md` following the `generic-feed` recipe shape (install, verify, ask the user for the RSS URL, set it with `set_feed_url`, verify the feed loads, do-not-touch-anything-else footer).
- [ ] 1.3 Add the import entry to `catalog.ts` (alphabetical by id, after `generic-feed`); regenerate the index with `scripts/build-catalog-index.ts` and confirm the entry carries `installMode: recipe-or-json`, `definitionPath`, and `recipePath`; run the generator twice and confirm byte-identical output.
- [ ] 1.4 Verify: `bun tests/catalog-harness.ts` lists 21 apps and the new app validates and installs in a blank store with its initial state (`feedUrl` empty).

## 2. Shell mechanism: user-feed route

- [ ] 2.1 Add `serveUserFeed(appId)` to `pkg/src/feeds.ts`, mirroring `serveFeed`: read the app's stored state, take the `feedUrl` field, re-validate it at serve time (bare HTTPS, no credentials, non-empty hostname — the same rule as declared entries); no URL set or an invalid stored URL is a plain 404. Reuse the existing fetch/cache helpers: 8 s timeout, User-Agent `kody-os-feed-proxy/1`, TTL 3600 s, maxBytes 65536, cache key `kody-os.feeds.cache.<app>.rss`, `application/rss+xml` with `X-Feed-Cache: hit | miss | stale`; upstream failure serves stale if present, else a plain 502.
- [ ] 2.2 Add the route `GET /user-feed/<app>` in `pkg/src/app.ts` dispatch (GET only, inside the device gate, next to `/feed/` and `/proxy/`). The route takes only the app id from the request — no query parameter, body field, or header may supply a URL.
- [ ] 2.3 Implement `set_feed_url` validation at write time (bare HTTPS, no credentials; `""` clears; invalid URL fails the action with no write). Decide at implementation whether the check lives in the action validator or the action handler; the serve-time re-validation in 2.1 is the backstop.
- [ ] 2.4 Verify: install the app in the mock store, set a URL, and call the route — it returns the fetched feed; with no URL set it returns 404; with a credentialed or http URL in state it returns 404.

## 3. Bundle: reader UI and empty state

- [ ] 3.1 Port the XKCD reader UI: fetch `GET /user-feed/generic-rss-feed` on open and on Refresh; newest first; Previous/Next; position text with the device-local date; at most 14 items; title HTML-escaped, plain-text description truncated to 350 characters; no feed-supplied HTML, script, or inline style reaches the page; tapping an item opens the source. Device-local cache fallback (XKCD's localStorage pattern); error state with a retry when the live fetch fails and nothing is rendered.
- [ ] 3.2 Empty state: when no URL is set, show the Help-style setup prompt naming the app id, the `set_feed_url` action, and a blank `RSS feed URL: [paste the RSS feed URL here]`; hide the `feedUrl` field in the reader view and show the configured URL/host as plain text in the viewer header.
- [ ] 3.3 Widget: the Home widget shows the latest item only; navigation and Refresh hide in the widget, per the widget-visibility rule (CSS scoped to the widget wrapper).
- [ ] 3.4 Verify: bundle tests pass (see 4.2); visual check on a real browser / Scribe remains open until the user does it.

## 4. Harness and tests

- [ ] 4.1 Update the catalog harness's app count (20 → 21) and the agent-tools harness's known-FAIL text ("got 20" → "got 21"); run the full harness suite (`bun tests/store-harness.ts`, `bun tests/catalog-harness.ts`, `bun tests/open-mode-harness.ts`, `bun tests/owner-check-harness.ts`, `bun tests/agent-tools-harness.ts`) — all pass except the known agent-tools FAIL.
- [ ] 4.2 Write `pkg/catalog/tests/generic-rss-feed-tests.cjs` (run under node with jsdom): `set_feed_url` accepts a bare HTTPS URL, rejects http/credentialed/malformed URLs, `""` clears; the empty state shows the setup prompt with no URL set and hides it once a URL is set; the viewer renders a fixture feed newest first with Previous/Next and shows the error state with a retry when the fetch fails.
- [ ] 4.3 Write the route test: stub the global `fetch` to return a fixture RSS document (no live network dependency), install the app in a mock store, set `feedUrl`, call the route handler, and assert the response body is the fixture feed and the `X-Feed-Cache` header reports hit/miss/stale as appropriate; assert 404 with no URL set and 502 with no cache and a failing upstream.
- [ ] 4.4 Follow the recipe in the mock against a known-good public feed (XKCD's RSS) and confirm the app shows the latest entry with Previous/Next.
- [ ] 4.5 Verify: `bun build pkg/src/app.ts --target=browser --external kody:* --outfile /tmp/kodyos-build-check.js` succeeds.

## 5. Docs and specs

- [ ] 5.1 Verify `pkg/catalog/README.md` needs no change (it describes the layout, not the app list); update it only if it enumerates the apps.
- [ ] 5.2 Sync the canonical specs by hand from this change's deltas at archive time (`openspec/specs/generic-rss-feed/spec.md`, `app-registry`, `authoring`), reconciling with `help-about-built-in` if it archived first (see design.md, Decision 7).
- [ ] 5.3 Run `npx --yes @fission-ai/openspec@latest validate generic-rss-feed --type change` — reports valid.

## 6. Verification and version

- [ ] 6.1 Run the full harness suite and the bundle tests once more from a clean checkout of the implementation branch; record the results.
- [ ] 6.2 Record the version decision in the implementation commit (MINOR expected for a new catalog app; sequencing with the catalog-restructure 2.8.0 and `help-about-built-in` 3.0.0 per design.md, Decision 7). Do not publish to Kody; do not commit, push, or publish without the user's explicit direction at each stop.
