# Design: f-flat-minor-calculator

## Context

See proposal.md (Why). The shape to copy is
the Calculator app: a stateless, page-local
bundle, all calculation in the page, no
`act()`, no server route. The new part is the
engine and the generated standard library, and
both are settled by research done on
2026-10-31, summarized below so this change
stands on its own without the working notes.

## Research

### 1. Scribe platform: BigInt proven, Wasm not

- Engine: Chromium 80 on Android 9, proven
  by the on-device probe of 2026-10-25
  (`pkg/docs/scribe-limitations.md`). Ceiling:
  ES2019 and earlier for bundle scripts.
- BigInt: expected from the engine version
  (BigInt shipped enabled by default in
  V8 6.7 / Chrome 67), but unproven on the
  Scribe until 2026-10-31. A BigInt check
  was added to the live Probe app (schema
  version 5, bundle grown 20,364 to 23,111
  chars) and run on the Scribe the same day.
  Result, from the new manualnav summary
  (report 109 in
  `~/workspace/kody-ai-os/probe-state-bigint-wasm-run.json`,
  109 reports total, up from 70):
  `bigintExists=true`, `bigintType=yes`,
  `bigintPrecision=yes`, `bigintFact100=yes`,
  `bigintFact100Len=158`, `bigintDivTrunc=yes`,
  `bigintModSign=yes`, `bigintMixThrows=throws`,
  `bigintStringifyThrows=throws`.
  Individual row beacons were lossy again
  (only three BigInt beacons arrived); the
  manualnav snapshot is the authoritative
  evidence, not the beacons. Conclusion: a
  JS BigInt interpreter is unblocked.
- Wasm: a synchronous Wasm check was added
  to the same probe (bundle 24,745 chars):
  a tiny hand-built MVP module exporting
  `add(i32,i32)->i32`, via `new
  WebAssembly.Module` + `new
  WebAssembly.Instance`, verified in Node
  first (`validate` true, `add(40,2)=42`,
  `Memory({initial:1})` = 65,536 bytes).
  On the Scribe the same run gave
  `wasmExists=false`, `wasmValidate=n/a`,
  and the manualnav string truncated
  mid-encoding after that point. The
  remaining wasm rows are `n/a` by
  construction from the probe's else branch,
  not separately observed, and no wasm row
  beacons arrived. Caveat: `wasmExists` is a
  composite check (WebAssembly + Module +
  Instance + validate all present), so the
  run does not pinpoint which component is
  missing. Conclusion: Wasm is NOT a usable
  whole on the Scribe and is NOT a fallback
  for this app. Post-MVP Wasm features were
  already out on Chromium 80 (e.g. SIMD
  needs Chrome 91+), and f-flat-minor's own
  Wasm implementation is listed incomplete,
  so nothing is lost by dropping Wasm.
- Design guard that made the probe safe:
  no BigInt literal (`…n`) syntax anywhere
  in the probe block, because a literal would
  break parsing of the whole bundle script
  on a non-BigInt engine. All values via
  guarded `BigInt()` calls. The same guard
  applies to this app's bundle: no BigInt
  literals in bundle code, so the bundle
  still parses on an engine without BigInt
  (it then reports BigInt as unavailable
  instead of failing to load at all).

### 2. f-flat-minor language semantics

Source: Hypercubed/f-flat-minor, repo page
and core vocabulary, read 2026-10-31.

- Tiny stack-oriented toy language, baby
  brother to f-flat. Minimal dependencies,
  parsing by splitting on whitespace, the
  stack consists of only big integers, and
  the same bytecode/output is expected across
  implementations.
- Example: `6 7 dup * -` evaluates to `-43`.
  Showcase: 100 factorial is an exact
  158-digit integer
  (`93326215443944152681699238856266700490715968264381621468592963895217599993229915608941463976156518286253697920827223758251185210916864000000000000000000000000`).
- `/` truncates toward zero and `%` is the
  matching remainder: `-3 2 /` = `-1`,
  `-3 2 %` = `-1`. This is JS BigInt
  division/remainder semantics, not floored
  division, and the engine must not "fix"
  it to Python-style flooring.
