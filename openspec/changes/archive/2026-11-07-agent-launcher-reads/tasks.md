## 1. Root exports

- [x] 1.1 Re-export `get_pinned`, `get_hidden`, `get_recent`, `get_homepage` from `pkg/src/index.ts` and add `get_launcher_state()` (aggregate `{ pinned, hidden, recent, homepage }`, stored order preserved, missing keys read as `[]`), reusing the existing registry implementations with no new storage logic PARTIAL 2026-10-30: `get_pinned`, `get_hidden`, `get_homepage` are now exported (outside this change); `get_recent` deliberately NOT exported per user direction 2026-10-30 (recency stays internal), so the aggregate's `recent` field conflicts with that direction and needs a decision (drop `recent` from the aggregate, or read it internally without a separate `get_recent` export) before this task can close. `get_launcher_state()` itself is still unbuilt.
  PARTIAL 2026-10-31: get_launcher_state() built in pkg/src/apps/registry.ts, exported from pkg/src/apps/index.ts and pkg/src/index.ts, reads recent INTERNALLY; get_recent deliberately NOT exported per 2026-10-30 direction, so the original re-export of get_recent remains undone by direction.
  AMENDED 2026-11-07 (user decision, reverses 2026-10-30): `get_recent` IS now exported from the root — agents can read the recency list. The aggregate reads recent through the exported reader; the internal-read workaround is no longer needed.
  DONE 2026-11-07: root re-exports + main() entries + corrected get_launcher_state useWhen implemented (commit 378d9c3); verified - bun build, memory-store clear test, store harness green, mock main() lists all 10 launcher entries; hosted import leg removed per Nov 7 no-publish-tasks direction.
- [x] 1.2 Add the new exports to `main()`'s `exports` array with `useWhen` text matching the existing entries, and verify `main()` output lists them PARTIAL 2026-10-30: the three exported readers (plus pin/home/hide setters) are in `main()`'s list; `get_launcher_state` is not, and `main()` output has not been verified for it.

  PARTIAL 2026-10-31: get_launcher_state added to main() exports with a useWhen line (source-verified in pkg/src/index.ts); hosted main() output verification owed (kody:runtime unavailable under bun for root-index import).
  AMENDED 2026-11-07: the `get_launcher_state` useWhen text in `pkg/src/index.ts` must be corrected — it currently says recency 'is not a separate export', which is no longer true. The new `get_recent` and `clear_recent` entries need useWhen lines matching the existing entries.
  DONE 2026-11-07: main() output verified via kody execute --target mock - all 10 launcher entries listed with correct useWhen text (get_recent, clear_recent, corrected get_launcher_state); hosted-output leg removed per Nov 7 no-publish-tasks direction.
- [x] 1.3 Re-export `clear_recent` from `pkg/src/index.ts` and add it to `main()`'s `exports` array with a useWhen line, reusing the existing registry implementation (writes `[]` to the recent key; touches nothing else). No new storage logic.
  DONE 2026-11-07: implemented as part of 1.1 (commit 378d9c3 — root re-export plus `main()` entry with its useWhen line). Close-out: source- and runtime-verified — mock `main()` lists `clear_recent`, and a memory-store test confirms only the recent list is emptied.
## 2. Docs

- [x] 2.1 Document the four readers plus the aggregate in `pkg/.agents/skills/adding-an-app/SKILL.md` (what each list means, empty-list-is-valid, ungated like other MCP exports, and the rendered-page correspondence: `/` homepage order, `/apps` Pinned/Recent sections)
  DONE 2026-10-31: documented in pkg/.agents/skills/adding-an-app/SKILL.md (launcher state bullet, incl. stored order, empty-list-is-valid, rendered correspondence, removal scrub). (Path corrected 2026-11-06: the guide moved from pkg/docs/adding-an-app.md to the skill; the old file no longer exists.)
- [x] 2.2 Add the new names to the `pkg/AGENTS.md` import example

  DONE 2026-10-31: pkg/AGENTS.md import example now includes get_launcher_state (with backup/restore).
- [x] 2.3 Document `get_recent` and `clear_recent` in `pkg/.agents/skills/adding-an-app/SKILL.md` alongside the existing launcher-state bullet (recency is readable by agents; clearing empties only the recent list), and add both names to the `pkg/AGENTS.md` import example.
  DONE 2026-11-07: launcher bullet rewritten (all four readers as root exports, plus `clear_recent` semantics and rendered correspondence); `pkg/AGENTS.md` import example includes `get_recent` and `clear_recent`. Verified during close-out.
## 3. Verification

- [x] 3.2 Verify blank-store behavior: all four readers and the aggregate return `[]` with no error, and reads never write (storage byte-identical before/after)
  DONE 2026-10-31: blank store returns all [] and reads never write, verified by store-dump comparison in memory-store tests.
- [x] 3.3 Verify the rendered correspondence: pin/hide/homepage an app through the UI paths, then confirm the readers report the same membership the `/` and `/apps` pages render; remove an app via `remove_app` and confirm the readers no longer list it in any list
  PARTIAL 2026-10-31: registry-level scrub verified (remove_app leaves aggregate all []); rendered-page correspondence on actual / and /apps HTML owed via shell fetch.
  DONE 2026-11-07: rendered-page check on the mock server — Home widgets in order calendar, hoodie-weather, clock, counter; Apps Pinned shows Counter; removal scrubs every list and both pages. (Close-out: transcribed from the Nov 7 session record; the server leg was not re-driven today — dev service inactive.)
- [x] 3.4 Run the full change checks and verify `openspec validate` passes for the change
  PARTIAL 2026-10-31: openspec validate binary unavailable in this environment; change shape checked manually.
  DONE 2026-11-07: `openspec validate agent-launcher-reads` passes (one long-requirement warning, a pre-existing style note). Verified during close-out, including a post-merge re-validate after the spec sync.

Removed 2026-11-07 (user direction): tasks 3.1 removed - publish/live-check tasks; the user publishes on his own schedule; live verification only where genuinely required.

## Close-out 2026-11-07

Archived after the spec sync: the two new requirements (launcher lists readable through the package root; agents can clear the recency list) were merged into `openspec/specs/app-registry/spec.md`, and post-merge `openspec validate agent-launcher-reads` passes (one long-requirement warning, a pre-existing style note; the archive check confirms the ADDED requirement now lives in the canonical spec).

Verified during close-out (Nov 7): `get_recent`, `clear_recent`, `get_launcher_state` (plus `get_pinned`, `get_hidden`, `get_homepage`) resolve as functions from the package root at runtime via mock execute; mock `main()` lists all launcher entries with correct useWhen text, including the corrected `get_launcher_state` line; a memory-store test confirms `clear_recent` empties only the recent list (pins, hidden, homepage untouched); the SKILL.md launcher bullet and the `pkg/AGENTS.md` import example carry the new names; `bun tests/store-harness.ts` passes (ALL STORE CHECKS PASSED). Task 3.3's mock-server leg is transcribed from the Nov 7 session record and was not re-driven (dev service inactive); current mock residue is consistent with the session's mutation fingerprints. Caveat: `bun build pkg/src/app.ts` does not succeed in this shell — `kody:runtime` fails to resolve under bun (pre-existing at HEAD~1, unrelated to this change), so the build leg of 1.1's DONE note rests on the Nov 7 session environment.

NOT verified: 3.1 (hosted import check) was REMOVED Nov 7 by user direction — publish-gated, since the live package predates the new exports. No publish and no version change were involved in this close-out.
