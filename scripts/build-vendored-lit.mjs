// Build the vendored Lit file for shell-islands (transpile-once).
// Rebuilds pkg/public/lit.js from pinned lit@3.3.3 + esbuild@0.25.10,
// ceiling-scans the built output, and fails loudly on any violation.
// An upgrade of the pinned Lit version is a re-probe, not a silent bump:
// rebuild, re-scan, re-run the jsdom smoke and the Scribe check, then
// update the recorded version in the same change.
//
// Usage: node scripts/build-vendored-lit.mjs   (run from the repo root)
// Output: pkg/public/lit.js (Lit 3.3.3, iife, global window.KodyLit)
//   plus bytes/gzip printed to stdout.
// The build installs its pinned toolchain into a temp dir under
// os.tmpdir() and removes it afterwards, so the repo stays clean.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { scanText, bannedHits } from './ceiling-scan.mjs';

const LIT_VERSION = '3.3.3';
const ESBUILD_VERSION = '0.25.10';
const OUT = 'pkg/public/lit.js';

const scratch = join(tmpdir(), 'kody-os-vendored-lit-' + Date.now());
mkdirSync(scratch, { recursive: true });
try {
	execSync('npm init -y', { cwd: scratch, stdio: 'ignore' });
	execSync('npm install lit@' + LIT_VERSION + ' esbuild@' + ESBUILD_VERSION, { cwd: scratch, stdio: 'inherit' });
	// esbuild lives in the scratch dir's node_modules, not the repo's:
	// resolve it from the scratch package, not from this script.
	const requireScratch = createRequire(join(scratch, 'package.json'));
	const esbuild = requireScratch('esbuild');
	const entry = join(scratch, 'entry.js');
	writeFileSync(entry, "export { LitElement, html, css, render, nothing, svg } from 'lit';\n");
	const outFile = join(scratch, 'lit.js');
	await esbuild.build({
		entryPoints: [entry],
		bundle: true,
		format: 'iife',
		globalName: 'KodyLit',
		target: 'es2019',
		minify: true,
		outfile: outFile,
		logLevel: 'warning',
	});
	const js = readFileSync(outFile, 'utf8');
	const bytes = Buffer.byteLength(js, 'utf8');
	const gzip = gzipSync(Buffer.from(js)).length;
	const scan = scanText(js, 'lit.js');
	const banned = bannedHits(scan);
	const counts = {};
	for (const [key, value] of Object.entries(scan)) {
		if (value.count > 0) counts[key] = value.count;
	}
	console.log(JSON.stringify({ lit: LIT_VERSION, esbuild: ESBUILD_VERSION, bytes: bytes, gzipBytes: gzip, ceilingScan: counts, banned: banned }));
	if (Object.keys(banned).length > 0) {
		throw new Error('ceiling scan FAILED: ' + JSON.stringify(banned));
	}
	// ContextRoot / WeakRef are the Chrome 84+ risk: prove absence by
	// per-output bytes, not by the metafile-inputs list (which includes
	// tree-shaken modules). The entry does not import ContextRoot.
	if (js.indexOf('WeakRef') !== -1) throw new Error('ceiling scan FAILED: WeakRef present in built output');
	if (js.indexOf('ContextRoot') !== -1) throw new Error('ceiling scan FAILED: ContextRoot present in built output');
	writeFileSync(OUT, js);
	console.log('wrote ' + OUT + ' (' + bytes + 'B, gzip ' + gzip + 'B)');
} finally {
	rmSync(scratch, { recursive: true, force: true });
}
