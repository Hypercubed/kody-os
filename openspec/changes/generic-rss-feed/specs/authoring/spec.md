## MODIFIED Requirements

### Requirement: Capability authoring rules

An app author SHALL declare capabilities only as `feeds`, `proxy`, or `manageApps` under the app-registry capability rules: unknown keys fail validation, upstream entries are bare HTTPS URLs with TTL 60..86400 and maxBytes 1024..262144, and `manageApps` is a boolean. An author writing a managing app SHALL declare `manageApps` and SHALL use the documented management API routes, not the bridge, and SHALL render its own confirmation UI for modified apps and capability expansion. Capabilities SHALL be described in plain words for installers, never as a promise of sandboxing. An author SHALL NOT add a route or capability that takes a URL from the request; the only sanctioned way to fetch a user-supplied URL is the user-feed route, which reads the URL from the app's own stored state (see User-supplied feed URL route).

#### Scenario: A managing bundle declares manageApps

- **WHEN** a bundle calls the management API
- **THEN** its stored definition declares `manageApps`, or the API returns a plain 404.

#### Scenario: No URL-from-request route

- **WHEN** a definition or bundle proposes fetching a URL supplied in the request
- **THEN** it is rejected: the URL must come from declared capabilities or from the app's stored state via the user-feed route.
