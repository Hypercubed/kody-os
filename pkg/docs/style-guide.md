# kody-os style guide

Style guide v1.0 — 27 October 2026, for `@hypercubed/kody-os`.
Package location: `docs/style-guide.md`, linked from
`.agents/skills/adding-an-app/SKILL.md`.

Status: in the package. The shell theme (see section 5) styles
standard bundle controls with no class needed: a bare `<button>`,
`<input>`, `<select>`, or `<textarea>` inside a bundle gets the shared
look. The `os-*` class names remain only for variants
(`.os-btn--dark`, `.os-display`, `.os-keypad` / `.os-key`) and for
genuinely unique controls; a bundle never copies or redefines
their definitions. This guide is
written so that a human or an agent building a new app can
follow it without having to re-derive the look from
screenshots, and so that existing apps stay consistent with
each other.

## 1. What this guide is for

kody-os already has a look: classic Mac chrome (a pinstriped
title bar, a centred title in a bordered box, 1px black
borders, a hard bottom-right shadow) crossed with ReKindle
minimalism (strictly monochrome, high contrast, large tap
targets, text first, no gradients, no animations). The problem
it does not yet solve is drift.

`.agents/skills/adding-an-app/SKILL.md` tells a bundle author the hard
constraints — ES2019 only, system fonts, no emojis, inline
CSS/JS only, no external stylesheets or scripts, no per-app
frameworks, no timers, WebSockets, polling, or animations —
but on its own it names no tokens and no reusable classes.
Without shared classes, every bundle invents its own button,
display, and panel. A full UI check on 26 October 2026 found
exactly that drift:

- Apps tiles and Probe buttons have hard shadows; Puzzle
  tiles and Calculator buttons are flat; Eight Ball's Shake
  is a pill; Puzzle's New Game has no shadow.
- Body text is often as bold as headings, so hierarchy
  goes flat. On Help, the "ADDING APPS" subheading is
  smaller than the bold body text under it.
- Disabled states are grey text with no other cue, and
  are hard to read on white.
- The same Calculator keypad looks roomy on its own page
  and compressed as a Home widget.
- Probe's first three Result cells render inverted
  (white on black) while the rest are black on white,
  with no apparent reason — a state cue with no meaning.

This guide fixes the cause, not just the symptoms: one set
of tokens, one set of class names defined once in the shell
theme, and a rule that restyling a standard component from
scratch is a review flag, not a local preference.

## 2. Design goal, in one paragraph

An app should look like a desk accessory for the original
Macintosh, rendered for a Kindle Scribe: 1-bit black and
white, with grey only as a dotted/halftone pattern, never
as a wash of colour. The shell owns the chrome. The bundle
owns only what is inside its panel. If a reader cannot tell
whether a button is enabled, selected, or just text, the
bundle has failed, however pretty it is.

Chrome only, not a window manager: kody-os is a single
centred window per page, not draggable, resizable desktop
windows. Do not add window controls, grow boxes, or a
desktop metaphor inside a bundle. The shell's title bar,
menu bar, window frame, and footer are not yours to
recreate.

## 3. Principles

1. **One bit, plus dots.** Black `#000` and white `#fff`
   only, plus a fine dotted pattern (black dots on white)
   where a grey area is needed. No colour, no gradients,
   no shadows with blur, no translucency.
2. **State must be visible without colour.** Enabled,
   disabled, selected, and active are shown by inversion,
   by the presence or absence of the hard shadow, and by
   stripes — never by colour alone, and never by a subtle
   shade change alone.
3. **Hierarchy by size and weight, not by bolding
   everything.** Headings are bold. Body text is regular.
   If everything is bold, nothing is a heading.
4. **Touch first, Scribe second.** Every tappable
   element is at least 48px tall and 48px wide. Text that
   must be read is at least 14px, body text 16px.
5. **The shell is the chrome; the bundle is the
   content.** Do not add a second menu bar, title bar,
   window frame, footer, or back control inside a bundle.
   Use the shell's navigation.
