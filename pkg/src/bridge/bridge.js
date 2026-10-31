/* KodyBridge v1 — shell-provided bridge adapter for stateful bundles.
 *
 * Phase 2, decided 2026-10-30: the bridge owns the store, one instance per
 * app section. The framework/renderer only renders from subscriptions.
 * Bundles never scrape spans for initial state when a JSON seed is present,
 * never invent their own fetch queue, and never talk to act() directly.
 *
 * Delivery: this file is plain ES2019 JavaScript, classic-script compatible
 * and module-importable (no import/export, no ?. , no ??, no replaceAll,
 * no .at, no arrow functions, no const/let, no template literals). The
 * shell client module imports it, so it runs before DOMContentLoaded,
 * which is when bundles init. It is also loadable directly in jsdom for
 * the harness, which is how it is tested.
 *
 * Store model (per section):
 *   durable   — mirrors the server, changed only via dispatch to act().
 *   ephemeral — local only, never sent or stored server-side (drafts,
 *               selection, filters). Set with setEphemeral().
 *   derived   — computed from durable + ephemeral, recomputed on change,
 *               never stored. Registered with defineDerived(name, fn).
 *   desired   — the optimistic paint: durable, plus any pending dispatch.
 *
 * Dispatch model (single-flight queue, coalescing, rebase/rollback):
 *   dispatch(action, args, optimistic, rebase) paints optimistic at once
 *   and sends one fetch. A dispatch while one is in flight replaces the
 *   pending dispatch (coalescing): the desired paint is the latest one.
 *   When the in-flight response arrives:
 *     - if a newer dispatch has superseded it, the response is stale:
 *       discard it and send the latest pending dispatch instead;
 *     - if the server state diverges from the sent optimistic state and
 *       the pending dispatch has a rebase function, rebase returns
 *       { args, optimistic } computed from the server state, or null to
 *       drop the pending dispatch and accept the server state;
 *     - without a rebase function, the pending dispatch is sent as-is.
 *   On fetch failure or { ok: false }, the in-flight flag clears and the
 *   desired paint is kept, so the next dispatch re-sends from the desired
 *   state (the counter is not wedged). Durable truth remains server
 *   packageStorage, changed only via act().
 *
 * Nested rebase rule (schemaVersion 5): rebase is per-dispatch, supplied
 * by the bundle, because only the bundle knows whether a pending write
 * is a delta or an absolute set. For a delta, rebase recomputes from the
 * server state (e.g. count: server + (pending - sent)). For an absolute
 * set, rebase returns null (server wins) or the absolute value (bundle
 * wins). The bridge never merges nested objects field-by-field on its
 * own: a nested field is replaced wholesale by the server state unless
 * the bundle's rebase function says otherwise. That is the whole nested
 * rebase rule, and it is deliberate — silent deep-merges lose writes.
 *
 * Span adoption (dual-channel migration): the bridge observes [data-field]
 * spans in its section. A span change that matches the durable state is
 * the bundle's own paint and is ignored. A span change from elsewhere
 * (a shell-form patch) while a dispatch is pending cannot lose the
 * pending desired paint: the bridge repaints the span to the desired
 * value. A span change with nothing pending is adopted as new durable
 * state (the shell form won, e.g. a Reset the bundle did not claim).
 * Span values are coerced with the fieldTypes the bundle passes at
 * create time (integer fields parse as integers, otherwise strings).
 */
