/**
 * Phase 2 app-layer contract: the data-driven app definition schema.
 *
 * Every future app in kody-os is DATA matching these types, stored in
 * packageStorage() — never code. Adding an app is a registry write; it needs
 * no republish of the OS package and zero additional Kody packages.
 *
 * Identity follows the ReKindle registry pattern: `id` is the stable slug
 * (routes, storage keys), `name` is the display name, `label` the tile label.
 * `description` is the help text a human or agent reads to learn what the
 * app is for without reading its code.
 *
 * Browser-safe: this module has no imports at all (no kody:/node: imports),
 * so it can be shared between the Worker shell, MCP handlers, and any client.
 *
 * Kindle ceiling is ES2019: no ?. and no ?? anywhere in this file or its
 * importers (see the canonical ceiling in docs/scribe-limitations.md).
 */

export type FieldType = 'integer' | 'string' | 'boolean' | 'array'
export type ArgType = 'integer' | 'string' | 'boolean'
/** Generic ops are `set` and `append`. `increment`, `toggle`, and `reset` are deprecated sugar kept until migration retires them. */
export type EffectOp = 'set' | 'append' | 'increment' | 'toggle' | 'reset'
/** Where an app may surface. `widget` validates but renders nothing until the widget-screen change lands. */
export type AppPlacement = 'page' | 'modal' | 'widget'

export interface StateFieldDef {
	type: FieldType
	/** Inclusive minimum (integer fields only). */
	min?: number
	/** Inclusive maximum (integer fields only). */
	max?: number
	/** Maximum string length (string fields only). */
	maxLength?: number
	/** Element type (array fields only). Scalar element types only, never nested arrays. */
	items?: 'integer' | 'string' | 'boolean'
	/** Maximum entry count (array fields only). */
	maxItems?: number
}

export interface StateSchemaDef {
	type: 'object'
	/** Initial state written at add_app / import time. */
	initial: Record<string, number | string | boolean | Array<number | string | boolean>>
	/** Every key of `initial` must be declared here; no undeclared keys allowed. */
	fields: Record<string, StateFieldDef>
}

export interface ActionArgDef {
	type: ArgType
	required?: boolean
	default?: number | string | boolean
	/** Inclusive minimum (integer args only). */
	min?: number
	/** Inclusive maximum (integer args only). */
	max?: number
	/** Maximum string length (string args only). */
	maxLength?: number
}

 /** Deprecated sugar over `set`: prefer a `set` effect with a computed value. Kept until migration retires it. */
export interface IncrementEffect {
	op: 'increment'
	field: string
	/** Fixed step, or taken from an integer arg when `byArg` is set. */
	by?: number
	byArg?: string
}

export interface SetEffect {
	op: 'set'
	field: string
	/** Fixed value, or taken from an arg when `fromArg` is set. */
	value?: number | string | boolean
	fromArg?: string
}

 /** Deprecated sugar over `set`: prefer a `set` effect with a boolean value. Kept until migration retires it. */
export interface ToggleEffect {
	op: 'toggle'
	field: string
}

/** Deprecated sugar over `set`: prefer explicit `set` effects per field. Kept until migration retires it. */
export interface ResetEffect {
	op: 'reset'
}

export interface AppendEffect {
	op: 'append'
	/** Array field this entry is appended to. Must name a declared `array` state field. */
	field: string
	/** Fixed entry value, or taken from an arg when `fromArg` is set. */
	value?: number | string | boolean
	fromArg?: string
	/** Maximum entries kept after append (oldest entries drop first). */
	cap?: number
	/** Maximum UTF-8 bytes per string entry. */
	maxEntryBytes?: number
}

export type ActionEffect = SetEffect | AppendEffect | IncrementEffect | ToggleEffect | ResetEffect

export interface ActionDef {
	description?: string
	args?: Record<string, ActionArgDef>
	/** Legacy single effect (schemaVersion 3). Exactly one of `effect` / `effects` must be present. */
	effect?: ActionEffect
	/** V2 sequence (schemaVersion 4): applied in order to a state copy, then validated + written once. */
	effects?: ActionEffect[]
}

export interface UiActionDef {
	/** Action name this button submits. Must exist in `actions`. */
	action: string
	label: string
}

