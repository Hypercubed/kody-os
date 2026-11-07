# Tasks

Phases land in order: 1, then 2, then 3.
Phase 4 is a decision, Phase 5 is a later
consideration; neither starts until Phase 3
is passing. No task in this file commits,
pushes, or publishes anything, and no task
bumps the package version; catalog changes
in Phase 2 increment each touched bundle's
own `catalogVersion` by exactly 1, in the
implementation commit, per the catalog rules.

## 1. Folder, spec, validation

- [ ] 1.1 Create `pkg/icons/` with a
  `README.md` carrying the file spec from
  design.md Decision 3 in full: one file per
  icon, kebab-case names, `viewBox="0 0 24 24"`,
  no `width` / `height` attributes,
  `fill="none"` line art (default-black solids
  only where meant), `stroke="currentColor"`,
  stroke width 1.6, round caps and joins, a
  `<title>`, and nothing else — no color, no
  gradients, no animation, no `style`, no
  script, no external refs, no `<use>`.
  The README also states what the folder is
  not: not served, not fetched at render time,
  not a sprite sheet, not the package mark
  (`pkg/icon.svg`) or favicon.
- [ ] 1.2 Write the folder validation: every
  file in `pkg/icons/` passes the existing
  tile-icon sanitizer allowlist (elements
  `svg, path, circle, rect, line, polyline,
  polygon, g, title`; geometry plus
  monochrome fill / stroke only) and the
  file spec (viewBox, no fixed size, one
  stroke width, caps / joins, title present).
  Decide the harness home in this task —
  the catalog harness is the natural home —
  and record it here; a file that fails
  validation fails the harness.
- [ ] 1.3 Record the naming rule from
  design.md Decision 2 in the README
  (app-id names for single-app tile icons,
  function names for genuinely shared icons,
  no renames on gaining a second use, a
  README note instead) and the glyph rule
  (the 7 glyph icons are out of scope for
  this change; see Phase 2).

## 2. Migrate and normalize the 11 SVG tile icons

- [ ] 2.1 Copy, verbatim first, the icon
  strings of the 11 SVG catalog apps into
  `pkg/icons/<app-id>.svg`: calculator,
  calculator, calendar, clock, counter, daily-feed,
  eight-ball, hoodie-weather, link-drop, mac-puzzle,
  news, probe. Verify each copy renders
  identically to its catalog string before
  any normalization, so a later visual
  difference can be blamed on the right step.
- [ ] 2.2 Normalize each file to the spec:
  stroke width to 1.6 (from 1.8 on
  calculator, counter, mac-puzzle; from 1.7
  on link-drop, probe), round caps and joins where
  missing, `<title>` where missing. Check
  each normalized icon visually at tile size
  (1.5rem) and at e-ink resolution; any icon
  that goes faint keeps its width with a
  note in the README (design.md Risks),
  rather than a silent exception. (Kept Nov 6, 2026: the visual check names the specific unknown — per-icon faintness at tile size on e-ink — with a named fallback of keeping the width.)
- [ ] 2.3 Write the normalized strings back
  into their catalog bundles, incrementing
  each touched bundle's `catalogVersion` by
  exactly 1 and no other bundle's, and run
  the catalog harness (validate + install
  in a blank store + empty initial state +
  directory / import match). Glyph-icon
  bundles are untouched in this phase.
- [ ] 2.4 Update `pkg/catalog/README.md`
  where it describes tile icons, pointing at
  `pkg/icons/` as the source, without
  changing any app's description or
  category.

## 3. Sync check and authoring guidance

- [ ] 3.1 Add the sync check: the harness
  fails when a migrated catalog icon string
  differs from its `pkg/icons/` file, after
  whitespace normalization for JSON escaping
  and file formatting. The check covers
  exactly the 11 migrated icons; glyph icons
  and unmigrated icons are not checked, so
  a future icon is checked only once it is
  migrated — the migration, not the check,
  is what opts an icon in.
- [ ] 3.2 Update the adding-an-app skill
  (`.agents/skills/adding-an-app/SKILL.md`)
  with one short section: a new tile icon
  starts in `pkg/icons/`, follows the folder
  spec, and is added to a bundle from the
  folder file, not drawn fresh in JSON.
  Keep the section short; the folder README
  is the spec, not the skill.
- [ ] 3.3 Run the full harness set for the
  areas changed and record the results; a
  failing harness is a real signal and is
  not waved through as pre-existing without
  a clean-checkout check naming the failing
  check.

## 4. Sharing mechanism (decision, not code yet)

- [ ] 4.1 Decide, on evidence from Phases
  1–3, whether the sync check is enough or
  a generation step (folder files writing
  catalog icon strings) is wanted. The
  default is: the check is enough, and
  generation is not added. If drift is
  observed after the check exists, record
  it here with examples before deciding
  otherwise; a check that never fails is
  evidence generation is not needed.
- [ ] 4.2 Only if 4.1 decides for generation:
  specify it as a follow-on change (which
  files are generated, how the diff is
  reviewed, what happens to a hand-edited
  bundle string). Do not implement it in
  this change.

## 5. In-app shared icons (later consideration)

- [ ] 5.1 Only after Phases 1–3 are settled:
  survey bundles for icons genuinely reused
  across bundles (the title-bar close glyph
  from `systemcss-title-bars` is the first
  candidate) and decide per icon whether it
  belongs in `pkg/icons/` as a function-named
  file, shared at authoring time. QR codes
  and generated digit glyphs are app content
  and are not candidates; record that
  exclusion here so it is not re-litigated.
- [ ] 5.2 Only if 5.1 finds candidates: add
  them to the folder and the README, with
  the same spec and validation, and note
  how an author copies one into a bundle
  or the theme. No runtime fetching, no
  bundle-contract change.
