/**
 * Feed capability: the first generic package helper for data-driven apps.
 *
 * Apps stay data-only: an app declares its feeds in its definition
 * (`capabilities.feeds`, validated in registry.ts), and this module does
 * the server-side work the browser cannot do itself — fetching an upstream
 * RSS/Atom feed that sends no CORS header, caching it in packageStorage(),
 * and serving it same-origin from the shell's fetch handler. The route
 * never takes a URL from the request: only a feed name declared for that
 * app, matched against the allowlist in its stored definition, is fetched.
 * Unknown apps, unknown feed names, and non-HTTPS upstream URLs are 404s.
 *
 * Cache policy: a fresh cache entry (age < ttl) is served without an
 * upstream fetch. On upstream failure a stale entry is served instead of
 * an error, so a dead feed degrades to yesterday's comics, not a blank
 * page. With no cache at all, upstream failure is a plain 502.
 *
 * Server-side only. ES2019 ceiling: no optional chaining, no nullish
 * coalescing (same rule as app.ts).
 */

import { defKey, readJson, resolveStore } from './apps/storage.ts'
import type { AppDefinition, FeedDecl, ProxyDecl } from './apps/types.ts'

var CACHE_PREFIX = 'kody-os.feeds.cache.'
var PROXY_CACHE_PREFIX = 'kody-os.proxy.cache.'
var DEFAULT_TTL_MS = 3600000
var DEFAULT_MAX_BYTES = 65536
var FETCH_TIMEOUT_MS = 8000
var FEED_USER_AGENT = 'kody-os-feed-proxy/1'

interface CacheEntry {
	fetchedAt: number
	status: number
	body: string
	contentType?: string
}

function isSlug(value: unknown): value is string {
	return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value)
}

function feedResponse(body: string, cache: string): Response {
	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'no-store',
			'Referrer-Policy': 'no-referrer',
			'X-Feed-Cache': cache,
		},
	})
}

function plainResponse(status: number, body: string): Response {
	return new Response(body, {
		status: status,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-store',
			'Referrer-Policy': 'no-referrer',
		},
	})
}

/** Find a declared feed, rejecting anything that is not a clean HTTPS URL. */
function findFeed(def: AppDefinition, feedName: string): FeedDecl | null {
	var caps = def.capabilities
	if (!caps || !Array.isArray(caps.feeds)) return null
	for (var i = 0; i < caps.feeds.length; i++) {
		var decl = caps.feeds[i]
		if (!decl || decl.name !== feedName) continue
		if (typeof decl.url !== 'string') return null
		try {
			var parsed = new URL(decl.url)
			if (parsed.protocol !== 'https:') return null
			if (parsed.hostname === '' || parsed.username !== '' || parsed.password !== '') return null
		} catch (err) {
			return null
		}
		return decl
	}
	return null
}

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
	var pending = fetch(url, {
		headers: {
			'User-Agent': FEED_USER_AGENT,
			Accept: 'application/rss+xml, application/atom+xml, text/xml, */*',
		},
	})
	var timeout = new Promise<Response>(function (_resolve, reject) {
		setTimeout(function () {
			reject(new Error('feed fetch timed out'))
		}, ms)
	})
	return Promise.race([pending, timeout])
}

async function readCache(store: { get: (key: string) => Promise<unknown> | unknown }, key: string): Promise<CacheEntry | null> {
	var entry = await readJson<CacheEntry>(store as never, key)
	if (!entry || typeof entry.body !== 'string' || typeof entry.fetchedAt !== 'number') return null
	return entry
}

function proxyResponse(body: string, contentType: string, cache: string): Response {
	var safe = 'text/plain; charset=utf-8'
	if (typeof contentType === 'string') {
		var base = contentType.split(';')[0].trim().toLowerCase()
		if (base.indexOf('text/') === 0 || base === 'application/json' || base === 'application/xml' || base === 'application/rss+xml' || base === 'application/atom+xml' || base.slice(-5) === '+json' || base.slice(-4) === '+xml') {
			safe = base + '; charset=utf-8'
		}
	}
	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': safe,
			'Cache-Control': 'no-store',
			'Referrer-Policy': 'no-referrer',
			'X-Proxy-Cache': cache,
		},
	})
}

