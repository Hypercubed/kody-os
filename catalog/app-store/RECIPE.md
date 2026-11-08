# App Store

Install the browser management surface for the shipped catalog.

Source: https://github.com/Hypercubed/kody-os/tree/main/catalog/app-store

1. Install: `install_from_catalog` with id `app-store` and the catalog base `https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/` (the same base the Store declares in its `catalog` proxy entry; without a base and with no Store installed the call is refused).
2. Verify: `list_apps()` reports `app-store` as installed.
3. Open `/apps/app-store` and confirm the Store page renders its rows.

The App Store is a plain unattended JSON install: it has no setup beyond
installing it, so its definition carries no `installMode`. Do not publish or
change the package source.