6. **Use the bare defaults; classes only for variants.** Standard
buttons and fields, displays, panels, section headers, lists, and
keypads get their look from the shell theme (section 5) with no
class on the element; a variant (an inverted button, a readout, a
keypad) uses its `os-*` class. A bundle must not copy those
definitions into its own `<style>`, must not restyle them, and must
not add a second button, display, or panel style. Bundle-only
   CSS is reserved for what is genuinely unique to that
   app — a Puzzle grid, an Eight Ball circle, SVG digits
   traced from a source screenshot — and it is named
   with the app's own prefix so it cannot be mistaken
   for a shared class.
7. **Enhance, never require.** Content must be readable
   without JavaScript. JavaScript may enhance it (a
   slide, a calculation, a shuffle), but must never be
   the only way to see the content. This is the same
   posture as `.agents/skills/adding-an-app/SKILL.md`; this guide does
   not relax it.

## 4. Tokens

Tokens are CSS custom properties on `:root`, defined once
in the shell theme (`public/styles.css`, inlined into
every page as `src/shell-css.ts`). The shared classes in
section 5 use them with `var()`. `--os-paper` maps to the
shell's existing `--paper` token so the two can never
drift apart; the remaining shell tokens (`--desk`,
`--shade`, `--rule`, `--lift`) belong to shell chrome
only and are not bundle tokens. A bundle must not
redefine any `--os-*` variable.

| Token | Value | Use |
| --- | --- | --- |
| `--os-ink` | `#000` | Text, borders, shadows, inverted backgrounds |
| `--os-paper` | `var(--paper)` (`#fff`) | Panel and button backgrounds, inverted text |
| `--os-grey` | `#888` | Disabled borders and text only, never as a background wash |
| `--os-border` | `1px solid #000` | Every panel, button, tile, and display edge |
| `--os-shadow` | `2px 2px 0 #000` | Hard offset shadow, no blur, on windows, tiles, and buttons |
| `--os-radius` | `4px` | Fields and small controls; bundle buttons, panels, and windows use `0` |
| `--os-font` | `"Chicago", "Geneva", Helvetica, Arial, sans-serif` | All text, unless a source screenshot dictates otherwise |
| `--os-font-mono` | `"Courier New", Courier, monospace` | Code, prompts, and diagnostic text only |
| `--os-text-sm` | `14px` | Captions, counts, footers |
| `--os-text` | `16px` | Body text |
| `--os-text-lg` | `20px` | Button labels, keypad labels |
| `--os-display` | `28px` | Readouts (Calculator display) |
| `--os-tap` | `48px` | Minimum height and width of any tappable element |
| `--os-gap` | `6px` | Keypad and grid gaps |
| `--os-pad` | `16px` | Standard panel padding |
| `--os-dots` | `radial-gradient(#000 1px, transparent 1.4px)` | Dotted/halftone areas: Calculator keypad panel, Puzzle empty square. Used with `background-size: 4px 4px` in `.os-dots`. Not a page background. |

Type scale, stated as a rule: page and app titles are
the shell's. Inside a bundle, a section heading is
14px, bold, all caps, letter-spaced (see
`.os-section-title`). A subheading is 18px bold. Body
text is 16px regular. A caption or count is 14px
regular. A button label is 18–20px regular, never bold
— bold button text is part of the flat-hierarchy drift
this guide is trying to end.

## 5. Classes

The shared look below is defined once, in the shell theme. A
standard bundle control needs no class: a bare `<button>` inside a
bundle is square and otherwise looks like `.os-btn`, and a bare field looks like
the field rule in the theme. The class names below are for
variants and unique controls only. Do not copy the definitions
into a bundle, and do not restyle them per app. The definitions are shown here as reference, so an
author knows exactly what a class does without opening
the theme file.

