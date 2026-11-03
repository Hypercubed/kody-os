# Design: public-pinned-catalog

## Context

See proposal.md (Why). Today the catalog is an
import list in `pkg/src/apps/catalog.ts` over
`pkg/catalog/*.bundle.json`, and `list_catalog()`
returns summaries in import-list order while
`get_catalog_definition(id)` returns the full
definition or null. Install snapshots record the
install-time `catalogVersion` plus a content-only
fingerprint of the canonical stored definition,
and Store status (up to date, behind-clean,
behind-modified, modified-current, and so on) is
computed by comparing the installed definition
and snapshot against the catalog definition.
After `catalog-out-of-pkg`, the manifest at
`catalog/index.json` carries the same per-app
fields plus bundle path and fingerprint. The
feed proxy in `pkg/src/feeds.ts` is the existing
server-side fetch pattern: HTTPS only, timeout,
size cap, storage caching, stale-on-error.

## Goals / Non-Goals

- Goals: a Store that reads a pinned public
  release with no Kody publish per app; a fork
  override for the pin; honest failure behavior;
  unchanged snapshot and status rules.
- Non-goals: tracking `main` HEAD (rejected
  below); third-party catalog submissions;
  catalog search, ratings, or reviews; signing
  or verifying bundles beyond the pin (see
  Decision 3); automatic catalog updates (the
  Store never auto-updates installed apps).

## Decisions

1. **Pin to a release, not to `main`.** The
   default catalog source is a named release of
   the public repo (tag plus, if the
   implementation chooses it, the release's
   commit SHA — see Decision 3). `main` HEAD is
   rejected as the default: it would make every
   repo commit immediately live in every Store,
   with no review gate and no rollback point.
   A fork owner who wants `main` tracking can
   set their pin to a branch, explicitly, and
   the Store's release display will show that
   choice — the spec does not forbid it, it
   only refuses it as the default.
2. **Fetch is server-side, through the management
   API path.** The Store bundle never fetches
   GitHub directly: it calls the management API,
   and the shell fetches the manifest and bundles
   from the pinned release. This keeps the
   Scribe browser out of GitHub's CORS and
   redirect behavior, reuses the feed proxy's
   timeout/size discipline, and keeps the
   device gate in front of the catalog fetch.
   Bundle fetches use the manifest's bundle
   path joined to the pinned release base — the
   bundle path is never taken from a bundle or
   from a request parameter.
3. **The pin's strength is tag, with SHA as an
   option.** A release tag is the human-facing
   pin and is what the Store displays. Tags are
   movable in git, so the implementation MAY
   additionally pin the release's commit SHA and
   fetch by SHA, in which case the displayed
   release is tag-plus-SHA and a moved tag does
   not change what the Store reads. The spec
   requires the tag display either way, and
   forbids a pin that is only a mutable branch
   name as the default (Decision 1).
4. **The pin is one constant, overridable by a
   fork.** The default pin (upstream repo and
   release) lives in one place in the shell
   source, named as the catalog source, so a
   fork owner changes it in one edit and the
   Store reads their catalog instead. No per-app
   pins, no user-facing pin editor in this
   change: changing the catalog source is a
   fork-owner decision, not a per-install
   setting, because a per-install pin would let
   any installed app point the Store at an
   arbitrary catalog.
5. **Failure degrades to installed apps plus an
   error.** If the manifest fetch fails (network,
   GitHub down, bad release), the Store shows
   installed apps with their known status plus
   an honest error that the catalog could not
   be refreshed, and offers a retry. It never
   shows a blank Store, and it never silently
   presents a stale catalog as current: if a
   cached manifest is used, it is labeled as
   cached, with its release, so the user can
   tell it is not fresh. Whether a cache is kept
   at all, and its TTL, is an implementation
   detail within that labeling rule; the
   16 MiB durable budget argues against caching
   every bundle, so bundles are fetched on
   demand for install/update, not prefetched.
6. **Release cutting is a named procedure, not
   automation in this change.** Cutting a
   catalog release means: regenerate the
   manifest, run the catalog harness, commit,
   tag the release, and publish it. The spec
   requires that procedure to be documented
   (in the catalog README and in
   `bootstrap-after-fork`'s author-facing
   notes), but it does not require release
   automation in this change; automation is a
   follow-up if release cutting becomes frequent
   enough to hurt.

## Open Questions

- Tag vs tag-plus-SHA (Decision 3) is left to
  implementation, with the display requirement
  above. Either satisfies the pin; SHA is
  strictly stronger against a moved tag.
- The exact fetch base URL shape (raw GitHub
  vs a CDN mirror) is left to implementation,
  with the constraint that it must serve a
  pinned release, not just a branch, and must
  be unauthenticated for a public repo.
- The canonical upstream repo URL and release
  naming scheme are not invented here: they
  are filled in at implementation time from
  the actual public repo, once it exists.
