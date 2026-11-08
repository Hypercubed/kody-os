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
- **Access** — who can open the app is decided by Kody's permission system, not by the shell: grant Use / `app:execute` on the app to let someone in, revoke the grant (or sign out of Kody) to end their access. The shell performs no access check of its own. Package visibility and `internet_visible` are independent toggles — warning: turning `internet_visible` on exposes the app to anyone on the internet, with no shell gate left. Local `kody dev --target mock` needs no credential because there is no gate at all. Agents use MCP exports, which are governed by Kody's `package:execute` / org access, unchanged by the browser shell. There is no code, no session, and no secret to configure. Full steps: [Setup guide](docs/setup.md).

## Setup

Setting up a fork of kody-os (fork, publish, sign-in, first app) is covered start to finish in the [Setup guide](docs/setup.md). Start there; the sections below assume the OS is already set up.

## How to know it is working

- Home shows live widgets for pinned apps, or the honest **no widgets yet** empty state pointing at Apps Edit's **Add to home** control.
- Apps lists installed apps as tiles, or the honest **no apps yet** empty state.
- An app page shows its description, live state fields, and one form button per declared action.
- Submitting an action works without JavaScript and returns to the app page showing the new state.

## Adding and removing apps

An app is a JSON definition in package storage, not code. An agent calls MCP `add_app` and the app appears on the Apps page with no republish. The same definition works in the hosted OS and the local `kody dev` preview; the two stores are separate, so add it to each target.

See [Adding an app](.agents/skills/adding-an-app/SKILL.md) for the definition contract, both paths, verification, homepage placement, export, and removal. See [Scribe limitations](docs/scribe-limitations.md) for the binding Kindle Scribe constraints.

### Adding an app

Copy this to your Kody-connected agent and fill in the bracketed parts:

> Add a new app to my hosted kody-os app on Kody. First open the published guide with Kody search entity `package:kody-os#.agents/skills/adding-an-app/SKILL.md` and the Scribe constraints at `package:kody-os#docs/scribe-limitations.md`, then follow that definition contract. Use the package's `add_app` through the Kody MCP `execute` wrapper. Validate before writing, verify with `list_apps` and `get_app_state`, and do not publish or change the package source. Do not add it to the homepage unless I ask. Ask me before writing if any detail is missing or ambiguous. When the need is a small toy with JS behavior (random shake, live clock), write a bundle (entry `index.html`, relative `.html`/`.js`/`.css` only, 256 KiB cap, vanilla ES2019, inlined, zero emojis); otherwise stay on the shared validated-state operators.
>
> - Name: [display name]
> - What it does: [describe what it should do]

### Removing an app

Removing is agent-only: there is no Remove button in the browser for a custom app. Hiding an app in Apps Edit is not removing it — a hidden app is still installed. An agent calls MCP `remove_app`, which deletes the definition, its state, and every reference to it.

Copy this to your Kody-connected agent and fill in the bracketed part:

> Remove [app id] from my hosted kody-os app on Kody. Use the package's `remove_app` through the Kody MCP execute wrapper. Ask me before removing if any detail is missing or ambiguous.

Catalog apps are the exception: once the App Catalog is installed, an up-to-date catalog app has a Remove button in the Store itself.

## Adding the App Catalog

A fresh shell starts empty — nothing is installed, including the App Catalog (the Store). Until it is installed there is no in-browser way to install catalog apps, so ask your agent to add it, the same way you would add any app:

> Add the App Catalog to my kody-os shell. Follow the app-store recipe (https://github.com/Hypercubed/kody-os/blob/main/catalog/app-store/RECIPE.md).

Once installed, the Store installs, updates, and restores catalog apps from the browser — no agent needed. Updates never run on their own. Pinning, hiding, and adding apps to Home still live in Apps Edit, not in the Store. (In local development, install it with `scripts/catalog.ts` — see `pkg/AGENTS.md`.)

## Changing the shell settings

The shell's settings — name, title, icon, background, and whether the Help and About pages show — have two layers. The file `settings.json` holds the defaults a fork ships with; changing those means editing the file and republishing. Everything else is a live override, stored in the shell's storage under `kody-os.shell.theme` and changed by your agent, with no file edit and no republish. Only the fields you name change; the rest keep their current values.

Ask your agent what it can change, and what the settings are now:

> What shell settings can you change on my kody-os, and what are they set to now? Use the package's `get_shell_theme` through the Kody MCP execute wrapper.

Then just tell it what to change, in plain words — for example, "Change my kody-os background to paper and hide the About page." The agent changes it with `set_shell_theme`, and can undo one field with `reset_shell_theme`. A change that fails validation writes nothing, so a bad value cannot leave the settings half-changed. Removing an app never touches these settings.

What can change: `name` (header brand), `title` (document-title prefix; blank falls back to the name), `icon` (a short glyph or a sanitized inline SVG; blank keeps the default Kody mark), `background` (`desk`, `paper`, or a custom 8×8 grid), and `showHelp` / `showAbout` (whether the built-in Help and About pages and their menu links show).

Prefer buttons to words? Install the Settings app from the App Catalog. It shows each setting's current value and where it comes from (file default or override), with controls for background, name, title, and icon, plus per-field and reset-all buttons.

For forks, the defaults live in `settings.json` (all fields optional): `name` (header brand + title suffix), `title` (document-title prefix override), `icon` (short glyph or a sanitized inline SVG; empty keeps the default Kody mark), `background` (`desk`, `paper`, or a custom 8×8 grid object `{ "grid": [r0..r7] }` of eight 0-255 row bytes, MSB left, drawn black on paper as a repeating tile). Invalid grids or SVG fall back to the stock look, as do a missing file, missing field, or broken JSON.

Every shell page also links `public/favicon.png` (the official Kody mark, served at `<app>/_assets/favicon.png`) as its favicon, and the same file is the default upper-left header mark when `settings.json` sets no `icon`. The same file carries `showHelp` / `showAbout` (both default to shown) to hide the built-in Help and About pages and their menu links.

## License

Kody OS is licensed under the MIT License. See [`LICENSE`](LICENSE) in this package. An identical copy lives at the repository root.