export interface UiDef {
	title?: string
	/** Placement allowlist. Omitted means page-only. Modal-capable apps open as home overlays. */
	placements?: AppPlacement[]
	/** Buttons the shell renders as plain forms. Empty = read-only app page. */
	actions?: UiActionDef[]
	/** Visually hide the server-rendered state readout (stays in the DOM so bundle scripts can read initial state). Use when the bundle already displays state. */
	hideState?: boolean
}

export interface BundleManifest {
	/** Entry file. Must be 'index.html'. */
	entry: string
	/** File contents keyed by relative path. Only .html/.js/.css, no '..', no absolute paths. */
	files: Record<string, string>
}

export interface FeedDecl {
	/** Feed slug used in the route: GET /feed/<app>/<name>. Same slug rule as app ids. */
	name: string
	/** Upstream feed URL. HTTPS only; validated at install and again at serve time. */
	url: string
	/** Cache lifetime in seconds. Defaults to 3600. Range 60..86400. */
	ttlSeconds?: number
	/** Maximum upstream body kept, in characters. Defaults to 65536. Range 1024..262144. */
	maxBytes?: number
}

/** Optional server-side capabilities an app declares. Apps remain data: the
 * package implements each capability generically; a definition only names
 * what it needs, never code. */
export interface AppCapabilities {
	/** Allowlisted upstream feeds this app may read through GET /feed/<app>/<name>. */
	feeds?: FeedDecl[]
}

/** Legacy helper kept for import compatibility. Every unified app carries a bundle manifest, so this returns true when a bundle manifest is present. */
export function isBundleDefinition(def: AppDefinition): boolean {
	if (!def) return false
	var rec = def as unknown as Record<string, unknown>
	return rec['bundle'] !== undefined && rec['bundle'] !== null
}

/**
 * Definition schema version stamped into every installed app. Single source
 * of truth: bump it on any breaking definition change and ship a migration in
 * the same release (same pattern as the kody-os-app/1 to /2 importer).
 *
 *  1 = operator-only era (no bundle; `kind` discriminated the renderer)
 *  2 = bundle-kind era (bundle manifest, still `kind`-discriminated)
 *  3 = unified era (one shape: meta + bundle + stateSchema + actions, single `effect`)
 *  4 = v2 effects era (one shape with `effects[]` sequence; `ui.template` removed)
 */
export var DEFINITION_SCHEMA_VERSION = 4

export interface AppDefinition {
	/** Stable slug: ^[a-z0-9][a-z0-9-]{0,63}$ . Identity: routes, storage keys. */
	id: string
	/** Human display name. */
	name: string
	/** Tile label. Defaults to `name` when omitted. */
	label?: string
	/**
	 * Definition schema version this app was stamped with at install time.
	 * Pre-version installs backfill on read; see DEFINITION_SCHEMA_VERSION
	 * for the era history.
	 */
	schemaVersion: number
	/**
	 * Tile icon: a plain-text glyph or short mark (system fonts only, never
	 * emoji), OR an inline SVG starting with `<svg`. SVG is sanitized at
	 * validation time: allowlisted shapes (`svg, path, circle, rect, line,
	 * polyline, polygon, g, title`), geometry plus monochrome fill/stroke
	 * only, no script, external refs, style, or animation. Rendered with
	 * `currentColor` in a 1.5rem box; cap authored icons around 2 KiB.
	 */
	icon?: string
	category?: string
	/** Help text: what the app is for. Read by humans and agents. */
	description?: string
	/** Optional declared server-side capabilities (feeds, ...). Data only, never code. */
	capabilities?: AppCapabilities
	/** Bundle manifest. Required: every unified app ships its own UI files. */
	bundle: BundleManifest
	ui: UiDef
	stateSchema: StateSchemaDef
	actions: Record<string, ActionDef>
}

export type AppState = Record<string, number | string | boolean | Array<number | string | boolean>>

export interface AppSummary {
	id: string
	name: string
	label: string
	/** Definition schema version, backfilled on read for pre-version installs. */
	schemaVersion: number
	icon?: string
	category?: string
	description?: string
	/** Placement allowlist (absent in older summaries means page-only). */
	placements?: AppPlacement[]
}

export interface ActOk {
	ok: true
	state: AppState
}

export interface ActErr {
	ok: false
	error: string
}

export type ActResult = ActOk | ActErr

export interface AppExport {
	format: 'kody-os-app/2'
	exportedAt: string
	definition: AppDefinition
	/** State snapshot at export time; import restores it when present. */
	state: AppState
}
