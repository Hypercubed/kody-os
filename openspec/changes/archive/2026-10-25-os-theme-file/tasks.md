## 1. Theme file

- [x] 1.1 Create `pkg/os-theme.json` with name, icon, title, background fields (today's values) and verify it parses and validates against the os-theme spec
- [x] 1.2 Wire `shellChrome` in `pkg/src/app.ts` to read title/brand/background from the file with inline fallbacks, and verify home + app page render forked values when edited and current values when absent

## 2. Verify

- [x] 2.1 Full pass: node render of /, empty state, unknown app 404, and `openspec validate os-theme-file`, and verify all green plus byte-identical rendering with the file absent
