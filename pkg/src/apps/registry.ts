/**
 * Reference implementation of the Phase 2 app-layer contract.
 *
 * Server-side only (uses storage.ts). Callable signatures for the MCP
 * interface from the handoff Phase 2 + clarification:
 *
 *   list_apps() -> AppSummary[]
 *   get_app_state(id) -> AppState
 *   act(id, action, args?) -> { ok, state? | error? }
 *   add_app(definition) -> definition/state write only, no republish
 *   remove_app(id) -> uninstall definition + state + all reference lists
 *   export_app(id) -> complete AppExport JSON
 *   plus: get_app(id), import_app(json) — blank-install import without code changes
 *
 * Rules enforced: state lives in storage; every action is validated BEFORE
 * any mutation; a bad action returns { ok:false } and the stored state is
 * untouched (state is computed on a copy and written with a single set).
 *
 * Identity follows ReKindle: `id` is the stable slug (routes, storage keys),
 * `name` the display name. Export format is kody-os-app/2; v1 payloads and
 * bare definitions import with id derived from name.
 *
 * ES2019 ceiling: no ?. and no ?? in this file (see the canonical ceiling in docs/scribe-limitations.md).
 */

import type {
	ActionDef,
	ActResult,
	AppDefinition,
	AppExport,
	OpenAs,
	AppState,
	AppSummary,
	ProxyDecl,
	StateFieldDef,
} from './types.ts'
import { catalogGitHubRef, catalogLabelForBase, catalogTagLabel, devOverrideBase, get_catalog_definition, get_catalog_definition_meta, get_catalog_entry, list_catalog, normalizeCatalogBase, readCatalogManifest, get_catalog_source, folderUrlForBase } from './remote-catalog.ts'
import {
	RECENT_CAP,
	createMemoryStore,
	defKey,
	deleteKey,
	readHidden,
	readHomepage,
	readJson,
	readPinned,
	readRecent,
	resolveStore,
	stateKey,
	writeHidden,
	writeHomepage,
	writeJson,
	writePinned,
	writeRecent,
	type KeyStore,
} from './storage.ts'
import { DEFINITION_SCHEMA_VERSION } from './types.ts'
import {
	APPEND_CAP,
	APPEND_MAX_ENTRY_BYTES,
	backfillDefinition,
	byteLength,
	checkFieldValue,
	cloneState,
	coerceArg,
	capabilityAdditions,
	compileDefinition,
	comparePackageVersions,
	deriveOpenAs,
	fingerprintDefinition,
	isRecord,
	MIN_SUPPORTED_SCHEMA_VERSION,
	NAME_RE,
	summarizeCapabilities,
	parsePackageVersion,
	reqStr,
	validateDefinition,
} from './definition.ts'
export {
	APPEND_CAP,
	APPEND_MAX_ENTRY_BYTES,
	assembleBundleFiles,
	BUNDLE_CAP_BYTES,
	canonicalizeDefinition,
	capabilityAdditions,
	comparePackageVersions,
	deriveOpenAs,
	fingerprintDefinition,
	isSvgIcon,
	migrateAction,
	migrateDefinition,
	MIN_SUPPORTED_SCHEMA_VERSION,
	parsePackageVersion,
	summarizeCapabilities,
	SUPPORTED_SCHEMA_VERSIONS,
	validateBundleReferences,
	validateCatalogDefinition,
	validateDefinition,
	sanitizeSvgIcon,
} from './definition.ts'
export type { CapabilitySummary } from './definition.ts'
import type { CapabilitySummary } from './definition.ts'

var EXPORT_FORMAT = 'kody-os-app/2'
var EXPORT_FORMAT_V1 = 'kody-os-app/1'

/**
 * Catalog apps retired into built-in shell pages. An upgraded store that
 * still has one of these rows must not show a stale app beside the shell
 * page, so the row is pruned the next time the installed list is derived.
 */
var RETIRED_APP_IDS = ['help', 'about']
var DEF_PREFIX = 'kody-os.apps.def.'
var runningPackageVersionPromise: Promise<string> | null = null
/**
 * Running shell (package) version: read from `pkg/package.json` via a
 * dynamic JSON import (the bundler inlines it when present), the same
 * source the status bar reads via `getPackageMeta()` in `src/app.ts`.
 * Falls back to `0.1.0` when the manifest is absent. `build` is ignored:
 * only `version` (`MAJOR.MINOR.PATCH`) is a compatibility signal.
 */
export function getRunningPackageVersion(): Promise<string> {
	if (runningPackageVersionPromise !== null) return runningPackageVersionPromise
	try {
		// @ts-ignore optional manifest; the bundler inlines it when present.
		var req = import('../../package.json', { with: { type: 'json' } })
		runningPackageVersionPromise = req.then(
			function (m: unknown): string {
				try {
					var rec = m as { default?: unknown } | null
					var body = rec && typeof rec === 'object' && 'default' in rec ? rec.default : m
					if (body && typeof body === 'object') {
						var v = (body as { version?: unknown }).version
						if (typeof v === 'string' && parsePackageVersion(v) !== null) return v
					}
				} catch (err) {
				}
				return '0.1.0'
			},
			function (): string {
				return '0.1.0'
			}
		)
	} catch (err) {
		runningPackageVersionPromise = Promise.resolve('0.1.0')
	}
	return runningPackageVersionPromise
}


function loadEntry(
	store: KeyStore,
	id: string,
): Promise<{ definition: AppDefinition; state: AppState } | { error: string }> {
	if (RETIRED_APP_IDS.indexOf(id) !== -1) return Promise.resolve({ error: 'unknown app "' + id + '"' })
	return Promise.all([
		readJson<AppDefinition>(store, defKey(id)),
		readJson<AppState>(store, stateKey(id)),
	]).then(function (pair): { definition: AppDefinition; state: AppState } | { error: string } {
		var definition = pair[0]
		var state = pair[1]
		if (!definition) return { error: 'unknown app "' + id + '"' }
		if (!state) return { error: 'app "' + id + '" has no state' }
		return { definition: backfillDefinition(definition), state: state }
	})
}

export interface ListAppsOptions {
	includeHidden?: boolean
}

function isKeyStore(value: unknown): value is KeyStore {
	return value !== null && typeof value === 'object' && typeof (value as KeyStore).get === 'function' && typeof (value as KeyStore).set === 'function'
}

/** Read pinned ids in pin order. Missing keys read as empty. */
export function get_pinned(store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readPinned(active)
	})
}

/** Read hidden ids. Missing keys read as empty. */
export function get_hidden(store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readHidden(active)
	})
}

/** Read recent ids, most recent first. Missing keys read as empty. */
export function get_recent(store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readRecent(active)
	})
}

/** Read homepage ids in dashboard order. Missing keys read as empty. */
export function get_homepage(store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readHomepage(active)
	})
}

/**
 * Read the whole launcher state in one call, in stored order, missing
 * keys as []. Recency is read internally here and is NOT a separate
 * root export: recency stays internal by the 2026-10-30 direction, but
 * the aggregate still lets an agent verify a removal scrubbed every
 * list, recent included. Reads never write.
 */
export function get_launcher_state(store?: KeyStore): Promise<{ pinned: string[]; hidden: string[]; recent: string[]; homepage: string[] }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return listInstalledIds(active).then(function (derived: string[]): Promise<{ pinned: string[]; hidden: string[]; recent: string[]; homepage: string[] }> {
			return pruneRetiredApps(derived, active).then(function (): Promise<{ pinned: string[]; hidden: string[]; recent: string[]; homepage: string[] }> {
				return Promise.all([readPinned(active), readHidden(active), readRecent(active), readHomepage(active)]).then(function (parts) {
					return { pinned: parts[0], hidden: parts[1], recent: parts[2], homepage: parts[3] }
				})
			})
		})
	})
}

/** Overwrite the homepage order list (order matters). */
export function set_homepage(ids: string[], store?: KeyStore): Promise<void> {
	return resolveStore(store).then(function (active: KeyStore) {
		return writeHomepage(active, ids)
	})
}

/** Set or clear one homepage entry. Keeps order (new entries append). */
export function set_home(id: string, want: boolean, store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readHomepage(active).then(function (ids: string[]): Promise<string[]> {
			var at = ids.indexOf(id)
			if (want && at === -1) ids.push(id)
			if (!want && at !== -1) ids.splice(at, 1)
			return writeHomepage(active, ids).then(function (): string[] {
				return ids
			})
		})
	})
}

/** Move one homepage entry up (-1) or down (+1). Single list write. */
export function move_home(id: string, delta: number, store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readHomepage(active).then(function (ids: string[]): Promise<string[]> {
			var at = ids.indexOf(id)
			if (at === -1) return Promise.resolve(ids)
			var to = at + (delta < 0 ? -1 : 1)
			if (to < 0 || to >= ids.length) return Promise.resolve(ids)
			var next = ids.slice()
			next.splice(at, 1)
			next.splice(to, 0, id)
			return writeHomepage(active, next).then(function (): string[] {
				return next
			})
		})
	})
}

/** Overwrite the pinned list (order matters). */
export function set_pinned(ids: string[], store?: KeyStore): Promise<void> {
	return resolveStore(store).then(function (active: KeyStore) {
		return writePinned(active, ids)
	})
}

/** Overwrite the hidden list. */
export function set_hidden(ids: string[], store?: KeyStore): Promise<void> {
	return resolveStore(store).then(function (active: KeyStore) {
		return writeHidden(active, ids)
	})
}

/** Empty the recency list without touching apps, pins, or hidden flags. */
export function clear_recent(store?: KeyStore): Promise<void> {
	return resolveStore(store).then(function (active: KeyStore) {
		return writeRecent(active, [])
	})
}

/** Move one app id to the front of recency (dedupe, capped). */
export function record_use(id: string, store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readRecent(active).then(function (ids: string[]): Promise<string[]> {
			var next: string[] = [id]
			for (var i = 0; i < ids.length; i++) {
				if (ids[i] !== id) next.push(ids[i])
			}
			next = next.slice(0, RECENT_CAP)
			return writeRecent(active, next).then(function (): string[] {
				return next
			})
		})
	})
}

/** Set or clear one pin. Keeps pin order (new pins append). */
export function set_pin(id: string, want: boolean, store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readPinned(active).then(function (ids: string[]): Promise<string[]> {
			var at = ids.indexOf(id)
			if (want && at === -1) ids.push(id)
			if (!want && at !== -1) ids.splice(at, 1)
			return writePinned(active, ids).then(function (): string[] {
				return ids
			})
		})
	})
}

/** Set or clear one hidden flag. */
export function set_hide(id: string, want: boolean, store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readHidden(active).then(function (ids: string[]): Promise<string[]> {
			var at = ids.indexOf(id)
			if (want && at === -1) ids.push(id)
			if (!want && at !== -1) ids.splice(at, 1)
			return writeHidden(active, ids).then(function (): string[] {
				return ids
			})
		})
	})
}

