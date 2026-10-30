/**
 * Device access gate for the kody-os shell.
 *
 * The Kindle Scribe browser cannot use Kody's login/handoff flow, so the OS
 * carries its own lock: a device access code derived inside the package as
 * HMAC-SHA256 (via the scoped `credential().sign()` client) of a fixed domain
 * string under a package-scope Kody secret. A request proves the code either
 * with `?k=<code>` (bookmarkable, the Scribe-safe path) or with an HttpOnly
 * cookie set by the plain HTML unlock form (progressive enhancement).
 *
 * The secret value never enters code, storage, logs, or chat: the handler
 * recomputes the code per request and compares, so rotation is a secret-value
 * overwrite in the Kody UI that invalidates every old cookie and bookmark at
 * once. While no secret is bound (before the owner creates it, or in local
 * preview), verification falls back to the pre-secret SHA-256 hash in
 * packageStorage(), preserving today's behavior exactly.
 * The raw code is never stored, never logged, and never rendered by the shell.
 *
 * Server-side only. The browser never imports this file.
 *
 * ES2019 ceiling: no optional chaining and no nullish coalescing in this file (see the canonical ceiling in docs/scribe-limitations.md).
 */

import { resolveStore } from './apps/storage.ts'
import type { KeyStore } from './apps/storage.ts'
// @ts-ignore Kody supplies this virtual module only in the hosted Worker / kody dev. Static imports (not dynamic) because the publish stamp gate only seals literal credential() calls bound to this import, and server files calling credential() must not use dynamic import().
import { credential, kody, packageContext } from 'kody:runtime'

/** packageStorage() key holding the hex SHA-256 of the normalized code. */
export const ACCESS_HASH_KEY = 'kody-os.auth.code_hash'

/** Cookie name carrying the stored hash (never the raw code). */
export const ACCESS_COOKIE = 'kody_os_auth'

/** One year: the Scribe keeps storage only per session, desktop browsers keep this. */
export const ACCESS_COOKIE_MAX_AGE = 31536000

/**
 * Cookie name the platform forwards: only names starting with the app's
 * packageContext.cookiePrefix reach the fetch handler, so the session
 * (and legacy) cookie must carry the prefix. Local preview has no prefix
 * and keeps the bare name.
 */
export function sessionCookieName(): string {
	try {
		var ctx = packageContext as { cookiePrefix?: unknown }
		if (ctx && typeof ctx.cookiePrefix === 'string' && ctx.cookiePrefix !== '') return ctx.cookiePrefix + 'kody_os_auth'
	} catch (err) {
	}
	return ACCESS_COOKIE
}

/** Read the session cookie: prefixed name first, legacy bare name as fallback. */
function readSessionCookie(request: Request): string {
	var names = [sessionCookieName()]
	if (names[0] !== ACCESS_COOKIE) names.push(ACCESS_COOKIE)
	for (var i = 0; i < names.length; i++) {
		var value = readCookie(request, names[i])
		if (value !== '') return value
	}
	return ''
}

/** Unambiguous lowercase alphabet: no i/l/o/u/0/1 to misread on e-ink. */
var ALPHABET = 'abcdefghjkmnpqrstvwxyz23456789'
var CODE_LENGTH = 25
var CODE_GROUP = 5

/**
 * OTP sessions (Phase D): the secret-derived path cannot serve signed-out
 * visitors, so the device gate mints single-use 4-digit OTPs (via MCP) that
 * burn into 30-day session bearers. Only hashes rest in packageStorage.
 */
export const OTP_REGISTRY_KEY = 'kody-os.auth.otp'
export const SESSION_REGISTRY_KEY = 'kody-os.auth.sessions'
export const FAIL_KEY = 'kody-os.auth.fail2'
export const OTP_TTL_MS = 600000
export const OTP_MAX_OUTSTANDING = 5
export const SESSION_TOKEN_LENGTH = 25
export const SESSION_TTL_MS = 2592000000
export const SESSION_COOKIE_MAX_AGE = 2592000
export const FAIL_MAX = 10
export const FAIL_WINDOW_MS = 600000

