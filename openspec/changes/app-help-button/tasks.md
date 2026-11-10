## 1. Definition field — `ui.help`

- [ ] 1.1 Add `help?: string` to `UiDef` in `pkg/src/apps/types.ts`, documented as plain-text how-to-use text shown in the app-header help dialog (distinct from `description`, the what-it-is-for text shown on the app page body and as a tile tooltip)
- [ ] 1.2 Validate in `pkg/src/apps/definition.ts` (`validateDefinition`): when `ui.help` is present it MUST be a string, else reject with no write (mirror the `ui.menuBar` non-boolean rejection). Canonicalize: preserve a non-empty string, drop an empty or whitespace-only value so it reads as absent. Do NOT extend `AppSummary` — `list_apps()` summaries carry no help
- [ ] 1.3 Verify the round-trip: `add_app` with `ui.help` installs, `export_app` / `import_app` into a blank store preserves it, and the fingerprint changes when help is added or changed (so a catalog app gaining help bumps `catalogVersion` +1 by the existing rule). Verify a non-string `ui.help` writes nothing and an empty-string `ui.help` installs with no help button

## 2. App-page header — shell titlebar button + dialog

- [ ] 2.1 In `pkg/src/app.ts`, thread the stored definition's `ui.help` into `shellChrome` on app pages (`renderAppPage`, including the fallback render): when help is defined, render a help box (`<a class="os-help">?</a>`, `aria-label="Help"`, `title="Help"`, `href="#help-<id>"`) in the titlebar slot immediately left of the expand box (`right: 3rem`, expand stays at `right: 0`). When help is absent, render nothing — the titlebar is byte-identical to today
- [ ] 2.2 In the same change, render the help dialog in the app-page body, server-side: a `<div role="dialog">` with the app title, the escaped help text (line breaks preserved), and a close link to the app page URL without a fragment. Hidden by default, revealed only when it matches `:target`. The dialog SHALL NOT be rendered on the dashboard, Apps page, Help/About pages, or 404 page, and SHALL NOT appear when help is absent

## 3. Modal-overlay header — panel titlebar button + dialog

- [ ] 3.1 In `pkg/src/apps/client.ts` (`renderAppPanel`), when the definition carries help, render the same help box immediately left of the modal-expand box and add a `has-help` class to the titlebar (widening its right padding for two 3rem slots, mirroring `has-close` / `has-expand`), so the title plate is never covered. When help is absent, render nothing — the panel header is byte-identical to today
- [ ] 3.2 In the same change, render the help dialog inside the overlay panel (`renderOverlaySection` path), with its close link pointing at `#app-<id>` so closing help returns to the overlay, not to the Apps page. The dialog SHALL NOT be rendered in home widgets

## 4. Styles

- [ ] 4.1 Add the help-box and dialog styles to `pkg/public/styles.css` (source of truth): `.os-help` as the shared box — same outlined-square look and 48px hit slot as close/expand, with the `?` as element text, positioned `right: 3rem` in both `.os-titlebar` and `.app-titlebar`; `.app-titlebar.has-help` right padding for two slots; the dialog hidden by default, revealed on `:target`, with `white-space: pre-wrap` on its body and no animation, no gradient, no flexbox gap, system fonts only. Regenerate `pkg/src/shell-css.ts` so the two stay byte-identical
- [ ] 4.2 Verify the 48px slots hold at Scribe width and under 30rem for close, help, expand, and collapse together, and that a long app title still truncates with ellipsis instead of pushing a box out of the bar

## 5. Reference consumer + docs

- [ ] 5.1 Add a short help string to the Counter catalog app (one or two short lines saying what the controls do) as the reference consumer, with its `catalogVersion` +1, the catalog index regenerated (`bun scripts/build-catalog-index.ts`), and the catalog harness passing on it
- [ ] 5.2 Document `ui.help` in `pkg/.agents/skills/adding-an-app/SKILL.md` (definition table: field, plain-text, dialog behavior, absent-means-no-button) and in the `ui` field list in `pkg/AGENTS.md`. Update `pkg/AGENTS.md` and `pkg/README.md` headers to the new version in the same commit as the bump (MINOR: a new optional field plus a new chrome control, nothing existing breaks; build +1 on publish). The release itself is the user's call and is not a step in this change

## 6. Verification

- [ ] 6.1 Node renders (or the repo harness equivalent where a `kody dev` check cannot run here — record any substitution, do not mark a check done that was not run): app page with help shows the button left of expand and the dialog hidden until `#help-<id>`; app page without help shows no button and no dialog markup; modal overlay with help shows the button left of modal-expand and the dialog closes back to the overlay; dashboard, Apps, Help, About, widget, and 404 pages show no help button
- [ ] 6.2 Escaping + fragments: help text containing markup (e.g. `<script>`, `<a href>`) renders escaped with no element created; `#help-<id>`, `#app-<id>`, and `#os-full` coexist on one page without collision; opening help from the expanded view returns the window to its normal layout with app state untouched
- [ ] 6.3 Ceilings + spec: ES2019 grep zero hits for `?.` / `??` / `replaceAll` / `.at(` in the touched files, `node --experimental-strip-types --check` passes on the touched sources, and `openspec validate` passes for the change
- [ ] 6.4 Scribe verification — the `?` glyph legibility in the 48px box and the dialog readability on the Scribe (the specific unknown this change has: a text glyph in a title-bar box at e-ink resolution). Verify on the device that the button reads as `[?]` at a glance, the dialog text is readable, and opening/closing help works without JavaScript. If a Scribe check cannot run, record that openly and do not mark it done
- [ ] 6.5 Record the close-out note in this file (what was actually verified, what was substituted, and what was left open) before archiving
