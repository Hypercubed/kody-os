/**
 * Shipped catalog: every `*.bundle.json` in `pkg/catalog/` is an app
 * definition the user can install from the browser (App Store change).
 *
 * The Worker has no directory listing at runtime, so the catalog is an
 * explicit import list, alphabetical by id — not discovered by
 * convention. A file in `pkg/catalog/` without an import entry below is
 * NOT listed; the harness in `tests/catalog-harness.ts` fails when the
 * directory and this list disagree.
 *
 * Catalog definitions are publisher-shipped and trusted like any
 * `add_app` definition: installing one trusts its bundle code, which
 * runs same-origin with session authority. Every catalog definition
 * must validate through `validateDefinition` and install through
 * `add_app` in a blank store (see the harness).
 */

import calculatorBundle from '../../catalog/calculator.bundle.json' with { type: 'json' }
import calendarBundle from '../../catalog/calendar.bundle.json' with { type: 'json' }
import clockBundle from '../../catalog/clock.bundle.json' with { type: 'json' }
import counterBundle from '../../catalog/counter.bundle.json' with { type: 'json' }
import eightBallBundle from '../../catalog/eight-ball.bundle.json' with { type: 'json' }
import hoodieWeatherBundle from '../../catalog/hoodie-weather.bundle.json' with { type: 'json' }
import macPuzzleBundle from '../../catalog/mac-puzzle.bundle.json' with { type: 'json' }
import newsBundle from '../../catalog/news.bundle.json' with { type: 'json' }
import probeBundle from '../../catalog/probe.bundle.json' with { type: 'json' }
import xkcdBundle from '../../catalog/xkcd.bundle.json' with { type: 'json' }
import type { AppDefinition } from './types.ts'

/** Import list, alphabetical by id. The order is the listing order. */
var CATALOG: AppDefinition[] = [
	calculatorBundle as AppDefinition,
	calendarBundle as AppDefinition,
	clockBundle as AppDefinition,
	counterBundle as AppDefinition,
	eightBallBundle as AppDefinition,
	hoodieWeatherBundle as AppDefinition,
	macPuzzleBundle as AppDefinition,
	newsBundle as AppDefinition,
	probeBundle as AppDefinition,
	xkcdBundle as AppDefinition,
]

export interface CatalogSummary {
	id: string
	name: string
	label: string
	icon?: string
	category?: string
	description?: string
}

/** Summaries for the store listing, in import-list order. */
export function list_catalog(): CatalogSummary[] {
	return CATALOG.map(function (def: AppDefinition): CatalogSummary {
		return {
			id: def.id,
			name: def.name,
			label: def.label !== undefined ? def.label : def.name,
			icon: def.icon,
			category: def.category,
			description: def.description,
		}
	})
}

/** Full definition for install, or null for an unknown id (no write). */
export function get_catalog_definition(id: string): AppDefinition | null {
	for (var i = 0; i < CATALOG.length; i++) {
		if (CATALOG[i].id === id) return CATALOG[i]
	}
	return null
}
