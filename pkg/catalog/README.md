# Example apps

Installable reference definitions. Each file installs verbatim via MCP `add_app` with no shell or package changes. Nothing here seeds automatically: install each file explicitly through `add_app` (hosted MCP path or the `kody dev` local path in `docs/adding-an-app.md`), so every file proves verbatim install.

The Counter bundle is the reference implementation for the bundle/shell interaction contract in `docs/adding-an-app.md` (state-span initial read, shell-form capture/sequencing, single-flight queue, `data-action-base` resolution). Copy its pattern for a new stateful bundle; do not copy its stricter-than-ceiling script style as a rule (see the ceiling note in the Tests section below).

Files:

- `counter.bundle.json` — unified counter fixture. Retained as the contract fixture: smoke tests, guide, and fast-path verification depend on it. State (`count`) plus `set_count`/`reset_count` actions (effects arrays); the bundle stepper writes through the shared `set_count` action.
- `eight-ball.bundle.json` — Magic 8-Ball bundle. True random shake in-page via vanilla JS with zero navigation; the shake answer persists best-effort through the shared `record_answer` action when reachable.
- `clock.bundle.json` — live clock bundle, modal placement (`placements: modal`). Vanilla JS, updates at most once per minute. Opens as a home overlay.
- `xkcd.bundle.json` — xkcd comics as a live RSS feed. Fetches through the shell's same-origin feed proxy first (`capabilities.feeds`, 1h TTL), then tries `xkcd.com/rss.xml` directly; shows the comic image with its alt text and falls back to the stored feed when both fetches are blocked. The stored feed starts empty; a live fetch or `set_feed` fills it.

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
- xkcd: `add_app(JSON.parse(read pkg/catalog/xkcd.bundle.json))` returns `{ ok: true, id: \"xkcd\" }`.

Re-adding the same id overwrites the definition and preserves state by default (declared fields carried forward, dropped fields reset to `initial`); pass `resetState: true` to restore the legacy wipe, or `migrate` to rename fields. Reference lists (pins, hidden flags, homepage placement, registry order) survive overwrite; only `remove_app` scrubs them.

Verify each install:

1. `list_apps` includes the id.
2. Open `GET /apps/<id>` and confirm it renders.
3. eight-ball: tap Shake, answer updates with no navigation.
4. clock: home tile links to `#app-clock` and the overlay opens with advancing time and no navigation.
5. xkcd: open `GET /apps/xkcd` and confirm the status line reads "Live fetch (proxy)" (or the direct/stored-feed fallback when the proxy is unreachable) and a comic image with its alt text renders.

## Pre-`add_app` authoring checklist

Before calling `add_app` on a new bundle, run the checklist in `docs/adding-an-app.md` (definition validates; bundle renders in `kody dev`; state initializes from the shell span; shell-form actions stay in sync under rapid/overlapping input; ES2019 scan clean; no `window.location.pathname`-only action URLs; stateful bundle follows the interaction contract). The verification path is exactly one: the `kody dev` end-to-end check in that guide plus the jsdom harness pattern below. There is no other supported local verification path, and no reference to removed preview tooling remains in this package.

## Tests

`tests/` holds jsdom harnesses for the example bundles — behaviour tests an agent can run without Kody, the hosted OS, or a running `kody dev` server. Nothing in `tests/` is an installable definition. The only harness today is the counter one:

- `tests/counter-tests.cjs` — reads `counter.bundle.json` as stored and checks the definition shape (id, schema version 4, effects arrays, 256 KiB cap, ES2019 ceiling), the stepper's coalesced `set_count` behaviour (rapid clicks, clamp, divergence, fetch failure), and the bundle's sync with the shell: it starts from the shell-rendered `[data-field]` span, keeps that span in sync while stepping, and adopts the shell Reset form's in-place span patch into its display and internal count, including a Reset that lands while a `set_count` is in flight. It also checks the Reset submit itself: the bundle claims it in the capture phase, paints 0 at once, and sends `set_count=0` through the same single-flight queue as the step buttons (so a step taken after Reset, or a stale response landing after Reset, cannot lose or resurrect the old value), with a sequenced fallback for engines that do not deliver submit capture, and that non-Reset forms are not claimed. The harness simulates the shell side with the exact markup `renderAppSection` renders; the server-side `reset_count` action itself is verified through `act()`, not here.

Run it with jsdom installed ephemerally (no test runner, no `node_modules` in the repo):

```bash
mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom
node pkg/catalog/tests/counter-tests.cjs
```

Ceiling note: the harness checks the Counter bundle's stricter-than-ceiling style (no arrow functions, `const`/`let`, `async`/`await`, or template literals in its script). That style is this bundle's conservative choice, not the binding rule — the binding ceiling is ES2019 and earlier, stated once in `docs/scribe-limitations.md`. Do not reject a new bundle for using `const`, an arrow function, or `async`/`await` alone; reject it for post-ES2019 syntax or APIs.

The live complement to the harness is the `kody dev` end-to-end leg in `docs/adding-an-app.md`: seed the counter fixture through `pkg/scripts/registry.ts`, start `kody dev --target mock`, and check the real shell rendering with `kody dev fetch` (app page markup, action submit, fresh state on reload). The harness simulates the shell-client patch; `kody dev` is the check that the real shell renders the markup the harness assumes.
