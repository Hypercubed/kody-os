# Setting up kody-os

kody-os is a minimal private OS shell shared by humans and agents:
one package, one shell, apps as JSON definitions in package storage.
This guide is for the fork owner and their agent. It takes you, in
order, from a copy of the package to a working OS with a first app
installed. Each step has a check; do not skip the checks, because
several failure modes look like a working setup until the check.

The guide links to [Adding an app](../.agents/skills/adding-an-app/SKILL.md) for the app
definition contract. It does not duplicate that contract.

## Before you start: visibility

A private package has no listing and cannot be forked. For anyone
to fork your package, it must first be made public by its publisher
(the listing step in Kody), with a non-empty root `README.md` and
`AGENTS.md`. If you are setting up a fork and cannot find a
listing, the package is still private: that is a publisher-side
step, not something the fork owner can do from their account.

## How sharing works in Kody's terms

Use these words the way Kody uses them; they collide easily.

- **Fork.** A copy of the package source into the adopter's own
  account, under the adopter's scope. A fork copies source only:
  no installed apps, no app state, no saved package settings
  travel with it. The new fork starts with empty storage. Updates
  from the original do not flow into a fork automatically.
- **Install (one-click).** The human path in the Kody UI. Install
  forks the listing into your account and publishes it when the
  checks pass. If the checks fail, you get an inert fork instead
  (see below) and must publish it yourself.
- **Agent lane.** An agent forks with `communityFork`, which copies
  the published source as an inert copy: nothing runs, and there
  is no saved package yet. A read-only safety review and a publish
  through a repo session follow before anything runs.
- **Publish.** The step that turns a fork (inert source) into a
  running package in your account. Until the fork is published,
  the app does not run.
- **Adopt.** A separate, owner-only step on the Settings page
  (`communityForkAdopt`) that gives a fork the owner's own access
  rights. Adopting installs nothing and is not the install. You
  do not need to adopt to set up kody-os; most fork owners never
  do.
- **Clone.** A read-only git copy of the source onto a machine.
  A clone installs nothing into a Kody account.
- **Use access.** Being granted Use access to someone else's
  package lets you use their running app. It is not owning a
  fork, and none of the setup steps below apply to it.

## Setup sequence

Follow the steps in order. "Your agent" below means an agent
connected to your Kody account with access to the fork.

### 1. Confirm the fork is published

If you installed with one click, confirm the package is published
in your account and the hosted app loads. If the fork is inert
(source only, nothing runs), publish it through a repo session
first; your agent can do the publish, but any approval Kody asks
for in its UI is yours to give — never ask the agent to approve
on your behalf.

Check: the hosted app loads in a browser (the locked page counts
as loading). If it does not load at all, the fork is not
published yet.

### 2. Confirm the registry is empty

A fresh fork starts with empty storage: nothing is seeded,
including no App Store. Ask your agent to run
the package's `list_apps` export against the fork. Expect no
installed apps.

Check: `list_apps` returns no apps. If apps are already listed,
you are looking at the wrong package (for example the original
instead of your fork), or the fork is not fresh. Stop and sort
out which package you are in before continuing.

In the browser, the Apps page shows help instead of a list:
two copy-paste prompts — one to install the App Store
(ask your agent to run `install_from_catalog` for `app-store`),
one to add your own apps — and Home shows the same help
until something is installed. Once apps exist but none are
on Home, Home prompts you to add some from Apps Edit's
Add to home control instead.

### 3. Unlock with a one-time code

Login works two ways: Kody login (a signed-in visitor with app
access skips the device gate entirely), or a one-time code
(OTP) that mints a session cookie. There is no other way in,
and there is no setup step for login: no credential to create,
no value to configure.

To unlock a device with an OTP:

1. Ask the owner (or their agent) to mint a code: the package
   MCP export `mint_otp` returns 4 digits, valid 10 minutes,
   single use, at most 5 outstanding at a time. The digits are
   returned exactly once and are never logged or stored; treat
   them like a password and share them only with the person
   holding the device, only for that unlock.
2. On the device, open the app and type the 4 digits into the
   unlock form. A correct code is burned on first use and mints
   a session: a random token whose hash is stored with 30-day
   expiry, carried in an HttpOnly session cookie. Later requests
   authenticate by session lookup and the address bar stays
   clean.
3. A used or expired code reads exactly like a wrong code.
   At most 10 failed unlock attempts are allowed per 10-minute
   window; further attempts are denied until the window passes,
   and any success clears the counter.

The page footer names the path that authenticated the request
(`via kody`, `via cookie`, or `locked`), so you can confirm
which way in you used.

Sessions end two ways: the in-app Logout link (shown only on
device sessions) deletes that device's session at once, or the
30-day expiry. Logging out one device never affects another.

On the Kindle Scribe, sign in with your Kody account like anywhere else — no code is needed. If the Scribe asks for a code, the Kody session has lapsed; sign in to Kody again.

Check: after entering a code, the shell loads with a clean URL
and the footer reads `via cookie`. After opening the app signed
in to Kody, the footer reads `via kody` and no code is needed.

