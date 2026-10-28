# Spec Delta

## Purpose

Widget reorder controls should be compact and out of the content's way: small arrow controls styled like the titlebar os-box, fixed to the widget's bottom corners, replacing the large Up/Down strip. The order model, form submits, and boundary behavior do not change.

## MODIFIED Requirements

### Requirement: Widget dashboard as landing page

`GET /` SHALL render a grid of live widgets, one per homepage-pinned app in homepage order. Each widget SHALL show the app's current state rendered from its own compact view plus its action forms, a link to the full app page, and two compact arrow reorder controls styled like the titlebar os-box — a left arrow pinned to the widget's bottom-left corner and a right arrow pinned to the widget's bottom-right corner — submitting the same move-back/move-forward order change as before. The first widget's left control and the last widget's right control SHALL render disabled. An empty homepage list SHALL render an honest empty state pointing at Apps → Edit → "add to homepage".

#### Scenario: Left arrow moves earlier, right arrow moves later

- **WHEN** a widget's left-arrow control is submitted (and it is not first)
- **THEN** the widget moves one position earlier in homepage order and the dashboard re-renders with the same widgets in the new order.

#### Scenario: Boundary controls disable

- **WHEN** the dashboard renders with two or more widgets
- **THEN** the first widget's left control and the last widget's right control render disabled, and all others render enabled.

#### Scenario: Widgets show live state

- **WHEN** the dashboard loads with pinned apps holding state
- **THEN** each widget shows current values and working forms, and submitting a widget form applies the action and re-renders the dashboard with the new state.

#### Scenario: Empty dashboard guides to Apps

- **WHEN** no apps are pinned to the homepage
- **THEN** `/` responds 200 with an honest empty state linking to the Apps page edit flow.

#### Scenario: Corner controls keep tap targets

- **WHEN** any widget renders its reorder controls
- **THEN** each control's tap target is at least 3rem in both dimensions regardless of the arrow mark's visual size.
