# Example apps

Installable reference definitions. Each file installs verbatim via MCP `add_app` with no shell or package changes. Nothing here seeds automatically: install each file explicitly through `add_app` (hosted MCP path or the `kody dev` local path in `docs/adding-an-app.md`), so every file proves verbatim install.

The Counter bundle is the reference implementation for the bundle/shell interaction contract in `docs/adding-an-app.md` (state-span initial read, shell-form capture/sequencing, single-flight queue, `data-action-base` resolution). Copy its pattern for a new stateful bundle; do not copy its stricter-than-ceiling script style as a rule (see the ceiling note in the Tests section below).

Files:

- `about.bundle.json` — About kody-os, with links and embedded static QR codes for GitHub Sponsors, Ko-fi, and Buy Me a Coffee (for scanning from a Kindle Scribe with a phone). Stateless, no actions, page only, `ui.menuBar: true`; links open the donation sites in a new tab, and no payment is taken inside kody-os.
- `help.bundle.json` — Help, the former static Help page as a catalog app. Stateless, no actions, page only, `ui.menuBar: true`; carries what the OS is, the agent `add_app` prompt, and the setup-guide pointer, with no installed-apps list. `GET /help` redirects to `/apps/help`.
- `counter.bundle.json` — unified counter fixture. Retained as the contract fixture: smoke tests, guide, and fast-path verification depend on it. State (`count`) plus `set_count`/`reset_count` actions (effects arrays); the bundle stepper writes through the shared `set_count` action.
- `eight-ball.bundle.json` — Magic 8-Ball bundle. True random shake in-page via vanilla JS with zero navigation; the shake answer persists best-effort through the shared `record_answer` action when reachable.
- `clock.bundle.json` — live clock bundle, modal placement (`placements: modal`). Vanilla JS, updates at most once per minute. Opens as a home overlay.
- `calendar.bundle.json` — month calendar bundle. Fully JS-driven Sunday-first grid from the device-local date, today highlighted, Prev/Next re-render in place with no navigation, fetch, or act(). Always opens on the current month and keeps no state.
- `news.bundle.json` — six-section news bundle. Stateless: World, Technology, Business, Science, Arts, and Finance, each mapped to one declared HTTPS feed (`capabilities.feeds`, 15-minute TTL) read through the shell's feed proxy `GET /feed/news/<name>` and parsed as XML in-page. Masthead, device-local long-form date, section buttons, at most 10 headlines per section with plain-text summaries truncated to 350 characters and a thumbnail only when the feed supplies one; a failed section shows an error state with Retry. Tapping a headline opens the source article in a new tab — the bundle never fetches article content.
- `hoodie-weather.bundle.json` — **Hoodie Weather***, next-hour clothing verdict (raincoat / jacket / hoodie / t-shirt). One declared Open-Meteo feed (`capabilities.feeds`, 10-minute TTL) for the default place through the shell's feed proxy, a saved place fetched directly with an honest fallback to the default label plus a notice, a debounced city search against Open-Meteo geocoding, MCP `set_location` (integer microdegrees), a no-argument `restore_default` shell action, and enhance-only `navigator.geolocation` attempted once per load only when nothing is saved. State is just the place (`lat`/`lon`/`label`); the verdict and forecast are derived, never persisted, and nothing polls. When geolocation discovers a place labeled `Current location`, one direct `api.weather.gov/points` request reads `relativeLocation` and persists the city/state as the label (for example `Louisville, CO`); naming is US-only, never supplies or blocks the forecast, and fails silently. The four verdict images are the original HoodieWeather repo PNGs, inlined as data URIs.
- `xkcd.bundle.json` — xkcd comics as a live RSS feed. Fetches through the shell's same-origin feed proxy first (`capabilities.feeds`, 1h TTL), then tries `xkcd.com/rss.xml` directly; shows the comic image with its alt text and falls back to the stored feed when both fetches are blocked. The stored feed starts empty; a live fetch or `set_feed` fills it.
- `arrow-game.bundle.json` — Arrow Game bundle. Remove the blue arrows; red arrows are blocked and cost a life, a life every 5 levels, checkpoint fallback. Vanilla ES2019, tap plus best-effort drag, no timer or speed meter. State (board, level, lives, removed) saves through the bridge.
- `cellular-playground.bundle.json` — Cellular Playground bundle. Life, Brian's Brain, and Seeds on a 20 by 14 board, step mode plus a slow 500 ms Play timer, dead edges, board as a digit string. Automaton chosen with three buttons; paint Alive / Empty / Refractory (Refractory only for Brian's Brain).
- `three-bit-art.bundle.json` — 3-Bit Art bundle. 16 by 16 drawing with a saved Pattern/Color toggle (default Pattern): Pattern shows 32 by 32 Bayer ordered-dither tiles at BT.709 luma densities, Color shows solid 3-bit RGB cube colors. Gallery of up to 12 drawings, digit-string state, no canvas.

