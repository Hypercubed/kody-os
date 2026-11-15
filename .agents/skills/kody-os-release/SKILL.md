# Release kody-os

## Before you publish

- Confirm the release branch merged to `main` on GitHub and the user reviewed it.

- Run `openspec validate` for every change in the release on the PC, because the VM has no openspec CLI.

- Confirm Scribe verification ran on the device for any change that needs it, and do not mark it done if it was not run.

- Read `pkg/package.json` for the current version and build, because it is the single source of truth for both.

- Bump the build by exactly 1 in the same commit as the release, and never reset, skip, or reuse a version and build pair.

- Tag the merge commit on GitHub with the version, such as `4.4.0`, after the merge.

- Follow the version policy in `AGENTS.md` for what counts as a major, minor, or patch bump.

## Publish the shell to Kody

- Treat Git publishing and Kody publishing as separate steps, because pushing to GitHub does not publish to Kody.

- Mint an Artifacts remote with the Kody `api` tool and operation `packageGetGitRemote`, passing the package id or name with scope read and write and a ttl in seconds.

- Read the returned authenticated remote URL and git extra header, and never print, log, or repeat either value, because they hold live tokens.

- Clone the Artifacts remote into a temp directory and replace its tree with GitHub main's `pkg/` directory, because only `pkg/` ships and Kody does not pull GitHub main.

- Commit the replaced tree using the configured git identity and push it fast-forward.

- Call the Kody `api` tool with operation `packagePublishExternalPush` to start the publish.

- Poll the Kody `api` tool with operation `workflowRunList` and the workflow id until the run status is `complete`.

- Delete every temp file that held the Artifacts remote URL or git header as soon as the push finishes.

- Verify the live shell shows the new version and build in its status bar, such as `v4.4.0 b50`, and run the `packageAppFetch` smoke test.

## Update the catalog

- Publish the shell first and update the catalog second, because the catalog pin follows the shell.

- Freeze the old catalog tag and never move it, because a tag is a semver line and moving it would repoint the old line.

- Create a new catalog tag for the new line, such as `4.3` for the line that follows `4.2`.

- Let the Store self-update from the catalog, because a Store update with the shell unchanged needs no shell change.

## Guardrails

- Push one branch to one remote by name, and never use `--mirror` or `--all`.

- Name the exact scope before any commit, push, or publish, and wait for the user's direction, because a commit, push, or publish is never implied.

- Keep the publish and the catalog pin as two separate moves in that order, and do not combine them into one step.