```css
/* Defined by the shell theme (public/styles.css) — do not copy. */
.os-panel {
  background: var(--os-paper);
  color: var(--os-ink);
  border: var(--os-border);
  padding: var(--os-pad);
}
.os-section-title {
  background: var(--os-ink);
  color: var(--os-paper);
  font-size: var(--os-text-sm);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 8px 12px;
  margin: 0;
}
.os-btn {
  min-height: var(--os-tap);
  min-width: var(--os-tap);
  font-family: var(--os-font);
  font-size: var(--os-text-lg);
  font-weight: normal;
  background: var(--os-paper);
  color: var(--os-ink);
  border: var(--os-border);
  border-radius: var(--os-radius);
  box-shadow: var(--os-shadow);
  padding: 0 16px;
}
.os-btn--dark {
  background: var(--os-ink);
  color: var(--os-paper);
}
.os-btn:disabled,
.os-btn--disabled {
  color: var(--os-grey);
  border-color: var(--os-grey);
  box-shadow: none;
}
.os-btn:active {
  background: var(--os-ink);
  color: var(--os-paper);
  box-shadow: none;
  transform: none;
}
.os-btn:hover {
  background: var(--os-paper);
}
.os-btn--dark:hover {
  background: var(--os-ink);
}
.os-display {
  font-size: var(--os-display);
  text-align: right;
  background: var(--os-paper);
  color: var(--os-ink);
  border: var(--os-border);
  padding: 8px 12px;
  min-height: var(--os-tap);
  box-sizing: border-box;
  overflow: hidden;
  white-space: nowrap;
}
.os-keypad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--os-gap);
}
.os-key {
  min-height: var(--os-tap);
  font-family: var(--os-font);
  font-size: var(--os-text-lg);
  font-weight: normal;
  background: var(--os-paper);
  color: var(--os-ink);
  border: var(--os-border);
  border-radius: var(--os-radius);
  box-shadow: var(--os-shadow);
  padding: 0;
}
.os-key:hover {
  background: var(--os-paper);
}
.os-key:active {
  transform: none;
}
.os-key--wide { grid-column: span 2; }
.os-key--tall { grid-row: span 2; }
.os-list { list-style: none; margin: 0; padding: 0; }
.os-row {
  min-height: var(--os-tap);
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: var(--os-text);
  border-bottom: var(--os-border);
}
.os-row--selected { background: var(--os-ink); color: var(--os-paper); }
.os-row--disabled { color: var(--os-grey); }
.os-muted { color: var(--os-grey); font-size: var(--os-text-sm); }
.os-dots {
  background-color: var(--os-paper);
  background-image: var(--os-dots);
  background-size: 4px 4px;
}
```

Notes on the classes:

- **Buttons.** One button style, and it needs no class. A bare
  `<button>` inside a bundle is square and otherwise looks like `.os-btn`; a primary
action adds `.os-btn--dark` (inverted). Eight Ball's Shake keeps
its pill shape as a variant (border-radius and padding only, on
top of the default). Puzzle's New Game, Daily Feed's
Previous/Next, and Probe's action buttons are bare; their
differences are labels and placement, not shape.
- **Pressed state.** `:active` inverts the button and
  removes the shadow, with no shift (`transform: none`).
  No transition, no animation — both are out of scope
  for the Scribe posture. The `transform: none` and
  `:hover` rules exist because the shell's generic
  `button` rules are bold, shift on press, and shade on
  hover; the shared classes pin those off so a shared
  button behaves the same in every bundle.
- **Disabled state.** A disabled button loses its
  shadow and goes grey (`#888` border and text). Grey
  alone is not enough on e-ink, so the shadow removal
  is the primary cue, and disabled controls must never
  be the only way to understand a page (see section 6).
- **Display.** `.os-display` is for readouts only
  (Calculator). It is right-aligned, white,
  bordered, and never used as a heading. Clock's time
  is centred and borderless by design and does not use
  it; its readout keeps its own layout class.
