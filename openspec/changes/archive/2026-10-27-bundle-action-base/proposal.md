# Proposal

## Why

Bundle buttons (like the counter's +1/-1) build action URLs from `window.location.pathname`, which is only correct on the app's own page. On the home dashboard the same buttons fire at `/` with no app id and die — and the `fetch` sends no credentials, so cookie-authenticated dashboards fail even the fallback. Template action forms work everywhere because the shell stamps the app path on them; bundle JS has no equivalent anchor.

## What Changes

- The shell stamps `data-action-base="/apps/<id>"` on every `.bundle` container it renders (app page, overlay, widget), giving bundle scripts a reliable owning-app URL that never depends on the page path.
- The hello-counter bundle JS reads its own container's `data-action-base` (falling back to `window.location.pathname` when absent) and sends `credentials: 'same-origin'` on its `fetch`, so +1/-1 work from the dashboard under both cookie and `?k=` auth.
- Document the convention in `pkg/docs/adding-an-app.md`: bundle buttons SHALL resolve actions against their container's `data-action-base`, never `window.location`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shell`: bundle containers carry the owning app's action base URL.
- `widget-home`: bundle buttons in widgets act on the owning app from the dashboard.

## Impact

- `pkg/src/apps/client.ts` (`renderAppSection` bundle container).
- `example-apps/hello-counter.json` (bundled JS: dataset base + credentials).
- `pkg/docs/adding-an-app.md` (convention note).
- Later bundles with buttons inherit the convention; no server routing changes.
