## 1. Stored override read path

- [x] 1.1 Add `kody-os.dev.catalogBase` key constant and a `readDevCatalogBase(store)` helper (string check + `normalizeCatalogBase`; any failure resolves to `null`, never throws)
- [x] 1.2 Thread the stored read into `resolveAgentCatalogBase` after the explicit param / env slot, before the installed Store's declared bases
- [x] 1.3 Thread the stored read into `resolveManagedBase` / `resolveManagedBases` at the same precedence slot
- [x] 1.4 Verify: `bun run typecheck` clean; harness checks for explicit-beats-stored, stored-beats-declaration, corrupt-stored-reads-as-no-override

## 2. Hygiene (backup / export / restore)

- [x] 2.1 Confirm `export_install` payload contains no dev key and `backup` captures none of it (by construction — assert, don't assume)
- [x] 2.2 Confirm `restore` neither wipes nor restores the key (survives unchanged)
- [x] 2.3 Add harness checks: set override → backup/export → key absent from payloads; restore → key still holds its value

## 3. Set/clear surface

- [x] 3.1 Add `set_dev_catalog_base` / `clear_dev_catalog_base` registry functions (set validates with the base allowlist; refusal writes nothing and reports the refusal)
- [x] 3.2 Add a `dev-base` op to `pkg/scripts/catalog.ts` (set when `base` given, clear when omitted) for host-side use against stopped mock storage
- [x] 3.3 Verify: valid loopback base stored and used by subsequent no-explicit-base fetches; refused base unchanged; clear restores Store-declared resolution

## 4. Docs and version

- [x] 4.1 Fix `scripts/dev-local-catalog.sh` header: pass `--allow-private-network` to `kody dev` and document the `dev-base` set/clear loop (per AGENTS.md local-dev note, the script does not pass the flag today)
- [x] 4.2 Decide version bump per `pkg/AGENTS.md` policy (additive behavior; no existing call breaks) and update `pkg/package.json` + `pkg/AGENTS.md` + `pkg/README.md` headers in the same commit as the change
- [x] 4.3 Verify: no browser one-tap control for the override exists (Store page, Apps Edit); spec scenarios in `specs/app-registry/spec.md` all hold

## Close-out (2026-11-15, archived)

- Verified: `bun run typecheck` clean; `tests/store-harness.ts` 251 PASS including 18 new permanent checks for this change (set/refusal/clear, explicit-beats-stored, stored-beats-declaration for agent + `manage_rows`, corrupt-reads-as-no-override, export/backup key absence, restore survival). A 21-check temp script verified the same behavior first, then was deleted.
- Verified: no browser one-tap control for the override (grep over render/app/dispatch); no new MCP export (`pkg/src/index.ts` untouched).
- Substituted: a live `kody dev` (mock) check could not run here (no `kody` CLI in this environment); the harness serves the working-tree catalog over a loopback server with its own fresh base instead, so the fetch code path is identical to production.
- Left open: 2 harness FAILs are pre-existing on the clean base tree (proven via stash + rerun) — discovery-Store self-update checks expect v32 while the working-tree catalog serves v34 (catalog drift). Out of scope for this change; do not fix here.
- Note: `M openspec/specs/shell/spec.md` in the working tree belongs to the already-shipped stripBasePrefix sync, not this change; left in place.
