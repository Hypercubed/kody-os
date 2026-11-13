# help-page — delta

## MODIFIED Requirements

### Requirement: Help is a built-in shell page

The shell SHALL serve a built-in Help page at `GET /help` rendering the shared help text — the exact output of the shell's shared empty-state help block (`renderEmptyHelp`), identical on the Help page, the empty Home page, and the empty Apps page: the intro, and the "Add your own apps", "Remove an app", and "Install the App Catalog" prompts, each a one-liner of the form `Read package:<slug>#OPERATIONS.md, then …` (the slug derived at render time from the running package's own mount, falling back to `kody-os`):
- "Add your own apps": `Read package:<slug>#OPERATIONS.md, then add a new app: Name: [display name]; What it does: [describe what it should do]`.
- "Remove an app": `Read package:<slug>#OPERATIONS.md, then remove this app: [app id]`.
- "Install the App Catalog": `Read package:<slug>#OPERATIONS.md, then install this app: https://github.com/Hypercubed/kody-os/tree/main/catalog/app-store`. The Help page SHALL omit the empty-state closing line ("Once an app is installed your apps show up on the Apps page."); the empty Home and empty Apps pages keep it. `GET /help` SHALL respond 200; the 303 redirect to `/apps/help` is gone, and `/apps/help` SHALL fall through to the existing unknown-app handling (plain 404). The Help page SHALL NOT list installed apps. Help SHALL NOT appear in the Apps list, Edit mode, pin/hide/home controls, home widgets, or the App Store list. The header SHALL link Help when the page is enabled, as a built-in menu link — not a menu-app link. When Help is disabled via the settings file, `GET /help` SHALL respond 404 and the menu SHALL show no Help link. The Help page is a shell page, not an app page, so it SHALL NOT carry the page-mode expand control. The shared help text SHALL NOT name the Settings app or any other browser path for changing settings; the Settings app is reached from the Apps page like any catalog app.

**Amendment (qr-code-agent-prompts):** each of the three prompts SHALL also carry a QR button, labelled "QR", beside its `gate-hint` block. Activating it SHALL open a modal (see the shell QR-modal requirement) holding a heading naming the prompt, an `<os-qr>` element (the shell-provided QR element, see the shell spec) whose `text` attribute is the exact prompt string and whose light-DOM content is the server-rendered QR SVG, the instruction "Scan this with your phone, then paste it into your Kody-connected agent.", and the exact prompt text in a `<code>` block. The QR code SHALL be rendered server-side as inline SVG, error correction level M, quiet zone 4 modules, black on white, minimum 240px wide. The QR button SHALL be at least 48px tall. The prompt texts, the shared-block identity across Help, empty Home, and empty Apps, and the closing-line rule are unchanged.

#### Scenario: Help prompts each show a QR button

- **WHEN** `/help` is opened with Help enabled
- **THEN** each of the three prompts shows a QR button beside it, and the empty Home and empty Apps pages show the same three buttons from the same shared block.

#### Scenario: Help QR modal encodes the Install prompt exactly

- **WHEN** the QR button beside "Install the App Catalog" is activated
- **THEN** the modal shows a QR code that decodes to exactly `Read package:<slug>#OPERATIONS.md, then install this app: https://github.com/Hypercubed/kody-os/tree/main/catalog/app-store`, plus the instruction and the same prompt text in a `<code>` block.
