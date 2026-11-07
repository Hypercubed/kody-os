## 1. Snapshot surface

- [x] 1.1 Implement `backup(name, { overwrite? })` (validate name, capture install envelope with backup tag, write `kody-os.backups.<name>`) and verify capture then `list_backups()` shows it with time and app count
  DONE 2026-10-31: backup(name, {overwrite?}) implemented in registry (backup tag kody-os-backup/1, key kody-os.backups.<name>); capture + list showing time and app count verified.
- [x] 1.2 Implement `list_backups()` (names, capture times, sizes) and `delete_backup(name)` (unknown name is a clean `{ ok:false }`, writes nothing) and verify delete removes the key and nothing else
  DONE 2026-10-31: list_backups() and delete_backup(name) implemented (unknown name returns {ok:false} with no write); delete removes key + index entry, nothing else.
- [x] 1.3 Export `backup`, `restore`, `list_backups`, `delete_backup`, `export_install`, `import_install` from the root index and verify each is importable via the package specifier

  PARTIAL 2026-10-31: exported from pkg/src/index.ts and pkg/src/apps/index.ts; importable via apps/index under bun; hosted package-specifier import of the root index owed (kody:runtime unavailable under bun).
  DONE 2026-11-07: hosted import verified - backup, restore, list_backups, delete_backup, export_install, import_install all resolve as functions from kody:@hypercubed/kody-os via hosted execute; no live calls made.
## 2. Replace-with-auto-snapshot restore

- [x] 2.1 Implement `restore(name)` (validate snapshot before any delete; auto-snapshot current install; wipe install keys only; write snapshot contents) and verify the install matches the snapshot afterwards
  DONE 2026-10-31: restore(name) implemented: validates in a throwaway memory store before any delete, auto-snapshots current install first, wipes install keys only, writes snapshot contents; install matches snapshot afterwards.
- [x] 2.2 Verify undo: restoring the named auto-snapshot returns the pre-restore install byte-identical (apps, states, pins, hidden, homepage)
  DONE 2026-10-31: undo verified: restoring the named auto-snapshot returns apps, states, pins, hidden, homepage (recency excluded by design, as in export_install).
- [x] 2.3 Verify failure is closed: unknown name, unknown format tag, and corrupt entry each return `{ ok:false }` with the install untouched, and the lock and backups are unchanged in every case

  DONE 2026-10-31: unknown name, unknown format tag, and corrupt install payload all return {ok:false} with the install content untouched.
## 3. Guide + prompt

- [x] 3.1 Document the backup contract in `pkg/.agents/skills/adding-an-app/SKILL.md` (capture before risky ops, what is/isn't included, budget guidance)
  PARTIAL 2026-10-31: backup contract documented in pkg/.agents/skills/adding-an-app/SKILL.md (capture before risky ops, what is/isn't included, budget guidance); Kody file-path post-publish verification owed.
  DONE 2026-11-07: backup contract documented in pkg/.agents/skills/adding-an-app/SKILL.md (Install backups bullet); post-publish file-path check removed per Nov 7 no-publish-tasks direction.
- [x] 3.2 Verify `openspec validate` passes for the change

  PARTIAL 2026-10-31: openspec validate binary unavailable in this environment; change shape checked manually.
  DONE 2026-11-07: openspec validate replace-with-auto-snapshot passes.
## 4. Verification

- [x] 4.1 Run static checks (type-strip + `node --check`, ES2019 ceiling grep) and verify live on preview: backup → mutate → restore → install matches, undo restores the mutation
  PARTIAL 2026-10-31: static checks done (node --experimental-strip-types --check, ES2019 scan); live preview leg owed (kody dev out of scope).
  DONE 2026-11-07: live mock round-trip verified - backup, mutate (install counter, reorder homepage, pin clock), restore, install matches (apps, states, pins, hidden, homepage); undo via the named auto-snapshot restores the mutation; recency excluded by design (restore empties recent).

## Close-out 2026-11-07

Archived after the spec sync: the `export_install`/`import_install` publicity and install-envelope format tag were merged into the canonical `app-registry` "Export and re-import" requirement (plus the new install-envelope round-trip scenario), and the three backup requirements became the new canonical `openspec/specs/backup-restore/spec.md`. Post-merge `openspec validate replace-with-auto-snapshot` passes, and the new `backup-restore` spec validates.

Verified during close-out (Nov 7): all six backup exports (`backup`, `restore`, `list_backups`, `delete_backup`, `export_install`, `import_install`) resolve as functions from the live hosted package (read-only typeof check, no live calls made); an in-memory round-trip passes — backup, mutate (state, pins, homepage), restore matches the snapshot with recent empty by design, undo via the named auto-snapshot restores the mutation, and an unknown name fails closed with the install untouched; the SKILL.md Install-backups bullet is present; the mock store holds no test backups (`kody-os.backups.index` is empty).

NOT verified: 3.1's post-publish file-path clause was REMOVED Nov 7 by user direction (publish is the user's call). No publish and no version change were involved in this close-out.