/**
 * Installed ids, derived from definition keys: paginate
 * `list({ prefix: 'kody-os.apps.def.' })` to completion and return
 * the id suffix of each key, in key order (alphabetical by id).
 * A store without `list()` throws a clear error naming the store
 * instead of silently reporting an empty install. `pageSize` is
 * test-only; production uses the Kody default (250).
 */
export function listInstalledIds(store: KeyStore, pageSize?: number): Promise<string[]> {
	if (typeof store.list !== 'function') return Promise.reject(new Error('listInstalledIds: this store has no list() method, so installed apps cannot be enumerated from definition keys'))
	var size = pageSize !== undefined ? pageSize : 250
	var ids: string[] = []
	function page(startAfter?: string): Promise<string[]> {
		var options: { prefix: string; pageSize?: number; startAfter?: string } = { prefix: DEF_PREFIX, pageSize: size }
		if (startAfter !== undefined) options.startAfter = startAfter
		return Promise.resolve(store.list(options)).then(function (result) {
			for (var i = 0; i < result.entries.length; i++) {
				ids.push(result.entries[i].key.slice(DEF_PREFIX.length))
			}
			if (result.truncated) {
				if (result.nextStartAfter === null) return Promise.reject(new Error('listInstalledIds: truncated page without nextStartAfter'))
				return page(result.nextStartAfter)
			}
			return ids
		})
	}
	return page()
}

/**
 * Drop retired-app rows (and their state, snapshot, and launcher entries)
 * left installed before Help/About became shell pages. Filters the
 * derived installed ids, returning the survivors. A clean store is
 * read-only: no write happens when no retired id is present.
 */
function pruneRetiredApps(ids: string[], store: KeyStore): Promise<string[]> {
	var retired: string[] = []
	for (var i = 0; i < ids.length; i++) {
		if (RETIRED_APP_IDS.indexOf(ids[i]) !== -1) retired.push(ids[i])
	}
	if (retired.length === 0) return Promise.resolve(ids)
	var kept = ids.filter(function (one: string): boolean { return RETIRED_APP_IDS.indexOf(one) === -1 })
	var chain: Promise<unknown> = Promise.resolve()
	for (var r = 0; r < retired.length; r++) {
		;(function (id: string): void {
			chain = chain
				.then(function (): Promise<void> { return deleteKey(store, defKey(id)) })
				.then(function (): Promise<void> { return deleteKey(store, stateKey(id)) })
				.then(function (): Promise<void> { return deleteInstallSnapshot(store, id) })
		})(retired[r])
	}
	return chain.then(function (): Promise<string[]> {
		function clean(list: string[]): string[] {
			return list.filter(function (one: string): boolean { return RETIRED_APP_IDS.indexOf(one) === -1 })
		}
		return Promise.all([readPinned(store), readHidden(store), readRecent(store), readHomepage(store)]).then(function (lists): Promise<string[]> {
			return writePinned(store, clean(lists[0]))
				.then(function () { return writeHidden(store, clean(lists[1])) })
				.then(function () { return writeRecent(store, clean(lists[2])) })
				.then(function () { return writeHomepage(store, clean(lists[3])) })
				.then(function (): string[] { return kept })
		})
	})
}

/** List every installed app, in alphabetical-by-id (key) order. Read-only apart from retiring stale rows. */
export function list_apps(store?: KeyStore, opts?: ListAppsOptions): Promise<AppSummary[]> {
	var activeStore: KeyStore | undefined = store
	var options: ListAppsOptions | undefined = opts
	if (store && !isKeyStore(store)) {
		options = store as unknown as ListAppsOptions
		activeStore = undefined
	}
	return resolveStore(activeStore).then(function (active: KeyStore): Promise<AppSummary[]> {
		var hiddenP: Promise<string[]> = options && options.includeHidden === false ? readHidden(active) : Promise.resolve([] as string[])
		return hiddenP.then(function (hidden: string[]): Promise<AppSummary[]> {
			return listInstalledIds(active).then(function (derived: string[]): Promise<AppSummary[]> {
				return pruneRetiredApps(derived, active).then(function (ids: string[]): Promise<AppSummary[]> {
					var out: AppSummary[] = []
					var chain = Promise.resolve()
					for (var id of ids) {
						;(function (want: string): void {
							chain = chain.then(function (): Promise<void> {
								if (hidden.indexOf(want) !== -1) return Promise.resolve()
								return readJson<AppDefinition>(active, defKey(want)).then(function (raw): void {
									if (!raw) return
									var def = backfillDefinition(raw)
									out.push({
										id: def.id,
										name: def.name,
										label: def.label || def.name,
										schemaVersion: def.schemaVersion,
										icon: def.icon,
										category: def.category,
										description: def.description,
										openAs: deriveOpenAs(def.ui),
										menuBar: def.ui.menuBar === true,
									})
								})
							})
						})(id)
					}
					return chain.then(function (): AppSummary[] {
						return out
					})
				})
			})
		})
	})
}

/** Read one app's definition plus live state. */
export function get_app(
	id: string,
	store?: KeyStore,
): Promise<{ definition: AppDefinition; state: AppState } | { error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return loadEntry(active, id)
	})
}

/** Read one app's live state (UI refresh and MCP poll the same value). */
export function get_app_state(id: string, store?: KeyStore): Promise<AppState | { error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return loadEntry(active, id).then(function (entry) {
			if ('error' in entry) return { error: entry.error }
			return entry.state
		})
	})
}

/**
 * Run one declarative action. Validates everything before mutating; writes the
 * new state with a single set. A bad action returns { ok:false } and the
 * stored state is untouched.
 */
export function act(
	id: string,
	action: string,
	args?: Record<string, unknown>,
	store?: KeyStore,
): Promise<ActResult> {
	return resolveStore(store).then(function (active: KeyStore): Promise<ActResult> {
		return loadEntry(active, id).then(function (entry): Promise<ActResult> {
			if ('error' in entry) return Promise.resolve({ ok: false as const, error: entry.error })
			var definition = entry.definition
			var state = entry.state

			// Unified shape: every app carries bundle files plus state plus actions,
			// so act() runs on all apps with no bundle refusal. (The legacy kind
			// discriminator and the /probe* routes are retired; the probe is a
			// unified bundle app that persists via act().)
			var actionTable: Record<string, ActionDef> | undefined = definition.actions
			var actionDef: ActionDef | undefined = actionTable ? actionTable[action] : undefined
			if (!actionDef) {
				return Promise.resolve({ ok: false as const, error: 'unknown action "' + action + '" for app "' + id + '"' })
			}

			// 1. Resolve + validate args against the action's arg schema.
			var resolved: Record<string, number | string | boolean> = {}
			var argSchema = actionDef.args || {}
			for (var argName of Object.keys(argSchema)) {
				var argDef = argSchema[argName]
				var raw: unknown = args ? args[argName] : undefined
				if (raw === undefined) {
					if (argDef.required !== true && argDef.default !== undefined) {
						resolved[argName] = argDef.default
						continue
					}
					if (argDef.required === true) {
						return Promise.resolve({ ok: false as const, error: 'missing required arg "' + argName + '"' })
					}
					continue
				}
				var coerced = coerceArg(argDef.type, raw)
				if (coerced.error || coerced.value === undefined) {
					return Promise.resolve({ ok: false as const, error: 'invalid arg "' + argName + '": ' + coerced.error })
				}
				if (argDef.type === 'integer' && typeof coerced.value === 'number') {
					if (argDef.min !== undefined && coerced.value < argDef.min) {
						return Promise.resolve({ ok: false as const, error: 'arg "' + argName + '" must be >= ' + argDef.min })
					}
					if (argDef.max !== undefined && coerced.value > argDef.max) {
						return Promise.resolve({ ok: false as const, error: 'arg "' + argName + '" must be <= ' + argDef.max })
					}
				}
				if (argDef.type === 'string' && typeof coerced.value === 'string' && argDef.maxLength !== undefined && coerced.value.length > argDef.maxLength) {
					return Promise.resolve({
						ok: false as const,
						error: 'arg "' + argName + '" must be at most ' + argDef.maxLength + ' characters',
					})
				}
				resolved[argName] = coerced.value
			}

			// 2. Apply the declarative effects to a COPY — storage untouched so far.
			// v3 definitions carry single `effect`; v4 carries `effects[]`.
			var rawAction = actionDef as unknown as Record<string, unknown>
			var seq: unknown[] = []
			if (Array.isArray(rawAction['effects'])) seq = rawAction['effects'] as unknown[]
			else if (isRecord(rawAction['effect'])) seq = [rawAction['effect']]
			else {
				return Promise.resolve({ ok: false as const, error: 'action "' + action + '" has no effects' })
			}
			var next = cloneState(state)
			var applyError: string | null = null
			for (var si = 0; si < seq.length; si++) {
				if (applyError) break
				var effect = seq[si] as import('./types.ts').ActionEffect
				if (effect.op === 'set') {
					var value: unknown = effect.fromArg !== undefined ? resolved[effect.fromArg] : effect.value
					if (value === undefined) {
						applyError = 'set action "' + action + '" has no value'
						break
					}
					next[effect.field] = value as number | string | boolean
				} else if (effect.op === 'append') {
					var entryValue: unknown = effect.fromArg !== undefined ? resolved[effect.fromArg] : effect.value
					if (entryValue === undefined) {
						applyError = 'append action "' + action + '" has no value'
						break
					}
					var list = next[effect.field]
					if (!Array.isArray(list)) {
						applyError = 'field "' + effect.field + '" is not an array'
						break
					}
					if (typeof entryValue === 'string') {
						var maxEntry = effect.maxEntryBytes !== undefined ? effect.maxEntryBytes : APPEND_MAX_ENTRY_BYTES
						if (byteLength(entryValue) > maxEntry) {
							applyError = 'append entry exceeds ' + maxEntry + ' bytes'
							break
						}
					}
					var grown = (list as Array<number | string | boolean>).concat([entryValue as number | string | boolean])
					var cap = effect.cap !== undefined ? effect.cap : APPEND_CAP
					if (grown.length > cap) grown = grown.slice(grown.length - cap)
					next[effect.field] = grown
				} else if (effect.op === 'increment') {
					// Deprecated sugar over set: computes the next integer and sets it.
					// Kept until migration retires it; prefer a set effect instead.
					var step: unknown = effect.byArg !== undefined ? resolved[effect.byArg] : effect.by !== undefined ? effect.by : 1
					if (typeof step !== 'number' || !Number.isSafeInteger(step)) {
						applyError = 'increment step for "' + effect.field + '" is not a safe integer'
						break
					}
					var current = next[effect.field]
					if (typeof current !== 'number') {
						applyError = 'field "' + effect.field + '" is not an integer'
						break
					}
					next[effect.field] = current + step
				} else if (effect.op === 'toggle') {
					// Deprecated sugar over set: negates the boolean field via set.
					// Kept until migration retires it; prefer a set effect instead.
					var cur = next[effect.field]
					if (typeof cur !== 'boolean') {
						applyError = 'field "' + effect.field + '" is not a boolean'
						break
					}
					next[effect.field] = !cur
				} else if (effect.op === 'reset') {
					// Deprecated sugar over set: resets every field to its initial
					// value via set. Kept until migration retires it.
					var fresh = cloneState(definition.stateSchema.initial)
					for (var k of Object.keys(next)) delete next[k]
					for (var fk of Object.keys(fresh)) next[fk] = fresh[fk]
				} else {
					applyError = 'unknown effect op "' + String((effect as unknown as Record<string, unknown>)['op']) + '"'
					break
				}
			}
			if (applyError) {
				return Promise.resolve({ ok: false as const, error: applyError })
			}

			// 3. Validate the resulting state against the schema BEFORE writing.
			for (var field of Object.keys(definition.stateSchema.fields)) {
				var ferr = checkFieldValue(field, definition.stateSchema.fields[field], next[field])
				if (ferr) {
					return Promise.resolve({ ok: false as const, error: 'action "' + action + '" rejected: ' + ferr })
				}
			}

			// 4. Single write — the only mutation point.
			return writeJson(active, stateKey(id), next).then(function (): Promise<ActResult> {
				return record_use(id, active).then(function (): ActResult {
					return { ok: true, state: next }
				})
			})
		})
	})
}

