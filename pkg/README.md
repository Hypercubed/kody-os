# Kody OS

Minimal OS shell shared by humans and agents. Apps are JSON definitions in package storage — rendered by one generic shell, acted on through one shared handler, identically via the human UI and via MCP. Browser-first, high-contrast, e-ink-friendly. Kindle Scribe compatibility is a hard constraint: ES2019 only, no external stylesheets, no emojis.

Current: **v0.2.0** — data-driven apps, homepage widgets, server-side feed proxy, hardened response headers, bridge adapter (`window.KodyBridge` v1), JSON state seed, schemaVersion 5.

## Screenshots

Files live in `public/screenshots/` (served at `<app>/_assets/screenshots/`).

![Home dashboard](public/screenshots/home.png)
![All apps](public/screenshots/apps.png)
![Counter app](public/screenshots/counter.png)
![Puzzle app](public/screenshots/puzzle.png)

## What it does

- **Home** — pinned widgets with live content, reorderable with corner arrows; honest empty state when nothing is pinned yet.
- **Apps** — every installed app as a tile; edit mode pins, hides, and reorders the home dashboard.
- **App pages** — description, live state, and one plain-form button per declared action. Actions work with JavaScript disabled (GET form + redirect) and enhance in place where scripting runs.
- **Feeds** — apps can declare allowlisted HTTPS upstream feeds (`capabilities.feeds`) read through `GET /feed/:app/:name`, same-origin with storage caching. No auth is forwarded upstream; errors never echo the URL.
- **Access** — the browser shell is locked by one-time codes so e-ink devices open it without Kody login. Each code is 4 digits, single use, valid 10 minutes; entering it burns the code and mints a 30-day session cookie with clean, code-free URLs. A derived device code (HMAC of the Kody `access-key` secret, UI-managed, never stored) remains as fallback. Agents use MCP exports, which are never gated. Full steps: [Device key](docs/device-key.md).

## Setup

Setting up a fork of kody-os (fork, publish, unlock, first app) is covered start to finish in the [Setup guide](docs/setup.md). Start there; the sections below assume the OS is already set up.

## How to know it is working

- Home shows live widgets for pinned apps, or the honest **no widgets yet** empty state pointing at Apps → Edit → **Add to home**.
- Apps lists installed apps as tiles, or the honest **no apps yet** empty state.
- An app page shows its description, live state fields, and one form button per declared action.
- Submitting an action works without JavaScript and returns to the app page showing the new state.

## Adding an app

An app is a JSON definition in package storage, not code. An agent calls MCP `add_app` and the app appears on the Apps page with no republish. The same definition works in the hosted OS and the local `kody dev` preview; the two stores are separate, so add it to each target.

See [Adding an app](docs/adding-an-app.md) for the definition contract, both paths, verification, homepage placement, export, and removal. See [Scribe limitations](docs/scribe-limitations.md) for the binding Kindle Scribe constraints.

### Recommended prompt

Copy this to your Kody-connected agent and fill in the bracketed parts:

> Add a new app to my hosted kody-os app on Kody. First open the published guide with Kody search entity `package:kody-os#docs/adding-an-app.md` and the Scribe constraints at `package:kody-os#docs/scribe-limitations.md`, then follow that definition contract. Use the package's `add_app` through the Kody MCP `execute` wrapper. Validate before writing, verify with `list_apps` and `get_app_state`, and do not publish or change the package source. Do not add it to the homepage unless I ask. Ask me before writing if any detail is missing or ambiguous. When the need is a small toy with JS behavior (random shake, live clock), write a bundle (entry `index.html`, relative `.html`/`.js`/`.css` only, 256 KiB cap, vanilla ES2019, inlined, zero emojis); otherwise stay on the shared validated-state operators.
>
> - App id: [slug]
> - Name: [display name]
> - What it does: [one sentence]

## Local development (`kody dev`)

Run the real shell locally from `pkg/` with bundled build, persistent mock storage, and live-reload:

```sh
cd pkg
# proxy bypass required on this host
export NO_PROXY='*' no_proxy='*'
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY

kody dev --target mock
# → App ready at http://127.0.0.1:4302/
```

Then seed the dev gate code and the `counter` fixture (one-time per fresh mock store):

```sh
cd pkg
kody execute --target mock --file scripts/seed-dev-hash.ts --params '{"code":"local-dev-code-123456"}'
python3 -c "import json; d=json.load(open('examples/counter.bundle.json')); json.dump({'op':'add','definition':d}, open('/tmp/add.json','w'))"
kody execute --target mock --file scripts/registry.ts --params "$(cat /tmp/add.json)"
```

Open `http://127.0.0.1:4302/?k=local-dev-code-123456` (VSCode port-forward 4302 to reach it remotely). Home shows `via key` when unlocked; Apps lists `counter`; `GET /apps/counter` returns 200; old `hello-counter` id returns 404.

Useful checks: `kody dev check --target mock --offline`, `kody dev fetch "/apps/counter?k=local-dev-code-123456" --target mock`, `curl http://127.0.0.1:4302/__kody/dev/status`. Persistent server across sessions: `systemctl --user enable --now kody-os-dev.service`. No `job`/`webhook`/`emit` handlers are declared, so those subcommands correctly report `(none)`.

## Theme file

Forks rebrand by editing `os-theme.json` (all fields optional): `name` (header brand + title suffix), `title` (document-title prefix override), `icon` (short glyph or a sanitized inline SVG; empty keeps the checkerboard mark), `background` (`desk`, `paper`, or a custom 8×8 grid object `{ "grid": [r0..r7] }` of eight 0-255 row bytes, MSB left, drawn black on paper as a repeating tile). Invalid grids or SVG fall back to the stock look, as do a missing file, missing field, or broken JSON.


