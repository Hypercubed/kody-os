# ReKindle research (2026-10-25, from live fetches)

## What ReKindle is
- Web-based dashboard for e-ink devices (Kindle, Kobo, Boox), at rekindle.ink.
- Progressive Web App (PWA). No install / no jailbreak required for base use.
- Style guide only for kody-os — never copy code or assets.

## Stack: vanilla JS, no framework
- `kindle.html` (installer guide) loads one script: their own `theme.js`. Zero React/Vue/Svelte/CDN libs.
- One named third-party lib found in README: `epub.js` for the e-book Reader.
- E-ink discipline is in CSS: `transition: none !important; animation: none !important`.
- Stack: Geneva/Verdana sans, black-on-white, 2px borders, flat panels, text-first.

## URL structure (observed)
- Marketing pages are URL routes: `/help`, `/privacy`, `/changelog`, `kindle.html`.
- Dashboard sits behind sign-in (Guest Mode / Cloud Mode) — in-app routing not observable without an account.
- Working assumption: one full page per app/section (multi-page URLs, not one SPA view). Matches e-ink constraints.

## Feature list (README, scope reference only)
- Quick ToDo+ (OCR handwriting), Google Tasks/Calendar sync, Mail+, CalDAV/CardDAV import, Note Pad, Habit Tracker, Focus Timer, Decider, Mindmap, Teleprompter, Reader (epub.js), Gutenberg/Standard Ebooks/Libby, NetLite (FrogFind text browser), RSS, Daily Kindling newspaper, Reading Log, Oracle AI+ (Gemini 2.5), Atlas (OSM maps), Babel translator, Wikipedia, On This Day.

## Implications for kody-os
- Full-page navigation (`/apps/:name`) matches the observable Rekindle pattern.
- No framework needed to look like ReKindle — vanilla JS + server-rendered HTML suffices.
- Framework decision hinges on Scribe browser limits — see `scribe-limitations.md`.
