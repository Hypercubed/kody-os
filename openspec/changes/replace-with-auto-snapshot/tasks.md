## 1. Snapshot surface

- [ ] 1.1 Implement `backup(name, { overwrite? })` (validate name, capture install envelope with backup tag, write `kody-os.backups.<name>`) and verify capture then `list_backups()` shows it with time and app count
- [ ] 1.2 Implement `list_backups()` (names, capture times, sizes) and `delete_backup(name)` (unknown name is a clean `{ ok:false }`, writes nothing) and verify delete removes the key and nothing else
- [ ] 1.3 Export `backup`, `restore`, `list_backups`, `delete_backup`, `export_install`, `import_install` from the root index and verify each is importable via the package specifier

## 2. Replace-with-auto-snapshot restore

- [ ] 2.1 Implement `restore(name)` (validate snapshot before any delete; auto-snapshot current install; wipe install keys only; write snapshot contents) and verify the install matches the snapshot afterwards
- [ ] 2.2 Verify undo: restoring the named auto-snapshot returns the pre-restore install byte-identical (apps, states, pins, hidden, homepage)
- [ ] 2.3 Verify failure is closed: unknown name, unknown format tag, and corrupt entry each return `{ ok:false }` with the install untouched, and the lock and backups are unchanged in every case

## 3. Guide + prompt

- [ ] 3.1 Document the backup contract in `pkg/docs/adding-an-app.md` (capture before risky ops, what is/isn't included, budget guidance) and verify the Kody file path opens post-publish
- [ ] 3.2 Verify `openspec validate` passes for the change

## 4. Verification

- [ ] 4.1 Run static checks (type-strip + `node --check`, ES2019 ceiling grep) and verify live on preview: backup → mutate → restore → install matches, undo restores the mutation
