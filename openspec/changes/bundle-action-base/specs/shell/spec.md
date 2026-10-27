# Spec Delta

## Purpose

Bundle scripts need a page-independent anchor for the owning app so buttons that act on state work identically on the app page, in overlays, and on the home dashboard.

## MODIFIED Requirements

### Requirement: Bundle hosting in shell chrome

`GET /apps/:id` SHALL render the existing shell chrome (title, nav, inlined theme, single `<style>`, zero external assets) with the bundle's `index.html` content inlined into the app panel (or overlay for modal placement). Bundle `<script>` and `<style>` content SHALL be inlined with the entry. The shell SHALL stamp `data-action-base="/apps/<id>"` on the bundle container so bundle scripts can resolve action URLs against the owning app without reading the page path. Any shell-side hosting code SHALL meet the ES2019 ceiling.

#### Scenario: Bundle page renders in chrome

- **WHEN** a unified app page is fetched
- **THEN** the response carries the normal chrome plus the inlined bundle entry, exactly one `<style>` block, and zero `<link rel="stylesheet">` tags.

#### Scenario: Actions keep PRG behavior

- **WHEN** a form posts a valid or invalid action on a bundle app page
- **THEN** it responds 303 to the app page on success or 400 with an inline error on failure, same as any app.

#### Scenario: Bundle container carries the action base

- **WHEN** any page renders a bundle (app page, overlay, or home widget)
- **THEN** the `.bundle` container carries `data-action-base` naming the owning app's `/apps/<id>` path.
