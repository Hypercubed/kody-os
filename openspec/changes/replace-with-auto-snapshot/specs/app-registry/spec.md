## MODIFIED Requirements

### Requirement: Export and re-import
`export_install` and `import_install` SHALL be public package exports with behavior unchanged: `export_install` returns the full install envelope (apps, definitions, states, pins, hidden, homepage; recency excluded) and `import_install` installs an envelope into a blank store. The install envelope SHALL carry a format tag so future app kinds restore without breaking current readers.

#### Scenario: Export then blank-install re-import round-trips
- **WHEN** an app is exported, imported into a fresh store, and its state is read back
- **THEN** the definition and state are deep-equal to the originals.

#### Scenario: Install envelope round-trips through a blank store
- **WHEN** an install with apps, states, pins, hidden flags, and homepage order is exported and imported into a blank store
- **THEN** definitions, states, pins, hidden flags, and homepage order match, and Recent starts empty.
