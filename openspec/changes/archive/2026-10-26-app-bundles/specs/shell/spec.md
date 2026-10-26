# Spec Delta

## ADDED Requirements

### Requirement: Bundle hosting in shell chrome
`GET /apps/:id` SHALL render the existing shell chrome (title, nav, inlined theme, single `<style>`, zero external assets) with the bundle's `index.html` content inlined into the app panel (or overlay for modal placement). Bundle `<script>` and `<style>` content SHALL be inlined with the entry. Any shell-side hosting code SHALL meet the ES2019 ceiling.

#### Scenario: Bundle page renders in chrome
- **WHEN** a unified app page is fetched
- **THEN** the response carries the normal chrome plus the inlined bundle entry, exactly one `<style>` block, and zero `<link rel="stylesheet">` tags.

#### Scenario: Actions keep PRG behavior
- **WHEN** a form posts a valid or invalid action on a bundle app page
- **THEN** it responds 303 to the app page on success or 400 with an inline error on failure, same as any app.

### Requirement: Bundle failures degrade, never blank
Unknown ids SHALL still 404. Bundle render failures SHALL degrade to the server-rendered page, never a blank response.

#### Scenario: Broken bundle degrades gracefully
- **WHEN** a bundle entry fails to render
- **THEN** the page still returns the shell chrome with an explanatory message and a working close/back control.
