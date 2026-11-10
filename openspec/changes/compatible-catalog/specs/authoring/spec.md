# authoring — delta

## MODIFIED Requirements

### Requirement: A Store's catalog base tracks the latest commit

A Store SHALL declare its catalog base as the `main` branch URL,
not a fixed release tag, so the Store follows the latest catalog
and can discover its own updates. The `catalog` proxy entry's `url`
SHALL be the `main` branch catalog base
(`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`
for the shipped App Store). Changing the base URL is a definition
change and SHALL bump the Store's `catalogVersion` by 1 under the
existing rule. The agent path is unaffected: an agent supplies its
own base and may point at a specific tag for a stable snapshot.

**Amendment (compatible-catalog):** the declared base is the
*discovery* base. The Store discovers its own updates and reads
`catalog/releases.json` from `main`, but when a resolver plugin
is installed, the apps it lists and installs come from the
*resolved* snapshot, not from the declared base. The declared
base itself SHALL stay `main`; a Store pinned to a tag in its
own definition is still not the shipped form, for the reason
this requirement already states — it could never discover a
newer Store.

#### Scenario: Store base is the main branch
- **WHEN** the App Store's definition is read
- **THEN** its `catalog` proxy entry url is the `main` branch
  catalog base.

#### Scenario: Resolved snapshot is not the declared base
- **WHEN** a resolver plugin is installed and resolves snapshot
  `v4.1.9`
- **THEN** the Store lists from the `v4.1.9` snapshot's base
  while its declared `catalog` proxy entry remains the `main`
  branch base.

## ADDED Requirements

### Requirement: Recipes declare plugin dependencies; plugin install is agent-assisted

An app whose install requires a shell feature SHALL declare
that requirement in its `RECIPE.md`, and the recipe SHALL
instruct the agent to install the named plugin first — copy
the plugin source into the user's package, register it,
check it, publish the user's package — and only then install
the app. The Store SHALL NOT one-click install a plugin, and
SHALL NOT auto-install one. A recipe-only app that requires a
plugin SHALL show its recipe prompt in place of Add, as for
any recipe-only app, and the prompt SHALL name the plugin
install step before the app install step. The adding-an-app
skill SHALL document this rule.

#### Scenario: Recipe names the plugin install first
- **WHEN** an app's recipe requires a plugin
- **THEN** the recipe instructs the agent to install the
  named plugin first, and only then install the app.

#### Scenario: Store never one-click installs a plugin
- **WHEN** the Store lists an app that requires a plugin
  the shell does not have installed
- **THEN** it offers no one-click plugin install, and a
  recipe-only app shows its recipe prompt in place of Add.

### Requirement: Maintainer tagging and releases-index procedure

A catalog snapshot SHALL be a git tag. The maintainer SHALL
cut a tag for every catalog snapshot, including catalog-only
snapshots (see design Open Question 3 for the tag-naming
decision this procedure records at implementation). The
procedure SHALL be: regenerate the catalog index and the
releases index, run the harness, commit, cut the tag,
re-run the generator (now it sees the new tag), commit the
updated `releases.json`, push to `main`; `git fetch --tags`
before running the generator; tags SHALL NOT be moved after
cutting. `catalog/releases.json` SHALL be generated, never
hand-edited, and the harness SHALL fail on a stale copy
(see app-registry, Releases index). A GitHub Release may
be created from a tag afterwards for human notes; nothing
in the Store or the resolver reads it.

#### Scenario: Catalog-only snapshot gets a tag
- **WHEN** a new app version is pushed to `main` with no
  shell-code change
- **THEN** the maintainer cuts a tag for that snapshot and
  the releases index lists it, before the snapshot is
  discoverable as a compatible catalog.
