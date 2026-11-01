# Spec Delta

## NEW Requirements

### Requirement: Exact BigInt stack arithmetic

The engine SHALL keep every stack and queue
value as a BigInt, and SHALL NEVER use a JS
Number for a stack value. Division SHALL
truncate toward zero and remainder SHALL keep
the dividend's sign, matching JS BigInt and
the f-flat-minor semantics. No BigInt literal
syntax SHALL appear in bundle code.

#### Scenario: Showcase arithmetic
- **WHEN** the user runs `6 7 dup * -`
- **THEN** the stack holds exactly `-43`.

#### Scenario: Exact large factorial
- **WHEN** the user runs the prelude word
  for factorial on `100` (or the equivalent
  direct computation)
- **THEN** the result is the exact 158-digit
  integer given in design.md, Research 2,
  with no rounding, no floating-point
  approximation, and no truncation.

#### Scenario: Division and remainder signs
- **WHEN** the user runs `-3 2 /`
- **THEN** the result is `-1`, and when the
  user runs `-3 2 %`
- **THEN** the result is `-1`, in both cases
  truncating toward zero, not flooring.

### Requirement: Core vocabulary

The engine SHALL support the 38-word system
vocabulary from `_shared/core-vocabulary.json`:
`nop`, `eval`, `putc`, `getc`, `putn`,
`clock`, `drop`, `q<`, `q>`, `<<`, `>>`,
`.`, `clr`, `rand`, `exit`, `dup`, `depth`,
`swap`, `%`, `&`, `(`, `)`, `*`, `+`,
`cons` (also `,`), `-`, `/`, `:`, `;`, `<`,
`=`, `>`, `?`, `[`, `]`, `^`, `|`, `~`,
with the stack effects given in that file.
`rand` SHALL return a BigInt in `[0, n)`,
implemented via `Math.random` scaled to a
BigInt range and documented as
non-cryptographic.

#### Scenario: Stack manipulation
- **WHEN** the user runs `1 2 dup swap drop`
- **THEN** the stack holds the values the
  core vocabulary's stack effects predict
  for those words, in order.

#### Scenario: Queue and return stack
- **WHEN** the user runs words using `q<`
  and `q>` (including through prelude words
  built on them, such as `slip`)
- **THEN** values move between the main
  stack and the return stack as the
  vocabulary specifies, and the main stack
  is restored as specified.

#### Scenario: Dump and clear
- **WHEN** the user runs `.`
- **THEN** the whole stack is printed to the
  output area, and when the user runs `clr`
- **THEN** the stack is empty and the depth
  count reads zero.

### Requirement: Definitions, quotations, strings, comments

The engine SHALL support user definitions
(`:` / `;` and the `word:` sugar form,
subject to design Open Question 5),
quotations (`[` / `]`), strings (`'...`
as characters), and comments (`/* */`),
tokenizing by splitting on whitespace, as
in the F♭m layer. A definition SHALL be
usable in later lines of the same session.

#### Scenario: Define and use a word
- **WHEN** the user runs `: square dup * ;`
  and then `7 square`
- **THEN** the stack holds `49`.

#### Scenario: Quotation and eval
- **WHEN** the user runs a quotation and
  then `eval` on it
- **THEN** the quotation's contents execute
  against the stack as the vocabulary
  specifies.

#### Scenario: Comment and string
- **WHEN** a line contains a `/* */` comment
- **THEN** the comment is ignored, and when
  a line contains a single-char string
  such as `'a'`
- **THEN** it pushes that character's code,
  matching the prelude's single-char string
  convention.

### Requirement: Prelude from a single generated core file

The app SHALL load the full f-flat-minor
prelude (252 distinct defined words,
design.md, Research 3) at startup, from a
single core text generated once by the repo
preprocessor over `ff/lib/prelude.ffp`,
with `.inline` and `.unsafe` tokens stripped
at generation time. The app SHALL NOT resolve
`.import` or `.load` at runtime, SHALL NOT
expand macros at runtime, and SHALL NOT
contain the unreached `tap` or `testing`
libraries. The interpreter SHALL skip any
remaining dot-token other than `.` itself.

