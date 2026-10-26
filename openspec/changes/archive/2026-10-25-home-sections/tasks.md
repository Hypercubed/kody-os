## 1. Registry lists

- [x] 1.1 Add pinned/hidden/recent key helpers + read/write in `storage.ts` and verify with a node one-liner round-trip against a memory store
- [x] 1.2 Add `recordUse(id)` (front-insert, dedupe, cap 8) and `list_apps` hidden filtering (`includeHidden` opt, default current behavior) in `registry.ts`, and verify list/add/hide flows return expected arrays
- [x] 1.3 Hook recency into successful `act()` and verify an MCP-only act appears at the front of the recency list

## 2. Export

- [x] 2.1 Include pinned + hidden in the export envelope and restore them on import (recency excluded), and verify export → blank import → prefs match, Recent empty

## 3. Shell home

- [x] 3.1 Render Pinned / Recent (with Clear) / All-apps sections from the lists and verify `curl /` shows all three with a seeded store
- [x] 3.2 Add edit mode (pin + hide toggles per app, shows hidden and pinned) with PRG posts, and verify toggling then reloading reflects the new state
- [x] 3.3 Record recency on app page GET and verify a view-only visit lands the app in Recent

## 4. Theme + verify

- [x] 4.1 Add section headings, pinned markers, and edit toggles to `styles.css`, regen `shell-css.ts`, and verify byte-identical plus zero flex-gap/`?.`/`??` greps
- [x] 4.2 Full pass: typecheck-free node render of /, empty state, unknown app 404, bad-form 400 with alert, and verify all statuses plus the no-JS POST→303 flow via curl
