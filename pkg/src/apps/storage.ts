/**
 * Storage adapter for the app registry.
 *
 * Server-side only: resolves Kody's hosted packageStorage() when available
 * and falls back to a shared in-memory store outside Kody (local runs, tests).
 * Pass an explicit store to isolate work — e.g. `createMemoryStore()` gives a
 * fresh blank install for export/import round-trip tests.
 */

export interface KeyStore {
	get(key: string): Promise<unknown> | unknown
	set(key: string, value: string): Promise<unknown> | unknown
	/** Optional: hosted packageStorage() and createMemoryStore() both support it. */
	delete?(key: string): Promise<unknown> | unknown
	/**
	 * Paginated prefix list, mirroring Kody's documented packageStorage()
	 * shape exactly: entries in key order, pageSize default 250, cap
	 * 1000. The hosted handle backs it directly; createMemoryStore()
	 * implements the same shape over its map.
	 */
	list(options: { prefix: string; pageSize?: number; startAfter?: string }): Promise<{
		entries: Array<{ key: string; value: unknown }>
		estimatedBytes: number
		truncated: boolean
		nextStartAfter: string | null
		pageSize: number
	}>
}

export function createMemoryStore(initial?: Record<string, string>): KeyStore {
	var seed: Record<string, string> = initial ? initial : {}
	const values = new Map<string, string>(Object.entries(seed))
	return {
		get(key: string): unknown {
			return values.get(key)
		},
		set(key: string, value: string): void {
			values.set(key, value)
		},
		delete(key: string): boolean {
			return values.delete(key)
		},
		list(options: { prefix: string; pageSize?: number; startAfter?: string }): Promise<{
			entries: Array<{ key: string; value: unknown }>
			estimatedBytes: number
			truncated: boolean
			nextStartAfter: string | null
			pageSize: number
		}> {
			var prefix = options.prefix
			var size = options.pageSize !== undefined ? options.pageSize : 250
			if (size < 1) size = 1
			if (size > 1000) size = 1000
			var keys: string[] = []
			values.forEach(function (_v: string, k: string): void {
				if (k.indexOf(prefix) === 0) keys.push(k)
			})
			keys.sort()
			var start = 0
			if (options.startAfter !== undefined) {
				start = keys.length
				for (var i = 0; i < keys.length; i++) {
					if (keys[i] > options.startAfter) { start = i; break }
				}
			}
			var pageKeys = keys.slice(start, start + size)
			var entries: Array<{ key: string; value: unknown }> = []
			var bytes = 0
			for (var j = 0; j < pageKeys.length; j++) {
				var value = values.get(pageKeys[j])
				entries.push({ key: pageKeys[j], value: value })
				bytes += pageKeys[j].length + (value !== undefined ? value.length : 0)
			}
			var truncated = start + pageKeys.length < keys.length
			return Promise.resolve({
				entries: entries,
				estimatedBytes: bytes,
				truncated: truncated,
				nextStartAfter: truncated ? pageKeys[pageKeys.length - 1] : null,
				pageSize: size,
			})
		},
	}
}

/**
 * Normalize a foreign-shaped `list()` result into the documented
 * KeyStore.list envelope (store-list-shape).
 *
 * - Bare array: filter to entries whose key is a string starting with
 *   `options.prefix`, sort by key, skip entries without a string key,
 *   and paginate client-side exactly as createMemoryStore() does
 *   (pageSize default 250, floor 1, cap 1000; startAfter selects the
 *   first key strictly greater; estimatedBytes over the returned page
 *   only; truncated / nextStartAfter from the filtered set).
 * - Documented envelope (an object with an `entries` array): returned
 *   untouched — no re-filtering, no re-sorting, no recomputed bytes.
 * - Anything else: throws an Error naming the shape, never an empty list.
 */
export function normalizeListResult(
	result: unknown,
	options: { prefix: string; pageSize?: number; startAfter?: string }
): { entries: Array<{ key: string; value: unknown }>; estimatedBytes: number; truncated: boolean; nextStartAfter: string | null; pageSize: number } {
	if (Array.isArray(result)) {
		var prefix = options.prefix
		var filtered: Array<{ key: string; value: unknown }> = []
		for (var i = 0; i < result.length; i++) {
			var entry = result[i] as { key?: unknown; value?: unknown } | null | undefined
			if (entry === null || entry === undefined || typeof entry !== 'object') continue
			if (typeof entry.key !== 'string') continue
			if (entry.key.indexOf(prefix) !== 0) continue
			filtered.push({ key: entry.key, value: entry.value })
		}
		filtered.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0 })
		var size = options.pageSize !== undefined ? options.pageSize : 250
		if (size < 1) size = 1
		if (size > 1000) size = 1000
		var start = 0
		if (options.startAfter !== undefined) {
			start = filtered.length
			for (var j = 0; j < filtered.length; j++) {
				if (filtered[j].key > options.startAfter) { start = j; break }
			}
		}
		var page = filtered.slice(start, start + size)
		var bytes = 0
		for (var k = 0; k < page.length; k++) {
			var value = page[k].value
			var valueLength = 0
			if (typeof value === 'string') valueLength = value.length
			else if (value !== undefined) {
				var stringified = JSON.stringify(value)
				valueLength = stringified === undefined ? 0 : stringified.length
			}
			bytes += page[k].key.length + valueLength
		}
		var truncated = start + page.length < filtered.length
		return { entries: page, estimatedBytes: bytes, truncated: truncated, nextStartAfter: truncated ? page[page.length - 1].key : null, pageSize: size }
	}
	if (result !== null && typeof result === 'object' && Array.isArray((result as { entries?: unknown }).entries)) {
		return result as { entries: Array<{ key: string; value: unknown }>; estimatedBytes: number; truncated: boolean; nextStartAfter: string | null; pageSize: number }
	}
	var shape: string
	if (result === null) shape = 'null'
	else if (result === undefined) shape = 'undefined'
	else if (typeof result === 'object') shape = 'object without an entries array'
	else shape = typeof result
	throw new Error('store list() returned an unrecognized shape: ' + shape)
}

