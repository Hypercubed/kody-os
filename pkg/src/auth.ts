/**
 * Device access gate for the kody-os shell.
 *
 * The Kindle Scribe browser cannot use Kody's login/handoff flow, so the OS
 * carries its own lock: a random access code, stored only as a SHA-256 hash in
 * packageStorage(). A request proves the code either with `?k=<code>`
 * (bookmarkable, the Scribe-safe path) or with an HttpOnly cookie set by the
 * plain HTML unlock form (progressive enhancement).
 *
 * Rotation is a single storage write: the cookie value is the stored hash, so
 * writing a new hash invalidates every old cookie and bookmark at once.
 * The raw code is never stored, never logged, and never rendered by the shell.
 *
 * Server-side only. The browser never imports this file.
 *
 * ES2019 ceiling: no ?. and no ?? in this file (Chromium 75 crashes on them).
 */

import { resolveStore } from './apps/storage.ts'
import type { KeyStore } from './apps/storage.ts'

/** packageStorage() key holding the hex SHA-256 of the normalized code. */
export const ACCESS_HASH_KEY = 'kody-os.auth.code_hash'

/** Cookie name carrying the stored hash (never the raw code). */
export const ACCESS_COOKIE = 'kody_os_auth'

/** One year: the Scribe keeps storage only per session, desktop browsers keep this. */
export const ACCESS_COOKIE_MAX_AGE = 31536000

/** Minimum length for an owner-supplied code. Generated codes are 25 chars. */
export const ACCESS_CODE_MIN_LENGTH = 16

/** Unambiguous lowercase alphabet: no i/l/o/u/0/1 to misread on e-ink. */
var ALPHABET = 'abcdefghjkmnpqrstvwxyz23456789'
var CODE_LENGTH = 25
var CODE_GROUP = 5

export interface AccessCheck {
	ok: boolean
	/** Query matched and no valid cookie: links must keep carrying the code. */
	viaQuery: boolean
	/** A valid cookie was presented. */
	viaCookie: boolean
	/** Normalized code that matched via `?k=`, else ''. */
	code: string
	/** Stored hash, so the caller can set the cookie without re-reading storage. */
	hash: string
}

export interface AccessStatus {
	configured: boolean
}

export interface AccessCodeResult {
	ok: boolean
	/** The code in readable groups. Returned once, at set/rotate time only. */
	code?: string
	error?: string
}

/** Case- and dash-insensitive form: "ABCDE-fghjk" and "abcdefghjk" are one code. */
export function normalizeCode(input: string): string {
	var raw = typeof input === 'string' ? input : ''
	return raw.toLowerCase().replace(/[\s\-]+/g, '')
}

/** Present a normalized code in groups of five, e.g. abcde-fghjk-mnpqr. */
export function formatCode(code: string): string {
	var groups: string[] = []
	for (var i = 0; i < code.length; i += CODE_GROUP) {
		groups.push(code.slice(i, i + CODE_GROUP))
	}
	return groups.join('-')
}

/** 25 unambiguous characters from WebCrypto, rejection-sampled to avoid bias. */
export function generateCode(): string {
	var bytes = new Uint8Array(CODE_LENGTH * 2)
	var out = ''
	while (out.length < CODE_LENGTH) {
		crypto.getRandomValues(bytes)
		for (var i = 0; i < bytes.length && out.length < CODE_LENGTH; i++) {
			// 240 = 8 * 30, so every alphabet letter is equally likely.
			if (bytes[i] < 240) out += ALPHABET.charAt(bytes[i] % ALPHABET.length)
		}
	}
	return out
}

/** SHA-256 of the normalized code, lowercase hex. */
export async function hashCode(code: string): Promise<string> {
	var bytes = new TextEncoder().encode(normalizeCode(code))
	var digest = await crypto.subtle.digest('SHA-256', bytes)
	var view = new Uint8Array(digest)
	var hex = ''
	for (var i = 0; i < view.length; i++) {
		var byte = view[i].toString(16)
		hex += byte.length === 1 ? '0' + byte : byte
	}
	return hex
}

/** Length-safe, branch-free comparison of two hex hashes. */
export function hashesMatch(a: string, b: string): boolean {
	if (a.length !== b.length) return false
	var diff = 0
	for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
	return diff === 0
}

/** Stored hash, or '' when no code has been configured yet (fail closed). */
export async function readAccessHash(store?: KeyStore): Promise<string> {
	var target = store ? store : await resolveStore()
	try {
		var raw = await target.get(ACCESS_HASH_KEY)
		return typeof raw === 'string' ? raw : ''
	} catch (err) {
		return ''
	}
}

