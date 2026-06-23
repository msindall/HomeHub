/* ============================================================================
 * 10-sync.js — Cross-device sync client (Phase 0.5, Option A: Wix backend)
 *
 * Home Hub stays a static file; this layer "phones" the Wix HTTP functions
 * (see wix-backend/http-functions.js + SYNC_SETUP.md) to share one household's
 * state across devices behind a real Wix Members login.
 *
 * Flow:
 *   - Sign in / register / join via authLogin / authRegister → we store an
 *     opaque session token in localStorage (key `hh_sync`), separate from the
 *     Anthropic key.
 *   - On startup, if signed in: pull. If the cloud copy is newer than what this
 *     device last saw, write it to local storage and reload so it applies app-wide.
 *   - After any saveState(), debounce a push of the whole state up to the cloud.
 *
 * Conflict model: last-write-wins by the household's `updatedAt`. Each device
 * remembers the server timestamp it last saw, so it only adopts a cloud copy
 * that's genuinely newer, and its own pushes update that marker (so it never
 * reloads its own writes).
 * ========================================================================== */

var HH_SYNC_BASE = 'https://mattjsindall.wixsite.com/homehub/_functions';
var HH_SYNC_KEY  = 'hh_sync';          // localStorage record (token + meta)
var HH_SYNC_PUSH_DELAY = 2500;         // ms debounce after a change

var _hhSyncPushTimer = null;
var _hhSyncReady = false;              // suppress pushes until the first pull settles

/* ---- session record (localStorage) ----------------------------------- */
function hhSyncGet() {
  try { return JSON.parse(localStorage.getItem(HH_SYNC_KEY)) || null; } catch (e) { return null; }
}
function hhSyncSet(obj) {
  try {
    if (obj) localStorage.setItem(HH_SYNC_KEY, JSON.stringify(obj));
    else localStorage.removeItem(HH_SYNC_KEY);
  } catch (e) {}
}
function hhSyncSignedIn() { var s = hhSyncGet(); return !!(s && s.token); }

/* ---- low-level API helpers ------------------------------------------- */
async function _hhSyncJson(path, opts) {
  var res = await fetch(HH_SYNC_BASE + path, opts);
  return await res.json();
}
function hhSyncLogin(email, password) {
  return _hhSyncJson('/authLogin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });
}
function hhSyncRegister(email, password, mode, joinCode) {
  return _hhSyncJson('/authRegister', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password, mode: mode, joinCode: joinCode })
  });
}

/* ---- pull ------------------------------------------------------------- */
// opts.force = adopt the cloud copy even if it isn't newer.
async function hhSyncPull(opts) {
  opts = opts || {};
  var s = hhSyncGet();
  if (!s || !s.token) return { ok: false, error: 'Not signed in' };

  var data;
  try { data = await _hhSyncJson('/syncLoad?token=' + encodeURIComponent(s.token), { method: 'GET' }); }
  catch (e) { return { ok: false, error: 'Network error reaching the sync server.' }; }
  if (!data || data.ok !== true) return data || { ok: false, error: 'Sync load failed' };

  if (data.joinCode) s.joinCode = data.joinCode;

  var remoteMs = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
  var seenMs   = s.lastServerAt ? new Date(s.lastServerAt).getTime() : 0;
  var shouldLoad = !!data.stateJson && (opts.force || remoteMs > seenMs);

  if (shouldLoad) {
    try { JSON.parse(data.stateJson); }            // validate before adopting
    catch (e) { return { ok: false, error: 'Cloud data was unreadable; not applied.' }; }
    s.lastServerAt = data.updatedAt;
    s.lastSyncAt   = new Date().toISOString();
    hhSyncSet(s);
    try { hhStorageSet(KEY, data.stateJson); } catch (e) {}   // write straight to local store
    // Reload so the new state applies everywhere. The lastServerAt marker we
    // just saved stops the post-reload pull from reloading again.
    setTimeout(function () { window.location.reload(); }, 200);
    return { ok: true, loaded: true, updatedAt: data.updatedAt, updatedByEmail: data.updatedByEmail };
  }

  s.lastServerAt = data.updatedAt || s.lastServerAt;
  hhSyncSet(s);
  return { ok: true, loaded: false, updatedAt: data.updatedAt, updatedByEmail: data.updatedByEmail };
}

