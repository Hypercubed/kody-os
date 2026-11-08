---
name: kody-lan-access
description: Expose a running `kody dev` preview to another device on the LAN (Kindle, phone, tablet) with a small loopback relay, and diagnose device-vs-PC rendering differences such as missing images. Use when the user wants to open the local preview from another device, asks about LAN or network access to `kody dev`, cannot reach 127.0.0.1 from a tablet/reader, or reports that the dev preview looks different on the device.
---

# Kody dev LAN access

Developer tooling, not a package feature. Do not edit `pkg/` source for this;
the relay is a separate process and the repo version does not change.

## When to use

- The user wants a running `kody dev` preview open on another device.
- A device cannot reach the preview, though it works on the host.
- The device renders something differently from the PC browser (missing
  images, layout, actions). First rule out the device, not the app.

## Why direct access fails

`kody dev` binds IPv4 loopback with no flag. In the installed CLI (1.31.10):

```js
// @kodycodes/cli/dist/dev-command-RS24SIQM.js
const host = options.host ?? '127.0.0.1'
```

`kody dev serve --help` lists no `--host`, and `--allow-private-network`
governs outgoing requests, not the listen address. Curling the host's LAN IP
fails:

```sh
curl http://<host-ip>:4302/     # refused / timed out
```

Confirm the real bind address before blaming the network:

```sh
ss -ltnp | grep -E '430[0-9]'
lsof -Pan -p <pid> -i
```

`127.0.0.1:4302` instead of `0.0.0.0:4302` is the whole problem.

## Workflow

1. Confirm the dev server and its port: `curl -s http://127.0.0.1:<port>/__kody/dev/status`,
   or read the `kody dev` startup line. The port moves to the next free one
   (4302, 4303, ...) when the default is taken.
2. Find the host LAN IP: `hostname -I` or `ip -4 addr`.
3. Start the relay from the repo root — preferred path:

   ```sh
   ./scripts/dev-local-catalog.sh --lan
   # starts catalog + kody dev + LAN proxy; prints the http://<host-ip>:8080/ URL
   ```

   Fallback (proxy alone, when `kody dev` is already running):

   ```sh
   node .agents/skills/kody-lan-access/scripts/kody-lan-proxy.js
   # kody LAN proxy: http://<this-host>:8080 -> live dev port 4302
   ```

   Detached fallback:

   ```sh
   setsid nohup node .agents/skills/kody-lan-access/scripts/kody-lan-proxy.js \
     >/tmp/kody-lan-proxy.log 2>&1 &
   ```

4. Verify through the relay:
   - `http://127.0.0.1:8080/__kody/dev/status` -> 200
   - `http://<host-ip>:8080/__kody/dev/status` -> 200
   - `/` -> 404 until unlocked; that is the honest locked response, not a failure.

   Use `curl --noproxy '*'` when a proxy environment is set.

5. Open `http://<host-ip>:8080/` on the device and enter the 4-digit OTP.

## Relay behavior

`scripts/kody-lan-proxy.js`:

- listens on `0.0.0.0:8080`;
- probes `/__kody/dev/status` across `4302`–`4310` and forwards to the live port,
  rewriting `Host`;
- forwards WebSocket upgrades, so live reload works through it;
- re-probes per request, so a dev-server restart on another port still works;
- logs one line per request (method, path, status, UA) unless `KODY_LAN_LOG=0`.

Overrides: `KODY_LAN_HOST` (default `0.0.0.0`), `KODY_LAN_PORT` (default `8080`),
`KODY_DEV_PORTS` (default `4302-4310`, comma list or `start-end`).

## OTP with a stopped server

Minting writes the mock store on disk; a running preview serves the snapshot it
read at startup and will not see the new code. Stop `kody dev`, mint, restart:

```sh
kody execute --target mock --file scripts/mint-dev-otp.ts
```

See `pkg/AGENTS.md` ("Mock writes need a stopped server").

## Device and browser notes

- The shell works without JavaScript: unlock and actions are GET forms with a
  redirect. In-place patching and live reload may not run; that is expected.
- **Missing images on a Kindle is usually the browser setting, not the app.**
  Kindle browser: three-dot menu -> Browser Settings -> **Disable Images**. When
  on, every `<img>` fails, including ordinary HTTP PNGs and `data:` URIs, while
  inline SVG still renders. The hosted app fails the same way, which is the tell.
- To prove it, serve one page with an inline SVG, a `data:` PNG, and an HTTP PNG.
  Inline SVG rendering while both PNGs break confirms the device setting.

## Security

The relay exposes the whole dev server, including the device gate and the
ungated `/__kody/dev/status`, to anything that can reach the port. Plain HTTP,
no TLS. Trusted LAN only; never public Wi-Fi, never beyond the local network.

## Troubleshooting

- **Times out from the device, works on the host.** Wi-Fi client isolation
  (guest/IoT SSIDs) or a host firewall on the relay port. Same SSID, or open
  the port.
- **`502 no live kody dev server`.** `kody dev` is down or outside
  `KODY_DEV_PORTS`. Read its startup port and pass the range.
- **Relay works, unlock fails.** Mint with the preview stopped (above).
- **Actions do not patch in place.** Old browser without the client
  enhancement; forms still submit.
- **No images.** Kindle "Disable Images" setting (above).

## Cleanup

```sh
pkill -f "[k]ody-lan-proxy"
```
