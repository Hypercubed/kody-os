#!/usr/bin/env node
// Temporary LAN relay for `kody dev`.
//
// `kody dev` binds 127.0.0.1 only, so other devices (tablets, phones, a Kindle
// Scrib) cannot reach it. This process listens on 0.0.0.0 and forwards to the
// live dev server on loopback, probing a small port range because `kody dev`
// moves to the next free port when its default is taken.
//
// Usage:
//   node .agents/skills/kody-lan-access/scripts/kody-lan-proxy.js
//   KODY_LAN_PORT=8080 KODY_DEV_PORTS=4302,4303 node .agents/skills/kody-lan-access/scripts/kody-lan-proxy.js
//
// Stop with Ctrl-C, or: pkill -f "[k]ody-lan-proxy"

const http = require('http')

const TARGET_HOST = '127.0.0.1'
const LISTEN_HOST = process.env.KODY_LAN_HOST || '0.0.0.0'
const LISTEN_PORT = Number(process.env.KODY_LAN_PORT || 8080)
const CANDIDATE_PORTS = (process.env.KODY_DEV_PORTS || '4302-4310')
  .split(',')
  .flatMap((part) => {
    const range = part.trim().match(/^(\d+)-(\d+)$/)
    if (!range) return [Number(part)]
    const out = []
    for (let p = Number(range[1]); p <= Number(range[2]); p++) out.push(p)
    return out
  })
  .filter((p) => Number.isInteger(p) && p > 0)

function probe(port, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: TARGET_HOST, port, path: '/__kody/dev/status', timeout: timeoutMs },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200 ? port : null)
      }
    )
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
    req.on('error', () => resolve(null))
  })
}

async function pickTarget() {
  for (const port of CANDIDATE_PORTS) {
    if (await probe(port, 800)) return port
  }
  return null
}

function forward(req, res, port) {
  const headers = Object.assign({}, req.headers)
  headers.host = TARGET_HOST + ':' + port
  const upstream = http.request(
    {
      host: TARGET_HOST,
      port,
      path: req.url,
      method: req.method,
      headers
    },
    (up) => {
      res.writeHead(up.statusCode, up.headers)
      up.pipe(res)
    }
  )
  upstream.on('error', (err) => {
    if (!res.headersSent) {
      res.statusCode = 502
      res.end('kody dev not reachable on ' + CANDIDATE_PORTS.join(', ') + ': ' + err.message)
    }
  })
  req.pipe(upstream)
}

const LOG_REQUESTS = process.env.KODY_LAN_LOG !== '0'

const server = http.createServer(async (req, res) => {
  const port = await pickTarget()
  if (!port) {
    res.statusCode = 502
    res.end('no live kody dev server on ' + CANDIDATE_PORTS.join(', ') + '\n')
    return
  }
  if (LOG_REQUESTS) {
    const started = Date.now()
    res.on('finish', () => {
      const ua = String(req.headers['user-agent'] || '').slice(0, 60)
      process.stdout.write(
        new Date().toISOString() +
          ' ' +
          req.method +
          ' ' +
          req.url +
          ' -> ' +
          res.statusCode +
          ' ' +
          (Date.now() - started) +
          'ms ua="' +
          ua +
          '"\n'
      )
    })
  }
  forward(req, res, port)
})

// Forward WebSocket upgrades too, so live reload keeps working through the relay.
server.on('upgrade', async (req, socket, head) => {
  const port = await pickTarget()
  if (!port) return socket.destroy()
  const headers = Object.assign({}, req.headers)
  headers.host = TARGET_HOST + ':' + port
  const upstream = http.request({
    host: TARGET_HOST,
    port,
    path: req.url,
    method: req.method,
    headers
  })
  upstream.on('upgrade', (upRes, upSocket, upHead) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n')
    for (const [k, v] of Object.entries(upRes.headers)) socket.write(k + ': ' + v + '\r\n')
    socket.write('\r\n')
    if (upHead && upHead.length) socket.write(upHead)
    upSocket.pipe(socket)
    socket.pipe(upSocket)
  })
  upstream.on('error', () => socket.destroy())
  if (head && head.length) upstream.write(head)
  upstream.end()
})

server.listen(LISTEN_PORT, LISTEN_HOST, async () => {
  const port = await pickTarget()
  console.log(
    'kody LAN proxy: http://' +
      (LISTEN_HOST === '0.0.0.0' ? '<this-host>:' : LISTEN_HOST + ':') +
      LISTEN_PORT +
      ' -> live dev port ' +
      (port || '(none found on ' + CANDIDATE_PORTS.join(', ') + ')')
  )
})
