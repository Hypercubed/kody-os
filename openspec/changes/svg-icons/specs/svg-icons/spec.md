# Spec Delta

## Purpose

Let app tiles show rich monochrome marks that stay Scribe-safe with no external assets.

## ADDED Requirements

### Requirement: Sanitized inline SVG icons
The system SHALL accept an inline-SVG icon variant alongside plain-text `icon`. Validation SHALL allowlist elements `svg, path, circle, rect, line, polyline, polygon, g, title` and geometry plus monochrome fill/stroke attributes only, and SHALL reject `script, foreignObject, use, image, style`, `on*` handlers, external refs, and animations.

#### Scenario: Valid SVG installs
- **WHEN** `add_app` receives an icon with allowlisted SVG markup
- **THEN** it returns `{ ok: true, id }` and the tile renders the sanitized SVG.

#### Scenario: Hostile SVG is rejected
- **WHEN** `add_app` receives an icon with script, external ref, or event handler
- **THEN** it returns `{ ok: false, error }` naming the problem and writes nothing.

### Requirement: Scribe-safe tile rendering
Tiles SHALL render sanitized SVG unescaped inside `.tile-icon`, constrained to currentColor, 1.5rem box, no color, no gradients, no animation. Plain-text icons SHALL keep the escaped path unchanged.

#### Scenario: SVG tile renders monochrome
- **WHEN** the Apps page renders an app with an SVG icon
- **THEN** the tile shows the SVG mark at icon size with no color or animation.

#### Scenario: Plain-text icon unchanged
- **WHEN** the Apps page renders an app with a plain-text icon
- **THEN** the glyph renders escaped exactly as today.
