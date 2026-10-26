# Design: install backup and replace-with-auto-snapshot restore

## Context

See proposal.md (Why). The registry resolves stores via `resolveStore()` and already implements `export_install()` (apps + definitions + states + pins/hidden/homepage, recency excluded) and `import_install()` into blank stores — both unexported from the root index today. Storage keys: `kody-os.apps.registry`, `kody-os.apps.def.<id>`, `kody-os.apps.state.<id>`, `kody-os.apps.pinned`, `kody-os.apps.hidden`, `kody-os.apps.recent`, `kody-os.apps.homepage`, plus `kody-os.auth.code_hash` for the lock.

## Goals / Non-Goals

- Goals: named snapshots, full-replace restore that is itself undoable, auth never captured or touched, envelope that future app kinds (bundles) restore through.
- Non-goals: shell UI (MCP-only this change); backup scheduling/expiry policies (delete is manual); cross-install migration of the access lock.

## Decisions

1. **Reuse the install envelope, add a backup tag.** Snapshots store the `export_install` payload plus `{ format: 'kody-os-backup/1', name, capturedAt }` under `kody-os.backups.<name>`. Rationale: one envelope shape for export, snapshot, and restore paths; import validation already handles definition/state checking per entry.
2. **Restore = snapshot current, wipe install keys, write snapshot.** The wipe deletes registry, per-app def/state keys, pinned, hidden, recent, and homepage — but never `kody-os.backups.*` and never `kody-os.auth.code_hash`. Rationale: backups must survive the restore they enable, and the device lock must survive any restore; everything else is install state by definition.
3. **Auto-snapshot name is derived, collision-proof.** `auto-<epoch-ms>`; on the vanishing chance of collision, append a counter. The restore result names the auto-snapshot so the caller can undo. Rationale: undoability is the safety case for a destructive op — the result must say exactly how to reverse it.
4. **Restore validates before wiping.** The snapshot payload is fully validated (format tag, per-entry definition/state checks via the existing import path) before the first delete. Rationale: a corrupt snapshot must fail closed with the install untouched — same atomicity rule as `act()`.
5. **Budget honesty over quotas.** No per-backup quota; `backup` returns the snapshot size and `list_backups` reports sizes, with guide guidance (keep 2–3 recent). Rationale: the 16 MiB budget is shared and small; a quota would need an eviction policy, which is a separate decision.

## Risks / Trade-offs

- [Risk] Snapshot + install exceed 16 MiB mid-restore → Mitigation: validate size fit before wiping; fail closed with a naming error.
- [Risk] User restores the wrong snapshot → Mitigation: auto-snapshot makes it reversible; result names the undo snapshot explicitly.
- [Risk] Backup of a bundle-heavy install bloats storage → Mitigation: size reporting in `list_backups`; per-app 256 KiB cap from the bundles change bounds the worst case.

## Migration Plan

None: additive keys and exports. Rollback is a republish of the prior commit. Old envelopes (no backup tag) restore through the existing import path unchanged.

## Open Questions

None — shell UI and retention policies are explicitly deferred non-goals, not unknowns.
