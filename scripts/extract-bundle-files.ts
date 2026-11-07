/**
 * Mechanical migration for bundle-files: extract each catalog app's inline
 * bundle files to disk byte-identical, then rewrite `definition.json`'s
 * bundle to the manifest list form.
 *
 * Run with bun from the repo root:
 *
 *   bun scripts/extract-bundle-files.ts
 *
 * For each of the catalog apps: read `definition.json`; when `bundle.files`
 * is still the inline contents map, write each file to disk (exact string
 * contents, utf8) and rewrite the bundle to `{ entry, files: [sorted] }`.
 * When the bundle is already the manifest list, only verify the disk files
 * exist. The script verifies fingerprint equality per app (assembled
 * post-migration fingerprint equals the pre-migration fingerprint) and
 * fails the run on any mismatch. No `catalogVersion` is bumped: the
 * assembled canonical definition is byte-identical, so no installed copy
 * changes status. Re-run `scripts/build-catalog-index.ts` afterwards.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppDefinition } from '../pkg/src/apps/types.ts'

var root = join(dirname(fileURLToPath(import.meta.url)), '..')
var catalogDir = join(root, 'pkg', 'catalog')

function fail(message: string): never {
	console.error('extract-bundle-files: ' + message)
	process.exit(1)
}

var registry = await import('../pkg/src/apps/registry.ts')
var assembleBundleFiles = registry.assembleBundleFiles as (
	bundle: unknown,
	readFile: (path: string) => string | undefined,
) => { ok: true; files: Record<string, string> } | { ok: false; error: string }
var fingerprintDefinition = registry.fingerprintDefinition as (definition: AppDefinition) => string

function isAppDirectory(id: string): boolean {
	return id !== 'tests' &&
		statSync(join(catalogDir, id, 'definition.json'), { throwIfNoEntry: false }) !== undefined
}

var appIds = readdirSync(catalogDir).filter(function (name: string): boolean {
	try {
		return statSync(join(catalogDir, name)).isDirectory()
	} catch (error) {
		return false
	}
}).sort().filter(isAppDirectory)

var diskReader = function (appId: string): (path: string) => string | undefined {
	return function (path: string): string | undefined {
		try {
			if (!statSync(join(catalogDir, appId, path)).isFile()) return undefined
		} catch (error) {
			return undefined
		}
		return readFileSync(join(catalogDir, appId, path), 'utf8')
	}
}

for (var id of appIds) {
	var definitionPath = join(catalogDir, id, 'definition.json')
	var definition = JSON.parse(readFileSync(definitionPath, 'utf8')) as AppDefinition
	var bundle = (definition as unknown as Record<string, unknown>)['bundle'] as Record<string, unknown>
	var preFingerprint = fingerprintDefinition(definition)
	if (Array.isArray(bundle['files'])) {
		var listed = bundle['files'] as string[]
		for (var li = 0; li < listed.length; li++) {
			if (diskReader(id)(listed[li]) === undefined) fail('app ' + id + ': manifest lists ' + listed[li] + ' but it is missing on disk')
		}
		console.log('app ' + id + ': already manifest form, files present')
	} else if (bundle['files'] !== undefined && typeof bundle['files'] === 'object' && bundle['files'] !== null) {
		var inlineFiles = bundle['files'] as Record<string, string>
		var paths = Object.keys(inlineFiles).sort()
		for (var pi = 0; pi < paths.length; pi++) {
			writeFileSync(join(catalogDir, id, paths[pi]), inlineFiles[paths[pi]], 'utf8')
		}
		var migrated = JSON.parse(JSON.stringify(definition)) as AppDefinition
		;(migrated as unknown as Record<string, unknown>)['bundle'] = { entry: 'index.html', files: paths }
		writeFileSync(definitionPath, JSON.stringify(migrated, null, 2) + '\n', 'utf8')
		console.log('app ' + id + ': extracted ' + paths.length + ' file(s): ' + paths.join(', '))
	} else {
		fail('app ' + id + ': bundle.files is neither a map nor a list')
	}
	var reread = JSON.parse(readFileSync(definitionPath, 'utf8')) as AppDefinition
	var rereadBundle = (reread as unknown as Record<string, unknown>)['bundle']
	var assembled = assembleBundleFiles(rereadBundle, diskReader(id))
	if (!assembled.ok) fail('app ' + id + ': cannot assemble after migration: ' + (assembled as { ok: false; error: string }).error)
	var assembledDef = JSON.parse(JSON.stringify(reread)) as AppDefinition
	;(assembledDef as unknown as Record<string, unknown>)['bundle'] = {
		entry: 'index.html',
		files: (assembled as { ok: true; files: Record<string, string> }).files,
	}
	var postFingerprint = fingerprintDefinition(assembledDef)
	if (postFingerprint !== preFingerprint) {
		fail('app ' + id + ': fingerprint mismatch after migration (pre ' + preFingerprint + ' post ' + postFingerprint + ')')
	}
	console.log('app ' + id + ': fingerprint identical (' + postFingerprint + ')')
}

console.log('extracted ' + appIds.length + ' apps, all fingerprints identical')
