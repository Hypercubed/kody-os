# Tasks

No task in this file commits, pushes, publishes, tags, or
releases anything. The shell version bump and the Store
`catalogVersion` bump ride in the same commit as the change
they describe — that commit itself still needs direction
before it happens. Pushing, moving tag `4.2`, and publishing
to Kody are release acts needing their own explicit
direction naming the tag and the remote (repository rule).
Do not put release or publish steps in this plan.

## 1. Spec — QR code for every agent prompt

- [ ] 1.1 Write this change: proposal (Scribe copy pain,
  plain-text payload, nine prompt kinds), design (payload,
  modal text, `:target` shell modal, `.store-dialog` Store
  modal, vendored generator, 48px button, versioning), tasks,
  and spec deltas for `app-registry` (Store row prompt gains
  a QR button and modal), `help-page` (shared help prompts
  gain a QR button and modal), and `shell` (new QR-modal
  requirement reusing the `:target` overlay). Get it reviewed
  before implementing.
- [ ] 1.2 Confirm the four review points before
  implementation: (a) modal instruction wording — spec
  proposes "Scan this with your phone, then paste it into
  your Kody-connected agent." vs the user's "Scan this on
  your Kody connected agent"; (b) the button is 48px tall
  per the shell tap rule despite "small" — confirm no
  exception is wanted; (c) the Store's `minPackageVersion`
  rises to `4.3.0` and deploy order is shell first, then
  catalog; (d) the `<os-qr>` contract — tag, `text`
  attribute, light-DOM only, first `os-*` element, with the
  full naming convention still owned by shell-islands.
  Record the answers here and correct the design and deltas
  if they change.

## 2. Vendor the QR generator

- [ ] 2.1 Vendor Nayuki `qrcodegen` (MIT, no dependencies)
  into the repo as a single source, ES2019-compatible, with
  its licence notice kept. Add a small SVG renderer (modules
  to inline `<svg>`, error correction M, quiet zone 4
  modules, black on white). Verify: generating the
  install-catalog prompt (136 chars) yields a version-8 code
  and the Absorb prompt (~191 chars) a version-10 code, and
  both decode to exactly their prompt strings.
- [ ] 2.2 Wire the single source to its two shell consumers:
  server-side in `pkg/src` (for `renderEmptyHelp`) and in
  the shell client (for the `<os-qr>` element definition).
  The Store is not a consumer and carries no copy and no new
  bundle file.
- [ ] 2.3 Define `<os-qr>` once in the shell client
  (`pkg/src/client/index.ts`, alongside the
  `window.KodyBridge` definition): tag `os-qr`, `text`
  attribute, light-DOM only, no shadow root, no
  constructable stylesheets or `adoptedStyleSheets`, SVG
  rendered from the vendored generator on connect and on
  `text` change, server-rendered SVG left in place when
  `text` is unchanged. Verify: the element is defined
  before `DOMContentLoaded` (so before bundle init), an
  element parsed before definition upgrades when it lands,
  and the code shows with JavaScript disabled from its
  light-DOM SVG.

## 3. Shell — QR button and modal in the shared help block

- [ ] 3.1 Extend `renderEmptyHelp` (`pkg/src/apps/client.ts`)
  so each of the three prompts gains a QR button (fragment
  link, label "QR") beside its `gate-hint` block, plus a
  `:target` overlay section per prompt holding the heading,
  an `<os-qr text="...">` element with the server-rendered
  QR SVG (minimum 240px wide) inside it, the instruction,
  the exact prompt text in `<code>`, and a close link
  clearing the fragment. Fragment ids unique per prompt
  (`qr-add`, `qr-remove`, `qr-install-catalog`) and not
  colliding with `app-<id>` overlay ids. No JavaScript.
- [ ] 3.2 Add the QR button and modal styles to
  `pkg/public/styles.css` (48px minimum height, system font,
  monochrome, no animation) and regenerate
  `pkg/src/shell-css.ts`; verify the regen diff touches only
  the new rules. Verify: modal opens and closes with
  JavaScript disabled on Help, empty Home, and empty Apps,
  and the three surfaces stay identical (one code point).
- [ ] 3.3 Bump the shell MINOR: `4.2.2` → `4.3.0` in
  `pkg/package.json`, with `pkg/AGENTS.md` and `pkg/README.md`
  headers updated in the same commit as the change. Build
  +1 on publish, not in this change.

## 4. Store — QR button and dialog per row

- [ ] 4.1 In `catalog/app-store/store.js`, add a QR button
  to each row's details element (beside or under the prompt
  `<code>`), created only when `storeAgentPrompt(row)`
  returns a prompt. Activating it opens a `.store-dialog`
  (`role="dialog"`, `aria-modal="true"`) with the heading,
  an `<os-qr text="...">` element (minimum 240px wide,
  rendered by the shell-defined element — the Store
  generates no QR code and imports no generator), the
  instruction, the exact prompt text, and a Close button;
  backdrop click closes it and focus moves into the dialog
  on open. No button on rows with no prompt (blocked rows,
  rows with no folder URL except Remove-by-id). A
  `recipe-only` not-installed row has the Install prompt, so
  it gets a button for that prompt.
- [ ] 4.2 Add the QR button and dialog styles to
  `catalog/app-store/store.css` (48px minimum height).
  Bump the Store definition `catalogVersion` 32 → 33 and
  raise its `minPackageVersion` to `4.3.0`, and regenerate
  `catalog/catalog.json`. Verify the Store bundle stays
  under the 256 KiB cap (it gains no generator and no bundle
  file, so its size is unchanged apart from the dialog code).

## 5. Harness

- [ ] 5.1 Extend the Store harness: every row with a prompt
  renders a QR button, every row without one renders none;
  for each of the six Store prompt kinds the generated QR
  decodes to exactly the prompt string. Extend the shell /
  help checks the same way for the three shell prompts.
- [ ] 5.2 Add a check that the server-rendered SVG and the
  `<os-qr>` element's rendering of the same prompt string
  produce identical QR modules, and a check that the
  element creates no shadow root and uses no constructable
  stylesheets or `adoptedStyleSheets` at runtime.

## 6. Verification

- [ ] 6.1 Typecheck clean; catalog harness, Store harness,
  and agent-tools harness pass (name any failure and verify
  it pre-existing on a clean checkout before calling it so).
- [ ] 6.2 Scribe scan test — the one Scribe task, justified
  because e-ink scan behaviour of a version-8–10 code is
  genuinely unknown: the user scans the install-catalog QR
  off the real Scribe screen with their phone at normal
  reading distance. Pass bar is first-try success; if it
  needs hunting for an angle, raise the render size or the
  correction level and re-test before calling this done.
- [ ] 6.3 Confirm no Clipboard API use, no external fetch,
  and no new shell route were introduced; confirm the modal
  prompt text matches the button prompt byte for byte in all
  nine cases.

## 7. Sync and close-out

- [ ] 7.1 Sync the canonical specs (`app-registry`,
  `help-page`, `shell`) with the deltas in this change, in
  the same commit as the implementation.
- [ ] 7.2 Archive this change to
  `openspec/changes/archive/<YYYY-MM-DD>-qr-code-agent-prompts/`
  with a close-out note recording what was verified, what
  was substituted, and what was left open — including the
  Scribe scan result and the final modal wording.