export interface OtpEntry {
	h: string
	exp: number
}

export interface SessionEntry {
	h: string
	exp: number
}

export interface FailState {
	n: number
	start: number
}

export interface MintOtpResult {
	ok: boolean
	/** 4-digit plaintext, returned exactly once at mint time. Never logged. */
	code: string
	/** Machine-readable reason when ok is false, else ''. */
	error: string
}

export interface AccessCheck {
	ok: boolean
	/** Query matched and no valid cookie: links must keep carrying the code. */
	viaQuery: boolean
	/** A valid cookie was presented. */
	viaCookie: boolean
	/** A platform-verified Kody visitor was served without the device key. */
	viaKody: boolean
	/** Normalized code that matched via `?k=`, else ''. */
	code: string
	/** Stored hash, so the caller can set the cookie without re-reading storage. */
	hash: string
	/**
	 * Raw session token when this request freshly minted an OTP session, else ''.
	 * The caller sets the session cookie from this (never from `hash`); later
	 * requests present it in the cookie and verify by hash lookup.
	 */
	sessionToken: string
}

/** Active auth path rendered in the shell footer. */
export type AuthPath = 'via kody' | 'via cookie' | 'via key' | 'locked'

/** Map one access check to its footer path. */
export function authPathFor(check: AccessCheck): AuthPath {
	if (!check.ok) return 'locked'
	if (check.viaKody) return 'via kody'
	if (check.viaCookie) return 'via cookie'
	return 'via key'
}

