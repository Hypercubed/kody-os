# Spec Delta

## MODIFIED Requirements

### Requirement: Bundle manifest shape

An installed app that is not a catalog definition SHALL carry no
`catalogVersion` requirement and SHALL NOT appear in the Store
list (see app-registry); `catalogVersion` SHALL be required only for catalog
definitions.

#### Scenario: Storage-only app has no Store row and no version requirement

- **WHEN** an installed app has no catalog entry
- **THEN** it has no row in the Store list and no `catalogVersion` is required of it.
