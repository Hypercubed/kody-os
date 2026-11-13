# Install `alembic`

The default (trivial) recipe: this app installs unattended from its own
`definition.json` (`installMode: json`), so the recipe is install plus verify.
It declares no capabilities (no feeds, proxy, manageApps, or theme), makes no
network calls, and keeps its progress in app state through one `save` action.

## Steps

1. Install: `install_from_catalog('alembic')`.
2. Verify: `list_apps()` lists `alembic`.
3. Do not publish or change the package source.
