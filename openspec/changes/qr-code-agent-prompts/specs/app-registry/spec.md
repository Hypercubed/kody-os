# app-registry — delta

## MODIFIED Requirements

### Requirement: Store row agent-prompt details

Every App Store row SHALL carry a copyable agent prompt for the action that row is about, inside a collapsed `<details class="store-details">` element at the bottom of the row's description (after badge, description, and capabilities), holding a `<summary>` naming the action and a `<code>` element with the prompt text. The prompt SHALL be plain selectable text, set via `textContent` (never `innerHTML` for text built from a row id or label), with no copy button and no Clipboard API use. The one-tap buttons stay as they are; the details element is an additional path, never a replacement.

The prompt is a one-liner naming the operations file and the app's catalog folder; the procedure lives in the file, not in the prompt. With `<ops>` the reference `Read package:<slug>#OPERATIONS.md` (the slug derived at render time from the running package's own mount, falling back to `kody-os`) and `<folder>` the row's `folderUrl`, the prompt per row status SHALL be:

- Not installed: `Read <ops>, then install this app: <folder>`.
- Behind-clean or catalog-differing: `Read <ops>, then update this app to the latest catalog version: <folder>`.
- Behind-modified, modified-current, or absorbed-behind: `Read <ops>, then absorb the catalog changes into this app, keeping my local customizations: <folder>` (see "Absorb a modified catalog app").
- Modified-ahead: `Read <ops>, then restore this app to the catalog copy: <folder>`.
- Snapshot-less: `Read <ops>, then overwrite this app with the catalog copy: <folder>`.
- Up-to-date or absorbed: `Read <ops>, then remove this app: <folder>`.

No prompt SHALL name a label, an id, or an MCP call. A row without a `folderUrl` (no catalog entry) SHALL show no Install details.

No details element SHALL appear on a row blocked by a requirement (`needsNewerShell` / `needsNewerSchema`, which show the requirement instead of any control) or on a `storage-only` / `storage-only-formerly` row. A not-installed `recipe-only` row SHALL show the Install details like any other not-installed row (the recipe prompt is the Install one-liner; the controls span explaining that there is no Add button stays).

**Amendment (qr-code-agent-prompts):** each details element SHALL also carry a QR button, labelled "QR", beside or directly under its prompt `<code>`, created only when the row has a prompt. Activating it SHALL open a `.store-dialog` modal (`role="dialog"`, `aria-modal="true"`) holding a heading naming the action, an `<os-qr>` element (the shell-provided QR element, see the shell spec) whose `text` attribute is the exact prompt string, the instruction "Scan this with your phone, then paste it into your Kody-connected agent.", the exact prompt text in a `<code>` block, and a Close button. Clicking the dialog backdrop SHALL close it, and focus SHALL move into the dialog on open. The Store SHALL NOT generate QR codes itself and SHALL NOT carry a copy of the generator. The QR button SHALL be at least 48px tall. No button SHALL appear on a row with no prompt. The prompt text, the one-tap buttons, and the no-Clipboard-API rule are unchanged. The Store definition's `minPackageVersion` SHALL be `4.3.0`, the shell version that provides `<os-qr>`.

#### Scenario: Row with a prompt shows a QR button

- **WHEN** a Store row renders its details prompt
- **THEN** the details element also shows a QR button labelled "QR", and a row with no prompt shows no QR button.

#### Scenario: QR modal encodes the row's prompt exactly

- **WHEN** the QR button on an Install row is activated
- **THEN** the dialog shows a QR code that decodes to exactly the Install one-liner shown in the row, plus the instruction and the same prompt text in a `<code>` block, and closing the dialog (Close button or backdrop click) returns to the row list.

#### Scenario: Recipe-only row shows a QR button for its Install prompt

- **WHEN** a not-installed `recipe-only` row renders
- **THEN** it shows the Install details with a QR button for the Install one-liner, and its controls span ("Ask an agent to install via its recipe.") carries no separate QR button.
