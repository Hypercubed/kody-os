# Tasks

## 1. Cookie investigation (owner-run)

- [ ] 1.1 Open the hosted bookmark (`?k=...`) in a desktop browser, click any tile, and report whether the URL bar stays clean (no `?k=`) or keeps `?k=` stamped everywhere, on desktop and on the Scribe
- [ ] 1.2 Record the finding in `design.md` Open Questions resolution (cookie works: keep cookie primary; works nowhere: skip cookie reliance, enhancement-only) and verify the footer indicator from 2.1 agrees with the observed URLs

## 2. Auth-path indicator

- [ ] 2.1 Render the active auth path (`via cookie` / `via key` / `locked`) in the shell footer from the existing `AccessCheck` flags and verify each of the three states renders on preview by direct fetch
- [ ] 2.2 Update the `shell` spec delta if the indicator wording changes during implementation and verify `openspec validate --strict` passes

## 3. Conditional stamping + localStorage

- [ ] 3.1 Branch `withAccessCodeInHtml` and redirect stamping on `viaQuery` (unstamped when cookie-authenticated) and verify cookie-authenticated preview responses contain zero `?k=` while query-authenticated responses keep it
- [ ] 3.2 Add the guarded `localStorage` write to the unlock success path and verify unlock works with storage present, absent, and disabled
- [ ] 3.3 Attach the stored key in the client enhancement (`src/client/index.ts`, DOM fallback when storage is empty) and verify `format=json` actions authenticate with clean links, falling back to native submit on failure
- [ ] 3.4 Update `pkg/docs/adding-an-app.md` (JS-on required, gate-is-a-latch wording) and verify ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` plus `openspec validate --changes` passes
