# authoring Specification Delta

## Purpose

Catalog definitions may declare the minimum shell version they need;
the rule lives in app-registry.

## ADDED Requirements

### Requirement: Catalog definitions may declare a minimum shell version

A catalog definition MAY carry `minPackageVersion` (see
app-registry, App definition may declare a minimum shell version):
an optional `MAJOR.MINOR.PATCH` string declaring the minimum
kody-os package (shell) version the app requires. Absent means no
minimum. Adding or changing it is a definition change and requires
a `catalogVersion` +1 by the existing rule. The adding-an-app skill
SHALL document the field and its rule.

#### Scenario: Catalog app declares a minimum
- **WHEN** a catalog definition carries a valid `minPackageVersion`
- **THEN** it validates, and the shell refuses to install it on a shell older than that minimum (see app-registry, Install refuses an app the shell is too old for).
