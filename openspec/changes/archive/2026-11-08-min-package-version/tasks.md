# Tasks

Phases land in order: 1, then 2, then 3. No task in this file commits,
pushes, or publishes anything.

## 1. Definition field and enforcement

- [x] 1.1 Add `minPackageVersion` to the app definition type and
  validation (`pkg/src/apps/types.ts`, registry validation):
  optional string `MAJOR.MINOR.PATCH`; absent means no minimum;
  malformed (not numeric `MAJOR.MINOR.PATCH`) fails validation with
  a reason and nothing is installed.
- [x] 1.2 Enforce in `add_app` (`pkg/src/apps/registry.ts`), the
  single install entry point: read the running package version via
  `getPackageMeta()`; compare numerically (MAJOR, MINOR, PATCH);
  when the running shell is older than the app's
  `minPackageVersion`, return `{ ok: false, error }` naming the app,
  the required minimum, and the running shell version, and write
  nothing. A definition without the field is unaffected.
- [x] 1.3 Store: do not offer a one-tap install or update for an app
  whose `minPackageVersion` is newer than the running shell; show
  the requirement and the running shell version instead (exact row
  rendering is the implementer's call). An update that raises the
  minimum is refused the same way.

## 2. Verify

- [x] 2.1 Harness checks: a definition with a malformed
  `minPackageVersion` fails validation; an app with a minimum above
  the running shell is refused by `add_app` with the required and
  running versions named; an app with a minimum at or below the
  running shell installs; an update to a definition with a raised
  minimum is refused.
- [x] 2.2 Verify in `kody dev` (mock target): install an app whose
  minimum is above the running shell and confirm the refusal and
  its error text; install one at/below and confirm it installs;
  attempt an update that raises the minimum and confirm the
  refusal; confirm the Store row for an incompatible app shows the
  requirement instead of an install control.
- [x] 2.3 Bundle constraints and build: ES2019 scan clean;
  `bun build pkg/src/app.ts --target=browser --external 'kody:*'`
  succeeds.

## 3. Verify and sync specs

- [x] 3.1 Verify: `openspec validate --changes` shows no new
  failures.
- [x] 3.2 Sync the canonical specs: the app-registry and authoring
  deltas in this change become canonical (see `specs/`).
- [x] 3.3 Archive with a close-out note recording what was verified
  and what was left open.