/* ---- push ------------------------------------------------------------- */
function hhSyncSchedulePush() {
  if (!_hhSyncReady || !hhSyncSignedIn()) return;
  if (_hhSyncPushTimer) clearTimeout(_hhSyncPushTimer);
  _hhSyncPushTimer = setTimeout(function () { hhSyncPush(); }, HH_SYNC_PUSH_DELAY);
}
async function hhSyncPush() {
  var s = hhSyncGet();
  if (!s || !s.token) return { ok: false, error: 'Not signed in' };
  var payload;
  try { payload = JSON.stringify(state); } catch (e) { return { ok: false, error: 'Could not serialize state' }; }
  var data;
  try {
    data = await _hhSyncJson('/syncSave', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: s.token, stateJson: payload })
    });
  } catch (e) { return { ok: false, error: 'Network error during push.' }; }
  if (data && data.ok) {
    s.lastServerAt = data.updatedAt;
    s.lastSyncAt   = new Date().toISOString();
    hhSyncSet(s);
  }
  hhSyncUpdateBadge();
  return data || { ok: false, error: 'Push failed' };
}

/* ---- saveState() wrapper (auto-push on every change) ------------------ */
var _hhOrigSaveState = (typeof saveState === 'function') ? saveState : null;
function saveStateLocalOnly() { if (_hhOrigSaveState) _hhOrigSaveState(); }
if (_hhOrigSaveState) {
  saveState = function () { _hhOrigSaveState(); hhSyncSchedulePush(); };
}

/* ---- startup ---------------------------------------------------------- */
function hhSyncInit() {
  hhSyncUpdateBadge();
  if (!hhSyncSignedIn()) { _hhSyncReady = true; return; }
  hhSyncPull({}).then(function (r) {
    _hhSyncReady = true;                 // (if r.loaded, a reload is already queued)
    hhSyncUpdateBadge();
  }).catch(function () { _hhSyncReady = true; });
}

/* ---- sidebar badge ---------------------------------------------------- */
function hhSyncUpdateBadge() {
  var lbl = document.getElementById('sync-nav-label');
  var btn = document.getElementById('sync-nav-btn');
  if (!lbl) return;
  if (hhSyncSignedIn()) {
    lbl.textContent = 'Sync ✓';
    if (btn) btn.title = 'Synced — ' + (hhSyncGet().email || '');
  } else {
    lbl.textContent = 'Sync';
    if (btn) btn.title = 'Set up cross-device sync';
  }
}

/* ---- modal ------------------------------------------------------------ */
function openSyncModal() {
  hhSyncRenderModalBody();
  openModal('sync-modal');
}

function _hhSyncMsg(html, isErr) {
  var el = document.getElementById('sync-msg');
  if (!el) return;
  el.style.color = isErr ? 'var(--red)' : 'var(--muted)';
  el.innerHTML = html || '';
}

function _hhSyncRelTime(iso) {
  if (!iso) return 'never';
  var ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  var m = Math.round(ms / 60000);
  if (m < 60) return m + ' min ago';
  var h = Math.round(m / 60);
  if (h < 24) return h + ' hr ago';
  return new Date(iso).toLocaleString();
}

function hhSyncRenderModalBody() {
  var el = document.getElementById('sync-modal-body');
  if (!el) return;
  var s = hhSyncGet();

  if (s && s.token) {
    el.innerHTML =
      '<div style="font-size:13px;line-height:1.5;margin-bottom:12px">Signed in as <b>' + (s.email || '') + '</b>. ' +
        'This device syncs automatically — it pulls on open and saves changes to the cloud a couple seconds after you make them.</div>' +
      '<div style="background:var(--surface);border:2px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">' +
        '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:4px">Household join code</div>' +
        '<div style="font-size:22px;font-weight:800;letter-spacing:2px">' + (s.joinCode || '—') + '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:4px">Have your partner choose <b>Join an existing household</b> and enter this code to share this data.</div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">Last synced: ' + _hhSyncRelTime(s.lastSyncAt) + '</div>' +
      '<div id="sync-msg" style="font-size:12px;margin-bottom:10px"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-ghost btn-sm" onclick="hhSyncPullNow()">⬇️ Pull now</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="hhSyncPushNow()">⬆️ Push now</button>' +
        '<button class="btn btn-danger btn-sm" onclick="hhSyncSignOut()" style="margin-left:auto">Sign out</button>' +
      '</div>';
    return;
  }

  el.innerHTML =
    '<div style="font-size:13px;line-height:1.5;margin-bottom:8px">Sync Home Hub across your devices, or invite your partner with a join code.</div>' +
    '<div style="font-size:12px;line-height:1.45;margin-bottom:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;color:var(--muted)">' +
      'These are <b>Home Hub sync</b> credentials — a private login for your data, <b>not</b> your Wix.com dashboard. ' +
      'First time? Pick <b>Create a new household</b> with any email + password you\'ll remember.</div>' +
    '<div class="form-row"><label>What do you want to do?</label>' +
      '<select id="sync-mode" onchange="hhSyncModeChanged()">' +
        '<option value="signin">Sign in (existing account)</option>' +
        '<option value="create">Create a new household</option>' +
        '<option value="join">Join an existing household</option>' +
      '</select></div>' +
    '<div class="form-row"><label>Email</label><input type="email" id="sync-email" placeholder="you@example.com" autocomplete="username"></div>' +
    '<div class="form-row"><label>Password</label><input type="password" id="sync-password" placeholder="At least 6 characters" autocomplete="current-password"></div>' +
    '<div class="form-row" id="sync-joincode-row" style="display:none"><label>Household join code</label>' +
      '<input type="text" id="sync-joincode" placeholder="e.g. ABC234" style="text-transform:uppercase"></div>' +
    '<div id="sync-msg" style="font-size:12px;margin:8px 0"></div>' +
    '<button class="btn btn-primary" style="width:100%" onclick="hhSyncSubmit()">Continue</button>' +
    '<div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.4">Joining a household adopts that household\'s data on this device. Make a Backup first (Settings → Backup) if this device has data you want to keep.</div>';
}

