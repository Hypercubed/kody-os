import { LEGACY_OTP_REGISTRY_KEY, LEGACY_SESSION_REGISTRY_KEY, OTP_REGISTRY_KEY, SESSION_REGISTRY_KEY } from '../src/auth.ts'
import { deleteKey, resolveStore } from '../src/apps/storage.ts'

// Clear every OTP session and outstanding OTP from the store, following
// the mint-dev-otp.ts pattern: run with
// `kody execute --target mock --file scripts/clear-auth.ts` from pkg/.
// Both the current v2 registries and the legacy v1 registries are cleared,
// so no session or OTP survives regardless of which version minted it.
// Returns only counts cleared, never hashes, tokens, or codes. Clearing
// sessions does not touch app definitions or app state, and does not
// affect Kody-visitor login: affected devices need a fresh OTP or Kody
// login to get back in.
// NOTE: this script runs against the store its target resolves (mock
// store for --target mock). It is a local/mock maintenance tool, not a
// live cutover mechanism: the v2.0.0 cutover invalidates pre-cutover
// sessions and OTPs in code by moving to versioned registry keys, which
// old keys are never read. Ad-hoc hosted execute cannot write package
// storage (no package provenance), so do not expect this script to clear
// the live store from a chat execute call.
async function countEntries(store: { get(key: string): Promise<unknown> | unknown }, key: string): Promise<number> {
	try {
		var raw = await store.get(key)
		if (typeof raw !== 'string' || raw === '') return 0
		var parsed: unknown = JSON.parse(raw)
		if (Array.isArray(parsed)) return parsed.length
		return 0
	} catch (err) {
		return 0
	}
}

export default async function main() {
	var store = await resolveStore()
	var sessions = await countEntries(store, SESSION_REGISTRY_KEY)
	var otps = await countEntries(store, OTP_REGISTRY_KEY)
	var legacySessions = await countEntries(store, LEGACY_SESSION_REGISTRY_KEY)
	var legacyOtps = await countEntries(store, LEGACY_OTP_REGISTRY_KEY)
	await deleteKey(store, SESSION_REGISTRY_KEY)
	await deleteKey(store, OTP_REGISTRY_KEY)
	await deleteKey(store, LEGACY_SESSION_REGISTRY_KEY)
	await deleteKey(store, LEGACY_OTP_REGISTRY_KEY)
	return {
		sessionsCleared: sessions,
		otpsCleared: otps,
		legacySessionsCleared: legacySessions,
		legacyOtpsCleared: legacyOtps,
	}
}
