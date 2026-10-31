# Design

## Context

See proposal.md — Why. The binding constraints are the app contract in
`pkg/docs/adding-an-app.md`: `capabilities.feeds` are static HTTPS URLs fixed
at install (the route takes a feed name, never a URL), the bundle is ES2019
with everything inlined under 256 KiB, timers/polling may not be required, and
all persistence flows through `set`/`append` actions. The feed proxy fetches
server-side with a fixed User-Agent, caches by TTL, and serves stale-on-error.
On the device side, `pkg/docs/scribe-limitations.md` records fetch/XHR/JSON
working, but the geolocation permission flow as untested and WebSockets dead;
the Scribe has no GPS chip. ReKindle's `weather.html` is the reference for
what an e-ink weather app actually needs: authored locations (hardcoded
default, manual override, typed city search via Open-Meteo geocoding) and a
direct CORS-open weather fetch — no geolocation anywhere.

## Goals / Non-Goals

**Goals:**

- A faithful four-way verdict (raincoat/jacket/hoodie/t-shirt) from the next
  hour's forecast, rendered in shell-native monochrome.
- A location story with a working floor (declared feed), a direct set
  (search + MCP), and an enhance-only discovery leg — each degrading to the
  next, always honestly labeled.
- Everything built from existing surfaces: `add_app`, `act` with args,
  `capabilities.feeds`, the feed proxy, the bridge. Zero shell/registry change.

**Non-Goals:**

- No server-side fetching of arbitrary locations (would require an operator
  change to let a request name a URL — explicitly out of scope).
- No forecast beyond the next hour (no hourly strip, no 5-day list), no
  alerts, no units toggle — ReKindle has them; HoodieWeather doesn't.
- No reverse geocoding: a discovered place is labeled "Current location".
- No auto-refresh cadence matching the original's 5-minute interval.

## Decisions

