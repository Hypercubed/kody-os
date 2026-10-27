# Kody OS

## Intent

Kody OS is a minimalist operating-system shell shared by humans and agents. Phase 2 adds a data-driven app layer: apps are definitions stored in Kody package storage, rendered by one generic shell and acted on through one shared handler — identically via the human UI and via MCP. Its browser-first interface is designed for high-contrast, e-ink-friendly use. Kindle Scribe compatibility is a hard constraint: ES2019 only, no external stylesheets, no emojis.

## Prerequisites

Nothing to install. To unlock a device, the owner mints a 4-digit one-time
code via the package MCP export `mint_otp` and reads it to the device
holder, who types it into the unlock form. A correct code burns on first
use and sets a session cookie — no code ever appears in a URL. MCP exports
are not gated, so agents keep working while the browser is locked. With no
secret defined, the app serves Kody-logged-in visitors only and stays
private.

## Access

The browser shell is locked by one-time codes so the Kindle Scribe can
open it without Kody login. Each code is 4 digits, single use, and valid
10 minutes; entering it mints a session cookie (30-day expiry) and the
browser stays unlocked with clean, code-free URLs. A derived device code
(HMAC of the Kody `access-key` secret, UI-managed, never stored) remains
as fallback. Full steps: [Device key](docs/device-key.md).

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

Forks rebrand by editing `pkg/os-theme.json` (all fields optional): `name` (header brand + title suffix), `title` (document-title prefix override), `icon` (short glyph or a sanitized inline SVG; empty keeps the checkerboard mark), `background` (`desk`, `paper`, or a custom 8×8 grid object `{ "grid": [r0..r7] }` of eight 0-255 row bytes, MSB left, drawn black on paper as a repeating tile). The file carries commented examples in `_comment`; invalid grids or SVG fall back to the stock look. A missing file, missing field, or broken JSON also falls back to the stock look.
