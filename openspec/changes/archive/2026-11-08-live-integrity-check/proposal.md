# Proposal: Live integrity check against the published package

## Why

The v4.1.0 publish shipped a package whose MCP surface was not importable. In Kody execute, `import { install_from_catalog } from 'kody:@hypercubed/kody-os'` (and `add_app`, `list_apps`, `act`, `get_app_state`) failed with "No matching export", because the execute runtime resolves a `kody:` import to the app entry (`pkg/src/app.ts`), which only exported `default` and `getTheme` — not to the ESM `exports` entry (`pkg/src/index.ts`), which exports the MCP functions. The package's own module wiring (`exports`, `kody.app.entry`) had not changed since Oct 25, when the same import pattern worked, so nothing in the repo signalled the break.

We only caught it because the user happened to ask for the App Catalog install. Had the package gone public on v4.1.0, no agent could have installed any app from it — the primary install path (agent `install_from_catalog` / `add_app`) was broken, and there was no check that would have caught it. The fix (re-exporting the MCP surface from `app.ts`, v4.1.1) restored the imports, but the gap remains: nothing verifies the *published* package is actually usable after a publish.

## What changes

- A **live integrity check** that runs against the **published** Kody package (via cloud execute on the MCP bridge), after every publish and before the package is made public or announced. It is a gate, not a suggestion: if it fails, the package stays private and is not announced.
- The check is **read-only**: it imports and reads only. It installs nothing, writes no state, and does not mutate the live instance.
- The check asserts, at minimum:
  1. **MCP import resolution** — the named MCP exports are importable from the app entry in cloud execute (a namespace import returns the expected keys, not just `default`; single named imports resolve).
  2. **List** — `list_apps()` returns the installed apps.
  3. **Catalog** — `list_catalog()` (with the declared base) returns the catalog apps.
  4. **App Catalog installed and up to date** — the installed `app-store` definition matches its catalog manifest entry (fingerprint comparison), so the Store itself is usable.
  5. **State read** — `get_app_state()` reads live state for an installed app.
- The check lives as a versioned script in the repo and exits non-zero naming the failed check, so a publish pipeline (or a person) can treat it as a pass/fail gate.
- This formalises the two release-verification items already owed: the post-tag `kody dev` browser end-to-end (handoff 09 substitution) and `public-pinned-catalog` 3.1 (real-release verification). Those remain the browser-UI half; this check is the MCP/API half. They are complementary, not the same check.

## What does not change

- No package code changes (no `pkg/` change, no version bump from this change alone).
- No install-path change (the gates, the catalog source model, and the Store are unchanged).
- No commit, push, or publish in this change.
- The check does not install a canary app, does not write state, and does not make the package public. Making the package public remains the user's explicit call.
