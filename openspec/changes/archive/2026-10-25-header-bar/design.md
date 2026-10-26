# Design: header-bar

## Context

See proposal.md (Why). Header is `os-menubar` in `shellChrome()` (`pkg/src/app.ts`): brand + nav (Home, Apps, Refresh). No Help route exists; footer is `os-statusbar`. Constraints: ES2019, inline single `<style>`, no flexbox gap, zero JS baseline.

## Goals / Non-Goals

- Goals: left-cluster nav, Help page, server clock right-aligned.
- Non-goals: logout (waits on scribe-auth), ticking clock on Scribe, theming the bar beyond existing tokens.

## Decisions

1. **Help as a static route in `app.ts`, not an app.**
   *Why*: it documents the shell itself, needs no storage, no actions, no registry entry. A data app would add registry/export surface for static text.
2. **Server-rendered UTC timestamp formatted host-side, plain text in the bar.**
   *Why*: works with zero JS on Scribe and updates every navigation. JS tick (guarded, `setInterval` only if available) is progressive enhancement, same pattern as form enhancement.
3. **Remove Refresh outright, don't hide it.**
   *Why*: every navigation re-renders server-side; the link has no function. Deleting beats hiding (no dead code on e-ink).

## Risks / Trade-offs

- [Risk] Clock staleness between navigations on Scribe → Mitigation: accepted; Scribe timers are broken anyway, and any navigation refreshes it.
- [Risk] Help content drifts from features → Mitigation: Help renders the live installed-apps list dynamically; only the prose is static.

## Migration Plan

None: header markup changes render identically elsewhere. Rollback is a republish of the prior commit.

## Open Questions

None.
