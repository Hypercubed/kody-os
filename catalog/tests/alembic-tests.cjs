'use strict'
// Alembic catalog harness. Needs jsdom:  npm i --no-save jsdom   then:  node catalog/tests/alembic-tests.cjs
// Reads the definition as stored (manifest or inline), simulates KodyBridge v1, validates every save against the
// schema, merges against a simulated server copy, and plays every recipe set to 100% through the page's own buttons.
const { JSDOM } = require('jsdom')
const fs = require('fs')
const path = require('path')
const { readBundleFiles } = require('./read-bundle.cjs')
const read = readBundleFiles(path.join(__dirname, '..', 'alembic', 'definition.json'))
const def = read.definition
const html = read.files['index.html']
const DATA = JSON.parse(html.match(/var DATA = (\[[\s\S]*?\]);\n/)[1])
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
const INIT = def.stateSchema.initial
let fails = 0, passes = 0
function ok(c, m) { if (!c) { fails++; console.log('FAIL', m) } else passes++ }
const tick = n => new Promise(r => setTimeout(r, n || 20))
const clone = o => JSON.parse(JSON.stringify(o))

// validate the action against the schema the way the shell would
function validate(args) {
  const errs = []
  Object.keys(def.actions.save.args).forEach(k => {
    const a = def.actions.save.args[k]
    if (typeof args[k] !== 'string') errs.push('missing ' + k)
    else if (args[k].length > a.maxLength) errs.push(k + ' too long ' + args[k].length + '>' + a.maxLength)
  })
  Object.keys(args).forEach(k => { if (!def.actions.save.args[k]) errs.push('unknown arg ' + k) })
  return errs
}

async function makeDom(seed, withBridge, hooks) {
  const calls = []
  const state = { durable: clone(seed) }
  const page = '<!doctype html><html><head>' + head + '</head><body>' +
    '<section class="app" data-app-id="alembic">' +
    '<script type="application/json" data-kody-state-seed="1" data-app-id="alembic">' + JSON.stringify(seed) + '</script>' +
    '<div class="bundle" data-bundle="alembic" data-action-base="/apps/alembic">' + body + '</div></section></body></html>'
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
    if (!withBridge) return
    w.KodyBridge = { create(section, o) {
      const subs = []
      return {
        getState: () => ({ durable: state.durable, desired: state.durable }),
        subscribe: f => subs.push(f),
        startSpanObserver: () => {},
        dispatch(action, args, optimistic, rebase) {
          calls.push({ action, args: clone(args), hasRebase: typeof rebase === 'function', errs: validate(args) })
          let o = optimistic
          if (hooks && hooks.serverBefore) { const r = rebase(hooks.serverBefore(state.durable), args); o = r.optimistic; calls[calls.length - 1].rebased = clone(r.args) }
          state.durable = clone(o)
          subs.forEach(f => f({ desired: state.durable, durable: state.durable }))
        }
      }
    } }
  } })
  await tick(80)
  const win = dom.window, doc = win.document
  const api = {
    dom, win, doc, calls, state,
    text: sel => doc.querySelector(sel).textContent,
    tab(n) { doc.querySelector('[data-key="tab:' + n + '"]').click() },
    count() { const m = /(\d+) of (\d+)/.exec(doc.getElementById('am-count').textContent); return { found: +m[1], total: +m[2] } },
    setFilter(v) { const i = doc.getElementById('am-filter'); i.value = v; i.dispatchEvent(new win.Event('input', { bubbles: true })) },
    tap(name) {
      if (!doc.getElementById('am-filter')) api.tab('play')
      api.setFilter(name)
      for (let g = 0; g < 60; g++) {
        const t = [...doc.querySelectorAll('.tile')].find(x => x.querySelector('.nm').textContent === name)
        if (t) { t.click(); return }
        const nx = doc.querySelector('[data-key="next"]'); if (nx && !nx.disabled) nx.click(); else break
      }
      throw new Error('no tile ' + name)
    },
    pickSet(k) { api.tab('sets'); doc.querySelector('[data-key="set:' + k + '"]').click() },
    close() { win.close() }
  }
  return api
}

