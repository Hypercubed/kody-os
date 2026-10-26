# Kody OS

## Intent

Kody OS is a minimalist operating-system shell shared by humans and agents. Phase 2 adds a data-driven app layer: apps are definitions stored in Kody package storage, rendered by one generic shell and acted on through one shared handler — identically via the human UI and via MCP. Its browser-first interface is designed for high-contrast, e-ink-friendly use. Kindle Scribe compatibility is a hard constraint: ES2019 only, no external stylesheets, no emojis.

## Prerequisites

Nothing to install. The owner's agent configures a device access code over MCP
(`set_access_code`), then opens `?k=<code>` or uses the unlock form. MCP exports
are not gated, so agents keep working while the browser is locked.

## Access

The browser shell is locked by a device access code so the Kindle Scribe can
open it without Kody login. The code is stored only as a SHA-256 hash; rotating
it invalidates every old bookmark and cookie at once. Bookmark
`https://<username>.kody.run/kody-os/?k=<code>` on the device — the shell keeps
the code on every link and in each app form's hidden `k` field, so no cookies
are required.

## How to know it is working

- The home page shows live widgets for apps added to the homepage, or the honest **no widgets yet** empty state pointing at Apps → Edit → **Add to home**.
- The Apps page lists installed apps as tiles, or the honest **no apps yet** empty state.
- An app page shows its description, live state fields, and one form button per declared action.
- Submitting an action works without JavaScript and returns to the app page showing the new state. App actions submit as GET (`?action=...`), so they also work where Kody's edge rejects cross-origin POSTs to the package-app subdomain.

## Adding an app

An app is a JSON definition in package storage, not code. An agent calls MCP `add_app` and the app appears on the Apps page with no republish. The same definition works in the hosted OS and the local `kody dev` preview; the two stores are separate, so add it to each target.

See [Adding an app](docs/adding-an-app.md) for the definition contract, both paths, verification, homepage placement, export, and removal. See [Scribe limitations](docs/scribe-limitations.md) for the binding Kindle Scribe constraints.

### Recommended prompt

Copy this to your Kody-connected agent and fill in the bracketed parts:

> Add a new app to my hosted kody-os app on Kody. First open the published guide with Kody search entity `package:kody-os#docs/adding-an-app.md` and the Scribe constraints at `package:kody-os#docs/scribe-limitations.md`, then follow that definition contract. Use the package's `add_app` through the Kody MCP `execute` wrapper. Validate before writing, verify with `list_apps` and `get_app_state`, and do not publish or change the package source. Do not add it to the homepage unless I ask. Ask me before writing if any detail is missing or ambiguous. When the need is a small toy with JS behavior (random shake, live clock), write a bundle (`kind: bundle`, entry `index.html`, relative `.html`/`.js`/`.css` only, 256 KiB cap, vanilla ES2019, inlined, zero emojis); otherwise stay on the shared validated-state operators.
>
> - App id: [slug]
> - Name: [display name]
> - What it does: [one sentence]

## Theme file

Forks rebrand by editing `pkg/os-theme.json` (all fields optional strings): `name` (header brand + title suffix), `title` (document-title prefix override), `icon` (short glyph; empty keeps the checkerboard mark), `background` (`desk` or `paper`). A missing file, missing field, or broken JSON falls back to the stock look.
