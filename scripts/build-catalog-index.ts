/**
 * Build the generated catalog index at `pkg/catalog/catalog.json`.
 *
 * Run with bun from the repo root:
 *
 *   bun scripts/build-catalog-index.ts
 *
 * It walks `pkg/catalog/<id>/definition.json` (skipping `tests/`),
 * reads id/label/catalogVersion/installMode, computes the fingerprint with the
 * package's own `fingerprintDefinition`, and requires the sibling `RECIPE.md`.
 * Output is deterministic (sorted by id, two-space JSON + newline): running it
 * twice over unchanged inputs is byte-identical.
 *
 * There are no collection recipes: a recipe installs only its own app. A
 * stray `pkg/catalog/collections/` directory is an error, not quietly
 * indexed, so a leftover from the retired starter collection fails here
 * instead of shipping an index the shell no longer understands.
 *
 * Never hand-write `catalog.json`: editing an app requires re-running this
 * generator, and `tests/catalog-harness.ts` fails on a stale index.
 *
 * `fingerprintDefinition` is imported from `registry.ts` (the source that
 * `apps/index.ts` re-exports) rather than from `apps/index.ts`: index.ts
 * imports `catalog.ts`, which imports the generated `catalog.json`, so
 * importing index.ts here would make the first generation (no index yet)
 * impossible.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppDefinition } from '../pkg/src/apps/types.ts'

type InstallMode = 'json' | 'recipe-only'

interface IndexEntry {
	id: string
	label: string
	catalogVersion: number
	fingerprint: string
	installMode: InstallMode
	definitionPath: string
	recipePath: string
}

var root = join(dirname(fileURLToPath(import.meta.url)), '..')
var catalogDir = join(root, 'pkg', 'catalog')

function fail(message: string): never {
	console.error('build-catalog-index: ' + message)
	process.exit(1)
}

function subdirectories(dir: string): string[] {
	return readdirSync(dir).filter(function (name: string): boolean {
		return statSync(join(dir, name)).isDirectory()
	}).sort()
}

function readRecipe(path: string): string {
	try {
		return readFileSync(path, 'utf8')
	} catch (error) {
		return fail('missing recipe ' + path + ' (' + String(error) + ')')
	}
}

if (statSync(join(catalogDir, 'collections'), { throwIfNoEntry: false }) !== undefined) {
	fail('pkg/catalog/collections/ is no longer supported: a recipe installs only its own app, so delete the directory')
}

// registry.ts (and therefore catalog.ts) imports the generated index, so on a
// first generation there is no catalog.json for the module graph to resolve.
// Seed an empty index before importing; the real one is written below.
var indexPath = join(catalogDir, 'catalog.json')
if (!existsSync(indexPath)) writeFileSync(indexPath, '{"apps":[]}\n', 'utf8')
var fingerprintDefinition = (await import('../pkg/src/apps/registry.ts')).fingerprintDefinition

// App directories hold a definition or a recipe; `tests/` holds bundle
// harnesses, not apps.
function isAppDirectory(id: string): boolean {
	return id !== 'tests' &&
		(statSync(join(catalogDir, id, 'definition.json'), { throwIfNoEntry: false }) !== undefined ||
			statSync(join(catalogDir, id, 'RECIPE.md'), { throwIfNoEntry: false }) !== undefined)
}

var appIds = subdirectories(catalogDir).filter(isAppDirectory)
var apps: IndexEntry[] = []
for (var id of appIds) {
	var definitionPath = id + '/definition.json'
	var recipePath = id + '/RECIPE.md'
	var definition = JSON.parse(readFileSync(join(catalogDir, definitionPath), 'utf8')) as AppDefinition
	if (definition.id !== id) fail('directory ' + id + ' holds a definition whose id is ' + String(definition.id))
	var catalogVersion = definition.catalogVersion
	if (typeof catalogVersion !== 'number' || !Number.isSafeInteger(catalogVersion) || catalogVersion < 1) {
		fail('definition ' + definitionPath + ' has no valid catalogVersion')
	}
	readRecipe(join(catalogDir, recipePath))
	apps.push({
		id: id,
		label: definition.label !== undefined ? definition.label : definition.name,
		catalogVersion: catalogVersion,
		fingerprint: fingerprintDefinition(definition),
		installMode: definition.installMode !== undefined ? definition.installMode : 'json',
		definitionPath: definitionPath,
		recipePath: recipePath,
	})
}

var output = JSON.stringify({ apps: apps }, null, 2) + '\n'
writeFileSync(indexPath, output, 'utf8')
console.log('wrote pkg/catalog/catalog.json (' + apps.length + ' apps)')
