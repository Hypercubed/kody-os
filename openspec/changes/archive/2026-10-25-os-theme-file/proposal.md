## Why

Every install says "kody-os" with the same icon and background. Other Kody users who fork the package need one obvious file to make it theirs — name, icon, background — edited at fork time, no code spelunking.

## What Changes

- New single file `pkg/os-theme.json`: display name, icon (text glyph or asset path), page title, body background, and header mark. All fields optional with today's values as defaults.
- Shell chrome (title tag, header brand, background) renders from that file instead of hardcoded strings. Missing file or missing fields fall back to current defaults, so existing installs render identically.
- `icon.svg` remains the static asset; the theme file references which mark to use.
- BREAKING: none. Defaults preserve current rendering byte-for-byte.

## Capabilities

### New Capabilities

- `os-theme`: the theme file contract — schema, defaults, fallback rules, and what a fork edits to rebrand.

### Modified Capabilities

- `shell`: chrome (title, brand mark/name, background) becomes data-driven from `os-theme.json` instead of hardcoded.

## Impact

- `pkg/os-theme.json` (new), `pkg/src/app.ts` (read file at render, fall back to defaults), `pkg/src/shell-css.ts` regen if background moves into CSS variables.
- Publishing unchanged (file ships with the package). No MCP surface changes. No migration: absent file = current look.
