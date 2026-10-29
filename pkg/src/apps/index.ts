/**
 * App-layer track: data-driven app contract for kody-os (Phase 2).
 *
 * Import from here, not from the individual modules:
 *
 * @example
 * import { add_app, list_apps, act } from './src/apps/index.ts'
 *
 * await add_app(counterBundle) // parsed pkg/examples/counter.bundle.json
 * await act('counter', 'set_count', { value: 1 })
 */
export type {
	ActionArgDef,
	ActionDef,
	ActionEffect,
	ActResult,
	AppDefinition,
	BundleManifest,
	AppExport,
	AppPlacement,
	AppState,
	AppSummary,
	FieldType,
	ArgType,
	EffectOp,
	IncrementEffect,
	ResetEffect,
	SetEffect,
	StateFieldDef,
	StateSchemaDef,
	ToggleEffect,
	UiActionDef,
	UiDef,
} from './types.ts'
export { createMemoryStore, resolveStore } from './storage.ts'
export type { AddAppOptions, ListAppsOptions, InstallExport } from './registry.ts'
export type { KeyStore } from './storage.ts'
export { isBundleDefinition } from './types.ts'
export {
	act,
	add_app,
	BUNDLE_CAP_BYTES,
	clear_recent,
	export_app,
	export_install,
	get_app,
	get_app_state,
	get_hidden,
	get_homepage,
	get_pinned,
	get_recent,
	import_app,
	import_install,
	list_apps,
	migrateAction,
	migrateDefinition,
	move_home,
	record_use,
	remove_app,
	set_hidden,
	set_hide,
	set_home,
	set_homepage,
	set_pin,
	set_pinned,
	SUPPORTED_SCHEMA_VERSIONS,
	validateDefinition,
} from './registry.ts'
export { actFromForm } from './forms.ts'
export { escapeHtml, isModalApp, renderAllSection, renderAppPanel, renderAppSection, renderBundleContent, renderDashboard, renderEditSection, renderHomeTiles, renderOverlaySection, renderPinnedSection, renderRecentSection, renderWidgetSection } from './client.ts'
