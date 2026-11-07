# Proposal

## Why

The shell header clock (upper right) and the Clock app sometimes disagree by one minute. The header ticks every second in local time, so it flips to the new minute immediately. The Clock app ticks every 60 seconds, but anchored to the moment its script loaded — not to the wall-clock minute boundary. After a minute boundary passes, the Clock app keeps showing the previous minute until its next 60-second tick fires, up to ~59 seconds later (~30 seconds on average, about half the time). It always lags, never leads. Both show hour:minute only and both are local time once JavaScript runs, so this is a timer-phase mismatch, not a timezone or precision problem.

## What changes

- The Clock app aligns its tick to the wall-clock minute boundary: a timeout to the next boundary, then a 60-second interval. It keeps the battery-friendly 60-second cadence (no per-second re-render) while flipping exactly at each minute boundary, matching the header.
- The Clock app's catalogVersion bumps 4 → 5 (its bundle changes).
- A new canonical spec is created for the Clock app (`openspec/specs/clock-app/spec.md`), carrying the display format and the minute-boundary tick as requirements.

## What does not change

- The display format: 12-hour local time with AM/PM and the date line, hour:minute only, no seconds.
- The header clock: it already ticks every second in local time and is the reference. No header change in this spec.
- The server-rendered UTC header text on navigation (documented in the shell spec: the server has no user locale, so it renders UTC and the client replaces it immediately with local time). That brief flash is documented behavior and is not changed by this spec.

## Impact

- A fresh install is unaffected (Clock is not seeded; it is installed on demand).
- The Clock app's catalogVersion 4 → 5; the package version decision is deferred to publish.
- No other app changes; the 60-second cadence is preserved, so there is no new battery cost on e-ink.

## Open questions

None. The mechanism (timeout to the next boundary, then a 60-second interval) is settled; the header is the reference and is unchanged.
