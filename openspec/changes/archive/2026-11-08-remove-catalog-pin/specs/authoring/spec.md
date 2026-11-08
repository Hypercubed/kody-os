# authoring Specification Delta

## ADDED Requirements

### Requirement: A Store declares its catalog source

A Store app SHALL declare its catalog source in its own definition
as a `capabilities.proxy` entry named `catalog` whose `url` is the
catalog base URL (the directory containing `catalog.json`). The
shell SHALL fetch that Store's catalog only from the declared base.
A different Store SHALL declare a different base to read a different
catalog. The `catalog` proxy entry is a declaration of the base; the
shell's catalog fetch derives the manifest, definition, bundle, and
recipe URLs under it. Adding or changing the `catalog` entry is a
definition change and SHALL bump the Store's `catalogVersion` by 1
under the existing rule.

#### Scenario: Store declares its catalog base
- **WHEN** the App Store's definition carries a `proxy` entry named
  `catalog` with url
  `https://raw.githubusercontent.com/Hypercubed/kody-os/v4.1.0/catalog/`
- **THEN** the Store's catalog is fetched from under that base.

#### Scenario: Different Store, different catalog
- **WHEN** a second Store declares a `proxy` entry named `catalog`
  with a different base URL
- **THEN** that Store's catalog is fetched from its own base, and
  the first Store's catalog is unaffected.

#### Scenario: No catalog entry means no catalog
- **WHEN** a Store's definition declares no `proxy` entry named
  `catalog`
- **THEN** that Store shows installed apps only, never a blank Store.
