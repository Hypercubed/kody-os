# Install `mac-puzzle`

The default (trivial) recipe: this app installs unattended from its own
`definition.json` (`installMode: json`), so the recipe is install plus verify.

## Steps

1. Install: `install_from_catalog('mac-puzzle')`.
2. Verify: `list_apps()` lists `mac-puzzle`.
3. Do not publish or change the package source.