- Taxonomy used in discussion: F♭mo =
  minimal core; F♭m = core + sugar
  (definitions `:;` / `word:`, quotes `[]`,
  strings `'...`, comments `/* */`); F♭m+ =
  F♭m + preprocessor/compiler commands
  (`.load`, `.import`, `.m`, `.inline`,
  `.unsafe`). This app is F♭m: the middle
  layer, engine only, no F♭m+ at runtime.
- Core vocabulary (`_shared/core-vocabulary.json`,
  38 words): `nop`, `eval`, `putc`, `getc`,
  `putn`, `clock`, `drop`, `q<`, `q>`,
  `<<`, `>>`, `.`, `clr`, `rand`, `exit`,
  `dup`, `depth`, `swap`, `%`, `&`, `(`,
  `)`, `*`, `+`, `cons` (also `,`),
  `-`, `.` (dump), `/`, `:`, `;`, `<`,
  `=`, `>`, `?`, `[`, `]`, `^`, `|`, `~`.
  Stack effects are as in that file; the
  engine is verified against the repo's
  expected outputs, not against this summary.

### 3. Standard library audit

Source: Hypercubed/f-flat-minor, branch
`main`, commit
`aa537457239aa7c7046ed9de58c49eacac0862b6`,
read via the GitHub API 2026-10-31.
Working notes are in `~/MEMORY.md`
("F-flat-minor stdlib audit").

- Stdlib root is `ff/lib/`; entry is
  `ff/lib/prelude.ffp`, which is only 5
  `.import` lines (core, math, string, seq,
  time). The old single `core.ff` is now
  `ff/lib/core/core.ff`.
- Reachable from prelude: 28 files,
  26,436 chars raw; 25,154 chars / 916
  lines flattened with `.import` lines
  removed. Well under the bundle cap.
- `.import`: 59 occurrences, all at line
  start, all file-relative `./` or `../`;
  no `<...>` stdlib imports, no `.load`
  at all. Dedup (`.import`-once) is
  required: core is imported by 11 files.
- Macros: `.m` / `.ff` / `.ffp` commands:
  0 in the reachable set. No macro
  expansion is needed for the prelude.
- `.inline`: 41; `.unsafe`: 4 (in
  `ff/lib/math/exp.ffp` and
  `ff/lib/math/primes.ffp`). From
  `typescript/core/src/compiler.ts`, these
  set metadata on the previous definition
  (`meta.inline` / `meta.unsafe`), used by
  the optimizer/validator; `.unsafe` also
  waives the queue-borrow validation check.
  From `typescript/core/src/preprocess.ts`,
  the preprocessor handles line-start
  `.exit` / `.load` / `.import` / `.m` /
  `.ff` / `.ffp`, drops other line-start
  dot commands, resolves imports
  file-relative or via stdlib roots for
  `<...>`, dedups imports, and mangles
  imported lines. An interpreter that
  implements `q<` / `q>` correctly can
  safely ignore `.inline` / `.unsafe`.
- Simple concatenation is NOT safe: 16
  files use leading-`__` private words, and
  6 `__` words are defined in multiple
  files: `__u2_newp`, `__tail_loop`,
  `__parts`, `__finite`, `__n`, `__next`
  (e.g. `__tail_loop` / `__u2_newp` /
  `__parts` in both `atan-core.ffp` and
  `atanh-core.ffp`). The TS preprocessor
  mangles tokens starting with `__` or
  `[__` per imported file (prefix
  `__<normalized-path>_<fnv-hash>__`).
  Flattening must replicate that.
  Single-underscore words like
  `_atan__core_scaled` are intentionally
  shared across files and must NOT be
  mangled; mangling touches leading `__`
  only.
- Engine dependencies of the reachable
  stdlib: no `getc`, `clock`, or `exit`
  anywhere. `putc` is used in prn/char/str/
  utc; `putn` in prn/utc. `rand` is used
  only in `ff/lib/math/primes.ffp`
  (`__nrand`, Miller-Rabin). `eval`,
  `depth`, `clr` are used (core, seq, str).
  Strings are single-char only (e.g. `'a'`,
  `'0'`, `'-'`, `'T'`, `':'`, `'Z'`,
  `'\t'`).
- 252 distinct defined words in the
  flattened reachable set, including `__`
  privates.
