# app-registry

## MODIFIED Requirements

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

`resolveStore()` SHALL normalize a `list()` result that arrives
as a bare array of `{ key, value }` pairs (the shape the mock
handle returns: the whole namespace, prefix ignored) into the
documented envelope before any caller sees it: keep only entries
whose key starts with the requested prefix, sort by key, and
derive pagination from `pageSize` / `startAfter` exactly as
`createMemoryStore()` does (`estimatedBytes` over the returned
page, `truncated` / `nextStartAfter` from the filtered set). A
result that is already the documented envelope SHALL pass
through untouched. A result that is neither a bare array nor an
envelope SHALL reject with an error naming the shape, never
return an empty list.

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

#### Scenario: A bare-array list() result enumerates as the envelope

- **WHEN** `list({ prefix: 'kody-os.apps.def.' })` is called
  against a store whose handle returns a bare array holding keys
  under several prefixes, with a page size smaller than the
  filtered result
- **THEN** it returns only the requested prefix's keys, in key
  order, with `truncated: true` and a `nextStartAfter` that
  yields the remainder on the next call, and `estimatedBytes`
  covers only the returned page.

#### Scenario: A documented-envelope list() result passes through untouched

- **WHEN** `list()` is called against a store whose handle
  returns the documented envelope
- **THEN** the returned entries, order, `estimatedBytes`,
  `truncated`, `nextStartAfter`, and `pageSize` are exactly the
  handle's own values, with no re-filtering or re-sorting.

#### Scenario: An unrecognized list() result fails loudly

- **WHEN** `list()` returns neither a bare array nor an object
  with an `entries` array
- **THEN** enumeration rejects with an error naming the shape
  instead of reporting an empty install.

#### Scenario: The homepage lists installed apps from a bare-array store

- **WHEN** the install's definition keys are enumerated through
  a bare-array `list()` result
- **THEN** `list_apps()` returns every installed id and the
  homepage and Apps page list them, with no re-seed or reinstall.
