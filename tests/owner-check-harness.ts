/**
 * Owner-check harness for the Kody-login bypass (auth.ts).
 * Run with bun from the repo root:
 *
 *   bun tests/owner-check-harness.ts
 *
 * Proves, against a stubbed `kody:runtime` (Bun.plugin, no live Kody):
 *   1. A verified visitor with role `owner` passes isKodyOwnerVisitor().
 *   2. A verified visitor with any other role, a non-member, or no
 *      header does NOT pass — they fall through to the device gate.
 *   3. A live meta failure, a header/meta identity mismatch, or a
 *      header/meta role contradiction fails closed (false).
 *   4. A meta result without a `role` field (the MCP shape) still passes
 *      when the header role is `owner` and the identity matches.
 *   5. isKodyVerifiedVisitor() is unchanged in meaning: it still returns
 *      true for a verified member — which is exactly why app.ts must not
 *      use it for the bypass.
 *
 * Kept outside pkg/ by direction: repo tooling, not shipped package code.
 * The stub replaces only the `kody:runtime` virtual module; the auth.ts
 * code under test is the real shipped file.
 */

var metaState: { throw: boolean; result: Record<string, unknown> } = {
	throw: false,
	result: { user_id: 'u-owner', username: 'hypercubed', role: 'owner' },
}

Bun.plugin({
	setup(build) {
		build.module('kody:runtime', function () {
			return {
				exports: {
					credential: async function () { return null },
					kody: {
						metaGetCurrentUser: async function () {
							if (metaState.throw) throw new Error('Authenticated MCP user is required')
							return metaState.result
						},
					},
					packageContext: { cookiePrefix: '' },
				},
				loader: 'object',
			}
		})
	},
})

var auth = await import('../pkg/src/auth.ts')

var failures: string[] = []
function check(name: string, ok: boolean, detail?: string): void {
	console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined && !ok ? ' — ' + detail : ''))
	if (!ok) failures.push(name)
}

function requestWithHeader(header: string | null): Request {
	var headers: Record<string, string> = {}
	if (header !== null) headers['x-kody-visitor'] = header
	return new Request('https://example.test/', { headers: headers })
}

function headerFor(role: unknown, username?: string, userId?: string): string {
	return JSON.stringify({ userId: userId !== undefined ? userId : 'u-owner', username: username !== undefined ? username : 'hypercubed', role: role })
}

var ownerHeader = headerFor('owner')
var memberHeader = headerFor('member', 'someone-else', 'u-member')

// 1. Owner passes.
metaState.throw = false
metaState.result = { user_id: 'u-owner', username: 'hypercubed', role: 'owner' }
check('owner header + owner meta passes', (await auth.isKodyOwnerVisitor(requestWithHeader(ownerHeader))) === true)

// 2. Verified member does NOT pass the owner check, but still passes the old verified check.
metaState.result = { user_id: 'u-member', username: 'someone-else', role: 'member' }
check('member header + member meta does not pass owner check', (await auth.isKodyOwnerVisitor(requestWithHeader(memberHeader))) === false)
check('member still passes isKodyVerifiedVisitor (distinction, not bypass)', (await auth.isKodyVerifiedVisitor(requestWithHeader(memberHeader))) === true)

// 3. Non-member (role null in header) does not pass.
metaState.result = { user_id: 'u-other', username: 'someone-else', role: null }
check('null-role header does not pass owner check', (await auth.isKodyOwnerVisitor(requestWithHeader(headerFor(null, 'someone-else', 'u-other')))) === false)

// 4. Anonymous (no header) does not pass.
check('no header does not pass owner check', (await auth.isKodyOwnerVisitor(requestWithHeader(null))) === false)

// 5. Meta failure fails closed, even with an owner header.
metaState.throw = true
check('owner header + meta throw fails closed', (await auth.isKodyOwnerVisitor(requestWithHeader(ownerHeader))) === false)
metaState.throw = false

// 6. Header/meta identity mismatch fails closed.
metaState.result = { user_id: 'u-owner', username: 'different-name', role: 'owner' }
check('owner header + mismatched meta username fails closed', (await auth.isKodyOwnerVisitor(requestWithHeader(ownerHeader))) === false)

// 7. Header/meta role contradiction fails closed.
metaState.result = { user_id: 'u-owner', username: 'hypercubed', role: 'member' }
check('owner header + member meta role fails closed', (await auth.isKodyOwnerVisitor(requestWithHeader(ownerHeader))) === false)

// 8. Meta without a role field still passes when header is owner and identity matches.
metaState.result = { user_id: 'u-owner', username: 'hypercubed' }
check('owner header + meta without role passes on matching identity', (await auth.isKodyOwnerVisitor(requestWithHeader(ownerHeader))) === true)

// 9. Malformed header fails closed.
metaState.result = { user_id: 'u-owner', username: 'hypercubed', role: 'owner' }
check('malformed header fails closed', (await auth.isKodyOwnerVisitor(requestWithHeader('not-json'))) === false)
check('parseVisitorHeader returns null for malformed input', auth.parseVisitorHeader('not-json') === null)
check('parseVisitorHeader parses owner header', (function () {
	var parsed = auth.parseVisitorHeader(ownerHeader)
	return parsed !== null && parsed.role === 'owner' && parsed.username === 'hypercubed'
})())

if (failures.length > 0) {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
console.log('\nALL OWNER CHECKS PASSED')