- Not reached from prelude (exclude):
  `ff/lib/tap.ffp`, `ff/lib/testing.ffp`.
  `ff/lib/math/trig.ffp` is an empty
  placeholder comment only.
- Verdict: build-time flattening works and
  does not need the macro engine; it must
  do exactly three things: import
  resolution, dedup, and `__` mangling.

### 4. Single core file by running the preprocessor once

User direction, 2026-10-31: run the repo
preprocessor once to generate a single core
file, instead of writing a custom flatten
script. Confirmed against the repo the same
day: preprocessors exist in Go
(`go/cmd/preprocess`, `--in`), Deno, Bun,
and Node (`bin/ff-preprocess.ts` in each),
and Go and TS both implement `.import`
dedup and leading-`__` mangling, so using
the repo preprocessor avoids reimplementing
either. Commands (from the repo root):

- Go (simplest, no URL imports):
  `go run ./go/cmd/preprocess --in
  ff/lib/prelude.ffp > core-single.ff`
  (with the repo's `mise` toolchain, as the
  README says for Go commands).
- Deno / Bun / Node: the equivalent
  `bin/ff-preprocess.ts`, same input file.

Input is `ff/lib/prelude.ffp` directly; it
is already just the five imports, so no
wrapper file and no `<prelude>` stdlib-root
lookup are needed. No macro prelude is
needed for this run: the Deno/Bun
preprocessors have a `--prelude` / `-P`
flag to bootstrap the macro engine, but
the reachable stdlib uses no macros, so
it stays off.

Caveats, recorded not yet decided in full
(see Decisions 3 and 7): the generated file
still contains the `.inline` (41) /
`.unsafe` (4) tokens, because those are
compiler metadata, not preprocessor line
commands; and `__` prefixes hash the
resolved import path, so regenerating from
a different working directory renames the
private words (consistent within one
generated file, noisy in diffs). Pin the
generation command and directory if the
file is ever checked in.

### 5. Effort estimate (revised)

First estimate, 2026-10-31, was 13-20 hours
of active work, priced like a human
developer. The user corrected that: AI work
in this setup is faster, and the day's own
evidence supports it (the BigInt and Wasm
probe updates each landed in a single
session; three MVPs were built on Oct 31
in one day). Revised estimate for this
change, agent-active time, v1 only
(add_app, no catalog publish, no formal
spec beyond this change):

- Stdlib generation + verification: 1 hour
  or less (preprocessor run, strip, count,
  smoke test).
- Engine + UI: 1-2 hours in session (a few
  hundred lines of vanilla JS, REPL page in
  the existing kody-os pattern).
- Node testing against repo cases: 1-2
  hours, until a divergence appears.
- Scribe fix loop: 30-60 minutes per round,
  2-3 rounds expected, waiting on the user
  running it on the device.
- Total agent-active: roughly 3-6 hours.
  Calendar time is a day to a few days,
  dominated by Scribe runs and review, not
  by writing code.
- What moves it up: scaled-integer math
  words diverging from the TS version (each
  divergence roughly 30-60 minutes of
  investigation, not a day, but a handful
  add up), Scribe text input proving painful
  enough to redesign, saved user definitions,
  catalog publish, or a formal spec beyond
  this change. Core-only (dropping the
  heavier math/time/seq/string groups) would
  cut the test surface by roughly 40%.

## Goals / Non-Goals

- Goals: a separate, Scribe-usable, exact
  BigInt stack calculator with user
  definitions and the full prelude; a
  single generated core file, no runtime
  preprocessor; a REPL a Scribe user can
  actually type into and read results from,
  including 158-digit results.
- Non-goals: replacing Calculator; a full
  TS port; Wasm; runtime imports; server
  execution; persisted definitions in v1;
  catalog shipping in v1.

## Decisions

1. **Separate app, id `f-flat-minor`.**
   Calculator stays untouched. The new app's
   description credits
   Hypercubed/f-flat-minor, in the same
   one-line footer pattern the Oct 31 MVPs
   use for their source repos. The id is a
   valid slug (`^[a-z0-9][a-z0-9-]{0,63}$`)
   and does not collide with `calculator`.
