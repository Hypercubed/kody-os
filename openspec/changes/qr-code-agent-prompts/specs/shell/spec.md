# shell — delta

## ADDED Requirements

### Requirement: Shell provides a QR code element

The shell SHALL define one custom element, `os-qr`, once, in
its client (alongside the `window.KodyBridge` definition), and
it SHALL be the only way a QR code is rendered in the shell
and in apps. `os-qr` is the first `os-*` element; the full
`os-*` naming convention and element set remain with the
shell-islands change.

- The element SHALL carry one attribute, `text`, the exact
  string to encode. Size SHALL come from CSS (minimum 240px
  wide).
- The element SHALL be light-DOM only: it SHALL NOT create a
  shadow root, SHALL NOT use constructable stylesheets or
  `adoptedStyleSheets` at runtime, and its rendered SVG SHALL
  live as light-DOM children so the `os-*` theme CSS applies
  and the code stays visible with JavaScript disabled.
- On connect and whenever `text` changes, the element SHALL
  re-render its SVG from the shell's vendored QR generator:
  error correction level M, quiet zone 4 modules, black on
  white. Server-rendered SVG already inside the element SHALL
  be left in place when `text` is unchanged.
- The shell client module runs before `DOMContentLoaded`,
  when bundles init, so the element SHALL be defined before
  any app bundle's init. An `<os-qr>` parsed before its
  definition SHALL upgrade when the definition lands.
- Any app MAY use `<os-qr text="...">` with the
  server-rendered SVG inside it. An app that uses it SHALL
  declare `minPackageVersion` `4.3.0`. Apps SHALL NOT define
  the element themselves and SHALL NOT vendor their own QR
  generator.
- When Lit lands, `os-qr` MAY be reimplemented on Lit
  internals; the tag, the `text` attribute, and the
  light-DOM SVG output SHALL NOT change.

#### Scenario: App uses the shell QR element

- **WHEN** an app renders `<os-qr text="hello">` with the
  server-rendered SVG inside it
- **THEN** the code displays with JavaScript disabled, and
  with JavaScript enabled the element renders the same code
  from its `text` attribute, with no shadow root and no
  generator vendored by the app.

#### Scenario: Element defined before bundle init

- **WHEN** a page renders an app bundle that creates an
  `<os-qr>` element at `DOMContentLoaded`
- **THEN** the element is already defined by the shell client
  and renders immediately.

### Requirement: Agent-prompt QR code modal

Each agent prompt in the shell's shared help block SHALL have a QR modal reachable from its QR button without JavaScript. The button SHALL be a fragment link to an overlay section rendered in the same server-rendered page, reusing the existing `:target` modal overlay (`.overlay` / `.overlay-panel`, panel top at 25vh). The overlay SHALL hold a heading naming the prompt, an `<os-qr>` element whose `text` attribute is the exact prompt string and whose light-DOM content is the server-rendered QR SVG, the instruction "Scan this with your phone, then paste it into your Kody-connected agent.", the exact prompt text in a `<code>` block, and a close link that clears the fragment and returns to the page.

Fragment ids SHALL be unique per prompt and SHALL NOT collide with the `app-<id>` overlay ids. The QR code SHALL encode the exact prompt string as plain text. The QR button SHALL be labelled "QR" and SHALL be at least 48px tall. Opening, viewing, and closing the modal SHALL work with JavaScript disabled.

#### Scenario: QR modal opens without JavaScript

- **WHEN** the QR button beside a help prompt is followed with JavaScript disabled
- **THEN** the overlay becomes visible showing the QR code, the instruction, and the exact prompt text, and the close link hides it again.

#### Scenario: QR modal fragment ids do not collide with app overlays

- **WHEN** the Help page renders with modal-capable apps installed
- **THEN** no QR overlay id equals any `app-<id>` overlay id on the page.
