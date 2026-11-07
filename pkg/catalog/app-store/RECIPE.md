# App Store

Install the browser management surface for the shipped catalog.

1. Install: `install_from_catalog('app-store')`.
2. Verify: `list_apps()` reports `app-store` as installed.
3. Open `/apps/app-store` and confirm the Store page renders its rows.

The App Store is a plain unattended JSON install: it has no setup beyond
installing it, so its definition carries no `installMode`. Do not publish or
change the package source.
