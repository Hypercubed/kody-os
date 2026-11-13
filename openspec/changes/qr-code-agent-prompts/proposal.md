# Proposal

## Why

The agent prompts in kody-os are one-liners meant to be copied into a
Kody-connected agent. On a desktop that is one copy-paste. On the
Kindle Scribe it is the painful part: selecting and copying a
136-character prompt from the e-ink browser is slow, and the agent
the user talks to lives on their phone, not on the Scribe.

A QR code bridges that gap. The phone camera reads the code off the
Scribe screen, the prompt text lands on the phone, and the user
pastes it into their Kody-connected agent. The code carries the
prompt itself — plain text, not a link — so it works with any agent,
including Muse, for which no documented prefill URL exists.

This was first raised Nov 12, 2026, as a QR alongside the "Install
the App Catalog" prompt only, and deferred. The user now wants the
same treatment on every agent prompt: a small button beside each
prompt that opens the QR code in a modal.

## What Changes

Every agent prompt gains a small QR button that opens a modal
showing a QR code for that exact prompt, plus the prompt text
itself and a short instruction. "Every agent prompt" means two
rendering points, covering all nine prompt kinds:

- The shell's shared help block (`renderEmptyHelp`, in
  `pkg/src/apps/client.ts`), shown identically on the Help page,
  the empty Home page, and the empty Apps page — three prompts:
  "Add your own apps", "Remove an app", and "Install the App
  Catalog".
- The App Store bundle's per-row prompt (`storeAgentPrompt`, in
  `catalog/app-store/store.js`), inside each row's collapsed
  `<details class="store-details">` — six prompt kinds: Install,
  Remove, Update, Absorb, Restore, and Overwrite.

The modal text is, subject to review: "Scan this with your phone,
then paste it into your Kody-connected agent." The wording matters
because the phone camera does the scanning, not the agent — an
agent cannot scan a code on the screen it is being pasted into.

The QR code itself is a shell feature, not a per-prompt
one-off: the shell provides a shared `<os-qr>` element that any
app can use, and both the shell's own prompts and the Store's
rows use it. An app renders a QR code by writing
`<os-qr text="...">` with the server-rendered SVG inside it
(the element re-renders from its `text` attribute when
JavaScript is present); it declares `minPackageVersion`
`4.3.0` if it uses the element, the same way it would for any
shell capability. No app vendors its own QR generator.

The QR payload is the exact prompt string, verbatim, as plain
text. No prefill URL, no auto-submit, no vendor deep link. The
Add and Remove prompts carry their `[display name]` / `[app id]`
placeholders in the code exactly as in the text; the user still
fills those in after pasting.

## What Does Not Change

- No prompt text changes. The one-liners, the
  `package:<slug>#OPERATIONS.md` reference, and the per-status
  prompt table are unchanged; the QR button is an additional path
  beside the selectable text, never a replacement for it.
- No Clipboard API and no copy button. The existing rule stands:
  on-device Scribe tests show `navigator.clipboard` denied, so
  prompts stay plain selectable text.
- No external fetch and no new shell route. The QR code is
  generated from a vendored library, rendered as inline SVG, with
  nothing fetched at render time.
- No MCP shape changes, no catalog source changes, no install,
  update, or status-rule changes.
- No per-app QR generator. The Store carries no copy of the
  generator and no new bundle file; it uses the shell-provided
  `<os-qr>` element like any other app.
- The Store's `minPackageVersion` DOES change: Store 33 depends
  on the shell providing `<os-qr>`, so it requires shell
  `4.3.0` (up from `4.2.0`). Deploy order is therefore shell
  first, then the catalog push — the Store self-update gate
  already offers the update only to shells that meet the
  minimum, so shells still on 4.2.x stay on Store 32 until
  they update.
- A `recipe-only` row gains a QR button for the Install prompt
  it already shows in its details element, like any other
  not-installed row — its controls span ("Ask an agent to
  install via its recipe") is separate from the details prompt
  and gains no button of its own. Rows blocked by
  `needsNewerShell` / `needsNewerSchema`, and rows with no
  prompt at all, gain no button.
- No release, publish, tag, or commit step is part of this
  change. The version bumps are recorded in the design so they
  ride in the same commit as the change; the commit, push, tag
  move, and publish themselves need their own explicit
  direction.
