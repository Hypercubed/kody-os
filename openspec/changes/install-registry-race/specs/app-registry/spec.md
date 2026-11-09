# app-registry

## ADDED Requirements

### Requirement: Installed apps are derived from definition keys

The installed list SHALL be derived, not stored: `list_apps()` and
every other installed-enumeration SHALL obtain installed ids by
paginating `list({ prefix: 'kody-os.apps.def.' })` and taking the id
suffix of each key, in key order (alphabetical by id). No shared
registry list SHALL be read or written: `kody-os.apps.registry`
SHALL be left in place, unread and unwritten, when present. A
definition whose key exists SHALL be installed, whether or not any
registry entry ever named it. Pagination SHALL run to completion
(`truncated` / `nextStartAfter`) and SHALL never assume one page
holds every app.

#### Scenario: Concurrent installs for different apps both land

- **WHEN** two installs for different ids run concurrently, with
  no Store serialization and no re-read/verify loop in `add_app`
- **THEN** both apps appear in `list_apps()` afterwards, with
  definitions and state intact.

#### Scenario: An orphaned definition is installed

- **WHEN** a definition and state exist but no registry entry
  names the id
- **THEN** the app appears in `list_apps()` and on the Apps page
  with no repair step, and its Store row shows it installed with
  its correct update status.

#### Scenario: The Apps list is alphabetical by id

- **WHEN** the derived list is rendered
- **THEN** apps appear in alphabetical-by-id order, not install
  order, matching the Store's catalog-only list order.

#### Scenario: Pagination covers the whole install

- **WHEN** the install holds more apps than one `list()` page
- **THEN** enumeration returns every installed app.

### Requirement: `KeyStore` lists keys by prefix

`KeyStore` SHALL expose `list(options: { prefix: string;
pageSize?: number; startAfter?: string })`, resolving to
`{ entries: [{ key, value }], estimatedBytes, truncated,
nextStartAfter, pageSize }` with `pageSize` defaulting to 250 and
capped at 1000, entries in key order. The hosted
`packageStorage()` handle SHALL back it directly; the memory
store and the mock store SHALL implement the same shape over
their keys. A store without `list()` SHALL fail loudly with an
error naming the store, never silently return an empty list.

#### Scenario: Prefix filtering and paging

- **WHEN** `list()` is called with a prefix over keys under two
  prefixes, with a page size smaller than the result
- **THEN** it returns only the requested prefix's keys, in key
  order, with `truncated: true` and a `nextStartAfter` that
  yields the remainder on the next call.

#### Scenario: A store without `list()` fails loudly

- **WHEN** installed enumeration runs against a store with no
  `list()` method
- **THEN** it throws an error naming the store instead of
  reporting an empty install.

### Requirement: `add_app` and `remove_app` write per-id keys only

`add_app` SHALL write only the definition key and the state key
for its own id (plus the install snapshot on a Store install,
which is itself a per-id key). It SHALL NOT read or write any
shared registry list. The state-preservation rule is unchanged.
`remove_app` SHALL decide "unknown app" from the definition key,
then delete the definition, state, and snapshot keys and scrub
the pinned / hidden / recent / homepage references, and SHALL
NOT read or write any shared registry list. Two concurrent
writers for the same id SHALL resolve to the last `set` for that
one key, with no cross-app loss and no orphan.

#### Scenario: A single install writes only its own keys

- **WHEN** one app is installed
- **THEN** exactly its definition and state keys are written
  (plus the snapshot on a Store install), it appears in
  `list_apps()`, and no shared key is touched.

#### Scenario: Re-adding preserves state

- **WHEN** an installed app is re-added
- **THEN** its state is preserved for fields still declared,
  exactly as before.

#### Scenario: Removing an app deletes only its keys

- **WHEN** an installed app is removed
- **THEN** its definition, state, and snapshot keys are deleted
  and its pinned / hidden / recent / homepage references are
  scrubbed, and no other app's keys change.

#### Scenario: Removing an unknown app writes nothing

- **WHEN** `remove_app` is called with an id that has no
  definition key
- **THEN** it returns `{ ok: false }` with a naming error and
  writes nothing.

### Requirement: Retired apps are filtered at read time

Retired ids (`help`, `about`) SHALL be filtered out of the
derived installed list at read time, and their definition and
state keys SHALL be deleted. No registry read or rewrite SHALL
take part in retiring an app.

#### Scenario: A retired definition is not listed

- **WHEN** the store contains retired `help` / `about`
  definitions
- **THEN** they do not appear in `list_apps()`, and their
  definition and state keys are deleted.