function hhSyncModeChanged() {
  var mode = (document.getElementById('sync-mode') || {}).value;
  var row = document.getElementById('sync-joincode-row');
  if (row) row.style.display = (mode === 'join') ? '' : 'none';
}

async function hhSyncSubmit() {
  var email = (document.getElementById('sync-email') || {}).value || '';
  var pw    = (document.getElementById('sync-password') || {}).value || '';
  var mode  = (document.getElementById('sync-mode') || {}).value || 'signin';
  var code  = ((document.getElementById('sync-joincode') || {}).value || '').trim().toUpperCase();
  email = email.trim();

  if (!email || !pw) { _hhSyncMsg('Enter your email and password.', true); return; }
  if (mode === 'join' && !code) { _hhSyncMsg('Enter the household join code to join.', true); return; }

  _hhSyncMsg('Working…');
  var data;
  try {
    data = (mode === 'signin')
      ? await hhSyncLogin(email, pw)
      : await hhSyncRegister(email, pw, mode === 'join' ? 'join' : 'create', code);
  } catch (e) { _hhSyncMsg('Network error reaching the sync server.', true); return; }

  if (!data || data.ok !== true) { _hhSyncMsg((data && data.error) || 'Could not sign in.', true); return; }

  hhSyncSet({
    token: data.token, email: data.email, householdId: data.householdId,
    joinCode: data.joinCode || null, lastServerAt: null, lastSyncAt: new Date().toISOString()
  });
  _hhSyncReady = true;
  _hhSyncMsg('Signed in — syncing…');

  // Adopt cloud data if the household already has some; otherwise seed the
  // cloud with this device's current data so the other device can pull it.
  var pull = await hhSyncPull({});
  if (pull.ok && pull.loaded) return;   // reload is queued; nothing more to do
  if (!pull.ok) { _hhSyncMsg(pull.error || 'Signed in, but the first sync failed.', true); hhSyncUpdateBadge(); return; }

  var push = await hhSyncPush();
  hhSyncUpdateBadge();
  hhSyncRenderModalBody();
  if (push && push.ok) { try { hhToast('Sync is on for this device.', '☁️'); } catch (e) {} }
}

async function hhSyncPullNow() {
  _hhSyncMsg('Pulling…');
  var r = await hhSyncPull({ force: true });
  if (r.ok && r.loaded) return;                 // reload queued
  if (r.ok) _hhSyncMsg('Already up to date (nothing newer in the cloud).');
  else _hhSyncMsg(r.error || 'Pull failed.', true);
}

async function hhSyncPushNow() {
  _hhSyncMsg('Pushing…');
  var r = await hhSyncPush();
  if (r && r.ok) { hhSyncRenderModalBody(); try { hhToast('Pushed to the cloud.', '⬆️'); } catch (e) {} }
  else _hhSyncMsg((r && r.error) || 'Push failed.', true);
}

function hhSyncSignOut() {
  hhConfirm('Sign out of sync on this device? Your data stays on this device; it just stops syncing.', '☁️', 'Sign out of Sync').then(function (ok) {
    if (!ok) return;
    hhSyncSet(null);
    _hhSyncReady = false;
    hhSyncUpdateBadge();
    hhSyncRenderModalBody();
  });
}

window.HHSync = { init: hhSyncInit, pull: hhSyncPull, push: hhSyncPush };