### 4. Install the first app

Add your first app through your agent with the package's
`add_app` export, using one of the bundled example definitions
in `pkg/catalog/` (for example `counter`). The agent validates
the definition before writing, and the app appears on the Apps
page with no republish. See [Adding an app](../.agents/skills/adding-an-app/SKILL.md)
for the definition contract, verification, homepage placement,
export, and removal.

Check: `list_apps` shows the app, `get_app_state` shows its
initial state, the Apps page shows its tile, and acting on it
from its app page changes its state. That round trip — add,
open, act, state changes — is the proof the setup worked.

A built-in App Store (install catalog apps from the browser,
without an agent) is available once it is installed: install it with
the App Store prompt on the empty Apps page, or ask your
agent to install it with `install_from_catalog('app-store')`. Until
it is installed, adding apps goes through your agent exactly as
above.

### 5. Add further apps the same way

Further apps are added the same way: your agent calls `add_app`
with a validated definition, or the App Store, once it is installed.
Adding an app never needs a republish, and the two stores —
hosted and local preview — are separate, so add an app to each
target where you want it.

## Catalog and trust

The bundled example definitions in `pkg/catalog/` are the
catalog today. Installing an app means trusting its code: bundle
scripts run same-origin with full session authority, so review
third-party definitions before importing them. The trust rule and
the full contract live in [Adding an app](../.agents/skills/adding-an-app/SKILL.md).

## Local development

Local preview runs the real shell against a separate mock store,
so nothing you do locally touches the hosted OS.

```sh
cd pkg
# proxy bypass required on this host
export NO_PROXY='*' no_proxy='*'
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY

kody dev --target mock
# → App ready at http://127.0.0.1:4302/
```

Unlock locally with the same OTP ceremony: ask your agent to
mint an OTP against the mock target (the same `mint_otp`
export, with the mock store standing in for package storage)
and enter it in the unlock form. Add the `counter` fixture with
the registry script, following the `kody execute --target mock`
pattern in `pkg/README.md`:

```sh
cd pkg
python3 -c "import json; d=json.load(open('catalog/counter/definition.json')); json.dump({'op':'add','definition':d}, open('/tmp/add.json','w'))"
kody execute --target mock --file scripts/registry.ts --params "$(cat /tmp/add.json)"
```

Check: the Apps page lists `counter`, `GET /apps/counter`
returns 200, and acting on it changes its state. Useful checks:
`kody dev check --target mock --offline` and
`curl http://127.0.0.1:4302/__kody/dev/status`.

## Troubleshooting

- **The listing does not exist.** The package is still private.
  See "Before you start: visibility" above.
- **The fork does nothing / the app does not load.** The fork is
  inert (source only). Publish it through a repo session, then
  re-check step 1.
- **Apps are already installed in a "fresh" fork.** A fresh
  fork starts empty — nothing is seeded, including no App
  Store — so anything listed was added after the fork, or you
  are in the wrong package. Check the
  package scope and the `list_apps` result before adding
  anything.
- **Locked page after entering a code.** The code was used,
  expired (10 minutes), or mistyped; mint a fresh one. If you
  see "Too many attempts", wait out the 10-minute window.
- **Scribe asks for a code every time.** The Scribe signs in with your Kody account like any other browser — no code is needed. If it asks for a code, the Kody session has lapsed; sign in to Kody again.
- **Logout link missing.** Logout appears only on device
  (cookie) sessions. Kody-login sessions have no device session
  to revoke; sign out of Kody instead.
- **An action fails after a fresh publish.** Confirm the fork
  is the published one and the app was added to the same target
  (hosted vs. local preview stores are separate).

## Verification checklist

Before calling the setup done, confirm all of these:

- [ ] The fork is published and the hosted app loads.
- [ ] `list_apps` was empty before the first app was added.
- [ ] An OTP unlock loads the shell with a clean URL and the
      footer reads `via cookie`; Kody login loads it with the
      footer reading `via kody`.
- [ ] The first app was added via `add_app`, appears on the
      Apps page, and an action changes its state.
- [ ] Logout on a device session revokes only that device.
- [ ] No credential, code, or live value appears anywhere in
      your notes from setup: the OTP digits were used once and
      discarded.

## Setup prompt for your agent

Copy this to a Kody-connected agent, fill in the bracketed part,
and let it follow this guide:

> Set up my fork of kody-os. First open the setup guide with Kody
> search entity `package:<scope>/kody-os#docs/setup.md` (replace
> `<scope>` with my account scope) and read it start to finish,
> then follow its setup sequence in order, verifying each step
> as the guide describes. If the fork is still inert, publish it
> through a repo session. Unlock devices with `mint_otp` as the
> guide describes, add the first app with `add_app` from the
> bundled examples, and verify the add/open/act round trip. Do
> not publish or change the package source beyond the publish
> step, and ask me before approving anything in the Kody UI.
> Report each verification result; stop and ask if any check
> fails.
