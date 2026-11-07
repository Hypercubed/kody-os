# Generic RSS feed (live) — design

## Context

Three feed patterns exist today (verified against the code on `be-quite-900`, HEAD `b548aca`):

1. **Push** — `generic-feed`, `daily-feed`. No capabilities; one `feed` string field (maxLength 250000) and one `set_feed` action; zero `fetch(` calls in the bundle. An agent fetches the user's RSS URL and pushes the parsed feed in via `set_feed` (newest first, max 14). The "RSS" is in the setup (the agent fetches), not in the app.
2. **Declared live** — `xkcd`, `news`. A `feeds` capability declares fixed upstream URLs (XKCD: one entry, `https://xkcd.com/rss.xml`, ttlSeconds 3600, maxBytes 50000; News: six entries, TTL 900, maxBytes 65536). The shell fetches server-side (`pkg/src/feeds.ts`: `serveFeed`/`serveProxy`) and serves at `GET /feed/<app>/<name>` (routes in `pkg/src/app.ts`, GET only, inside the device gate). The bundle renders the stored feed first, then fetches live, with a Refresh button and a device-local cache fallback.
3. **User-supplied live** — this change. The URL is not known at publish time, so it cannot be declared. It needs a runtime mechanism.

The governing rule, from `pkg/src/apps/types.ts` (`FeedDecl`/`ProxyDecl`) and `pkg/src/feeds.ts`:

> Route: `GET /proxy/<app>/<name>`. The route never takes a URL from the request: only a declared entry, matched by name against the stored definition, is fetched.

And from `feeds.ts`: "Unknown apps, unknown feed names, and non-HTTPS upstream URLs are 404s."

The existing fetch machinery (`pkg/src/feeds.ts`, 212 lines): `serveFeed`/`serveProxy` resolve the stored definition, re-validate the declared URL at serve time (HTTPS only, bare, no credentials), apply TTL (default 3600 s) and maxBytes (default 65536), and use a storage cache (`kody-os.feeds.cache.` / `kody-os.proxy.cache.` prefixes). Fresh cache (age < TTL) is served without an upstream fetch; on upstream failure a stale entry is served instead of an error; with no cache at all, upstream failure is a plain 502. Upstream fetch: 8 s timeout, User-Agent `kody-os-feed-proxy/1`, empty or oversize bodies rejected. Validation of declared entries (`pkg/src/apps/registry.ts`, `validateUpstreamEntries`): array, at most 8 entries, name matching `^[a-z0-9][a-z0-9-]{0,63}$` and unique, URL a bare HTTPS URL with no credentials, ttlSeconds integer 60..86400, maxBytes integer 1024..262144; `sanitizeUpstreamEntries` applies defaults ttl 3600 / maxBytes 65536. Disclosure (`summarizeCapabilities`): feed/proxy hosts are listed in plain words before install; `capabilityAdditions` treats a new host as an update requiring confirmation, while removing a capability or changing only TTL/size parameters is not an addition. The definition fingerprint (`fingerprintDefinition`) covers the canonical stored definition, including capabilities, excluding only `catalogVersion` and `installMode`.

## Decision 1: The shell mechanism — per-install URL in app state + a new route (option (a))

Two options were evaluated.

### Option (a) — RECOMMENDED: URL stored in the app's state, fetched by a new shell route

