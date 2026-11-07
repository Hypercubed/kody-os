/**
 * Catalog harness. Run with bun from the repo root:
 *
 *   bun tests/catalog-harness.ts
 *
 * Proves, against a fresh in-memory store per app:
 *   1. Every `pkg/catalog/<id>/` holds `definition.json` + `RECIPE.md`.
 *   2. The generated index `pkg/catalog/catalog.json` matches the app
 *      directories and the definitions: one entry per app, alphabetical by
 *      id, with matching label, catalogVersion, fingerprint, installMode,
 *      definitionPath, and recipePath.
 *   3. The index has no `collections` section: a recipe installs only its own
 *      app, so collection recipes no longer exist.
 *   4. Every definition validates via validateCatalogDefinition, installs
 *      via add_app in a blank store, appears in list_apps(), and holds its
 *      stateSchema.initial state.
 *   5. list_catalog() ids match the directories exactly, in alphabetical
 *      (import-list) order, and each summary carries the index's installMode.
 *   6. installMode is excluded from the fingerprint, and an invalid
 *      installMode fails validation.
 *   7. get_catalog_definition() returns null for an unknown id.
 *
 * Kept outside pkg/ by direction: a Kody publish syncs pkg/ only, and
 * this harness is repo tooling, not shipped package code.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { add_app, createMemoryStore, fingerprintDefinition, get_app_state, get_catalog_definition, list_apps, list_catalog, validateCatalogDefinition, validateDefinition } from '../pkg/src/apps/index.ts'
import type { AppDefinition } from '../pkg/src/apps/types.ts'

interface IndexEntry {
	id: string
	label: string
	catalogVersion: number
	fingerprint: string
	installMode: string
	definitionPath: string
	recipePath: string
}

var root = join(dirname(fileURLToPath(import.meta.url)), '..')
var catalogDir = join(root, 'pkg', 'catalog')
var failures: string[] = []

function check(name: string, ok: boolean, detail?: string): void {
	console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined && !ok ? ' — ' + detail : ''))
	if (!ok) failures.push(name)
}

function subdirectories(dir: string): string[] {
	return readdirSync(dir).filter(function (name: string): boolean {
		return statSync(join(dir, name)).isDirectory()
	}).sort()
}

function readDefinition(id: string): AppDefinition {
	return JSON.parse(readFileSync(join(catalogDir, id, 'definition.json'), 'utf8')) as AppDefinition
}

// App directories are the ones holding a definition or a recipe; `tests/`
// (the bundle harnesses) is not an app.
function isAppDirectory(id: string): boolean {
	return id !== 'tests' &&
		(statSync(join(catalogDir, id, 'definition.json'), { throwIfNoEntry: false }) !== undefined ||
			statSync(join(catalogDir, id, 'RECIPE.md'), { throwIfNoEntry: false }) !== undefined)
}

var dirIds = subdirectories(catalogDir).filter(isAppDirectory)
var index = JSON.parse(readFileSync(join(catalogDir, 'catalog.json'), 'utf8')) as { apps: IndexEntry[] }
var indexIds = index.apps.map(function (entry: IndexEntry): string { return entry.id })

// 1. Every app directory is complete.
var incomplete: string[] = []
for (var id of dirIds) {
	if (readdirSync(join(catalogDir, id)).sort().join(',') !== ['RECIPE.md', 'definition.json'].join(',')) incomplete.push(id)
}
check('every app directory holds definition.json + RECIPE.md and nothing else', incomplete.length === 0, incomplete.join(','))

// 2. Index == directories == import list, alphabetical.
check('index lists every app directory exactly', JSON.stringify(indexIds) === JSON.stringify(dirIds), 'index=' + indexIds.join(',') + ' dirs=' + dirIds.join(','))
check('index apps are alphabetical', JSON.stringify(indexIds) === JSON.stringify(indexIds.slice().sort()), indexIds.join(','))

var listed = list_catalog()
var listedIds = listed.map(function (summary): string { return summary.id })
check('directory/import match: every catalog app is listed', JSON.stringify(dirIds) === JSON.stringify(listedIds), 'dir=' + dirIds.join(',') + ' listed=' + listedIds.join(','))
check('listing order is alphabetical', JSON.stringify(listedIds) === JSON.stringify(listedIds.slice().sort()))

var entryProblems: string[] = []
for (var entry of index.apps) {
	var def = readDefinition(entry.id)
	if (entry.id !== def.id) entryProblems.push(entry.id + ':id')
	if (entry.label !== (def.label !== undefined ? def.label : def.name)) entryProblems.push(entry.id + ':label')
	if (entry.catalogVersion !== def.catalogVersion) entryProblems.push(entry.id + ':catalogVersion')
	if (entry.fingerprint !== fingerprintDefinition(def)) entryProblems.push(entry.id + ':fingerprint')
	if (entry.installMode !== (def.installMode !== undefined ? def.installMode : 'json')) entryProblems.push(entry.id + ':installMode')
	if (entry.definitionPath !== entry.id + '/definition.json') entryProblems.push(entry.id + ':definitionPath')
	if (entry.recipePath !== entry.id + '/RECIPE.md') entryProblems.push(entry.id + ':recipePath')
	if (!statSync(join(catalogDir, entry.recipePath)).isFile()) entryProblems.push(entry.id + ':missingRecipe')
}
check('index entries match the definitions (label, version, fingerprint, mode, paths)', entryProblems.length === 0, entryProblems.join(', '))

// 3. No collections: the starter collection went away with the catalog Help
// and About apps, and a recipe installs only its own app.
check('index has no collections section', !('collections' in index), JSON.stringify(Object.keys(index)))
check('no collections directory exists', statSync(join(catalogDir, 'collections'), { throwIfNoEntry: false }) === undefined)
check('Help and About are not catalog apps', get_catalog_definition('help') === null && get_catalog_definition('about') === null)

check('unknown catalog id returns null', get_catalog_definition('no-such-app') === null)

// 4-6. Validate, install, state, modes.
for (var summary of listed) {
	var id = summary.id
	var def = get_catalog_definition(id)
	if (def === null) {
		check(id + ' definition present', false)
		continue
	}
	var problem = validateCatalogDefinition(def)
	check(id + ' validates', problem === null, problem !== null ? problem : undefined)
	var store = createMemoryStore()
	var added = await add_app(def as never, store)
	check(id + ' installs in blank store', added.ok === true, added.ok === false ? (added as { error: string }).error : undefined)
	if (added.ok === true) {
		var apps = await list_apps(store)
		check(id + ' appears in list_apps()', apps.some(function (app): boolean { return app.id === id }))
		var state = await get_app_state(id, store)
		var initial = def.stateSchema.initial
		check(id + ' holds initial state', JSON.stringify(state) === JSON.stringify(initial), 'state=' + JSON.stringify(state) + ' initial=' + JSON.stringify(initial))
	}
	var expectedMode = def.installMode !== undefined ? def.installMode : 'json'
	check(id + ' listing reports install mode ' + expectedMode, summary.installMode === expectedMode, summary.installMode)
	if (def.installMode !== undefined) {
		var withoutMode = JSON.parse(JSON.stringify(def)) as AppDefinition
		delete withoutMode.installMode
		check(id + ' installMode is excluded from the fingerprint', fingerprintDefinition(withoutMode) === fingerprintDefinition(def))
	}
}

var recipeApps = listed.filter(function (summary): boolean { return summary.installMode !== 'json' }).map(function (summary): string { return summary.id })
check('no catalog app carries a recipe install mode', JSON.stringify(recipeApps) === JSON.stringify([]), recipeApps.join(','))
check('no catalog app reports recipe-only', listed.every(function (summary): boolean { return summary.installMode !== 'recipe-only' }))

var bogus = JSON.parse(JSON.stringify(readDefinition('settings'))) as AppDefinition & { installMode: string }
bogus.installMode = 'bogus'
check('an invalid installMode fails validation', validateDefinition(bogus) !== null, String(validateDefinition(bogus)))

if (failures.length > 0) {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
console.log('\nALL CATALOG CHECKS PASSED (' + listed.length + ' apps, 0 collections)')
