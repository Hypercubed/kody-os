# OS Theme

## Purpose

A single file that rebrands the OS for forks: name, icon, background, and title, edited at fork time with no code spelunking, shipped with the package.

## Requirements

### Requirement: Single theme file with defaults

The package SHALL read `pkg/os-theme.json` at render time for display name, icon reference, page title, header brand, and body background. Every field SHALL be optional; a missing file or missing field SHALL fall back to today's values (name `kody-os`, current icon, current background), so existing installs render byte-identically. All fields SHALL be strings when present: `name` is the header brand and default title suffix, `title` overrides the document-title prefix when non-empty, `icon` is short glyph text (empty means the current checkerboard mark), and `background` SHALL be one of the closed tokens `desk` (default) or `paper`.

#### Scenario: Absent file changes nothing
- **WHEN** `os-theme.json` is absent
- **THEN** every page renders exactly as before, with name `kody-os` and the current icon and background.

#### Scenario: Fork rebrands via one file
- **WHEN** a fork sets name, icon, and background in `os-theme.json` and republishes
- **THEN** the title tag, header brand, and page background show the fork's values on every page with no other file touched.
