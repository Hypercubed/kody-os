# Dynamic app definition (working spec — night shift continues here)

## Current contract (implemented in `pkg/src/apps/`)
- `AppDefinition`: name (slug), label/icon/category, `ui` (template + actions; `ui.template` is deprecated and frozen at `hello | generic | clock`, bundles for anything visual), `stateSchema` (typed fields: integer/string/boolean + initial), `actions` (args schema + declarative effect).
- Effects today: `increment` / `set` / `toggle` / `reset`. Atomic: validate everything, then single write.
- MCP: `list_apps`, `get_app_state`, `act`, `add_app`, `export_app` (+ `get_app`, `import_app`).
- UI: one generic route `/apps/:name`, fields + one GET form per action (`?action=...`), 303 → app page. `POST /apps/:name` remains for API clients only.

## Open gap (user-confirmed 2026-10-25)
Closed vocabulary: anything needing custom logic (win detection, computed values, conditionals) can't be expressed. Phase 2 proves the plumbing; the vocabulary must grow before "any app" is real.

## Candidate extensions (to evaluate)
1. Conditional effects (`when` clauses on state/args).
2. Computed/derived fields (win/draw, totals) evaluated at read time.
3. Multi-field set + compare-and-swap semantics.
4. Per-template layouts (counter vs note vs board) — rendering side.
5. Validation expressions (beyond min/max/maxLength).

## A2UI evaluation (open, raised 2026-10-25)
- A2UI (a2ui.org, Google open standard, v1.0 spec) is the closest existing framework: agents emit declarative JSON UI intent, client renders natively, no arbitrary code — same philosophy as our definitions.
- Open questions: Scribe-safe subset (their renderers assume modern JS — our shell would need to server-render an A2UI subset to plain HTML); action model fit (their events vs our validated `act()`); spec stability.
- Next: spike-map counter to A2UI JSON, test what subset server-renders cleanly. Candidate Phase 3 entry task.

## Rules that must survive any extension
- State lives in storage; actions validated before mutation; bad action = clean error, zero partial writes.
- Same handler for UI + MCP. Export/import stays portable JSON.
- UI actions are GET forms (`GET /apps/:id?action=...`) with a hidden `k` field on the `?k=` path. Kody's edge rejects cross-origin POSTs to the package-app subdomain (`Cross-origin mutating requests to a package-app subdomain are not allowed.`), so a mutating POST in the app UI is a hard bug, not a style choice. POST stays for API clients that send a same-origin `Origin`.
- 16 MiB storage budget; definitions stay small JSON.

---

## Decision (2026-10-25, overnight spec work)

**Chosen: minimal additive v2 — preconditions + effect sequences + templated
field refs + `cycle`/`fromField` + `enum` + first-match derived fields +
`board` template.** Evaluated against the five candidates above: conditional
effects and computed fields are both needed for tic-tac-toe, but they collapse
into ONE mechanism (a `Condition` type shared by action `requires` and derived
`rules`), so no expression language is introduced. Multi-field set falls out of
effect sequences. Validation grows by one keyword (`enum`). Layouts grow by one
template (`board`). Nothing else changes.

Proven by `pkg/src/apps/tictactoe-proof.mjs` (self-contained v2 evaluator +
full-game assertions, `node`-verified 28/28): X-win, occupied-cell rejection,
post-game rejection with atomicity (failed acts change nothing), draw game,
`new_game` reset, arg-boundary rejections, JSON portability (3.7 KiB),
UI-form string coercion. Sketch types in `pkg/src/apps/extended-types.ts`
(design artifact only — `registry.ts`/`index.ts` untouched, Phase 2 contract
byte-for-byte intact).

### Schema deltas (v2, all additive; format `kody-os-app/2`, importer accepts /1)

1. `ActionDef.requires?: Condition[]` — every entry must hold against the
   merged stored+derived view before any effect runs; first failure aborts
   with an error, zero writes. Rejected alternative: an `assert` effect op
   (two abort mechanisms instead of one).
2. `ActionDef.effects?: ActionEffect[]` — ordered sequence on a state copy,
   schema-validated, single write. Exactly one of legacy `effect` / `effects`
   required. A move is `[set c{cell}, increment moves, cycle turn]`.
3. `{arg}`-templated `field` refs (`"c{cell}"`), resolved from validated args
   in `requires` and effects. One `move` action covers 9 cells. Rejected:
   nine move0..move8 actions (portability smell); single-string board +
   substring-set op (one-game-only semantics).
4. `set` gains `fromField` (copy stored field — turn mark into cell); new
   `cycle` op `{ field, values }` rotates `turn` through `["X","O"]`.
   Rejected: full expression language in effects (breaks JSON auditability).
5. `enum?: Primitive[]` on state fields and action args. Cells stay in
   `["","X","O"]`. (Range/length checks already exist.)
6. `stateSchema.derived?: Record<string, { default, rules: { when:
   Condition[], value }[] }>` — first match wins, evaluated at READ time
   (get/act responses, UI render), never stored, visible to `requires`.
   `winner`: 16 line rules (8 lines × X/O) + default `""`; `isDraw`:
   `moves=9 ∧ winner=""`. Rejected: generic computed-expression eval
   (arbitrary code inside portable definitions).
7. UI: template `"board"` + `board: { cells: [9 field names], status? }`;
   per-button fixed `args` (`{ action: 'move', args: { cell: 4 } }` renders
   as hidden fields — still plain forms, no JS). Generic section rendering
   unchanged for all other templates.

### Tic-tac-toe as data (shape of the Phase 3 app)

- Stored: `c0..c8` (string enum `["","X","O"]`), `turn` (enum
  `["X","O"]`, initial `"X"`), `moves` (integer 0–9).
- Derived: `winner`, `isDraw` (above).
- Actions: `move { cell: 0–8 }` (requires: game live + cell empty; effects:
  set/cycle/inc as above), `new_game` (`reset`).
- Atomically safe: every guard runs before the copy is touched; the proof
  asserts failed acts leave state identical.

### Rules-preservation check

- Atomicity: requires → copy → per-effect typecheck → full-schema validate
  → single write. Same four checkpoints as Phase 2, one earlier.
- UI/MCP-shared handler: button-fixed args arrive as the same string map
  `actFromForm` already funnels; coercion proven in the harness.
- Portable export: derived rules are JSON (`when`/`value`); export carries
  definition + stored state only (derived recomputed on import/read).
  3.7 KiB for the whole game — storage budget untouched.

### Phase 3 implementation checklist (registry/shell work, not this spec)

1. Port `Condition`/`derived`/`cycle`/`fromField`/`enum`/templating into
   `registry.ts` (`validateDefinition`, `act`) + `board` rendering into
   `client.ts` (+ button `args` hidden fields).
2. Accept `kody-os-app/2` on import, keep writing `/1`-compatible output
   when no v2 keys are used; keep `/1` definitions validating unchanged.
3. Add the real `tic-tac-toe` definition + migrate the proof assertions into
   the repo's test lane.
4. Retire `extended-types.ts`/`tictactoe-proof.mjs` sketches once ported
   (they must not become a second implementation).
