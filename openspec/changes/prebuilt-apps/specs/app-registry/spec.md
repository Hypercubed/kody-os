## ADDED Requirements

### Requirement: Fresh installs seed the bundled set

On first use against an empty registry, the registry SHALL install the package's bundled seed definitions before serving reads, so a fresh install opens with a working set and no republish. Seeding SHALL never run when the registry is non-empty (user removals are respected, never resurrected). The seed set is whatever validation apps ship in the package at publish time.

#### Scenario: Blank install opens populated
- **WHEN** a blank store is first read (home list, `list_apps`, or any entry point)
- **THEN** the bundled seed apps are installed exactly once and subsequent reads show them.

#### Scenario: Seeding never overwrites user state
- **WHEN** the registry already contains any app (including after the user removed a seeded app)
- **THEN** seeding does not run and the user's registry is untouched.
