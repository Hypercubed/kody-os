## 1. Root exports

- [ ] 1.1 Re-export `get_pinned`, `get_hidden`, `get_recent`, `get_homepage` from `pkg/src/index.ts` and add `get_launcher_state()` (aggregate `{ pinned, hidden, recent, homepage }`, stored order preserved, missing keys read as `[]`), reusing the existing registry implementations with no new storage logic PARTIAL 2026-10-30: `get_pinned`, `get_hidden`, `get_homepage` are now exported (outside this change); `get_recent` deliberately NOT exported per user direction 2026-10-30 (recency stays internal), so the aggregate's `recent` field conflicts with that direction and needs a decision (drop `recent` from the aggregate, or read it internally without a separate `get_recent` export) before this task can close. `get_launcher_state()` itself is still unbuilt.
  PARTIAL 2026-10-31: get_launcher_state() built in pkg/src/apps/registry.ts, exported from pkg/src/apps/index.ts and pkg/src/index.ts, reads recent INTERNALLY; get_recent deliberately NOT exported per 2026-10-30 direction, so the original re-export of get_recent remains undone by direction.
- [ ] 1.2 Add the new exports to `main()`'s `exports` array with `useWhen` text matching the existing entries, and verify `main()` output lists them PARTIAL 2026-10-30: the three exported readers (plus pin/home/hide setters) are in `main()`'s list; `get_launcher_state` is not, and `main()` output has not been verified for it.

  PARTIAL 2026-10-31: get_launcher_state added to main() exports with a useWhen line (source-verified in pkg/src/index.ts); hosted main() output verification owed (kody:runtime unavailable under bun for root-index import).
## 2. Docs

- [x] 2.1 Document the four readers plus the aggregate in `pkg/.agents/skills/adding-an-app/SKILL.md` (what each list means, empty-list-is-valid, ungated like other MCP exports, and the rendered-page correspondence: `/` homepage order, `/apps` Pinned/Recent sections)
  DONE 2026-10-31: documented in pkg/.agents/skills/adding-an-app/SKILL.md (launcher state bullet, incl. stored order, empty-list-is-valid, rendered correspondence, removal scrub). (Path corrected 2026-11-06: the guide moved from pkg/docs/adding-an-app.md to the skill; the old file no longer exists.)
- [x] 2.2 Add the new names to the `pkg/AGENTS.md` import example

  DONE 2026-10-31: pkg/AGENTS.md import example now includes get_launcher_state (with backup/restore).
## 3. Verification

- [ ] 3.1 Via hosted `execute`, import each new name from `kody:@hypercubed/kody-os` (the exact imports that failed on 2026-10-28) and confirm they resolve; confirm `get_launcher_state()` matches the four individual readers on a store with known pin/home/hidden/recent contents
  PARTIAL 2026-10-31: memory-store verification done (aggregate matches individual readers, importable via pkg/src/apps/index.ts under bun); hosted execute leg owed.
- [x] 3.2 Verify blank-store behavior: all four readers and the aggregate return `[]` with no error, and reads never write (storage byte-identical before/after)
  DONE 2026-10-31: blank store returns all [] and reads never write, verified by store-dump comparison in memory-store tests.
- [ ] 3.3 Verify the rendered correspondence: pin/hide/homepage an app through the UI paths, then confirm the readers report the same membership the `/` and `/apps` pages render; remove an app via `remove_app` and confirm the readers no longer list it in any list
  PARTIAL 2026-10-31: registry-level scrub verified (remove_app leaves aggregate all []); rendered-page correspondence on actual / and /apps HTML owed via shell fetch.
- [ ] 3.4 Run the full change checks and verify `openspec validate` passes for the change
  PARTIAL 2026-10-31: openspec validate binary unavailable in this environment; change shape checked manually.
