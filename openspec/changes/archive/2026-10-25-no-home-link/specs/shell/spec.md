## MODIFIED Requirements

### Requirement: Single shared chrome

Every page SHALL use the same chrome: left cluster of brand mark plus product name followed immediately by Home, Apps, and Help links (no Refresh link); main content; footer with status text and no home navigation; `data-pak-config` carrying the current phase; and a right-aligned date and time (server-rendered UTC on each navigation; a client tick SHALL keep it live in the browser's local time zone where JavaScript runs). The titlebar close box (labeled `Home`) SHALL be the single way home. The dashboard at `GET /` SHALL omit the close box (it already is home); every other page SHALL show it.

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with plain "Not found." text and no home link; the titlebar close box is the way back.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps, Help left to right with no Refresh link, and shows a date + time on the far right.
