/**
 * Device access gate for the kody-os shell: Kody login only (no OTP).
 *
 * Exactly one way in: a platform-verified Kody visitor (owner-only
 * bypass, see isKodyOwnerVisitor). There is no session cookie, no
 * one-time code, no unlock form, and no credential carried in a URL,
 * link, form, redirect, or header. A request without verified visitor
 * identity is denied (locked), exactly like an unauthenticated request.
 * The gate never fails open.
 *
 * Retired credentials are denied, not compared: the OTP registries
 * (`kody-os.auth.otp.v2`, legacy `kody-os.auth.otp`), the session
 * registries (`kody-os.auth.sessions.v2`, legacy `kody-os.auth.sessions`),
 * and the unlock rate-limit counter (`kody-os.auth.fail2`) are never read
 * by this code. Every pre-removal OTP session and outstanding OTP
 * therefore stops working at the publish carrying this change, and only
 * Kody login restores access. There is no secret to rotate and no
 * rotation kill switch: Kody login is verified per request, so there are
 * no shell sessions to revoke or expire.
 *
 * The local mock/dev target skips the gate entirely (see isMockTarget):
 * local dev runs on the developer's own machine and needs no unlock
 * step. The hosted gate still requires verified visitor identity.
 *
 * Server-side only. The browser never imports this file.
 *
 * ES2019 ceiling: no optional chaining and no nullish coalescing in this file (see the canonical ceiling in docs/scribe-limitations.md).
 */

import { kody } from 'kody:runtime'

/** Minimal shape of the package context the gate reads for mock detection. */
export interface MockTargetContext {
	packageId?: unknown
	sourceId?: unknown
}

/**
 * True when the runtime is the local mock/dev target, where the device
 * gate is skipped entirely. The mock target identifies itself with a
 * `local:`-prefixed package/source id (for example `local:kody-os`);
 * the hosted package always carries its real package id. Missing or
 * unrecognized context is never mock: the gate then requires verified
 * visitor identity (fail closed).
 */
export function isMockTarget(context: MockTargetContext | null | undefined): boolean {
	if (!context || typeof context !== 'object') return false
	var packageId = typeof context.packageId === 'string' ? context.packageId : ''
	var sourceId = typeof context.sourceId === 'string' ? context.sourceId : ''
	return packageId.indexOf('local:') === 0 || sourceId.indexOf('local:') === 0
}

export interface AccessCheck {
	ok: boolean
	/** A platform-verified Kody visitor was served without the device gate. */
	viaKody: boolean
}

/** Active auth path rendered in the shell footer. */
export type AuthPath = 'via kody' | 'locked'

/** Map one access check to its footer path. */
export function authPathFor(check: AccessCheck): AuthPath {
	if (!check.ok) return 'locked'
	if (check.viaKody) return 'via kody'
	return 'locked'
}

/**
 * Platform visitor header value (`X-Kody-Visitor`), or '' when absent.
 * The platform strips any inbound `X-Kody-*` headers, so a present value was
 * set by the platform itself and cannot be forged by the client. Absent for
 * anonymous visitors (including browsers with no Kody handoff).
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
 * (the call throws) always returns false. Never fails open: any error
 * means false.
 *
 * This is authentication only, NOT authorization: it does not check that
 * the visitor is the owner or holds any grant on the package or app.
 * Do not use it to bypass the device gate. Use isKodyOwnerVisitor() for that.
 *
 * Local preview has no `kody:runtime` module, so a present header alone
 * counts there (hosted always has the module and always requires the live
 * confirm).
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
 * and is denied (locked). Never fails open: any error, missing field, or
 * mismatch means false.
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