export interface AddAppOptions {
	resetState?: boolean
	migrate?: Record<string, string>
}

/**
 * Install a unified app definition. Validate-all-first, then a definition
 * write followed by a state write. A failed call writes
 * nothing: storage is byte-identical to before the call.
 *
 * Same-id overwrite preserves state by default (declared fields carried
 * forward, dropped fields reset to `initial`) and leaves
 * pins, hidden flags, homepage placement, and recent entries untouched.
 * `resetState: true` restores the legacy wipe; `migrate` maps old field
 * names to new ones with validator-checked values (unmappable aborts).
 */
export function add_app(
	definition: AppDefinition,
	store?: KeyStore | AddAppOptions,
	opts?: AddAppOptions,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	var activeStore: KeyStore | undefined = undefined
	var options: AddAppOptions = {}
	if (store && isKeyStore(store)) {
		activeStore = store
		if (opts) options = opts
	} else if (store && typeof store === 'object') {
		options = store as AddAppOptions
	}
	if (typeof definition.schemaVersion === 'number' && definition.schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
		return Promise.resolve({ ok: false as const, error: 'App "' + definition.id + '" requires schema version ' + MIN_SUPPORTED_SCHEMA_VERSION + ' (has ' + definition.schemaVersion + ')' })
	}
	var compiled = compileDefinition(definition)
	if (!compiled.ok) return Promise.resolve({ ok: false as const, error: compiled.error })
	var def: AppDefinition = compiled.definition
	return getRunningPackageVersion().then(function (running: string) {
		if (definition.minPackageVersion !== undefined) {
			var min = parsePackageVersion(definition.minPackageVersion)
			var run = parsePackageVersion(running)
			if (min !== null && run !== null && comparePackageVersions(run, min) < 0) {
				return { ok: false as const, error: 'App "' + definition.id + '" requires package version ' + definition.minPackageVersion + ' (running ' + running + ')' }
			}
		}
		return resolveStore(activeStore).then(function (active: KeyStore) {
		return Promise.all([
			readJson<AppDefinition>(active, defKey(definition.id)),
			readJson<AppState>(active, stateKey(definition.id)),
		]).then(function (pair): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
			var existing = pair[0]
			var existingState = pair[1]
			if (options.resetState === true && options.migrate !== undefined) {
				return Promise.resolve({ ok: false as const, error: 'add_app options resetState and migrate are mutually exclusive' })
			}
			if (!existing && definition.schemaVersion !== DEFINITION_SCHEMA_VERSION) {
				return Promise.resolve({
					ok: false as const,
					error:
						'definition.schemaVersion ' +
						definition.schemaVersion +
						' is stale for a new app; send the current version ' +
						DEFINITION_SCHEMA_VERSION +
						' (re-adding an existing id restamps it)',
				})
			}
			var candidate: AppState
				var freshInitial = cloneState(definition.stateSchema.initial as AppState)
			if (!existing) {
				candidate = freshInitial
			} else if (options.resetState === true) {
				candidate = freshInitial
			} else {
				candidate = cloneState(freshInitial)
					var newFields = definition.stateSchema.fields as Record<string, StateFieldDef>
				var stored: AppState = existingState ? existingState : ({} as AppState)
					for (var fname of Object.keys(newFields)) {
						if (fname in stored) {
							var perr = checkFieldValue(fname, newFields[fname], stored[fname])
							if (perr) {
								return Promise.resolve({ ok: false as const, error: 'preserved state invalid: ' + perr })
							}
							candidate[fname] = stored[fname]
						}
					}
					if (options.migrate !== undefined) {
						if (!isRecord(options.migrate)) {
							return Promise.resolve({ ok: false as const, error: 'add_app migrate must be an object mapping old field names to new ones' })
						}
						var mapping = options.migrate as Record<string, unknown>
						for (var oldName of Object.keys(mapping)) {
							var newName = mapping[oldName]
							if (typeof newName !== 'string') {
								return Promise.resolve({ ok: false as const, error: 'migrate maps old field "' + oldName + '" to a non-string field name' })
							}
							if (!(oldName in stored)) {
								return Promise.resolve({ ok: false as const, error: 'migrate maps unknown old field "' + oldName + '"' })
							}
							if (!(newName in newFields)) {
								return Promise.resolve({ ok: false as const, error: 'migrate maps to unknown new field "' + newName + '"' })
							}
							var merr = checkFieldValue(newName, newFields[newName], stored[oldName])
							if (merr) {
								return Promise.resolve({ ok: false as const, error: 'migrate value invalid: ' + merr })
							}
							candidate[newName] = stored[oldName]
						}
					}
			}
				for (var cfield of Object.keys(def.stateSchema.fields)) {
					var cerr = checkFieldValue(cfield, def.stateSchema.fields[cfield], candidate[cfield])
				if (cerr) {
					return Promise.resolve({ ok: false as const, error: 'candidate state invalid: ' + cerr })
				}
			}
				return writeJson(active, defKey(def.id), def)
					.then(function () {
						return writeJson(active, stateKey(def.id), candidate)
					})
					.then(function (): { ok: true; id: string } {
						return { ok: true as const, id: def.id }
					})
			})
		})
	})
}

/**
 * Uninstall an app: delete its definition and state and scrub every reference
 * list (pinned, hidden, recent, homepage). Validation runs before any write:
 * an unknown id returns { ok:false } and storage is untouched.
 */
export function remove_app(
	id: string,
	store?: KeyStore,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readJson<AppDefinition>(active, defKey(id)).then(function (def) {
			if (!def) {
				return { ok: false as const, error: 'unknown app "' + id + '"' }
			}
			return Promise.all([readPinned(active), readHidden(active), readRecent(active), readHomepage(active)]).then(function (lists) {
				var pinned = lists[0].filter(function (one: string): boolean { return one !== id })
				var hidden = lists[1].filter(function (one: string): boolean { return one !== id })
				var recent = lists[2].filter(function (one: string): boolean { return one !== id })
				var homepage = lists[3].filter(function (one: string): boolean { return one !== id })
				return writePinned(active, pinned)
					.then(function () { return writeHidden(active, hidden) })
					.then(function () { return writeRecent(active, recent) })
					.then(function () { return writeHomepage(active, homepage) })
					.then(function () { return deleteKey(active, stateKey(id)) })
					.then(function () { return deleteKey(active, defKey(id)) })
					.then(function () { return deleteInstallSnapshot(active, id) })
					.then(function (): { ok: true; id: string } {
						return { ok: true as const, id: id }
					})
			})
		})
	})
}

/**
 * The catalog base a Store declares in its own definition: the `proxy`
 * entry named `catalog`. The shell fetches that Store's catalog only
 * from the declared base. Returns null when the definition declares
 * no `catalog` entry or the entry has no usable URL.
 */
export function declaredCatalogBase(def: AppDefinition | null | undefined): string | null {
	if (!def || !def.capabilities || !Array.isArray(def.capabilities.proxy)) return null
	var entries = def.capabilities.proxy
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i]
		if (entry && entry.name === 'catalog' && typeof entry.url === 'string' && entry.url !== '') return entry.url
	}
	return null
}

/**
 * The listing base a Store declares in its own definition: the proxy
 * entry named catalog-apps. Returns null when the definition declares
 * no such entry or the entry has no usable URL. Changing it is a
 * definition change (catalogVersion +1) like changing catalog.
 */
export function declaredCatalogAppsBase(def: AppDefinition | null | undefined): string | null {
	if (!def || !def.capabilities || !Array.isArray(def.capabilities.proxy)) return null
	var entries = def.capabilities.proxy
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i]
		if (entry && entry.name === 'catalog-apps' && typeof entry.url === 'string' && entry.url !== '') return entry.url
	}
	return null
}

/** Catalog base declared by one installed app (the Store driving the
 * call), or null when it declares none. Stored declarations were
 * HTTPS-validated at install; a stored base that no longer validates
 * is treated as no source rather than fetched. */
function actingCatalogBase(active: KeyStore, actingId: string): Promise<string | null> {
	return readJson<AppDefinition>(active, defKey(actingId)).then(function (def) {
		var declared = declaredCatalogBase(def !== undefined ? def : null)
		if (declared === null) return null
		try {
		normalizeCatalogBase(declared)
	} catch (err) {
		return null
	}
		return declared
	})
}

/** Catalog base declared by the installed App Store, or null when no
 * Store is installed or it declares none. */
function installedStoreCatalogBase(active: KeyStore): Promise<string | null> {
	return actingCatalogBase(active, 'app-store')
}

/** Listing base declared by one installed app (the Store driving the
 * call), or null when it declares none. Same validation rule as
 * actingCatalogBase: a stored base that no longer validates is
 * treated as no source rather than fetched. */
function actingCatalogAppsBase(active: KeyStore, actingId: string): Promise<string | null> {
	return readJson<AppDefinition>(active, defKey(actingId)).then(function (def) {
		var declared = declaredCatalogAppsBase(def !== undefined ? def : null)
		if (declared === null) return null
		try {
			normalizeCatalogBase(declared)
		} catch (err) {
			return null
		}
		return declared
	})
}

/** Listing base declared by the installed App Store, or null when no
 * Store is installed or it declares none. */
function installedStoreCatalogAppsBase(active: KeyStore): Promise<string | null> {
	return actingCatalogAppsBase(active, 'app-store')
}

/**
 * Resolve the base for a browser management call, by target: a Store
 * self-update (app-store) uses the discovery base (the acting
 * Store's catalog entry, main); every other app uses the listing base
 * (the acting Store's catalog-apps entry, pinned tag) when the acting
 * Store declares one, falling back to the discovery base when it
 * declares none. The dev override, when set, replaces both bases
 * (local verification uses one loopback base for everything). Null
 * means the acting Store declares no source. The management API takes
 * no explicit base parameter, so the override is the only thing that
 * beats a declaration; agent calls with an explicit base parameter
 * keep winning over the override via resolveAgentCatalogBase. The
 * resolved base is passed on as an explicit base, which the fetch
 * layer then uses as-is without re-applying the override.
 */
