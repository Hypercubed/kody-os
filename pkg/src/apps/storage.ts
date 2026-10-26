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
	}
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
				return store as KeyStore
			}
		} catch (err) {
			return sharedMemory
		}
	}
	return sharedMemory
}

const REGISTRY_KEY = 'kody-os.apps.registry'
const PINNED_KEY = 'kody-os.apps.pinned'
const HIDDEN_KEY = 'kody-os.apps.hidden'
const RECENT_KEY = 'kody-os.apps.recent'
const HOMEPAGE_KEY = 'kody-os.apps.homepage'
const RECENT_CAP = 8
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

export async function readRegistry(store: KeyStore): Promise<string[]> {
	const names = await readJson<string[]>(store, REGISTRY_KEY)
	return Array.isArray(names) ? names.filter((n) => typeof n === 'string') : []
}

export async function writeRegistry(store: KeyStore, names: string[]): Promise<void> {
	await writeJson(store, REGISTRY_KEY, names)
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

export { REGISTRY_KEY, PINNED_KEY, HIDDEN_KEY, RECENT_KEY, RECENT_CAP, defKey, stateKey }
