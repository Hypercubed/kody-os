// Resolve hook: point `kody:runtime` at the sibling stub file.
// Relative to this file, so the whole dev/ directory moves as one unit.
export async function resolve(specifier, context, next) {
	if (specifier === 'kody:runtime') {
		return { url: new URL('./kody-runtime-stub.mjs', import.meta.url).href, shortCircuit: true }
	}
	return next(specifier, context)
}
