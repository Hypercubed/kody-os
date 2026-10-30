# Kindle Scribe capabilities → framework decision (locked down on-device 2026-10-25)

## Decision: VANILLA-ONLY. No framework.

Server-rendered HTML + plain forms + full-page navigation. The Scribe runs Chromium 80 with working JS, fetch, timers, events, DOM, and storage — so vanilla JS and the fetch fast path are normal tools, not gambles. No React/Vue/Svelte/Alpine/HTMX-bundle, no client-side router: still unjustified weight for an e-ink browser with limited memory.

Amendment, 2026-10-29 (agent-app-authoring Phase 1): the vanilla-only decision stands for the shell itself, and per-app framework vendoring is not the recommended path. A single framework provided by the shell itself, free to every stateful app, is the Phase 2 direction of that change; its selection has not landed and no provided surface exists yet. Until it lands, stateful bundles follow the hand-rolled contract in `adding-an-app.md`. See the binding-ceiling section below and the shell-provided-framework note in that guide.

## Decision rule (from starter) applied

- Rule: modern ES + CSS grid reliably on Scribe → light framework *allowed*.
- Finding: on-device probe proves Chromium 80, ES2019-safe JS, working fetch/XHR/timers/events/storage, CSS grid. Quirks and refresh costs still dominate e-ink rendering. → Stay vanilla, server-render first, use JS/fetch freely within the ES2019 ceiling.
- Either-way constraints from starter stand: no animation, big tap targets,
  full-page navigation.

## The binding ceiling (canonical statement)

This section is the single place that states the JavaScript ceiling. Other docs cross-reference it; they do not restate their own version. Added 2026-10-29, agent-app-authoring Phase 1.

- **Engine with on-device evidence: Chromium 80** on Android 9, proven by the on-device probe of 2026-10-25 (user agent in section 1 below). No on-device evidence in this package names Chromium 75, and no probe tested what Chromium 75 does. Do not cite Chromium 75, and do not claim any construct crashes it.
- **Ceiling: ES2019 and earlier, for JavaScript that executes in the Scribe browser** — bundle scripts and the shell client. Code at or below ES2019 is the ceiling; anything newer is excluded whether or not a newer engine might run it, because it is unproven on this device.
- **Excluded as post-ES2019 / unproven on device:** optional chaining, nullish coalescing, `String.prototype.replaceAll`, `Array.prototype.at`, and any other syntax or API newer than ES2019. The probe proved the ES2019 features listed in section 2 (JSON, Promise, Symbol, Map/Set, `Object.assign`, `Array.prototype.includes`, `String.prototype.startsWith`, plus the DOM, network, and storage surface there); it did not test the excluded constructs, so they are excluded as unproven, not as proven to crash.
- **Not part of the ceiling:** the Counter bundle additionally avoids arrow functions, `const`/`let`, `async`/`await`, and template literals. Those are all at or below ES2019, so avoiding them is that bundle's conservative style (and its harness check), not a binding rule. A bundle using them does not violate the ceiling.
- **CSS companion rule** (stated here with the ceiling): no flexbox `gap`; grid `gap` is allowed. System fonts only, zero emojis, 48px minimum tap targets.

## Evidence (named source per claim)

### 1. Engine: Chromium 80 on Android 9 (PROVEN on-device 2026-10-25)
- On-device probe UA: `Mozilla/5.0 (Linux; Android 9; Kindle Build/1.0)
  AppleWebKit/537.36 (KHTML, like Gecko) ... Chrome/80.0...` — the Scribe
  runs Blink/Chromium, not the decade-old WebKit fork the forums describe.
  The old MobileRead/NetFront reports describe Paperwhite-era browsers and
  do NOT apply to current Scribe firmware.
  Source: on-device probe (`/probe`, report store `kody-os.probe.reports`).

### 2. JS/DOM/network/storage: all proven on-device 2026-10-25
- Server-rendered probe page (`/probe`, ES5-only script) executed fully:
  `json/promise/symbol/mapset/objectAssign/arrayIncludes/stringStartsWith`
  all true (ES6+ engine, ES2019 ceiling safe); `fetch`/`xhr` present AND
  same-origin round-trips succeed (`fetchWorks=yes`, `xhrWorks=yes`);
  `setTimeout` fires (`timer5000=fired`); click/touchstart/mousedown
  listeners fire (`event-click=fired`); `querySelector`, `addEventListener`,
  `classList`, `getComputedStyle` all present.
