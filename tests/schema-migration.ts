/**
 * Schema-migration proof (live v3/v4 -> v5). Run with bun from the repo root:
 *
 *   bun tests/schema-migration.ts
 *
 * The live registry's add_app() restamps a re-added existing id to the
 * current schemaVersion and canonicalizes its actions (single effect ->
 * effects[], ui.template dropped), while preserving bundle files and
 * state. This harness proves that, against a fresh in-memory store per
 * app, using the live definitions fetched this session (see
 * /tmp/kody-live-defs.json, not committed): first install a v5-stamped
 * copy of the old definition (so the id exists, exactly as it does
 * live — a blank store rejects a stale version for a NEW id),
 * change state via act() where the app has state, re-add the SAME old
 * definition, and check the stored definition is now v5, bundle files
 * are byte-identical, ui.template is gone, and state is preserved.
 *
 * hello-counter-copy is deliberately NOT covered: it is a v1 template
 * app with bundle null, and the validator only supports 3/4/5 and
 * requires a bundle, so it cannot be re-added at all — a schema bump
 * alone cannot migrate it; it would need a bundle authored first.
 *
 * Kept outside pkg/ by direction: repo tooling, not shipped package code.
 */
import { readFileSync } from 'node:fs'
import { add_app, createMemoryStore, get_app, get_app_state, act, migrateDefinition, validateDefinition } from '../pkg/src/apps/index.ts'

var live = JSON.parse(readFileSync('/tmp/kody-live-defs.json', 'utf8'))
var ids = ['calculator', 'clock', 'eight-ball', 'mac-puzzle', 'daily-brief', 'probe']
var failures: string[] = []

function check(name: string, ok: boolean, detail?: string): void {
	console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined && !ok ? ' — ' + detail : ''))
	if (!ok) failures.push(name)
}

for (var i = 0; i < ids.length; i++) {
	var id = ids[i]
	var def = live[id].definition
	check(id + ' old definition validates', validateDefinition(def) === null, validateDefinition(def) || undefined)
	var store = createMemoryStore()
	// Seed the id at v5 (stamp + drop template + canonicalize actions),
	// mirroring the already-installed live state.
	var seed = migrateDefinition(def) as Record<string, unknown>
	seed.schemaVersion = 5
	var seedUi = { ...(seed.ui as Record<string, unknown>) }
	delete seedUi.template
	seed.ui = seedUi
	var added = await add_app(seed as never, store)
	check(id + ' v5 seed installs in blank store', added.ok === true, added.ok === false ? (added as { error: string }).error : undefined)
	if (added.ok !== true) continue
	// Change state where the app has state, so preservation is real.
	if (id === 'daily-brief') {
		var a1 = await act(id, 'set_feed', { value: 'test-feed-xml' }, store)
		check(id + ' act set_feed', a1.ok === true, a1.ok === false ? (a1 as { error: string }).error : undefined)
	}
	if (id === 'probe') {
		var a2 = await act(id, 'append_report', { d: 'row:test=1' }, store)
		check(id + ' act append_report', a2.ok === true, a2.ok === false ? (a2 as { error: string }).error : undefined)
	}
	var stateBefore = await get_app_state(id, store)
	var readded = await add_app(def as never, store)
	check(id + ' re-add succeeds', readded.ok === true, readded.ok === false ? (readded as { error: string }).error : undefined)
	if (readded.ok !== true) continue
	var stored = await get_app(id, store)
	var storedDef = (stored as { definition: Record<string, unknown> }).definition
	check(id + ' restamped to v5', storedDef.schemaVersion === 5, 'got ' + String(storedDef.schemaVersion))
	var ui = storedDef.ui as Record<string, unknown>
	check(id + ' ui.template dropped', !('template' in ui))
	var oldFiles = (def.bundle as { files: Record<string, string> }).files
	var newFiles = (storedDef.bundle as { files: Record<string, string> }).files
	check(id + ' bundle files byte-identical', JSON.stringify(oldFiles) === JSON.stringify(newFiles))
	var stateAfter = await get_app_state(id, store)
	check(id + ' state preserved', JSON.stringify(stateBefore) === JSON.stringify(stateAfter), 'before=' + JSON.stringify(stateBefore) + ' after=' + JSON.stringify(stateAfter))
}

if (failures.length > 0) {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
console.log('\nALL SCHEMA-MIGRATION CHECKS PASSED (' + ids.length + ' apps)')
