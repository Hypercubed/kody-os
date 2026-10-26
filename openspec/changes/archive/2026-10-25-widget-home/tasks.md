## 1. Dashboard route and rendering

- [x] 1.1 Render `/` as the widget grid from the pinned list (live compact views, up/down reorder forms, empty state with guidance) and verify a node render shows widgets in pin order with current state
- [x] 1.2 Move the Pinned/Recent/All Apps grid behind the Apps menu link with routes unchanged, and verify `/apps/:id` deep links still render as before

## 2. Widget behavior

- [x] 2.1 Wire widget forms through the shared `act()` funnel with PRG back to `/`, and verify a no-JS submit updates state and re-renders the dashboard
- [x] 2.2 Add reorder actions (up/down per widget, single list write) plus empty-dashboard guidance, and verify order persists across reloads
- [x] 2.3 Add the optional client tick for time-based widgets and verify the no-JS render is byte-identical with the script disabled

## 3. Style and verify

- [x] 3.1 Add grid, widget panel, and reorder-control styles plus `src/shell-css.ts` regen, and verify one inline `<style>`, zero `<link>`, no flexbox gap
- [x] 3.2 Full pass: dashboard with pinned/hidden/empty states, bad-form error inline, unknown routes 404, `openspec validate widget-home` green, and verify each observable in the responses
