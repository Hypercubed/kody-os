# Tasks

## 0. Open questions first

- [ ] 0.1 Ask the user design Open Questions
  1 (definition persistence), 2 (catalog
  shipping or add_app only), and 3 (button
  palette scope) before writing the
  definition. Question 1 changes the
  `stateSchema`; questions 2 and 3 do not
  change the engine, but they change what
  "done" means, so record the answers in
  the task notes and do not assume them.
- [ ] 0.2 Resolve design Open Question 5
  against the repo: verify the `word:`
  sugar form (`true: 1 ;` in
  `ff/lib/core/core.ff`) is an F♭m-layer
  form the engine must support, not a
  compiler-only form. If it is
  compiler-only, strike it from the spec
  and from the engine, and note the change.

## 1. Generate the single core file

- [ ] 1.1 Clone or fetch Hypercubed/f-flat-minor
  at the audited commit
  `aa537457239aa7c7046ed9de58c49eacac0862b6`
  (or a newer commit only if the user
  directs a re-audit; a newer commit
  invalidates the design.md audit numbers
  until they are re-checked). Record the
  commit, the generation command, and the
  working directory in the task notes.
- [ ] 1.2 Run the repo preprocessor once
  over `ff/lib/prelude.ffp` (Go:
  `go run ./go/cmd/preprocess --in
  ff/lib/prelude.ffp`, or the Deno / Bun /
  Node `bin/ff-preprocess.ts` equivalent;
  no `--prelude` / `-P` macro bootstrap).
  Confirm the output has no `.import` or
  `.load` line left, and re-check the audit
  numbers: 28 reachable files, ~25 KiB /
  ~916 lines, 252 distinct defined words.
- [ ] 1.3 Strip `.inline` (41) and `.unsafe`
  (4) tokens in a generation post-pass.
  Confirm no `.inline` / `.unsafe` token
  survives, and that stripping did not
  remove any other token (diff the token
  stream before and after; only those two
  token types may differ).
- [ ] 1.4 Store the generated core as a data
  string in the bundle (a `.js` file or an
  `index.html`-embedded string). It is
  data for the interpreter, never JS
  executed as code. The core file itself
  is a generated artifact: do not hand-edit
  it, and note in the task notes that
  regenerating from a different directory
  renames the mangled `__` words.

## 2. Engine

- [ ] 2.1 Author the engine in vanilla JS
  at or below the ES2019 ceiling
  (`pkg/docs/scribe-limitations.md`): no
  BigInt literals, no `?.` / `??` /
  `replaceAll` / `.at(` / template
  literals newer than ES2019, no post-ES2019
  APIs. Whitespace tokenizing, BigInt-only
  stack plus queue/return stack, the
  38-word system vocabulary (design.md,
  Research 2), user definitions (`:` /
  `;` and the `word:` form, per task 0.2),
  quotes `[]`, strings `'...` as
  characters, comments `/* */`, `.` dump,
  `putc` / `putn` to the output area,
  `clr`, `eval`, `depth`, `q<` / `q>`,
  `(` / `)` queue words, and `rand`
  (Math.random scaled to a BigInt range,
  documented as non-cryptographic).
- [ ] 2.2 Implement the error words as
  clear errors, not stubs: `getc`,
  `clock`, and `exit` report a plain error
  and leave the stack unchanged (design.md,
  Decision 5). Division by zero, unknown
  word, stack underflow, and unmatched
  `:` / `[` are errors on the same terms.
- [ ] 2.3 Implement line atomicity (design.md,
  Decision 7): evaluate a line against a
  copy of stack, queue, and definitions,
  buffer its output, and commit the copy
  and the buffered output only if the
  whole line succeeds. On error, report
  the error in place and leave stack,
  queue, definitions, and displayed output
  exactly as before the line.
- [ ] 2.4 Load the generated prelude at
  startup through the same engine path as
  a user line, so prelude words are
  available before the first user line,
  and a prelude load failure is reported
  as a startup error, not silently
  swallowed. A prelude word that fails to
  load must fail the build, not ship as a
  half-loaded library.

## 3. UI

- [ ] 3.1 Author the bundle page:
  `schemaVersion` 5, empty `stateSchema`,
  `actions: {}`, no `act()` calls, one
  text input line, one Run control, a
  stack display (top-first, with a depth
  count), an output area, and a history of
  past lines with their results (display
  capped so a long session cannot blow up
  the page; the cap value is an authoring
  choice recorded in the task notes).
- [ ] 3.2 Add the button palette (design.md,
  Decision 8, scope per task 0.1): buttons
  insert a word into the input line; they
  do not execute by themselves. Minimum
  48px tap targets, inlined CSS, system
  fonts, zero emojis, no flexbox `gap`,
  high-contrast black-on-white.