2. **Engine only, F♭m, no F♭m+ at runtime.**
   Whitespace tokenizing, BigInt-only stack
   plus queue/return stack, the 38-word
   system vocabulary, user definitions
   (`:` / `;`, plus the `word:` sugar form
   as implemented in the TS engine), quotes
   `[]`, strings `'...` as characters,
   comments `/* */`, `.` dump, `putc` /
   `putn` to the app output area, `clr`.
   Out: CLI/REPL shell, file I/O, `.load` /
   `.import` / `.m` / `.inline` / `.unsafe`
   at runtime, the bytecode compiler, the
   optimizer, tests, benchmarks, and the
   Astro playground.
3. **Stdlib is generated once, shipped as
   data, stripped of compiler metadata.**
   The generation step is the repo
   preprocessor over `ff/lib/prelude.ffp`
   (Research 4), producing one core text.
   That text is stored as a string in the
   bundle (a `.js` file or an
   `index.html`-embedded string; it is data
   for the interpreter, never JS executed
   as code) and interpreted at startup, so
   the prelude words are available before
   the first user line. The generation
   post-pass strips `.inline` and `.unsafe`
   tokens, and the interpreter additionally
   skips any remaining dot-token other than
   `.` itself, so a regeneration that forgets
   the strip cannot break loading.
4. **BigInt only, never JS Number for values.**
   Every stack, queue, and definition value
   is a BigInt. Division truncates toward
   zero and remainder keeps the dividend's
   sign, matching JS BigInt and the repo
   semantics (Research 2); the engine must
   not floor them. No BigInt literal syntax
   appears in bundle code (Research 1 guard).
   `rand` is implemented for the prelude's
   primes word via `Math.random` scaled to a
   BigInt range, documented in the app as
   non-cryptographic; `Math.random` itself
   never produces a stack value directly.
5. **Words the prelude does not use get
   clear errors, not silent stubs.**
   `getc`, `clock`, and `exit` appear in the
   core vocabulary but nowhere in the
   reachable stdlib. In v1, calling one
   reports a plain error ("no input in this
   app" / "no clock in this app" / "exit is
   not available in this app") and leaves
   the stack unchanged (see Decision 7 on
   line atomicity). No fake clock, no fake
   input, no app-closing exit.
6. **Session-only, like Calculator.**
   Stack, queue, definitions, history, and
   output live in the page session. Closing
   the app or reloading loses user
   definitions, exactly as closing Calculator
   loses its entry. This is a deliberate v1
   limit, not an oversight, and it is stated
   in the app description so a user is not
   surprised by it. Persistence (e.g. a
   `set` action storing a definitions string)
   is Open Question 1.
7. **A REPL line is atomic.**
   A line is evaluated against a copy of
   the stack, queue, and definitions, and
   output is buffered; the copy and the
   buffered output commit only if the whole
   line succeeds. On any error (unknown
   word, stack underflow, division by zero,
   unmatched `:` / `[`, bad string), the
   app reports the error in place, the
   stack, queue, and definitions are exactly
   as before the line, and no partial output
   from that line is shown. This is the
   calculator-like behavior a user expects
   from a REPL, and it makes the error cases
   in the spec testable.
8. **UI is a REPL, not a button calculator.**
   One text input line, one Run control, a
   stack display, an output area, and a
   history of past lines with their results.
   A button palette for the most common
   words (`dup drop swap over rot + - * /
   % clr .`) inserts the word into the input
   line; it does not execute by itself, so
   the palette is an input aid, not a second
   execution path. Long results wrap (CSS
   `overflow-wrap: break-word` or equivalent),
   never the Calculator display's
   `white-space: nowrap` with clipping,
   because a 158-digit result must be
   readable, not truncated. Scribe rules
   apply throughout: ES2019, vanilla JS,
   inlined CSS, system fonts, zero emojis,
   48px minimum tap targets, no flexbox
   `gap` (grid `gap` is allowed), high
   contrast black-on-white.
9. **No shell, network, or state surface.**
   No `act()`, no `stateSchema` fields, no
   `capabilities.feeds`, no fetch, no
   `localStorage` as functional storage.
   The bundle reads no shell state and
   writes none. If a future version wants
   persistence, it goes through the normal
   `set`/`append` action contract, not
   through a side channel invented here.

## Risks

- **Scaled-integer math diverges.** The
  prelude's math words (atan, exp, log,
  primes, and friends) encode decimals as
  scaled integers; a port that is right on
  arithmetic but wrong on scaling, rounding,
  or range will pass toy cases and fail
  real ones. Mitigation: verify against
  the repo's expected outputs in Node
  before any Scribe run, and treat a math
  divergence as the estimate risk it is
  (Research 5), not as a cosmetic bug.
