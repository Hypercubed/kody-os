# Spec Delta

## MODIFIED Requirements

### Requirement: Single shared chrome

Every page SHALL use the same chrome: title bar with the page title and a close box (labeled with its destination, omitted on the dashboard); menu strip with the left cluster of brand mark plus product name from `os-theme.json` (default `kody-os`) followed immediately by Home, Apps, and Help links (no Refresh link); main content; footer with status text, the active auth path (`via kody`, `via cookie`, `via key`, or `locked`), and no home navigation; `data-pak-config` carrying the current phase; and a right-aligned date and time (server-rendered UTC on each navigation; a client tick SHALL keep it live in the browser's local time zone where JavaScript runs). The titlebar close box on an app page SHALL return to the opener (`/` or `/apps`, carried as a validated `from` param on the tile link); with no valid `from` it SHALL go Home. The dashboard at `GET /` SHALL omit the close box (it already is home) and every other page SHALL show it. The document title SHALL read `{page} · {title}` where `{title}` is the theme title when set, else the theme name. Body background and header mark SHALL likewise render from the theme file with current values as defaults.

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with plain "Not found." text and no home link in the body; the titlebar close box is the way back.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps, Help left to right with no Refresh link, and shows a date + time on the far right.

#### Scenario: Defaults preserve current rendering
- **WHEN** no theme file is present
- **THEN** title, brand, and background are byte-identical to the pre-change shell.

#### Scenario: Footer names the auth path
- **WHEN** any page is fetched
- **THEN** the footer states which path authenticated the request (`via kody`, `via cookie`, `via key`, or `locked`).

#### Scenario: Close returns to the opener
- **WHEN** an app opened from the Apps page is closed via the titlebar box
- **THEN** the browser lands on the Apps page, not Home.

#### Scenario: Close from Home returns Home
- **WHEN** an app opened from a home widget is closed via the titlebar box
- **THEN** the browser lands on Home.

#### Scenario: Bad from falls back to Home
- **WHEN** an app page is opened with a missing or off-site `from` value
- **THEN** the close box links Home and no open redirect occurs.
