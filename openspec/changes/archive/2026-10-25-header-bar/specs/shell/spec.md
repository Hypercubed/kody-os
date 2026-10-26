## MODIFIED Requirements

### Requirement: Single shared chrome

Every page SHALL use the same chrome: left cluster of brand mark plus product name followed immediately by Home, Apps, and Help links (no Refresh link); main content; footer with back-to-home navigation; `data-pak-config` carrying the current phase; and a right-aligned date and time (server-rendered UTC on each navigation; a client tick SHALL keep it live in the browser's local time zone where JavaScript runs).

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with a back-to-home link.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps, Help left to right with no Refresh link, and shows a date + time on the far right.
