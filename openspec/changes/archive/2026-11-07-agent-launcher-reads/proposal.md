# Proposal

## Why

On 2026-10-28, after `remove_app("hello-counter")` ran, there was no way for the acting agent to verify the removal had scrubbed the launcher reference lists (pinned, hidden, recent, homepage). The read functions exist — `get_pinned`, `get_hidden`, `get_recent`, `get_homepage` in `pkg/src/apps/registry.ts`, re-exported from `pkg/src/apps/index.ts` — but the package entry point agents import, `pkg/src/index.ts`, does not re-export them, so an `execute` import of any of them fails. `list_apps` cannot substitute: `AppSummary` carries no pinned/homepage/hidden flags. The only workaround is reading the rendered `/` and `/apps` pages and inferring list membership from HTML, which is fragile and cannot distinguish an empty list from a rendering choice. An agent that mutates the launcher (remove, and any future pin/home writes) cannot close the loop on its own work.

## What Changes

- Re-export the four existing launcher-list readers from the package root (`pkg/src/index.ts`): `get_pinned`, `get_hidden`, `get_recent`, `get_homepage`, with the same signatures and store-override behavior they already have in `pkg/src/apps/registry.ts`.
- Add one aggregate reader, `get_launcher_state()`, returning `{ pinned, hidden, recent, homepage }` (each an ordered id list) in a single call, for agents that need the whole launcher picture at once. It reads the same storage keys the shell's own `GET /apps` handler reads together today.
- List the new exports in `main()`'s `exports` array so agents discover them the same way they discover `list_apps` and `act`.
- Document the readers in `pkg/.agents/skills/adding-an-app/SKILL.md` (storage-map / verify section): what each list means, that reads are ungated like all MCP exports, and that an empty list is a valid answer (not an error).
- Explicit non-goal: no launcher *writes* in this change. The setters (`set_pinned`, `set_hidden`, `set_homepage`, `set_home`, `move_home`, `clear_recent`) stay internal to the shell UI until a follow-up change decides the agent-write surface. `remove_app`'s existing scrub behavior is unchanged.

## Capabilities

### New Capabilities

(none — the readers already exist; this change only widens their reach)

### Modified Capabilities

- `app-registry`: the package-root MCP surface gains launcher-list reads. The storage shapes, the shell UI, and `remove_app` scrub semantics are unchanged.

## Impact

- `pkg/src/index.ts` (re-exports + `main()` export list). No storage-key, registry, renderer, or schema changes. No `DEFINITION_SCHEMA_VERSION` bump: launcher lists are not definitions.
- `pkg/.agents/skills/adding-an-app/SKILL.md` (reader docs). `pkg/AGENTS.md` import example gains the new names.
- BREAKING: none. Purely additive exports; existing imports and stored data are unaffected.
- Rollback is a republish of the prior commit; no data migration in either direction.
