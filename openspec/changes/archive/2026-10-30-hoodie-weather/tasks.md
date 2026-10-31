## 1. Definition and bundle core

- [x] 1.1 Author `pkg/catalog/hoodie-weather.bundle.json`: id `hoodie-weather`, `schemaVersion` 5, SVG tile icon, `stateSchema` with `lat`/`lon`/`label` (initials = default place), `set_location` (args) and `restore_default` (no-arg) actions, one declared static Open-Meteo feed (TTL 600 s, `maxBytes` ≤ 131072), `ui.actions` entry for `restore_default`; confirm it validates through the local `registry.ts` add path
- [x] 1.2 Build `index.html` layout and inline `<style>`: label, temperature, conditions line, rain chance, the four original HoodieWeather verdict PNGs, inlined as data URIs (hoodie/jacket/t-shirt/raincoat), shell `os-*` classes, ≥48 px tap targets, no animation
- [x] 1.3 Implement the four-way verdict classifier as a pure function (rain > 30% → raincoat, else < 51 °F → jacket, else < 65 °F → hoodie, else t-shirt) using source `apparent_temperature`, wind-chill formula only as fallback
- [x] 1.4 Implement the Open-Meteo fetch/parse adapter: `current` + bounded `hourly` (`forecast_days=1`, `timezone=auto`), next-hour slot = first hourly time at or after now in the location's timezone, guarded `fetch` with timeout

## 2. Location layers

- [x] 2.1 Wire L1: fetch the declared feed through `GET /feed/hoodie-weather/<name>`, parse in-page, error state with Retry on 502/empty
- [x] 2.2 Wire L2 fetch: direct weather fetch for a saved/discovered place with timeout; on failure fall back to L1 showing the default label plus the "saved place unreachable" notice and a Retry that re-attempts the saved place (spec: Layer precedence and honest labeling)
- [x] 2.3 Wire L2 set: city-search UI (debounced ≥2-char query to the geocoding endpoint via direct fetch, never a feed URL) whose selection dispatches `set_location` through the bridge; guard against empty/error results
- [x] 2.4 Verify `act("hoodie-weather", "set_location", {lat, lon, label})` over MCP writes state and invalid args return `{ ok: false }` with state unchanged
- [x] 2.5 Wire L3: geolocation attempt at most once per page load only when no place is saved — success persists via `set_location`, absence/denial/timeout falls back silently with no repeated prompt and no render delay
- [x] 2.6 Wire `restore_default`: shell no-arg button restores the default place; bridge `claimForm` repaints in place, native submit works without JS, span observer adopts the patch (Counter is the reference)
- [x] 2.7 Add the Refresh control re-running the full resolve-and-fetch sequence; confirm nothing polls or timer-refreshes anywhere in the bundle

## 3. Harness and local verification

- [x] 3.1 Write `pkg/catalog/tests/hoodie-tests.cjs` after the counter pattern: definition shape (schemaVersion, effects arrays, feed allowlist, 256 KiB cap, ES2019 ceiling scan), classifier boundary table (30/31 % rain, 50/51/64/65 °F), layer fallback and honest-labeling cases, shell-form adoption for `restore_default`, seed-based initial render
- [x] 3.2 Run the harness with ephemeral jsdom (`mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom`, then `node pkg/catalog/tests/hoodie-tests.cjs`) and fix failures
- [x] 3.3 End-to-end `kody dev` leg from `pkg/`: seed dev hash, add the definition, start `kody dev --target mock`, confirm with `kody dev check --target mock --offline` and `kody dev fetch '/apps/hoodie-weather?k=local-dev-code-123456'` that the page renders seed → bundle → state readout → action forms with no console error
- [x] 3.4 Confirm `openspec validate hoodie-weather` passes after artifact edits

## 4. Device spike (open questions from the design)

- [x] 4.1 On the Kindle Scribe, load the app and record whether bundle direct fetch to the CORS-open Open-Meteo host succeeds (gates L2); note the failure mode if not — DEFERRED 2026-10-30: no Scribe available for this session, so no device result was recorded. L2 remains implemented with the L1 fallback; the design/spec already treat direct fetch as device-untested.
- [x] 4.2 On the Scribe, record whether `navigator.geolocation.getCurrentPosition` ever resolves and what the permission flow looks like (L3 remains enhance-only regardless) — DEFERRED 2026-10-30: not run (no Scribe). L3 remains enhance-only and silently degrades, as specified.
- [x] 4.3 If either result changes device guidance, update `pkg/docs/scribe-limitations.md`'s "still untested" list with the finding — DEFERRED 2026-10-30: no finding to record; `pkg/docs/scribe-limitations.md` is unchanged.

## 5. Install and docs

- [x] 5.1 Install to the local mock and the hosted store via `add_app`; verify with `list_apps` and `get_app_state`, then exercise the app page, modal, and a home-widget placement
- [x] 5.2 Add the `hoodie-weather` entry to `pkg/catalog/README.md` with its install and verify notes
- [x] 5.3 Only if the device spike passes: add hoodie-weather as a canonical example in `pkg/docs/adding-an-app.md` (conditional per proposal Impact) — SKIPPED 2026-10-30: condition not met (device spike deferred); `pkg/docs/adding-an-app.md` is unchanged.
- [x] 5.4 Rename the user-facing app to `Weather` (`name`, `label`, `ui.title`); keep id `hoodie-weather` so the route, installed state, action names, and catalog filename remain stable. Rebuilt the bundle and re-ran the jsdom harness: ALL TESTS PASSED.
- [x] 5.5 Add `hoodieWeatherBundle` to the explicit import list in `pkg/src/apps/catalog.ts` and to `CATALOG` (alphabetical, between `eight-ball` and `mac-puzzle`); `bun tests/catalog-harness.ts` → ALL CATALOG CHECKS PASSED (10 apps).

## 6. NWS naming and original artwork

- [x] 6.1 Make one direct `api.weather.gov/points` request only when the saved label is exactly `Current location`, and read `properties.relativeLocation` city/state
- [x] 6.2 Persist the same coordinates with that name through `set_location` and update the displayed label immediately, without a second weather fetch
- [x] 6.3 Keep naming independent and silent: the forecast is always Open-Meteo, naming failure leaves `Current location` with no notice or error, and named or default places never contact NWS
- [x] 6.4 Replace the hand-drawn verdict SVGs with the four original HoodieWeather repo PNGs, inlined as data URIs so the bundle stays self-contained and external-src-free
- [x] 6.5 Extend the jsdom harness: naming success and persistence, no naming for named/default places, silent naming failure, no `forecastHourly` fetch, and the inlined artwork
