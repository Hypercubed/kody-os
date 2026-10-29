## 1. Seeding

- [ ] 1.1 Add lazy first-run seeding (empty-registry check installs the bundled set once via the validated `add_app` path) and verify a blank store opens populated while a non-empty store is untouched
- [ ] 1.2 Seed with the current validation set (`counter`; clock/calendar definitions slot in when built) and verify seeded apps act, export, and re-import like any other app

## 2. Verification

- [ ] 2.1 Run the full change checks (blank store opens populated, reseed never fires on populated stores, seeded apps act/export/re-import, blank-store round trip) and verify `openspec validate` passes for the change