function resolveManagedBase(active: KeyStore, actingId: string, targetId?: string): Promise<string | null> {
	var override: string | null = null
	try {
		override = devOverrideBase()
	} catch (err) {
		override = null
	}
	if (override !== null) return Promise.resolve(override)
	if (targetId === 'app-store') return actingCatalogBase(active, actingId)
	return actingCatalogAppsBase(active, actingId).then(function (listing) {
		if (listing !== null) return listing
		return actingCatalogBase(active, actingId)
	})
}

/** Both bases for a management rows call: the discovery base (the
 * acting Store's catalog entry) and the listing base (its
 * catalog-apps entry, or the discovery base when it declares none).
 * The dev override, when set, is both. */
function resolveManagedBases(active: KeyStore, actingId: string): Promise<{ discovery: string | null; listing: string | null }> {
	var override: string | null = null
	try {
		override = devOverrideBase()
	} catch (err) {
		override = null
	}
	if (override !== null) return Promise.resolve({ discovery: override, listing: override })
	return actingCatalogBase(active, actingId).then(function (discovery) {
		return actingCatalogAppsBase(active, actingId).then(function (listing) {
			return { discovery: discovery, listing: listing !== null ? listing : discovery }
		})
	})
}

function noCatalogSourceError(caller: string, id: string): string {
	return caller + ': no catalog source for "' + id + '" (supply catalogBase or install the App Store)'
}/** Resolve the base for an agent catalog call: the explicit parameter
 * when supplied (validated — a refused base is an `{ ok: false }`
 * with no write), else the dev override when set (kept as-is: the
 * override replaces the installed-Store base), else the installed App
 * Store's declared base for that target (listing base for apps,
 * discovery base for the Store itself). Null means no source: refuse,
 * write nothing.
 * The resolved base is passed explicitly to the fetch layer, where an
 * explicitly passed base always wins over the override — so the
 * precedence here holds end to end. */
function resolveAgentCatalogBase(active: KeyStore, catalogBase: string | undefined, targetId?: string): Promise<string | null> {
	if (catalogBase !== undefined) {
		try {
			return Promise.resolve(normalizeCatalogBase(catalogBase))
		} catch (err) {
			return Promise.reject(err)
		}
	}
	var override: string | null = null
	try {
		override = devOverrideBase()
	} catch (err) {
		override = null
	}
	if (override !== null) return Promise.resolve(override)
	if (targetId === 'app-store') return installedStoreCatalogBase(active)
	return installedStoreCatalogAppsBase(active).then(function (listing) {
		if (listing !== null) return listing
		return installedStoreCatalogBase(active)
	})
}

function installFromCatalogBase(
	id: string,
	active: KeyStore,
	base: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return get_catalog_definition(id, base).then(function (def) {
		if (def === null) return { ok: false as const, error: 'unknown catalog app "' + id + '"' }
		return add_app(def, active)
	})
}

/**
 * Install a shipped catalog app by id, through the validated `add_app`
 * path. Idempotent: re-installing an already-installed app preserves
 * its state and restamps it to the catalog definition (same as a
 * re-add). Unknown catalog ids return `{ ok: false }` naming the id
 * and write nothing. Never passes `resetState`, so state is never
 * wiped by an install.
 *
 * The catalog source is caller-supplied: an explicit `catalogBase`
 * when given, else the installed App Store's declared base for that target (listing base for apps, discovery base for the Store itself). With
 * neither, the call is refused naming that no catalog source was
 * given, and nothing is written.
 */
export function install_from_catalog(
	id: string,
	store?: KeyStore,
	catalogBase?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return resolveAgentCatalogBase(active, catalogBase, id).then(function (base) {
			if (base === null) return { ok: false as const, error: noCatalogSourceError('install_from_catalog', id) }
			return installFromCatalogBase(id, active, base)
		}, function (err) {
			return { ok: false as const, error: 'install_from_catalog: catalog base refused for "' + id + '": ' + (err instanceof Error ? err.message : String(err)) }
		})
	})
}

/**
 * Bring an already-installed app up to its shipped catalog definition,
 * preserving state (bundle and definition replaced, state carried
 * forward by `add_app`). Refuses to install: an id that is not
 * installed returns `{ ok: false }` directing the caller to
 * `install_from_catalog`, and an id that is not in the catalog
 * returns `{ ok: false }` naming the id. Nothing is written on
 * either failure.
 */
function updateFromCatalogBase(
	id: string,
	active: KeyStore,
	base: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return get_catalog_definition(id, base).then(function (def) {
		if (def === null) return { ok: false as const, error: 'unknown catalog app "' + id + '"' }
		return get_app(id, active).then(function (entry) {
			if ('error' in entry) {
				return { ok: false as const, error: 'app "' + id + '" is not installed (use install_from_catalog to install it)' }
			}
			return add_app(def as AppDefinition, active)
		})
	})
}

export function update_from_catalog(
	id: string,
	store?: KeyStore,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return resolveAgentCatalogBase(active, undefined, id).then(function (base) {
			if (base === null) return { ok: false as const, error: noCatalogSourceError('update_from_catalog', id) }
			return updateFromCatalogBase(id, active, base)
		})
	})
}

/**
 * Absorb an agent-merged definition for a modified catalog app,
 * keeping local customizations and recording the merged definition
 * as the new baseline. The merge itself is the agent's job (the
 * absorb prompt: backup first, compare export_app against
 * get_catalog_definition, show the merge plan, ask before
 * writing); this export is the thin "install this merged
 * definition and make it the baseline" primitive. Validates and
 * writes through add_app, then records a new snapshot at the
 * catalog version carrying the catalog fingerprint absorbed from.
 * Refuses with no write unless the app is installed, is in the
 * catalog, and its status is behind-modified, modified-current,
 * or absorbed-behind, and unless the merged definition's
 * catalogVersion equals the catalog's. Refuses when the merged
 * definition's id does not match the requested id.
 *
 * Signature mirrors install_from_catalog with the merged
 * definition inserted: (id, definition, store?, catalogBase?).
 * The third parameter also accepts a base URL string, so an MCP
 * caller passing (id, definition, catalogBase) works positionally.
 */
export function absorb_from_catalog(
	id: string,
	definition: AppDefinition,
	store?: KeyStore | string,
	catalogBase?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	var activeStore: KeyStore | undefined = undefined
	var baseArg: string | undefined = catalogBase
	if (typeof store === 'string') {
		baseArg = store
	} else if (store) {
		activeStore = store
	}
	return resolveStore(activeStore).then(function (active: KeyStore) {
		return resolveAgentCatalogBase(active, baseArg, id).then(function (base) {
			if (base === null) return { ok: false as const, error: noCatalogSourceError('absorb_from_catalog', id) }
			return get_catalog_entry(id, base).then(function (entry) {
				if (entry === null) return { ok: false as const, error: 'absorb_from_catalog: unknown catalog app "' + id + '"' }
				return get_app_status(id, active, base).then(function (info) {
					if (!info.installed) return { ok: false as const, error: 'absorb_from_catalog: app "' + id + '" is not installed' }
					if (info.status !== 'behind-modified' && info.status !== 'modified-current' && info.status !== 'absorbed-behind') {
						return { ok: false as const, error: 'absorb_from_catalog: app "' + id + '" cannot be absorbed: status is "' + info.status + '"' }
					}
					if (definition.id !== id) return { ok: false as const, error: 'absorb_from_catalog: definition id "' + definition.id + '" does not match "' + id + '"' }
					if (definition.catalogVersion !== entry.catalogVersion) return { ok: false as const, error: 'absorb_from_catalog: merged definition catalogVersion ' + String(definition.catalogVersion) + ' does not match catalog version ' + String(entry.catalogVersion) }
					return add_app(definition, active).then(function (added) {
						if (!added.ok) return added
						return recordAbsorbSnapshot(active, id, entry.fingerprint).then(function (snap) {
							if (!snap.ok) return snap
							return { ok: true as const, id: id }
						})
					})
				})
			})
		}, function (err) {
			return { ok: false as const, error: 'absorb_from_catalog: catalog base refused for "' + id + '": ' + (err instanceof Error ? err.message : String(err)) }
		})
	})
}

/**
 * Install snapshot (app-store Decisions 8-11): recorded only by a store
 * install or store update, separate from the definition, holding the
 * catalogVersion at install time and the fingerprint of the definition
 * as actually stored (after add_app normalization). Generic add_app and
 * import_app never write it; remove_app deletes it; it is never part
 * of an export. A snapshot MAY also carry `catalogFingerprint`, the
 * fingerprint of the catalog definition absorbed from, set only by
 * `absorb_from_catalog`. Storage key: kody-os.apps.snapshot.<id>.
 */
export interface InstallSnapshot {
	catalogVersion: number
	fingerprint: string
	/** Fingerprint of the catalog definition absorbed from; set only by absorb_from_catalog. */
	catalogFingerprint?: string
}

var SNAPSHOT_PREFIX = 'kody-os.apps.snapshot.'

function snapshotKey(id: string): string {
	return SNAPSHOT_PREFIX + id
}

export function readInstallSnapshot(store: KeyStore, id: string): Promise<InstallSnapshot | null> {
	return readJson<InstallSnapshot>(store, snapshotKey(id)).then(function (raw): InstallSnapshot | null {
		if (!raw || typeof raw.catalogVersion !== 'number' || typeof raw.fingerprint !== 'string') return null
		return raw
	})
}

export function writeInstallSnapshot(store: KeyStore, id: string, snapshot: InstallSnapshot): Promise<void> {
	return writeJson(store, snapshotKey(id), snapshot)
}

export function deleteInstallSnapshot(store: KeyStore, id: string): Promise<void> {
	return deleteKey(store, snapshotKey(id))
}

function recordInstallSnapshot(store: KeyStore, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
	return readJson<AppDefinition>(store, defKey(id)).then(function (def): Promise<{ ok: true } | { ok: false; error: string }> {
		if (!def) return Promise.resolve({ ok: false as const, error: 'app "' + id + '" is not installed' })
		if (typeof def.catalogVersion !== 'number') return Promise.resolve({ ok: false as const, error: 'app "' + id + '" has no catalogVersion to snapshot' })
		return writeInstallSnapshot(store, id, { catalogVersion: def.catalogVersion, fingerprint: fingerprintDefinition(def) }).then(function (): { ok: true } {
			return { ok: true as const }
		})
	})
}