- Storage works: `localStorage=yes`, `sessionStorage=yes`, cookies set and
  read back (`cookie=yes`). Viewport 930x1132 CSS px.
- CSS: grid (`cssGrid=true`), flex basis, and custom properties all present.
- The old "limited ES5 / possibly zero JS" reports (kindle-web-tools on
  2020 Paperwhite firmware, one Scribe anecdote, koboWebApps) are superseded
  for current Scribe firmware. (Side note: the Scribe in this test shipped
  with JavaScript toggled OFF — worth checking before blaming the engine.)
  Source: on-device probe beacons + manualnav summary
  (`probeVersion=6|json=true|fetch=true|xhr=true|fetchWorks=yes|
  xhrWorks=yes|timer5000=fired|event-click=fired|cssGrid=true|
  localStorage=yes|cookie=yes`).
- v9 closed the rest (probe `probeVersion=9`, same on-device run):
  `Blob` + `FileReader` + `objectURL` create/revoke all work;
  `new WebSocket()` THROWS on construction — treat WebSockets as
  UNAVAILABLE (same shape as the old Paperwhite failure, now confirmed
  on current firmware); `SyncManager` present but `PeriodicSyncManager`
  ABSENT (one-shot sync surface exists, periodic does not;
  service-worker *registration* untested); Notifications API present
  but permission `denied` by default — do not prompt;
  `requestAnimationFrame` fires; `MutationObserver` and
  `IntersectionObserver` present; `CustomEvent` constructor works;
  `matchMedia("(monochrome)")` is false — do not branch on it.
- Device facts (single sample, treat as approximate): 2 CPU cores,
  0.5 GB device memory, screen 930x1240 CSS px at DPR 2 with 24-bit
  color, viewport 930x1132 CSS px. `navigator.onLine` flipped between
  runs — do not trust it.
- Still untested (do not depend on): service-worker registration +
  offline caching, `showNotification`, clipboard writes, geolocation
  permission flow, WebRTC, WebGL.
- Custom elements v1 WORKS: `customElements` registry present, `define`
  succeeds, instances upgrade on `createElement` (`customElementUpgrade=
  upgraded`, probe v7). Frameworks stay excluded on cost, not capability.

### 3. ReKindle probe finding: vanilla is the proof
- ReKindle (rekindle.ink) runs in the stock Kindle browser with zero
  framework: `kindle.html` installer guide loads one first-party script
  (`theme.js`); no React/Vue/Svelte/CDN libs found; one named third-party
  lib (`epub.js`, Reader only). E-ink discipline is CSS:
  `transition: none !important; animation: none !important`. Observable URL
  structure is multi-page routes (`/help`, `/privacy`, `/changelog`,
  `kindle.html`), dashboard behind sign-in — consistent with full-page
  loads, not an SPA shell.
  Source: live fetch of rekindle.ink 2026-10-25;
  https://rekindle.ink/kindle
- Press corroboration that ReKindle works inside the built-in Kindle browser
  as lightweight web apps (not native installs).
  Source: https://www.pocket-lint.com/rekindle-ereader-apps/

### 4. Kobo/Kindle cross-notes (why we don't generalize from Boox)
- Kobo e-ink: Kobo itself states e-ink "partially support[s] Javascript"
  but "not strong enough to suggest content creators expect it".
  Source: https://github.com/kobolabs/epub-spec/issues/68
- Reddit r/kobo (Elipsa 2E): Kobo browser "does not support the advanced
  features of HTML and JavaScript that most modern sites use".
  Source: https://www.reddit.com/r/kobo/comments/18mumvi/web_browser_support_on_elipsa_2e/
