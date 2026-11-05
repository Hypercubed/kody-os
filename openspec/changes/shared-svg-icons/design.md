# Design: shared-svg-icons

## Context

See proposal.md (Why). The starting point is
two facts that are already true and that this
change does not redo:

- The archived `2026-10-27-svg-icons` change
  already widened `icon` from a plain-text
  glyph to "plain-text glyph OR sanitized
  inline SVG", with validation-time
  sanitization (allowlist: `svg, path, circle,
  rect, line, polyline, polygon, g, title`;
  geometry plus monochrome fill / stroke
  attributes only; `script, foreignObject,
  use, image, style`, `on*` handlers, external
  refs, and animations rejected) and tile
  rendering (sanitized SVG unescaped inside
  `.tile-icon`, fixed 1.5rem box, strokes in
  `currentColor`, no CSS fill rule — CSS fill
  would override each shape's own fill
  attribute and turn line art into solid
  dots).
- The current catalog, counted Nov 3, 2026:
  10 SVG tile icons (about, calculator,
  calendar, clock, counter, eight-ball,
  hoodie-weather, mac-puzzle, news, probe)
  and 6 glyph icons (app-store ⊞, arrow-game
  →, cellular-playground ▦, help ?, 
  three-bit-art ◼, xkcd X). SVG stroke widths
  today: 1.6 on six icons, 1.8 on three,
  1.7 on one (probe). Tile rendering is in
  `pkg/public/styles.css` (`.tile .tile-icon`,
  `.tile .tile-icon svg`) and is unchanged
  by this change.

## Goals / Non-Goals

- Goals: one file per shared icon, one spec,
  one check, so a new tile icon is copied
  from a file and a changed icon is changed
  in one place; a catalog string that differs
  from its folder file is a failing check,
  not a silent drift; the folder works for
  an agent writing a new app with no other
  context than the folder README.
- Non-goals: a runtime icon registry, a new
  `icon` field shape, converting glyph icons,
  in-bundle shared icons, external libraries,
  or any change to tile rendering, validation
  sanitization, or the package mark
  (`pkg/icon.svg`) and favicon.

## Decisions

1. **Location is `pkg/icons/`, not
   `pkg/public/` and not `pkg/catalog/`.**
   The package must be self-contained:
   everything an agent needs to use it belongs
   in `pkg`. `pkg/public/` is shell assets
   that are served (favicon, screenshots,
   `styles.css` as the theme source); an icon
   source file placed there would invite
   fetching it as an external asset, which
   the Scribe posture forbids (inline CSS /
   JS only, no external stylesheets or
   scripts, and by the same logic no external
   icon files at render time). `pkg/catalog/`
   is bundles, one file per app; icons are
   not apps. `pkg/icons/` is authoring
   source only: it is read when a bundle is
   authored or checked, never fetched by the
   shell at render time. That is also why
   the folder does not, by itself, change
   what a live install shows: live
   definitions carry their own icon strings
   in stored state, and a publish changes
   code, not stored state.
2. **One file per icon, named for its use.**
   A tile icon file is named after its app
   id (`clock.svg`, `probe.svg`) while it
   belongs to one app; a genuinely shared
   in-app icon (the title-bar close glyph
   from the companion `systemcss-title-bars`
   change, if it ends up as SVG) is named
   for its function (`close.svg`, not
   `clock-close.svg`). A file that gains a
   second use keeps its name and gains a
   note in the folder README; it is not
   renamed, because catalog strings and
   docs may already point at it. Kebab-case
   file names, one icon per file, no sprite
   sheets: a sprite would need a `<use>`
   reference, and `use` is on the sanitizer's
   reject list.
3. **The file spec is the existing tile
   rendering, written down.** Each file:
   `viewBox="0 0 24 24"`, no `width` or
   `height` attributes (tile CSS sizes the
   SVG to 1.5rem; a fixed size in the file
   would fight it), `fill="none"` on line
   art and default-black fills only where a
   solid part is meant, `stroke="currentColor"`,
   stroke width 1.6 (the majority today; the
   three 1.8 and one 1.7 icons normalize
   down to it in Phase 2, with a visual
   check that none of them goes faint),
   `stroke-linecap="round"` and
   `stroke-linejoin="round"` throughout
   (the icons that lack them today gain
   them; eight-ball's circles are unaffected
   by caps / joins and keep their geometry),
   a `<title>` naming the icon, and nothing
   else: no color, no gradients, no
   animation, no `style`, no script, no
   external refs. The spec lives in
   `pkg/icons/README.md`, in the folder,
   not only in this change, because the
   folder is where the next author looks.
   The sanitizer's allowlist is unchanged
   and is the backstop: a file that fails
   it cannot become a tile icon anyway.
4. **Sync check first, generation later
   (maybe never).** Two ways to keep folder
   and bundles together: (a) a harness check
   that fails when a migrated catalog icon
   string differs from its folder file
   (whitespace-normalized, since JSON
   escaping and file formatting differ), or
   (b) a generation step that writes catalog
   icon strings from the folder files.
   Generation is stronger but it makes the
   bundle files generated artifacts, which
   the catalog rules do not currently treat
   them as (a bundle is one hand-authored
   file plus import plus README entry), and
   it hides the diff an author should see
   when an icon changes. Phase 3 therefore
   ships the check, not generation, and
   Phase 4 decides — on evidence of drift
   after the check exists — whether
   generation is still wanted. A check that
   never fails is not a reason to add
   generation; it is evidence it is not
   needed.
5. **Glyph icons stay glyphs in this change.**
   The 6 glyphs are a deliberate precedent
   (help "?" and xkcd "X" set it in the
   catalog), and a glyph renders in the
   Scribe's font where an SVG renders as
   line art — they are not the same look,
   and converting one is a per-icon design
   decision (does a ▦ or a ◼ gain anything
   as line art?), not a mechanical step.
   Phase 2 migrates only the 10 SVGs. A
   glyph that is later drawn as SVG gets a
   folder file and a catalog change in its
   own right, with its own `catalogVersion`
   +1, and the glyph is retired only then.
6. **In-app icons are a later phase, not a
   smuggled scope.** The folder's first job
   is tile icons, which are the proven
   duplication (10 copies, one spec missing).
   In-bundle icons are mostly app content
   (About's three QR codes are different
   data sharing a renderer; Puzzle's digit
   glyphs are generated in JS), and sharing
   them would mean a build step inside
   bundles, which the bundle contract does
   not have. Phase 5 considers in-app
   sharing only after tile icons are settled,
   and only for icons that are genuinely
   reused across bundles — the title-bar
   close glyph is the first candidate, and
   it is shared at authoring time (copied
   from the folder into the theme or the
   bundle), not fetched at runtime.

## Risks

- Normalizing stroke width from 1.8 / 1.7
  to 1.6 makes three icons slightly lighter.
  At e-ink resolution that can matter more
  than the number suggests, so Phase 2
  requires a visual check of each normalized
  icon, and any icon that goes faint keeps
  its width with a note in the README
  instead of a silent spec exception that
  nobody can find later.
- A folder with no enforcement rots in a
  month: the next icon gets pasted into a
  bundle and never lands in the folder.
  That is why the sync check is Phase 3,
  not a nice-to-have, and why the skill
  update is part of the same phase: the
  check catches drift, the skill prevents it.
- Naming is the long tail: an icon named
  after one app that later becomes shared
  (Decision 2) is a mild wart, and renaming
  it later breaks references. The README
  note is the cheaper fix, and it is the
  one this design chooses.
