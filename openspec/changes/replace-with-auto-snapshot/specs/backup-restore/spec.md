## ADDED Requirements

### Requirement: Named install snapshots
The package SHALL capture the entire install — every installed app id, definition, and state, plus pins, hidden flags, and homepage order — as a named snapshot under `kody-os.backups.<name>`. Snapshot names SHALL match `^[a-z0-9][a-z0-9-]{0,63}$`. Capturing over an existing name SHALL be rejected unless `overwrite: true` is passed. Snapshots SHALL live within the same 16 MiB package-storage budget as the registry.

#### Scenario: Capture names the whole install
- **WHEN** `backup('before-8ball')` runs on an install with apps, states, pins, and homepage order
- **THEN** it returns `{ ok: true, name }` and a later `list_backups()` names it with its capture time and app count.

#### Scenario: Overwrite requires consent
- **WHEN** `backup` runs with an existing name and no overwrite flag
- **THEN** it returns `{ ok: false, error }` naming the collision and the stored snapshot is unchanged.

### Requirement: Replace-with-auto-snapshot restore
Restore SHALL fully replace the install: capture the current install as an automatic pre-restore snapshot, then wipe apps, states, and prefs and write the named snapshot's contents. Restoring an unknown name SHALL return `{ ok: false }` and change nothing. The OTP/session registries (`kody-os.auth.otp.v2`, `kody-os.auth.sessions.v2`) SHALL be untouched by capture and restore; the recency list SHALL NOT be captured and SHALL start empty after restore.

#### Scenario: Restore is undoable
- **WHEN** `restore('before-8ball')` runs
- **THEN** the install matches the snapshot, and an automatic pre-restore snapshot exists that restores the prior install when restored in turn.

#### Scenario: Unknown backup is a clean error
- **WHEN** `restore` names a snapshot that does not exist
- **THEN** it returns `{ ok: false, error }` and the install is byte-identical to before.

### Requirement: Backup envelope format
Backup payloads SHALL carry a format tag (`kody-os-backup/1`) with capture time, app entries (definition plus state each), and the prefs. Restore SHALL reject payloads with unknown format tags or unparsable entries with `{ ok: false }` and no writes.

#### Scenario: Bad payload fails closed
- **WHEN** `restore` receives a payload with an unknown format tag
- **THEN** it returns `{ ok: false, error }` and the install is unchanged.
