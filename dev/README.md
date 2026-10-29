# Local preview

Runs the real shell (`pkg/src/app.ts`) under plain Node with the
Kody-hosted `kody:runtime` module stubbed out. Repo-local dev tooling —
nothing in `dev/` is published to Kody (the published bundle is `pkg/` only).

## Run

From the repo root, Node 22+:

```sh
node --import ./dev/register.mjs --experimental-strip-types dev/preview.mjs
```

Optional env:

| Var | Default | Meaning |
| --- | ------- | ------- |
| `PORT` | `4499` | listen port |
| `HOST` | `127.0.0.1` | listen host |
| `KODYOS_CODE` | `previewcodeabcdefghjk` | gate code (readable on purpose; never use a real code) |
| `PREVIEW_CODE_FILE` | `/tmp/kodyos-preview-code.txt` | where the code is written for scripts |

Then open `http://HOST:PORT/?k=<code>`.

## Notes

- Seeds `hello-counter` plus every `pkg/examples/*.json` on boot.
- Serves `pkg/public/styles.css` at `/styles.css` and a type-stripped
  `pkg/src/client/index.ts` at `/client.js` (hosting normally injects both).
- Storage is in-memory: restarts wipe pins and states — re-pin afterwards.
- Only `GET` form actions and plain navigation are exercised; the Kody edge
  (POST guards, cookie prefixes) is not emulated.
