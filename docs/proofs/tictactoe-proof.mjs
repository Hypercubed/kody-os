/**
 * V2 semantics PROOF (self-contained, no imports — runnable with plain node).
 *
 * Implements JUST enough of the proposed v2 extension to prove tic-tac-toe
 * is expressible as DATA under Phase 2 rules: validate-everything first,
 * mutate a copy, single write; failure leaves stored state untouched.
 *
 * Run:  node pkg/src/apps/tictactoe-proof.mjs
 *
 * Covers: full X-wins game, occupied-cell rejection, post-game-over
 * rejection, full draw game, reset/new-game, and atomicity (failed acts
 * change nothing). Also asserts the definition stays small portable JSON.
 */

const LINES = [
	[0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
	[0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
	[0, 4, 8], [2, 4, 6], // diagonals
]
const CELLS = Array.from({ length: 9 }, (_, i) => `c${i}`);

// --- Definition (pure JSON data; JSON-round-trips cleanly) ---
const definition = {
	name: 'tic-tac-toe',
	label: 'Tic Tac Toe',
	icon: '⭕',
	category: 'Games',
	ui: {
		template: 'board',
		title: 'Tic Tac Toe',
		board: { cells: CELLS, status: 'winner' },
		actions: [
			...CELLS.map((c, i) => ({ action: 'move', label: `Play ${i}`, args: { cell: i } })),
			{ action: 'new_game', label: 'New game' },
		],
	},
	stateSchema: {
		type: 'object',
		initial: { ...Object.fromEntries(CELLS.map((c) => [c, ''])), turn: 'X', moves: 0 },
		fields: {
			...Object.fromEntries(CELLS.map((c) => [c, { type: 'string', enum: ['', 'X', 'O'] }])),
			turn: { type: 'string', enum: ['X', 'O'] },
			moves: { type: 'integer', min: 0, max: 9 },
		},
		derived: {
			winner: {
				default: '',
				rules: [
					...LINES.flatMap((line) =>
						['X', 'O'].map((mark) => ({
							when: line.map((i) => ({ field: `c${i}`, equals: mark })),
							value: mark,
						})),
					),
				],
			},
			isDraw: { default: false, rules: [{ when: [{ field: 'moves', equals: 9 }, { field: 'winner', equals: '' }], value: true }] },
		},
	},
	actions: {
		move: {
			description: 'Place the current turn mark in a cell.',
			args: { cell: { type: 'integer', required: true, min: 0, max: 8 } },
			requires: [
				{ field: 'winner', equals: '' },
				{ field: 'isDraw', equals: false },
				{ field: 'c{cell}', equals: '' },
			],
			effects: [
				{ op: 'set', field: 'c{cell}', fromField: 'turn' },
				{ op: 'increment', field: 'moves', by: 1 },
				{ op: 'cycle', field: 'turn', values: ['X', 'O'] },
			],
		},
		new_game: { description: 'Reset the board.', effects: [{ op: 'reset' }] },
	},
};

// --- Minimal v2 evaluator (mirrors the documented semantics) ---
function resolveTemplate(s, args) {
	return s.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
		if (!(k in args)) throw new Error(`unresolved template {${k}}`);
		return String(args[k]);
	});
}
function lhs(cond, state, args) {
	if (cond.field !== undefined) return state[resolveTemplate(cond.field, args)];
	if (cond.arg !== undefined) {
		if (!(cond.arg in args)) throw new Error(`unknown arg "${cond.arg}"`);
		return args[cond.arg];
	}
	throw new Error('condition needs field or arg');
}
function holds(cond, state, args) {
	const v = lhs(cond, state, args);
	if (cond.equals !== undefined && v !== cond.equals) return false;
	if (cond.notEquals !== undefined && v === cond.notEquals) return false;
	if (cond.in !== undefined && !cond.in.includes(v)) return false;
	if (cond.notIn !== undefined && cond.notIn.includes(v)) return false;
	return true;
}
function derive(def, stored) {
	const out = { ...stored };
	for (const [name, d] of Object.entries(def.stateSchema.derived ?? {})) {
		let value = d.default;
		for (const rule of d.rules) {
			let ok = true;
			try { ok = rule.when.every((c) => holds(c, out, {})); } catch { ok = false; }
			if (ok) { value = rule.value; break; }
		}
		out[name] = value;
	}
	return out;
}
function checkField(spec, value, label) {
	if (spec.type === 'integer') {
		if (!Number.isSafeInteger(value)) return `${label} must be a safe integer`;
		if (spec.min !== undefined && value < spec.min) return `${label} must be >= ${spec.min}`;
		if (spec.max !== undefined && value > spec.max) return `${label} must be <= ${spec.max}`;
	} else if (spec.type === 'string') {
		if (typeof value !== 'string') return `${label} must be a string`;
	} else if (typeof value !== 'boolean') return `${label} must be a boolean`;
	if (spec.enum !== undefined && !spec.enum.includes(value)) return `${label} must be one of ${JSON.stringify(spec.enum)}`;
	return null;
}
// The single shared handler: UI forms and MCP both funnel here.
function act(def, stored, actionName, rawArgs) {
	const action = def.actions[actionName];
	if (!action) return { ok: false, error: `unknown action "${actionName}"` };
	// 1. coerce + validate args
	const args = {};
	for (const [k, spec] of Object.entries(action.args ?? {})) {
		const raw = rawArgs?.[k];
		if (raw === undefined) {
			if (spec.required) return { ok: false, error: `missing required arg "${k}"` };
			continue;
		}
		let v = raw;
		if (spec.type === 'integer') {
			v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
			if (!Number.isSafeInteger(v)) return { ok: false, error: `invalid arg "${k}"` };
			if (spec.min !== undefined && v < spec.min) return { ok: false, error: `arg "${k}" must be >= ${spec.min}` };
			if (spec.max !== undefined && v > spec.max) return { ok: false, error: `arg "${k}" must be <= ${spec.max}` };
		}
		args[k] = v;
	}
	const view = derive(def, stored);
	// 2. preconditions against merged stored+derived view
	for (const cond of action.requires ?? []) {
		let ok;
		try { ok = holds(cond, view, args); } catch (e) { return { ok: false, error: e.message }; }
		if (!ok) return { ok: false, error: `precondition failed: ${JSON.stringify(cond)}` };
	}
	// 3. effects on a COPY
	const next = { ...stored };
	const seq = action.effects ?? (action.effect ? [action.effect] : []);
	for (const ef of seq) {
		if (ef.op === 'reset') {
			for (const k of Object.keys(next)) delete next[k];
			Object.assign(next, JSON.parse(JSON.stringify(def.stateSchema.initial)));
			continue;
		}
		const field = resolveTemplate(ef.field, args);
		if (!(field in def.stateSchema.fields)) return { ok: false, error: `unknown field "${field}"` };
		if (ef.op === 'increment') {
			const step = ef.byArg !== undefined ? args[ef.byArg] : (ef.by ?? 1);
			if (!Number.isSafeInteger(step)) return { ok: false, error: 'bad increment step' };
			next[field] += step;
		} else if (ef.op === 'set') {
			const value = ef.fromArg !== undefined ? args[ef.fromArg] : ef.fromField !== undefined ? stored[ef.fromField] : ef.value;
			if (value === undefined) return { ok: false, error: 'set has no value' };
			next[field] = value;
		} else if (ef.op === 'cycle') {
			const i = ef.values.indexOf(next[field]);
			if (i === -1) return { ok: false, error: `cannot cycle "${field}"` };
			next[field] = ef.values[(i + 1) % ef.values.length];
		} else if (ef.op === 'toggle') {
			if (typeof next[field] !== 'boolean') return { ok: false, error: 'toggle needs boolean' };
			next[field] = !next[field];
		} else return { ok: false, error: `unknown op "${ef.op}"` };
	}
	// 4. validate result BEFORE write
	for (const [f, spec] of Object.entries(def.stateSchema.fields)) {
		const err = checkField(spec, next[f], f);
		if (err) return { ok: false, error: `action rejected: ${err}` };
	}
	return { ok: true, state: next }; // 5. single write point (caller persists)
}

