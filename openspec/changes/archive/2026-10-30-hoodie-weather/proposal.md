# Proposal

## Why

HoodieWeather (Hypercubed/HoodieWeather) is a tiny, beloved app: one question —
hoodie, jacket, t-shirt, or raincoat? — answered from the next hour's forecast.
kody-os has no weather app, and cloning this one forces the first real answer to
how an app learns *where*: the feed proxy only fetches static declared URLs, so
location must be authored, searched for, or (untested on the Scribe) discovered.

## What Changes

- New catalog bundle app `hoodie-weather`: location label, next-hour
  temperature and conditions, and a four-way verdict icon (raincoat / jacket /
  hoodie / t-shirt) computed in bundle JS, faithful to the original's
  classifier (rain chance > 30% → raincoat; apparent temp < 51 °F → jacket;
  < 65 °F → hoodie; else t-shirt). The verdict artwork is the four PNGs from
  the original repository, inlined as data URIs.
- NWS naming only: when geolocation discovers a place, the bundle makes one
  `api.weather.gov/points` request and persists the response's
  `relativeLocation` city/state as the label (for example `Louisville, CO`).
  The forecast always stays Open-Meteo; naming never blocks or replaces it,
  and a naming failure silently leaves the honest `Current location` label.
- Three-layer location resolution, each layer degrading to the next:
  - **L1 default place** — one declared HTTPS feed (`capabilities.feeds`)
    read through the shell's feed proxy; works regardless of device support.
  - **L2 set directly** — city search against a CORS-open geocoding endpoint
    via bundle direct fetch, persisted through a `set_location` action with
    args; the same action is callable via MCP `act()` with no UI at all.
  - **L3 auto discovery** — `navigator.geolocation` attempted enhance-only
    when no place is saved; the permission flow is untested on the Kindle
    Scribe, so failure MUST degrade silently to L1/L2.
- First catalog app whose durable state is a *setting* (saved place) rather
  than a toy value: `stateSchema` fields plus an arg-taking `set` action
  driven by bundle fetch, plus a no-argument shell action so the no-JS path
  can return to the default place.
- No timers: refresh on load and via a manual Refresh control only.
- Catalog entry + jsdom harness + README/docs registration.

BREAKING: none. New app only; no registry, shell, operator, or MCP surface
change — it uses only existing surfaces (`add_app`, `act` with args,
`capabilities.feeds`, the feed proxy).

## Capabilities

### New Capabilities

- `hoodie-weather`: the Weather app — next-hour verdict display,
  three-layer location resolution (declared default feed, direct set via
  search/MCP, enhance-only geolocation discovery), and the hosting/state
  constraints its bundle must satisfy.

### Modified Capabilities

(none)

## Impact

- New: `pkg/catalog/hoodie-weather.bundle.json`, a jsdom harness under
  `pkg/catalog/tests/`, and a `pkg/catalog/README.md` entry.
- Docs: `pkg/docs/adding-an-app.md` gains the app as a canonical example only
  if its location pattern proves out on device.
- Uses existing surfaces exclusively: no change to `src/apps/*`, the feed
  proxy, the bridge, or the shell.
- Device-open questions the spec degrades around: bundle direct fetch to a
  CORS-open host, and the geolocation permission flow on the Scribe.
