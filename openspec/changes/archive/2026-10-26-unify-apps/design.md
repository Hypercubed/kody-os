# Design

## Context
See proposal.md Why. Today `registry.ts:574` refuses `act` on bundles, `writeBundleDefinition` writes empty state/actions, templates `hello|generic|clock` render in `client.ts`. Probe lives outside apps at `/probe*` with `kody-os.probe.*` keys.

## Goals / Non-Goals
- Goals: one type, all apps actionable, generic set/append, probe as app, retire templates + `/probe*`.
- Non-Goals: no expression language, no computed fields (see tictactoe change), no new placements.

## Decisions
1. **Bundle UI + state, always** — every app carries `bundle.files` and `stateSchema`. Why: authors learn once. Alternative (keep operator shortcut) rejected: preserves the split.
2. **Set/append only** — `set {field, value|fromArg}`, `append {field, value, cap, maxEntry}` for lists. `increment/toggle/reset` shimmed to `set` for one release. Why: all current uses collapse to set; append covers probe. Alternative (keep 4 ops) rejected: keeps baked-in vocabulary.
3. **Bridge = forms + fetch to `act()`** — bundle JS posts same `actFromForm` map, no new endpoint. Why: one handler, atomicity free. Alternative (direct storage from JS) rejected: breaks trust boundary.
4. **Export v3, import v2** — add `bundle` + generic effects to envelope, accept v2 on import. Why: portable, rollback via re-add.

## Risks / Trade-offs
- [Risk] Existing installs reference `kind` → Mitigation: validator migrates on read, re-save drops `kind`.
- [Risk] Bundle JS spam-writes → Mitigation: arg validation + caps + code gate unchanged.
- [Risk] Probe ungated reliance breaks → Mitigation: probe app stays ungated at `/apps/probe` until owner gates it.

## Migration Plan
1. Land unified types + validator + `act` + render.
2. Migrate `hello-counter`, `eight-ball`, `clock` same-id, verify preview.
3. Convert probe, retire `/probe*` + template code.
4. Rollback: re-add prior JSONs; no key renames to unwind.

## Open Questions
- None.