function recordAbsorbSnapshot(store: KeyStore, id: string, catalogFingerprint: string): Promise<{ ok: true } | { ok: false; error: string }> {
	return readJson<AppDefinition>(store, defKey(id)).then(function (def): Promise<{ ok: true } | { ok: false; error: string }> {
		if (!def) return Promise.resolve({ ok: false as const, error: 'app "' + id + '" is not installed' })
		if (typeof def.catalogVersion !== 'number') return Promise.resolve({ ok: false as const, error: 'app "' + id + '" has no catalogVersion to snapshot' })
		return writeInstallSnapshot(store, id, { catalogVersion: def.catalogVersion, fingerprint: fingerprintDefinition(def), catalogFingerprint: catalogFingerprint }).then(function (): { ok: true } {
			return { ok: true as const }
		})
	})
}

/**
 * Store install: install_from_catalog plus a snapshot write. Offered
 * only for not-installed ids by the store page; a re-install through
 * this path still records the new snapshot, matching "store install"
 * in the spec. Generic add_app callers never get a snapshot.
 */
export function store_install_from_catalog(
	id: string,
	store?: KeyStore,
	catalogBase?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return resolveAgentCatalogBase(active, catalogBase, id).then(function (base) {
			if (base === null) return { ok: false as const, error: noCatalogSourceError('store_install_from_catalog', id) }
			return installFromCatalogBase(id, active, base).then(function (result) {
				if (!result.ok) return result
				return recordInstallSnapshot(active, id).then(function (snap) {
					if (!snap.ok) return snap
					return result
				})
			})
		}, function (err) {
			return { ok: false as const, error: 'store_install_from_catalog: catalog base refused for "' + id + '": ' + (err instanceof Error ? err.message : String(err)) }
		})
	})
}

/**
 * Store update: update_from_catalog plus a snapshot replacement.
 * State is preserved by the add_app rule (surviving fields carry
 * forward, dropped fields reset); pins, hidden flags, homepage
 * placement, and recency are untouched by add_app. The store page,
 * not this function, owns the modified-app confirmation gate.
 */
export function store_update_from_catalog(
	id: string,
	store?: KeyStore,
	catalogBase?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return resolveAgentCatalogBase(active, catalogBase, id).then(function (base) {
			if (base === null) return { ok: false as const, error: noCatalogSourceError('store_update_from_catalog', id) }
			return updateFromCatalogBase(id, active, base).then(function (result) {
				if (!result.ok) return result
				return recordInstallSnapshot(active, id).then(function (snap) {
					if (!snap.ok) return snap
					return result
				})
			})
		}, function (err) {
			return { ok: false as const, error: 'store_update_from_catalog: catalog base refused for "' + id + '": ' + (err instanceof Error ? err.message : String(err)) }
		})
	})
}

/**
 * Bundle management API (data-only App Store). These functions are
 * the browser-facing management path: they reuse the store
 * install/update logic and snapshot rules, and they add the two
 * gates the shell Store page used to own — the manageApps
 * capability check, and the confirmation gate for modified apps
 * and for capability expansion. They are NOT MCP exports: agents
 * keep using install_from_catalog / update_from_catalog, and
 * the agent is the installer that surfaces capabilities before
 * calling them. The shell route translates a permission failure
 * into the feed-style plain 404; other failures keep their
 * error text so the bundle can render them.
 */
export type ManageResult =
	| { ok: true; id?: string; rows?: StoreRow[]; catalogRelease?: string; catalogCached?: boolean; catalogError?: string; storeSelf?: StoreSelfUpdate }
	| { ok: false; error: string; needsConfirmation?: boolean; additions?: string[]; permissionDenied?: boolean; catalogRelease?: string; catalogCached?: boolean }

function checkManagePermission(active: KeyStore, actingId: string): Promise<boolean> {
	return readJson<AppDefinition>(active, defKey(actingId)).then(function (def) {
		return def !== null && def !== undefined && def.capabilities !== undefined && def.capabilities.manageApps === true
	})
}/**
 * The App Store's own update state for the separate self-update
 * section above the apps list. The rows payload carries it so the
 * bundle needs no second endpoint. pinnedLabel is the tag ref of the
 * listing base (for example 4.1.11), the full base label for a
 * non-GitHub listing base, or null when the Store declares no listing
 * base and the list follows the discovery base. discoveryRef is the
 * GitHub ref of the discovery base (main), or null for a non-GitHub
 * base, where discoveryLabel carries the full base label instead.
 * latestCatalogVersion is the Store version on the discovery base, or
 * null when it could not be read; hasUpdate is true only when that
 * version is newer than the installed one and compatible with the
 * running shell. When the latest Store needs a newer shell,
 * needsNewerShell is true, hasUpdate is false, and the section shows
 * the requirement with Remove (the gated-row Remove behaviour).
 */
export interface StoreSelfUpdate {
	installedCatalogVersion: number
	pinnedLabel: string | null
	discoveryRef: string | null
	discoveryLabel: string | null
	runningVersion: string
	latestCatalogVersion: number | null
	latestMinPackageVersion?: string
	needsNewerShell: boolean
	hasUpdate: boolean
	error?: string
}

function getStoreSelfUpdate(active: KeyStore, actingId: string, discovery: string | null, listing: string | null): Promise<StoreSelfUpdate> {
	return Promise.all([
		readJson<AppDefinition>(active, defKey(actingId)),
		getRunningPackageVersion(),
	]).then(function (parts) {
		var installedDef = parts[0]
		var running = parts[1]
		var installedVersion = installedDef !== undefined && typeof installedDef.catalogVersion === 'number' ? installedDef.catalogVersion : 0
		var pinnedLabel: string | null = null
		if (listing !== null && listing !== discovery) {
			var tag = catalogTagLabel(listing)
			pinnedLabel = tag !== null ? tag : catalogLabelForBase(listing)
		}
		var discoveryRef: string | null = discovery !== null ? catalogGitHubRef(discovery) : null
		var discoveryLabel: string | null = discovery !== null && discoveryRef === null ? catalogLabelForBase(discovery) : null
		var self: StoreSelfUpdate = { installedCatalogVersion: installedVersion, pinnedLabel: pinnedLabel, discoveryRef: discoveryRef, discoveryLabel: discoveryLabel, runningVersion: running, latestCatalogVersion: null, needsNewerShell: false, hasUpdate: false }
		if (discovery === null) {
			self.error = 'This Store declares no catalog source.'
			return self
		}
		return get_catalog_definition_meta('app-store', discovery).then(function (latestDef) {
			if (latestDef === null) {
				self.error = 'Could not read the App Catalog from the discovery base.'
				return self
			}
			var latestVersion = typeof latestDef.catalogVersion === 'number' ? latestDef.catalogVersion : 0
			var latestMin = (latestDef as unknown as Record<string, unknown>)['minPackageVersion'] !== undefined ? String((latestDef as unknown as Record<string, unknown>)['minPackageVersion']) : undefined
			var gated = latestMin !== undefined ? rowNeedsNewerShell(latestMin, running) : false
			self.latestCatalogVersion = latestVersion
			if (latestMin !== undefined) self.latestMinPackageVersion = latestMin
			self.needsNewerShell = gated
			self.hasUpdate = latestVersion > installedVersion && !gated
			return self
		})
	})
}

export function manage_rows(actingId: string, store?: KeyStore): Promise<ManageResult> {
	return resolveStore(store).then(function (active: KeyStore) {
		return checkManagePermission(active, actingId).then(function (allowed) {
			if (!allowed) return { ok: false as const, error: 'management not permitted', permissionDenied: true }
			return resolveManagedBases(active, actingId).then(function (bases) {
				var base = bases.listing
				return get_store_rows(active, base !== null ? base : undefined).then(function (allRows) {
					// The App Store is not a row in its own list: its update
					// lives in the separate self-update section (storeSelf).
					var rows = allRows.filter(function (row) { return row.id !== 'app-store' })
					return getStoreSelfUpdate(active, actingId, bases.discovery, bases.listing).then(function (self) {
						if (base === null) {
							return { ok: true as const, rows: rows, storeSelf: self, catalogRelease: '', catalogCached: false, catalogError: 'This Store declares no catalog source. Showing installed apps.' }
						}
						var useBase: string = base
						return readCatalogManifest(useBase).then(function (manifest) {
							var tag = catalogTagLabel(useBase)
							return { ok: true as const, rows: rows, storeSelf: self, catalogRelease: tag !== null ? tag : manifest.releaseLabel, catalogCached: manifest.cached }
						}, function () {
							var src = get_catalog_source(useBase)
							var tag = catalogTagLabel(useBase)
							return { ok: true as const, rows: rows, storeSelf: self, catalogRelease: tag !== null ? tag : src.releaseLabel, catalogCached: true, catalogError: 'Catalog could not be refreshed. Showing installed apps. Retry to refresh.' }
						})
					})
				})
			})
		})
	})
}

export function get_store_catalog_info(store?: KeyStore, catalogBase?: string): Promise<{ releaseLabel: string; cached: boolean; error?: string }> {
	void store
	var base: string | null = null
	if (catalogBase !== undefined) {
		try {
			base = normalizeCatalogBase(catalogBase)
		} catch (err) {
			var msg0 = err instanceof Error ? err.message : String(err)
			return Promise.resolve({ releaseLabel: '', cached: true, error: msg0 })
		}
	} else {
		return Promise.resolve({ releaseLabel: '', cached: true, error: 'no catalog source given' })
	}
	return readCatalogManifest(base).then(function (manifest) {
		return { releaseLabel: manifest.releaseLabel, cached: manifest.cached }
	}, function (err) {
		var src = get_catalog_source(base as string)
		var msg = err instanceof Error ? err.message : String(err)
		return { releaseLabel: src.releaseLabel, cached: true, error: msg }
	})
}

export function manage_install(actingId: string, targetId: string, store?: KeyStore): Promise<ManageResult> {
	return resolveStore(store).then(function (active: KeyStore) {
		return checkManagePermission(active, actingId).then(function (allowed) {
			if (!allowed) return { ok: false as const, error: 'management not permitted', permissionDenied: true }
			return resolveManagedBase(active, actingId, targetId).then(function (base) {
				return get_app_status(targetId, active, base !== null ? base : undefined).then(function (info) {
					if (info.installed) return { ok: false as const, error: 'App "' + targetId + '" is already installed.' }
					if (base === null) return { ok: false as const, error: 'manage_install: no catalog source for "' + targetId + '" (the calling Store declares no catalog)' }
					return store_install_from_catalog(targetId, active, base).then(function (result) {
						if (!result.ok) return result
						return { ok: true as const, id: targetId }
					})
				})
			})
		})
	})
}

