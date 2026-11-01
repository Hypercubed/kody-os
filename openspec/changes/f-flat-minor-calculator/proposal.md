# Proposal

## Why

The shipped Calculator is a basic four-function
calculator: JS numbers, a 12-digit display, no
stack, no user definitions, no exact large-integer
arithmetic. It cannot do what f-flat-minor does:
exact big-integer stack calculation, user-defined
words, quotations, and a standard library, up to
and including 100 factorial as an exact 158-digit
integer.

f-flat-minor (Hypercubed/f-flat-minor) is a tiny
stack-oriented toy language, the baby brother to
f-flat. Its rules fit the Scribe unusually well:
minimal dependencies, parsing by splitting on
whitespace, and a stack that consists of only
big integers. The Scribe question that gated this
whole change has now been answered on-device
(see design.md, Research): JavaScript BigInt is
proven on the Scribe, and WebAssembly is not
available as a fallback, so a JS BigInt interpreter
is the one viable route, and it is unblocked.

This change adds that interpreter as a separate
kody-os app, alongside Calculator, not as a
replacement for it.

## What Changes

- One new app, id `f-flat-minor`, label
  "F-flat-minor", category `utilities`:
  a scaled-back, engine-only F♭m interpreter
  (see design.md, Decision 2) in a single
  vanilla-JS bundle, with the f-flat-minor
  standard library prelude loaded at startup.
- The app is delivered in v1 as a registry
  write via `add_app`, exactly like the other
  data apps. Per `pkg/AGENTS.md` ("Adding an
  app"), that is no package change, no commit,
  and no republish: the definition is data in
  `packageStorage()`, and it appears in
  `list_apps()` and on the Apps page as soon
  as `add_app` returns `{ ok: true }`.
- The definition follows the existing contract:
  `schemaVersion` 5, empty `stateSchema`,
  `actions: {}`, no `act()` calls, no state
  in the shell sense. All calculation state
  (stack, queue, definitions, output) lives
  in the bundle's page session only, mirroring
  the Calculator pattern ("Runs fully in the
  page, no saved state").
- The standard library is not ported by hand
  and is not resolved at runtime. It is
  generated once, on a dev machine, by running
  the f-flat-minor repo's own preprocessor over
  `ff/lib/prelude.ffp`, and shipped as a data
  string inside the bundle, which the engine
  interprets at startup (design.md, Decisions
  3 and 4). There is no runtime `.import`,
  `.load`, macro, compiler, optimizer, or
  bytecode step in the app.
- Docs: one row in `pkg/catalog/README.md`
  and, if the app is later shipped in the
  catalog, one entry in `pkg/docs/adding-an-app.md`
  is not needed (the app follows the existing
  contract); instead the change documents the
  generation step in `pkg/docs/` only when
  catalog shipping lands (tasks, Phase 2).

## Capabilities

### New Capabilities

- `f-flat-minor-app`: a BigInt stack calculator
  with user definitions, quotations, strings,
  comments, and the full f-flat-minor prelude,
  in a Scribe-safe bundle.

### Modified Capabilities

- None in v1. No existing app, route, action,
  MCP export, or shell behavior changes. The
  Calculator app is untouched.
- Catalog shipping (Phase 2, optional,
  tasks section 6) modifies `app-registry`
  only by adding one catalog bundle, one
  `catalog.ts` import line, and one README
  entry, in the same pattern as the existing
  catalog apps.

## Impact

- v1: one `add_app` definition, written to
  the live store and to the local mock store
  separately (the two stores are separate,
  per `pkg/docs/adding-an-app.md`). No file
  in `pkg/` changes, so no version decision
  is triggered by v1 at all.
- Phase 2 (only on user direction):
  `pkg/catalog/f-flat-minor.bundle.json`
  (new), one import line in
  `pkg/src/apps/catalog.ts` (alphabetical),
  one entry in `pkg/catalog/README.md`.
  That is a new feature with nothing existing
  breaking, so it is a MINOR bump per
  `pkg/AGENTS.md`, with BUILD +1 on publish,
  in the same commit as the catalog files.
- Bundle budget: the generated prelude is
  ~25 KiB, the engine and UI are estimated
  at a few tens of KiB combined, well under
  the 256 KiB bundle cap and the 16 MiB
  package storage budget. The cap is checked
  by the catalog harness before shipping.

## Out of Scope

- Replacing Calculator, or changing it in
  any way. The two apps coexist; the basic
  calculator stays the simple one.
- The full TypeScript implementation: CLI,
  REPL shell, file I/O, `.load` / `.import`
  / `.m` / `.inline` / `.unsafe` at runtime,
  the bytecode (base64 VLQ) compiler, the
  optimizer, tests, benchmarks, and the
  Astro web playground. None of these ship
  in the app; the compiler metadata tokens
  are stripped at generation time (design.md,
  Decision 3).
- Wasm: the on-device probe proved Wasm is
  not usable as a whole on the Scribe, so no
  Wasm build, and no Wasm fallback, is in
  this change.
- A runtime preprocessor: a user cannot
  `.import` a file from the app. The only
  library in the app is the prelude generated
  at build time.
- Persisting user definitions across reloads
  in v1. Definitions live for the page session
  only (design.md, Decision 6); persistence
  is an open question, not a v1 promise.
- New-mail-style server work: no shell route,
  no `kody.app.capabilities` declaration, no
  MCP export, and no `act()` action is added
  by this change. The app needs none of them.
