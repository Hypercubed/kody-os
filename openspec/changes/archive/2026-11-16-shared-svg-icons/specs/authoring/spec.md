# Spec Delta — authoring

## Purpose

Document the `<os-icon>` / `pkg/icons/` / `/icons/<name>.svg` authoring surface added by this change.

## ADDED Requirements

### Requirement: Icon authoring guidance

The adding-an-app skill and catalog README SHALL document the standard icon mechanisms: `<os-icon name="kody:...">` for local icons, `<os-icon name="lucide:...">` for on-demand Lucide icons, adding custom SVGs to `pkg/icons/`, and loading static icons via `<img src="/icons/<name>.svg">`.

#### Scenario: Agent authors an app icon

- **WHEN** an agent follows the adding-an-app skill to choose an app icon
- **THEN** it finds `<os-icon>`, `pkg/icons/`, and `/icons/<name>.svg` guidance and uses one of those mechanisms.
