# Install `generic-feed`

`installMode: recipe-or-json`. Unattended install lands unconfigured (blank
RSS URL prompt); this recipe fully configures the app at install time.

## Steps

1. Install: `install_from_catalog('generic-feed')`.
2. Verify: `list_apps()` lists `generic-feed`.
3. Ask the user for the RSS feed URL.
4. Read the current state: `get_app_state('generic-feed')`. If it cannot be
   read or parsed, stop here — do not overwrite the feed.
5. Fetch the RSS feed at that URL and parse its items (title, link, pubDate,
   and a plain-text description). If the fetch fails or the XML cannot be
   parsed, stop — do not overwrite the feed.
6. Set the full feed, newest first, at most 14 entries:
   `act('generic-feed', 'set_feed', { feed: <full RSS XML> })`.
7. Verify: `get_app_state('generic-feed')` holds the fetched items, and the app
   shows the latest entry with Previous / Next.

Do not install any other app, and do not publish or change the package source.
