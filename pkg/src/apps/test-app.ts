/**
 * The Phase 2 validation app: a trivial Hello/counter TEST harness.
 *
 * This is NOT a product feature — it exists only to prove the app-layer
 * contract end to end (list -> open -> act -> refresh -> export).
 *
 * Kindle rules: system fonts only, no emojis — the icon is a plain glyph.
 */

import type { AppDefinition } from './types.ts'
import { DEFINITION_SCHEMA_VERSION } from './types.ts'

export function helloCounterDefinition(): AppDefinition {
	return {
		id: 'hello-counter',
		name: 'Hello Counter',
		label: 'Hello Counter',
		schemaVersion: DEFINITION_SCHEMA_VERSION,
		icon: '#',
		category: 'Tests',
		description: 'Phase 2 validation app: a shared counter proving UI and MCP act on the same state.',
		ui: {
			title: 'Hello Counter',
			actions: [
				{ action: 'increment', label: 'Increment' },
				{ action: 'reset', label: 'Reset' },
			],
		},
		stateSchema: {
			type: 'object',
			initial: { count: 0, greeting: 'hello' },
			fields: {
				count: { type: 'integer', min: 0, max: 1000000 },
				greeting: { type: 'string', maxLength: 80 },
			},
		},
		actions: {
			increment: {
				description: 'Add one to the counter.',
				effects: [{ op: 'increment', field: 'count', by: 1 }],
			},
			add: {
				description: 'Add an arbitrary step (1-100) to the counter.',
				args: { by: { type: 'integer', required: true, min: 1, max: 100 } },
				effects: [{ op: 'increment', field: 'count', byArg: 'by' }],
			},
			set_greeting: {
				description: 'Replace the greeting text.',
				args: { text: { type: 'string', required: true, maxLength: 80 } },
				effects: [{ op: 'set', field: 'greeting', fromArg: 'text' }],
			},
			reset: {
				description: 'Restore initial state.',
				effects: [{ op: 'reset' }],
			},
		},
	}
}