/** Shared fallback used when no Kody runtime and no explicit store is given. */
const sharedMemory = createMemoryStore()

/**
 * Resolve the active store: explicit override first, then Kody hosted
 * packageStorage(), then the shared in-memory fallback.
 *
 * Hardened: the hosted handle is re-requested until it exposes working
 * get/set (a sandbox quirk has returned handles without set), up to 3 tries.
 */
export async function resolveStore(override?: KeyStore): Promise<KeyStore> {
	if (override && typeof override.get === 'function' && typeof override.set === 'function') return override
	if (override) return sharedMemory
	for (var attempt = 0; attempt < 3; attempt++) {
		try {
			// @ts-ignore Kody supplies this virtual module only in the hosted Worker.
			const runtime = await import('kody:runtime')
			if (typeof runtime.packageStorage !== 'function') return sharedMemory
			const store = runtime.packageStorage()
			if (store && typeof store.get === 'function' && typeof store.set === 'function') {
				// The hosted handle's list() is normalized into the typed
				// KeyStore.list() envelope (store-list-shape): the mock
				// handle returns a bare array of { key, value } pairs, which
				// listInstalledIds would misread as an empty install. A
				// handle without list() is NOT a reason to fall back to the
				// shared memory store here: that would read as an empty
				// install. listInstalledIds throws a clear error for a store
				// without list() instead.
				if (typeof store.list === 'function') {
					var hosted = store
					var adapted: KeyStore = {
						get: function (key: string): unknown { return hosted.get(key) },
						set: function (key: string, value: string): unknown { return hosted.set(key, value) },
						list: async function (options: { prefix: string; pageSize?: number; startAfter?: string }): Promise<{ entries: Array<{ key: string; value: unknown }>; estimatedBytes: number; truncated: boolean; nextStartAfter: string | null; pageSize: number }> {
							return normalizeListResult(await hosted.list(options), options)
						},
					}
					if (typeof hosted.delete === 'function') {
						adapted.delete = function (key: string): unknown { return hosted.delete(key) }
					}
					return adapted
				}
				return store as KeyStore
			}
		} catch (err) {
			return sharedMemory
		}
	}
	return sharedMemory
}

const PINNED_KEY = 'kody-os.apps.pinned'
const HIDDEN_KEY = 'kody-os.apps.hidden'
const RECENT_KEY = 'kody-os.apps.recent'
const HOMEPAGE_KEY = 'kody-os.apps.homepage'
const RECENT_CAP = 6
const defKey = (name: string): string => `kody-os.apps.def.${name}`
const stateKey = (name: string): string => `kody-os.apps.state.${name}`

export async function readJson<T>(store: KeyStore, key: string): Promise<T | undefined> {
	try {
		const raw = await store.get(key)
		if (typeof raw !== 'string' || raw === '') return undefined
		return JSON.parse(raw) as T
	} catch {
		return undefined
	}
}

export async function writeJson(store: KeyStore, key: string, value: unknown): Promise<void> {
	await store.set(key, JSON.stringify(value))
}

/**
 * Delete a key when the store supports it. A minimal store without delete gets
 * an empty string, which readJson treats as absent.
 */
export async function deleteKey(store: KeyStore, key: string): Promise<void> {
	if (typeof store.delete === 'function') {
		await store.delete(key)
		return
	}
	await store.set(key, '')
}

/** Read a stored id list; missing or corrupt reads as empty. */
export async function readIdList(store: KeyStore, key: string): Promise<string[]> {
	var raw = await readJson<unknown>(store, key)
	if (!Array.isArray(raw)) return []
	var out: string[] = []
	for (var i = 0; i < raw.length; i++) {
		if (typeof raw[i] === 'string' && (raw[i] as string) !== '' && out.indexOf(raw[i] as string) === -1) out.push(raw[i] as string)
	}
	return out
}

export async function writeIdList(store: KeyStore, key: string, ids: string[]): Promise<void> {
	var clean: string[] = []
	for (var i = 0; i < ids.length; i++) {
		if (typeof ids[i] === 'string' && ids[i] !== '' && clean.indexOf(ids[i]) === -1) clean.push(ids[i])
	}
	await writeJson(store, key, clean)
}

export async function readPinned(store: KeyStore): Promise<string[]> {
	return readIdList(store, PINNED_KEY)
}

export async function writePinned(store: KeyStore, ids: string[]): Promise<void> {
	return writeIdList(store, PINNED_KEY, ids)
}

export async function readHidden(store: KeyStore): Promise<string[]> {
	return readIdList(store, HIDDEN_KEY)
}

export async function writeHidden(store: KeyStore, ids: string[]): Promise<void> {
	return writeIdList(store, HIDDEN_KEY, ids)
}

export async function readRecent(store: KeyStore): Promise<string[]> {
	return readIdList(store, RECENT_KEY)
}

export async function writeRecent(store: KeyStore, ids: string[]): Promise<void> {
	return writeIdList(store, RECENT_KEY, ids.slice(0, RECENT_CAP))
}

export async function readHomepage(store: KeyStore): Promise<string[]> {
	return readIdList(store, HOMEPAGE_KEY)
}

export async function writeHomepage(store: KeyStore, ids: string[]): Promise<void> {
	return writeIdList(store, HOMEPAGE_KEY, ids)
}

export { PINNED_KEY, HIDDEN_KEY, RECENT_KEY, RECENT_CAP, defKey, stateKey }
