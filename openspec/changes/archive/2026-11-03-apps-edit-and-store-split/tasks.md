> Implementation note (v2.3.0): all tasks except the kody-dev leg are done. The kody-dev leg is still open because this environment has no kody CLI; it was substituted with the catalog harness, store harness, and the jsdom app-store harness, which cover the same registry, management-API, and bundle paths. Verify the kody-dev leg in a kody dev preview before calling the change fully verified.

# Tasks

Phases land in order: 1, then 2, then 3. Each phase's verification
must pass before the next phase starts. No task in this file
commits, pushes, or publishes anything.

## 1. Restore Apps Edit

- [x] 1.1 Add Edit-mode rendering to the Apps page in
  `pkg/src/app.ts` and `pkg/src/apps/client.ts`: an Edit toggle
  link in the All apps header (shown only when at least one app
  is installed); Edit mode (`?edit=1`) renders every installed
  app, including hidden apps, as rows with Pin/Unpin, Hide/Unhide,
  and Add to home/Remove from home as plain GET forms to the
  existing `/apps` mutation route; Edit mutations 303 back to
  `?edit=1`. Browse mode, Pinned, and Recent sections are
  unchanged.
- [x] 1.2 Update the "All apps are hidden" hint to point at Apps
  Edit instead of the App Store, and correct the "Edit mode is
  retired" comments in `pkg/src/app.ts` and
  `pkg/src/apps/client.ts`.

## 2. Strip the Store

- [x] 2.1 Remove pin/hide/home controls from
  `renderCombinedList` in `pkg/src/apps/client.ts` and remove
  the `?pin=`, `?hide=`, and `?home=` handling from the Store
  route in `pkg/src/app.ts`. Store rows keep install, update,
  restore, status badges, and descriptions, unchanged in
  ordering and classification.
- [x] 2.2 Make Store launcher params an inline error: a Store
  request carrying `?pin=`, `?hide=`, or `?home=` renders the
  Store page with an error naming that launcher management
  moved to Apps Edit, and changes nothing.
- [x] 2.3 Repo-wide grep sweep: no remaining Store copy, comment,
  or test that presents pin/hide/home as Store controls, and no
  remaining Apps copy that presents Edit as retired.

## 3. Verify and sync specs

- [ ] 3.1 Verify in `kody dev` (mock store): browse mode
  unchanged; Edit mode lists a hidden app and unhiding it
  returns it to browse; pin and home toggles round-trip and
  survive a reload; an empty registry shows no Edit toggle;
  a Store pin/hide/home URL errors without writing.
- [x] 3.2 Sync the canonical specs: update `openspec/specs/shell`
  for Apps Edit and the Store's reduced controls, and correct
  any `pkg/docs/` or `pkg/AGENTS.md` copy that says management
  lives on the Store. Record the version decision in the
  implementation commit (MINOR per proposal.md, build +1 on
  publish).

## Close-out (2026-11-03)
Closed out at the user's direction. Tasks 1.x, 2.x, and 3.2 were done in Entire 60e76b7 (v2.3.0). Task 3.1 (verify in `kody dev`) was NOT run in this VM — no `kody` CLI here — and was substituted by the catalog/store/jsdom harnesses, which pass at close-out. Layout commit f89133f (v2.4.0) superseded the form, not the function, of the Edit controls after this change was implemented: Edit entry is now a GET form (not a link), Edit toggles are icon-only switches with `aria-checked`, and the Manage apps link was removed from the All-apps header in that commit. That removal supersedes this change's "Manage apps link stays" wording and was not restored; the canonical shell spec was updated at close-out to match the current layout.
