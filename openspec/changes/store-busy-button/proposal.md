# Store buttons show a busy state while an async action runs

## Why

Pressing Add (or Update, Overwrite, Restore, Remove) on an App Catalog row fires an async management-API call that can take a while. While it runs, the button stays enabled and unchanged — the only feedback is the small "Working…" status line, which is easy to miss and nowhere near the button just tapped. It looks as if nothing happened, and the button can be tapped again, firing a duplicate request.

## What

Every Store button that starts an async action becomes a busy button while its request is in flight: it is disabled (no double-submit) and its label changes to a working state naming the action (e.g. "Adding…"). When the action settles without re-rendering the rows (an error, or a needs-confirmation response), the button is re-enabled and its label restored. On success the rows re-render, which replaces the button anyway.

This covers the row action buttons (Add, Update, Overwrite, Restore, Remove), the "Update All" button, and the confirm dialog's Confirm button.

## What this is not

There is deliberately no rotating spinner. The shell globally disables all CSS animation (`* { animation: none !important; transition: none !important; }` in `pkg/public/styles.css`, the e-ink discipline in `pkg/docs/scribe-limitations.md`), so a `@keyframes` spinner would be inert. A timer-driven text spinner would need repeated DOM updates, which the same limitations doc rules out (timers, polling, and re-render churn cause ghosting on a 1–10 FPS e-ink display). A disabled button with a working label is the Scribe-safe equivalent: one text change, no animation, no timer.

## Out of scope

- The Retry button (a reload, not a mutation; the status already says "Loading apps…" during load).
- Any change to what the actions do, to the management API, or to the confirm dialog's wording.
- The shell's no-animation rule itself: unchanged.