- The app holds one state field, `feedUrl`. The owner (user or agent) writes it through a `set_feed_url` action, which validates the URL before writing (bare HTTPS, no credentials, non-empty hostname — the same rule as `validateUpstreamEntries`). An empty string clears it.
- New route `GET /user-feed/<app>` (GET only, inside the device gate, next to `/feed/` and `/proxy/` in `pkg/src/app.ts`). It takes only the app id from the request. The handler (`serveUserFeed` in `pkg/src/feeds.ts`, mirroring `serveFeed`) reads the app's stored state, takes the `feedUrl` field, re-validates it at serve time with the same bare-HTTPS rule, and fetches it with the same fetch/cache machinery.
- The route never takes a URL from the request — no query parameter, no body field, no header carries a URL. The URL comes from the app's own stored state, written earlier under owner authority through a validated action. This preserves the governing rule in letter and spirit: the request names an app; the shell decides what that app fetches, from state the owner wrote, not from the request.
- Cache key `kody-os.feeds.cache.<app>.rss` (the feeds cache family, fixed feed name `rss`). TTL 3600 s and maxBytes 65536 — the declared-entry defaults, not user-configurable in v1. Same 8 s timeout and User-Agent. Same response shape as `feedResponse`: `application/rss+xml` with an `X-Feed-Cache: hit | miss | stale` header. Same failure behavior: fresh cache served without an upstream fetch; upstream failure serves stale if present, else a plain 502 (`feed unavailable`).
- No URL set, or a stored URL that fails serve-time validation, is a plain 404 — the same as an undeclared feed.
- The app declares no `feeds`/`proxy` capability, so the Store discloses no publisher host at install, and the capability-confirmation gate is never involved. Changing the URL is a state write: it never changes the definition fingerprint, the install snapshot, or the update status, and never requires update confirmation. The disclosure is the app's own page, which shows the configured host from state (see Decision 2).
- Trust: the trust decision is the user's own, not the publisher's — they typed the URL (or asked their agent to). The shell fetches only the URL in that app's own state, only for that app, only through the capped fetch machinery. A bundle cannot make the shell fetch an arbitrary URL through this route: the URL must first be written to state via the validated action, and the route only ever fetches the stored URL. The route is no weaker than the existing `/feed/` route, which any same-origin bundle can also call for any app's declared feed; bundles run same-origin with session authority under the existing trust model, and this change does not alter that model.

### Option (b) — REJECTED: extend the proxy capability so an entry's URL can be set at setup time

- A proxy entry's URL lives in the definition: it is validated at install, canonicalized into the stored definition, fingerprinted, and disclosed as a publisher-chosen host. Letting the user supply it at setup would require the stored definition to diverge from the catalog definition per install. That breaks the fingerprint/snapshot model (every URL change would look like a catalog update), breaks the Store's update classification (the install snapshot would no longer match the catalog), and misattributes the trust decision (the update-confirmation gate would treat a user-chosen host as a publisher capability addition).
- It also does not fit the install flow: `add_app` takes a definition, not a per-install URL, so a setup-time URL would need a second write path anyway — at which point it is option (a) with extra machinery.
- Rejected. The declared capabilities stay declared-URL-only; the user-supplied URL lives in state.

### Alternatives considered and rejected

- **Direct client-side fetch only (no shell route).** XKCD's bundle does try a direct fetch of its fixed URL as a fallback, but that works only when the host sends CORS headers. An arbitrary user-supplied RSS host may not, and the Scribe browser cannot be assumed to reach it. The shell route exists precisely for upstreams that send no CORS header. The bundle may still attempt a direct fetch as a best-effort fallback after the route fails (the XKCD pattern), but the route is the supported path.
- **Mirror XKCD's stored `feed` field.** XKCD keeps a `feed` state field holding the last pushed XML and renders it as "Stored feed". This app does not need one: the shell route's server-side cache already provides the last-good-feed fallback (fresh/stale), and the bundle keeps a device-local cache like XKCD's localStorage cache. The state schema stays one field (`feedUrl`). The no-JS view shows the setup prompt / configured URL rather than a stored feed — the News precedent (no persistent state, bundle fetches live) covers this shape.
- **Per-install definition mutation.** Writing the user's URL into the app's stored definition (a per-install `feeds` entry) was rejected for the same reasons as option (b): it breaks the fingerprint/snapshot/update model.

## Decision 2: The app

