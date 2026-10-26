## Why

The header bar carries a redundant Refresh link, has no Help entry point, and wastes its right side — while users have no in-OS reference for what the OS is or how agents extend it. One cleanup fixes all three.

## What Changes

- Header left cluster becomes icon + name followed immediately by Home, Apps, Help. The Refresh link is removed (every navigation already re-renders fresh).
- A new static Help page (same chrome) explains the OS, lists installed apps, and documents how agents add apps via MCP. Linked from the header.
- Far right of the bar shows server-rendered date + time, updating on each navigation. A JS tick enhances it on capable browsers only.
- No logout control: nothing exists to log out of until the scribe-auth code gate lands; revisited then.
- BREAKING: none. Removed Refresh has no dependents; Help is additive.

## Capabilities

### New Capabilities

- `help-page`: a static Help page in full shell chrome (what the OS is, installed apps, how agents add apps).

### Modified Capabilities

- `shell`: header bar layout (left nav cluster Home/Apps/Help, no Refresh, right-aligned server-rendered date + time with optional JS tick).

## Impact

- `pkg/src/app.ts` (header markup, Help route, request-time clock), `pkg/public/styles.css` + `src/shell-css.ts` regen (right-aligned clock slot, Help page styles).
- `pkg/src/client/index.ts` (optional tick enhancement only).
- No MCP, storage, or export changes. No migration.