(function (global) {
  'use strict';

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function keysOf(obj) {
    var out = [];
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out.push(k);
    }
    return out;
  }

  function readSeedScript(section) {
    var appId = '';
    if (section && section.getAttribute) appId = section.getAttribute('data-app-id') || '';
    /* No app id to match against means a seed can only be trusted when
     * it is the ONLY seed on the page (a bundle-document harness, or a
     * single-app page). With several seeds, returning the first would
     * silently hand this store another app's state (the home-widget
     * bug, Oct 2026), so return null and let the caller fall back to
     * this section's own span readout instead. */
    var scripts = document.querySelectorAll('script[data-kody-state-seed]');
    var loneSeed = null;
    var seedCount = 0;
    for (var i = 0; i < scripts.length; i++) {
      var el = scripts[i];
      if (appId !== '' && el.getAttribute('data-app-id') !== appId) continue;
      var text = el.textContent || '';
      if (text === '') continue;
      try {
        var parsed = JSON.parse(text);
        if (!isRecord(parsed)) continue;
        if (appId !== '') return parsed;
        loneSeed = parsed;
        seedCount += 1;
      } catch (err) {
        if (appId !== '') return null;
      }
    }
    if (appId === '') return seedCount === 1 ? loneSeed : null;
    return null;
  }

  function readSpanState(section, fieldTypes) {
    var out = {};
    if (!section || !section.querySelectorAll) return out;
    var rows = section.querySelectorAll('[data-field]');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var field = row.getAttribute('data-field') || '';
      if (field === '') continue;
      var span = row.querySelector('span');
      var text = span ? span.textContent : row.textContent;
      if (text === null || text === undefined) text = '';
      if (fieldTypes && fieldTypes[field] === 'integer') {
        var n = parseInt(text, 10);
        out[field] = isNaN(n) ? 0 : n;
      } else if (fieldTypes && fieldTypes[field] === 'boolean') {
        out[field] = text === 'true';
      } else {
        out[field] = text;
      }
    }
    return out;
  }

  function createStore(section, opts) {
    opts = opts || {};
    /* Defensive: a seed <script> also carries data-app-id, so a caller
     * that passed a seed element by mistake gets the real section. */
    if (section && section.tagName === 'SCRIPT') {
      var wantId = section.getAttribute ? section.getAttribute('data-app-id') : '';
      var found = null;
      if (wantId !== '') found = document.querySelector('section[data-app-id="' + wantId + '"]');
      section = found || null;
    }
    var fieldTypes = opts.fieldTypes || {};
    var actionBase = opts.actionBase || '';
    if (actionBase === '' && section) {
      var bundle = section.querySelector ? section.querySelector('.bundle') : null;
      if (bundle && bundle.getAttribute) actionBase = bundle.getAttribute('data-action-base') || '';
    }
    var seed = opts.seed;
    if (seed === undefined) seed = readSeedScript(section);
    if (seed === null || seed === undefined) seed = readSpanState(section, fieldTypes);
    var durable = clone(seed) || {};
    var desired = clone(durable);
    var ephemeral = {};
    var derivedFns = {};
    var subscribers = [];
    var inFlight = null;
    var pending = null;
    var generation = 0;
    var lastShellSubmitGeneration = null;
    var reassertNeeded = false;
    var observer = null;
    var observing = false;

    function snapshot() {
      var derived = {};
      var names = keysOf(derivedFns);
      for (var i = 0; i < names.length; i++) {
        try { derived[names[i]] = derivedFns[names[i]](clone(durable), clone(ephemeral)); } catch (err) { derived[names[i]] = undefined; }
      }
      return { durable: clone(durable), ephemeral: clone(ephemeral), derived: derived, desired: clone(desired), pending: pending !== null };
    }

    function notify() {
      var snap = snapshot();
      for (var i = 0; i < subscribers.length; i++) {
        try { subscribers[i](snap); } catch (err) {}
      }
    }

    function paintSpans(state) {
      if (!section || !section.querySelectorAll) return;
      var rows = section.querySelectorAll('[data-field]');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var field = row.getAttribute('data-field') || '';
        if (field === '' || !(field in state)) continue;
        var span = row.querySelector('span');
        if (!span) continue;
        var text = String(state[field]);
        if (span.textContent !== text) span.textContent = text;
      }
    }

    function sendDispatch(d) {
      generation += 1;
      d.generation = generation;
      inFlight = d;
      var parts = [];
      parts.push('action=' + encodeURIComponent(d.action));
      var argNames = keysOf(d.args);
      for (var i = 0; i < argNames.length; i++) {
        parts.push(encodeURIComponent(argNames[i]) + '=' + encodeURIComponent(String(d.args[argNames[i]])));
      }
      parts.push('format=json');
      var sep = actionBase.indexOf('?') === -1 ? '?' : '&';
      var url = actionBase + sep + parts.join('&');
      var fetchFn = opts.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
      if (!fetchFn) {
        inFlight = null;
        return;
      }
      var result;
      try {
        result = fetchFn(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      } catch (err) {
        inFlight = null;
        return;
      }
      function onResponse(data) {
        if (!data || typeof data !== 'object') {
          inFlight = null;
          return;
        }
        if (data.ok !== true) {
          inFlight = null;
          return;
        }
        var server = data.state;
        if (!isRecord(server)) {
          inFlight = null;
          return;
        }
        var mine = inFlight === d;
        if (!mine) {
          return;
        }
        inFlight = null;
        if (reassertNeeded && typeof opts.reassert === 'function') {
          reassertNeeded = false;
          var reasserted = null;
          try { reasserted = opts.reassert(clone(desired)); } catch (err) { reasserted = null; }
          pending = null;
          if (reasserted && reasserted.action) {
            var rd = { action: reasserted.action, args: reasserted.args || {}, optimistic: clone(reasserted.optimistic) || clone(desired), rebase: reasserted.rebase || null };
            desired = clone(rd.optimistic);
            paintSpans(desired);
            notify();
            sendDispatch(rd);
            return;
          }
          durable = clone(desired);
          notify();
          return;
        }
        reassertNeeded = false;
        var nextPending = pending;
        pending = null;
        if (nextPending === null) {
          durable = clone(server);
          desired = clone(server);
          paintSpans(durable);
          notify();
          return;
        }
        var rebased = null;
        if (typeof nextPending.rebase === 'function') {
          try { rebased = nextPending.rebase(clone(server), clone(nextPending.optimistic), clone(d.optimistic)); } catch (err) { rebased = null; }
        }
        if (rebased === null && typeof nextPending.rebase === 'function') {
          durable = clone(server);
          desired = clone(server);
          paintSpans(durable);
          notify();
          return;
        }
        if (rebased !== null) {
          nextPending.args = rebased.args || nextPending.args;
          nextPending.optimistic = rebased.optimistic || nextPending.optimistic;
          desired = clone(nextPending.optimistic);
          paintSpans(desired);
          notify();
        } else {
          desired = clone(nextPending.optimistic);
          paintSpans(desired);
        }
        sendDispatch(nextPending);
      }
      if (result && typeof result.then === 'function') {
        result.then(function (response) {
          if (response && typeof response.json === 'function') {
            return response.json().then(function (data) { onResponse(data); }).catch(function () { inFlight = null; });
          }
          onResponse(response);
        }).catch(function () { inFlight = null; });
      } else {
        onResponse(result);
      }
    }

    function dispatch(action, args, optimistic, rebase) {
      var d = { action: action, args: args || {}, optimistic: clone(optimistic) || clone(desired), rebase: rebase || null };
      desired = clone(d.optimistic);
      paintSpans(desired);
      notify();
      if (inFlight !== null) {
        pending = d;
        return;
      }
      sendDispatch(d);
    }

    function setEphemeral(field, value) {
      ephemeral[field] = value;
      notify();
    }

    function defineDerived(name, fn) {
      derivedFns[name] = fn;
      notify();
    }

    function subscribe(fn) {
      subscribers.push(fn);
      return function () {
        var at = subscribers.indexOf(fn);
        if (at !== -1) subscribers.splice(at, 1);
      };
    }

    function claimForm(form, action, argsFn, rebaseFn) {
      if (!form || !form.addEventListener) return;
      form.addEventListener('submit', function (event) {
        try { event.preventDefault(); } catch (err) {}
        var args = {};
        try { args = argsFn ? argsFn() : {}; } catch (err) { args = {}; }
        var optimistic = clone(desired);
        if (args && typeof args === 'object') {
          var names = keysOf(args);
          for (var i = 0; i < names.length; i++) {
            if (names[i] === 'value' && keysOf(optimistic).length === 1) {
              optimistic[keysOf(optimistic)[0]] = args[names[i]];
            }
          }
        }
        dispatch(action, args, optimistic, rebaseFn || null);
      }, true);
    }

    function startSpanObserver() {
      if (observing || !section || typeof MutationObserver === 'undefined') return;
      observing = true;
      observer = new MutationObserver(function (mutations) {
        var handledPatch = false;
        for (var mi = 0; mi < mutations.length; mi++) {
          var target = mutations[mi].target;
          var row = target;
          while (row && !(row.getAttribute && row.getAttribute('data-field'))) {
            row = row.parentNode;
          }
          if (!row) continue;
          var field = row.getAttribute('data-field') || '';
          if (field === '') continue;
          var span = row.querySelector ? row.querySelector('span') : null;
          var text = span ? span.textContent : '';
          var value = text;
          if (fieldTypes[field] === 'integer') {
            var n = parseInt(text, 10);
            value = isNaN(n) ? 0 : n;
          } else if (fieldTypes[field] === 'boolean') {
            value = text === 'true';
          }
          if (value === durable[field] || value === desired[field]) continue;
          /* Stale shell patch: a shell form was submitted, then a bundle
           * dispatch was sent after that submit, and now the shell's
           * patch arrives. The patch predates the bundle step, so it
           * must not lose it: repaint the desired value and ignore it. */
          if (lastShellSubmitGeneration !== null && generation > lastShellSubmitGeneration) {
            handledPatch = true;
            paintSpans(desired);
            continue;
          }
          /* External authority, but only if the bundle can reassert the
           * adopted value when an in-flight response later returns a
           * different server value. Without a reassert function the
           * bridge cannot know which action reproduces the adopted
           * state, so a pending dispatch wins instead (no lost writes). */
          if ((inFlight !== null || pending !== null) && typeof opts.reassert !== 'function') {
            paintSpans(desired);
            continue;
          }
          handledPatch = true;
          if (inFlight !== null) reassertNeeded = true;
          pending = null;
          durable[field] = value;
          desired[field] = value;
          notify();
        }
        if (handledPatch) lastShellSubmitGeneration = null;
      });
      observer.observe(section, { childList: true, characterData: true, subtree: true });
      if (section.addEventListener) {
        section.addEventListener('submit', function () {
          lastShellSubmitGeneration = generation;
        }, false);
      }
    }

    function destroy() {
      if (observer) {
        try { observer.disconnect(); } catch (err) {}
        observer = null;
      }
      observing = false;
      subscribers = [];
    }

    var store = {
      version: '1',
      getState: function () { return snapshot(); },
      get: function (field) {
        if (field in desired) return desired[field];
        return undefined;
      },
      dispatch: dispatch,
      setEphemeral: setEphemeral,
      defineDerived: defineDerived,
      subscribe: subscribe,
      claimForm: claimForm,
      startSpanObserver: startSpanObserver,
      paintSpans: paintSpans,
      destroy: destroy,
      readSeed: function () { return readSeedScript(section); },
      readSpans: function () { return readSpanState(section, fieldTypes); }
    };
    return store;
  }

  var api = {
    version: '1',
    create: createStore,
    readSeedScript: readSeedScript,
    readSpanState: readSpanState
  };

  global.KodyBridge = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