function decode(d) {
  const names = d.n.split('|')
  const recs = d.r.split(';').map(s => { const p = s.split('>'); return { i: p[0].split('.').map(x => parseInt(x, 36)), o: p[1].split('.').map(x => parseInt(x, 36)) } })
  const starters = d.s.split(',').map(x => parseInt(x, 36))
  return { d, names, recs, starters }
}
const idsOf = f => { const a = []; for (let i = 0; i + 1 < f.length; i += 2) a.push(parseInt(f.substr(i, 2), 36)); return a }

;(async function () {
  // basics
  let g = await makeDom(INIT, true)
  ok(g.count().found === 4 && g.count().total === 41, 'opens on Alembic with 4 of 41')
  ok(/Discover Steam/.test(g.text('#am-goal')), 'Alembic goal shown')
  g.tap('Fire'); g.tap('Water')
  ok(g.calls.length === 1 && g.calls[0].action === 'save' && g.calls[0].hasRebase, 'combine saves once with rebase')
  ok(g.calls[0].errs.length === 0, 'save args fit the schema: ' + g.calls[0].errs.join('; '))
  ok(g.calls[0].args.p_alembic.length === 2 && g.calls[0].args.p_little === '', 'only Alembic progress written')
  ok(/Goal reached/.test(g.text('#am-bench')), 'goal reached shown')
  g.tab('help'); const hb = g.doc.querySelector('[data-key="reset"]'); ok(/Start Alembic over/.test(hb.textContent), 'help has per-set erase')
  g.tab('play')
  g.doc.querySelector('[data-key="hint"]').click()
  ok(g.calls[g.calls.length - 1].args.hints[1] === '1', 'hint saved for goal 2')
  g.pickSet('little')
  ok(g.count().total === 595 && g.count().found === 4, 'switch to Little Alchemy')
  ok(g.calls[g.calls.length - 1].args.cur === 'little', 'current set saved')
  g.tap('Earth'); g.tap('Fire')
  const lc = g.calls[g.calls.length - 1]
  ok(lc.args.p_little.length === 2 && lc.args.p_alembic.length === 2, 'sets keep separate progress in one save')
  ok(lc.errs.length === 0, 'schema ok')
  g.pickSet('alembic')
  ok(g.count().found === 5 && g.count().total === 41, 'Alembic progress intact after switching (5 of 41)')
  // erase only this set
  g.tab('help'); g.doc.querySelector('[data-key="reset"]').click()
  ok(/Tap again to erase Alembic/.test(g.text('.help')), 'two-tap erase')
  g.doc.querySelector('[data-key="reset"]').click()
  ok(g.count().found === 4, 'Alembic erased')
  const ec = g.calls[g.calls.length - 1]
  ok(ec.args.p_alembic === '' && ec.args.p_little.length === 2 && ec.args.hints === '000000000', 'erase leaves Little Alchemy alone')
  // reload from saved state
  const saved = clone(g.state.durable); g.close()
  g = await makeDom(saved, true)
  ok(g.count().found === 4, 'boots on saved current set (Alembic)')
  g.pickSet('little'); ok(g.count().found === 5, 'Little progress restored from state')
  g.close()
  // boot straight into a saved current set
  g = await makeDom(Object.assign(clone(INIT), { cur: 'byril', sort: 'az' }), true)
  ok(g.count().total === 336 && g.count().found === 4, 'boots into Alchemy (Byril) from saved cur')
  ok(/Order: A/.test(g.doc.querySelector('[data-key="sort"]').textContent), 'saved sort applied')
  g.close()
  // Use buttons float right, and sort cycles Found -> A-Z -> Tier -> Found
  g = await makeDom(INIT, true)
  g.tap('Fire'); g.tap('Water')
  const useBtn = g.doc.querySelector('#alembic .result .uses .btn')
  ok(useBtn && /Use Steam/.test(useBtn.textContent), 'reaction shows Use Steam')
  ok(g.win.getComputedStyle(useBtn).getPropertyValue('float') === 'right', 'Use button floats right')
  ok(g.win.getComputedStyle(g.doc.querySelector('#alembic .result .uses')).getPropertyValue('display') === 'block', 'uses row is no longer a grid')
  g.pickSet('little')
  g.tap('Earth'); g.tap('Fire')
  g.setFilter('')
  const sortBtn = () => g.doc.querySelector('[data-key="sort"]')
  const tiles = () => Array.prototype.slice.call(g.doc.querySelectorAll('#am-list .tile .nm')).map(function (x) { return x.textContent })
  sortBtn().click()
  ok(/Order: A/.test(sortBtn().textContent), 'sort cycles to A-Z')
  ok(tiles()[3] === 'Lava', 'A-Z puts Lava 4th: ' + tiles().slice(0, 5).join(','))
  sortBtn().click()
  ok(/Order: Tier/.test(sortBtn().textContent), 'sort cycles to Tier')
  ok(tiles()[3] === 'Water' && tiles()[4] === 'Lava', 'Tier puts starters first, then Lava: ' + tiles().slice(0, 5).join(','))
  ok(g.calls[g.calls.length - 1].args.sort === 'tier', 'tier sort saved')
  sortBtn().click()
  ok(/Order: Found/.test(sortBtn().textContent), 'sort cycles back to Found')
  g.close()
  // bogus state
  g = await makeDom(Object.assign(clone(INIT), { cur: 'nope', p_little: 'zz!!9', hints: 'x9', sort: 'weird' }), true)
  ok(g.count().total === 41 && g.count().found === 4, 'bad state falls back safely')
  g.close()
  // merge with another device that saved first
  g = await makeDom(INIT, true, { serverBefore: s => Object.assign(clone(s), { p_alembic: '0a0b', hints: '020000000' }) })
  g.tap('Fire'); g.tap('Water')
  const mc = g.calls[0]
  ok(mc.rebased.p_alembic.indexOf('0a0b') === 0 && mc.rebased.p_alembic.length === 6, 'rebase unions finds with the server copy')
  ok(mc.rebased.hints === '020000000', 'rebase keeps the higher hint level')
  g.close()
  // erase wins over the server copy
  g = await makeDom(Object.assign(clone(INIT), { p_alembic: '0a0b' }), true, { serverBefore: s => Object.assign(clone(s), { p_alembic: '0a0b0c', p_little: '0a' }) })
  g.tab('help'); g.doc.querySelector('[data-key="reset"]').click(); g.doc.querySelector('[data-key="reset"]').click()
  const rc = g.calls[g.calls.length - 1]
  ok(rc.rebased.p_alembic === '' && rc.rebased.p_little === '0a', 'erase stays erased, other sets merged')
  g.close()
  // no bridge
  g = await makeDom(INIT, false); g.tap('Fire'); g.tap('Water')
  ok(g.count().found === 5, 'plays without the bridge')
  g.close()

  // full play-through of every set
  for (const dd of DATA) {
    const E = decode(dd), key = dd.k
    g = await makeDom(INIT, true)
    if (key !== 'alembic') g.pickSet(key)
    ok(g.count().total === E.d.c && g.count().found === E.d.sn, key + ': starts ' + E.d.sn + ' of ' + E.d.c)
    const have = new Set(E.starters)
    const sync = () => { have.clear(); E.starters.forEach(x => have.add(x)); idsOf(g.state.durable['p_' + key]).forEach(x => have.add(x)) }
    let progress = true, rounds = 0
    while (progress && rounds++ < 200) {
      progress = false
      for (const r of E.recs) {
        if (!r.i.every(x => have.has(x)) || r.o.every(x => have.has(x))) continue
        const before = have.size
        r.i.forEach(id => g.tap(E.names[id])); sync()
        if (have.size > before) progress = true
      }
    }
    ok(g.count().found === E.d.c, key + ': completed ' + g.count().found + ' of ' + E.d.c)
    const errs = g.calls.filter(c => c.errs.length)
    ok(errs.length === 0, key + ': every save fits the schema (' + (errs[0] ? errs[0].errs[0] : '') + ')')
    ok(g.state.durable['p_' + key].length === 2 * (E.d.c - E.d.sn), key + ': saved all ids, ' + g.state.durable['p_' + key].length + ' chars')
    g.tab('journal'); g.setFilter('')
    ok(g.doc.querySelectorAll('.journal li').length === Math.min(8, E.d.c - E.d.sn), key + ': journal renders')
    g.close()
  }
  console.log(passes + ' checks passed, ' + fails + ' failed')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error('ERROR', e.stack || e); process.exit(2) })
