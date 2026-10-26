/**
 * UI path into the same `act()` every MCP call uses.
 *
 * The shell renders each ui action as a plain HTML form (form GET + PRG,
 * server-rendered first). Form submissions arrive here as flat
 * string entries; this module extracts the action name plus args and funnels
 * them into `act()`. UI and MCP therefore share one handler and one state.
 *
 * Server-side only (imports storage-backed registry). The browser never
 * imports this file — see client.ts for the browser-safe counterpart.
 *
 * ES2019 ceiling: no ?. and no ?? in this file.
 */

import { act } from './registry.ts'
import type { ActResult } from './types.ts'
import type { KeyStore } from './storage.ts'

/**
 * Handle a shell form submission for an app page.
 *
 * Expected entries: `{ action: "<action-name>", ...stringArgs }`.
 * Returns the same ActResult shape the MCP path returns.
 */
export async function actFromForm(
	id: string,
	entries: Record<string, string>,
	store?: KeyStore,
): Promise<ActResult> {
	var action: string | undefined = entries['action']
	if (typeof action !== 'string' || action === '') {
		return { ok: false, error: 'form is missing the action field' }
	}
	var rest: Record<string, unknown> = {}
	for (var key of Object.keys(entries)) {
		if (key !== 'action') rest[key] = entries[key]
	}
	return act(id, action, rest, store)
}