- Id `generic-rss-feed` (proposed; flagged for review — see Open questions). Label `Generic RSS Feed` (proposed). Category `reading` (same as `generic-feed`). `schemaVersion` 5, `catalogVersion` 1. No `installMode` (absent = `json`).
- No capabilities. The fetch goes through the user-feed route, not through a declared capability.
- State schema: one field, `feedUrl`, string, maxLength 2048, initial `""`. One action, `set_feed_url`: sets the URL (validates bare HTTPS before writing; an invalid URL fails the action with no write, and the agent reports it and asks the user for a corrected URL — never guesses a corrected URL). Setting `""` clears the URL and returns the app to its empty state. No `refresh` action: the bundle's Refresh button re-fetches the route client-side (XKCD pattern); the route's server cache makes a refresh within the TTL cheap and harmless to the upstream. The action does not fetch — actions are state writes; fetching is the route's job.
- Empty state (no URL set): a Help-style prompt modelled on `generic-feed`'s, naming the app id, the `set_feed_url` action, and a blank `RSS feed URL: [paste the RSS feed URL here]` for the user to fill in, plus the line "The app reads this feed live; changing the URL changes what it fetches." The `feedUrl` field is hidden in the reader view (XKCD hides its `feed` field); the viewer header shows the configured URL/host as plain text so the user can see what the app fetches.
- Viewer (modelled on XKCD/News): on open and on Refresh, fetch `GET /user-feed/generic-rss-feed`; newest first (feed order reversed); Previous/Next buttons; position text with the device-local date; at most 14 items rendered (the push-feed family cap, matching `generic-feed`); each item shows the title (HTML-escaped), a link, and a plain-text description stripped of markup and truncated to 350 characters (the News rule); no feed-supplied HTML, script, or inline style reaches the page (escape-first linkify); tapping an item opens the source. The device-local cache (XKCD's localStorage pattern) is consulted when the live fetch fails: if items are already rendered, keep them and show the error with a retry; if nothing is rendered and there is no cache, show an error state with a retry (the News failure rule).
- Widget: the Home widget shows the latest item only; navigation and Refresh hide in the widget, per the existing widget-visibility rule (CSS scoped to the widget wrapper; bundle JavaScript only where CSS has no hook). No new widget mechanism.
- Icon: a single glyph, proposed `≣` (a variant of `generic-feed`'s `≡`, signalling the sibling relationship) — flagged for review at implementation.

## Decision 3: Recipe and empty-state prompt

- `RECIPE.md` follows the `generic-feed` recipe shape (install, verify, ask the user for the RSS URL, set it, verify the feed loads), with one difference: step 5 sets the URL instead of pushing a feed, and the verify step confirms the app shows the latest entry with Previous/Next. Sketch:
  1. Install: `install_from_catalog('generic-rss-feed')`.
  2. Verify: `list_apps()` lists `generic-rss-feed`.
  3. Ask the user for the RSS feed URL.
  4. Set it: `act('generic-rss-feed', 'set_feed_url', { feedUrl: <url> })`. If the action rejects the URL, stop and ask the user for a corrected URL — do not guess one.
  5. Verify: the app shows the latest entry with Previous/Next. If the feed fails to load, check the URL with the user — do not clear it silently.
  6. "Do not install any other app, and do not publish or change the package source."
- Unattended install lands unconfigured with the built-in empty-state prompt (Decision 2); the recipe fully configures it.

## Decision 4: Catalog placement

- Follows the catalog-restructure model: `pkg/catalog/generic-rss-feed/` with `definition.json` + `RECIPE.md`; the generator (`scripts/build-catalog-index.ts`) picks the app directory up; `catalog.ts` gains the import entry (alphabetical by id: `generic-feed`, then `generic-rss-feed`); the generated index entry carries id, label, catalogVersion 1, fingerprint, definitionPath, recipePath (no `installMode` field — absent = `json`).
- This change assumes the restructure layout (app directories + generated index). It does not depend on the restructure being committed — only on the layout being the one implemented — but the implementation commit should land after the restructure commit or fold into the same commit, so the app directory is created in its final shape (see Decision 7).

## Decision 5: Relationship to generic-feed (push) — unchanged

- `generic-feed` is not changed by this change. The distinction is recorded: push vs live RSS.
- Recommendation: `generic-feed`'s RSS-URL setup prompt stays as-is. It remains a valid way to seed a push feed — for example for feeds the shell route cannot reach, or where the user wants the agent to fetch and curate the items rather than the app to read them live. Flagged as a decision for the user; do not change it silently.

## Decision 6: Tests

- The catalog harness covers the new app (it walks app directories: each definition validates and installs and holds its initial state). The harness's app count goes 18 → 19. The agent-tools harness's known pre-existing FAIL ("list_catalog returns 16 apps — got 18", verified at HEAD `b548aca`) changes to "got 19" — record the new expected text; fixing the underlying 16-vs-actual gap is out of scope.
- The live fetch is tested without a live network dependency: the route test stubs the global `fetch` to return a fixture RSS document, installs the app in a mock store, sets `feedUrl`, calls the route handler, and asserts the response body is the fixture feed and the `X-Feed-Cache` header reports hit/miss/stale as appropriate. No test hits the network. (A fixture feed served over plain HTTP cannot be used as the app's URL, because the URL validation requires HTTPS — hence the stubbed-fetch approach rather than a local test server.)
- Bundle tests (`pkg/catalog/tests/generic-rss-feed-tests.cjs`, run under node with jsdom, following the existing bundle-test pattern): `set_feed_url` accepts a bare HTTPS URL, rejects http/credentialed/malformed URLs, and `""` clears; the empty state shows the setup prompt with no URL set and hides it once a URL is set; the viewer renders a fixture feed newest first with Previous/Next and shows the error state with a retry when the fetch fails.
- The recipe is verified by following it in the mock against a known-good public feed (XKCD's RSS) and confirming the app shows the latest entry — a manual agent step, not an automated test.

## Decision 7: Version and sequencing

- New catalog app: the implementation commit is expected to be a MINOR version bump (new catalog app, backwards compatible), decided at commit time per the version policy in `pkg/AGENTS.md`; the build increments by one on publish. This change does not decide the bump.
- Sequencing with the catalog-restructure: settled - the restructure's task 8.3 committed as `b548aca` (MINOR 2.8.0). This change's implementation commit lands after it.
- Sequencing with `help-about-built-in`: settled - committed in `c5d10d4`, Help and About are built-in shell pages (removed from the catalog) and `app-store`'s `installMode` is `json`. It touches the same canonical scenarios this change modifies (`Recipe install mode`). The settled outcome: 19 apps with this change; no app reports `recipe-only`, all 19 report `json`.
  - That change also recommends a MAJOR version bump (3.0.0); the version decision for this change is deferred to publish and is taken against that recommendation, not decided here.
- Sequencing with `store-recipe-prompt`: that change removes `recipe-or-json` from the type and validation and from the `daily-feed`/`generic-feed` definitions (its Decision 6); this change's `Recipe install mode` delta is written against the simplified two-state model, so it archives after that removal lands (or the two land together) — whoever archives second reconciles the `Recipe install mode` requirement. The validator refuses a MODIFIED delta that drops a scenario the canonical spec still has, so this delta only validates once SRP's implementation-time canonical sync (SRP task 6.1) has dropped the `recipe-or-json` scenario from the canonical `Recipe install mode` requirement.

## Open questions

1. App id: `generic-rss-feed` (proposed). Alternatives: `rss-feed`, `live-rss-feed`. The id is user-facing in the setup prompt and the recipe; decide at review.
2. Route name: `GET /user-feed/<app>` (proposed). Alternative: `GET /feed/<app>/rss`. A distinct prefix keeps the declared-feed route untouched; decide at implementation.
3. `generic-feed`'s RSS-URL setup prompt: stays as-is (recommendation, Decision 5) or is simplified now that a live app exists — decision for the user.
4. Item cap 14 and description truncation 350 characters: decided here to match `generic-feed`/`news`; reviewable at implementation.
5. No stored `feed` field in v1 (Decision 1, alternatives): review at implementation — if the no-JS view needs a stored feed, add the field then.
6. Whether the `set_feed_url` validation lives in the action validator or in the action handler: an implementation decision; the requirement is validation at write time with serve-time re-validation as the backstop.