function manage_update_with_status(
	actingId: string,
	targetId: string,
	confirmed: boolean,
	store: KeyStore | undefined,
	kind: 'update' | 'restore',
): Promise<ManageResult> {
	return resolveStore(store).then(function (active: KeyStore) {
		return checkManagePermission(active, actingId).then(function (allowed) {
			if (!allowed) return { ok: false as const, error: 'management not permitted', permissionDenied: true }
			return resolveManagedBase(active, actingId, targetId).then(function (base) {
				var useBase = base !== null ? base : undefined
				return get_app_status(targetId, active, useBase).then(function (info) {
				if (!info.installed || !info.inCatalog) {
					return { ok: false as const, error: 'App "' + targetId + '" cannot be ' + kind + 'd: it is not an installed catalog app.' }
				}
				if (kind === 'update') {
					if (info.status === 'modified-current' || info.status === 'modified-ahead') {
						return { ok: false as const, error: 'App "' + targetId + '" is modified: use Restore, not Overwrite.' }
					}
					if (info.status !== 'behind-clean' && info.status !== 'catalog-differing' && info.status !== 'behind-modified' && info.status !== 'absorbed-behind' && info.status !== 'snapshot-less') {
						return { ok: false as const, error: 'App "' + targetId + '" has no update available.' }
					}
				} else {
					if (info.status !== 'modified-current' && info.status !== 'modified-ahead') {
						return { ok: false as const, error: 'App "' + targetId + '" has nothing to restore.' }
					}
				}
				return Promise.all([
					readJson<AppDefinition>(active, defKey(targetId)),
					useBase !== undefined ? get_catalog_definition(targetId, useBase) : Promise.resolve(null),
				]).then(function (pair) {
					var installedDef = pair[0]
					var catalogDef = pair[1]
					var additions = capabilityAdditions(installedDef, catalogDef)
					var needsConfirm = info.status === 'behind-modified' || info.status === 'absorbed-behind' || info.status === 'snapshot-less' || additions.length > 0
					if (kind === 'restore') needsConfirm = true
					if (needsConfirm && !confirmed) {
						return {
							ok: false as const,
							error: 'Confirmation required before ' + kind + 'ing "' + targetId + '".',
							needsConfirmation: true,
							additions: additions,
						}
					}
					if (useBase === undefined) {
						return { ok: false as const, error: 'manage_' + kind + ': no catalog source for "' + targetId + '" (the calling Store declares no catalog)' }
					}
					return store_update_from_catalog(targetId, active, useBase).then(function (result) {
						if (!result.ok) return result
						return { ok: true as const, id: targetId }
					})
				})
			})
			})
		})
	})
}

/**
 * Management remove: permission-checked remove_app for the browser
 * Store. Only the Store's own Remove button offers it, for up-to-date
 * rows, but the API itself removes any installed app: it deletes the
 * definition, state, and snapshot and scrubs every reference list,
 * exactly like the agent remove_app it wraps. Removal always requires
 * confirmation: without confirmed, nothing is written and the caller
 * gets needsConfirmation, which the bundle answers with its own
 * confirmation dialog.
 */
export function manage_remove(actingId: string, targetId: string, confirmed: boolean, store?: KeyStore): Promise<ManageResult> {
	return resolveStore(store).then(function (active: KeyStore) {
		return checkManagePermission(active, actingId).then(function (allowed) {
			if (!allowed) return { ok: false as const, error: 'management not permitted', permissionDenied: true }
			return get_app_status(targetId, active).then(function (info) {
				if (!info.installed) {
					return { ok: false as const, error: 'App "' + targetId + '" is not installed.' }
				}
				if (!confirmed) {
					return {
						ok: false as const,
						error: 'Confirmation required before removing "' + targetId + '".',
						needsConfirmation: true,
						additions: [],
					}
				}
				return remove_app(targetId, active).then(function (result) {
					if (!result.ok) return result
					return { ok: true as const, id: targetId }
				})
			})
		})
	})
}

export function manage_update(actingId: string, targetId: string, confirmed: boolean, store?: KeyStore): Promise<ManageResult> {
	return manage_update_with_status(actingId, targetId, confirmed, store, 'update')
}

export function manage_restore(actingId: string, targetId: string, confirmed: boolean, store?: KeyStore): Promise<ManageResult> {
	return manage_update_with_status(actingId, targetId, confirmed, store, 'restore')
}

export type AppStoreStatus =
	| 'not-installed'
	| 'up-to-date'
	| 'behind-clean'
	| 'catalog-differing'
	| 'behind-modified'
	| 'modified-current'
	| 'modified-ahead'
	| 'snapshot-less'
	| 'absorbed'
	| 'absorbed-behind'
	| 'storage-only'
	| 'storage-only-formerly'

export interface AppStoreStatusInfo {
	status: AppStoreStatus
	installed: boolean
	inCatalog: boolean
	/** True when the installed definition differs from its snapshot. False for clean installs; meaningless for snapshot-less rows. */
	modified: boolean
	installedVersion?: number
	catalogVersion?: number
	snapshotVersion?: number
}

/**
 * Derive one app's store status from installed fingerprint (I), snapshot
 * fingerprint (S), catalog fingerprint (C, canonicalized the same way),
 * installed catalogVersion (Iv), and catalog catalogVersion (Cv).
 * Content equality wins: I == C is up to date whatever the version
 * fields say. Edge case not named in the spec matrix: an app matching
 * its snapshot, ahead of the catalog (Iv > Cv), with a differing
 * catalog copy is classified modified-ahead for control purposes
 * (Restore, confirmed, never Update) with modified=false, since the
 * user changed nothing but the catalog copy is not the installed one.
 * When the snapshot carries `catalogFingerprint`, the absorbed cases
 * take precedence: I == S and the field equals C yields `absorbed`;
 * I == S and it differs yields `absorbed-behind`.
 */
export function get_app_status(
	id: string,
	store?: KeyStore,
	catalogBase?: string,
): Promise<AppStoreStatusInfo> {
	return resolveStore(store).then(function (active: KeyStore) {
		return Promise.all([
			readJson<AppDefinition>(active, defKey(id)),
			readInstallSnapshot(active, id),
			catalogBase !== undefined ? get_catalog_entry(id, catalogBase) : Promise.resolve(null),
		]).then(function (parts) {
			var installed = parts[0]
			var snapshot = parts[1]
			var catalogEntry = parts[2]
			var catalogDef: { catalogVersion?: number } | null = catalogEntry
			if (!installed) {
				return {
					status: 'not-installed' as const,
					installed: false,
					inCatalog: catalogDef !== null,
					modified: false,
					catalogVersion: catalogDef !== null && catalogDef.catalogVersion !== undefined ? catalogDef.catalogVersion : undefined,
				}
			}
			if (catalogDef === null) {
				return {
					status: snapshot !== null ? ('storage-only-formerly' as const) : ('storage-only' as const),
					installed: true,
					inCatalog: false,
					modified: false,
					installedVersion: installed.catalogVersion,
					snapshotVersion: snapshot !== null ? snapshot.catalogVersion : undefined,
				}
			}
			if (snapshot === null) {
				return {
					status: 'snapshot-less' as const,
					installed: true,
					inCatalog: true,
					modified: false,
					installedVersion: installed.catalogVersion,
					catalogVersion: catalogDef.catalogVersion,
				}
			}
			var installedFingerprint = fingerprintDefinition(installed)
			var catalogFingerprint = catalogEntry !== null ? catalogEntry.fingerprint : ''
			var iv = typeof installed.catalogVersion === 'number' ? installed.catalogVersion : 0
			var cv = catalogEntry !== null && typeof catalogEntry.catalogVersion === 'number' ? catalogEntry.catalogVersion : 0
			var modified = installedFingerprint !== snapshot.fingerprint
			var status: AppStoreStatus
			if (!modified && snapshot.catalogFingerprint !== undefined) {
				status = snapshot.catalogFingerprint === catalogFingerprint ? 'absorbed' : 'absorbed-behind'
			} else if (installedFingerprint === catalogFingerprint) {
				status = 'up-to-date'
			} else if (!modified && iv < cv) {
				status = 'behind-clean'
			} else if (!modified && iv === cv) {
				status = 'catalog-differing'
			} else if (iv < cv) {
				status = 'behind-modified'
			} else if (iv === cv) {
				status = 'modified-current'
			} else {
				status = 'modified-ahead'
			}
			return {
				status: status,
				installed: true,
				inCatalog: true,
				modified: modified,
				installedVersion: installed.catalogVersion,
				catalogVersion: catalogDef.catalogVersion,
				snapshotVersion: snapshot.catalogVersion,
			}
		})
	})
}

export interface StoreRow {
	id: string
	label: string
	name: string
	icon?: string
	category?: string
	description?: string
	installMode: string
	/** Full URL of the app's catalog folder in GitHub tree form, set when the row came from a catalog entry. */
	folderUrl?: string
	installed: boolean
	inCatalog: boolean
	status: AppStoreStatus
	modified: boolean
	pinned: boolean
	hidden: boolean
	homepage: boolean
	/** Declared capabilities of the catalog definition when present,
	 * else of the installed definition, for Store disclosure. */
	capabilities: CapabilitySummary
	/** Minimum shell version the catalog definition requires, when declared. */
	minPackageVersion?: string
	/** Running shell version the incompatibility was computed against. */
	shellVersion?: string
	/** True when the catalog definition's minimum is newer than the running shell: the Store shows the requirement instead of an install/update control. */
	needsNewerShell?: boolean
	/** Definition schema the catalog definition carries, when known. */
	schemaVersion?: number
	/** Shell's minimum supported schema version the floor check was computed against. */
	schemaFloor?: number
	/** True when the catalog definition's schema is below the shell's floor: the Store shows the schema requirement instead of an install/update control. */
	needsNewerSchema?: boolean
}

/**
 * Catalog-only list rows: one row per catalog id, in
 * alphabetical-by-id order, with each row's status and launcher flags.
 * Installed apps with no catalog entry do not appear here; they are
 * managed from Apps Edit and by agents, not from the Store. Hidden
 * apps are included (the list is unfiltered); Hide affects launcher
 * tiles only.
 */
export function get_store_rows(store?: KeyStore, catalogBase?: string): Promise<StoreRow[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return Promise.all([
			readPinned(active),
			readHidden(active),
			readHomepage(active),
			listInstalledIds(active),
			getRunningPackageVersion(),
		]).then(function (parts) {
			var pinned = parts[0]
			var hidden = parts[1]
			var homepage = parts[2]
			var installedIds = parts[3]
			var running = parts[4]
			if (catalogBase === undefined) {
				return buildStoreRowsFromInstalled(active, pinned, hidden, homepage, installedIds, running)
			}
			return list_catalog(catalogBase).then(function (catalog) {
				return buildStoreRows(active, pinned, hidden, homepage, catalog, running, catalogBase)
			}, function () {
				return buildStoreRowsFromInstalled(active, pinned, hidden, homepage, installedIds, running)
			})
		})
	})
}

function rowNeedsNewerShell(min: unknown, running: string): boolean {
	var parsedMin = parsePackageVersion(min)
	var parsedRun = parsePackageVersion(running)
	if (parsedMin === null || parsedRun === null) return false
	return comparePackageVersions(parsedRun, parsedMin) < 0
}

