function storeRoot() {
  var root = document.querySelector('section[data-app-id="app-store"]');
  if (root) { return root; }
  return document;
}
function storeManageBase() {
  var root = storeRoot();
  var el = root.querySelector('[data-action-base]');
  var actionBase = el ? el.getAttribute('data-action-base') : '';
  if (actionBase && actionBase.indexOf('/apps/app-store') !== -1) {
    return actionBase.slice(0, actionBase.indexOf('/apps/app-store'));
  }
  var path = window.location.pathname || '';
  var idx = path.indexOf('/apps/');
  if (idx !== -1) { return path.slice(0, idx); }
  return '';
}
function storePackageSlug() {
  // The shell stamps the full package reference (@owner/leaf) on the
  // bundle container as data-package-ref; use it when present — the
  // shell is the single source of truth, the same value its Help
  // prompts use. Otherwise derive it from the host + mount (an older
  // shell stamps no attribute, and the mock/localhost has none), falling
  // back to the bare leaf on a non-Kody host.
  var root = storeRoot();
  var providedEl = root.querySelector('[data-package-ref]');
  var provided = providedEl ? providedEl.getAttribute('data-package-ref') : '';
  if (provided) { return provided; }
  var base = storeManageBase();
  var leaf = 'kody-os';
  if (base) {
    var slug = base.charAt(0) === '/' ? base.slice(1) : base;
    var slash = slug.indexOf('/');
    if (slash !== -1) { slug = slug.slice(0, slash); }
    if (slug) { leaf = slug; }
  }
  var host = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
  var suffix = '.kody.run';
  if (host.length > suffix.length && host.slice(host.length - suffix.length) === suffix) {
    var owner = host.slice(0, host.length - suffix.length);
    if (owner) { return '@' + owner + '/' + leaf; }
  }
  return leaf;
}
function storeBadge(status) {
  if (status === 'not-installed') { return 'Not installed'; }
  if (status === 'up-to-date') { return 'Up to date'; }
  if (status === 'behind-clean') { return 'Update available'; }
  if (status === 'catalog-differing') { return 'Update available'; }
  if (status === 'behind-modified') { return 'Modified \u00b7 update available'; }
  if (status === 'modified-current') { return 'Modified'; }
  if (status === 'modified-ahead') { return 'Ahead of catalog'; }
  if (status === 'snapshot-less') { return 'Installed'; }
  if (status === 'absorbed') { return 'Absorbed'; }
  if (status === 'absorbed-behind') { return 'Absorbed \u00b7 update available'; }
  if (status === 'storage-only') { return 'Storage only'; }
  if (status === 'storage-only-formerly') { return 'Storage only \u00b7 formerly in catalog'; }
  return 'Installed';
}
function storeApi(action, params, root) {
  var url = storeManageBase() + '/manage/' + action + '?app=app-store' + (params || '');
  return fetch(url, { credentials: 'same-origin' }).then(function (res) {
    return res.json().catch(function () { return { ok: false, error: 'App Catalog could not read the catalog.' }; });
  }).catch(function () { return { ok: false, error: 'App Catalog could not reach the shell.' }; });
}
function storeButton(label, onClick) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}
function storeBusyButton(label, busyLabel, onClick) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.addEventListener('click', function () {
    if (btn.disabled) { return; }
    btn.disabled = true;
    btn.textContent = busyLabel;
    var done = function () {
      btn.disabled = false;
      btn.textContent = label;
    };
    try {
      var result = onClick();
      if (result && typeof result.then === 'function') { result.then(done, done); }
      else { done(); }
    } catch (e) {
      done();
      throw e;
    }
  });
  return btn;
}
function storeCapsText(caps) {
  var parts = [];
  if (!caps) { return ''; }
  if (caps.manageApps) { parts.push('Can manage other apps.'); }
  if (caps.feedHosts && caps.feedHosts.length > 0) { parts.push('Feeds: ' + caps.feedHosts.join(', ') + '.'); }
  if (caps.proxyHosts && caps.proxyHosts.length > 0) { parts.push('Proxy: ' + caps.proxyHosts.join(', ') + '.'); }
  if (caps.themeView && caps.themeSet) { parts.push('Can view and change the shell theme.'); }
  else if (caps.themeView) { parts.push('Can view the shell theme.'); }
  else if (caps.themeSet) { parts.push('Can change the shell theme.'); }
  return parts.join(' ');
}
function storeAgentPrompt(row) {
  var ops = 'Read package:' + storePackageSlug() + '#OPERATIONS.md';
  if (row.needsNewerShell || row.needsNewerSchema) { return null; }
  if (!row.installed) {
    if (!row.folderUrl) { return null; }
    return { summary: 'Install with an agent', prompt: ops + ', then install this app: ' + row.folderUrl };
  }
  // Remove needs only the id (remove_app(id)); the catalog folder is
  // irrelevant to deleting the installed app, so it is not gated on a
  // folder URL and the prompt names the id, not the folder.
  if (row.status === 'up-to-date' || row.status === 'absorbed') {
    return { summary: 'Remove with an agent', prompt: ops + ', then remove this app: ' + row.id };
  }
  if (!row.folderUrl) { return null; }
  if (row.status === 'behind-clean' || row.status === 'catalog-differing') {
    return { summary: 'Update with an agent', prompt: ops + ', then update this app to the latest catalog version: ' + row.folderUrl };
  }
  if (row.status === 'behind-modified' || row.status === 'modified-current' || row.status === 'absorbed-behind') {
    return { summary: 'Absorb with an agent', prompt: ops + ', then absorb the catalog changes into this app, keeping my local customizations: ' + row.folderUrl };
  }
  if (row.status === 'modified-ahead') {
    return { summary: 'Restore with an agent', prompt: ops + ', then restore this app to the catalog copy: ' + row.folderUrl };
  }
  if (row.status === 'snapshot-less') {
    return { summary: 'Overwrite with an agent', prompt: ops + ', then overwrite this app with the catalog copy: ' + row.folderUrl };
  }
  return null;
}
function storeInit() {
  var root = storeRoot();
  var wrap = root.querySelector('.store-wrap');
  if (!wrap) { return; }
  var nojs = wrap.querySelector('.store-nojs');
  if (nojs) { nojs.style.display = 'none'; }
  var status = wrap.querySelector('.store-status');
  var list = wrap.querySelector('.store-list');
  var confirmBox = wrap.querySelector('.store-confirm');
  var retry = wrap.querySelector('.store-retry');
  var updateAll = wrap.querySelector('.store-update-all');
  var selfSection = wrap.querySelector('.store-self');
  var updateAllBtn = updateAll ? updateAll.querySelector('button') : null;
  if (updateAllBtn) { updateAllBtn.addEventListener('click', updateAllNow); }
  var rows = [];
  var storeSelf = null;
  var afterLoadStatus = '';
  // The github.com URL of the catalog directory the apps are listed
  // from. Set from the management `info` action before rows load,
  // then refreshed from the rows' folder URLs once they load, so it
  // follows the actual listing base. Never seeded from static text:
  // the static loading text in index.html carries no URL.
  var catalogSourceUrl = null;
  function catalogUrlFromRows() {
    for (var i = 0; i < rows.length; i++) {
      var folder = rows[i] && rows[i].folderUrl;
      if (folder) {
        var cut = folder.lastIndexOf('/');
        if (cut > 0) { return folder.slice(0, cut); }
      }
    }
    return null;
  }
  function loadingText() {
    return catalogSourceUrl ? 'Loading apps from ' + catalogSourceUrl + '…' : 'Loading apps…';
  }
  function setStatus(text) { if (status) { status.textContent = text; } }
  function safeUpdatable() {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].needsNewerShell || rows[i].needsNewerSchema) { continue; }
      if (rows[i].installed && (rows[i].status === 'behind-clean' || rows[i].status === 'catalog-differing')) { out.push(rows[i]); }
    }
    return out;
  }
  function updateAllNow() {
    var targets = safeUpdatable();
    if (targets.length === 0) { return; }
    if (updateAllBtn) { updateAllBtn.disabled = true; updateAllBtn.textContent = 'Updating all…'; }
    setStatus('Working…');
    var index = 0;
    var updated = 0;
    var skipped = 0;
    var failed = 0;
    function step() {
      if (index >= targets.length) {
        var summary = 'Updated ' + updated + (updated === 1 ? ' app.' : ' apps.');
        if (skipped > 0) { summary += ' ' + skipped + ' skipped (needs confirmation).'; }
        if (failed > 0) { summary += ' ' + failed + ' failed.'; }
        afterLoadStatus = summary;
        if (updateAllBtn) { updateAllBtn.disabled = false; updateAllBtn.textContent = 'Update All'; }
        load();
        return;
      }
      var row = targets[index];
      index += 1;
      storeApi('update', '&id=' + encodeURIComponent(row.id)).then(function (res) {
        if (res.ok) { updated += 1; }
        else if (res.needsConfirmation) { skipped += 1; }
        else { failed += 1; }
        step();
      });
    }
    step();
  }
  function clearConfirm() { if (confirmBox) { confirmBox.innerHTML = ''; confirmBox.style.display = 'none'; } var old = document.querySelector('.store-dialog'); if (old && old.parentNode) { old.parentNode.removeChild(old); } }
  function showConfirm(kind, row, result) {
    clearConfirm();
    var overlay = document.createElement('div');
    overlay.className = 'store-dialog';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    var panel = document.createElement('div');
    panel.className = 'store-dialog-panel';
    var title = document.createElement('h3');
    title.textContent = 'Confirm ' + (kind === 'restore' ? 'restore' : kind === 'remove' ? 'remove' : 'update') + ': ' + row.label;
    panel.appendChild(title);
    var loss = document.createElement('p');
    loss.textContent = 'This will replace this app\u2019s definition \u2014 bundle files, stateSchema, actions, capabilities, and metadata \u2014 with the catalog copy. Your custom definition changes will be lost and cannot be recovered afterwards unless you exported the app first. State is preserved for fields still declared in the new definition, while dropped fields reset to their initial values. Pins, hidden flags, homepage placement, and recency are untouched.';
    if (kind === 'remove') { loss.textContent = 'This will remove this app: its definition and its saved state will be deleted, and it will disappear from the home screen, pins, and recency. This cannot be recovered afterwards unless you exported the app first.'; }
    panel.appendChild(loss);
    if (result && result.additions && result.additions.length > 0) {
      var adds = document.createElement('p');
      adds.textContent = 'This update also adds: ' + result.additions.join(', ') + '.';
      panel.appendChild(adds);
    }
    var confirmBtn = storeBusyButton('Confirm ' + (kind === 'restore' ? 'restore' : kind === 'remove' ? 'remove' : 'update'), 'Confirming…', function () {
      setStatus('Working\u2026');
      return storeApi(kind, '&id=' + encodeURIComponent(row.id) + '&confirmed=1').then(function (res) {
        if (res.ok) { clearConfirm(); load(); } else { clearConfirm(); setStatus(res.error || 'That change failed.'); }
      });
    });
    var cancelBtn = storeButton('Cancel', function () { clearConfirm(); setStatus(''); });
    panel.appendChild(confirmBtn);
    panel.appendChild(cancelBtn);
    overlay.appendChild(panel);
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) { clearConfirm(); setStatus(''); } });
    var host = document.body || root;
    host.appendChild(overlay);
    if (confirmBtn.focus) { confirmBtn.focus(); }
  }

  function render() {
    if (!list) { return; }
    list.innerHTML = '';
    if (updateAll) { updateAll.hidden = safeUpdatable().length === 0; }
    for (var i = 0; i < rows.length; i++) {
      (function (row) {
        var li = document.createElement('li');
        li.className = 'store-row';
        var main = document.createElement('span');
        main.className = 'store-main';
        var iconSpan = document.createElement('span');
        iconSpan.className = 'store-icon';
        iconSpan.setAttribute('aria-hidden', 'true');
        if (row.icon && row.icon.replace(/^\s+/, '').toLowerCase().indexOf('<svg') === 0) {
          iconSpan.innerHTML = row.icon;
        } else {
          iconSpan.textContent = row.icon || '#';
        }
        main.appendChild(iconSpan);
        var label = document.createElement('span');
        label.className = 'store-label';
        label.textContent = row.label;
        main.appendChild(label);
        li.appendChild(main);
        var body = document.createElement('span');
        body.className = 'store-body';
        if (row.description) {
          var desc = document.createElement('span');
          desc.className = 'store-desc';
          desc.textContent = row.description;
          body.appendChild(desc);
        }
        var caps = storeCapsText(row.capabilities);
        if (caps !== '') {
          var capsEl = document.createElement('span');
          capsEl.className = 'store-caps';
          capsEl.textContent = caps;
          body.appendChild(capsEl);
        }
        var badgeText = storeBadge(row.status);
        if (badgeText !== 'Installed' && badgeText !== 'Not installed' && badgeText !== 'Up to date') {
          var badge = document.createElement('span');
          badge.className = 'store-badge';
          badge.textContent = badgeText;
          body.appendChild(badge);
        }
        var agentPrompt = storeAgentPrompt(row);
        if (agentPrompt) {
          var details = document.createElement('details');
          details.className = 'store-details';
          var summary = document.createElement('summary');
          summary.textContent = agentPrompt.summary;
          details.appendChild(summary);
          var code = document.createElement('code');
          code.textContent = agentPrompt.prompt;
          details.appendChild(code);
        }
        li.appendChild(body);
        var controls = document.createElement('span');
        controls.className = 'store-controls';
        function mutate(kind, labelText, busyLabel) {
          controls.appendChild(storeBusyButton(labelText, busyLabel, function () {
            clearConfirm();
            setStatus('Working…');
            return storeApi(kind, '&id=' + encodeURIComponent(row.id)).then(function (res) {
              if (res.ok) { load(); }
              else if (res.needsConfirmation) { showConfirm(kind, row, res); setStatus(''); }
              else { setStatus(res.error || 'That change failed.'); }
            });
          }));
        }
        if (row.needsNewerSchema) {
          var schemaNeed = document.createElement('span');
          schemaNeed.className = 'store-desc';
          var schemaHave = (row.schemaVersion !== undefined && row.schemaVersion !== null) ? String(row.schemaVersion) : 'unknown';
          var schemaFloor = (row.schemaFloor !== undefined && row.schemaFloor !== null) ? String(row.schemaFloor) : 'unknown';
          schemaNeed.textContent = 'Requires schema v' + schemaFloor + ' (app has v' + schemaHave + ').';
          controls.appendChild(schemaNeed);
        }
        if (row.needsNewerShell) {
          var need = document.createElement('span');
          need.className = 'store-desc';
          var want = row.minPackageVersion ? String(row.minPackageVersion) : 'newer';
          var have = row.shellVersion ? String(row.shellVersion) : 'unknown';
          need.textContent = 'Requires shell v' + want + ' (running v' + have + ').';
          controls.appendChild(need);
        }
        if (row.needsNewerSchema || row.needsNewerShell) {
          /* requirement shown instead of any install control */
        } else if (!row.installed && row.installMode === 'recipe-only') {
          var prompt = document.createElement('span');
          prompt.className = 'store-desc';
          prompt.textContent = 'Ask an agent to install via its recipe.';
          controls.appendChild(prompt);
        } else if (!row.installed) { mutate('install', 'Add', 'Adding…'); }
        else if (row.status === 'behind-clean' || row.status === 'catalog-differing') { mutate('update', 'Update', 'Updating…'); }
        else if (row.status === 'behind-modified' || row.status === 'absorbed-behind' || row.status === 'snapshot-less') { mutate('update', 'Overwrite', 'Overwriting…'); }
        else if (row.status === 'modified-current' || row.status === 'modified-ahead') { mutate('restore', 'Restore', 'Restoring…'); }
        else if (row.status === 'up-to-date' || row.status === 'absorbed') { mutate('remove', 'Remove', 'Removing…'); }
        li.appendChild(controls);
        if (agentPrompt) { li.appendChild(details); }
        list.appendChild(li);
      })(rows[i]);
    }
  }
  function selfMutate(kind, labelText, busyLabel) {
    return storeBusyButton(labelText, busyLabel, function () {
      clearConfirm();
      setStatus('Working…');
      return storeApi(kind, '&id=app-store').then(function (res) {
        if (res.ok) { load(); }
        else if (res.needsConfirmation) { showConfirm(kind, { id: 'app-store', label: 'App Catalog' }, res); setStatus(''); }
        else { setStatus(res.error || 'That change failed.'); }
      });
    });
  }
  function renderSelf() {
    if (!selfSection) { return; }
    selfSection.innerHTML = '';
    if (!storeSelf) { selfSection.hidden = true; return; }
    selfSection.hidden = false;
    var title = document.createElement('span');
    title.className = 'store-self-title';
    title.textContent = 'App Catalog v' + storeSelf.installedCatalogVersion;
    selfSection.appendChild(title);
    var pin = document.createElement('span');
    pin.className = 'store-self-line';
    pin.textContent = 'Catalog snapshot ' + (storeSelf.pinnedLabel || 'follows the discovery base') + ' · shell v' + storeSelf.runningVersion;
    selfSection.appendChild(pin);
    var latest = document.createElement('span');
    latest.className = 'store-self-line';
    if (storeSelf.latestCatalogVersion === null || storeSelf.latestCatalogVersion === undefined) {
      latest.textContent = 'Latest App Catalog: could not be read.' + (storeSelf.error ? ' ' + storeSelf.error : '');
    } else {
      var from = storeSelf.discoveryRef || storeSelf.discoveryLabel || 'the discovery base';
      latest.textContent = 'Latest App Catalog v' + storeSelf.latestCatalogVersion + ' from ' + from + (storeSelf.hasUpdate ? '' : ' — you have it.');
    }
    selfSection.appendChild(latest);
    if (catalogSourceUrl) {
      var src = document.createElement('span');
      src.className = 'store-self-line';
      src.textContent = 'Catalog source: ';
      var link = document.createElement('a');
      link.href = catalogSourceUrl;
      link.textContent = catalogSourceUrl;
      src.appendChild(link);
      selfSection.appendChild(src);
    }
    if (storeSelf.needsNewerShell) {
      var need = document.createElement('span');
      need.className = 'store-self-line';
      var want = storeSelf.latestMinPackageVersion ? String(storeSelf.latestMinPackageVersion) : 'newer';
      need.textContent = 'Requires shell v' + want + ' (running v' + storeSelf.runningVersion + ').';
      selfSection.appendChild(need);
      selfSection.appendChild(selfMutate('remove', 'Remove', 'Removing…'));
    } else if (storeSelf.hasUpdate) {
      selfSection.appendChild(selfMutate('update', 'Update', 'Updating…'));
    } else {
      selfSection.appendChild(selfMutate('remove', 'Remove', 'Removing…'));
    }
  }
  var catalogRelease = '';
  var catalogCached = false;
  function releaseText() {
    if (!catalogRelease) { return ''; }
    return 'Catalog ' + catalogRelease + (catalogCached ? ' (cached)' : '');
  }
  function load() {
    setStatus(loadingText());
    if (retry) { retry.hidden = true; }
    clearConfirm();
    storeApi('info', '').then(function (info) {
      if (info && info.ok && info.listingUrl) { catalogSourceUrl = info.listingUrl; }
      setStatus(loadingText());
      return storeApi('rows', '');
    }).then(function (res) {
      if (res.ok && res.rows) {
        rows = res.rows.filter(function (r) { return r.id !== 'app-store'; });
        storeSelf = res.storeSelf || null;
        if (res.catalogRelease) { catalogRelease = res.catalogRelease; }
        catalogCached = !!res.catalogCached;
        var fromRows = catalogUrlFromRows();
        if (fromRows) { catalogSourceUrl = fromRows; }
        var base = afterLoadStatus || '';
        afterLoadStatus = '';
        var err = res.catalogError || '';
        var rel = releaseText();
        var msg = base;
        if (err) { msg = msg ? msg + ' ' + err : err; }
        if (rel) { msg = msg ? msg + ' ' + rel : rel; }
        setStatus(msg);
        render();
        renderSelf();
        if (err && retry) {
          retry.hidden = false;
          retry.onclick = function () { load(); };
        }
      } else {
        afterLoadStatus = '';
        setStatus(res.error || 'Could not load apps.');
        if (retry) {
          retry.hidden = false;
          retry.onclick = function () { load(); };
        }
      }
    });
  }
  load();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', storeInit);
} else {
  storeInit();
}
