/**
 * Regenerate `pkg/src/shell-css.ts` from `pkg/public/styles.css`.
 *
 * Run with bun from the repo root:
 *
 *   bun scripts/build-shell-css.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

var __dirname = dirname(fileURLToPath(import.meta.url))
var repoRoot = join(__dirname, '..')
var cssPath = join(repoRoot, 'pkg', 'public', 'styles.css')
var targetPath = join(repoRoot, 'pkg', 'src', 'shell-css.ts')

var css = readFileSync(cssPath, 'utf8')
var content =
	'/** GENERATED from public/styles.css — do not hand-edit.\n' +
	' * Source of truth is pkg/public/styles.css. Regenerate after any theme edit.\n' +
	' * The shell inlines this so Scribe (no external stylesheets) renders correctly.\n' +
	' */\n' +
	'export const SHELL_CSS: string = ' + JSON.stringify(css) + ';\n'

writeFileSync(targetPath, content, 'utf8')
console.log('Regenerated ' + targetPath + ' from ' + cssPath)
