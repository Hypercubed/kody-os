# Spec Delta

## Purpose

Move the device access key out of the URL on browsers that support it, while keeping `?k=` as the working fallback for storage-less sessions.

## ADDED Requirements

### Requirement: Three key-delivery paths with visible fallback
The system SHALL authenticate requests via cookie first, then the JS enhancement path (key read from `localStorage`, attached to enhancement requests), then `?k=` query. Server-rendered links, forms, and redirects SHALL carry `?k=` only when the request authenticated via query; cookie- or enhancement-authenticated responses SHALL render clean URLs.

#### Scenario: Cookied browser gets clean URLs
- **WHEN** a request presents a valid auth cookie
- **THEN** the response HTML contains no `?k=` in links, forms, or redirects.

#### Scenario: Query-authenticated session keeps working
- **WHEN** a request authenticates via `?k=` with no valid cookie
- **THEN** the response keeps `?k=` stamped in links, forms, and redirects exactly as today.

#### Scenario: Enhancement attaches the key without links
- **WHEN** the client enhancement runs with a stored key and `fetch` available
- **THEN** enhancement requests authenticate without `?k=` in the page's rendered links, falling back to native submit on any failure.

### Requirement: Footer reports the active auth path
Every shell page footer SHALL include the active auth path (`via cookie`, `via key`, or `locked`) so cookie survival through Kody's edge is observable without devtools.

#### Scenario: Owner reads the auth path off the page
- **WHEN** any authenticated page is fetched
- **THEN** the footer names the path that authenticated the request.

### Requirement: Unlock writes localStorage where available
The unlock form's success path SHALL write the key to `localStorage` via an inline script when storage exists, in addition to the existing cookie; storage absence SHALL never block the redirect.

#### Scenario: Storage-less unlock still lands
- **WHEN** the unlock form succeeds in a browser without `localStorage`
- **THEN** the redirect carries `?k=` and the session works exactly as today.
