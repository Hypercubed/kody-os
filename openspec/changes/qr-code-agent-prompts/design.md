# Design: QR code for every agent prompt

## Context

Prompt inventory, verified Nov 13, 2026 against `main` at
`260ea96` (shell 4.2.2, build 49; Store catalogVersion 32):

- Shell, `renderEmptyHelp` (`pkg/src/apps/client.ts`): three
  prompts, 78–136 characters. Add (132 chars, with `[display
  name]` / `[describe what it should do]` placeholders), Remove
  (78 chars, with `[app id]`), Install the App Catalog (136
  chars). Rendered on `/help` (closing line omitted), empty Home,
  and empty Apps (closing line kept) — one code point, three
  surfaces.
- Store, `storeAgentPrompt` (`catalog/app-store/store.js`): six
  prompt kinds, one per row status — Install, Remove (id only, no
  folder URL), Update, Absorb, Restore, Overwrite. Longest is
  Absorb at ~191 characters with a typical folder URL. Rendered
  inside a collapsed `<details class="store-details">` holding a
  `<summary>` naming the action and a `<code>` with the prompt
  text, set via `textContent`.

Existing modal patterns, reused rather than invented:

- Shell: the `:target`-revealed overlay (`.overlay` /
  `.overlay-panel`, panel top at 25vh, `pkg/public/styles.css`),
  used for modal-capable apps. Fully present in server-rendered
  HTML, no JavaScript needed to open or close it.
- Store: the JS-created `.store-dialog` (`role="dialog"`,
  `aria-modal="true"`, click-on-overlay closes, focus moved to
  the confirm button), used by the update/restore/remove
  confirmations in `store.js`. The Store requires JavaScript by
  design, so a JS dialog is consistent there.

Shell-provided sharing, verified Nov 13, 2026: the shell
client is a module script in the shell chrome on every page,
and it runs before `DOMContentLoaded` — which is when bundles
init — so bundles can use what it provides at init time. That
is the proven `window.KodyBridge` pattern (`pkg/src/client/index.ts`
sets the bridge; the Store itself inits on
`DOMContentLoaded`). Custom elements add one more property the
bridge does not need: an element parsed before its definition
upgrades when the definition lands, so ordering is safe even
for elements created at parse time. No `os-*` element exists
in the code yet — `os-qr` would be the first — and the full
`os-*` naming convention and element set remain with the
shell-islands change; this change establishes one element and
its contract, not the whole library.

Shell constraints that bind this change: ES2019 only, system
fonts only, zero emojis, minimum 48px tap targets, no animation
or transition, monochrome, styles inlined via the generated
`pkg/src/shell-css.ts`, and the shell pages work without
JavaScript (the Store excepted). The Store bundle is capped at
256 KiB per definition.

Test QRs generated Nov 12, 2026 (`~/workspace/qr-prompt-demo/`,
not in the repo): plain-text install-catalog prompt encodes as
QR version 8 (49 modules); the Claude/ChatGPT prefill-URL forms
as version 10 (57 modules). Plain text is the smaller code and
the universal path, which is why this change encodes plain
text only. No scan off a real Scribe screen has been done yet —
that is the open verification, not a settled fact.

## Decisions

### 1. Payload: the exact prompt, plain text, nothing else

The QR code SHALL encode the exact prompt string shown in the
accompanying `<code>` block, byte for byte, as plain text. No
URL wrapper, no prefill parameter, no shortening service.

Rationale: a URL wrapper would tie the code to one vendor's
prefill behaviour (ChatGPT auto-submits; Claude prefills but
shows an untrusted-prompt warning for unknown prompts; Muse
has no documented prefill URL at all), and it would make the
code denser (version 10 vs 8 for the install prompt). Plain
text works with every Kody-connected agent and keeps the code
as small as the prompt allows. The cost is the paste step
remaining: scanning puts the text on the phone, the user still
opens their agent and pastes it. That is the honest scope of
this change.

### 2. Modal text

The modal SHALL show, in this order: a heading naming the
action (e.g. "Install with an agent"), the QR code, the
instruction "Scan this with your phone, then paste it into
your Kody-connected agent.", and the exact prompt text in a
`<code>` block identical to the prompt beside the button.

The prompt text is shown alongside the code on purpose: a QR
code is opaque — the user cannot read what is in it — so the
modal SHALL NOT be the only place the prompt appears, and the
code SHALL encode nothing the modal does not also display.

Open for review: the instruction wording. The user proposed
"Scan this on your Kody connected agent"; the spec proposes
"Scan this with your phone, then paste it into your
Kody-connected agent" because the phone camera scans and the
agent receives a paste. If the user prefers their wording, the
tasks record the change and the spec is corrected before
implementation.

### 3. Shell modal: the `:target` overlay, no JavaScript

