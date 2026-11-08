# Kody OS

Minimal OS shell shared by humans and agents. Apps are JSON definitions in package storage — rendered by one generic shell, acted on through one shared handler, identically via the human UI and via MCP. Browser-first, high-contrast, e-ink-friendly. Kindle Scribe compatibility is a hard constraint: ES2019 only, no external stylesheets, no emojis.

## Screenshots

<img src="public/screenshots/home.png" alt="Home dashboard" width="400">
<img src="public/screenshots/apps.png" alt="All apps" width="400">
<img src="public/screenshots/help.png" alt="Help page" width="400">
<img src="public/screenshots/about.png" alt="About page" width="400">

## What it does

- **Home** — pinned widgets with live content, reorderable with corner arrows; honest empty state when nothing is pinned yet.
- **Apps** — every installed app as a tile; Edit mode pins, hides, and adds apps to the home dashboard.
- **App pages** — description, live state, and one plain-form button per declared action. Actions work with JavaScript disabled (GET form + redirect) and enhance in place where scripting runs.
- **Feeds** — apps can declare allowlisted HTTPS upstream feeds (`capabilities.feeds`) read through `GET /feed/:app/:name`, and generic allowlisted upstreams (`capabilities.proxy`) read through `GET /proxy/:app/:name`, same-origin with storage caching. No auth is forwarded upstream; errors never echo the URL.
- **Access** — the browser shell serves only platform-verified Kody visitors, so any browser signed in to Kody opens it, including e-ink devices. There is no code, no session, and no secret to configure: Kody login is verified per request. Under the local mock target the gate is skipped entirely. Agents use MCP exports, which are never gated. Full steps: [Setup guide](docs/setup.md).

## Setup

Setting up a fork of kody-os (fork, publish, sign-in, first app) is covered start to finish in the [Setup guide](docs/setup.md). Start there; the sections below assume the OS is already set up.

## How to know it is working

- Home shows live widgets for pinned apps, or the honest **no widgets yet** empty state pointing at Apps Edit's **Add to home** control.
- Apps lists installed apps as tiles, or the honest **no apps yet** empty state.
- An app page shows its description, live state fields, and one form button per declared action.
- Submitting an action works without JavaScript and returns to the app page showing the new state.

## Adding an app

An app is a JSON definition in package storage, not code. An agent calls MCP `add_app` and the app appears on the Apps page with no republish. The same definition works in the hosted OS and the local `kody dev` preview; the two stores are separate, so add it to each target.

See [Adding an app](.agents/skills/adding-an-app/SKILL.md) for the definition contract, both paths, verification, homepage placement, export, and removal. See [Scribe limitations](docs/scribe-limitations.md) for the binding Kindle Scribe constraints.

### Recommended prompt

Copy this to your Kody-connected agent and fill in the bracketed parts:

> Add a new app to my hosted kody-os app on Kody. First open the published guide with Kody search entity `package:kody-os#.agents/skills/adding-an-app/SKILL.md` and the Scribe constraints at `package:kody-os#docs/scribe-limitations.md`, then follow that definition contract. Use the package's `add_app` through the Kody MCP `execute` wrapper. Validate before writing, verify with `list_apps` and `get_app_state`, and do not publish or change the package source. Do not add it to the homepage unless I ask. Ask me before writing if any detail is missing or ambiguous. When the need is a small toy with JS behavior (random shake, live clock), write a bundle (entry `index.html`, relative `.html`/`.js`/`.css` only, 256 KiB cap, vanilla ES2019, inlined, zero emojis); otherwise stay on the shared validated-state operators.
>
> - Name: [display name]
> - What it does: [describe what it should do]

## Theme file

Forks rebrand by editing `settings.json` (all fields optional): `name` (header brand + title suffix), `title` (document-title prefix override), `icon` (short glyph or a sanitized inline SVG; empty keeps the default Kody mark), `background` (`desk`, `paper`, or a custom 8×8 grid object `{ "grid": [r0..r7] }` of eight 0-255 row bytes, MSB left, drawn black on paper as a repeating tile). Invalid grids or SVG fall back to the stock look, as do a missing file, missing field, or broken JSON.

Every shell page also links `public/favicon.png` (the official Kody mark, served at `<app>/_assets/favicon.png`) as its favicon, and the same file is the default upper-left header mark when `settings.json` sets no `icon`. The same file carries `showHelp` / `showAbout` (both default to shown) to hide the built-in Help and About pages and their menu links.

## License

Kody OS is licensed under the MIT License. See [`LICENSE`](LICENSE) in this package. An identical copy lives at the repository root.