/** Find a declared proxy entry, rejecting anything that is not a clean HTTPS URL. */
function findProxy(def: AppDefinition, proxyName: string): ProxyDecl | null {
	var caps = def.capabilities
	if (!caps || !Array.isArray(caps.proxy)) return null
	for (var i = 0; i < caps.proxy.length; i++) {
		var decl = caps.proxy[i]
		if (!decl || decl.name !== proxyName) continue
		if (typeof decl.url !== 'string') return null
		try {
			var parsed = new URL(decl.url)
			if (parsed.protocol !== 'https:') return null
			if (parsed.hostname === '' || parsed.username !== '' || parsed.password !== '') return null
		} catch (err) {
			return null
		}
		return decl
	}
	return null
}

/** Serve one declared proxy upstream for one app, with storage caching.
 * Same discipline as serveFeed: declared name only, never a request
 * URL; fresh cache served without a fetch; upstream failure falls
 * back to stale cache, else a plain 502. */
export async function serveProxy(appId: string, proxyName: string): Promise<Response> {
	if (!isSlug(appId) || !isSlug(proxyName)) return plainResponse(404, 'proxy not found')
	var store = await resolveStore()
	var def = await readJson<AppDefinition>(store, defKey(appId))
	if (!def) return plainResponse(404, 'proxy not found')
	var decl = findProxy(def, proxyName)
	if (!decl) return plainResponse(404, 'proxy not found')
	var ttlMs = typeof decl.ttlSeconds === 'number' && decl.ttlSeconds > 0 ? decl.ttlSeconds * 1000 : DEFAULT_TTL_MS
	var maxBytes = typeof decl.maxBytes === 'number' && decl.maxBytes > 0 ? decl.maxBytes : DEFAULT_MAX_BYTES
	var key = PROXY_CACHE_PREFIX + appId + '.' + proxyName
	var cached = await readCache(store, key)
	var now = Date.now()
	if (cached && now - cached.fetchedAt < ttlMs) return proxyResponse(cached.body, cached.contentType || '', 'hit')
	try {
		if (typeof fetch !== 'function') throw new Error('fetch unavailable')
		var res = await fetchWithTimeout(decl.url, FETCH_TIMEOUT_MS)
		if (!res.ok) throw new Error('upstream HTTP ' + String(res.status))
		var body = await res.text()
		if (body === '' || body.length > maxBytes) throw new Error('upstream body rejected')
		var upstreamType = ''
		try { upstreamType = res.headers.get('content-type') || '' } catch (err) { upstreamType = '' }
		try {
			await store.set(key, JSON.stringify({ fetchedAt: now, status: 200, body: body, contentType: upstreamType }))
		} catch (err) {
		}
		return proxyResponse(body, upstreamType, 'miss')
	} catch (err) {
		if (cached) return proxyResponse(cached.body, cached.contentType || '', 'stale')
		return plainResponse(502, 'proxy unavailable')
	}
}

/** Serve one declared feed for one app, with storage caching. */
export async function serveFeed(appId: string, feedName: string): Promise<Response> {
	if (!isSlug(appId) || !isSlug(feedName)) return plainResponse(404, 'feed not found')
	var store = await resolveStore()
	var def = await readJson<AppDefinition>(store, defKey(appId))
	if (!def) return plainResponse(404, 'feed not found')
	var decl = findFeed(def, feedName)
	if (!decl) return plainResponse(404, 'feed not found')
	var ttlMs = typeof decl.ttlSeconds === 'number' && decl.ttlSeconds > 0 ? decl.ttlSeconds * 1000 : DEFAULT_TTL_MS
	var maxBytes = typeof decl.maxBytes === 'number' && decl.maxBytes > 0 ? decl.maxBytes : DEFAULT_MAX_BYTES
	var key = CACHE_PREFIX + appId + '.' + feedName
	var cached = await readCache(store, key)
	var now = Date.now()
	if (cached && now - cached.fetchedAt < ttlMs) return feedResponse(cached.body, 'hit')
	try {
		if (typeof fetch !== 'function') throw new Error('fetch unavailable')
		var res = await fetchWithTimeout(decl.url, FETCH_TIMEOUT_MS)
		if (!res.ok) throw new Error('upstream HTTP ' + String(res.status))
		var body = await res.text()
		if (body === '' || body.length > maxBytes) throw new Error('upstream body rejected')
		try {
			await store.set(key, JSON.stringify({ fetchedAt: now, status: 200, body: body }))
		} catch (err) {
			// Cache write failure must not fail the response: serve the fresh body.
		}
		return feedResponse(body, 'miss')
	} catch (err) {
		if (cached) return feedResponse(cached.body, 'stale')
		return plainResponse(502, 'feed unavailable')
	}
}
