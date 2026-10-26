# Spec Delta

## Purpose

Establish the pattern for kody-os apps that display and snapshot another package's live data through a declared static dependency.

## ADDED Requirements

### Requirement: Render-time external reads with isolated failure
An external-data app SHALL read the depended package's exports during page render and degrade to an honest inline error when the dependency is unreachable, without affecting the shell or other apps.

#### Scenario: Board renders live queue
- **WHEN** the handoff-board page is fetched with handoff reachable
- **THEN** the page shows the current task list (title, status, agent) from `listTasks`.

#### Scenario: Outage degrades honestly
- **WHEN** the handoff-board page is fetched with handoff unreachable
- **THEN** the page renders an inline error in place of the listing and every other app renders normally.

### Requirement: Snapshot through standard actions
The board SHALL persist listings only through the standard `set`/`append` action effects into its own state schema; external reads SHALL never write state directly.

#### Scenario: Refresh snapshots the queue
- **WHEN** the Refresh action runs
- **THEN** the fetched listing is stored as ordinary state, exportable and re-importable like any app state.

#### Scenario: Snapshot survives outage
- **WHEN** handoff is unreachable after a snapshot
- **THEN** the board shows the last snapshot with its taken-at marker plus the inline error for the live section.
