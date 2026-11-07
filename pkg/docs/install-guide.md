# Install guide for agents

Read this guide before installing any app for the user, then follow the app's own recipe (its `RECIPE.md`) for the app-specific steps. This guide applies to every agent-assisted install — from the App Store, from a recipe, from a catalog definition, or from a file the user hands you. No install skips it.

## 1. Read the app first

Read the app's JSON definition and its `RECIPE.md` if it has one. Write down what it declares:

- What the app does, in plain words.
- Its capabilities (feeds, proxy, manageApps, theme, email, and any others — the exact list and what each one allows is in the adding-an-app skill's capability table). A capability is installer disclosure plus an allowlist, not a sandbox.
- Its actions and state fields.

## 2. Security-check the bundle

Read the bundle: `index.html` and every JS and CSS file in its `files` map. Look for:

- Network calls to URLs the definition does not declare (fetch, XHR, WebSocket, form actions, image or script sources pointing elsewhere).
- Calls to shell routes beyond the declared capabilities — especially the management API, theme set, feed, proxy, and email routes.
- Anything that reads or sends out credentials, cookies, or session data.
- Obfuscated or encoded code: `eval`, `new Function`, long base64 or hex blobs, packed scripts. Treat these as suspicious, not clever.
- Anything that touches another app's state, the registry, or install snapshots.

Be honest about the limit: bundle scripts run same-origin with session authority, so a malicious bundle can call a shell route directly whether or not it declared the capability. This check is a review, not a proof. If you cannot read the bundle at all (for example it is a URL you cannot fetch), say so and do not install.

## 3. Tell the user, then wait

Before installing, tell the user in plain words:

- What the app does.
- What each declared capability lets it reach.
- What the security check found, including anything undeclared or suspicious — even if it looks small.

Then wait for the user's go-ahead. Do not install on your own say-so.

## 4. If anything is wrong, do not install

If anything is undeclared, suspicious, or you could not verify it, do not install. Tell the user exactly what you found and why, and let them decide. Never install past a finding without the user explicitly saying so after hearing it.

## 5. Install and verify

Install with `add_app` (hosted or local preview, as the recipe says) using the definition as authored. Then verify: `list_apps` shows it, and the app page renders. Report the result to the user. If the install fails, say what failed and stop — do not retry with a different definition.

Removal is the undo: `remove_app` deletes the definition, state, registry entry, and list references.

See the adding-an-app skill for the capability definitions and the `add_app` procedure.

