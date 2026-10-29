# Design: agent-launcher-reads

## Context

See proposal.md (Why). The facts established on 2026-10-28:

- `pkg/src/apps/registry.ts` implements `get_pinned`, `get_hidden`, `get_recent`, `get_homepage` (each: resolve store, read one key, return ordered ids; missing keys read as empty). `pkg/src/apps/index.ts` re-exports all four (lines 48–51) plus the setters.
- `pkg/src/index.ts` re-exports only `act`, `add_app`, `export_app`, `get_app`, `get_app_state`, `import_app`, `list_apps`, `remove_app`, `validateDefinition`, `actFromForm`, and the auth helpers. An `execute` import of `get_pinned` fails at bundle time; the same failure was observed for `migrateDefinition`, which is likewise exported from `apps/index.ts` but not from the root.
- `AppSummary` (`pkg/src/apps/types.ts`) has no launcher flags, so `list_apps` cannot answer "is this app pinned / on home?".
- The shell's own `GET /apps` handler (`pkg/src/app.ts`) already reads all four lists together via the internal imports, so the aggregate reader mirrors an existing read pattern, not a new one.

## Goals / Non-Goals

- Goals: agents can read every launcher list through the same import path as every other registry read; reads work on blank stores (empty lists) and on the hosted and preview stores alike; the new surface is discoverable via `main()`.
- Non-goals: launcher writes by agents (deferred, see Decision 2); extending `AppSummary` with launcher flags (see Decision 3); any change to list contents, ordering rules, or scrub behavior.

## Decisions

1. **Re-export the existing readers, don't write new ones.** Rationale: the implementations are already exercised by the shell UI on every Apps-page render; re-exporting them adds no new storage logic and no new failure modes. Alternative (new wrapper functions that re-read the same keys) rejected: duplicate code paths for the same keys invite drift.
2. **Reads only; setters deferred to a follow-up change.** Rationale: the reported gap is verification (reads). Agent writes to pins/homepage change what the user sees on first open and deserve their own decision about guardrails (e.g. whether an agent may unpin or hide apps, and whether writes validate ids). The follow-up change should be named when this one is applied so the gap stays visible, not silently closed. Alternative (re-export setters in the same change) rejected: it widens the trust surface without a stated need.
3. **Add `get_launcher_state()` aggregate instead of extending `AppSummary`.** Rationale: launcher membership is launcher state, not definition state; putting it on summaries duplicates one source of truth into a shape that is also used for blank-install and export contexts, and a summary snapshot can go stale within a call. One aggregate call matches how `GET /apps` already consumes the lists together. Alternative (flags on `AppSummary`) rejected for the drift reason above.
4. **No schema or storage changes.** Rationale: nothing about the stored lists changes; only their visibility to agents does. A version bump would falsely imply stored definitions changed.

## Risks / Trade-offs

- [Risk] An agent reads the lists and treats an empty list as an error → Mitigation: docs state empty lists are valid; readers return `[]`, never an error, on missing keys (already the implementation).
- [Risk] Future root-export drift recurs (a new reader lands in `apps/index.ts` but not the root) → Mitigation: the spec scenario pins the full root export set for launcher reads, and the apply checklist adds a "root re-export" check to the change template used by future registry changes. (A mechanical lint for this is out of scope.)
- [Risk] `get_launcher_state()` ordering surprises callers → Mitigation: document that each list keeps its stored order (pin order, recency order, homepage order) and that the aggregate returns them as four separate lists, not one merged order.

## Migration Plan

None — additive exports, no stored-data change. Old clients keep working; new readers work against any existing install on first publish. Rollback is a republish of the prior commit.

## Open Questions

1. Should the deferred setters follow-up also cover `move_home`/`clear_recent`, or only pin/hide/homepage membership? (Decision for the follow-up change, recorded here so it is not lost.)
2. Should `main()`'s `exports` list gain one entry per reader, or a single `launcher state` entry covering the aggregate? Recommendation: one entry per export, matching the existing one-entry-per-function pattern; confirm at apply time against the `main()` shape.
