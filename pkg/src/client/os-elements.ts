/**
 * Shared `os-*` element library (shell-islands, task 2) — the
 * registry. Each `os-*` LitElement definition lives in its own file
 * under pkg/src/client/ (os-stepper.ts, os-qr.ts, ...); this file
 * imports them and defines each tag exactly once via
 * defineOsElements(), called from the shell client module.
 *
 * Contract (recorded here and in the authoring docs):
 * - Shell-owned: the shell client defines each `os-*` tag exactly once
 *   (via defineOsElements(), called from the shell client module).
 *   App bundles use the tags and SHALL NOT call customElements.define
 *   for an `os-*` tag; a second definition throws, which is the
 *   browser's guard, not a collision.
 * - Light-DOM only: every shared element overrides
 *   `createRenderRoot() { return this; }`. No shadow root anywhere.
 * - Theme: shared elements use the shell's shared theme CSS (light
 *   DOM); they carry no shadow styles and no constructable
 *   stylesheets. `adoptedStyleSheets` is never written at runtime.
 * - No-JS content: the server renders the element's current value as
 *   text content inside the tag (e.g. `<os-stepper value="5">5</os-stepper>`),
 *   so the value is visible before JavaScript runs; Lit replaces it
 *   with the interactive rendering on mount.
 * - Bridge-only state: a shared element is a dumb UI element. It
 *   displays the value it is given (as a property/attribute) and emits
 *   events on user action; it NEVER reads the bridge store or the
 *   server-injected DOM for state. The owning app reads the bridge
 *   store and passes state down; the app dispatches `act()` on the
 *   element's events. This keeps the element routing-agnostic.
 * - Versioned with the provided surface: the library ships with the
 *   vendored Lit (window.KodyLit, Lit 3.3.3). A version change to the
 *   provided surface requires a spec update and re-verification of
 *   the reference apps before it ships.
 *
 * Initial set (recorded at implementation, task 2.2): the set the
 * Counter port and the shell chrome's own app-row rendering need.
 * The Counter port needs a number stepper (value display plus
 * decrement/increment buttons), so the initial set is exactly one
 * element: `os-stepper` (pkg/src/client/os-stepper.ts). The shell
 * chrome's app-row rendering is server-rendered forms (no-JS
 * baseline), so it needs no shared element in this change. Further
 * elements are added by later changes, each in its own file; this
 * change does not enumerate the whole library up front.
 *
 * ES2019 ceiling: no ?. and no ?? in this file. The vendored Lit is
 * read from window.KodyLit (set by pkg/public/lit.js, loaded once
 * per page before the client module); when KodyLit is absent (an
 * older shell, a non-Lit page) defineOsElements() does nothing and
 * the server-rendered content stays visible.
 */

import { defineOsStepper } from './os-stepper'

type KodyLitGlobal = {
	LitElement: any
	html: any
	css: any
}

function getKodyLit(): KodyLitGlobal | null {
	try {
		var w = window as unknown as Record<string, unknown>
		var lit = w['KodyLit']
		if (lit === null || typeof lit !== 'object') return null
		var rec = lit as Record<string, unknown>
		if (typeof rec['LitElement'] !== 'function' || typeof rec['html'] !== 'function') return null
		return lit as unknown as KodyLitGlobal
	} catch (err) {
		return null
	}
}

/** Define the shared `os-*` elements once. Safe to call repeatedly;
 * a tag that is already defined is left alone. Does nothing when the
 * vendored Lit (window.KodyLit) is absent. */
export function defineOsElements(): void {
	var KodyLit = getKodyLit()
	if (KodyLit === null) return
	defineOsStepper(KodyLit)
}
