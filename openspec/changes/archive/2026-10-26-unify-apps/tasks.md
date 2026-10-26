# Tasks

## 1. Unified type + validator

- [x] 1.1 Unify `AppDefinition` in `pkg/src/apps/types.ts` (drop `kind`, require `bundle`, generic `set`/`append` effects) and verify `node --experimental-strip-types --check` passes
- [x] 1.2 Unify `validateDefinition` in `pkg/src/apps/registry.ts` and verify bad bundle path, bad field, and legacy `kind` each return `{ ok: false }` with reason

## 2. Unified act + render

- [x] 2.1 Allow `act()` on all apps with `set`/`append`, shim `increment/toggle/reset` to `set`, and verify atomicity (bad act changes nothing) plus probe append caps hold
- [x] 2.2 Single render path in `pkg/src/apps/client.ts` (bundle UI + state + forms, no template branch) and verify `hello-counter`, `eight-ball`, `clock` render on preview
- [x] 2.3 Retire `/probe*` routes in `pkg/src/app.ts` after probe converts and verify no grep hits for `probe-report` or `kody-os.probe`

## 3. Migrate + verify

- [x] 3.1 Migrate `example-apps/` to unified shape same-id and verify each installs via `add_app` and renders with working actions
- [x] 3.2 Update `pkg/docs/adding-an-app.md` + export `kody-os-app/3` and verify `openspec validate --changes` passes plus ES2019 grep zero hits
