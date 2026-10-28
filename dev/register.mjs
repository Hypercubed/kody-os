// Module loader for the local preview: registers the kody:runtime stub hook.
// Usage: node --import ./dev/register.mjs --experimental-strip-types dev/preview.mjs
import { register } from 'node:module'
register(new URL('./kody-runtime-hooks.mjs', import.meta.url))
