# Tasks

## 1. Origin-carrying tile links

- [ ] 1.1 Append `from` (`/` on dashboard widgets, `/apps` on Apps-grid tiles and widget expand links) in `pkg/src/apps/client.ts` and verify the Apps page HTML contains `from=%2Fapps` on tiles and `from=%2F` on widget expand links
- [ ] 1.2 Read `from` in the app-page dispatch (`pkg/src/app.ts`), validate with the existing `safeNextPath`, and pass the close target into the chrome/panel close box, and verify `?from=/apps` renders a close box pointing at `/apps`

## 2. Fallback and safety

- [ ] 2.1 Verify missing, empty, and off-site `from` values (`?from=https://evil.example`) all render a close box pointing Home with no redirect off-site
- [ ] 2.2 Verify the full loop on preview: Apps→app→close lands `/apps`, Home→app→close lands `/`, action submit on an Apps-opened app redirects back to `/apps` with the close box intact
- [ ] 2.3 Run `node --experimental-strip-types --check` on touched files plus ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` and verify `openspec validate --changes` passes
