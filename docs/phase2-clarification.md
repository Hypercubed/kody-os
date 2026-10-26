# Phase 2 clarification for the Kody AI OS builder

Read this before writing more Phase 2 code. If what you are building conflicts with this, stop and fix the direction first. This does not replace the full handoff prompt — it restates the vision and narrows Phase 2.

## The vision, in one paragraph

A private, minimalist, Kindle-friendly mini-OS as a single Kody package. One human only: the Kody account owner. The members are that owner's AI agents, already connected to the account over MCP. The human talks to an agent in that agent's native chat and asks it to add a small, simple app. The agent adds it, and it appears in the human's UI. Every app must work identically through the human UI and through MCP, on the same state, through the same handlers. That dual-interface rule is the whole point. It is what ReKindle lacked: in ReKindle, an agent had to click around in a browser, with no API, no shared state, and no push.

## What this is NOT

- Not a fork or clone of ReKindle.
- Not a desktop OS: no window manager, no taskbar, no file manager, no desktop clone.
- Not a multi-user room, not a chat app, not a social platform.
- Not a real-time platform. Turn-based, refresh-based, minutes-latency is fine.
- Not one Kody package per app. Data apps live inside the one OS package.
- Not a UI that agents click, and not MCP tools with no human UI.
- Not a new login system. Kody session gating is the auth.
- Not Phase 3. No tic-tac-toe, no TODO, no real game logic, no publish-as-package.

## Phase 2's exact job

Phase 2 designs the app layer. It does not build a real app.

Deliver:
1. An app definition schema, stored in packageStorage(). Fields, at minimum: id, name, label, icon, category, description/help text, UI template, state schema, and declarative actions.
2. Shell rendering rules that are the same for every app: home tile, app page layout, form actions, Refresh, back-to-home, empty state, error state.
3. An MCP interface with the same state and same handlers as the UI:
   - list_apps
   - get_app_state
   - act(app, action, args)
   - add_app(definition) — a registry write only, no OS republish
   - export_app(name) — the complete definition as JSON, re-importable into a blank install
4. Validation rules: state lives only in storage. An action is validated before it changes anything. A bad action returns a clear error and changes nothing — no partial state change.
5. Definitions are declarative, not arbitrary code. Never store and blindly eval JavaScript from an imported definition.
6. One validation app only: a Hello / counter test app, proving list → open → act → refresh → export, end to end.

Phase 2 gate, then stop and report. Do not start Phase 3:
1. An agent adds a test definition via add_app over MCP, and it appears on home with no OS republish.
2. The same test app is acted on via UI and via MCP, and both see the same state on refresh.
3. export_app returns a definition that could be re-imported into a blank install.
4. A bad action is rejected cleanly, with no partial change.

## What to look at in the ReKindle repo — and what to take from it

Repo: github.com/ReKindleOS/ReKindle. License: CC BY-NC-SA 4.0, copyright Ukiyo. Study it, learn its patterns, do not paste its code or assets wholesale, and do not use it commercially.

Take these patterns:
- icons.js, the APPS registry. About 132 entries, each with id, name, cat, icon, and optional desc, featured, featuredOrder, live, plus, es6, single, beta, viewBox. The id is the app's identity and maps to its page. Categories include essentials, tools, lifestyle, games, two_player, live_game. This is the closest existing thing to our Phase 2 registry — but ours must be data in packageStorage(), not a hardcoded JS array, and ours must include state schema and declarative actions, which ReKindle's entries do not.
- index.html, the launcher. It is a dumb renderer over the registry: category headings, an All Games section, featured / favorites / hidden filtering, and one uniform tile per app via createAppElement(). That is the shell pattern to copy: the launcher knows how to render any app, it does not contain per-app logic.
- js/ui-kit.js, the shared kit. One shared empty-state helper, one small icon set, 48px tap targets, 2px black borders, hard shadows, Geneva/Verdana, no gradients. Phase 2 needs exactly this kind of shared kit, even simpler: one tile, one page, one form, one empty state, one error state.
- AGENTS.md, the Kindle constraints. Target Chromium 75. ES2019 ceiling: no optional chaining (?.) and no nullish coalescing (??) — they crash. No flexbox gap (grid gap is OK). System fonts only, no web fonts, no emojis. Plus the performance notes: dirty-flag rendering, pagination, containment, rect caching. Apply all of this to the shell renderer, not just to the Scribe. If Phase 2 uses modern JS/CSS the Scribe cannot run, it fails the Kindle-friendly requirement.
- help-data.js / help.html. Every app has a guide entry. Our definition should therefore include a description/help field, so both the human and an agent can tell what an app is for without reading its code.
- The state lesson, by contrast. ReKindle has a different backend per app, and that is exactly what Phase 2 must avoid:
  - rssreader.html: localStorage keys rss_feeds, rss_read_items, rss_reader_font_size.
  - tasks.html: localStorage rekindle_tasks_local, plus Firestore collections, plus a separate Google Tasks path with its own token.
  - livechess.html: Firebase Realtime Database under games/chess/, with board state, and a lobby that auto-starts when an opponent joins.
  - Our OS gets one backend: packageStorage(). One state shape per app, one action handler, used by both UI and MCP. If UI and MCP can diverge, the design is wrong.

Do NOT take these:
- One HTML file per app. That is why ReKindle is 130+ pages and ~17 MB. Our data apps exist precisely to avoid that.
- Firebase auth/rules, Stripe / ReKindle+ gating, social/moderation, KindleChat, RTDB live games, doom.wasm, and the rest of ReKindle's scale. Those are ReKindle's product, not our minimal OS.
- ReKindle's live-game model as a Phase 2 requirement. Live games are a later, harder problem. Phase 2 is turn-based and refresh-based.

## If you are stuck, check for these wrong turns first

- Building a window manager, file manager, taskbar, or chat: out of scope.
- Building a new Kody package per app: defeats the data-app design and the 10-package Free limit.
- Adding an app by republishing the OS: defeats add_app as a registry write.
- An app that works in the UI but not via MCP, or vice versa: defeats the dual-interface rule.
- An app definition that is a blob of JavaScript to eval: defeats the declarative, import-safe rule.
- Modern JS/CSS, animations, gradients, or small tap targets: defeats the Kindle-friendly, retro, minimalist design.
- Jumping to tic-tac-toe, TODO, publish, or chat to "prove" the layer: Phase 2's proof is the counter test app and the four gate checks above, nothing more.
