# Design: os-theme-file

## Context

See proposal.md (Why). Shell chrome hardcodes `kody-os` in the title tag and header brand (`src/app.ts`); background lives in `public/styles.css`, inlined at build into `src/shell-css.ts`. Kody bundles package files, so any file in `pkg/` is a static import — there is no runtime filesystem read on the Worker.

## Goals / Non-Goals

- Goals: one fork-editable file; missing file/fields fall back to today's rendering; no MCP or publish-flow changes.
- Non-goals: runtime theming without republish (that's packageStorage territory, explicitly rejected in explore); per-app themes; theme validation UI.

## Decisions

1. **JSON file, dynamically imported with a missing-file fallback** (`pkg/os-theme.json` via `import('../os-theme.json', { with: { type: 'json' } })` from `src/app.ts`, rejection meaning absent-or-broken → `{}`).
   *Why*: JSON is fork-friendly (no code syntax to break); the dynamic form resolves at request time through a cached promise and treats a missing file as `{}` so absent-file installs render byte-identically (a static import would fail the build instead). A `.ts` export would invite logic in a data file. Alternative (read + `JSON.parse` at request time) is impossible — no fs on the Worker.
2. **Fallbacks inline at use site** (`theme.name || 'kody-os'`), not a merged config object.
   *Why*: three call sites, each with an obvious default; a merge helper would be abstraction without a second caller.
3. **Background stays in CSS; theme file holds a background token only if it maps to an existing CSS value.**
   *Why*: the inlined generated CSS must stay byte-identical to `styles.css`. Free-form background CSS from JSON would break the Scribe byte-identical guarantee — so v1 supports a small closed set (e.g. paper/desk), anything else is a theme-track change, not this file.

## Risks / Trade-offs

- [Risk] JSON syntax errors break the build → Mitigation: the dynamic import rejects on malformed JSON and the shell falls back to defaults, so a broken file degrades to the stock look instead of a 500; `repoRunChecks` still gates publish; keep the file tiny with a README note.
- [Risk] Forks diverge and can't take upstream shell fixes cleanly → Mitigation: accepted; single-file surface keeps merges trivial.

## Migration Plan

None: absent file = current rendering. Rollback is a republish of the prior commit.

## Open Questions

None — field set (name, icon, background token, title) confirmed in explore; icon path-vs-glyph settles at implementation (default: current glyph behavior).