Each shell prompt gains a QR button beside its `gate-hint`
block. The button is a fragment link (`href="#qr-<id>"`) to an
overlay section rendered in the same server-rendered page,
using the existing `.overlay` / `.overlay-panel` pattern
(`:target` reveals it, panel top at 25vh). The overlay holds
the modal content from decision 2 and a close link that
clears the fragment and returns to the page.

Fragment ids SHALL be unique per prompt and stable across the
three surfaces that share the block: `qr-add`,
`qr-remove`, `qr-install-catalog` (exact ids are an
implementation detail, but they SHALL NOT collide with the
`app-<id>` overlay ids). Because the block is shared, the
overlays SHALL be rendered by `renderEmptyHelp` alongside the
prompts, so Help, empty Home, and empty Apps cannot diverge.

No JavaScript is involved on the shell side: opening, viewing,
and closing the QR modal SHALL work with JavaScript disabled,
like the app overlays. The QR is an `<os-qr>` element whose
`text` attribute carries the prompt and whose light-DOM
content is the server-rendered QR SVG — so with JavaScript
disabled the element is an unknown tag whose SVG child still
displays, exactly like the app overlays' no-JS content.

### 4. Store modal: the `.store-dialog` pattern

Each Store row's details element gains a QR button beside (or
directly under) its prompt `<code>`. Activating it SHALL create
a `.store-dialog` overlay in the existing `showConfirm` style:
`role="dialog"`, `aria-modal="true"`, the modal content from
decision 2 with the QR rendered by an `<os-qr>` element, a
Close button that removes the dialog, click on the overlay
backdrop closes it, and focus moves into the dialog on open.
The button is created by `store.js` at render time, next to
the prompt it encodes, so a row whose `storeAgentPrompt`
returns null gets no button. A `recipe-only` not-installed
row returns the Install prompt from `storeAgentPrompt`, so it
gets a QR button for that Install prompt like any other
not-installed row; its controls span ("Ask an agent to install
via its recipe.") gets no separate button. The Store SHALL NOT
generate QR codes itself and SHALL NOT carry a copy of the
generator: it creates `<os-qr text="...">` elements and the
shell-defined element renders them (see decision 6).

The Store already requires JavaScript, so no no-JS fallback
is added for the Store dialog. The Store's no-JS note is
unchanged.

### 5. QR generation: one vendored library, SVG output

QR codes SHALL be generated from a single vendored library
in the repo — proposed: Nayuki's QR Code generator
(`qrcodegen`, MIT, no dependencies, ES5 build available,
compiles to ES2019) — rendered as inline SVG strings. No
external QR API, no network fetch at render time, no prompt
leaving the device to generate its code.

The library has exactly two consumers, both in the shell:

- Server-side, in `pkg/src`: `renderEmptyHelp` renders the
  QR SVG for each prompt into the `<os-qr>` element's
  light-DOM content at serve time.
- Client-side, in the shell client (`pkg/src/client/index.ts`):
  the `<os-qr>` element definition imports the same library
  and re-renders from the element's `text` attribute when
  the attribute changes.

The two renderings SHALL produce the same modules for the
same prompt string; a harness check SHALL assert that (see
tasks). The Store is not a consumer: it creates `<os-qr>`
elements and never imports the generator, so it carries no
copy and no new bundle file.

Encoding: error correction level M, quiet zone 4 modules,
black modules on white, minimum rendered width 240px. At
240px a 57-module code (the longest prompt, Absorb at ~191
chars) renders at ~4.2px per module, before the quiet zone.
Level M survives minor e-ink ghosting better than L while
keeping the code smaller than Q/H; the Scribe scan test in
the tasks is the check that M at 240px is enough, and if it
is not, the fix is a larger render or higher correction, not
a different payload.

### 6. `<os-qr>` is the shared element — the first `os-*` element

The shell SHALL define one custom element, `os-qr`, once, in
its client (`pkg/src/client/index.ts`, alongside the
`window.KodyBridge` definition), and every QR code in the
shell and in apps SHALL be rendered through it:

- Tag `os-qr`, one attribute: `text`, the exact string to
  encode. No other attribute is part of the contract in this
  change; size comes from CSS (minimum 240px wide).
- Light-DOM only: the element SHALL NOT create a shadow root,
  SHALL NOT use constructable stylesheets or
  `adoptedStyleSheets` at runtime, and its rendered SVG SHALL
  live as light-DOM children so the `os-*` theme CSS applies
  and the code stays visible with JavaScript disabled.
- Rendering: on connect and whenever `text` changes, the
  element re-renders its SVG from the vendored generator
  (decision 5): error correction M, quiet zone 4 modules,
  black on white. Server-rendered SVG already inside the
  element is left in place when `text` is unchanged, so the
  no-JS first paint and the JS render agree.
- Availability: the shell client module runs before
  `DOMContentLoaded`, when bundles init, so the element is
  defined before the Store's `storeInit` and before any app
  bundle's init. An `<os-qr>` parsed before its definition
  upgrades when the definition lands, so creation order is
  safe either way. If the element is ever not defined (an
  older shell, or the client failing to load), the element
  degrades to its light-DOM content: server-rendered SVG
  still shows, and a dynamically created empty `<os-qr>`
  shows nothing — but the prompt text in the surrounding
  modal is separate from the element, so the dialog never
  loses the prompt itself.
- Apps: any app MAY use `<os-qr text="...">` with the
  server-rendered SVG inside it, exactly as the shell does.
  An app that uses it SHALL declare `minPackageVersion`
  `4.3.0`, the shell version that provides the element. Apps
  SHALL NOT define the element themselves and SHALL NOT
  vendor their own generator — the shell owns the tag, the
  same way it owns the bridge.
- Scope note: this establishes one element and its contract.
  The full `os-*` naming convention, the shared-element set,
  and the Lit reimplementation remain with the shell-islands
  change. When Lit lands, `os-qr` MAY be reimplemented on
  Lit internals; the tag, the `text` attribute, and the
  light-DOM SVG output SHALL NOT change, so apps using it do
  not change with it. Waiting for Lit was considered and
  rejected: the element is stateless, vanilla custom elements
  pass the ES2019 ceiling that Lit as shipped fails, and
  shell-islands has no landed date.

### 7. Button: labelled "QR", 48px tap target

The button SHALL be labelled "QR" (text, no emoji, system
font). The user asked for a small button; the shell rule
requires minimum 48px tap targets, so the button SHALL be
48px tall with compact horizontal padding and font size —
visually small, but not below the tap floor. This tension is
flagged for review: if the user wants it genuinely smaller
than 48px, the shell tap rule would need an explicit
exception, and this spec does not grant one.

In the shell the button is a link styled as a button; in the
Store it is a real `<button type="button">`, matching the
Store's existing controls. Either way it SHALL NOT submit a
form and SHALL NOT navigate away from the page.

### 8. Versioning

- Shell: new feature, nothing existing breaks — MINOR.
  `4.2.2` → `4.3.0`, PATCH reset to 0, build +1 on publish.
  `pkg/package.json`, `pkg/AGENTS.md`, and `pkg/README.md`
  headers updated in the same commit as the change.
- Store: `store.js` and `store.css` change, so the definition
  changes — `catalogVersion` 32 → 33, and
  `catalog/catalog.json` regenerated. The Store's
  `minPackageVersion` DOES change, `4.2.0` → `4.3.0`,
  because Store 33 depends on the shell providing `os-qr`
  (decision 6). No shell line advance and no tag freeze is
  needed beyond that: the Store self-update gate already
  offers the update only to shells meeting the minimum, so
  shells still on 4.2.x stay on Store 32 until they update
  their shell. Deploy order is shell first, then catalog
  push with the tag move — each needing its own explicit
  direction, none of which is in this change.

### 9. What the QR modal is not

- Not a prefill link. Nothing auto-submits, nothing opens an
  agent app, nothing assumes which agent the user uses.
- Not a copy button. The Clipboard API stays unused; the
  prompt stays selectable text beside the button and inside
  the modal.
- Not a share feature. The code encodes the viewer's own
  prompt for their own shell (the slug is derived at render
  time from the running package), and the modal shows the
  text it encodes, so there is no hidden payload to audit.

## Verification

- Typecheck clean (`bun run typecheck` in `pkg/`).
- Catalog harness and Store harness pass; the Store harness
  gains checks that every row with a prompt also renders a
  QR button, and every row without a prompt renders none.
- For each of the nine prompt kinds, the QR SHALL decode to
  exactly the prompt string shown beside it (shell: three
  prompts; Store: six prompt kinds, exercised across row
  statuses). A harness or script check SHALL assert this
  from the rendered output, not from eyeballing a picture.
- Shell QR modal opens and closes with JavaScript disabled;
  Store dialog opens and closes, and backdrop click closes
  it.
- `os-qr` contract: the element is defined once by the shell
  client, creates no shadow root, uses no constructable
  stylesheets or `adoptedStyleSheets` at runtime, renders the
  server-rendered SVG with JavaScript disabled, and
  re-renders when `text` changes. A sample app using
  `<os-qr text="...">` renders its code through the shell
  element with no generator of its own.
- Bundle size: the Store definition gains no generator and no
  bundle file, so its size is unchanged apart from the dialog
  code; the shell client grows by the vendored generator and
  the element definition, recorded in bytes at implementation.
- Scribe scan test (the one Scribe task in this change, and
  it is specific, not generic: e-ink scan behaviour of a
  version-8–10 code is genuinely unknown): the user scans
  the install-catalog QR off the real Scribe screen with
  their phone at normal reading distance. First-try success
  is the pass bar; if it needs hunting for an angle, the
  render size or correction level is raised before the
  change is considered done.