- **Scribe text input is the weak point.**
  The Scribe's on-screen keyboard, gesture
  selection limits, and e-ink refresh cost
  are documented in
  `pkg/docs/scribe-limitations.md`. A REPL
  that is pleasant in a desktop browser can
  still be painful on the device.
  Mitigation: the button palette (Decision
  8), large tap targets, and a Scribe run
  before the app is treated as done.
- **Long-number rendering.** A 158-digit
  result, a deep stack, and a long history
  can each blow up an e-ink page if they
  are rendered naively. Mitigation:
  wrapping, a capped history display, and
  stack shown top-first with a depth count.
- **Regeneration noise.** `__` prefixes
  hash the resolved import path (Research
  4), so regenerating the core from a
  different directory renames private words.
  Mitigation: the generation command and
  directory are recorded in the task notes,
  and the core is treated as a generated
  artifact, not hand-edited.
- **Definition-loss surprise.** A user who
  defines a word, closes the app, and finds
  it gone will read that as data loss unless
  the session-only limit is stated plainly.
  Mitigation: Decision 6 plus the
  description text; Open Question 1 is the
  real fix if it is wanted.

## Alternatives considered

- **Port the full TypeScript implementation.**
  Rejected: the compiler, optimizer,
  bytecode, CLI, and file I/O are a second
  project, and none of them is needed for a
  calculator. The engine-only scope is the
  user's direction, not a shortcut taken
  silently.
- **Wasm build of f-flat-minor.**
  Rejected: the Scribe probe proved Wasm is
  not usable as a whole on the device
  (Research 1), and the repo's own Wasm
  implementation is listed incomplete.
- **Core-only app (no prelude).**
  Rejected for v1, kept as the fallback:
  if the full prelude's math words prove
  too costly to verify, ship the 38-word
  core first and add the prelude as a
  follow-on, rather than slipping the whole
  app. The spec is written so the core
  requirements stand alone.
- **Server-side execution via MCP.**
  Rejected: an agent round trip per line is
  not a calculator, and it needs a device
  that can reach the agent. The whole point
  of the Scribe app is that it runs in the
  page.
- **Replace Calculator.**
  Rejected: the basic calculator is the
  right tool for simple arithmetic, and
  replacing it would break users who want
  exactly that. Two apps, two jobs.
- **Hand-written flatten script.**
  Rejected in favor of the repo preprocessor
  (Research 4): the preprocessor already
  does dedup and `__` mangling, and a
  second implementation of either would
  drift from the repo's.

## Open Questions

1. Should user definitions persist across
   reloads, and if so, as what: a single
   definitions string in app state via a
   `set` action, a history list via `append`,
   or not at all (session-only stays)?
   This decides whether v1 stays
   `stateSchema: {}` or gains a field, and
   it is the one question that changes the
   definition contract, so it is asked
   before the definition is written, not
   after.
2. Catalog shipping or add_app only? V1
   is add_app. Catalog shipping (Phase 2)
   needs the user's direction, a MINOR
   bump, and a publish; it is not assumed.
3. Button palette scope: is the Decision 8
   list (`dup drop swap over rot + - * /
   % clr .`) the right set, or should it
   include stack/queue words (`q< q> ( )`)
   and a few prelude words? The palette is
   an input aid, so the cost of a wrong
   list is low, but it is still a UX choice
   for the user.
4. Icon glyph: the definition needs a
   monochrome SVG mark per the icon rules
   (no emoji, ~2 KiB). A stack symbol is
   the obvious candidate; the exact mark
   is an authoring detail, not a spec
   decision, but it is listed here so it
   is not forgotten.
5. Does the repo's `word:` sugar form behave
   exactly as the spec assumes in the
   F♭m layer, or is it a compiler-layer
   form? The tasks verify it against the
   repo's tests before the engine treats it
   as supported; if it is compiler-only, the
   spec drops it and definitions are `:`
   / `;` only.