- Counterpoint scoped OUT: AlexChambers/e-ink-dashboard shows full ES6,
  flexbox/grid, fetch, storage passing — but on a **Boox Note Air 2**
  (Android WebView/Chromium), 70% compat, 41 FPS measured. That is a modern
  Android tablet engine, not the Kindle Experimental Browser. It sets the
  ceiling for "good e-ink browsers", not the Scribe floor.
  Source: https://github.com/AlexChambers/e-ink-dashboard

### 5. Viewport: large, sharp, but touch-sloppy
- Scribe panel: 10.2" diagonal, 1860×2480 px at 300 PPI, CSS viewport
  reported as 1860×2480 portrait (1× assets correct).
  Source: https://1440px.com/screen-sizes/kindle-scribe/
- Touch imprecision documented on Kindle browsers: button visual feedback
  fires only once (no redraw on second press), `<textarea>` gesture
  selection unsupported, `prompt()` confirms on spacebar via on-screen
  keyboard, press-and-drag selection must stay in one line.
  Source: https://github.com/martin-at-ipal/kindle-web-tools

### 6. E-ink refresh: ghosting punishes partial redraws
- Ghosting (previous screen visible under new page) is normal e-ink
  behavior; Kindle's "Page Refresh" setting forces a full refresh every
  turn to clear it. Scribe owners report flicker + erase residue.
  Source: https://www.pocket-lint.com/i-got-rid-of-page-ghosting-by-changing-this-kindle-setting/,
  https://www.amazonforum.com/s/question/0D5at00000Y7AaZCAV/ghosting-on-new-kindle-scribe
- e-ink-dashboard guidance (applies to all e-ink): 1–10 FPS normal;
  animations/transitions cause ghosting; batch DOM changes, minimize
  updates, high-contrast static layouts.
  Source: https://github.com/AlexChambers/e-ink-dashboard

## What this means for kody-os (binding constraints)

1. **Server-render every state change.** Actions are
   plain `<form method="GET">` + full-page navigation (edge-safe on the
   package-app subdomain). A guarded same-origin GET fetch fast path
   (`form.app-action` + `?format=json`, `Accept: application/json`, in-place
   `[data-field]` refresh with native-submit fallback) is
   allowed and encouraged where `fetch`/JSON parsing exist — but never
   require timers, WebSockets, client routing, or frameworks.
2. **Inline `<style>` only; no external stylesheets.** Per Scribe first-hand
   report of no external stylesheets; keep one small inline block.
3. **No reliance on localStorage/cookies for function.** They work, but
   treat them as cache only: session may end on Home. All state lives
   server-side in packageStorage().
4. **No animations/transitions** (`transition: none !important;
   animation: none !important`, per ReKindle). No canvas tricks, no
   auto-refresh, no polling.
5. **Big tap targets, high contrast, 16px+ fonts**, black-on-white, 2px flat
   borders. 1860×2480 portrait is generous — use a single column, large
   tiles, generous spacing; also fine on phone/desktop.
6. **Framework explicitly excluded**, including "light" ones: not because
   the engine can't run them (it can), but because e-ink punishes their
   cost — runtime weight, re-render churn, and timers on a 1–10 FPS display
   with limited memory. Vanilla ES2019 is the ceiling, not the floor.
   (Amendment 2026-10-29: this excludes per-app frameworks and any
   framework the shell would have to ship per bundle. A single
   shell-provided framework for stateful bundles is the Phase 2
   direction noted at the top of this document; it does not exist yet,
   and nothing in this constraint selects or promises one.)
7. **Absolute script/navigations URLs only — never bare relative ones.**
   The Scribe resolves relative subresource/navigations URLs against the
   page path as if it were a directory (`/probe` + `probe-report` →
   `/probe/probe-report`, a dead route). Build URLs in JS from
   `window.location.pathname` up to the last `/`. Server-rendered links
   and forms are unaffected (the shell emits absolute paths).

## Verification: CLOSED on-device 2026-10-25

- Render + form GET + back-navigation confirmed; JSON fast path fires and
  updates in place on capable browsers, falls back to navigation otherwise.
- fetch, XHR, timers, events, storage, grid: all proven by `/probe`
  (see §2). Do not assume beyond what is proven (WebSockets, Blob,
  background sync remain untested). Keep the probe app (`/apps/probe`) — re-run it
  after major firmware updates.
