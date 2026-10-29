# Example apps

Installable reference definitions. Each file installs verbatim via MCP `add_app` with no shell or package changes. The local preview seeds from this directory, so every file proves verbatim install.

Files:

- `counter.bundle.json` — unified counter fixture. Retained as the contract fixture: smoke tests, guide, and fast-path verification depend on it. State (`count`) plus `set_count`/`reset_count` actions (effects arrays); the bundle stepper writes through the shared `set_count` action.
- `eight-ball.bundle.json` — Magic 8-Ball bundle. True random shake in-page via vanilla JS with zero navigation; the shake answer persists best-effort through the shared `record_answer` action when reachable.
- `clock.bundle.json` — live clock bundle, modal placement (`placements: modal`). Vanilla JS, updates at most once per minute. Opens as a home overlay.
- `xkcd.bundle.json` — xkcd comics as a live RSS feed. Fetches through the shell's same-origin feed proxy first (`capabilities.feeds`, 1h TTL), then tries `xkcd.com/rss.xml` directly; shows the comic image with its alt text and falls back to the stored feed when both fetches are blocked. The stored feed starts empty; a live fetch or `set_feed` fills it.

Rules for all files: one unified shape (meta + `bundle` + `stateSchema` + `set`/`append` actions, optional `capabilities`, no `kind`), ES2019 only, system fonts only, zero emojis, all CSS and JS inlined, well under the 256 KiB cap, no external stylesheets or scripts. Shell-rendered UI actions are plain GET forms; bundle in-page buttons additionally write through the same `act()` handler via the GET action URL (`?action=<name>&...&format=json` guarded `fetch` with full-navigation fallback, preserving `k` when present).

## Install via MCP `add_app`

Submit the parsed file object as `definition`. From a shell with the repo checked out:

```bash
node -e 'var fs=require("fs"); var def=JSON.parse(fs.readFileSync("pkg/examples/counter.bundle.json","utf8")); console.log(JSON.stringify({ok:true,id:def.id}));'
```

Then in the agent (Kody MCP), call `add_app` with that definition:

- counter: `add_app(JSON.parse(read pkg/examples/counter.bundle.json))` returns `{ ok: true, id: \"counter\" }`.
- eight-ball: `add_app(JSON.parse(read pkg/examples/eight-ball.bundle.json))` returns `{ ok: true, id: \"eight-ball\" }`.
- clock: `add_app(JSON.parse(read pkg/examples/clock.bundle.json))` returns `{ ok: true, id: \"clock\" }`.
- xkcd: `add_app(JSON.parse(read pkg/examples/xkcd.bundle.json))` returns `{ ok: true, id: \"xkcd\" }`.

Re-adding the same id overwrites the definition and resets state to initial. Reference lists (pins, hidden flags, homepage placement, registry order) survive overwrite; only `remove_app` scrubs them.

Verify each install:

1. `list_apps` includes the id.
2. Open `GET /apps/<id>` and confirm it renders.
3. eight-ball: tap Shake, answer updates with no navigation.
4. clock: home tile links to `#app-clock` and the overlay opens with advancing time and no navigation.
5. xkcd: open `GET /apps/xkcd` and confirm the status line reads "Live fetch (proxy)" (or the direct/stored-feed fallback when the proxy is unreachable) and a comic image with its alt text renders.

## Tests

`tests/` holds jsdom harnesses for the example bundles — behaviour tests an agent can run without Kody, the hosted OS, or the preview server. Nothing in `tests/` is an installable definition, and the preview does not seed from it. The only harness today is the counter one:

- `tests/counter-tests.cjs` — reads `counter.bundle.json` as stored and checks the definition shape (id, schema version 4, effects arrays, 256 KiB cap, ES2019 ceiling), the stepper's coalesced `set_count` behaviour (rapid clicks, clamp, divergence, fetch failure), and the bundle's sync with the shell: it starts from the shell-rendered `[data-field]` span, keeps that span in sync while stepping, and adopts the shell Reset form's in-place span patch into its display and internal count, including a Reset that lands while a `set_count` is in flight. It also checks the Reset submit itself: the bundle claims it in the capture phase, paints 0 at once, and sends `set_count=0` through the same single-flight queue as the step buttons (so a step taken after Reset, or a stale response landing after Reset, cannot lose or resurrect the old value), with a sequenced fallback for engines that do not deliver submit capture, and that non-Reset forms are not claimed. The harness simulates the shell side with the exact markup `renderAppSection` renders; the server-side `reset_count` action itself is verified through `act()`, not here.

Run it with jsdom installed ephemerally (no test runner, no `node_modules` in the repo):

```bash
mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom
node pkg/examples/tests/counter-tests.cjs
```