Rules for all files: one unified shape (meta + `bundle` + `stateSchema` + `set`/`append` actions, optional `capabilities`, no `kind`), ES2019 only, system fonts only, zero emojis, all CSS and JS inlined, well under the 256 KiB cap, no external stylesheets or scripts. Shell-rendered UI actions are plain GET forms; bundle in-page buttons additionally write through the same `act()` handler via the GET action URL (`?action=<name>&...&format=json` guarded `fetch` with full-navigation fallback, preserving `k` when present).

## Install via MCP `add_app`

Submit the parsed file object as `definition`. From a shell with the repo checked out:

```bash
node -e 'var fs=require("fs"); var def=JSON.parse(fs.readFileSync("pkg/catalog/counter.bundle.json","utf8")); console.log(JSON.stringify({ok:true,id:def.id}));'
```

Then in the agent (Kody MCP), call `add_app` with that definition:

- counter: `add_app(JSON.parse(read pkg/catalog/counter.bundle.json))` returns `{ ok: true, id: \"counter\" }`.
- eight-ball: `add_app(JSON.parse(read pkg/catalog/eight-ball.bundle.json))` returns `{ ok: true, id: \"eight-ball\" }`.
- clock: `add_app(JSON.parse(read pkg/catalog/clock.bundle.json))` returns `{ ok: true, id: \"clock\" }`.
- calendar: `add_app(JSON.parse(read pkg/catalog/calendar.bundle.json))` returns `{ ok: true, id: \"calendar\" }`.
- xkcd: `add_app(JSON.parse(read pkg/catalog/xkcd.bundle.json))` returns `{ ok: true, id: \"xkcd\" }`.
- hoodie-weather: `add_app(JSON.parse(read pkg/catalog/hoodie-weather.bundle.json))` returns `{ ok: true, id: "hoodie-weather" }`.
- arrow-game: `add_app(JSON.parse(read pkg/catalog/arrow-game.bundle.json))` returns `{ ok: true, id: "arrow-game" }`.
- cellular-playground: `add_app(JSON.parse(read pkg/catalog/cellular-playground.bundle.json))` returns `{ ok: true, id: "cellular-playground" }`.
- three-bit-art: `add_app(JSON.parse(read pkg/catalog/three-bit-art.bundle.json))` returns `{ ok: true, id: "three-bit-art" }`.

Re-adding the same id overwrites the definition and preserves state by default (declared fields carried forward, dropped fields reset to `initial`); pass `resetState: true` to restore the legacy wipe, or `migrate` to rename fields. Reference lists (pins, hidden flags, homepage placement, registry order) survive overwrite; only `remove_app` scrubs them.

Verify each install:

