# Handoff: Private Kindle-friendly AI OS on Kody

## Status of this prompt — read first

This is a plan handoff only. Do NOT start building or implementing anything yet.

I will explicitly say "start Phase 1" (and later, "start Phase 2", "start Phase 3") when I am ready. Until then, just read this plan, hold it, and ask me clarifying questions if anything is unclear. Do not run ahead into the next phase on your own.

After each phase, stop and report back to me. Do not start the next phase until I say so.

## Overall goal

Build a private, Kindle-friendly AI OS as a single Kody package.

When a user installs this package on their own Kody account, they get a blank, private OS shell. The user is the only human: the Kody account owner. Their AI agents — already connected to that Kody account over MCP — are the members of the OS. The user talks to those agents in their native chat interfaces (for example, talking to you, OpenClaw, in OpenClaw chat) and asks them to add a new app to the OS. The app is built and added to the OS, and it then appears in the human UI.

Apps in this OS are small and simple by design, and built to be AI-friendly by design. That means every app must work the same way through the human UI and through MCP, with the same state and the same handlers — not a UI that agents have to click around in a browser, and not an MCP toolset with no human UI.

## Background — why this, and why Kody

This started from exploring ReKindle (rekindle.ink), a web dashboard for Kindle e-ink devices, and trying to play a live chess game through it with an AI agent. That worked technically — an account was created, a lobby was hosted, a move was made — but it was not fun: every move required a separate browser task, there was no live watch of the board, and there was no push when the opponent moved. The lesson was: an agent needs a real API/state interface, not screen-clicking.

Kody (kody.codes) fits that need because its primitives are already: shared memory across agents, saved code packages, scheduled jobs/webhooks, secrets usable by name, and package apps hosted on kody.run, all reachable by agents over MCP at https://kody.codes/mcp (streamable HTTP, OAuth).

This project is inspired by ReKindle's style, not a clone of ReKindle. Do not copy ReKindle code or assets. There is no public source repo for rekindle.ink itself to copy from. Use it only as a design guide (see Phase 1).

## Key design decisions already made

1. **Single package, single human.** One Kody package is the OS. One human: the Kody account owner. Kody's account model is org-isolated — each signed-in user gets a personal organization, and that org is the billing and data boundary. Installing a package is a fork you own.

2. **Private by default.** The OS package stays private (new packages are always private, and private is owner-only). Grant nobody Use / app:execute. Do not approve it as internet-visible. The human UI is hosted by Kody at https://{username}.kody.run/<package-name>/, reached via https://kody.codes/@{username}/packages/<name>/open, which mints a short-lived handoff token. Kody session gating is the auth — do not build a separate login system for the OS.

3. **Agents are members via MCP, not by sharing a password.** Agents connect to the Kody account over MCP via OAuth. Approving an agent gives it full access to that Kody account, not a limited permission set — treat agent approval as full-account trust. Inbound MCP agents can be listed and revoked on Kody's dashboard Agents page (/@<slug>/-/agents). There is no documented MCP tool for listing/revoking inbound agents, so if the OS needs an in-app member list, the OS itself must keep a registry as agents first call it. Do not confuse inbound agents with remote MCP servers Kody connects out to (mcpServerList is for outbound servers).

4. **Data-driven apps first, packages second (hybrid).** This is the central design question, and the answer is both, at different stages:
   - **By default, apps are data, not code.** An app is a definition stored in the OS package's packageStorage(): name, label/icon, category, UI template, state schema, and declarative actions the shell knows how to run. Adding an app is a registry write. It needs no republish of the OS package, and it uses zero additional Kody packages.
   - **On request only, an app can be published as a real Kody package.** That is an agent step done from the agent's native chat via MCP, not something the running OS shell does to itself at runtime (there is no runtime "register a new app" API, and new code/routes/assets require a new publish). The agent reads the definition from OS storage, scaffolds a standalone package with its own app entry, UI, and MCP tools mirroring the data app's actions, publishes it (private by default, public only if explicitly requested), and updates the OS registry to point to it. There is also a lighter sharing path: export the app definition as JSON, and another OS install can import it without a Kody package at all.
   - **State on publish:** when an app is published, decide explicitly whether its state moves to the new package (export snapshot, import into the package, mark the OS entry as moved) or the published package is a fresh shareable copy with its own state. Do not leave two live versions of the same app diverging under the same name.

5. **Kindle-friendly, but not Kindle-only.** The OS UI must work in a simple e-ink browser, and also be perfectly usable on desktop and phone browsers. Plain HTML, forms + Refresh link, large tap targets, responsive layout, no JS framework.

6. **Free-tier awareness.** Kody Free ($0) includes, among other limits: 10 saved packages, 5 scheduled jobs (no faster than every 15 minutes), 150 unique execute workers/day, 1,000 outbound fetches/day, 500 job runs/day, 1,000 automation invocations/day, and 16 MiB durable storage. The OS uses 1 package. Data-driven apps do not eat the package limit; published apps do, so publish selectively. Storage (16 MiB) is the tightest limit to watch, not per-visit counts. Worker compute and Durable Object rows read are guidelines on Free, not charges or stops. Model costs for the agents that build apps are separate — they are paid to those agents' providers, not to Kody.

7. **Follow Kody docs, do not invent APIs.** Before building, search Kody docs for package-apps, package-authoring, package-lifecycle, packageStorage, organizations, and connect-your-agent, and follow the documented authoring lane. If a Kody API or behaviour is not in the docs, say so and ask, rather than inventing it. Kody docs do not state Kindle-browser compatibility — the Kindle-friendly rendering is our responsibility, not Kody's guarantee.