- **Keypad.** `.os-keypad` is a 4-column grid.
  `.os-key--wide` spans two columns (Calculator's 0),
  `.os-key--tall` spans two rows (Calculator's +).
  Keypad symbols follow the source material: the
  original Mac Calculator uses `*` and `/`, not `×`
  and `÷`. Do not modernise glyphs. `.os-key` sets
  its font stack and regular weight explicitly,
  because the shell's generic `button` rule is bold.
  No widget variant exists: the grid uses `1fr`
  columns and no fixed widths, so the same keypad
  narrows its columns in a widget and keeps its
  48px key height on a page.
- **Lists and rows.** `.os-row--selected` inverts the
  row. `.os-row--disabled` greys it. Do not invent a
  third selected style (a stripe, an outline, a dot)
  for one app.
- **Dotted areas.** `.os-dots` is for small patterned
  areas only — a keypad panel, an empty Puzzle square.
  It is not a page or window background; the shell's
  page background is flat light grey.

Minimal example — a button and a display, nothing else
invented:

```html
<div class="os-panel">
  <p class="os-display">0</p>
  <button type="button">New Game</button>
</div>
```

## 6. State, without colour

This is the one area where a 1-bit interface has to
work harder than a colour one, and it is borrowed,
adapted, from the CodeFronts "Classic Mac System 7
Window Chrome" theme (MIT licensed; see section 9).
What is taken from it is the *pattern*, not the code:
active vs. inactive, selected vs. unselected, and
disabled are all shown by inversion, stripes, or
shadow removal.

| State | Visual rule | Example |
| --- | --- | --- |
| Active page / active window | Menu item or title bar is inverted or striped; inactive equivalents are plain, with empty boxes | Shell menu: the current page's link is inverted (black background, white text). Other links are plain. |
| Selected | Row or control inverts: black background, white text | A selected list row (`.os-row--selected`), a primary button (`.os-btn--dark`) |
| Disabled | No shadow, grey border and text | A disabled Previous/Next button, a greyed Up/Down control. The control must also be labelled or positioned so its disabledness is not the only information — e.g. Daily Brief's "3 of 3" next to a disabled Next. |
| Pressed | Inverts and loses its shadow for the duration of the press | Any `.os-btn` on `:active` |
| Error / diagnostic | Plain text, never colour alone. A diagnostic table must not invert cells without meaning | Probe's Result cells must all use the same black-on-white rendering; an inverted cell must mean "selected", not "first three rows". |

Rules that follow from the table:

- Never use grey text alone as the disabled cue.
- Never invert a cell, row, or button for decoration.
- Never leave a disabled control unexplained. If a
  reader cannot tell *why* it is disabled from the
  page (a count, a label, a position), add that
  explanation as text.
- The shell footer ("PRIVATE OS SHELL / via kody ·
  v0.1.4 b3") is debug text, not user-facing copy.
  It should not be used as a model for bundle text,
  and it is a known item to clean up in the shell,
  not in bundles.

## 7. Page, widget, and app patterns

- **Page vs. widget.** The same bundle markup must
  work at page width and at widget width. Use relative
  widths (`1fr` grid columns, `max-width` rather than
  fixed width) and never set a fixed height that leaves
  a blank lower half when content is short — that is
  the Clock widget's former fault. Test both
  placements before calling an app done; the Home
  widget is not a shrunken screenshot of the page.
  The shared keypad needs no widget variant: its
  `1fr` columns narrow with the container.
- **Apps list.** Tiles are the shell's, not the
  bundle's. A bundle supplies only a monochrome icon
  (plain-text glyph or sanitized inline SVG, per
  `.agents/skills/adding-an-app/SKILL.md`) and a label. Tile order
  must be explainable: Recent in recency order, All
  Apps in a stated order (alphabetical is the
  default), Pinned as chosen. Do not leave two lists
  in different, unexplained orders.
- **Reading pages (Daily Brief).** One title, once.
  Do not repeat the digest title in a pagination
  header and again as the article heading. Source
  links must be distinguishable from each other
  (numbered, or labelled with the source name), not
  eight identical centred "Source" links. Long
  reading pages get subheadings or a short contents
  list, not a single unbroken scroll.
- **Help pages.** One topic per box, headings larger
  than body text, body text regular (not bold).
  A prompt the page tells the reader to copy gets a
  copy control and a real link for any guide
  reference — plain text that looks like a reference
  but is not a link is a bug. (The shell Help page
  has no copy control: the Scribe browser exposes
  no clipboard API for one to use, so the prompt
  stays selectable text.)
- **Diagnostic pages (Probe).** Diagnostic text is
  allowed to look diagnostic, but it must still
  follow the state rules: one rendering for all
  Result cells, one name for the app everywhere
  ("Probe" on the tile and "Probe" on the page).
- **Apps with no instructions.** A page that is only
  a grid and a button (Puzzle) must carry one
  short instruction line on the page itself — what
  the goal is, and what a move does. The shell's
  Help page is not a substitute for an instruction
  the reader needs while looking at the app.
- **Legends for cryptic labels.** A button whose
  label is a single letter must be explained on the
  page if its meaning is not obvious. Calculator's
  C and E are the example: C clears all, E clears
  the last entry. A one-line legend under the
  keypad is cheaper than a reader guessing.

## 8. How to use this guide

For a new app:

1. Use the classes in section 5. Do not copy their
   definitions into the bundle, and do not redefine
   them.
2. Add bundle-only CSS only for what is unique to
   that app, and name those classes with the app's
   own prefix so they cannot be mistaken for shared
   classes.
3. Check the page against section 6 (every state
   has a visible, meaningful cue) and section 7
   (page and widget placements, instructions, legends).
4. Do not restyle a standard component to match a
   screenshot if the screenshot's style conflicts
   with this guide, unless the screenshot *is* the
   app (as with Calculator's original layout, where
   the layout is the point). Note the deviation in
   the app's description.

Migration, completed 27 October 2026 (most visible
drift first):

1. Probe: one Result-cell rendering; one app name
   everywhere ("Probe"); action buttons to `.os-btn`.
2. Calculator: keys to `.os-key` / `.os-key--wide` /
   `.os-key--tall`; a C/E legend; display to
   `.os-display`; dotted keypad panel to `.os-dots`.
3. Puzzle: New Game to `.os-btn`; one instruction
   line; SVG digits and dotted empty square kept
   (bundle-unique, not drift).
4. Eight Ball: Shake to `.os-btn` (not a pill).
5. Daily Brief and xkcd: Previous/Next and Refresh
   to `.os-btn`; reader body styles kept
   (bundle-unique).
6. Clock: widget padding fixed (no blank lower
   half); no new features. Clock keeps its centred,
   borderless readout and does not use `.os-display`.
7. Help (shell-rendered, not a bundle): Help-only
   heading and body rules in the shell theme;
   no copy control, for the clipboard reason in
   section 7.

Shared CSS is the end state: the shell theme is the
single source of truth for the shared classes. If a
shared class changes, every bundle using it changes
together; there is no per-app pinning and no copied
fallback to drift from. A future version of this
guide may add a dark/inverted theme, but only as an
explicit shell theme — bundles must not invent their
own dark mode, and the current guide deliberately
has none.

## 9. Sources and attribution

- `.agents/skills/adding-an-app/SKILL.md` in `@hypercubed/kody-os`:
  the definition contract, bundle contract, tile-icon
  rules, and Scribe posture this guide builds on.
  Where the two disagree, the adding-an-app skill wins on
  contract (schema, bundle size, operators) and this
  guide wins on visual style.
- CodeFronts, "Classic Mac System 7 Window Chrome",
  https://codefronts.com/design-styles/css-retro-designs/classic-mac-system-7-window-chrome/
  (MIT licensed). Used as a reference for the
  1-bit state patterns in section 6 only — active
  vs. inactive title bars, inverted selection, and
  greyed disabled rows. No code is copied verbatim:
  class names are renamed to `os-*`, the 44px hit
  target is raised to 48px, the dark-mode toggle,
  `:has()` selectors, `oklch()` colours, conic
  gradients, and blue focus accent are dropped as
  incompatible with the Scribe posture, and the
  window/menubar/grow-box machinery is left out
  because kody-os is not a draggable-window desktop.
- UI evidence: full shell UI check, 26 October 2026
  (Home, Apps, Help, Clock, Probe, Eight Ball,
  Daily Brief, Puzzle, Calculator; shell v0.1.4 b3).
  Findings from that check are the migration list
  in section 8.
- Original Macintosh Calculator and Puzzle screenshots
  supplied by the user, 26 October 2026: the source
  for Calculator's layout (C, E, =, * on top; tall +;
  wide 0; `*` and `/` glyphs) and Puzzle's SVG digits
  and dotted empty square.