1. `list_apps` includes the id.
2. Open `GET /apps/<id>` and confirm it renders.
3. eight-ball: tap Shake, answer updates with no navigation.
4. clock: home tile links to `#app-clock` and the overlay opens with advancing time and no navigation.
5. xkcd: open `GET /apps/xkcd` and confirm the status line reads "Live fetch (proxy)" (or the direct/stored-feed fallback when the proxy is unreachable) and a comic image with its alt text renders.
6. hoodie-weather: open `GET /apps/hoodie-weather` and confirm the default place's label, temperature, conditions, rain chance, and one verdict icon render; use Change place to search and select a city and confirm the label and forecast switch without navigation; then set a US place with `act("hoodie-weather", "set_location", { lat, lon, label: "Current location" })` and confirm the label becomes the NWS city/state (or stays `Current location` if NWS is unavailable), with the forecast unchanged.

## Pre-`add_app` authoring checklist

Before calling `add_app` on a new bundle, run the checklist in `docs/adding-an-app.md` (definition validates; bundle renders in `kody dev`; state initializes from the shell span; shell-form actions stay in sync under rapid/overlapping input; ES2019 scan clean; no `window.location.pathname`-only action URLs; stateful bundle follows the interaction contract). The verification path is exactly one: the `kody dev` end-to-end check in that guide plus the jsdom harness pattern below. There is no other supported local verification path, and no reference to removed preview tooling remains in this package.

## Tests

`tests/` holds jsdom harnesses for the example bundles — behaviour tests an agent can run without Kody, the hosted OS, or a running `kody dev` server. Nothing in `tests/` is an installable definition. The harnesses today are the counter one and the hoodie-weather one:

- `tests/counter-tests.cjs` — reads `counter.bundle.json` as stored and checks the definition shape (id, schema version 5, effects arrays, 256 KiB cap, ES2019 ceiling), the stepper's coalesced `set_count` behaviour (rapid clicks, clamp, divergence, fetch failure), and the bundle's sync with the shell: it starts from the shell-rendered `[data-field]` span, keeps that span in sync while stepping, and adopts the shell Reset form's in-place span patch into its display and internal count, including a Reset that lands while a `set_count` is in flight. It also checks the Reset submit itself: the bundle claims it in the capture phase, paints 0 at once, and sends `set_count=0` through the same single-flight queue as the step buttons (so a step taken after Reset, or a stale response landing after Reset, cannot lose or resurrect the old value), with a sequenced fallback for engines that do not deliver submit capture, and that non-Reset forms are not claimed. The harness simulates the shell side with the exact markup `renderAppSection` renders; the server-side `reset_count` action itself is verified through `act()`, not here.

- `tests/hoodie-tests.cjs` — reads `hoodie-weather.bundle.json` as stored and checks the definition shape (single static HTTPS feed, 600–900 s TTL, `maxBytes` cap, effects arrays, one inline style, ES2019 ceiling), the four-way classifier boundary table (rain 30/31%, apparent 50/51/64/65 °F), next-hour slot selection, the wind-chill fallback, saved-place direct fetch and the honest default-label fallback with Retry, the error state when nothing can be loaded, the claimed `restore_default` shell form through the bridge, debounced city search persisting integer microdegrees, NWS naming of a discovered place (and silent failure, and no naming request for named/default places), and geolocation attempted once per load with silent denial and a stale-response guard.

Run them with jsdom installed ephemerally (no test runner, no `node_modules` in the repo):

```bash
mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom
node pkg/catalog/tests/counter-tests.cjs
node pkg/catalog/tests/hoodie-tests.cjs
```

Ceiling note: the harness checks the Counter bundle's stricter-than-ceiling style (no arrow functions, `const`/`let`, `async`/`await`, or template literals in its script). That style is this bundle's conservative choice, not the binding rule — the binding ceiling is ES2019 and earlier, stated once in `docs/scribe-limitations.md`. Do not reject a new bundle for using `const`, an arrow function, or `async`/`await` alone; reject it for post-ES2019 syntax or APIs.

The live complement to the harness is the `kody dev` end-to-end leg in `docs/adding-an-app.md`: seed the counter fixture through `pkg/scripts/registry.ts`, start `kody dev --target mock`, and check the real shell rendering with `kody dev fetch` (app page markup, action submit, fresh state on reload). The harness simulates the shell-client patch; `kody dev` is the check that the real shell renders the markup the harness assumes.
