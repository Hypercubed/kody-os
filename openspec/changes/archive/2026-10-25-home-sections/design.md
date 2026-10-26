# Design: home-sections

## Context

See proposal.md (Why). Current state: `src/app.ts` renders one tile grid from `list_apps()`; registry holds only the id list plus per-app def/state keys (see `src/apps/registry.ts`, `storage.ts`). No pin/hide/recency code exists anywhere. Theme chrome (striped titlebar, tiles, edit affordances) is the UI agent's track; this change adds structure, not style.

## Goals / Non-Goals

- Goals: three home sections + edit mode; recency from both UI and MCP; prefs (pin/hide) portable via export; zero-JS baseline kept (plain forms + PRG).
- Non-goals: reordering pins via drag (arrival order is fine); per-app custom layouts; changing the act/validation path; touching the theme system beyond new class hooks.

## Decisions

1. **Three new keys, same namespace** (`kody-os.apps.pinned`, `.hidden`, `.recent`) instead of fields on definitions.
   *Why*: definitions stay portable and import-safe; prefs survive definition re-imports; no schema migration. Alternative (a `hidden`/`pinned` field on `AppDefinition`) was rejected — it would rewrite user data on every export/import round-trip.
2. **Recency writes in two places**: `act()` success path in `registry.ts` (covers UI form POSTs and MCP equally, since forms funnel into `act()`) plus the app page GET handler in `app.ts` (covers views without actions).
   *Why*: one funnel for actions already exists; views need the extra hook because rendering is read-only.
3. **Hidden filters UI lists only**; MCP `list_apps` gains an opts flag (`includeHidden`) defaulting to current behavior, and the shell passes `false`.
   *Why*: keeps MCP as the management plane (agents can still see/act hidden apps) while the human UI stays curated.
4. **Pinned wins over hidden in Pinned only** (per user decision in explore).
   *Why*: explicit user ask; pin is Intent ("always here"), hide is declutter ("not in the big list").
5. **Export carries pinned + hidden, not recency.**
   *Why*: prefs are user data worth porting; recency is ephemeral per-install behavior. Matches the explored decision.

## Risks / Trade-offs

- [Risk] Extra storage reads per home render (3 small lists) → Mitigation: keys are tiny JSON arrays; single-digit reads, well within budget.
- [Risk] Recency write on every page view adds a write per GET → Mitigation: writes are small single-key sets; acceptable at human browsing rates.
- [Risk] `includeHidden` default could confuse future MCP callers → Mitigation: document the flag in AGENTS.md smoke section when implemented.

## Migration Plan

No migration: missing keys read as empty lists, so old installs gain the feature silently. Rollback is a republish of the prior commit. Publish follows the normal repo-session lane with checks green.

## Open Questions

None blocking. Cap size for Recent (propose 8) is set at implementation time and recorded in tasks.
