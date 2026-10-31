/**
 * Device access gate for the kody-os shell, OTP-only (v2.0.0).
 *
 * Exactly two ways in: a platform-verified Kody visitor (owner-only
 * bypass, see isKodyOwnerVisitor), or a session cookie issued only by
 * burning a one-time code. There is no third path: no derived code, no
 * stored-hash fallback, no code-hash cookie, no secret, and no
 * credential carried in a URL, link, form, or redirect other than the
 * single-use OTP submission itself (unlock-form POST, the
 * `/unlock/<otp>` path form, or the no-JavaScript `?k=` GET
 * submission). A presented OTP burns on first use; a bookmarked or
 * replayed OTP is inert.
 *
 * Cutover invalidation (v2.0.0): session and OTP registries moved to
 * versioned keys (`kody-os.auth.sessions.v2` and
 * `kody-os.auth.otp.v2`). The v1 keys (`kody-os.auth.sessions` and
 * `kody-os.auth.otp`) are never read by this code, are not migrated,
 * and are not a fallback. Every pre-cutover OTP session and
 * outstanding OTP therefore stops working at cutover, and every
 * device needs a fresh OTP or Kody login to get back in. There is
 * no secret to rotate and no rotation kill switch: sessions end by
 * per-device logout or 30-day expiry.
 *
 * Server-side only. The browser never imports this file.
 *
 * ES2019 ceiling: no optional chaining and no nullish coalescing in this file (see the canonical ceiling in docs/scribe-limitations.md).
 */

import { resolveStore } from './apps/storage.ts'
import type { KeyStore } from './apps/storage.ts'
// @ts-ignore Kody supplies this virtual module only in the hosted Worker / kody dev.
import { kody, packageContext } from 'kody:runtime'

/** Bare session-cookie name when the platform supplies no cookie prefix. */
export const SESSION_COOKIE_BARE = 'kody_os_auth'

/**
 * Cookie name the platform forwards: only names starting with the app's
 * packageContext.cookiePrefix reach the fetch handler, so the session
 * cookie must carry the prefix. Local preview has no prefix and keeps
 * the bare name.
 */
export function sessionCookieName(): string {
	try {
		var ctx = packageContext as { cookiePrefix?: unknown }
		if (ctx && typeof ctx.cookiePrefix === 'string' && ctx.cookiePrefix !== '') return ctx.cookiePrefix + 'kody_os_auth'
	} catch (err) {
	}
	return SESSION_COOKIE_BARE
}

/** Read the session cookie: prefixed name first, legacy bare name as fallback. */
function readSessionCookie(request: Request): string {
	var names = [sessionCookieName()]
	if (names[0] !== SESSION_COOKIE_BARE) names.push(SESSION_COOKIE_BARE)
	for (var i = 0; i < names.length; i++) {
		var value = readCookie(request, names[i])
		if (value !== '') return value
	}
	return ''
}

/** Unambiguous lowercase alphabet: no i/l/o/u/0/1 to misread on e-ink. */
var ALPHABET = 'abcdefghjkmnpqrstvwxyz23456789'

/**
 * OTP sessions: the device gate mints single-use 4-digit OTPs (via MCP)
 * that burn into 30-day session bearers. Only hashes rest in
 * packageStorage. Registry keys are versioned: v2 is the only key this
 * code reads or writes; v1 keys are ignored at cutover (see header).
 */
export const OTP_REGISTRY_KEY = 'kody-os.auth.otp.v2'
export const SESSION_REGISTRY_KEY = 'kody-os.auth.sessions.v2'
/** Legacy v1 keys, never read by this code; cleared for completeness by scripts/clear-auth.ts only. */
export const LEGACY_OTP_REGISTRY_KEY = 'kody-os.auth.otp'
export const LEGACY_SESSION_REGISTRY_KEY = 'kody-os.auth.sessions'
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
	/** A valid session cookie was presented. */
	viaCookie: boolean
	/** A platform-verified Kody visitor was served without the device gate. */
	viaKody: boolean
	/**
	 * Raw session token when this request freshly minted an OTP session, else ''.
	 * The caller sets the session cookie from this; later requests present
	 * it in the cookie and verify by hash lookup.
	 */
	sessionToken: string
}

/** Active auth path rendered in the shell footer. */
export type AuthPath = 'via kody' | 'via cookie' | 'locked'

/** Map one access check to its footer path. */
export function authPathFor(check: AccessCheck): AuthPath {
	if (!check.ok) return 'locked'
	if (check.viaKody) return 'via kody'
	if (check.viaCookie) return 'via cookie'
	return 'locked'
}

/** Case- and dash-insensitive form for submitted OTP codes. */
export function normalizeCode(input: string): string {
	var raw = typeof input === 'string' ? input : ''
	return raw.toLowerCase().replace(/[\s\-]+/g, '')
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
 * exactly once; it is never logged, rendered, or stored. No secret gate
 * of any kind: OTP minting needs only packageStorage.
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

/**
 * Check a submitted OTP (unlock form). A live 4-digit code burns here
 * into a fresh session. Nothing else authenticates: no derived code, no
 * stored hash, no code-hash cookie.
 */
export async function checkCode(code: string, store?: KeyStore, request?: Request): Promise<AccessCheck> {
	var target = store ? store : await resolveStore()
	var normalized = normalizeCode(code)
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
			return { ok: true, viaCookie: false, viaKody: false, sessionToken: fresh.token }
		}
		try {
			await recordUnlockFail(target)
		} catch (err) {
		}
	}
	return { ok: false, viaCookie: false, viaKody: false, sessionToken: '' }
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
 * True only for a platform-verified Kody visitor: the visitor header is
 * present AND a live `kody.metaGetCurrentUser({})` call succeeds. Anonymous
 * (the call throws) always returns false, falling through to the device
 * gate. Never fails open: any error means false.
 *
 * This is authentication only, NOT authorization: it does not check that
 * the visitor is the owner or holds any grant on the package or app. Do
 * not use it to bypass the device gate. Use isKodyOwnerVisitor() for that.
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

