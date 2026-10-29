## 1. Root exports

- [ ] 1.1 Re-export `get_pinned`, `get_hidden`, `get_recent`, `get_homepage` from `pkg/src/index.ts` and add `get_launcher_state()` (aggregate `{ pinned, hidden, recent, homepage }`, stored order preserved, missing keys read as `[]`), reusing the existing registry implementations with no new storage logic
- [ ] 1.2 Add the new exports to `main()`'s `exports` array with `useWhen` text matching the existing entries, and verify `main()` output lists them

## 2. Docs

- [ ] 2.1 Document the four readers plus the aggregate in `pkg/docs/adding-an-app.md` (what each list means, empty-list-is-valid, ungated like other MCP exports, and the rendered-page correspondence: `/` homepage order, `/apps` Pinned/Recent sections)
- [ ] 2.2 Add the new names to the `pkg/AGENTS.md` import example

## 3. Verification

- [ ] 3.1 Via hosted `execute`, import each new name from `kody:@hypercubed/kody-os` (the exact imports that failed on 2026-10-28) and confirm they resolve; confirm `get_launcher_state()` matches the four individual readers on a store with known pin/home/hidden/recent contents
- [ ] 3.2 Verify blank-store behavior: all four readers and the aggregate return `[]` with no error, and reads never write (storage byte-identical before/after)
- [ ] 3.3 Verify the rendered correspondence: pin/hide/homepage an app through the UI paths, then confirm the readers report the same membership the `/` and `/apps` pages render; remove an app via `remove_app` and confirm the readers no longer list it in any list
- [ ] 3.4 Run the full change checks and verify `openspec validate` passes for the change