// --- Assertions ---
let pass = 0;
function assert(cond, msg) {
	if (!cond) { console.error(`FAIL: ${msg}`); process.exitCode = 1; }
	else pass++;
}
const fresh = () => JSON.parse(JSON.stringify(definition.stateSchema.initial));
const board = (s) => [0, 1, 2].map((r) => [0, 1, 2].map((c) => s[`c${r * 3 + c}`] || '.').join('')).join('\n');

// 1. X wins top row: X0 O3 X1 O4 X2
let s = fresh();
for (const [a, g] of [['move', { cell: 0 }], ['move', { cell: 3 }], ['move', { cell: 1 }], ['move', { cell: 4 }], ['move', { cell: 2 }]]) {
	const r = act(definition, s, a, g);
	assert(r.ok, `move ${JSON.stringify(g)} accepted: ${r.error ?? ''}`);
	s = r.state;
}
let view = derive(definition, s);
assert(view.winner === 'X', `winner is X, got ${view.winner}\n${board(s)}`);
assert(s.turn === 'O' && s.moves === 5, 'turn/moves tracked');
// 2. occupied cell rejected, state untouched
const before = JSON.stringify(s);
let r = act(definition, s, 'move', { cell: 0 });
assert(!r.ok, 'occupied cell rejected');
assert(JSON.stringify(s) === before, 'failed act changed nothing (atomicity)');
// 3. post-game move rejected (winner guard), untouched
r = act(definition, s, 'move', { cell: 5 });
assert(!r.ok, 'move after win rejected');
assert(JSON.stringify(s) === before, 'post-win rejection changed nothing');
// 4. draw game: X0 O1 X2 O4 X3 O5 X7 O6 X8 -> moves=9, no winner, isDraw
s = fresh();
for (const cell of [0, 1, 2, 4, 3, 5, 7, 6, 8]) {
	const rr = act(definition, s, 'move', { cell });
	assert(rr.ok, `draw move ${cell} accepted: ${rr.error ?? ''}`);
	s = rr.state;
}
view = derive(definition, s);
assert(view.winner === '' && view.isDraw === true, `draw detected (winner=${view.winner} isDraw=${view.isDraw})\n${board(s)}`);
r = act(definition, s, 'move', { cell: 0 });
assert(!r.ok, 'move after draw rejected');
// 5. new_game resets
r = act(definition, s, 'new_game', {});
assert(r.ok && JSON.stringify(r.state) === JSON.stringify(fresh()), 'new_game restores initial');
// 6. bad args rejected cleanly
r = act(definition, fresh(), 'move', { cell: 9 });
assert(!r.ok, 'cell=9 rejected by arg max');
r = act(definition, fresh(), 'move', {});
assert(!r.ok, 'missing cell rejected');
// 7. portable JSON: round-trips, small
const json = JSON.stringify({ definition, state: fresh() });
assert(JSON.parse(json).definition.name === 'tic-tac-toe', 'export JSON round-trips');
const kb = Buffer.byteLength(json, 'utf8') / 1024;
assert(kb < 16, `definition+state is ${kb.toFixed(1)} KiB, far under storage budget`);
// 8. UI forms path: string args coerce (forms arrive as strings)
r = act(definition, fresh(), 'move', { cell: '4' });
assert(r.ok && r.state.c4 === 'X', 'string cell "4" coerced (UI+MCP share handler)');

console.log(`\nAll ${pass} assertions passed.`);
console.log(`Definition JSON: ${kb.toFixed(1)} KiB (definition+state).`);
console.log('Final X-win board:\n' + board(derive(definition, s) && (() => { let t = fresh(); for (const cell of [0, 3, 1, 4, 2]) t = act(definition, t, "move", { cell }).state; return t; })()));
