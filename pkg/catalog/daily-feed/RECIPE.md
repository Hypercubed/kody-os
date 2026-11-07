# Install `daily-feed`

Unattended install lands with an empty feed and
the app's built-in empty-state prompt guides setup; this recipe fully
configures the app at install time.

## Steps

1. Install: `install_from_catalog('daily-feed')`.
2. Verify: `list_apps()` lists `daily-feed`.
3. Read the current state: `get_app_state('daily-feed')`. If the `feed`
   cannot be read or parsed, stop here — do not overwrite it.
4. Take one new RSS item from the user (title, link, pubDate, and a plain-text
   description) or from a source the user names. If no item is available, ask
   the user for one.
5. Prepend the new item to the current feed, newest first, keeping at most 14
   entries total. The feed is RSS XML with one item per entry, each with
   title, link, pubDate, and a plain-text description.
6. Write the full feed: `act('daily-feed', 'set_feed', { feed: <full RSS XML> })`.
7. Verify: `get_app_state('daily-feed')` holds the new item, and the app shows
   the latest entry with Previous / Next.

Do not install any other app, and do not publish or change the package source.