function buildStoreRows(
	active: KeyStore,
	pinned: string[],
	hidden: string[],
	homepage: string[],
	catalog: { id: string; label: string; name: string; icon?: string; category?: string; description?: string; installMode?: string; recipePath?: string; minPackageVersion?: string; schemaVersion?: number }[],
	running: string,
	catalogBase: string,
): Promise<StoreRow[]> {
			var idSet: Record<string, boolean> = {}
			var ids: string[] = []
			for (var ci = 0; ci < catalog.length; ci++) {
				if (!idSet[catalog[ci].id]) {
					idSet[catalog[ci].id] = true
					ids.push(catalog[ci].id)
				}
			}
			ids.sort()
			var rows: StoreRow[] = []
			var chain = Promise.resolve()
			for (var ii = 0; ii < ids.length; ii++) {
				;(function (want: string): void {
					chain = chain.then(function (): Promise<void> {
						return Promise.all([
							readJson<AppDefinition>(active, defKey(want)),
							get_app_status(want, active, catalogBase),
							get_catalog_definition_meta(want, catalogBase),
						]).then(function (triple): void {
							var installedDef = triple[0]
							var info = triple[1]
							var fetchedDef = triple[2]
							var catalogEntry: { id: string; label: string; name: string; icon?: string; category?: string; description?: string; installMode?: string; recipePath?: string } | null = null
							for (var cj = 0; cj < catalog.length; cj++) {
								if (catalog[cj].id === want) catalogEntry = catalog[cj]
							}
							var label = installedDef ? (installedDef.label || installedDef.name) : (catalogEntry ? catalogEntry.label : want)
							var name = installedDef ? installedDef.name : (catalogEntry ? catalogEntry.name : want)
							var catalogDef = fetchedDef
							var catalogMin = fetchedDef && (fetchedDef as unknown as Record<string, unknown>)['minPackageVersion'] !== undefined ? String((fetchedDef as unknown as Record<string, unknown>)['minPackageVersion']) : undefined
							var incompatible = catalogMin !== undefined ? rowNeedsNewerShell(catalogMin, running) : false
							var catalogSchema = fetchedDef && typeof (fetchedDef as unknown as Record<string, unknown>)['schemaVersion'] === 'number' ? (fetchedDef as unknown as Record<string, unknown>)['schemaVersion'] as number : undefined
							var belowFloor = catalogSchema !== undefined ? catalogSchema < MIN_SUPPORTED_SCHEMA_VERSION : false
							rows.push({
								id: want,
								label: label,
								name: name,
								icon: installedDef ? installedDef.icon : (catalogEntry ? catalogEntry.icon : undefined),
								category: installedDef ? installedDef.category : (catalogEntry ? catalogEntry.category : undefined),
								description: catalogEntry && catalogEntry.description !== undefined ? catalogEntry.description : (installedDef ? installedDef.description : undefined),
								installMode: catalogEntry && catalogEntry.installMode !== undefined ? catalogEntry.installMode : (fetchedDef && (fetchedDef as unknown as Record<string, unknown>)['installMode'] === 'recipe-only' ? 'recipe-only' : 'json'),
								folderUrl: catalogEntry ? folderUrlForBase(catalogBase, catalogEntry.id) : undefined,
								installed: info.installed,
								inCatalog: info.inCatalog,
								status: info.status,
								modified: info.modified,
								pinned: pinned.indexOf(want) !== -1,
								hidden: hidden.indexOf(want) !== -1,
								homepage: homepage.indexOf(want) !== -1,
								capabilities: summarizeCapabilities(catalogDef !== null ? catalogDef : installedDef),
								minPackageVersion: catalogMin,
								shellVersion: running,
								needsNewerShell: incompatible,
								schemaVersion: catalogSchema,
								schemaFloor: MIN_SUPPORTED_SCHEMA_VERSION,
								needsNewerSchema: belowFloor,
							})
						})
					})
				})(ids[ii])
			}
			return chain.then(function (): StoreRow[] {
				return rows
			})
}

function buildStoreRowsFromInstalled(
	active: KeyStore,
	pinned: string[],
	hidden: string[],
	homepage: string[],
	installedIds: string[],
	running: string,
): Promise<StoreRow[]> {
	var ids = installedIds.slice().sort()
	var rows: StoreRow[] = []
	var chain = Promise.resolve()
	for (var ii = 0; ii < ids.length; ii++) {
		;(function (want: string): void {
			chain = chain.then(function (): Promise<void> {
				return Promise.all([
					readJson<AppDefinition>(active, defKey(want)),
					get_app_status(want, active),
				]).then(function (pair): void {
					var installedDef = pair[0]
					var info = pair[1]
					if (!installedDef) return
					rows.push({
						id: want,
						label: installedDef.label || installedDef.name,
						name: installedDef.name,
						icon: installedDef.icon,
						category: installedDef.category,
						description: installedDef.description,
						installMode: (installedDef as unknown as Record<string, unknown>)['installMode'] === 'recipe-only' ? 'recipe-only' : 'json',
						installed: info.installed,
						inCatalog: info.inCatalog,
						status: info.status,
						modified: info.modified,
						pinned: pinned.indexOf(want) !== -1,
						hidden: hidden.indexOf(want) !== -1,
						homepage: homepage.indexOf(want) !== -1,
						capabilities: summarizeCapabilities(installedDef),
						minPackageVersion: (installedDef as unknown as Record<string, unknown>)['minPackageVersion'] !== undefined ? String((installedDef as unknown as Record<string, unknown>)['minPackageVersion']) : undefined,
						shellVersion: running,
						needsNewerShell: (installedDef as unknown as Record<string, unknown>)['minPackageVersion'] !== undefined ? rowNeedsNewerShell((installedDef as unknown as Record<string, unknown>)['minPackageVersion'], running) : false,
						schemaVersion: typeof installedDef.schemaVersion === 'number' ? installedDef.schemaVersion : undefined,
						schemaFloor: MIN_SUPPORTED_SCHEMA_VERSION,
						needsNewerSchema: typeof installedDef.schemaVersion === 'number' ? installedDef.schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION : false,
					})
				})
			})
		})(ids[ii])
	}
	return chain.then(function (): StoreRow[] {
		return rows
	})
}

/**
 * Export one app as complete JSON: full definition plus a state snapshot.
 * The result re-imports into a blank install with no code changes.
 */
export function export_app(id: string, store?: KeyStore): Promise<AppExport | { error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return loadEntry(active, id).then(function (entry) {
			if ('error' in entry) return { error: entry.error }
			return {
				format: EXPORT_FORMAT,
				exportedAt: new Date().toISOString(),
				definition: entry.definition,
				state: entry.state,
			} as AppExport
		})
	})
}

export interface InstallExport {
	format: 'kody-os-install/1'
	exportedAt: string
	apps: AppExport[]
	pinned: string[]
	hidden: string[]
	homepage?: string[]
}

/** Export the whole install: every app plus pinned/hidden prefs. Recency stays local. */
export function export_install(store?: KeyStore): Promise<InstallExport> {
	return resolveStore(store).then(function (active: KeyStore) {
		return Promise.all([listInstalledIds(active), readPinned(active), readHidden(active), readHomepage(active)]).then(function (parts) {
			var ids = parts[0]
			var pinned = parts[1]
			var hidden = parts[2]
			var homepage = parts[3]
			var apps: AppExport[] = []
			var chain = Promise.resolve()
			for (var id of ids) {
				;(function (want: string): void {
					chain = chain.then(function (): Promise<void> {
						return loadEntry(active, want).then(function (entry): void {
							if ('error' in entry) return
							apps.push({
								format: EXPORT_FORMAT,
								exportedAt: new Date().toISOString(),
								definition: entry.definition,
								state: entry.state,
							} as AppExport)
						})
					})
				})(id)
			}
			return chain.then(function (): InstallExport {					return {
						format: 'kody-os-install/1',
						exportedAt: new Date().toISOString(),
						apps: apps,
						pinned: pinned,
						hidden: hidden,
						homepage: homepage,
					}
			})
		})
	})
}

/** Import an install payload into a blank store. Restores apps plus pinned/hidden; Recent starts empty. */
export function import_install(
	payload: unknown,
	store?: KeyStore,
	options?: { overwrite?: boolean },
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
		if (!isRecord(payload) || !Array.isArray((payload as Record<string, unknown>)['apps'])) {
			return Promise.resolve({ ok: false as const, error: 'import payload needs an apps array' })
		}
		var rec = payload as Record<string, unknown>
		var list = rec['apps'] as unknown[]
		var ids: string[] = []
		var chain: Promise<{ ok: true; id: string } | { ok: false; error: string } | null> = Promise.resolve(null)
		for (var item of list) {
			;(function (one: unknown): void {
				var prev = chain
				chain = prev.then(function (blocked): Promise<{ ok: true; id: string } | { ok: false; error: string } | null> {
					if (blocked && 'ok' in blocked && blocked.ok === false) return Promise.resolve(blocked)
					return import_app(one, active, options).then(function (r) {
						if (!r.ok) return r
						ids.push(r.id)
						return null
					})
				})
			})(item)
		}
		return chain.then(function (failed): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
			if (failed && 'ok' in failed && failed.ok === false) return Promise.resolve(failed as { ok: false; error: string })
			return listInstalledIds(active).then(function (installed: string[]) {
				var pinnedRaw = Array.isArray(rec['pinned']) ? (rec['pinned'] as unknown[]) : []
				var hiddenRaw = Array.isArray(rec['hidden']) ? (rec['hidden'] as unknown[]) : []
				var homepageRaw = Array.isArray(rec['homepage']) ? (rec['homepage'] as unknown[]) : []
				var pinned: string[] = []
				var hidden: string[] = []
				var homepage: string[] = []
				for (var pi = 0; pi < pinnedRaw.length; pi++) {
					if (typeof pinnedRaw[pi] === 'string' && installed.indexOf(pinnedRaw[pi] as string) !== -1 && pinned.indexOf(pinnedRaw[pi] as string) === -1) pinned.push(pinnedRaw[pi] as string)
				}
				for (var hi = 0; hi < hiddenRaw.length; hi++) {
					if (typeof hiddenRaw[hi] === 'string' && installed.indexOf(hiddenRaw[hi] as string) !== -1 && hidden.indexOf(hiddenRaw[hi] as string) === -1) hidden.push(hiddenRaw[hi] as string)
				}
				for (var gi = 0; gi < homepageRaw.length; gi++) {
					if (typeof homepageRaw[gi] === 'string' && installed.indexOf(homepageRaw[gi] as string) !== -1 && homepage.indexOf(homepageRaw[gi] as string) === -1) homepage.push(homepageRaw[gi] as string)
				}
				return Promise.all([writePinned(active, pinned), writeHidden(active, hidden), writeHomepage(active, homepage)]).then(function (): { ok: true; ids: string[] } {
					return { ok: true as const, ids: ids }
				})
			})
		})
	})
}

