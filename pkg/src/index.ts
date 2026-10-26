/**
 * Describe the Phase 2 Kody OS package and its data-driven app layer.
 * Use when a human or agent needs to discover the package before opening the
 * minimalist browser shell; this entry point does not start or store anything.
 *
 * MCP interface (same state + same handlers as the UI):
 * list_apps, get_app_state, act, add_app, remove_app, export_app
 * (+ get_app, import_app).
 *
 * @returns Package name, shell export guidance, and the Phase 2 status note
 *
 * @example
 * import main, { add_app, act, helloCounterDefinition } from 'kody:@hypercubed/kody-os'
 *
 * const info = await main()
 * console.log(info.package) // @hypercubed/kody-os
 * await add_app(helloCounterDefinition())
 * await act('hello-counter', 'increment')
 */
export default async function main(): Promise<{
	package: string
	exports: { name: string; useWhen: string }[]
	note: string
}> {
	return {
		package: '@hypercubed/kody-os',
		exports: [
			{
				name: 'shell',
				useWhen: 'A human or agent needs the browser-first shared OS shell.',
			},
			{
				name: 'list_apps',
				useWhen: 'List installed data-driven apps with no OS republish.',
			},
			{
				name: 'get_app_state',
				useWhen: 'Read one app live state (UI refresh and MCP poll the same value).',
			},
			{
				name: 'act',
				useWhen: 'Run one declarative action; bad actions return error and change nothing.',
			},
			{
				name: 'add_app',
				useWhen: 'Install an app definition via registry write only, no republish.',
			},
			{
				name: 'remove_app',
				useWhen: 'Uninstall an app: definition, state, and all reference lists in one call.',
			},
			{
				name: 'export_app',
				useWhen: 'Export one app as complete JSON for re-import into a blank install.',
			},
			{
				name: 'set_access_code',
				useWhen: 'Set or rotate the device access code for the Scribe gate; returns the code once.',
			},
		],
		note: 'Phase 2 app layer — data-driven apps via packageStorage.',
	}
}

export {
	act,
	add_app,
	export_app,
	get_app,
	get_app_state,
	import_app,
	list_apps,
	remove_app,
	validateDefinition,
} from './apps/index.ts'
export { actFromForm } from './apps/index.ts'
export { helloCounterDefinition } from './apps/index.ts'
export { getAccessStatus as get_access_status, setAccessCode as set_access_code } from './auth.ts'
export type {
	ActionArgDef,
	ActionDef,
	ActionEffect,
	ActResult,
	AppDefinition,
	AppExport,
	AppPlacement,
	AppState,
	AppSummary,
} from './apps/index.ts'