**D1 — Data source: Open-Meteo, not NWS.**
One request takes `lat`/`lon` in the URL (no `points` → `gridpoints` hop),
returns a small payload with `apparent_temperature` and
`precipitation_probability` already computed — exactly the classifier's two
inputs — and sends `Access-Control-Allow-Origin: *`, which the direct-fetch
legs require. It is also ReKindle's source, and the original HoodieWeather
carries it as its own commented-out fallback. Rejected: NWS (faithful to the
original's *source* but not its behavior) — two-step URL resolution the static
feed allowlist can't express, a fixed-User-Agent risk in the proxy, and a
40–90 KB hourly payload. NWS remains available later as a second feed without
spec changes.

**D2 — Three-layer location resolution with a proxy floor.**
L1: one declared feed whose static URL is the default place's Open-Meteo
query — always works, cache-backed, needs no JS beyond parsing. L2: saved
place fetched directly from the browser; set by city search (geocoding
endpoint, direct fetch) or MCP `act("set_location", …)`. L3: `navigator.
geolocation` attempted once per load only when nothing is saved.
Alternatives considered: proxy-only (rejected — the URL is static, so a
saved place could never ride it); all-direct (rejected — no floor when the
edge or network blocks cross-origin fetch); geolocation-first (rejected —
untested on device and the whole app would hang on it). The fallback decision
is spec'd as "label what you show" rather than "retry forever".

**D3 — State is the place, nothing else.**
`stateSchema.fields = { lat, lon, label }` with initial values equal to the
default place; `set_location` (args, one `set` effect) and a no-argument
`restore_default` (fixed values) — the latter exposed as a shell `ui.actions`
button so the no-JS path can reset. The verdict and forecast are derived and
never persisted: caching weather in state would freeze stale readings behind
the shell's span patch. Rejected alternative: storing the last verdict for
widget display, because a widget renders the bundle live anyway.

**D4 — Bridge, not hand-rolled sync.**
The bundle is stateful (one durable setting) and shares `restore_default`
with a shell form, so it follows the recommended path:
`window.KodyBridge.create(section, …)` with `dispatch('set_location', …)`
(absolute set → `rebase` returns null, server wins), `claimForm` for the
shell's restore button, and `startSpanObserver()` so a native no-JS reset is
adopted on reload and an in-capable-browser patch repaints the bundle. The
Counter bundle is the reference. Hand-rolled rules 4–6 would work but
re-implement exactly this.

**D5 — Fetch choreography in the bundle.**
On init: read seed → resolve effective place (saved → discovered → default)
→ if a non-default place applies, direct-fetch its weather with a timeout;
on any failure fall back to the L1 proxy feed and raise the "saved place
unreachable" notice; the Refresh control re-runs the same sequence. Guarded
`fetch` only (probe-confirmed on device), full render from whatever source
wins, no source mixing. Geocoding input is debounced and fetched directly;
the query string never touches a declared feed (validator-visible in the
spec's feed-allowlist scenario).

**D6 — Next-hour reading.**
Request `current` plus a bounded `hourly` window (`forecast_days=1`,
`timezone=auto`) and take the first hourly slot at or after "now" in the
location's timezone — the equivalent of NWS `periods[0]`. Bounding the query
keeps the L1 proxied payload small enough for a modest `maxBytes`
(≤ 131072) and under the proxy's 8-second fetch timeout.

**D7 — Icons and layout.**
Four inline monochrome SVGs (hoodie, jacket, t-shirt, raincoat) drawn in the
bundle in the same stroke style as the shell's SVG icons, toggled by the
verdict; label, temperature, conditions line, and rain chance as plain text
rows using the shell's `os-*` classes. No images, no animation, tap targets
≥ 48 px.

**D8 — Landing spot and verification.**
`pkg/catalog/hoodie-weather.bundle.json` (installable verbatim), a jsdom
harness in `pkg/catalog/tests/` following the counter pattern (verdict
classifier table, layer fallback, shell-form adoption), and a catalog README
entry. Local verification through `kody dev` + `kody dev fetch`; hosted via
MCP `add_app`.

## Risks / Trade-offs

- [Direct fetch to CORS-open hosts may be blocked on the hosted edge or the
  Scribe's network] → L1 proxy floor plus the spec'd notice; the device spike
  (task group in tasks.md) measures this before anything depends on it.
- [Geolocation permission flow untested on Scribe] → enhance-only: absence
  changes nothing visible, at most one prompt per load, default place renders
  regardless.
- [Open-Meteo is a single unauthenticated upstream; schema or availability
  changes] → guarded parse with error state + Retry (spec'd); the verdict
  logic is isolated behind one small adapter function so a source swap (e.g.
  NWS as a second feed) doesn't touch the classifier.
- [Proxy TTL means up to 15 minutes of stale default-place weather] → 600 s
  TTL; the direct legs bypass the cache entirely; Refresh only helps past TTL
  — accepted for a next-hour verdict.
- [Bridge span-observer edge cases around `restore_default` (stale patch vs
  optimistic repaint)] → same shape as Counter's reset path, covered by the
  harness scenarios rather than discovered on device.
- [Wind-chill formula misuse] → avoided entirely by using the source's
  `apparent_temperature` (D1); the formula fallback only applies when the
  source lacks it.

## Migration Plan

New app, no existing state: install through `add_app` (hosted) and the
`registry.ts` script (local mock) with no schema migration. Rollback is
`remove_app` — it scrubs definition, state, and reference lists. Re-adding an
existing id overwrites the definition and preserves state by default; if the
place fields ever change name, `migrate` handles it.

## Open Questions

- Which default place ships in the definition (owner's city vs ReKindle's
  New York) — install-time choice; the spec only requires *a* static default.
- Whether the app earns a mention in `pkg/docs/adding-an-app.md` as a
  canonical example — depends on the device spike results, deferred there in
  the proposal.
- Whether geocoding search deserves an MCP surface later (`search_cities`) so
  agents can set a place without a browser — no spec change needed to add it,
  since `set_location` already covers the write side.
