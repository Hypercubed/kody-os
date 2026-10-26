# Proposal

## Why

There is no way to capture the entire package state — every app, every app state, and the prefs — as a restorable backup. `export_install` / `import_install` exist in code but are not exported, named snapshots don't exist, and the envelope lives wherever an agent happens to put it. One bad overwrite or uninstall today is unrecoverable.

## What Changes

- Named install snapshots in `packageStorage()`: `backup(name)` captures the full install envelope (apps, definitions, states, pins, hidden, homepage order) under `kody-os.backups.<name>`; `list_backups()` lists them; `delete_backup(name)` removes one.
- Restore is full replace with auto-snapshot: `restore(name)` first captures the current install as an automatic pre-restore snapshot, then wipes and writes the named snapshot. Every restore is itself undoable.
- Auth is excluded: the access-code hash never enters a backup and restore never touches the lock. Recency is excluded (ephemeral, same as install export).
- Bundle apps (see `app-bundles` change) are included by construction: the envelope carries definitions plus states per app, so any installed kind restores.
- Export the surface: `backup`, `restore`, `list_backups`, `delete_backup` (plus the existing `export_install` / `import_install`) become real package exports through the root index.
- BREAKING: none. Additive keys and exports; existing envelopes import unchanged.
- Explicit non-goal: shell UI for capture/restore. Capture and restore run through MCP (agent-driven) in this change; a browser control waits on a restore-confirmation UX decision.

## Capabilities

### New Capabilities

- `backup-restore`: named install snapshots, replace-with-auto-snapshot restore semantics, auth/recency exclusions, envelope format.

### Modified Capabilities

- `app-registry`: `export_install` / `import_install` become public package exports (behavior unchanged); install envelope gains the backup format tag so future kinds restore.

## Impact

- `pkg/src/apps/registry.ts`: snapshot read/write/delete, replace-with-auto-snapshot restore, envelope format tag.
- `pkg/src/index.ts`: export the backup surface.
- `pkg/docs/adding-an-app.md` + README prompt: backup/restore contract for agents (capture before risky ops).
- No shell route changes, no new dependencies, no storage-budget change (snapshots share the 16 MiB budget — documented, with count guidance).