- [ ] 3.3 Render long results by wrapping
  (`overflow-wrap: break-word` or
  equivalent), never by the Calculator
  display's `nowrap` clipping. Verify with
  a 158-digit result (100 factorial) and
  with a deep stack: both must be fully
  readable by scrolling, not truncated.
- [ ] 3.4 Author the icon: a monochrome
  SVG mark per the icon rules in
  `pkg/.agents/skills/adding-an-app/SKILL.md` (no emoji,
  allowlisted elements only, ~2 KiB),
  and a one-line description crediting
  Hypercubed/f-flat-minor and stating the
  session-only limit (design.md, Decision
  6) in plain words.

## 4. Verification in Node

- [ ] 4.1 Run the engine in Node against
  the repo's expected outputs: the
  showcase cases (`6 7 dup * -` = `-43`,
  100 factorial = the exact 158-digit
  integer in design.md, Research 2),
  division/remainder sign cases (`-3 2 /`
  = `-1`, `-3 2 %` = `-1`), and the
  prelude's own testable words where the
  repo provides expected outputs. Record
  which repo cases were run; do not claim
  parity for cases that were not run.
- [ ] 4.2 Verify the scaled-integer math
  words specifically (atan, exp, log,
  primes, and friends) against the repo's
  expected outputs, not just against
  "looks plausible". Any divergence is
  filed in the task notes with the exact
  input, expected output, and actual
  output, and the task does not close
  until it is fixed or the scope is cut
  to core-only by user direction (design.md,
  Alternatives).
- [ ] 4.3 Verify line atomicity and the
  error words: an unknown word, a division
  by zero, a stack underflow, and a
  `getc` / `clock` / `exit` call each leave
  stack, queue, definitions, and displayed
  output unchanged, and each reports its
  error in place.
- [ ] 4.4 Run the ES2019 ceiling scan on
  the bundle script (zero hits for `?.` /
  `??` / `replaceAll` / `.at(` / BigInt
  literals / template literals if the
  bundle style forbids them), and confirm
  the bundle total is under the 256 KiB
  cap. Run the catalog harness and the
  Counter harness green if the app is
  being shipped in the catalog (Phase 2);
  for an add_app-only v1, run the
  definition validation path instead
  (`validateDefinition` equivalent) and
  record the result.

## 5. Verification on the Scribe

- [ ] 5.1 Install via `add_app` on the live
  store (definition as authored in tasks
  1-3; backup the live store first if any
  existing app would be touched, which
  this change does not do). Confirm
  `add_app` returns `{ ok: true, id:
  "f-flat-minor" }` and the app appears in
  `list_apps()` and on the Apps page, with
  no package republish.
- [ ] 5.2 The user runs the app on the
  Scribe: type a line, run a prelude word,
  define a word, evaluate 100 factorial,
  and check the button palette. Record
  the run's outcome (pass, or each failure
  with the exact input and symptom) in
  the task notes; a desktop-browser pass
  alone does not close this task.
- [ ] 5.3 Fix Scribe-only issues found in
  5.2 (input, tap targets, wrapping,
  refresh) and re-run until the Scribe run
  passes or the user directs a scope cut.
  Each fix round is 30-60 minutes of
  agent work plus one user run (design.md,
  Research 5).

## 6. Catalog shipping (Phase 2, optional)

Only on the user's explicit direction, and
only after Phase 1 (tasks 1-5) passes.

- [ ] 6.1 Write
  `pkg/catalog/f-flat-minor.bundle.json`
  from the verified v1 definition, with
  `catalogVersion` 1, and register it:
  one import line in
  `pkg/src/apps/catalog.ts`
  (alphabetical by id) plus one entry in
  `pkg/catalog/README.md`. Verify the
  catalog harness passes (validate +
  install in a blank store + empty initial
  state + directory / import match) with
  no other catalog file changed.
- [ ] 6.2 Apply the MINOR version bump in
  the same commit as the catalog files
  per `pkg/AGENTS.md` (BUILD +1 on publish;
  `pkg/AGENTS.md` + `pkg/README.md`
  headers updated in that commit).
- [ ] 6.3 Do not commit, push, or publish
  this change without the user's explicit
  direction for that step, and do not
  approve any Kody capability re-approval
  on the owner's behalf (none is expected
  for a data app, but the rule stands).

## 7. Change hygiene

- [ ] 7.1 Verify `openspec validate
  --changes` passes if the binary is
  available (otherwise check the change
  shape manually, as with other changes
  in this environment: proposal, design,
  tasks, and spec deltas present and
  internally consistent, all tasks
  unchecked).
- [ ] 7.2 Confirm no file outside
  `openspec/changes/f-flat-minor-calculator/`
  was changed by writing this change
  itself. The app, the catalog files, and
  any version bump are implementation
  work under tasks 1-6, not part of this
  change document.