/** Platform-set visitor identity, parsed from the `X-Kody-Visitor` header. */
export interface VisitorIdentity {
	userId: string
	username: string
	role: string
}

/**
 * Parse the platform-set visitor header (`{ userId, username, role }`).
 * Returns null when the header is absent, malformed, or not an object.
 * The platform strips any inbound `X-Kody-*` headers, so a present value
 * was set by the platform itself and cannot be forged by the client.
 */
export function parseVisitorHeader(header: string): VisitorIdentity | null {
	if (typeof header !== 'string' || header === '') return null
	var parsed: unknown = null
	try {
		parsed = JSON.parse(header)
	} catch (err) {
		return null
	}
	if (!parsed || typeof parsed !== 'object') return null
	var rec = parsed as { userId?: unknown; user_id?: unknown; username?: unknown; role?: unknown }
	var userId = typeof rec.userId === 'string' ? rec.userId : (typeof rec.user_id === 'string' ? rec.user_id : '')
	var username = typeof rec.username === 'string' ? rec.username : ''
	var role = typeof rec.role === 'string' ? rec.role : ''
	return { userId: userId, username: username, role: role }
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value : ''
}

/**
 * True only for a platform-verified Kody visitor who is an owner of the
 * owning org: the visitor header is present with role `owner`, AND a live
 * `kody.metaGetCurrentUser({})` call succeeds and does not contradict
 * that identity. Anyone else — member, billing, non-member, anonymous, or
 * a visitor whose live identity disagrees with the header — returns false
 * and falls through to the device gate. Never fails open: any error,
 * missing field, or mismatch means false.
 *
 * Role, not username, is the owner signal: in a personal org the owner is
 * the only owner, and in a team org the org slug is not an individual's
 * username, so a username-equals-org-slug check would break team owners.
 * No username is hardcoded here, so a fork's owner check follows the
 * fork's own org instead of the original author's name.
 *
 * When `kody:runtime` is absent (local preview only), a present header
 * with role `owner` counts, mirroring isKodyVerifiedVisitor(); hosted
 * always has the module and always requires the live confirm.
 */
export async function isKodyOwnerVisitor(request: Request): Promise<boolean> {
	var header = visitorHeader(request)
	if (header === '') return false
	var visitor = parseVisitorHeader(header)
	if (visitor === null) return false
	if (visitor.role !== 'owner') return false
	try {
		if (typeof kody === 'undefined' || !kody || typeof (kody as { metaGetCurrentUser?: unknown }).metaGetCurrentUser !== 'function') return true
		var me = await (kody as { metaGetCurrentUser: (args: Record<string, never>) => Promise<unknown> }).metaGetCurrentUser({}) as { user_id?: unknown; username?: unknown; role?: unknown }
		if (!me || typeof me !== 'object') return false
		var metaUserId = asString(me.user_id)
		var metaUsername = asString(me.username)
		var metaRole = asString(me.role)
		if (metaUserId === '' && metaUsername === '') return false
		if (metaUserId !== '' && visitor.userId !== '' && metaUserId !== visitor.userId) return false
		if (metaUsername !== '' && visitor.username !== '' && metaUsername !== visitor.username) return false
		if (metaRole !== '' && metaRole !== 'owner') return false
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
 * Authenticate one request: a valid session cookie wins, then the
 * single-use OTP submission in `?k=` (the Scribe-safe GET form, and
 * the transport the `/unlock/<otp>` path form is re-attached as).
 * A burned OTP mints a fresh session on first success. Wrong codes
 * and a full failure window both read exactly like a wrong code.
 * No other credential authenticates anything.
 */
export async function authenticate(request: Request, store?: KeyStore): Promise<AccessCheck> {
	var target = store ? store : await resolveStore()
	// Session-cookie bearer first: an OTP-minted token verified by hash lookup.
	var fromCookie = readSessionCookie(request)
	if (fromCookie !== '') {
		try {
			if (await verifySession(fromCookie, target)) {
				return { ok: true, viaCookie: true, viaKody: false, sessionToken: '' }
			}
		} catch (err) {
		}
	}
	var fromQuery = normalizeCode(queryCode(request))
	if (fromQuery === '') return { ok: false, viaCookie: false, viaKody: false, sessionToken: '' }
	try {
		if (!(await unlockAllowed(target))) return { ok: false, viaCookie: false, viaKody: false, sessionToken: '' }
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
		return { ok: false, viaCookie: false, viaKody: false, sessionToken: '' }
	}
	try {
		await clearUnlockFails(target)
	} catch (err) {
	}
	var fresh = await createSession(target)
	return { ok: true, viaCookie: true, viaKody: false, sessionToken: fresh.token }
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

/**
 * Session bearer cookie holding the raw session token (HttpOnly, 30 days to
 * match the stored session expiry). Authentication is by session hash
 * lookup only; no code-hash cookie exists.
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