#### Scenario: Prelude available on first line
- **WHEN** the app opens and the user runs
  a prelude word (for example `over` or a
  math word) before defining anything
- **THEN** it executes as the prelude
  defines it, with no import step by the
  user.

#### Scenario: No runtime import
- **WHEN** the user types a line containing
  `.import` or `.load`
- **THEN** the app does not fetch, resolve,
  or execute any file, and reports that
  runtime imports are not available.

#### Scenario: Prelude load failure is visible
- **WHEN** the generated core fails to load
  at startup
- **THEN** the app reports a startup error
  instead of opening with a half-loaded
  library.

### Requirement: Unsupported system words report errors

`getc`, `clock`, and `exit` SHALL NOT be
stubbed with fake values. Calling one SHALL
report a plain error naming the limitation
and SHALL leave the stack unchanged (see
also the line-atomicity requirement).

#### Scenario: getc, clock, exit
- **WHEN** the user runs `getc`, or `clock`,
  or `exit`, with a known stack
- **THEN** the app reports the error in
  place and the stack is byte-identical to
  before the line.

### Requirement: REPL lines are atomic

A REPL line SHALL be evaluated against a copy
of the stack, queue, and definitions, with
output buffered, and the copy and buffered
output SHALL commit only if the whole line
succeeds. On any error, the app SHALL report
the error in place and leave stack, queue,
definitions, and displayed output exactly as
before the line.

#### Scenario: Failed line leaves no trace
- **WHEN** the user runs a line that
  partially succeeds and then hits an
  unknown word, a stack underflow, or a
  division by zero
- **THEN** the stack, queue, definitions,
  and displayed output are exactly as
  before the line, and the error is shown
  in place.

#### Scenario: Successful line commits
- **WHEN** the user runs a line that
  succeeds
- **THEN** its stack, queue, definition,
  and output effects are all visible
  afterwards, in order.

### Requirement: REPL user interface

The app SHALL present one text input line,
one Run control, a stack display (top-first,
with a depth count), an output area, and a
history of past lines with their results.
A button palette SHALL insert words into the
input line and SHALL NOT execute by itself.
Long results SHALL wrap and be fully
readable by scrolling, never clipped by a
nowrap display. The bundle SHALL follow the
Scribe rules: ES2019 and earlier, vanilla
JS, inlined CSS, system fonts, zero emojis,
48px minimum tap targets, no flexbox `gap`.

#### Scenario: 158-digit result is readable
- **WHEN** the user evaluates 100 factorial
- **THEN** all 158 digits are readable by
  scrolling, with none clipped or truncated
  by the display.

#### Scenario: Palette is an input aid
- **WHEN** the user taps a palette button
- **THEN** the word appears in the input
  line and nothing executes until the user
  runs the line.

#### Scenario: History shows past lines
- **WHEN** the user runs several lines
- **THEN** each past line and its result
  remain visible in the history, up to the
  display cap recorded in the task notes.

### Requirement: Session-only, separate from Calculator

The app SHALL be a separate app with id
`f-flat-minor`, and SHALL NOT modify the
Calculator app in any way. Its stack,
queue, definitions, history, and output
SHALL live in the page session only; closing
the app or reloading SHALL lose user
definitions, and the app description SHALL
state that limit in plain words. The
definition SHALL carry `schemaVersion` 5,
an empty `stateSchema`, and `actions: {}`,
and SHALL make no `act()` call, no fetch,
and no functional use of `localStorage`.
The bundle total SHALL be under the 256 KiB
cap.

#### Scenario: Calculator untouched
- **WHEN** the f-flat-minor app is installed
  and used
- **THEN** the Calculator app's definition,
  state, and behavior are unchanged.

#### Scenario: Reload loses definitions
- **WHEN** the user defines a word, reloads
  the app, and then runs that word
- **THEN** it is reported as unknown, because
  the session ended with the reload, and
  the description has already stated this
  limit.

#### Scenario: Definition contract
- **WHEN** `add_app` receives the
  f-flat-minor definition
- **THEN** it returns `{ ok: true, id:
  "f-flat-minor" }` with no package
  republish, and the app appears in
  `list_apps()` and on the Apps page.
