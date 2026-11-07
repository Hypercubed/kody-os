/**
 * App-layer track: data-driven app contract for kody-os (Phase 2).
 *
 * Import from here, not from the individual modules:
 *
 * @example
 * import { add_app, list_apps, act } from './src/apps/index.ts'
 *
 * await add_app(counterBundle) // parsed pkg/catalog/counter/definition.json
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
	OpenAs,
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
	ProxyDecl,
} from './types.ts'
export { createMemoryStore, resolveStore } from './storage.ts'
export type { AddAppOptions, ListAppsOptions, InstallExport } from './registry.ts'
export type { KeyStore } from './storage.ts'
export { isBundleDefinition } from './types.ts'
export {
	act,
	add_app,
	assembleBundleFiles,
	backup,
	BUNDLE_CAP_BYTES,
	canonicalizeDefinition,
	capabilityAdditions,
	clear_recent,
	delete_backup,
	deleteInstallSnapshot,
	deriveOpenAs,
	export_app,
	export_install,
	fingerprintDefinition,
	get_app,
	get_app_state,
	get_app_status,
	get_hidden,
	get_homepage,
	get_launcher_state,
	get_pinned,
	get_recent,
	get_store_rows,
	import_app,
	import_install,
	install_from_catalog,
	list_apps,
	list_backups,
	manage_install,
	manage_remove,
	manage_restore,
	manage_rows,
	manage_update,
	migrateAction,
	migrateDefinition,
	move_home,
	readInstallSnapshot,
	record_use,
	remove_app,
	restore,
	set_hidden,
	set_hide,
	set_home,
	set_homepage,
	set_pin,
	set_pinned,
	store_install_from_catalog,
	store_update_from_catalog,
	summarizeCapabilities,
	SUPPORTED_SCHEMA_VERSIONS,
	update_from_catalog,
	validateBundleReferences,
	validateCatalogDefinition,
	validateDefinition,
	writeInstallSnapshot,
} from './registry.ts'
export type { AppStoreStatus, AppStoreStatusInfo, BackupEntry, BackupSummary, CapabilitySummary, InstallSnapshot, ManageResult, StoreRow } from './registry.ts'
export { actFromForm } from './forms.ts'
export { get_catalog_definition, list_catalog } from './catalog.ts'
export type { CatalogSummary } from './catalog.ts'
export { editAppsLink, escapeHtml, isModalApp, renderAllSection, renderAppPanel, renderAppSection, renderBundleContent, renderDashboard, renderEditSection, renderEmptyHelp, renderHomeTiles, renderOverlaySection, renderPinnedSection, renderRecentSection, renderWidgetSection } from './client.ts'
