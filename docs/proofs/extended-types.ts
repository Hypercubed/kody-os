/**
 * App-definition v2 EXTENSION TYPES (additive proposal — not wired in yet).
 *
 * Status: design artifact for docs/app-definition.md. Nothing imports this
 * file; `registry.ts` / `index.ts` are intentionally untouched (Phase 2
 * contract keeps working byte-for-byte). When Phase 3 adopts the extension,
 * the real implementation should supersede this sketch — not import it.
 *
 * Design goal: the MINIMAL delta that carries tic-tac-toe (9-cell board,
 * turn alternation, win/draw, new game) while preserving the Phase 2 rules:
 * validate-everything-then-single-write, one shared UI+MCP handler, and
 * portable JSON export/import.
 *
 * The v2 delta is six additive pieces (all optional except where noted):
 *
 * 1. `requires: Condition[]` on actions — preconditions checked against the
 *    merged stored+derived state BEFORE any effect runs. First failure aborts
 *    with a clean error and zero writes. Covers "cell empty", "game not over".
 * 2. `effects: ActionEffect[]` (sequence) alongside legacy single `effect` —
 *    exactly one must be present. A move is [set cell, increment moves,
 *    cycle turn]: applied to a COPY, schema-validated, then single write.
 * 3. `{arg}`-templated field references — `field: "c{cell}"` resolves from
 *    validated args, so ONE `move` action addresses all 9 cells instead of
 *    nine near-identical actions.
 * 4. `SetEffect.fromField` (copy stored field, e.g. current turn mark into
 *    the cell) + new `cycle` op (rotate `turn` through ["X","O"]).
 * 5. `enum` constraint on fields and args — cell values stay in ["","X","O"].
 * 6. `derived` first-match rules on the state schema reusing Condition —
 *    `winner` (8 line rules + default "") and `isDraw` evaluated at READ
 *    time, never stored, visible to `requires`, UI, MCP, and export readers.
 * 7. UI: `board` template + per-button fixed `args` (each cell button posts
 *    `move` with its own `cell` index as hidden fields — still plain forms).
 *
 * What was CONSIDERED and rejected:
 * - Full expression/eval language for computed fields: too big, breaks
 *   portable-JSON auditability (arbitrary code in definitions). First-match
 *   rules reuse the Condition vocabulary the validator already needs.
 * - `assert` effect op inside the sequence: preconditions subsume it; one
 *   mechanism for "abort cleanly" instead of two.
 * - Single 9-char board string + substring-set op: invents string-surgery
 *   semantics for one game. Nine enum fields reuse `set` unchanged.
 * - Nine separate move0..move8 actions: expressible but a portability smell;
 *   templated field refs are ~10 lines of resolver and stay generic.
 */

import type { ActionEffect } from './types.ts'

/** A value that can live in state, args, or enum lists. */
export type Primitive = number | string | boolean

/**
 * One precondition or one derived-rule matcher. At least one of `field` /
 * `arg` selects the left-hand side; at least one comparator tests it.
 * `field` may name a stored field, a derived field, or contain `{argName}`
 * placeholders resolved from validated args (e.g. `"c{cell}"`).
 */
export interface Condition {
	field?: string
	arg?: string
	equals?: Primitive
	notEquals?: Primitive
	in?: Primitive[]
	notIn?: Primitive[]
}

/** Copy-another-field variant added to the v2 `set` effect. */
export interface SetEffectV2 {
	op: 'set'
	field: string
	value?: Primitive
	fromArg?: string
	/** Copy the CURRENT value of another stored field (e.g. turn mark). */
	fromField?: string
}

/** Rotate a field through a fixed list: ["X","O"] -> X becomes O, O becomes X. */
export interface CycleEffect {
	op: 'cycle'
	field: string
	values: Primitive[]
}

export type ActionEffectV2 = ActionEffect | SetEffectV2 | CycleEffect

export interface ActionDefV2 {
	description?: string
	args?: Record<string, import('./types.ts').ActionArgDef & { enum?: Primitive[] }>
	/** Legacy single effect (Phase 2 shape) — exactly one of effect/effects. */
	effect?: ActionEffectV2
	/** V2 sequence: applied in order to a state copy, then validated + written once. */
	effects?: ActionEffectV2[]
	/** All must hold (against stored+derived state and resolved args) or abort. */
	requires?: Condition[]
}

/** First-match derived field: first rule whose `when` all hold wins; else default. */
export interface DerivedDef {
	default: Primitive
	rules: Array<{ when: Condition[]; value: Primitive }>
}

export interface UiActionDefV2 {
	action: string
	label: string
	/** Fixed hidden fields posted with this button (e.g. { cell: 4 }). */
	args?: Record<string, Primitive>
}

export interface UiDefV2 {
	template: import('./types.ts').UiTemplate | 'board'
	title?: string
	actions?: UiActionDefV2[]
	/** Board template only: 9 stored-field names in row-major order + status field. */
	board?: { cells: [string, string, string, string, string, string, string, string, string]; status?: string }
}