/** Whether a code exists. Never reveals the hash. */
export async function getAccessStatus(store?: KeyStore): Promise<AccessStatus> {
	var hash = await readAccessHash(store)
	return { configured: hash !== '' }
}

/**
 * Set or rotate the device access code.
 *
 * Omit `code` to generate a strong random one. The returned `code` is the only
 * copy: the store keeps just the hash, and rotating invalidates every existing
 * bookmark and cookie.
 */
export async function setAccessCode(code?: string, store?: KeyStore): Promise<AccessCodeResult> {
	var normalized = typeof code === 'string' && code !== '' ? normalizeCode(code) : generateCode()
	if (normalized.length < ACCESS_CODE_MIN_LENGTH) {
		return { ok: false, error: 'access code must be at least ' + String(ACCESS_CODE_MIN_LENGTH) + ' characters (or omit it to generate one)' }
	}
	var target = store ? store : await resolveStore()
	try {
		await target.set(ACCESS_HASH_KEY, await hashCode(normalized))
	} catch (err) {
		return { ok: false, error: 'could not write the access code hash' }
	}
	return { ok: true, code: formatCode(normalized) }
}

/** Check a submitted code (unlock form) against the stored hash. */
export async function checkCode(code: string, store?: KeyStore): Promise<AccessCheck> {
	var hash = await readAccessHash(store)
	var normalized = normalizeCode(code)
	var denied: AccessCheck = { ok: false, viaQuery: false, viaCookie: false, code: '', hash: hash }
	if (hash === '' || normalized === '') return denied
	try {
		if (!hashesMatch(await hashCode(normalized), hash)) return denied
	} catch (err) {
		return denied
	}
	return { ok: true, viaQuery: false, viaCookie: false, code: normalized, hash: hash }
}

function readCookie(request: Request, name: string): string {
	var header = ''
	try {
		header = request.headers.get('cookie') || ''
	} catch (err) {
		return ''
	}
	var parts = header.split(';')
	for (var i = 0; i < parts.length; i++) {
		var part = parts[i].replace(/^\s+|\s+$/g, '')
		var eq = part.indexOf('=')
		if (eq === -1 || part.slice(0, eq) !== name) continue
		try {
			return decodeURIComponent(part.slice(eq + 1))
		} catch (err) {
			return ''
		}
	}
	return ''
}

function queryCode(request: Request): string {
	try {
		return new URL(request.url).searchParams.get('k') || ''
	} catch (err) {
		return ''
	}
}

/**
 * Authenticate one request: a valid cookie wins (clean URLs on desktop), then
 * `?k=` (the bookmark path the Scribe depends on). An unconfigured store never
 * authorizes anything.
 */
export async function authenticate(request: Request, store?: KeyStore): Promise<AccessCheck> {
	var hash = await readAccessHash(store)
	var denied: AccessCheck = { ok: false, viaQuery: false, viaCookie: false, code: '', hash: hash }
	if (hash === '') return denied

	var fromCookie = readCookie(request, ACCESS_COOKIE)
	var cookieOk = fromCookie !== '' && hashesMatch(fromCookie.toLowerCase(), hash)

	var fromQuery = normalizeCode(queryCode(request))
	var queryOk = false
	if (fromQuery !== '') {
		try {
			queryOk = hashesMatch(await hashCode(fromQuery), hash)
		} catch (err) {
			queryOk = false
		}
	}

	if (!cookieOk && !queryOk) return denied
	return {
		ok: true,
		viaQuery: queryOk && !cookieOk,
		viaCookie: cookieOk,
		// A valid cookie already authorizes: keep the code out of later links.
		code: queryOk && !cookieOk ? fromQuery : '',
		hash: hash,
	}
}

/** True when the request reached us over HTTPS (directly or via a proxy header). */
export function isSecureRequest(request: Request): boolean {
	try {
		if (new URL(request.url).protocol === 'https:') return true
		return String(request.headers.get('x-forwarded-proto') || '').toLowerCase() === 'https'
	} catch (err) {
		return false
	}
}

/** Long-lived HttpOnly cookie holding the hash, scoped to the OS mount path. */
export function accessCookie(hash: string, appBasePath: string, secure: boolean): string {
	var path = appBasePath && appBasePath.charAt(0) === '/' ? appBasePath : '/'
	if (path.charAt(path.length - 1) !== '/') path += '/'
	var parts = [
		ACCESS_COOKIE + '=' + hash,
		'Path=' + path,
		'Max-Age=' + String(ACCESS_COOKIE_MAX_AGE),
		'HttpOnly',
		'SameSite=Lax',
	]
	if (secure) parts.push('Secure')
	return parts.join('; ')
}
