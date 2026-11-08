# Install `calculator`

The default (trivial) recipe: this app installs unattended from its own
`definition.json` (`installMode: json`), so the recipe is install plus verify.

## Steps

1. Install: `install_from_catalog('calculator')`.
2. Verify: `list_apps()` lists `calculator`.
3. Do not publish or change the package source.
