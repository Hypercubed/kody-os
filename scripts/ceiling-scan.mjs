// Ceiling scan for the Lit probe (Phase 0).
// Scans JS text for post-ES2019 syntax and built-ins that Chromium 80
// (the Kindle Scribe engine) does not have. Two classes:
//   - syntax: esbuild target es2019 downlevels these, so they may appear
//     in shipped source but MUST be 0 in built output.
//   - builtin-banned / extended: esbuild does NOT polyfill these. The
//     patterns match CALLS only (`.replaceAll(`, `structuredClone(`,
//     `new WeakRef(` …), not mere mentions. The probe's own capability
//     table names the built-ins in string literals ("replaceAll native",
//     "structuredClone") and feature-checks them with `typeof` — exactly
//     the Svelte probe's situation ("the probe's own strings") — and
//     those mentions are safe on Chromium 80: `typeof` a missing
//     built-in is `undefined`, never a throw. A call is a hard fail.
//   - builtin-ok: ES2020+ built-ins Chromium 80 already has; recorded
//     for completeness, never a fail.
// Usage as a script: node ceiling-scan.mjs <file...>  (prints JSON)
// Imported by build.mjs for the built-output scan.
import { readFileSync } from 'node:fs';

const PATTERNS = [
  { key: 'optionalChaining', label: '?. optional chaining (ES2020, Chrome 80+)', cls: 'syntax', re: /\?\.(?![0-9])/g },
  { key: 'nullishCoalescing', label: '?? nullish coalescing (ES2020, Chrome 80+)', cls: 'syntax', re: /\?\?/g },
  { key: 'logicalAssignment', label: '??= ||= &&= logical assignment (ES2021, Chrome 85+)', cls: 'syntax', re: /\?\?=|\|\|=|&&=/g },
  { key: 'replaceAllCall', label: 'String.prototype.replaceAll CALL (ES2021, Chrome 85+)', cls: 'builtin-banned', re: /\.replaceAll\s*\(/g },
  { key: 'structuredCloneCall', label: 'structuredClone CALL (Chrome 98+)', cls: 'builtin-banned', re: /structuredClone\s*\(/g },
  { key: 'objectHasOwnCall', label: 'Object.hasOwn CALL (ES2022, Chrome 93+)', cls: 'builtin-banned', re: /Object\.hasOwn\s*\(/g },
  { key: 'dotAtCall', label: '.at( CALL (ES2022, Chrome 92+)', cls: 'builtin-banned', re: /\.at\s*\(/g },
  { key: 'weakRefCall', label: 'new WeakRef( (Chrome 84+)', cls: 'builtin-banned', re: /new\s+WeakRef\s*\(/g },
  { key: 'toSortedFamilyCall', label: '.toSorted/.toReversed/.toSpliced( CALL (ES2023, Chrome 110+)', cls: 'extended', re: /\.(toSorted|toReversed|toSpliced)\s*\(/g },
  { key: 'dotWithCall', label: '.with( CALL (ES2023, Chrome 110+)', cls: 'extended', re: /\.with\s*\(/g },
  { key: 'groupByCall', label: 'groupBy( CALL (Chrome 117+)', cls: 'extended', re: /groupBy\s*\(/g },
  { key: 'wellFormedCall', label: 'isWellFormed(/toWellFormed( CALL (Chrome 111+)', cls: 'extended', re: /(isWellFormed|toWellFormed)\s*\(/g },
  { key: 'matchAll', label: 'String.prototype.matchAll (ES2020, Chrome 73+, OK)', cls: 'builtin-ok', re: /matchAll/g },
  { key: 'allSettled', label: 'Promise.allSettled (ES2020, Chrome 76+, OK)', cls: 'builtin-ok', re: /allSettled/g },
  { key: 'globalThis', label: 'globalThis (Chrome 71+, OK)', cls: 'builtin-ok', re: /globalThis/g },
];

// Banned in built output: every syntax pattern + builtin-banned + extended.
// builtin-ok is recorded but never fails.
const BANNED_KEYS = PATTERNS.filter(function (p) { return p.cls !== 'builtin-ok'; }).map(function (p) { return p.key; });

function scanText(text, label) {
  const out = {};
  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, 'g');
    const matches = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      if (matches.length < 3) {
        const start = Math.max(0, m.index - 40);
        matches.push(text.slice(start, m.index + m[0].length + 40).replace(/\s+/g, ' '));
      }
    }
    out[p.key] = { count: (text.match(new RegExp(p.re.source, 'g')) || []).length, samples: matches, label: p.label, cls: p.cls };
  }
  return out;
}

function bannedHits(scan) {
  const hits = {};
  for (const key of BANNED_KEYS) {
    if (scan[key] && scan[key].count > 0) { hits[key] = scan[key].count; }
  }
  return hits;
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node ceiling-scan.mjs <file...>'); process.exit(2); }
  const result = {};
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    result[f] = scanText(text, f);
  }
  console.log(JSON.stringify(result, null, 2));
}

export { PATTERNS, BANNED_KEYS, scanText, bannedHits };
