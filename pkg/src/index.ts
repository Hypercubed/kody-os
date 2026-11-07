/**
 * Describe the Phase 2 Kody OS package and its data-driven app layer.
 * Use when a human or agent needs to discover the package before opening the
 * minimalist browser shell; this entry point does not start or store anything.
 *
 * MCP interface (same state + same handlers as the UI):
 * list_apps, get_app_state, act, add_app, remove_app, export_app
 * (+ get_app, import_app), catalog tools (list_catalog,
 * get_catalog_definition, install_from_catalog,
 * update_from_catalog), and pin tools (get_pinned, set_pin,
 * set_pinned), and theme tools (get_shell_theme, set_shell_theme,
 * reset_shell_theme) for the shell theme override.
 *
 * @returns Package name, shell export guidance, and the Phase 2 status note
 *
 * @example
 * import main, { add_app, act } from 'kody:@hypercubed/kody-os'
 *
 * const info = await main()
 * console.log(info.package) // @hypercubed/kody-os
 * // counter comes from pkg/catalog/counter/definition.json via add_app
 */
import { getTheme } from './app.ts'
import { fileThemeToValues, get_shell_theme as themeGet, reset_shell_theme as themeReset, set_shell_theme as themeSet } from './shell-theme.ts'
import type { ShellThemeOverride, ShellThemeValues } from './shell-theme.ts'

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
				name: 'list_catalog',
				useWhen: 'List the shipped catalog (id, label, category, description) — the apps an agent can install without authoring a definition.',
			},
			{
				name: 'get_catalog_definition',
				useWhen: 'Read one shipped catalog definition in full, or null for an unknown id.',
			},
			{
				name: 'install_from_catalog',
				useWhen: 'Install a shipped catalog app by id; idempotent, state preserved on re-install, never wipes state.',
			},
			{
				name: 'update_from_catalog',
				useWhen: 'Bring an already-installed app up to its shipped catalog definition, preserving state; refuses to install new apps.',
			},
			{
				name: 'get_pinned',
				useWhen: 'Read the pinned app ids in pin order.',
			},
			{
				name: 'set_pin',
				useWhen: 'Pin or unpin one app, keeping pin order.',
			},
			{
				name: 'set_pinned',
				useWhen: 'Overwrite the whole pinned list (order matters).',
			},
			{
				name: 'get_homepage',
				useWhen: 'Read the home-screen app ids in dashboard order.',
			},
			{
				name: 'set_home',
				useWhen: 'Add or remove one app from the home screen, keeping dashboard order.',
			},
			{
				name: 'set_homepage',
				useWhen: 'Overwrite the whole home-screen list (order matters).',
			},
			{
				name: 'move_home',
				useWhen: 'Move one home-screen app up (-1) or down (+1).',
			},
			{
				name: 'get_shell_theme',
				useWhen: 'Read the shell theme: file defaults, stored override, and effective values.',
			},
			{
				name: 'set_shell_theme',
				useWhen: 'Set shell theme fields (name, title, icon, background); an invalid field fails with no write.',
			},
			{
				name: 'reset_shell_theme',
				useWhen: 'Reset the shell theme override, one field or all, back to the file defaults.',
			},
			{
				name: 'get_hidden',
				useWhen: 'Read the hidden app ids.',
			},
			{
				name: 'get_launcher_state',
				useWhen: 'Read pinned, hidden, recent, and homepage ids together in stored order; recency is read internally and is not a separate export.',
			},
			{
				name: 'backup',
				useWhen: 'Capture the whole install (apps, states, pinned, hidden, homepage) as a named snapshot; recency and auth are never captured.',
			},
			{
				name: 'list_backups',
				useWhen: 'List named install snapshots with capture time, app count, and size.',
			},
			{
				name: 'delete_backup',
				useWhen: 'Delete one named install snapshot; unknown names fail with no write.',
			},
			{
				name: 'restore',
				useWhen: 'Replace the install with a named snapshot, after auto-snapshotting the current install so the restore can be undone.',
			},
			{
				name: 'export_install',
				useWhen: 'Export the whole install (apps, states, pinned, hidden, homepage) without backups or snapshots.',
			},
			{
				name: 'import_install',
				useWhen: 'Import a whole-install export into a blank store; recency starts empty.',
			},
			{
				name: 'set_hide',
				useWhen: 'Hide or unhide one app.',
			},
			{
				name: 'set_hidden',
				useWhen: 'Overwrite the whole hidden list.',
			},
		],
		note: 'Phase 2 app layer — data-driven apps via packageStorage.',
	}
}

/**
 * Shell theme (shell-settings Phase 2): thin MCP wrappers over
 * pkg/src/shell-theme.ts. Each resolves the file defaults first via
 * getTheme(), so callers never pass defaults themselves. No validation
 * is reimplemented here; the module owns it. Like every other MCP
 * export, these are not routed through fetch()'s device gate.
 */
export async function get_shell_theme(): Promise<{ defaults: ShellThemeValues; override: ShellThemeOverride; effective: ShellThemeValues }> {
	return themeGet(fileThemeToValues(await getTheme()))
}

export async function set_shell_theme(payload: unknown): Promise<{ ok: true; override: ShellThemeOverride; effective: ShellThemeValues } | { ok: false; error: string }> {
	return themeSet(fileThemeToValues(await getTheme()), payload)
}

export async function reset_shell_theme(field?: string): Promise<{ ok: true; effective: ShellThemeValues } | { ok: false; error: string }> {
	return themeReset(fileThemeToValues(await getTheme()), field)
}

export {
	act,
	add_app,
	backup,
	delete_backup,
	export_app,
	export_install,
	get_app,
	get_app_state,
	get_catalog_definition,
	get_hidden,
	get_homepage,
	get_launcher_state,
	get_pinned,
	import_app,
	import_install,
	install_from_catalog,
	list_apps,
	list_backups,
	list_catalog,
	move_home,
	remove_app,
	restore,
	set_hide,
	set_hidden,
	set_home,
	set_homepage,
	set_pin,
	set_pinned,
	update_from_catalog,
	validateDefinition,
} from './apps/index.ts'
export { actFromForm } from './apps/index.ts'
export { mintOtp as mint_otp } from './auth.ts'
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
	CatalogSummary,
	OpenAs,
} from './apps/index.ts'
