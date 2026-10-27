# Tasks

## 1. Action base anchor and counter fix

- [x] 1.1 Stamp `data-action-base="/apps/<id>"` on the bundle container in `renderAppSection` (`pkg/src/apps/client.ts`) and verify `node --experimental-strip-types --check` passes plus the attribute renders on app page, overlay, and widget
- [x] 1.2 Update hello-counter bundled JS (`example-apps/hello-counter.json`) to resolve actions against the container's `data-action-base` (pathname fallback, `getAttribute` fallback) with `credentials: 'same-origin'` on fetch, and verify the JSON still validates via `validateDefinition`

## 2. Docs and verify

- [x] 2.1 Document the `data-action-base` convention in `pkg/docs/adding-an-app.md` and verify on preview: pin counter home, +1/-1 update state under cookie auth, app page unchanged, plus ES2019 grep clean and `openspec validate --changes` passes
