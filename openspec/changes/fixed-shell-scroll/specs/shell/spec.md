# Spec Delta

## MODIFIED Requirements

### Requirement: Single shared chrome

Every page SHALL use the same chrome: title bar with the page title and a close box (labeled `Home`, omitted on the dashboard); menu strip with the left cluster of brand mark plus product name from `pkg/settings.json` (default `kody-os`) followed immediately by Home and Apps links, then menu-app links, with built-in Help and About appended when enabled (no Refresh link); main content; footer with status text, the active auth path (`via kody`, `via cookie`, or `locked`), and no home navigation; `data-pak-config` carrying the current phase; and a right-aligned date and time (server-rendered UTC on each navigation; a client tick SHALL keep it live in the browser's local time zone where JavaScript runs). The titlebar close box SHALL be the titlebar's way home; the dashboard at `GET /` SHALL omit it (it already is home) and every other page SHALL show it. The document title SHALL read `{page} · {title}` where `{title}` is the theme title when set, else the theme name. Body background and header mark SHALL likewise render from the theme file with current values as defaults. The shell SHALL lock to the viewport height: the page itself never scrolls; the `main` content region is the single scroll region on every page (Home, Apps, app pages, Help, locked/404), with menubar, titlebar, and statusbar always visible.

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with plain "Not found." text and no home link in the body; the titlebar close box is the way back.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps, menu-app links, Help, About left to right (Help/About omitted when disabled) with no Refresh link, and shows a date + time on the far right.

#### Scenario: Defaults preserve current rendering
- **WHEN** no theme file is present
- **THEN** title, brand, and background are byte-identical to the pre-change shell.

#### Scenario: Footer names the auth path
- **WHEN** any page is fetched
- **THEN** the footer states which path authenticated the request (`via kody`, `via cookie`, or `locked`).

#### Scenario: Close returns to the opener
- **WHEN** an app opened from the Apps page is closed via the titlebar box
- **THEN** the browser lands on the Apps page, not Home.

#### Scenario: Close from Home returns Home
- **WHEN** an app opened from a home widget is closed via the titlebar box
- **THEN** the browser lands on Home.

#### Scenario: Bad from falls back to Home
- **WHEN** an app page is opened with a missing or off-site `from` value
- **THEN** the close box links Home and no open redirect occurs.

#### Scenario: Chrome stays put while content scrolls
- **WHEN** a page taller than the viewport is rendered
- **THEN** menubar, titlebar, and statusbar remain visible and only the `main` region scrolls.

#### Scenario: Overlays unaffected
- **WHEN** a modal overlay opens
- **THEN** it behaves exactly as before (fixed position, independent scroll).
