# Close-out: min-package-version (handoff 10b)

Archived 2026-11-08. Implementation and verification were done in handoff 10;
this note closes task 3.3. Nothing was committed, pushed, published, or
version-bumped by this handoff.

## What was verified (tasks 2.1-2.3)

- 2.1 bun harness (memory store, running shell 4.0.0):
  - Malformed `minPackageVersion` (`1.2`) fails validation with
    `definition.minPackageVersion must be MAJOR.MINOR.PATCH (numeric parts,
    no pre-release or build metadata)`; nothing installed.
  - Minimum above running (`5.0.0`) refused by `add_app`:
    `{ ok: false, error: 'App "hiver" requires package version 5.0.0
    (running 4.0.0)' }`.
  - Minimum equal (`4.0.0`) and below (`0.0.0`) install `{ ok: true }`.
  - Update re-adding an installed app with a raised minimum (`5.0.0`)
    refused the same way; the installed definition is unchanged.
  - The definition fingerprint differs with vs. without `minPackageVersion`.
- 2.2 `kody execute --target mock` (server stopped, mock store):
  - Above-minimum install refused with the required + running versions
    named; malformed refused; equal-minimum installs `{ ok: true }`;
    update raising the minimum refused. Test apps were removed afterwards;
    the mock store was left clean.
  - Store row: jsdom over the real `catalog/app-store/index.html` +
    `store.js` with a mocked `/manage/rows` returning one
    `needsNewerShell` row rendered
    `Requires shell v5.0.0 (running v4.0.0).` with 0 control buttons.
- 2.3: ES2019 scan clean (no `?.` / `??` in new code; matches are ceiling
  comments only). `bun build src/app.ts` and `src/apps/registry.ts`
  (`--target=browser --external 'kody:*'`) succeed.
- Catalog + store harnesses pass (18 apps, 0 collections).

## 2.2 substitution

No live-browser navigation at 127.0.0.1:4302 was performed. `kody execute`
against the mock target covered the install/update refusal path, and jsdom
covered the Store row rendering. Recorded as substituted.

## Implementation note (spec deviation, same source)

The spec said to read the running package version via `getPackageMeta()`.
`getRunningPackageVersion` instead reads `pkg/package.json` directly via a
bundler-inlined dynamic import (fallback `0.1.0` when the manifest is
absent) — the same source file the status bar reads through
`getPackageMeta()`, but a separate reader local to the registry module.
`build` is ignored; comparison is numeric MAJOR/MINOR/PATCH.

## Live-store state

No catalog app currently declares `minPackageVersion`, so the gate is
proven by the harness/mock/jsdom checks only; the live Store shows no
incompatible rows.

## App-store version

App-store `catalogVersion` 14 -> 15 (its bundle `store.js` changed, per the
existing +1 rule); `catalog/catalog.json` regenerated.
