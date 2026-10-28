// Preview-only stub for the Kody-hosted virtual module `kody:runtime`.
// Local node has no such module; the static import in pkg/src/auth.ts needs it
// to resolve. Semantics mirror "no secret bound, anonymous visitor":
// credential() -> null (derived path empty, pre-secret hash fallback applies),
// kody.metaGetCurrentUser -> throws (anonymous), packageContext -> {}.
export async function credential() {
	return null
}
export var kody = {
	metaGetCurrentUser: async function () {
		throw new Error('anonymous')
	},
}
export var packageContext = {}
