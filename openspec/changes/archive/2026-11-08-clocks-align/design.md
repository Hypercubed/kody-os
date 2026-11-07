# Design: clocks-align

## Decisions

1. **Minute-boundary alignment, 60-second cadence kept.** The Clock app replaces its load-anchored `setInterval(tick, 60000)` with a `setTimeout` to the next wall-clock minute boundary (computed from the current time to the next 60,000 ms boundary), followed by `setInterval(tick, 60000)`. The app still re-renders at most once per minute — the battery-friendly cadence for e-ink is preserved — but the flip now lands exactly on the boundary, matching the header clock.
2. **Display format unchanged.** The Clock app keeps showing 12-hour local time with an AM/PM suffix and the date line (weekday, month, day), hour:minute only, no seconds. The fix is timing only.
3. **Header is the reference, unchanged.** The shell header clock ticks every second in local time (`pkg/src/client/index.ts`, `setInterval(render, 1000)`) and is already correct. This change does not touch it. The server-rendered UTC header text on navigation is documented behavior in the shell spec (the server has no user locale) and is out of scope here.
4. **Version.** The Clock app's catalogVersion bumps 4 → 5 (its bundle `index.html` changes). The package version decision is deferred to publish, per the owner's standing rule.

## Open Questions

None.
