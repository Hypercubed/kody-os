# Spec Delta

## MODIFIED Requirements

### Requirement: Pinned section

The shell SHALL render a Pinned section above Recent listing pinned apps in pin order. A pinned app that is also hidden SHALL still appear in Pinned. An empty pinned list SHALL omit the section entirely. Pinned tiles SHALL span two grid columns (three per row at full width) at the standard tile height, with the icon fixed left and the label plus description stacked right. Every tile link on the Apps screen (Pinned, Recent, All apps) SHALL carry the app description as a `title` tooltip.

#### Scenario: Hidden pinned app stays visible in Pinned only
- **WHEN** a pinned app is hidden via edit mode
- **THEN** it remains in the Pinned section and disappears from the All apps section.

#### Scenario: Pinned tiles are double-wide with descriptions
- **WHEN** the Apps page renders with pinned apps
- **THEN** each pinned tile is twice as wide as a standard tile at the same height, showing the icon left and label plus description right, three per row.

#### Scenario: Tiles carry tooltips
- **WHEN** any Apps-screen tile is inspected
- **THEN** its link carries a `title` attribute with the app description, with no visual change.