export interface AccessStatus {
	configured: boolean
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

/** Package-scope credential need holding the device-key secret (see package.json `kody.credentials`). */
export const ACCESS_KEY_NEED = 'access-key'

/**
 * Fixed domain string the device code is derived from. Public and constant:
 * knowing it grants nothing without the secret, and it must never change
 * (changing it would rotate every bookmark and cookie, like a secret edit).
 */
export const ACCESS_KEY_DOMAIN = 'kody-os/access-key/v1'

/**
 * Host label the HMAC is bound to (Kody signs only for a credential host;
 * nothing is ever fetched from it). Resolved per request as the app's own
 * hostname — packageContext hosted URL first, request URL second — so every
 * install and the MCP readout agree without hardcoding. '' when unresolvable
 * (callers fail closed). The secret must list this hostname.
 */
export async function accessKeyHost(request?: Request): Promise<string> {
	function hostnameOf(url: string): string {
		try {
			var host = new URL(url).hostname
			return host !== '' ? host : ''
		} catch (err) {
		return ''
	}
}
	try {
		var ctx = (typeof packageContext === 'object' && packageContext !== null) ? packageContext as { hostedUrl?: unknown; clientModuleUrl?: unknown } : null
		if (ctx) {
			if (typeof ctx.clientModuleUrl === 'string') {
				var fromClient = hostnameOf(ctx.clientModuleUrl)
				if (fromClient !== '') return fromClient
			}
			if (typeof ctx.hostedUrl === 'string') {
				var canonical = hostnameOf(ctx.hostedUrl)
				if (canonical !== '') return canonical
			}
		}
	} catch (err) {
	}
	if (request) {
		var fromUrl = hostnameOf(request.url)
		if (fromUrl !== '') return fromUrl
		try {
			var forwarded = request.headers.get('x-forwarded-host') || ''
			var direct = request.headers.get('host') || ''
			var first = (forwarded !== '' ? forwarded : direct).split(',')[0]
			var bare = first.replace(/^\s+|\s+$/g, '').split(':')[0]
			if (bare !== '') return bare
		} catch (err) {
		}
	}
	return ''
}

/**
 * Map an HMAC hex signature deterministically into the unambiguous alphabet,
 * grouped exactly like today's generated codes (`abcde-fghjk-...`). Pure:
 * the same signature always yields the same code, so the handler recomputes
 * verification per request without storing anything. When one digest yields
 * fewer than CODE_LENGTH letters, the pool extends via local SHA-256 chaining
 * (still deterministic, still secret-free). Returns '' on bad input.
 */
export async function encodeDerivedCode(signatureHex: string): Promise<string> {
	var clean = signatureHex.toLowerCase().replace(/[^0-9a-f]+/g, '')
	if (clean === '' || clean.length % 2 !== 0) return ''
	var pool: number[] = []
	for (var i = 0; i < clean.length; i += 2) {
		pool.push(parseInt(clean.slice(i, i + 2), 16))
	}
	var out = ''
	// 240 = 8 * 30, so every alphabet letter is equally likely.
	for (var round = 0; round < 8 && out.length < CODE_LENGTH; round++) {
		for (var j = 0; j < pool.length && out.length < CODE_LENGTH; j++) {
			if (pool[j] < 240) out += ALPHABET.charAt(pool[j] % ALPHABET.length)
		}
		if (out.length < CODE_LENGTH) {
			try {
				var digest = await crypto.subtle.digest('SHA-256', new Uint8Array(pool))
				pool = Array.from(new Uint8Array(digest))
			} catch (err) {
				return ''
			}
		}
	}
	if (out.length < CODE_LENGTH) return ''
	return formatCode(out)
}

/**
 * Task 5.1 probe: derive the device code as HMAC-SHA256 of the fixed domain
 * string under the package-scope secret, via the scoped `credential().sign()`
 * client. Returns '' when the credential is unbound or missing (no secret
 * created yet, or local preview with no signing-capable `kody:runtime`), so
 * callers fall back to the stored-hash check. Never throws; the secret value
 * never enters code or storage — only the signature is read.
 */
export async function deriveAccessCode(request?: Request): Promise<string> {
	try {
		var host = await accessKeyHost(request)
		if (host === '') return ''
		// Static import binding (see top of file): the stamp gate seals this call site.
		// NOTE: no typeof guard here — the gate treats any non-call use of the
		// credential binding as a runtime-known key and refuses to stamp.
		var client = await credential("access-key")
		if (!client || typeof client.sign !== 'function') return ''
		var signature = await client.sign({ type: 'hmac', algorithm: 'hmac-sha256', message: ACCESS_KEY_DOMAIN, encoding: 'hex', host: host })
		if (typeof signature !== 'string' || signature === '') return ''
		return await encodeDerivedCode(signature)
	} catch (err) {
		return ''
	}
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

function nowMs(): number {
	return Date.now()
}

function isLiveEntry(entry: unknown, now: number): entry is OtpEntry {
	if (!entry || typeof entry !== 'object') return false
	var rec = entry as { h?: unknown; exp?: unknown }
	return typeof rec.h === 'string' && rec.h !== '' && typeof rec.exp === 'number' && (rec.exp as number) > now
}

async function readEntryList(store: KeyStore, key: string): Promise<{ h: string; exp: number }[]> {
	var raw: unknown = undefined
	try {
		raw = await store.get(key)
	} catch (err) {
		return []
	}
	if (typeof raw !== 'string' || raw === '') return []
	var parsed: unknown = undefined
	try {
		parsed = JSON.parse(raw)
	} catch (err) {
		return []
	}
	if (!Array.isArray(parsed)) return []
	var now = nowMs()
	var out: { h: string; exp: number }[] = []
	for (var i = 0; i < parsed.length; i++) {
		if (isLiveEntry(parsed[i], now)) {
			var rec = parsed[i] as { h: string; exp: number }
			out.push({ h: rec.h, exp: rec.exp })
		}
	}
	return out
}

async function writeEntryList(store: KeyStore, key: string, list: { h: string; exp: number }[]): Promise<void> {
	await store.set(key, JSON.stringify(list))
}

/**
 * Mint a 4-digit OTP: stores only its SHA-256 hash (10-minute expiry, at most
 * OTP_MAX_OUTSTANDING live codes, pruned on write). Returns the plaintext
 * exactly once; it is never logged, rendered, or stored.
 */
export async function mintOtp(store?: KeyStore): Promise<MintOtpResult> {
	var target = store ? store : await resolveStore()
	var now = nowMs()
	var live = await readEntryList(target, OTP_REGISTRY_KEY)
	if (live.length >= OTP_MAX_OUTSTANDING) {
		await writeEntryList(target, OTP_REGISTRY_KEY, live)
		return { ok: false, code: '', error: 'too many outstanding codes' }
	}
	var digits = ''
	try {
		var rnd = new Uint8Array(2)
		crypto.getRandomValues(rnd)
		var n = (rnd[0] * 256 + rnd[1]) % 10000
		digits = ('000' + String(n)).slice(-4)
	} catch (err) {
		return { ok: false, code: '', error: 'random source unavailable' }
	}
	var h = await hashCode(digits)
	live.push({ h: h, exp: now + OTP_TTL_MS })
	await writeEntryList(target, OTP_REGISTRY_KEY, live)
	return { ok: true, code: digits, error: '' }
}

/**
 * Burn a presented OTP on first success. Prunes expired entries on write.
 * Returns true only when a live hash matched (and was removed).
 */
export async function consumeOtp(code: string, store?: KeyStore): Promise<boolean> {
	var target = store ? store : await resolveStore()
	var live = await readEntryList(target, OTP_REGISTRY_KEY)
	if (live.length === 0) {
		await writeEntryList(target, OTP_REGISTRY_KEY, live)
		return false
	}
	var want = await hashCode(code)
	var kept: { h: string; exp: number }[] = []
	var burned = false
	for (var i = 0; i < live.length; i++) {
		if (!burned && hashesMatch(live[i].h, want)) {
			burned = true
			continue
		}
		kept.push(live[i])
	}
	await writeEntryList(target, OTP_REGISTRY_KEY, kept)
	return burned
}

/**
 * Mint a session bearer: a random 25-char token whose SHA-256 hash is stored
 * with 30-day expiry. The raw token goes into the HttpOnly cookie; only the
 * hash rests in packageStorage. Sessions are pruned on read (see
 * verifySession); creation prunes too so dead entries never accumulate.
 */
export async function createSession(store?: KeyStore): Promise<{ token: string; hash: string }> {
	var target = store ? store : await resolveStore()
	var now = nowMs()
	var live = await readEntryList(target, SESSION_REGISTRY_KEY)
	var token = ''
	var guard = 0
	while (token.length < SESSION_TOKEN_LENGTH && guard < 64) {
		guard++
		var rnd = new Uint8Array(32)
		crypto.getRandomValues(rnd)
		for (var i = 0; i < rnd.length && token.length < SESSION_TOKEN_LENGTH; i++) {
			// 240 = 8 * 30, so every alphabet letter is equally likely.
			if (rnd[i] < 240) token += ALPHABET.charAt(rnd[i] % ALPHABET.length)
		}
	}
	if (token.length < SESSION_TOKEN_LENGTH) throw new Error('random source unavailable')
	var h = await hashCode(token)
	live.push({ h: h, exp: now + SESSION_TTL_MS })
	await writeEntryList(target, SESSION_REGISTRY_KEY, live)
	return { token: token, hash: h }
}

/**
 * Revoke the session presenting this request's cookie, if any. Removes the
 * token hash so a copied cookie stops working; missing or unknown tokens
 * are a silent no-op (logout is idempotent, never an error).
 */
export async function revokeSession(request: Request, store?: KeyStore): Promise<boolean> {
	var token = readSessionCookie(request)
	if (token === '') return false
	var target = store ? store : await resolveStore()
	var live = await readEntryList(target, SESSION_REGISTRY_KEY)
	var want = await hashCode(token)
	var kept = []
	for (var i = 0; i < live.length; i++) {
		if (!hashesMatch(live[i].h, want)) kept.push(live[i])
	}
	if (kept.length === live.length) return false
	await writeEntryList(target, SESSION_REGISTRY_KEY, kept)
	return true
}

/**
 * Verify a presented session token by hash lookup. Expired or unknown
 * sessions are denied (fail closed); expired entries are pruned on read.
 */
export async function verifySession(token: string, store?: KeyStore): Promise<boolean> {
	if (typeof token !== 'string' || token === '') return false
	var target = store ? store : await resolveStore()
	var live = await readEntryList(target, SESSION_REGISTRY_KEY)
	await writeEntryList(target, SESSION_REGISTRY_KEY, live)
	var want = await hashCode(token)
	for (var i = 0; i < live.length; i++) {
		if (hashesMatch(live[i].h, want)) return true
	}
	return false
}

async function readFailState(store: KeyStore): Promise<FailState> {
	var raw: unknown = undefined
	try {
		raw = await store.get(FAIL_KEY)
	} catch (err) {
		return { n: 0, start: 0 }
	}
	if (typeof raw !== 'string' || raw === '') return { n: 0, start: 0 }
	try {
		var parsed = JSON.parse(raw) as { n?: unknown; start?: unknown }
		if (!parsed || typeof parsed !== 'object') return { n: 0, start: 0 }
		var n = typeof parsed.n === 'number' && parsed.n > 0 ? Math.floor(parsed.n) : 0
		var start = typeof parsed.start === 'number' && parsed.start > 0 ? parsed.start : 0
		return { n: n, start: start }
	} catch (err) {
		return { n: 0, start: 0 }
	}
}

/**
 * True while another unlock attempt may proceed: at most FAIL_MAX failures
 * per FAIL_WINDOW_MS device-wide (one counter in packageStorage). Denied
 * attempts stay denied until the window passes.
 */
export async function unlockAllowed(store?: KeyStore): Promise<boolean> {
	var target = store ? store : await resolveStore()
	var state = await readFailState(target)
	var now = nowMs()
	if (state.start === 0 || now - state.start >= FAIL_WINDOW_MS) return true
	return state.n < FAIL_MAX
}

/** Record one failed unlock attempt; returns the window count. */
export async function recordUnlockFail(store?: KeyStore): Promise<number> {
	var target = store ? store : await resolveStore()
	var state = await readFailState(target)
	var now = nowMs()
	if (state.start === 0 || now - state.start >= FAIL_WINDOW_MS) {
		state = { n: 1, start: now }
	} else {
		state = { n: state.n + 1, start: state.start }
	}
	await target.set(FAIL_KEY, JSON.stringify(state))
	return state.n
}

/** Clear the failure counter after a successful unlock. */
export async function clearUnlockFails(store?: KeyStore): Promise<void> {
	var target = store ? store : await resolveStore()
	try {
		if (typeof target.delete === 'function') {
			await target.delete(FAIL_KEY)
			return
		}
	} catch (err) {
	}
	await target.set(FAIL_KEY, '')
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

/**
 * Whether the gate can serve anonymous device-key requests. True when the
 * package secret is bound (derived code recomputes) or a pre-secret stored
 * hash exists. False means login-only: Kody-verified visitors pass, anonymous
 * requests are denied. Never reveals the hash.
 */
export async function getAccessStatus(request?: Request, store?: KeyStore): Promise<AccessStatus> {
	var derived = await deriveAccessCode(request)
	if (derived !== '') return { configured: true }
	var hash = await readAccessHash(store)
	return { configured: hash !== '' }
}

/**
 * MCP readout of the currently derived device code. Returns the derived code
 * when a secret is bound, or a locked/not-applicable signal when no secret
 * exists. Never returns a guessable fallback value and never the secret
 * itself — only the derived code (or an empty code with `ok: false`).
 */
export interface AccessCodeResult {
	ok: boolean
	code: string
}

export async function getAccessCode(request?: Request): Promise<AccessCodeResult> {
	var derived = await deriveAccessCode(request)
	if (derived === '') return { ok: false, code: '' }
	return { ok: true, code: derived }
}

/**
 * Check a submitted code (unlock form). When the package secret is bound,
 * the recomputed derived code is authoritative; otherwise the pre-secret
 * stored hash applies (fallback preserves today's behavior exactly).
 * The returned `hash` is the cookie value: the hash of the derived code on
 * the derived path, the stored hash on the fallback path — never raw.
 */
export async function checkCode(code: string, store?: KeyStore, request?: Request): Promise<AccessCheck> {
	var target = store ? store : await resolveStore()
	var derived = await deriveAccessCode(request)
	var normalized = normalizeCode(code)
	if (derived !== '') {
		var derivedHash = await hashCode(derived)
		if (normalized !== '' && hashesMatch(normalized, normalizeCode(derived))) {
			try {
				await clearUnlockFails(target)
			} catch (err) {
			}
			return { ok: true, viaQuery: false, viaCookie: false, viaKody: false, code: normalized, hash: derivedHash, sessionToken: '' }
		}
	} else {
		var hash = await readAccessHash(target)
		if (hash !== '' && normalized !== '') {
			var storedOk = false
			try {
				storedOk = hashesMatch(await hashCode(normalized), hash)
			} catch (err) {
				storedOk = false
			}
			if (storedOk) {
				try {
					await clearUnlockFails(target)
				} catch (err) {
				}
				return { ok: true, viaQuery: false, viaCookie: false, viaKody: false, code: normalized, hash: hash, sessionToken: '' }
			}
		}
	}
	// OTP single-use path: a live 4-digit code burns here into a fresh session.
	if (normalized !== '') {
		var burned = false
		try {
			burned = await consumeOtp(normalized, target)
		} catch (err) {
			burned = false
		}
		if (burned) {
			try {
				await clearUnlockFails(target)
			} catch (err) {
			}
			var fresh = await createSession(target)
			return { ok: true, viaQuery: false, viaCookie: false, viaKody: false, code: '', hash: fresh.hash, sessionToken: fresh.token }
		}
	}
	if (normalized !== '') {
		try {
			await recordUnlockFail(target)
		} catch (err) {
		}
	}
	var fallbackHash = derived !== '' ? await hashCode(derived) : await readAccessHash(target)
	return { ok: false, viaQuery: false, viaCookie: false, viaKody: false, code: '', hash: fallbackHash, sessionToken: '' }
}

/**
 * Platform visitor header value (`X-Kody-Visitor`), or '' when absent.
 * The platform strips any inbound `X-Kody-*` headers, so a present value was
 * set by the platform itself and cannot be forged by the client. Absent for
 * anonymous visitors (including the Scribe browser, which has no Kody handoff).
 */
export function visitorHeader(request: Request): string {
	try {
		return request.headers.get('x-kody-visitor') || ''
	} catch (err) {
		return ''
	}
}

/**
 * True only for a platform-verified Kody visitor the platform grants app
 * access to: the visitor header is present AND a live
 * `kody.metaGetCurrentUser({})` call succeeds. Anonymous (the call throws)
 * always returns false, falling through to the device-key gate. Never fails
 * open: any error means false.
 *
 * Local preview has no `kody:runtime` module, so a present header alone
 * counts there (hosted always has the module and always requires the live
 * confirm). The device gate itself is unchanged.
 */
export async function isKodyVerifiedVisitor(request: Request): Promise<boolean> {
	var header = visitorHeader(request)
	if (header === '') return false
	try {
		if (typeof kody === 'undefined' || !kody || typeof (kody as { metaGetCurrentUser?: unknown }).metaGetCurrentUser !== 'function') return false
		await (kody as { metaGetCurrentUser: (args: Record<string, never>) => Promise<unknown> }).metaGetCurrentUser({})
		return true
	} catch (err) {
		return false
	}
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
 * `?k=` (the bookmark path the Scribe depends on). When the package secret is
 * bound, the recomputed derived code is authoritative and the cookie carries
 * its hash; otherwise the pre-secret stored hash applies (fallback preserves
 * today's behavior exactly). No code and no expected value never authorizes
 * anything.
 */
export async function authenticate(request: Request, store?: KeyStore): Promise<AccessCheck> {
	var target = store ? store : await resolveStore()
	// Session-cookie bearer first: an OTP-minted token verified by hash lookup.
	var fromCookie = readSessionCookie(request)
	if (fromCookie !== '') {
		try {
			if (await verifySession(fromCookie, target)) {
				return { ok: true, viaQuery: false, viaCookie: true, viaKody: false, code: '', hash: '', sessionToken: '' }
			}
		} catch (err) {
		}
	}
	// Legacy device-key paths (derived code, then stored hash): semantics
	// byte-identical to before; a legacy cookie still carries the code hash.
	var hash = await readAccessHash(target)
	var derived = await deriveAccessCode(request)
	var expected = derived !== '' ? await hashCode(derived) : hash
	var denied: AccessCheck = { ok: false, viaQuery: false, viaCookie: false, viaKody: false, code: '', hash: hash, sessionToken: '' }
	var fromQuery = normalizeCode(queryCode(request))
	if (expected !== '') {
		var cookieOk = fromCookie !== '' && hashesMatch(fromCookie.toLowerCase(), expected)
		var queryOk = false
		if (fromQuery !== '') {
			if (derived !== '') {
				queryOk = hashesMatch(fromQuery, normalizeCode(derived))
			} else {
				try {
					queryOk = hashesMatch(await hashCode(fromQuery), hash)
				} catch (err) {
					queryOk = false
				}
			}
		}
		if (cookieOk || queryOk) {
			return {
				ok: true,
				viaQuery: queryOk && !cookieOk,
				viaCookie: cookieOk,
				viaKody: false,
				// A valid cookie already authorizes: keep the code out of later links.
				code: queryOk && !cookieOk ? fromQuery : '',
				hash: expected,
				sessionToken: '',
			}
		}
	}
	// OTP single-use path for the Scribe-safe GET form (`?k=<4 digits>`):
	// burn the OTP here and mint a session on first success. Wrong codes and
	// a full failure window both read exactly like a wrong code.
	if (fromQuery === '') return denied
	try {
		if (!(await unlockAllowed(target))) return denied
	} catch (err) {
	}
	var burned = false
	try {
		burned = await consumeOtp(fromQuery, target)
	} catch (err) {
		burned = false
	}
	if (!burned) {
		try {
			await recordUnlockFail(target)
		} catch (err) {
		}
		return denied
	}
	try {
		await clearUnlockFails(target)
	} catch (err) {
	}
	var fresh = await createSession(target)
	return { ok: true, viaQuery: false, viaCookie: true, viaKody: false, code: '', hash: fresh.hash, sessionToken: fresh.token }
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
		sessionCookieName() + '=' + hash,
		'Path=' + path,
		'Max-Age=' + String(ACCESS_COOKIE_MAX_AGE),
		'HttpOnly',
		'SameSite=Lax',
	]
	if (secure) parts.push('Secure')
	return parts.join('; ')
}

/**
 * Session bearer cookie holding the raw session token (HttpOnly, 30 days to
 * match the stored session expiry). Same cookie name as the legacy hash
 * cookie; the server tries the session hash lookup first, then the legacy
 * code-hash comparison, so both cookie kinds keep working.
 */
export function sessionCookie(token: string, appBasePath: string, secure: boolean): string {
	var path = appBasePath && appBasePath.charAt(0) === '/' ? appBasePath : '/'
	if (path.charAt(path.length - 1) !== '/') path += '/'
	var parts = [
		sessionCookieName() + '=' + encodeURIComponent(token),
		'Path=' + path,
		'Max-Age=' + String(SESSION_COOKIE_MAX_AGE),
		'HttpOnly',
		'SameSite=Lax',
	]
	if (secure) parts.push('Secure')
	return parts.join('; ')
}