function migrateImportPayload(payload: unknown): { def?: AppDefinition; error?: string } {
	if (!isRecord(payload)) return { error: 'import payload must be an object' }
	var body: unknown = payload
	if (isRecord(payload['definition'])) {
		// Export envelope (v1 or v2).
		body = payload['definition']
	}
	if (!isRecord(body)) return { error: 'import payload has no definition object' }
	var rec = body as Record<string, unknown>
	var id = reqStr(rec, 'id')
	var name = reqStr(rec, 'name')
	var label = reqStr(rec, 'label')
	if (!id) {
		// v1 payloads keyed by name: derive the id.
		if (!name) return { error: 'import payload needs an id (or a v1 name to derive it)' }
		id = name
	}
	if (!name) name = label || id
	var migrated: Record<string, unknown> = {}
	for (var k of Object.keys(rec)) migrated[k] = rec[k]
	migrated['id'] = id
	migrated['name'] = name
	if (migrated['label'] === undefined) migrated['label'] = name
	var problem = validateDefinition(migrated)
	if (problem) return { error: problem }
	return { def: migrated as unknown as AppDefinition }
}

/**
 * Import an export_app payload (v2, v1, or a bare definition) into this
 * install. Definition-and-state-write-only like add_app; no code changes, no republish.
 */
export function import_app(
	payload: unknown,
	store?: KeyStore,
	options?: { overwrite?: boolean },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		var m = migrateImportPayload(payload)
		if (m.error || !m.def) return { ok: false as const, error: m.error || 'invalid payload' }
		var def = m.def
		var needCheck = !options || options.overwrite !== true
		var checkExisting: Promise<{ ok: true; id: string } | { ok: false; error: string } | null> =
			needCheck
				? readJson(active, defKey(def.id)).then(function (existing) {
						if (existing) return { ok: false as const, error: 'app "' + def.id + '" already installed (pass overwrite:true to replace)' }
						return null
					})
				: Promise.resolve(null)
		return checkExisting.then(function (blocked) {
			if (blocked) return blocked
			return add_app(def, active).then(function (added) {
				if (!added.ok) return added
				var rawState: unknown = isRecord(payload) && isRecord(payload['state']) ? payload['state'] : undefined
				if (rawState === undefined && isRecord(payload) && isRecord(payload['definition'])) {
					var env = payload as Record<string, unknown>
					if (isRecord(env['state'])) rawState = env['state']
				}
				if (!isRecord(rawState)) return { ok: true as const, id: def.id }
				var st = rawState as Record<string, unknown>
				for (var field of Object.keys(def.stateSchema.fields)) {
					var ferr = checkFieldValue(field, def.stateSchema.fields[field], st[field])
					if (ferr) return { ok: false as const, error: 'imported state invalid: ' + ferr }
				}
				return writeJson(active, stateKey(def.id), cloneState(st as AppState)).then(function () {
					return { ok: true as const, id: def.id }
				})
			})
		})
	})
}

/**
 * Install backups (replace-with-auto-snapshot). A backup is the
 * export_install envelope plus a backup tag, stored under
 * `kody-os.backups.<name>`. Recency is not captured, exactly as
 * export_install excludes it; auth keys are never captured or touched.
 *
 * packageStorage() has no key listing, so backup names are also kept
 * in an index key, `kody-os.backups.index` (an array of names). The
 * index is maintained by backup/delete_backup only, is never wiped by
 * restore, and is never part of an export_install payload.
 */

export interface BackupEntry {
	format: 'kody-os-backup/1'
	name: string
	capturedAt: string
	install: InstallExport
}

export interface BackupSummary {
	name: string
	capturedAt: string
	appCount: number
	size: number
}

var BACKUP_PREFIX = 'kody-os.backups.'
var BACKUP_INDEX_KEY = 'kody-os.backups.index'

function backupKey(name: string): string {
	return BACKUP_PREFIX + name
}

function isBackupName(name: unknown): name is string {
	return typeof name === 'string' && NAME_RE.test(name)
}

function readBackupIndex(store: KeyStore): Promise<string[]> {
	return readJson<string[]>(store, BACKUP_INDEX_KEY).then(function (raw): string[] {
		if (!Array.isArray(raw)) return []
		var out: string[] = []
		for (var i = 0; i < raw.length; i++) {
			if (typeof raw[i] === 'string' && out.indexOf(raw[i]) === -1) out.push(raw[i])
		}
		return out
	})
}

function writeBackupIndex(store: KeyStore, names: string[]): Promise<void> {
	return writeJson(store, BACKUP_INDEX_KEY, names)
}

function readBackupEntry(store: KeyStore, name: string): Promise<BackupEntry | null> {
	return readJson<BackupEntry>(store, backupKey(name)).then(function (raw): BackupEntry | null {
		if (!raw || raw.format !== 'kody-os-backup/1' || typeof raw.name !== 'string' || !isRecord(raw.install)) return null
		return raw
	})
}

function writeBackupEntry(store: KeyStore, entry: BackupEntry): Promise<void> {
	return readBackupIndex(store).then(function (names: string[]): Promise<void> {
		if (names.indexOf(entry.name) === -1) names.push(entry.name)
		return writeJson(store, backupKey(entry.name), entry).then(function (): Promise<void> {
			return writeBackupIndex(store, names)
		})
	})
}

export function backup(
	name: string,
	optsOrStore?: KeyStore | { overwrite?: boolean },
	maybeStore?: KeyStore,
): Promise<{ ok: true; name: string; capturedAt: string; appCount: number; size: number } | { ok: false; error: string }> {
	var activeStore: KeyStore | undefined = undefined
	var overwrite = false
	if (optsOrStore && isKeyStore(optsOrStore)) {
		activeStore = optsOrStore
	} else if (optsOrStore && typeof optsOrStore === 'object') {
		overwrite = (optsOrStore as { overwrite?: boolean }).overwrite === true
		if (maybeStore) activeStore = maybeStore
	}
	if (!isBackupName(name)) return Promise.resolve({ ok: false as const, error: 'backup name must match ^[a-z0-9][a-z0-9-]{0,63}$' })
	return resolveStore(activeStore).then(function (active: KeyStore) {
		return readBackupEntry(active, name).then(function (existing) {
			if (existing && !overwrite) return { ok: false as const, error: 'backup "' + name + '" already exists (pass overwrite:true to replace it)' }
			return export_install(active).then(function (install: InstallExport) {
				var entry: BackupEntry = {
					format: 'kody-os-backup/1',
					name: name,
					capturedAt: new Date().toISOString(),
					install: install,
				}
				return writeBackupEntry(active, entry).then(function (): { ok: true; name: string; capturedAt: string; appCount: number; size: number } {
					return { ok: true as const, name: name, capturedAt: entry.capturedAt, appCount: install.apps.length, size: JSON.stringify(entry).length }
				})
			})
		})
	})
}

export function list_backups(store?: KeyStore): Promise<BackupSummary[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readBackupIndex(active).then(function (names: string[]) {
			var out: BackupSummary[] = []
			var chain = Promise.resolve()
			for (var i = 0; i < names.length; i++) {
				;(function (want: string): void {
					chain = chain.then(function (): Promise<void> {
						return readBackupEntry(active, want).then(function (entry): void {
							if (!entry) return
							out.push({
								name: entry.name,
								capturedAt: entry.capturedAt,
								appCount: Array.isArray(entry.install.apps) ? entry.install.apps.length : 0,
								size: JSON.stringify(entry).length,
							})
						})
					})
				})(names[i])
			}
			return chain.then(function (): BackupSummary[] {
				return out
			})
		})
	})
}

export function delete_backup(
	name: string,
	store?: KeyStore,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
	if (!isBackupName(name)) return Promise.resolve({ ok: false as const, error: 'unknown backup "' + String(name) + '"' })
	return resolveStore(store).then(function (active: KeyStore) {
		return readBackupEntry(active, name).then(function (existing) {
			if (!existing) return { ok: false as const, error: 'unknown backup "' + name + '"' }
			return deleteKey(active, backupKey(name)).then(function () {
				return readBackupIndex(active).then(function (names: string[]) {
					var next = names.filter(function (one: string): boolean { return one !== name })
					return writeBackupIndex(active, next).then(function (): { ok: true; name: string } {
						return { ok: true as const, name: name }
					})
				})
			})
		})
	})
}

function validateBackupInstall(install: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!isRecord(install) || !Array.isArray((install as Record<string, unknown>)['apps'])) {
		return Promise.resolve({ ok: false as const, error: 'backup install payload needs an apps array' })
	}
	var temp = createMemoryStore()
	return import_install(install, temp).then(function (result) {
		if (!result.ok) return { ok: false as const, error: result.error }
		return { ok: true as const }
	})
}

/**
 * Restore a named backup: validate the snapshot fully (in a throwaway
 * memory store) before any delete, auto-snapshot the current install
 * first, wipe only install keys (registry, per-app def/state, pinned,
 * hidden, recent, homepage — never backups.* and never auth keys),
 * then write the snapshot contents. Unknown names, unknown format
 * tags, and corrupt entries return { ok:false } with the install
 * untouched. The result names the auto-snapshot so the caller can undo.
 */
export function restore(
	name: string,
	store?: KeyStore,
): Promise<{ ok: true; name: string; autoSnapshot: string; ids: string[] } | { ok: false; error: string }> {
	if (!isBackupName(name)) return Promise.resolve({ ok: false as const, error: 'unknown backup "' + String(name) + '"' })
	return resolveStore(store).then(function (active: KeyStore) {
		return readBackupEntry(active, name).then(function (entry) {
			if (!entry) return { ok: false as const, error: 'unknown backup "' + name + '"' }
			return validateBackupInstall(entry.install).then(function (valid) {
				if (!valid.ok) return valid
				var autoBase = 'auto-' + String(Date.now())
				return readBackupIndex(active).then(function (names: string[]) {
					var autoName = autoBase
					var counter = 1
					while (names.indexOf(autoName) !== -1) {
						counter++
						autoName = autoBase + '-' + String(counter)
					}
					return export_install(active).then(function (current: InstallExport) {
						var currentEntry: BackupEntry = {
							format: 'kody-os-backup/1',
							name: autoName,
							capturedAt: new Date().toISOString(),
							install: current,
						}
						return writeBackupEntry(active, currentEntry).then(function () {
							return listInstalledIds(active).then(function (ids: string[]) {
								var chain: Promise<void> = Promise.resolve()
								for (var i = 0; i < ids.length; i++) {
									;(function (want: string): void {
										chain = chain.then(function (): Promise<void> {
											return deleteKey(active, defKey(want)).then(function (): Promise<void> {
												return deleteKey(active, stateKey(want)).then(function (): Promise<void> {
													return deleteInstallSnapshot(active, want)
												})
											})
										})
									})(ids[i])
								}
								return chain.then(function () {
									return Promise.all([
																				writePinned(active, []),
										writeHidden(active, []),
										writeRecent(active, []),
										writeHomepage(active, []),
									])
								}).then(function () {
									return import_install(entry.install, active).then(function (imported) {
										if (!imported.ok) return imported
										return { ok: true as const, name: name, autoSnapshot: autoName, ids: imported.ids }
									})
								})
							})
						})
					})
				})
			})
		})
	})
}