## Phase 1 — Build the OS UI only

Goal: a blank OS shell the user can actually open and use, before any app logic exists.

Build:
- One private Kody package, not internet-visible, no Use grants.
- Home/launcher UI on its kody.run URL, opened via the Kody package page.
- Design guide is ReKindle style only (do not copy ReKindle code or assets): retro early-computer look, grey/monochrome palette, simple icon + label tiles in a grid, plain category headings, high contrast, no gradients, no animations, text-first.
- Kindle-friendly but NOT Kindle-only: plain HTML, forms + Refresh link, large tap targets, responsive on desktop and phone.
- Shell only: home/launcher, back-to-home navigation, and an honest "no apps yet" empty state.
- Owner session gating as Kody provides it.

Explicitly NOT in Phase 1: no apps, no app registry, no MCP app tools, no publish, no chat.

Gate — do not move on until all of these pass, and then stop and report:
1. The package installs on the user's own Kody account.
2. The user can open its kody.run URL while signed in and see the shell.
3. It renders and navigates on a second device/browser (ideally including the Kindle Scribe's browser, or at least a simple browser).
4. A signed-out / other visitor cannot just open the app URL and see it.

## Phase 2 — Design the app layer

Goal: the contract every future app will follow, proven with a trivial test app — not a real app yet.

Build / define:
- App definition schema, stored in packageStorage(): name, label/icon, category, UI template, state schema, and declarative actions.
- UI interface: how the shell renders any definition — home tile, app page layout, form actions, refresh, back navigation, error state. Same rendering rules for every app.
- MCP interface, with the same state and same handlers as the UI:
  - list_apps
  - get_app_state
  - act(app, action, args)
  - add_app(definition) — registry write only, no republish
  - export_app(name) — complete definition as JSON
- Rules: state lives in storage, actions are validated before they change state, a bad action returns a clear error and changes nothing, and an app definition can be imported/exported without code changes.
- Validation app only: a "Hello" / counter test app that proves list → open → act → refresh → export works end to end. This is a test harness, not a product app.

Explicitly NOT in Phase 2: no tic-tac-toe, no TODO, no real game logic, no publish-as-package.

Gate — then stop and report:
1. An agent can add_app a test definition via MCP, and it appears on the home screen with no OS republish.
2. The same test app can be acted on via UI and via MCP, and both see the same state on refresh.
3. export_app returns a definition that could be re-imported into a blank install.
4. A bad action is rejected cleanly, with no partial state change.

## Phase 3 — Build a real app, and improve the layers as needed

Goal: learn what the UI and app layer got wrong, by forcing a real app through them.

Build:
- Tic-tac-toe as a data-driven app under the Phase 2 contract: 3x3 board, turn-taking, win/draw detection, new game, persistent state.
- Playable in the UI and via MCP, same state, same rules.
- Then, and only then, improve the UI and app layers as needed: whatever tic-tac-toe exposes — turn handling, state persistence across refresh, error messages, tap targets on e-ink, MCP action naming — gets fixed in the shell/layer, not hacked into tic-tac-toe alone. List every such change.

Explicitly NOT in Phase 3 (yet): no publish-as-package, no second real app, no chat, no multi-user, no Obsidian sync.

Gate — then stop and report:
1. A full game can be played to completion via UI.
2. A full game can be played to completion via MCP actions, with the UI showing the same board on refresh.
3. Every UI/app-layer change tic-tac-toe forced is listed, and confirmed to be in the shell/layer, not just in tic-tac-toe.
4. export_app returns a complete tic-tac-toe definition — the publish-ready artifact for later.

## Future plans — context only, NOT in scope for Phases 1–3

Do not build any of these in Phases 1–3. They are listed here so design decisions in Phases 1–3 do not dead-end them:

- Phase 4: publish-as-package on request, built on export_app — an agent scaffolds and publishes a standalone package from a data app definition, and updates the OS registry to point to it, with an explicit state-migration decision.
- More data apps, in roughly this spirit (not a commitment to order): a simple TODO list, a daily brief feed, notes/journal, calendar/tasks views.
- Multiplayer / turn-based games beyond tic-tac-toe. Real-time games (for example, a Pictionary-style game with short drawing rounds) are a harder fit than turn-based games and come later, if at all.
- An in-OS chat / neighbourhood room, if it ever makes sense — agents are currently talked to in their native chat interfaces, and that is sufficient for Phases 1–3.
- Sharing beyond a single human: multi-human rooms, and import/export of app definitions between OS installs. The current scope is single-human (the account owner) by design; do not build multi-user access control in Phases 1–3.
- A bridge to other data sources the user cares about, for example an Obsidian notes bridge. That is a separate bridge, not native OS functionality, and not in Phases 1–3.
- A Muse MCP bridge: Muse currently has no native way to attach an arbitrary Kody MCP server, so Muse is not assumed to be a member agent in Phases 1–3 unless that bridge is built separately. Do not assume Muse connectivity in the OS design.
- Scribe-specific refinements beyond the plain-HTML foundation, once Phase 1 access on the actual Scribe browser is proven.

## How to work

- One phase at a time. Stop after each phase and report against its gate. Wait for an explicit "start Phase X" before beginning the next phase.
- Keep the package private and owner-only throughout.
- Keep apps small, simple, and declarative. If an app idea needs a heavy framework or real-time interaction to work, flag it as a future-phase question instead of forcing it into the current phase.
- When Kody docs and this plan disagree, flag the disagreement and ask before proceeding.
- Never paste or request secrets, passwords, or tokens in chat. Use Kody's own secret / OAuth flows for credentials.
