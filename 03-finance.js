function renderCalendar() {
  const y = state.calYear, m = state.calMonth;
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-month-title').textContent = `${monthNames[m]} ${y}`;

  var members = state.members || [];
  var statusCardsEl = document.getElementById('cal-member-status-cards');
  if (statusCardsEl) {
    statusCardsEl.innerHTML = members.map(function(m) {
      var evts = state.calEvents.filter(function(e){ return e.gcalPerson === m.id && e.source === 'gcal'; }).length;
      var cfg2 = state.gcalConfig && state.gcalConfig[m.id];
      var calName = (cfg2 && cfg2.name) || (m.name + "'s Calendar");
      var srcIcon = cfg2 && cfg2.calType === 'apple' ? '︎' : cfg2 && cfg2.url ? '&#x1F5D3;' : '&#x1F4C5;';
      var statusHtml = evts > 0
        ? '<span style="color:' + m.color + '">' + srcIcon + ' ' + calName + ' (' + evts + ' events)</span>'
        : '<span style="color:var(--muted)">Not connected — click ' + m.name + "'s Cal above</span>";
      return '<div class="stat"><div class="stat-label">' + m.name + '\'s Calendar</div><div id="cal-status-' + m.id + '" style="font-size:13px;font-weight:600">' + statusHtml + '</div></div>';
    }).join('');
  }
  var buttonsEl = document.getElementById('gcal-member-buttons');
  if (buttonsEl) {
    buttonsEl.innerHTML = members.map(function(m) {
      var cfg = state.gcalConfig && state.gcalConfig[m.id];
      var hasLink = cfg && cfg.url;
      var btnIcon = hasLink ? (cfg.calType === 'apple' ? '︎' : '&#x1F517;') : '&#x2795;';
      var lastSync = cfg && cfg.lastSync ? '<span style="font-size:10px;color:var(--muted);margin-left:4px">synced ' + cfg.lastSync + '</span>' : '';
      return '<span style="display:inline-flex;align-items:center;gap:4px">'
        + '<button class="btn btn-ghost btn-sm" style="border-color:' + m.color + ';color:' + m.color + '" onclick="openGCalModal(&#39;' + m.id + '&#39;)">'
        + btnIcon + ' ' + m.name + "'s Cal</button>"
        + (hasLink ? '🔗' : '➕') + ' ' + m.name + "'s Cal</button>"
        + '<button id="gcal-sync-btn-' + m.id + '" class="btn btn-ghost btn-sm" onclick="resyncGCal(&#39;' + m.id + '&#39;)" title="Re-sync ' + m.name + '\'s calendar" style="' + (hasLink ? '' : 'opacity:0.4') + '">🔄</button>'
        + lastSync
        + '</span>';
    }).join('&nbsp;&nbsp;');
  }

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();
  const todayD = new Date().toISOString().split('T')[0];

  let cells = [];
  for (let i = firstDay-1; i >= 0; i--) cells.push({day: daysInPrev-i, thisMonth:false, dateStr:''});
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({day:d, thisMonth:true, dateStr});
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) cells.push({day:d, thisMonth:false, dateStr:''});

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = cells.map(c => {
    if (!c.thisMonth) return `<div class="cal-day other-month"><div class="cal-day-num" style="color:var(--muted)">${c.day}</div></div>`;
    const events = state.calEvents.filter(e=>e.date===c.dateStr);
    const isToday = c.dateStr === todayD;
    const evHtml = events.slice(0,3).map(e=>`<div class="cal-event cal-event-${e.person.toLowerCase()}">${e.title}</div>`).join('');
    const moreHtml = events.length>3 ? `<div class="cal-more">+${events.length-3} more</div>` : '';
    return `<div class="cal-day ${isToday?'today':''}" onclick="openDayModal('${c.dateStr}')">
      <div class="cal-day-num" ${isToday?'style="color:var(--accent)"':''}>${c.day}</div>
      ${evHtml}${moreHtml}
    </div>`;
  }).join('');

  const todayDate = new Date(); todayDate.setHours(0,0,0,0);
  const upcoming = state.calEvents
    .filter(e=>new Date(e.date)>=todayDate)
    .sort((a,b)=>new Date(a.date)-new Date(b.date))
    .slice(0,10);
  document.getElementById('upcoming-events').innerHTML = upcoming.length
    ? upcoming.map(e=>{
        var memberColor = getMemberColor(e.person);
        const rowCls='event-row-member';
        const icon='<span style="color:'+memberColor+'">●</span>';
        const dateLabel=new Date(e.date+'T12:00:00').toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'});
        var displayPerson = e.person;
        if (displayPerson && !(state.members||[]).find(function(m){ return m.name === displayPerson; })) {
          var resolved = getMemberById(displayPerson);
          if (resolved) displayPerson = resolved.name;
        }
        return '<div class="event-row '+rowCls+'">'
          +'<span class="event-date-badge">'+dateLabel+(e.start?' '+e.start:'')+'</span>'
          +'<div class="fill">'
          +'<div class="event-title">'+icon+' '+e.title+'</div>'
          +'<div class="event-meta">'+displayPerson+(e.notes?' · '+e.notes.slice(0,40):'')+'</div>'
          +'</div>'
          +'<button class="btn btn-danger btn-sm" onclick="deleteEvent(\''+e.id+'\')">&#x1F5D1;</button>'
          +'</div>';
      }).join('')
    : '<div class="empty-sm">No upcoming events. Add one!</div>';

  document.getElementById('cal-event-count').textContent = state.calEvents.filter(e=>{
    const d=new Date(e.date); return d.getMonth()===m && d.getFullYear()===y;
  }).length;
}

function calNav(dir) {
  state.calMonth += dir;
  if (state.calMonth > 11) { state.calMonth=0; state.calYear++; }
  if (state.calMonth < 0) { state.calMonth=11; state.calYear--; }
  saveState(); renderCalendar();
}

function openDayModal(dateStr) {
  document.getElementById('event-date').value = dateStr;
  document.getElementById('event-edit-id').value = '';
  document.getElementById('event-title').value = '';
  document.getElementById('event-start').value = '';
  document.getElementById('event-end').value = '';
  document.getElementById('event-notes').value = '';
  openModal('event-modal');
}

function saveEvent() {
  const editId = document.getElementById('event-edit-id').value;
  const ev = {
    id: editId||uid(),
    title: document.getElementById('event-title').value,
    date: document.getElementById('event-date').value,
    person: document.getElementById('event-person').value,
    start: document.getElementById('event-start').value,
    end: document.getElementById('event-end').value,
    notes: document.getElementById('event-notes').value,
    source: 'manual',
  };
  if (!ev.title || !ev.date) return hhAlert('Please add a title and date.', '📅');
  if (editId) { const idx=state.calEvents.findIndex(e=>e.id===editId); state.calEvents[idx]=ev; }
  else state.calEvents.push(ev);
  saveState(); closeModal('event-modal'); clearEventForm(); renderCalendar();
}

function deleteEvent(id) {
  hhConfirm('Delete this event?', '🗑️', 'Delete Event').then(function(ok) {
    if(!ok) return;
    state.calEvents = state.calEvents.filter(e=>e.id!==id);
    saveState(); closeModal('event-modal'); renderCalendar();
  });
}

function switchCalTab(person, tab) {
  var isNew = person === 'member';
  var linkPanel  = document.getElementById(isNew ? 'gcal-panel-link'  : 'gcal-' + person + '-panel-link');
  var applePanel = document.getElementById(isNew ? 'gcal-panel-apple' : 'gcal-' + person + '-panel-apple');
  var filePanel  = document.getElementById(isNew ? 'gcal-panel-file'  : 'gcal-' + person + '-panel-file');
  var pastePanel = document.getElementById(isNew ? 'gcal-panel-paste' : 'gcal-' + person + '-panel-paste');
  var linkBtn    = document.getElementById(isNew ? 'gcal-tab-link'    : 'gcal-' + person + '-tab-link');
  var appleBtn   = document.getElementById(isNew ? 'gcal-tab-apple'   : 'gcal-' + person + '-tab-apple');
  var fileBtn    = document.getElementById(isNew ? 'gcal-tab-file'    : 'gcal-' + person + '-tab-file');
  var pasteBtn   = document.getElementById(isNew ? 'gcal-tab-paste'   : 'gcal-' + person + '-tab-paste');
  var memberId = isNew ? document.getElementById('gcal-modal-member-id').value : person;
  var member = getMemberById(memberId);
  var activeColor = member ? member.color : 'var(--accent)';
  var panels = [linkPanel, applePanel, filePanel, pastePanel];
  var btns   = [linkBtn,   appleBtn,   fileBtn,   pasteBtn];
  var tabs   = ['link',    'apple',    'file',    'paste'];
  panels.forEach(function(p, i) {
    if (!p) return;
    p.style.display = tabs[i] === tab ? '' : 'none';
  });
  btns.forEach(function(b, i) {
    if (!b) return;
    if (tabs[i] === tab) { b.style.background = activeColor; b.style.color = '#fff'; }
    else                 { b.style.background = 'var(--surface)'; b.style.color = 'var(--muted)'; }
  });
}

function normaliseCalUrl(url) {
  return (url || '').trim().replace(/^webcal:\/\//i, 'https://');
}

function openGCalModal(memberId) {
  var member = getMemberById(memberId);
  if (!member) return;
  document.getElementById('gcal-modal-member-id').value = memberId;
  document.getElementById('gcal-modal-title').textContent = '&#x1F4C5; ' + member.name + "'s Calendar Sync";
  var cfg = (state.gcalConfig && state.gcalConfig[memberId]) || {};
  var existingName = cfg.name || (member.name + "'s Calendar");
  var existingUrl  = cfg.url  || '';
  var autoSync     = cfg.autoSync !== false;
  var calType      = cfg.calType || 'google';
  var nameFileEl  = document.getElementById('gcal-name-file');   if (nameFileEl)  nameFileEl.value  = existingName;
  var namePasteEl = document.getElementById('gcal-name-paste'); if (namePasteEl) namePasteEl.value = existingName;
  var nameLinkEl  = document.getElementById('gcal-name-link');  if (nameLinkEl)  nameLinkEl.value  = existingName;
  var nameAppleEl = document.getElementById('gcal-name-apple'); if (nameAppleEl) nameAppleEl.value = existingName;
  var urlEl       = document.getElementById('gcal-link-url');   if (urlEl)       urlEl.value       = existingUrl;
  var appleUrlEl  = document.getElementById('gcal-apple-url');  if (appleUrlEl)  appleUrlEl.value  = existingUrl;
  var autoEl      = document.getElementById('gcal-link-autosync'); if (autoEl)   autoEl.checked    = autoSync;
  var autoAppleEl = document.getElementById('gcal-apple-autosync'); if (autoAppleEl) autoAppleEl.checked = autoSync;
  var resultEl    = document.getElementById('gcal-link-result'); if (resultEl)   resultEl.innerHTML = '';
  var appleResEl  = document.getElementById('gcal-apple-result'); if (appleResEl) appleResEl.innerHTML = '';
  var startTab = calType === 'apple' ? 'apple' : 'link';
  switchCalTab('member', startTab);
  openModal('gcal-member-modal');
}

function importICalFileDynamic() {
  var memberId = document.getElementById('gcal-modal-member-id').value;
  var fileEl   = document.getElementById('gcal-file');
  var nameEl   = document.getElementById('gcal-name-file');
  var resultEl = document.getElementById('gcal-file-result');
  var member   = getMemberById(memberId);
  if (!fileEl || !fileEl.files || !fileEl.files[0]) {
    resultEl.innerHTML = '<span style="color:var(--red)">⚠ Please choose a .ics file first.</span>';
    return;
  }
  var calName = (nameEl ? nameEl.value.trim() : '') || (member ? member.name + "'s Calendar" : 'Calendar');
  resultEl.innerHTML = '<span style="color:var(--muted)">Reading file…</span>';
  var reader = new FileReader();
  reader.onload = function(e) {
    var result = importICalText(memberId, e.target.result, calName);
    if (result.ok) {
      resultEl.innerHTML = '<span style="color:var(--green)">✅ Imported ' + result.count + ' events!</span>';
      setTimeout(function() { closeModal('gcal-member-modal'); }, 1200);
    } else {
      resultEl.innerHTML = '<span style="color:var(--red)">❌ ' + result.msg + '</span>';
    }
  };
  reader.onerror = function() { resultEl.innerHTML = '<span style="color:var(--red)">❌ Could not read the file.</span>'; };
  reader.readAsText(fileEl.files[0]);
}

function importICalPasteDynamic() {
  var memberId = document.getElementById('gcal-modal-member-id').value;
  var pasteEl  = document.getElementById('gcal-paste');
  var nameEl   = document.getElementById('gcal-name-paste');
  var resultEl = document.getElementById('gcal-paste-result');
  var member   = getMemberById(memberId);
  var text     = pasteEl ? pasteEl.value.trim() : '';
  if (!text) {
    resultEl.innerHTML = '<span style="color:var(--red)">⚠ Please paste your iCal text first.</span>';
    return;
  }
  var calName = (nameEl ? nameEl.value.trim() : '') || (member ? member.name + "'s Calendar" : 'Calendar');
  var result = importICalText(memberId, text, calName);
  if (result.ok) {
    resultEl.innerHTML = '<span style="color:var(--green)">✅ Imported ' + result.count + ' events!</span>';
    setTimeout(function() { closeModal('gcal-member-modal'); }, 1200);
  } else {
    resultEl.innerHTML = '<span style="color:var(--red)">❌ ' + result.msg + '</span>';
  }
}

function importICalText(person, icalText, calName) {
  if (!icalText || !icalText.includes('BEGIN:VCALENDAR')) {
    return { ok: false, msg: "This doesn't look like a valid calendar file. Make sure it starts with BEGIN:VCALENDAR." };
  }
  var imported = parseICalToEvents(icalText, person, calName);
  state.calEvents = state.calEvents.filter(function(e) {
    return !(e.gcalPerson === person && e.source === 'gcal');
  });
  state.calEvents = state.calEvents.concat(imported);
  if (!state.gcalConfig) state.gcalConfig = {};
  if (!state.gcalConfig[person]) state.gcalConfig[person] = {};
  state.gcalConfig[person].name = calName;
  state.gcalConfig[person].lastSync = new Date().toLocaleTimeString('en-CA', {hour:'2-digit', minute:'2-digit'});
  saveState();
  renderCalendar();
  var now = state.gcalConfig[person].lastSync;
  var statusEl = document.getElementById('cal-' + person + '-status');
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--' + person + ')">\u2713 ' + calName + ' \u2014 ' + imported.length + ' events imported at ' + now + '</span>';
  return { ok: true, count: imported.length };
}

function importICalFile(person) { openGCalModal(person); }
function importICalPaste(person) { openGCalModal(person); }

async function saveLiveCalLink() {
  var memberId = document.getElementById('gcal-modal-member-id').value;
  var urlEl    = document.getElementById('gcal-link-url');
  var nameEl   = document.getElementById('gcal-name-link');
  var autoEl   = document.getElementById('gcal-link-autosync');
  var resultEl = document.getElementById('gcal-link-result');
  var member   = getMemberById(memberId);
  var rawUrl   = urlEl ? urlEl.value.trim() : '';
  var url      = normaliseCalUrl(rawUrl);
  if (!url) {
    resultEl.innerHTML = '<span style="color:var(--red)">&#9888; Please paste your iCal link first.</span>';
    return;
  }
  if (!url.startsWith('http')) {
    resultEl.innerHTML = '<span style="color:var(--red)">&#9888; That does not look like a valid URL. It should start with https:// or webcal://</span>';
    return;
  }
  var calName  = (nameEl ? nameEl.value.trim() : '') || (member ? member.name + "'s Calendar" : 'Calendar');
  var autoSync = autoEl ? autoEl.checked : true;
  if (!state.gcalConfig) state.gcalConfig = {};
  if (!state.gcalConfig[memberId]) state.gcalConfig[memberId] = {};
  state.gcalConfig[memberId].url      = url;
  state.gcalConfig[memberId].name     = calName;
  state.gcalConfig[memberId].autoSync = autoSync;
  state.gcalConfig[memberId].calType  = 'google';
  saveState();
  resultEl.innerHTML = '<span style="color:var(--muted)"><span class="spinner" style="display:inline-block;width:13px;height:13px;vertical-align:middle;margin-right:5px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite"></span>Connecting…</span>';
  var res = await icalFetchAndImport(memberId, url, calName);
  if (res.ok) {
    resultEl.innerHTML = '<span style="color:var(--green)">✅ Synced ' + res.count + ' events! Link saved — click 🔄 any time to refresh.</span>';
    setTimeout(function() { closeModal('gcal-member-modal'); renderCalendar(); }, 1400);
  } else {
    resultEl.innerHTML = '<span style="color:var(--red)">❌ ' + res.msg + '</span>';
  }
}

async function saveAppleCalLink() {
  var memberId  = document.getElementById('gcal-modal-member-id').value;
  var urlEl     = document.getElementById('gcal-apple-url');
  var nameEl    = document.getElementById('gcal-name-apple');
  var autoEl    = document.getElementById('gcal-apple-autosync');
  var resultEl  = document.getElementById('gcal-apple-result');
  var member    = getMemberById(memberId);
  var rawUrl    = urlEl ? urlEl.value.trim() : '';
  var url       = normaliseCalUrl(rawUrl);
  if (!url) {
    resultEl.innerHTML = '<span style="color:var(--red)">&#9888; Please paste your iCloud calendar link first.</span>';
    return;
  }
  if (!url.startsWith('http')) {
    resultEl.innerHTML = '<span style="color:var(--red)">&#9888; That does not look like a valid iCloud link. It should start with webcal:// or https://</span>';
    return;
  }
  var calName  = (nameEl ? nameEl.value.trim() : '') || (member ? member.name + "'s iCloud Calendar" : 'iCloud Calendar');
  var autoSync = autoEl ? autoEl.checked : true;
  if (!state.gcalConfig) state.gcalConfig = {};
  if (!state.gcalConfig[memberId]) state.gcalConfig[memberId] = {};
  state.gcalConfig[memberId].url      = url;
  state.gcalConfig[memberId].name     = calName;
  state.gcalConfig[memberId].autoSync = autoSync;
  state.gcalConfig[memberId].calType  = 'apple';
  saveState();
  resultEl.innerHTML = '<span style="color:var(--muted)"><span class="spinner" style="display:inline-block;width:13px;height:13px;vertical-align:middle;margin-right:5px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite"></span>Connecting to iCloud…</span>';
  var res = await icalFetchAndImport(memberId, url, calName);
  if (res.ok) {
    resultEl.innerHTML = '<span style="color:var(--green)">&#x2705; Synced ' + res.count + ' events from iCloud! Link saved.</span>';
    setTimeout(function() { closeModal('gcal-member-modal'); renderCalendar(); }, 1400);
  } else {
    resultEl.innerHTML = '<span style="color:var(--red)">&#x274C; ' + res.msg + '</span>'
      + '<div style="margin-top:8px;font-size:12px;color:var(--muted)">Tip: if your link starts with <code>webcal://</code> Home Hub converts it automatically. If it still fails, try the <strong>File</strong> tab to upload a .ics export instead.</div>';
  }
}
var ICAL_CORS_PROXIES = [
  '',
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url='
];
async function icalFetchAndImport(memberId, url, calName) {
  var lastErr;
  for (var i = 0; i < ICAL_CORS_PROXIES.length; i++) {
    try {
      var fetchUrl = ICAL_CORS_PROXIES[i] === '' ? url : ICAL_CORS_PROXIES[i] + encodeURIComponent(url);
      var resp = await fetch(fetchUrl, { signal: AbortSignal.timeout(12000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var text = await resp.text();
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Response is not a valid calendar feed');
      return importICalText(memberId, text, calName);
    } catch(e) {
      lastErr = e;
    }
  }
  return { ok: false, msg: 'Could not reach your calendar. Try the "Paste Text" tab as a backup. (' + (lastErr ? lastErr.message : 'network error') + ')' };
}

async function resyncGCal(memberId) {
  var cfg = state.gcalConfig && state.gcalConfig[memberId];
  if (!cfg || !cfg.url) {
    openGCalModal(memberId);
    return;
  }
  var member   = getMemberById(memberId);
  var memberName = member ? member.name : memberId;
  var btn = document.getElementById('gcal-sync-btn-' + memberId);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="display:inline-block;width:12px;height:12px;vertical-align:middle;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite"></span>'; }
  var res = await icalFetchAndImport(memberId, cfg.url, cfg.name || (memberName + "'s Calendar"));
  if (btn) { btn.disabled = false; btn.innerHTML = '🔄'; }
  if (res.ok) {
    hhToast('✅ ' + memberName + "'s calendar synced — " + res.count + ' events loaded');
    renderCalendar();
  } else {
    hhToast('❌ Sync failed for ' + memberName + ': ' + res.msg);
  }
}

async function autoSyncAllCalendars(silent) {
  if (!state.gcalConfig) return;
  var members = state.members || [];
  for (var i = 0; i < members.length; i++) {
    var m   = members[i];
    var cfg = state.gcalConfig[m.id];
    if (cfg && cfg.url && cfg.autoSync !== false) {
      if (!silent) hhToast('🔄 Syncing ' + m.name + "'s calendar…");
      await icalFetchAndImport(m.id, cfg.url, cfg.name || (m.name + "'s Calendar"));
    }
  }
  renderCalendar();
}

function parseICalToEvents(ical, person, calName) {
  var events = [];

  var normalized = ical
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '');  // unfold RFC 5545 continuation lines

  var now = new Date();
  var windowStart = new Date(now); windowStart.setMonth(windowStart.getMonth() - 6);
  var windowEnd   = new Date(now); windowEnd.setMonth(windowEnd.getMonth() + 18);

  function decodeICal(s) {
    if (!s) return '';
    return s.replace(/\\n/g,' ').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\').trim();
  }

  function parseICalDate(raw) {
    var val = raw.indexOf(':') >= 0 ? raw.split(':').pop() : raw;
    val = val.replace(/Z$/, '').trim();
    if (val.length < 8) return null;
    var y = parseInt(val.slice(0,4)), mo = parseInt(val.slice(4,6))-1, d = parseInt(val.slice(6,8));
    if (val.length >= 15 && val[8] === 'T') {
      return new Date(y, mo, d, parseInt(val.slice(9,11)), parseInt(val.slice(11,13)));
    }
    return new Date(y, mo, d);
  }

  function dateToStr(dt) {
    return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
  }

  function timeToStr(dt) {
    if (!dt.getHours() && !dt.getMinutes()) return '';
    return String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0');
  }

  function parseRRule(str) {
    var o = {};
    str.split(';').forEach(function(p){ var kv=p.split('='); if(kv.length===2) o[kv[0].toUpperCase()]=kv[1].toUpperCase(); });
    return o;
  }

  var DAY_NAMES = ['SU','MO','TU','WE','TH','FR','SA'];

  function expandRRule(dtStart, rruleStr, exdates) {
    var rule = parseRRule(rruleStr);
    var freq = rule.FREQ; if (!freq) return [];
    var until    = rule.UNTIL ? parseICalDate(rule.UNTIL) : null;
    var count    = rule.COUNT ? parseInt(rule.COUNT) : null;
    var interval = rule.INTERVAL ? parseInt(rule.INTERVAL) : 1;
    var byDay    = rule.BYDAY ? rule.BYDAY.split(',').map(function(d){ return d.replace(/^[-+]?\d+/,''); }) : null;

    var results = [], cur = new Date(dtStart), generated = 0, safety = 0;

    while (safety++ < 10000) {
      if (until && cur > until) break;
      if (cur > windowEnd) break;
      if (count !== null && generated >= count) break;

      var dateKey = cur.toISOString().slice(0,10).replace(/-/g,'');
      var excluded = exdates.some(function(ex){ return ex.slice(0,8) === dateKey; });

      if (!excluded) {
        var dayOk = !byDay || (freq === 'WEEKLY' || freq === 'DAILY')
          ? (!byDay || byDay.indexOf(DAY_NAMES[cur.getDay()]) >= 0)
          : true;
        if (dayOk) {
          if (cur >= windowStart) results.push(new Date(cur));
          generated++;
          if (count !== null && generated >= count) break;
        }
      }

      if (freq === 'DAILY') {
        cur.setDate(cur.getDate() + interval);
      } else if (freq === 'WEEKLY') {
        cur.setDate(cur.getDate() + (byDay && byDay.length > 1 ? 1 : 7 * interval));
      } else if (freq === 'MONTHLY') {
        cur.setMonth(cur.getMonth() + interval);
      } else if (freq === 'YEARLY') {
        cur.setFullYear(cur.getFullYear() + interval);
      } else { break; }
    }
    return results;
  }

  var blocks = normalized.split('BEGIN:VEVENT');
  blocks.shift();

  blocks.forEach(function(block) {
    try {
      var ei = block.indexOf('END:VEVENT');
      if (ei > 0) block = block.slice(0, ei);

      function getVal(key) {
        var m = block.match(new RegExp('(?:^|\n)' + key + '(?:;[^:\n]*)?:([^\n]*)', 'i'));
        return m ? m[1].trim() : '';
      }

      var summary = getVal('SUMMARY');
      var status  = getVal('STATUS');
      if (!summary || status === 'CANCELLED') return;

      var dtStart = parseICalDate(getVal('DTSTART'));
      if (!dtStart) return;

      var rruleRaw = getVal('RRULE');
      var desc     = decodeICal(getVal('DESCRIPTION')).slice(0, 120);
      var loc      = decodeICal(getVal('LOCATION'));
      var notesStr = [desc, loc ? '\ud83d\udccd ' + loc : ''].filter(Boolean).join(' | ').slice(0, 250);

      var exdates = [];
      (block.match(/(?:^|\n)EXDATE(?:;[^:\n]*)?:([^\n]+)/gi) || []).forEach(function(ex) {
        ex.split(':').pop().trim().split(',').forEach(function(v){ exdates.push(v.replace(/Z$/,'').trim()); });
      });

      var dtEndRaw = getVal('DTEND');
      var dtEnd = dtEndRaw ? parseICalDate(dtEndRaw) : null;
      var memberObj = getMemberById(person);
      var personName = memberObj ? memberObj.name : person;
      function pushEvent(dt) {
        events.push({ id: uid(), date: dateToStr(dt), title: decodeICal(summary),
          start: timeToStr(dt), end: dtEnd ? timeToStr(dtEnd) : '',
          person: personName,
          notes: notesStr, source: 'gcal', gcalPerson: person });
      }

      if (rruleRaw) {
        expandRRule(dtStart, rruleRaw, exdates).forEach(pushEvent);
      } else if (dtStart >= windowStart && dtStart <= windowEnd) {
        pushEvent(dtStart);
      }
    } catch(e) {   }
  });

  return events;
}
let txnPage = 0;
const PAGE_SIZE = 25;

function renderTransactions() {
  txnPage = 0;
  const catSel = document.getElementById('txn-cat');
  const prev = catSel.value;
  var catOpts = '<option value="">All Categories</option>'
    + state.categories.map(c=>'<option value="'+c.id+'"'+(c.id===prev?' selected':'')+'>'+c.name+'</option>').join('');
  if ((state.goals||[]).length) {
    catOpts += '<optgroup label="--- Goals ---">'
      + state.goals.map(function(g){ var v='goal:'+g.id; return '<option value="'+v+'"'+(v===prev?' selected':'')+'>'+g.emoji+' '+g.name+'</option>'; }).join('')
      + '</optgroup>';
  }
  if ((state.carFunds||[]).length) {
    catOpts += '<optgroup label="--- Car Funds ---">'
      + state.carFunds.map(function(c){ var v='car:'+c.id; return '<option value="'+v+'"'+(v===prev?' selected':'')+'>'+(c.emoji||'🚗')+' '+c.name+'</option>'; }).join('')
      + '</optgroup>';
  }
  catSel.innerHTML = catOpts;
  const mSel = document.getElementById('txn-month');
  const pm = mSel.value;
  mSel.innerHTML = '<option value="">All Months</option>' + getMonths().map(mk=>{
    const [y,m]=mk.split('-'); const label=new Date(y,m-1,1).toLocaleString('default',{month:'long',year:'numeric'});
    return `<option value="${mk}" ${mk===pm?'selected':''}>${label}</option>`;
  }).join('');
  renderTxnTable();
}

function getFilteredTxns() {
  const search=document.getElementById('txn-search').value.toLowerCase();
  const person=document.getElementById('txn-person').value;
  const account=document.getElementById('txn-account').value;
  const cat=document.getElementById('txn-cat').value;
  const month=document.getElementById('txn-month').value;
  const type=document.getElementById('txn-type').value;
  const sort=document.getElementById('txn-sort').value;
  let txns=state.transactions.filter(t=>{
    if(search&&!t.description.toLowerCase().includes(search)&&!t.category.includes(search))return false;
    if(person&&t.person!==person)return false;
    if(account&&t.account!==account)return false;
    if(cat&&t.category!==cat)return false;
    if(month&&getMonthKey(t.date)!==month)return false;
    if(type==='income'&&t.amount<=0)return false;
    if(type==='expense'&&t.amount>=0)return false;
    return true;
  });
  if(sort==='date-desc')txns.sort((a,b)=>parseDate(b.date)-parseDate(a.date));
  else if(sort==='date-asc')txns.sort((a,b)=>parseDate(a.date)-parseDate(b.date));
  else if(sort==='cat')txns.sort((a,b)=>a.category.localeCompare(b.category));
  else if(sort==='amount-desc')txns.sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount));
  return txns;
}

function buildCatOptions(selectedCat) {
  let opts = state.categories.map(c=>'<option value="'+c.id+'"'+(c.id===selectedCat?' selected':'')+'>'+c.name+'</option>').join('');
  if(state.goals && state.goals.length) {
    opts += '<optgroup label="--- Goals ---">' +
      state.goals.map(g=>{const v='goal:'+g.id;return'<option value="'+v+'"'+(v===selectedCat?' selected':'')+'>'+g.emoji+' '+g.name+'</option>';}).join('') +
      '</optgroup>';
  }
  if(state.carFunds && state.carFunds.length) {
    opts += '<optgroup label="--- Car Funds ---">' +
      state.carFunds.map(function(c){var v='car:'+c.id;return'<option value="'+v+'"'+(v===selectedCat?' selected':'')+'>'+(c.emoji||'🚗')+' '+c.name+'</option>';}).join('') +
      '</optgroup>';
  }
  return opts;
}

function acctBadge(acctId){
  var a = getAccountById(acctId);
  if (a) {
    var ic = ACCT_TYPE_ICONS[a.type] || '🏦';
    var owner = getAccountOwner(a);
    var ownerColor = (owner && owner !== 'Unknown') ? getMemberColorSafe(owner) : 'var(--muted)';
    return '<span style="font-size:11px;font-weight:700;color:'+ownerColor+';background:'+ownerColor+'18;padding:1px 7px;border-radius:4px">'
      + ic + ' ' + a.nickname + '</span>';
  }
  var legacyIcons = { 'Chequing':'🏦','Savings':'💰','Credit Card':'💳','TFSA':'📈','RRSP':'🏛️','FHSA':'🏠','Loan':'💸','Line of Credit':'💳' };
  if (!acctId) return '<span style="font-size:11px;color:var(--muted)">🏦 Chequing</span>';
  if (acctId === 'Cash-Claimed') return '<span style="font-size:11px;font-weight:700;color:var(--member2);background:var(--member2-light);padding:1px 6px;border-radius:4px">✅ Cash Claimed</span>';
  if (acctId === 'Cash-Unclaimed') return '<span style="font-size:11px;font-weight:700;color:var(--accent);background:var(--yellow-light);padding:1px 6px;border-radius:4px">💵 Cash Unclaimed</span>';
  if (legacyIcons[acctId]) return '<span style="font-size:11px;color:var(--muted)">' + legacyIcons[acctId] + ' ' + acctId + '</span>';
  return '<span style="font-size:11px;color:var(--muted)">' + acctId + '</span>';
}
function getMemberColorSafe(name) {
  if (!name || name === 'Joint') return 'var(--yellow)';
  var nl = name.trim().toLowerCase();
  var m = (state.members||[]).find(function(x){ return x.name.trim().toLowerCase()===nl; });
  return m ? (m.color || 'var(--accent)') : 'var(--muted)';
}
function updateTxnCatSel(sel){var id=sel.closest('tr').dataset.txnid;updateTxnCat(id,sel.value);}
function updateTxnPersonSel(sel){var id=sel.closest('tr').dataset.txnid;updateTxnPerson(id,sel.value);}
function txnEditBtn(id){editTxn(id);}
function txnSplitBtn(id){openCatSplit(id);}
function txnDelBtn(id){deleteTxn(id);}

function renderTxnTable() {
  var txns=getFilteredTxns();
  var inc=txns.filter(function(t){return t.amount>0;}).reduce(function(s,t){return s+t.amount;},0);
  var exp=txns.filter(function(t){return t.amount<0;}).reduce(function(s,t){return s+Math.abs(t.amount);},0);
  document.getElementById('txn-summary').innerHTML=
    '<span>&#128202; <strong>'+txns.length+'</strong> transactions</span>'
    +'<span style="color:var(--green)">&#8593; '+fmt(inc)+'</span>'
    +'<span style="color:var(--red)">&#8595; '+fmt(exp)+'</span>'
    +'<span>Net: <strong style="color:'+(inc-exp>=0?'var(--green)':'var(--red)')+'">'+fmtSigned(inc-exp)+'</strong></span>';
  var items=txns.slice(txnPage*PAGE_SIZE,(txnPage+1)*PAGE_SIZE);
  document.getElementById('txn-tbody').innerHTML=items.map(function(t){
    var cat=getCatById(t.category);
    var isSplit=t.source==='split';
    var isCatSplitParent=t.source==='cat-split-parent';
    var isCatSplitChild=t.source==='cat-split';
    var hasSplits=state.goalSplits&&state.goalSplits[t.id]&&state.goalSplits[t.id].length>0;
    var goalBadge=cat.isGoal?'<span style="background:var(--yellow-light);color:var(--yellow);font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700;margin-left:3px">GOAL</span>':'';
    var splitBadge=hasSplits?'<span style="background:var(--green-light);color:var(--green);font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700;margin-left:3px" title="Has goal splits">&#9889;</span>':'';
    var splitRowBadge=isSplit?'<span style="background:var(--purple);color:#fff;font-size:10px;padding:1px 5px;border-radius:4px;margin-left:3px">Split</span>':'';
    var catSplitParentBadge=isCatSplitParent?'<span style="background:var(--yellow-light);color:var(--yellow);font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700;margin-left:3px">&#9889; Split</span>':'';
    var catSplitChildBadge=isCatSplitChild?'<span style="background:var(--surface);color:var(--muted);font-size:10px;padding:1px 5px;border-radius:4px;border:1px solid var(--border);margin-left:3px">↳ Split</span>':'';
    var billBadge=t.billId?(function(){var bn=t.billName||((state.bills||[]).find(function(b){return b.id===t.billId;})||{}).name||'Bill';return'<span style="background:var(--green-light);color:var(--green);font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700;margin-left:3px" title="Linked to bill: '+bn+'">🔗 '+bn+'</span>';})():'';
    var weddingBadge=t.category==='wedding-transfer'?'<span style="background:var(--yellow-light);color:var(--accent2);font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700;margin-left:3px">💍 Wedding Fund</span>':'';
    var rowStyle=isSplit?'style="background:var(--surface);opacity:0.85"'
      :isCatSplitParent?'style="background:rgba(201,125,90,0.06)"'
      :isCatSplitChild?'style="background:var(--surface);padding-left:12px"':'';
    var catSel=isCatSplitParent
      ?'<span style="color:var(--muted);font-size:12px">—</span>'
      :t.category==='wedding-transfer'
        ?'<span style="font-size:12px;color:var(--accent2);font-weight:700">💍 Wedding Fund</span>'
        :'<select onchange="updateTxnCatSel(this)" style="background:var(--surface);border:1px solid var(--border);color:var(--text);padding:3px 8px;border-radius:6px;font-size:12px;max-width:140px">'+buildCatOptions(t.category)+'</select>';
    var persSelect='<select onchange="updateTxnPersonSel(this)" style="background:var(--surface);border:1px solid var(--border);color:var(--text);padding:3px 8px;border-radius:6px;font-size:12px">'
      +(state.members||[]).map(function(m){ return '<option value="'+m.name+'"'+(t.person===m.name?' selected':'')+'>'+m.name+'</option>'; }).join('')
      +'</select>';
    var tid=t.id;
    var splitBtn = isCatSplitChild ? ''
      : '<button class="btn btn-sm" style="background:var(--yellow-light);color:var(--yellow);border:1px solid var(--yellow);font-size:11px" title="Split into multiple categories" data-tid="'+tid+'" onclick="txnSplitBtn(this.dataset.tid)">&#9889; Split</button>';
    var actions='<div style="display:flex;gap:3px;flex-wrap:wrap">'
      +splitBadge
      +'<button class="btn btn-ghost btn-sm" title="Edit" data-tid="'+tid+'" onclick="txnEditBtn(this.dataset.tid)">&#9998;</button>'
      +splitBtn
      +(t.category==='transfer'?'<button class="btn btn-sm" style="background:var(--yellow-light);color:var(--accent2);border:1px solid var(--accent2);font-size:11px" title="Tag as wedding fund contribution" data-tid="'+tid+'" onclick="tagAsWeddingTransfer(this.dataset.tid)">💍 Tag</button>':'')
      +(t.category==='wedding-transfer'?'<button class="btn btn-sm" style="background:var(--surface);color:var(--muted);border:1px solid var(--border);font-size:11px" title="Remove wedding fund tag" data-tid="'+tid+'" onclick="untagWeddingTransfer(this.dataset.tid)">✕ Untag</button>':'')
      +'<button class="btn btn-danger btn-sm" title="Delete" data-tid="'+tid+'" onclick="txnDelBtn(this.dataset.tid)">&#215;</button>'
    return '<tr data-txnid="'+t.id+'" '+rowStyle+'>'
      +'<td style="font-size:12px">'+t.date+'</td>'
      +'<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+t.description+'">'+t.description+splitRowBadge+catSplitParentBadge+catSplitChildBadge+billBadge+weddingBadge+'</td>'
      +'<td>'+catSel+goalBadge+'</td>'
      +'<td>'+persSelect+'</td>'
      +'<td>'+acctBadge(t.account||'Chequing')+'</td>'
      +'<td class="text-right" style="color:'+(t.amount<0?'var(--red)':'var(--green)')+';font-weight:700">'+fmtSigned(t.amount)+'</td>'
      +'<td>'+actions+'</td></tr>';
  }).join('');
  var totalPages=Math.ceil(txns.length/PAGE_SIZE);
  document.getElementById('txn-pagination').innerHTML=totalPages<=1?'':'<button class="btn btn-ghost btn-sm" onclick="txnPage--;renderTxnTable()" '+(txnPage===0?'disabled':'')+'>&#8592; Prev</button><span style="color:var(--muted);font-size:12px">Page '+(txnPage+1)+' of '+totalPages+'</span><button class="btn btn-ghost btn-sm" onclick="txnPage++;renderTxnTable()" '+(txnPage===totalPages-1?'disabled':'')+'>Next &#8594;</button>';
}

function updateTxnCat(id,cat){
  const t=state.transactions.find(x=>x.id===id);
  if(!t){saveState();return;}
  const oldCat=t.category;
  t.category=cat;
  saveState();
  const sameDesc=state.transactions.filter(x=>x.id!==id&&x.description===t.description&&x.category===oldCat);
  if(sameDesc.length>0){
    hhConfirm(
      'Apply <strong>'+cat+'</strong> to all '+sameDesc.length+' other transaction'+(sameDesc.length!==1?'s':'')+' named "<em>'+t.description.substring(0,30)+'</em>"?',
      '🏷️', 'Update All Matching?'
    ).then(function(doAll){
      if(doAll){
        sameDesc.forEach(function(x){x.category=cat;});
        var descUpper=t.description.toUpperCase().substring(0,30);
        if(!state.catRules) state.catRules=[];
        var exists=state.catRules.find(function(r){return r.match===descUpper;});
        if(!exists) state.catRules.push({match:descUpper,cat:cat});
        saveState();
      }
    });
  }
}
function updateTxnPerson(id,person){const t=state.transactions.find(t=>t.id===id);if(t){t.person=person;saveState();}}
function deleteTxn(id){hhConfirm('Delete this transaction?','🗑️','Delete').then(function(ok){if(!ok)return;state.transactions=state.transactions.filter(t=>t.id!==id);saveState();renderTxnTable();});}
function tagAsWeddingTransfer(id){
  var t=state.transactions.find(function(x){return x.id===id;});
  if(!t)return;
  t.category='wedding-transfer';
  saveState();
  renderTxnTable();
  if(typeof renderWeddingFundContributions==='function')renderWeddingFundContributions();
  if(typeof renderGoals==='function')renderGoals();
  hhToast('💍 Tagged as Wedding Fund contribution');
}
function untagWeddingTransfer(id){
  var t=state.transactions.find(function(x){return x.id===id;});
  if(!t)return;
  t.category='transfer';
  saveState();
  renderTxnTable();
  if(typeof renderWeddingFundContributions==='function')renderWeddingFundContributions();
  if(typeof renderGoals==='function')renderGoals();
  hhToast('Tag removed');
}
function editTxn(id){
  const t=state.transactions.find(t=>t.id===id);if(!t)return;
  document.getElementById('edit-txn-id').value=id;document.getElementById('edit-desc').value=t.description;
  document.getElementById('edit-amount').value=t.amount;document.getElementById('edit-account').value=t.account||'Chequing';
  populateCatSelect('edit-cat', true);document.getElementById('edit-cat').value=t.category;
  document.getElementById('edit-person').value=t.person;openModal('edit-txn-modal');
}
function saveEditTxn(){
  const id=document.getElementById('edit-txn-id').value;const t=state.transactions.find(t=>t.id===id);if(!t)return;
  t.description=document.getElementById('edit-desc').value;t.amount=parseFloat(document.getElementById('edit-amount').value);
  t.category=document.getElementById('edit-cat').value;t.person=document.getElementById('edit-person').value;
  t.account=document.getElementById('edit-account').value;saveState();closeModal('edit-txn-modal');renderTxnTable();
}
function saveManualTxn(){
  const type=document.getElementById('m-type').value;
  let amount=parseFloat(document.getElementById('m-amount').value)||0;
  if(type==='expense')amount=-Math.abs(amount);else amount=Math.abs(amount);
  const dp=document.getElementById('m-date').value.split('-');
  const t={id:uid(),date:`${parseInt(dp[1])}/${parseInt(dp[2])}/${dp[0]}`,description:document.getElementById('m-desc').value,amount,category:document.getElementById('m-category').value,person:document.getElementById('m-person').value,account:document.getElementById('m-account').value,source:'manual'};
  state.transactions.push(t);saveState();closeModal('manual-txn-modal');renderTransactions();
}
function saveCashPurchase(){
  const dp=document.getElementById('cash-date').value.split('-');
  const t={id:uid(),date:`${parseInt(dp[1])}/${parseInt(dp[2])}/${dp[0]}`,description:document.getElementById('cash-desc').value||'Cash purchase',amount:-Math.abs(parseFloat(document.getElementById('cash-amount').value)||0),category:document.getElementById('cash-cat').value,person:document.getElementById('cash-person').value,account:'Cash-Unclaimed',notes:document.getElementById('cash-notes').value,source:'cash'};
  state.transactions.push(t);saveState();closeModal('cash-modal');renderTransactions();
}

function renderBudget() {
  const ms=document.getElementById('budget-month-select');
  const months=getMonths();
  const prevVal = ms.value || getCurrentMonthKey();
  ms.innerHTML=months.map(mk=>{const[y,m2]=mk.split('-');const label=new Date(y,m2-1,1).toLocaleString('default',{month:'long',year:'numeric'});return`<option value="${mk}">${label}</option>`;}).join('');
  const targetMonth = months.includes(prevVal) ? prevVal : getCurrentMonthKey();
  ms.value = months.includes(targetMonth) ? targetMonth : (months[0] || getCurrentMonthKey());
  const mk=ms.value;
  const mt=state.transactions.filter(t=>getMonthKey(t.date)===mk&&t.amount<0&&t.category!=='transfer'&&t.category!=='wedding-transfer');
  const txnIncome=state.transactions.filter(t=>getMonthKey(t.date)===mk&&t.amount>0&&t.category!=='transfer'&&t.category!=='wedding-transfer'&&t.source!=='tips'&&t.source!=='split').reduce((s,t)=>s+t.amount,0);
  const income=txnIncome+getTipsForMonth(mk);
  const totalSpend=mt.reduce((s,t)=>s+Math.abs(t.amount),0);
  const totalBudget=Object.values(state.budgets).reduce((s,v)=>s+v,0);
  var netColor = totalBudget-totalSpend >= 0 ? 'clr-green' : 'clr-red';
  var savingsPct = income > 0 ? Math.round(((income - totalSpend) / income) * 100) : 0;
  var savingsIcon = savingsPct >= 20 ? '🟢' : savingsPct >= 0 ? '🟡' : '🔴';
  var billsMonthly = 0;
  var billsCount = 0;
  if (isFeatureOn('bills')) {
    (state.bills||[]).forEach(function(b){ billsMonthly += _billMonthlyCost(b); billsCount++; });
  }
  var billsStatHtml = (isFeatureOn('bills') && billsCount > 0)
    ? '<div class="stat" style="cursor:pointer" onclick="showPage(\'bills\')">'
        +'<div class="stat-icon">📋</div>'
        +'<div class="stat-label">Committed Bills</div>'
        +'<div class="stat-value clr-accent">'+fmt(billsMonthly)+'</div>'
        +'<div class="stat-sub">'+billsCount+' recurring bill'+(billsCount!==1?'s':'')+' tracked</div>'
      +'</div>'
    : '';

  document.getElementById('budget-totals').innerHTML=
    '<div class="stat stat-income">'
      +'<div class="stat-icon">💵</div>'
      +'<div class="stat-label">Total Income</div>'
      +'<div class="stat-value clr-green">'+fmt(income)+'</div>'
      +(getTipsForMonth(mk)>0?'<div class="stat-sub" style="color:var(--member2)">incl. '+fmt(getTipsForMonth(mk))+' tips</div>':'')
    +'</div>'
    +'<div class="stat stat-expense">'
      +'<div class="stat-icon">🧾</div>'
      +'<div class="stat-label">Total Spent</div>'
      +'<div class="stat-value clr-red">'+fmt(totalSpend)+'</div>'
      +'<div class="stat-sub">of '+fmt(totalBudget)+' budgeted</div>'
    +'</div>'
    +'<div class="stat">'
      +'<div class="stat-icon">'+savingsIcon+'</div>'
      +'<div class="stat-label">Budget Remaining</div>'
      +'<div class="stat-value '+netColor+'">'+fmtSigned(totalBudget-totalSpend)+'</div>'
      +'<div class="stat-sub">'+(totalBudget>0?Math.round(Math.max(0,totalBudget-totalSpend)/totalBudget*100)+'% of budget left':'—')+'</div>'
    +'</div>'
    +'<div class="stat">'
      +'<div class="stat-icon">📈</div>'
      +'<div class="stat-label">Savings Rate</div>'
      +'<div class="stat-value '+(savingsPct>=0?'clr-green':'clr-red')+'">'+savingsPct+'%</div>'
      +'<div class="stat-sub">income minus spending</div>'
    +'</div>'
    +billsStatHtml;
  const catSpend={};mt.forEach(t=>{if(t.category!=='transfer'&&t.category!=='wedding-transfer'&&t.category!=='income')catSpend[t.category]=(catSpend[t.category]||0)+Math.abs(t.amount);});
  var barRows = state.categories.filter(c=>c.id!=='income'&&c.id!=='transfer'&&c.id!=='wedding-transfer').map(c=>{
    const spent=catSpend[c.id]||0;const budget=state.budgets[c.id]||0;const pct=budget?Math.min(100,Math.round((spent/budget)*100)):0;const over=budget&&spent>budget;
    if(!spent&&!budget)return'';
    return ('<div class="budget-row'+(over?' over':'')+'">'
      +'<div class="budget-cat-dot" style="background:'+c.color+'"></div>'
      +'<div class="budget-cat-name">'+c.name+'</div>'
      +'<div class="budget-bar-wrap">'+(budget?'<div class="budget-bar-track"><div class="budget-bar-fill" style="width:'+pct+'%;background:'+(over?'var(--red)':pct>70?'var(--yellow)':c.color)+'"></div></div>':'')+'</div>'
      +'<div class="budget-amounts'+(over?' over':'')+'">'+fmt(spent)+(budget?' / '+fmt(budget):' (no budget)')+'</div>'
      +'</div>');
  }).filter(Boolean);
  (state.goals||[]).forEach(function(g){
    var spent=catSpend['goal:'+g.id]||0; if(!spent)return;
    barRows.push('<div class="budget-row"><div class="budget-cat-dot" style="background:var(--yellow)"></div>'
      +'<div class="budget-cat-name">'+g.emoji+' '+g.name+'</div>'
      +'<div class="budget-bar-wrap"></div>'
      +'<div class="budget-amounts">'+fmt(spent)+' saved</div></div>');
  });
  (state.carFunds||[]).forEach(function(c){
    var spent=catSpend['car:'+c.id]||0; if(!spent)return;
    barRows.push('<div class="budget-row"><div class="budget-cat-dot" style="background:var(--accent)"></div>'
      +'<div class="budget-cat-name">'+(c.emoji||'🚗')+' '+c.name+'</div>'
      +'<div class="budget-bar-wrap"></div>'
      +'<div class="budget-amounts">'+fmt(spent)+' saved</div></div>');
  });
  document.getElementById('budget-bars').innerHTML=barRows.join('')||'<div style="color:var(--muted)">No spending data.</div>';

  const tipsTotal=getTipsForMonth(mk);
  const tipsDeposit=getTipsDepositForMonth(mk);
  const tipsCash=tipsTotal-tipsDeposit;
  const tipsList=state.tips.filter(t=>{const d=new Date(t.date);return(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))===mk;});
  document.getElementById('tips-summary').innerHTML=''
    +'<div style="font-size:28px;font-weight:700;color:var(--member2);margin-bottom:2px;font-family:\'Playfair Display\',serif">'+fmt(tipsTotal)+'</div>'
    +'<div style="color:var(--muted);font-size:12px;margin-bottom:8px">'+tipsList.length+' entries this month</div>'
    +'<div style="font-size:12px;margin-bottom:4px;display:flex;gap:16px">'
    +'<span>&#128179; Claimed (deposit): <strong style="color:var(--member2)">'+fmt(tipsDeposit)+'</strong></span>'
    +'<span>&#128181; Unclaimed cash: <strong style="color:var(--accent)">'+fmt(tipsCash)+'</strong></span>'
    +'</div>'
    +'<div class="alert alert-pink" style="margin:0">Set aside ~<strong>'+fmt(tipsDeposit*0.25)+'</strong> for CRA (on deposited tips)</div>';
  renderAccountBalances();
}

function getAccountOwner(a) {
  if (!a) return 'Unknown';
  if (a.isJoint) return 'Joint';
  var raw = (a.person || '').trim();
  var match = (state.members || []).find(function(m) {
    return m.name.trim().toLowerCase() === raw.toLowerCase();
  });
  return match ? match.name : (raw || 'Unknown');
}

function getGroupOrder() {
  var memberNames = (state.members || []).map(function(m) { return m.name; });
  return memberNames.concat(['Joint']);
}

function buildPersonGroups(accounts) {
  var order = getGroupOrder();
  var groups = {};
  order.forEach(function(g) { groups[g] = []; });
  accounts.forEach(function(a) {
    var owner = getAccountOwner(a);
    if (!groups[owner]) groups[owner] = [];  // handles unknown accounts gracefully
    groups[owner].push(a);
  });
  Object.keys(groups).forEach(function(g) {
    groups[g].sort(function(a, b) {
      return ACCT_TYPE_ORDER.indexOf(a.type) - ACCT_TYPE_ORDER.indexOf(b.type);
    });
  });
  return { groups: groups, order: order };
}

function renderAccountBalances() {
  var container = document.getElementById('account-balances');
  if (!container) return;
  var accounts = state.accounts || [];

  if (!accounts.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0">No accounts yet. Upload a statement to get started.</div>';
    return;
  }

  var built     = buildPersonGroups(accounts);
  var groups    = built.groups;
  var groupOrder = built.order;

  function calcBalance(acctId) {
    var isDebtAcct = !!ACCT_IS_DEBT[(getAccountById(acctId)||{}).type];
    var allTxns = state.transactions.filter(function(t){ return t.account === acctId && !t.isOpeningBalance; });
    var sb = state.startingBalances[acctId] || null;
    var hasStartingBalance = sb && sb.amount != null && sb.date;
    var balance, payments, charges, txnCount;
    if (hasStartingBalance) {
      var cutoff = sb.date;
      var filtered = allTxns.filter(function(t){ return toISO(t.date||'') > cutoff; });
      var txnSum = filtered.reduce(function(s,t){ return s+(parseFloat(t.amount)||0); }, 0);
      balance   = isDebtAcct ? parseFloat(sb.amount) - txnSum : parseFloat(sb.amount) + txnSum;
      payments  = filtered.filter(function(t){ return t.amount>0; }).reduce(function(s,t){ return s+t.amount; }, 0);
      charges   = filtered.filter(function(t){ return t.amount<0; }).reduce(function(s,t){ return s+Math.abs(t.amount); }, 0);
      txnCount  = filtered.length;
    } else {
      var txnSum2 = allTxns.reduce(function(s,t){ return s+(parseFloat(t.amount)||0); }, 0);
      balance   = isDebtAcct ? -txnSum2 : txnSum2;
      payments  = allTxns.filter(function(t){ return t.amount>0; }).reduce(function(s,t){ return s+t.amount; }, 0);
      charges   = allTxns.filter(function(t){ return t.amount<0; }).reduce(function(s,t){ return s+Math.abs(t.amount); }, 0);
      txnCount  = allTxns.length;
    }
    return { balance:balance, payments:payments, charges:charges, txnCount:txnCount, hasStartingBalance:hasStartingBalance, sb:sb, allTxns:allTxns, isDebtAcct:isDebtAcct };
  }

  var getMemberColor = getMemberColorSafe;
  function getMemberEmoji(name) {
    if (name === 'Joint') return '🤝';
    var nl = name.trim().toLowerCase();
    var m = (state.members||[]).find(function(x){ return x.name.trim().toLowerCase()===nl; });
    return m ? (m.emoji || '👤') : '👤';
  }

  if (!window._acctGroupCollapsed) window._acctGroupCollapsed = {};

  var html = '';
  groupOrder.forEach(function(owner) {
    var grp = groups[owner];
    if (!grp || !grp.length) return;

    var totalAssets = 0, totalDebts = 0;
    grp.forEach(function(a) {
      var d = calcBalance(a.id);
      if (ACCT_IS_DEBT[a.type]) totalDebts += Math.max(0, d.balance);
      else totalAssets += d.balance;
    });
    var netWorth   = totalAssets - totalDebts;
    var ownerColor = getMemberColor(owner);
    var ownerEmoji = getMemberEmoji(owner);
    var safeOwner  = owner.replace(/[^a-zA-Z0-9]/g, '_');
    var isCollapsed = window._acctGroupCollapsed[safeOwner] !== false; // default: collapsed

    html += '<div style="margin-bottom:8px">';
    html += '<div onclick="toggleAcctGroup(\'' +safeOwner+ '\')" style="display:flex;align-items:center;gap:10px;padding:10px 16px;'
      + 'background:'+ownerColor+'18;border:2px solid '+ownerColor+'44;border-radius:'+(isCollapsed?'var(--radius-sm)':'var(--radius-sm) var(--radius-sm) 0 0')+';cursor:pointer;user-select:none" id="acct-hdr-'+safeOwner+'">';
    html += '<span style="font-size:18px">'+ownerEmoji+'</span>';
    html += '<span style="font-weight:900;font-size:14px;color:'+ownerColor+';flex:1">'+owner+'</span>';
    html += '<div style="display:flex;gap:10px;font-size:12px;font-weight:800;flex-wrap:wrap;align-items:center">';
    html += '<span style="color:var(--green)">Assets&nbsp;'+fmt(totalAssets)+'</span>';
    html += '<span style="color:var(--red)">Debts&nbsp;'+fmt(totalDebts)+'</span>';
    html += '<span style="padding:2px 10px;border-radius:20px;background:'+(netWorth>=0?'color-mix(in srgb,var(--green) 15%,var(--card))':'color-mix(in srgb,var(--red) 15%,var(--card))')+';color:'+(netWorth>=0?'var(--green)':'var(--red)')+';">Net&nbsp;'+fmtSigned(netWorth)+'</span>';
    html += '</div>';
    html += '<span style="font-size:11px;color:var(--muted);min-width:16px;text-align:center;display:inline-block;transform:'+(isCollapsed?'rotate(0deg)':'rotate(180deg)')+';transition:transform 0.2s" id="acct-chev-'+safeOwner+'">&#9660;</span>';
    html += '</div>';

    html += '<div id="acct-body-'+safeOwner+'" style="display:'+(isCollapsed?'none':'block')+';border:2px solid '+ownerColor+'44;border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);padding:12px;background:var(--card)">';
    html += '<div style="display:flex;flex-wrap:wrap;gap:10px">';
    grp.forEach(function(a) {
      var d = calcBalance(a.id);
      var isDebt = !!ACCT_IS_DEBT[a.type];
      var isLoan = a.type === 'Loan' || a.type === 'Line of Credit';
      var balColor, balLabel;
      if (isDebt) {
        balColor = d.balance > 0 ? 'var(--red)' : 'var(--green)';
        balLabel = d.balance > 0 ? (isLoan ? 'Balance Owing' : 'Balance Owing') : 'Paid Off';
      } else {
        balColor = d.balance >= 0 ? ownerColor : 'var(--red)';
        balLabel = d.balance >= 0 ? 'Balance' : 'Overdrawn';
      }

      var noSBWarning = !d.hasStartingBalance && d.allTxns.length
        ? '<div style="margin-top:8px;font-size:10px;font-weight:700;color:var(--yellow);background:var(--yellow-light);border-radius:6px;padding:3px 8px;display:inline-block;">⚠ Set starting balance</div>'
        : '';
      var sbBadge = d.hasStartingBalance
        ? '<div style="margin-top:7px;font-size:10px;font-weight:700;color:var(--green);background:var(--green-light);border-radius:6px;padding:3px 8px;display:inline-block;">📌 From '+formatDateShort(d.sb.date)+'</div>'
        : '';

      html += '<div class="acct-balance-pill" style="flex-direction:column;align-items:flex-start;border-radius:var(--radius);padding:14px 18px;min-width:155px;flex:1;border-color:'+ownerColor+'33;position:relative">';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;width:100%">';
      html += '<span style="font-size:20px">'+(ACCT_TYPE_ICONS[a.type]||'🏦')+'</span>';
      html += '<span style="font-weight:800;font-size:12px;color:var(--text2);flex:1;line-height:1.2">'+a.nickname+'</span>';
      html += '<button data-sbid="'+a.id+'" onclick="openStartingBalanceModal(this.dataset.sbid)" title="Set Starting Balance" '
        + 'style="background:none;border:2px solid var(--border);border-radius:8px;cursor:pointer;font-size:11px;padding:2px 6px;color:var(--muted);font-family:Nunito,sans-serif;font-weight:800;transition:all 0.2s;line-height:1"'
        + ' onmouseover="this.style.borderColor=\'var(--accent)\';this.style.color=\'var(--accent)\'"'
        + ' onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--muted)\'">⚙</button>';
      html += '</div>';
      html += '<div style="font-size:22px;font-weight:700;color:'+balColor+';font-family:Playfair Display,serif;margin-bottom:2px">';
      html += fmt(Math.abs(d.balance));
      html += '</div>';
      html += '<div class="acct-balance-pill-label">'+balLabel+'</div>';
      html += sbBadge + noSBWarning;
      if (d.allTxns.length) {
        html += '<div style="display:flex;justify-content:space-between;width:100%;margin-top:10px;font-size:10px;border-top:1px solid var(--border);padding-top:7px">';
        if (isDebt) {
          html += '<span style="color:var(--green);font-weight:700">↓ '+fmt(d.payments)+'</span>';
          html += '<span style="color:var(--red);font-weight:700">↑ '+fmt(d.charges)+'</span>';
        } else {
          html += '<span style="color:var(--green);font-weight:700">+'+fmt(d.payments)+'</span>';
          html += '<span style="color:var(--red);font-weight:700">-'+fmt(d.charges)+'</span>';
        }
        html += '<span style="color:var(--muted);font-weight:700">'+d.txnCount+' txns</span>';
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>'; // end cards flex
    html += '</div>'; // end collapsible body
    html += '</div>'; // end outer wrapper
  });

  container.innerHTML = html;
}

function toggleAcctGroup(safeOwner) {
  if (!window._acctGroupCollapsed) window._acctGroupCollapsed = {};
  var isNowCollapsed = window._acctGroupCollapsed[safeOwner] !== false;
  window._acctGroupCollapsed[safeOwner] = !isNowCollapsed;
  var body  = document.getElementById('acct-body-' + safeOwner);
  var chev  = document.getElementById('acct-chev-' + safeOwner);
  var hdr   = document.getElementById('acct-hdr-'  + safeOwner);
  if (!body) return;
  var willBeOpen = !window._acctGroupCollapsed[safeOwner];
  body.style.display = willBeOpen ? 'block' : 'none';
  if (chev) chev.style.transform = willBeOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  if (hdr)  hdr.style.borderRadius = willBeOpen ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)';
}

function budgetExpandAll() {
  if (!window._acctGroupCollapsed) window._acctGroupCollapsed = {};
  Object.keys(window._acctGroupCollapsed).forEach(function(k) { window._acctGroupCollapsed[k] = false; });
  document.querySelectorAll('[id^="acct-body-"]').forEach(function(el) {
    var safeOwner = el.id.replace('acct-body-', '');
    window._acctGroupCollapsed[safeOwner] = false;
    el.style.display = 'block';
    var chev = document.getElementById('acct-chev-' + safeOwner);
    var hdr  = document.getElementById('acct-hdr-'  + safeOwner);
    if (chev) chev.style.transform = 'rotate(180deg)';
    if (hdr)  hdr.style.borderRadius = 'var(--radius-sm) var(--radius-sm) 0 0';
  });
}

function budgetCollapseAll() {
  if (!window._acctGroupCollapsed) window._acctGroupCollapsed = {};
  document.querySelectorAll('[id^="acct-body-"]').forEach(function(el) {
    var safeOwner = el.id.replace('acct-body-', '');
    window._acctGroupCollapsed[safeOwner] = true;
    el.style.display = 'none';
    var chev = document.getElementById('acct-chev-' + safeOwner);
    var hdr  = document.getElementById('acct-hdr-'  + safeOwner);
    if (chev) chev.style.transform = 'rotate(0deg)';
    if (hdr)  hdr.style.borderRadius = 'var(--radius-sm)';
  });
}

function formatDateShort(isoDate) {
  if (!isoDate) return '';
  var parts = isoDate.split('-');
  if (parts.length < 3) return isoDate;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
}

var ACCT_TYPE_ORDER = ['Chequing','Savings','TFSA','RRSP','FHSA','Investment','Credit Card','Loan','Line of Credit','Cash-Claimed','Cash-Unclaimed'];
var ACCT_TYPE_ICONS = {
  'Chequing':        '🏦',
  'Savings':         '💰',
  'TFSA':            '🛡️',
  'RRSP':            '📈',
  'FHSA':            '🏠',
  'Investment':      '📊',
  'Credit Card':     '💳',
  'Loan':            '🏦',
  'Line of Credit':  '🔗',
  'Cash-Claimed':    '✅',
  'Cash-Unclaimed':  '💵'
};
var ACCT_TYPE_LABELS = {
  'Chequing':        'Chequing',
  'Savings':         'Savings',
  'TFSA':            'TFSA',
  'RRSP':            'RRSP',
  'FHSA':            'FHSA',
  'Investment':      'Investment',
  'Credit Card':     'Credit Card',
  'Loan':            'Loan',
  'Line of Credit':  'Line of Credit',
  'Cash-Claimed':    'Cash (Claimed)',
  'Cash-Unclaimed':  'Cash (Unclaimed)'
};
var ACCT_IS_DEBT = { 'Credit Card': true, 'Loan': true, 'Line of Credit': true };

function getAccountById(id) {
  return (state.accounts || []).find(function(a){ return a.id === id; }) || null;
}

function acctDisplayName(acctId) {
  var a = getAccountById(acctId);
  if (!a) return acctId || 'Unknown';
  return a.nickname;
}

function acctOwnerLabel(acct) {
  if (!acct) return '';
  return acct.isJoint ? 'Joint' : (acct.person || '');
}

function buildAccountOptions(selectedId, includeBlank) {
  var opts = includeBlank ? '<option value="">-- Select Account --</option>' : '';
  var accounts = state.accounts || [];
  var builtOpts = buildPersonGroups(accounts);
  var persons = builtOpts.order.filter(function(g){ return builtOpts.groups[g] && builtOpts.groups[g].length; });
  persons.forEach(function(owner) {
    var group = builtOpts.groups[owner];
    if (persons.length > 1) opts += '<optgroup label="' + owner + '">';
    group.forEach(function(a){
      opts += '<option value="' + a.id + '"' + (a.id === selectedId ? ' selected' : '') + '>'
        + (ACCT_TYPE_ICONS[a.type] || '🏦') + ' ' + a.nickname + '</option>';
    });
    if (persons.length > 1) opts += '</optgroup>';
  });
  return opts;
}

function populateAccountDropdowns(selectedId) {
  var ids = ['m-account', 'edit-account'];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = buildAccountOptions(selectedId || '', true);
  });
  var filterEl = document.getElementById('txn-account');
  if (filterEl) {
    var prev = filterEl.value;
    filterEl.innerHTML = '<option value="">All Accounts</option>' + buildAccountOptions('', false).replace(/<option value="" .*?<\/option>/, '');
    filterEl.value = prev;
  }
  refreshUploadAccountSelect();
}

function refreshUploadAccountSelect() {
  var sel = document.getElementById('upload-account-select');
  if (!sel) return;
  var prev = sel.value;
  sel.innerHTML = '<option value="">-- Select or create account --</option>';
  var accounts = state.accounts || [];
  accounts.sort(function(a,b){ return ACCT_TYPE_ORDER.indexOf(a.type) - ACCT_TYPE_ORDER.indexOf(b.type); });
  accounts.forEach(function(a) {
    var owner = a.isJoint ? 'Joint' : (a.person || '');
    sel.innerHTML += '<option value="' + a.id + '">' + (ACCT_TYPE_ICONS[a.type]||'🏦') + ' ' + a.nickname + (owner ? ' (' + owner + ')' : '') + '</option>';
  });
  sel.innerHTML += '<option value="__new__">➕ Create New Account...</option>';
  if (prev) sel.value = prev;
}

function onUploadAccountChange() {
  var val = document.getElementById('upload-account-select').value;
  var newFields = document.getElementById('new-account-fields');
  var personRow = document.getElementById('upload-person-row');
  if (val === '__new__') {
    newFields.style.display = '';
    personRow.style.display = 'none';
    var ownerSel = document.getElementById('new-acct-person');
    if (ownerSel) ownerSel.innerHTML = (state.members||[]).map(function(m){
      return '<option value="' + m.name + '">' + m.name + '</option>';
    }).join('');
  } else if (val) {
    newFields.style.display = 'none';
    var acct = getAccountById(val);
    if (acct && acct.isJoint) {
      personRow.style.display = '';
    } else {
      personRow.style.display = 'none';
    }
  } else {
    newFields.style.display = 'none';
    personRow.style.display = 'none';
  }
}

function getUploadAccountId() {
  var val = document.getElementById('upload-account-select').value;
  if (!val) { hhAlert('Please select or create an account first.', '🏦'); return null; }
  if (val !== '__new__') return val;

  var nickname = (document.getElementById('new-acct-nickname').value || '').trim();
  var type     = document.getElementById('new-acct-type').value;
  var person   = document.getElementById('new-acct-person').value;
  var isJoint  = document.getElementById('new-acct-joint').checked;
  if (!nickname) { hhAlert('Please enter a nickname for the new account.', '✏️'); return null; }

  var newAcct = {
    id:       uid(),
    nickname: nickname,
    type:     type,
    person:   isJoint ? '' : person,
    isJoint:  isJoint
  };
  state.accounts.push(newAcct);
  saveState();
  refreshUploadAccountSelect();
  document.getElementById('upload-account-select').value = newAcct.id;
  document.getElementById('new-account-fields').style.display = 'none';
  renderAccountsList();
  return newAcct.id;
}

function getUploadPerson() {
  var val = document.getElementById('upload-account-select').value;
  if (val === '__new__') {
    var isJoint = document.getElementById('new-acct-joint').checked;
    return isJoint ? 'Joint' : (document.getElementById('new-acct-person').value || '');
  }
  var acct = getAccountById(val);
  if (!acct) return '';
  if (acct.isJoint) return document.getElementById('upload-person').value || 'Joint';
  return acct.person || '';
}

function renderAccountsList() {
  var container = document.getElementById('accounts-list');
  if (!container) return;
  var accounts = state.accounts || [];
  if (!accounts.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px">No accounts yet — upload a statement to get started.</div>';
    return;
  }

  var built2 = buildPersonGroups(accounts);
  var groups  = built2.groups;
  var order2  = built2.order;

  var html = '';
  order2.forEach(function(owner) {
    var grp = groups[owner];
    if (!grp || !grp.length) return;
    html += '<div style="margin-bottom:10px">';
    html += '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:6px">' + owner + '</div>';
    grp.forEach(function(a) {
      var txnCount = state.transactions.filter(function(t){ return t.account === a.id; }).length;
      html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface);border:2px solid var(--border);border-radius:var(--radius-sm);margin-bottom:6px">';
      html += '<span style="font-size:18px">' + (ACCT_TYPE_ICONS[a.type]||'🏦') + '</span>';
      html += '<div style="flex:1"><div style="font-weight:800;font-size:13px">' + a.nickname + '</div>';
      html += '<div style="font-size:11px;color:var(--muted)">' + (ACCT_TYPE_LABELS[a.type]||a.type) + (a.isJoint ? ' · Joint' : '') + ' · ' + txnCount + ' transactions</div></div>';
      html += '<button class="btn btn-ghost btn-sm" data-eid="'+a.id+'" onclick="openEditAccount(this.dataset.eid)">✏️</button>';
      html += '<button class="btn btn-ghost btn-sm" data-sbid="'+a.id+'" onclick="openStartingBalanceModal(this.dataset.sbid)" title="Set Starting Balance">📌</button>';
      if (txnCount === 0) {
        html += '<button class="btn btn-danger btn-sm" data-did="'+a.id+'" onclick="deleteAccount(this.dataset.did)">🗑️</button>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  container.innerHTML = html;
}

function openEditAccount(id) {
  var a = getAccountById(id);
  if (!a) return;
  document.getElementById('edit-acct-id').value = id;
  document.getElementById('edit-acct-nickname').value = a.nickname;
  document.getElementById('edit-acct-type').value = a.type;
  document.getElementById('edit-acct-joint').checked = !!a.isJoint;
  var personSel = document.getElementById('edit-acct-person');
  personSel.innerHTML = (state.members||[]).map(function(m){
    return '<option value="' + m.name + '"' + (m.name === a.person ? ' selected' : '') + '>' + m.name + '</option>';
  }).join('');
  var urlEl  = document.getElementById('edit-acct-cardurl');
  var feeEl  = document.getElementById('edit-acct-annualfee');
  var rateEl = document.getElementById('edit-acct-rewardsrate');
  if (urlEl)  urlEl.value  = a.cardUrl || '';
  if (feeEl)  feeEl.value  = (a.annualFee != null ? a.annualFee : '');
  if (rateEl) rateEl.value = a.rewardsRate || '';
  var statusEl = document.getElementById('edit-acct-lookup-status');
  if (statusEl) statusEl.textContent = '';
  populateCardPresetDropdown(a.presetId || '');
  toggleEditAcctCardDetails();
  openModal('edit-account-modal');
}

// Account types where a card/account link + rewards/fee details make sense.
var CARD_DETAIL_TYPES = ['Credit Card', 'Loan', 'Line of Credit', 'Investment'];

// ───────────────────────────────────────────────────────────────────────────
// Phase 3.2 — Curated Canadian card preset library.
//
// Picking a preset in the Edit Account modal auto-fills annual fee, a readable
// rewards-rate string, and a STRUCTURED `earn` map keyed to the app's own
// category ids (see defaultCategories() in 01-core.js). The structured data is
// what the Cashflow Advisor (09-cashflow.js) will use later to route spend to
// the best-earning card per category.
//
// earn map: numbers are the PUBLISHED earn for that category —
//   • unit:'cashback' → the number is a percent (e.g. 4 = 4% back)
//   • unit:'points'   → the number is points per $1; multiply by `ptValueCents`
//                       (approx cents per point) to get an effective percent.
// `_default` is the base/everything-else rate. Category keys map to: groceries,
// dining, gas, travel, phone, subscriptions, entertainment, shopping, health,
// auto. Rates change often — these are typical published values and the user
// can edit every field before saving.
// ───────────────────────────────────────────────────────────────────────────
var CARD_PRESETS = [
  { id:'cobalt', name:'Amex Cobalt', annualFee:155.88, unit:'points', ptValueCents:1.0,
    rewardsRate:'5x eats & groceries · 3x streaming · 2x travel/gas · 1x else (MR pts)',
    earn:{ groceries:5, dining:5, subscriptions:3, entertainment:3, travel:2, gas:2, _default:1 } },
  { id:'scotia_gold', name:'Scotiabank Gold American Express', annualFee:120, unit:'points', ptValueCents:1.0,
    rewardsRate:'5x groceries/dining/entertainment · 3x gas/transit/phone · 1x else (Scene+)',
    earn:{ groceries:5, dining:5, entertainment:5, gas:3, phone:3, subscriptions:3, _default:1 } },
  { id:'scotia_momentum', name:'Scotiabank Momentum Visa Infinite', annualFee:120, unit:'cashback', ptValueCents:1.0,
    rewardsRate:'4% groceries & recurring · 2% gas & transit · 1% else (cash back)',
    earn:{ groceries:4, subscriptions:4, phone:2, gas:2, _default:1 } },
  { id:'cibc_dividend', name:'CIBC Dividend Visa Infinite', annualFee:120, unit:'cashback', ptValueCents:1.0,
    rewardsRate:'4% gas & groceries · 2% dining/recurring · 1% else (cash back)',
    earn:{ groceries:4, gas:4, dining:2, phone:2, subscriptions:2, _default:1 } },
  { id:'td_cashback', name:'TD Cash Back Visa Infinite', annualFee:139, unit:'cashback', ptValueCents:1.0,
    rewardsRate:'3% groceries/gas/recurring · 1% else (cash back)',
    earn:{ groceries:3, gas:3, phone:3, subscriptions:3, _default:1 } },
  { id:'bmo_cashback_we', name:'BMO CashBack World Elite Mastercard', annualFee:120, unit:'cashback', ptValueCents:1.0,
    rewardsRate:'5% groceries · 4% transit · 3% gas · 0.5% else (cash back)',
    earn:{ groceries:5, gas:3, _default:0.5 } },
  { id:'bmo_eclipse', name:'BMO eclipse Visa Infinite', annualFee:120, unit:'points', ptValueCents:0.67,
    rewardsRate:'5x groceries/dining/gas/transit · 1x else (BMO pts)',
    earn:{ groceries:5, dining:5, gas:5, _default:1 } },
  { id:'rbc_avion', name:'RBC Avion Visa Infinite', annualFee:120, unit:'points', ptValueCents:1.5,
    rewardsRate:'1.25 pts/$1 on eligible travel · 1 pt/$1 else (Avion)',
    earn:{ travel:1.25, _default:1 } },
  { id:'tangerine', name:'Tangerine Money-Back Mastercard', annualFee:0, unit:'cashback', ptValueCents:1.0,
    rewardsRate:'2% in 3 chosen categories · 0.5% else (cash back)',
    earn:{ groceries:2, gas:2, dining:2, _default:0.5 } },
  { id:'rogers_red', name:'Rogers Red World Elite Mastercard', annualFee:0, unit:'cashback', ptValueCents:1.0,
    rewardsRate:'1.5% everything (3% on USD purchases) (cash back)',
    earn:{ _default:1.5 } },
  { id:'pc_we', name:'PC Financial World Elite Mastercard', annualFee:0, unit:'points', ptValueCents:0.1,
    rewardsRate:'30 pts/$1 at Loblaw banners · 45 pts/$1 at Shoppers (PC Optimum)',
    earn:{ groceries:30, health:45, gas:30, _default:10 } },
  { id:'triangle_we', name:'Canadian Tire Triangle World Elite', annualFee:0, unit:'cashback', ptValueCents:1.0,
    rewardsRate:'~3% groceries · ~4% at CT stores & gas bars · 1% else (CT Money)',
    earn:{ groceries:3, gas:4, _default:1 } },
  { id:'triangle', name:'Canadian Tire Triangle Mastercard', annualFee:0, unit:'cashback', ptValueCents:1.0,
    rewardsRate:'~4% at Canadian Tire family stores · CT Money at Gas+ · modest else (CT Money)',
    earn:{ gas:2, _default:1 } },
  { id:'rbc_ion_plus', name:'RBC ION+ Visa', annualFee:48, unit:'points', ptValueCents:1.0,
    rewardsRate:'3x groceries/gas/dining/rideshare/transit/streaming · 1x else (Avion pts)',
    earn:{ groceries:3, gas:3, dining:3, subscriptions:3, entertainment:3, _default:1 } },
  { id:'rbc_ion', name:'RBC ION Visa', annualFee:0, unit:'points', ptValueCents:1.0,
    rewardsRate:'1.5x groceries/gas/rideshare/streaming · 1x else (Avion pts)',
    earn:{ groceries:1.5, gas:1.5, subscriptions:1.5, _default:1 } },
  { id:'capitalone_guaranteed', name:'Capital One Guaranteed Mastercard', annualFee:59, unit:'cashback', ptValueCents:1.0,
    rewardsRate:'No rewards — credit-building card (reports to both bureaus)',
    earn:{ _default:0 } },
];

function getCardPresetById(id) {
  return CARD_PRESETS.filter(function(p){ return p.id === id; })[0] || null;
}

// Fill the preset dropdown; preselect the account's saved preset if any.
function populateCardPresetDropdown(selectedId) {
  var sel = document.getElementById('edit-acct-preset');
  if (!sel) return;
  var opts = '<option value="">— Pick a Canadian card —</option>';
  CARD_PRESETS.forEach(function(p) {
    var fee = p.annualFee ? ' ($' + p.annualFee + ')' : ' (no fee)';
    opts += '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + p.name + fee + '</option>';
  });
  sel.innerHTML = opts;
}

// Apply the chosen preset to the form. Overwrites fee & rewards rate (the whole
// point of a quick-fill); only fills the nickname if it's still blank so a
// user-typed name is never clobbered. Structured earn data is committed on save.
function applyCardPreset() {
  var sel = document.getElementById('edit-acct-preset');
  if (!sel) return;
  var p = getCardPresetById(sel.value);
  if (!p) return;
  var nickEl = document.getElementById('edit-acct-nickname');
  var feeEl  = document.getElementById('edit-acct-annualfee');
  var rateEl = document.getElementById('edit-acct-rewardsrate');
  var statusEl = document.getElementById('edit-acct-lookup-status');
  if (nickEl && !nickEl.value.trim()) nickEl.value = p.name;
  if (feeEl)  feeEl.value  = (p.annualFee != null ? p.annualFee : '');
  if (rateEl) rateEl.value = p.rewardsRate || '';
  if (statusEl) {
    statusEl.style.color = 'var(--muted)';
    statusEl.textContent = '✓ Filled from “' + p.name + '” preset. Edit any field before saving.';
  }
}

function toggleEditAcctCardDetails() {
  var box = document.getElementById('edit-acct-card-details');
  if (!box) return;
  var type = document.getElementById('edit-acct-type').value;
  box.style.display = (CARD_DETAIL_TYPES.indexOf(type) !== -1) ? '' : 'none';
}

// Live Wix backend proxy (Phase 0 — proven 2026-06-22). Fetches a card page
// server-side (no CORS) and returns title/description/annualFee/rewardsRate.
var CARD_LOOKUP_URL = 'https://mattjsindall.wixsite.com/homehub/_functions/cardLookup';

async function lookupCardDetails() {
  var urlEl    = document.getElementById('edit-acct-cardurl');
  var feeEl    = document.getElementById('edit-acct-annualfee');
  var rateEl   = document.getElementById('edit-acct-rewardsrate');
  var nickEl   = document.getElementById('edit-acct-nickname');
  var statusEl = document.getElementById('edit-acct-lookup-status');
  var btn      = document.getElementById('edit-acct-lookup-btn');
  var target   = (urlEl && urlEl.value || '').trim();

  if (!target) {
    if (statusEl) { statusEl.style.color = 'var(--danger)'; statusEl.textContent = 'Paste a card link first.'; }
    return;
  }
  if (!/^https?:\/\//i.test(target)) {
    if (statusEl) { statusEl.style.color = 'var(--danger)'; statusEl.textContent = 'Link must start with http:// or https://'; }
    return;
  }

  if (btn) { btn.disabled = true; }
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = 'Looking up… (fetched server-side, no login)'; }

  try {
    var res  = await fetch(CARD_LOOKUP_URL + '?url=' + encodeURIComponent(target));
    var data = await res.json();
    if (!data || data.ok !== true) {
      throw new Error(data && data.error ? data.error : 'Lookup failed');
    }

    var filled = [];
    if (data.title && nickEl && !nickEl.value.trim()) {
      nickEl.value = String(data.title).slice(0, 60);
      filled.push('nickname');
    }
    if (data.annualFee != null && feeEl) {
      feeEl.value = data.annualFee;
      filled.push('annual fee');
    }
    if (data.rewardsRate && rateEl && !rateEl.value.trim()) {
      rateEl.value = data.rewardsRate;
      filled.push('rewards rate');
    }

    if (statusEl) {
      statusEl.style.color = 'var(--muted)';
      if (filled.length) {
        statusEl.textContent = '✓ Filled ' + filled.join(', ') + '. Check & edit before saving.';
      } else {
        statusEl.textContent = '✓ Page read, but no fields auto-filled (often JS-only). Enter details manually.';
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = 'Lookup failed: ' + (err && err.message ? err.message : err) + '. Enter details manually.';
    }
  } finally {
    if (btn) { btn.disabled = false; }
  }
}

function saveEditAccount() {
  var id = document.getElementById('edit-acct-id').value;
  var a  = getAccountById(id);
  if (!a) return;
  a.nickname = document.getElementById('edit-acct-nickname').value.trim() || a.nickname;
  a.type     = document.getElementById('edit-acct-type').value;
  a.isJoint  = document.getElementById('edit-acct-joint').checked;
  a.person   = a.isJoint ? '' : document.getElementById('edit-acct-person').value;
  var urlEl  = document.getElementById('edit-acct-cardurl');
  var feeEl  = document.getElementById('edit-acct-annualfee');
  var rateEl = document.getElementById('edit-acct-rewardsrate');
  if (CARD_DETAIL_TYPES.indexOf(a.type) !== -1) {
    a.cardUrl     = urlEl ? urlEl.value.trim() : '';
    a.rewardsRate = rateEl ? rateEl.value.trim() : '';
    var feeVal    = feeEl ? parseFloat(feeEl.value) : NaN;
    a.annualFee   = isNaN(feeVal) ? null : feeVal;
    // Persist the chosen preset + its structured earn data for the Cashflow
    // Advisor's rewards routing (Phase 3.1). Manual edits to fee/rate above are
    // kept as-is; the earn map is the machine-readable companion.
    var presetSel = document.getElementById('edit-acct-preset');
    var preset    = presetSel ? getCardPresetById(presetSel.value) : null;
    if (preset) {
      a.presetId     = preset.id;
      a.earn         = preset.earn;
      a.rewardUnit   = preset.unit;
      a.ptValueCents = preset.ptValueCents;
    }
  }
  saveState();
  closeModal('edit-account-modal');
  renderAccountsList();
  populateAccountDropdowns();
  renderAccountBalances();
}

function deleteAccount(id) {
  hhConfirm('Delete this account? This cannot be undone.', '🗑️', 'Delete Account').then(function(ok) {
    if (!ok) return;
    state.accounts = state.accounts.filter(function(a){ return a.id !== id; });
    delete state.startingBalances[id];
    saveState();
    renderAccountsList();
    populateAccountDropdowns();
    renderAccountBalances();
  });
}

function sbUpdatePreview() {
  var key    = document.getElementById('sb-account-key').value;
  var date   = document.getElementById('sb-date').value;
  var amount = parseFloat(document.getElementById('sb-amount').value);
  var preview = document.getElementById('sb-preview');
  if (!date || isNaN(amount)) { preview.style.display = 'none'; return; }
  var acct = getAccountById(key);
  var isDebt = acct ? !!ACCT_IS_DEBT[acct.type] : false;
  var txnsAfter = state.transactions.filter(function(t){
    return t.account === key && !t.isOpeningBalance && toISO(t.date||'') > date;
  });
  var txnSum = txnsAfter.reduce(function(s,t){ return s+(parseFloat(t.amount)||0); }, 0);
  var estBalance = isDebt ? amount - txnSum : amount + txnSum;
  var balEl = document.getElementById('sb-preview-balance');
  var detEl = document.getElementById('sb-preview-detail');
  var fmtAmt = function(n){ return '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); };
  var displayBal = isDebt ? (estBalance > 0 ? '-' : '') + fmtAmt(estBalance) : fmtAmt(estBalance);
  var balColor = isDebt ? (estBalance > 0 ? 'var(--red)' : 'var(--green)') : (estBalance >= 0 ? 'var(--green)' : 'var(--red)');
  balEl.textContent = displayBal;
  balEl.style.color = balColor;
  detEl.textContent = txnsAfter.length + ' transactions after ' + formatDateShort(date);
  preview.style.display = '';
}

function openStartingBalanceModal(accountKey) {
  var sb = state.startingBalances[accountKey] || {};
  document.getElementById('sb-account-key').value = accountKey;
  var acct = getAccountById(accountKey);
  var label = acct ? acct.nickname : accountKey;
  document.getElementById('sb-account-label').textContent = label;
  document.getElementById('sb-date').value = sb.date || '';
  document.getElementById('sb-amount').value = sb.amount != null ? sb.amount : '';
  var isDebt = acct ? !!ACCT_IS_DEBT[acct.type] : (accountKey === 'Credit Card');
  document.getElementById('sb-amount-note').textContent = isDebt
    ? 'Enter the amount owing on that date (as a positive number).'
    : 'Enter your account balance on that date. Use a negative number if the account was overdrawn.';
  document.getElementById('sb-clear-btn').style.display = sb.date ? 'inline-flex' : 'none';
  document.getElementById('sb-preview').style.display = 'none';
  if (sb.date && sb.amount != null) { setTimeout(sbUpdatePreview, 50); }
  openModal('starting-balance-modal');
  setTimeout(function(){ document.getElementById('sb-date').focus(); }, 100);
}

function saveStartingBalance() {
  var key    = document.getElementById('sb-account-key').value;
  var date   = document.getElementById('sb-date').value;
  var amount = parseFloat(document.getElementById('sb-amount').value);
  if (!date) return hhAlert('Please select a date.', '📅');
  if (isNaN(amount)) return hhAlert('Please enter a valid balance amount.', '💰');
  state.startingBalances[key] = { date: date, amount: amount };
  saveState();
  closeModal('starting-balance-modal');
  renderAccountBalances();
  setTimeout(function() {
    var btn = document.querySelector('[data-sbid="' + key + '"]');
    if (btn) {
      var card = btn.closest('.acct-balance-pill');
      if (card) {
        card.style.transition = 'box-shadow 0.15s, border-color 0.15s';
        card.style.boxShadow = '0 0 0 4px var(--green)';
        card.style.borderColor = 'var(--green)';
        setTimeout(function() {
          card.style.boxShadow = '';
          card.style.borderColor = '';
          setTimeout(function(){ card.style.transition = ''; }, 400);
        }, 900);
      }
    }
  }, 50);
}

function clearStartingBalance() {
  var key = document.getElementById('sb-account-key').value;
  var acct = getAccountById(key);
  var label = acct ? acct.nickname : key;
  hhConfirm('Remove the starting balance for ' + label + '? The balance will go back to summing all transactions.', '🗑️', 'Clear Starting Balance').then(function(ok) {
    if (!ok) return;
    delete state.startingBalances[key];
    saveState();
    closeModal('starting-balance-modal');
    renderAccountBalances();
  });
}

function renderBudgetEditFields(){
  document.getElementById('budget-edit-fields').innerHTML=state.categories.filter(c=>c.id!=='income'&&c.id!=='transfer'&&c.id!=='wedding-transfer').map(c=>`<div class="form-row"><label><span class="cat-dot" style="background:${c.color}"></span>${c.name}</label><input type="number" id="budg-${c.id}" value="${state.budgets[c.id]||0}"></div>`).join('');
}
function saveBudgets(){
  state.categories.filter(c=>c.id!=='income'&&c.id!=='transfer'&&c.id!=='wedding-transfer').forEach(c=>{state.budgets[c.id]=parseFloat(document.getElementById('budg-'+c.id)?.value)||0;});
  saveState();closeModal('budget-edit-modal');renderBudget();
}

function renderCategoriesList(){
  document.getElementById('categories-list').innerHTML=state.categories.map(function(c){var btn=c.id!=='income'&&c.id!=='other'?'<button class="btn btn-danger btn-sm" onclick="deleteCategory(\''+c.id+'\')">Del</button>':'';return'<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><span class="cat-dot" style="background:'+c.color+';width:14px;height:14px;flex-shrink:0"></span><span class="fill" style="font-size:13px">'+c.name+'</span>'+btn+'</div>';}).join('');
}
function addCategory(){
  const name=document.getElementById('new-cat-name').value.trim();if(!name)return hhAlert('Enter a name.', '✏️');
  const color=document.getElementById('new-cat-color').value;const id=name.toLowerCase().replace(/[^a-z0-9]/g,'_');
  if(state.categories.find(c=>c.id===id))return hhAlert('Already exists — try a different name.', 'ℹ️');
  state.categories.push({id,name,color});document.getElementById('new-cat-name').value='';saveState();renderCategoriesList();
}
function deleteCategory(id){
  hhConfirm('Delete this category and move its transactions to Other?','🗑️','Delete Category').then(function(ok){
    if(!ok)return;
    state.categories=state.categories.filter(c=>c.id!==id);
    state.transactions.forEach(t=>{if(t.category===id)t.category='other';});
    state.catRules = (state.catRules||[]).filter(function(r){ return r.cat !== id; });
    delete state.budgets[id];saveState();renderCategoriesList();
  });
}

function getGoalContributions(goalId) {
  var direct = state.transactions
    .filter(t=>t.category==='goal:'+goalId)
    .reduce((s,t)=>s+Math.abs(t.amount),0);
  // Also count wedding-transfer transactions when this goal is the linked wedding goal
  var weddingLinked = ((state.wedding||{}).linkedGoalId === goalId)
    ? (state.transactions||[])
        .filter(function(t){return t.category==='wedding-transfer';})
        .reduce(function(s,t){return s+Math.abs(t.amount);},0)
    : 0;
  return direct + weddingLinked;
}

function getCarFundContributions(carId) {
  return (state.transactions||[])
    .filter(function(t){return t.category==='car:'+carId;})
    .reduce(function(s,t){return s+Math.abs(t.amount);},0);
}

function getWeddingContributions() {
  return (state.transactions||[])
    .filter(function(t){return t.category==='wedding' || t.category==='wedding-transfer';})
    .reduce(function(s,t){return s+Math.abs(t.amount);},0);
}

function getMaintenanceSpend(year) {
  var y = year || new Date().getFullYear();
  return (state.transactions||[])
    .filter(function(t){return t.category==='maintenance' && new Date(t.date).getFullYear()===y;})
    .reduce(function(s,t){return s+Math.abs(t.amount);},0);
}

function getPetSpend(year) {
  var y = year || new Date().getFullYear();
  return (state.transactions||[])
    .filter(function(t){return t.category==='pets' && new Date(t.date).getFullYear()===y;})
    .reduce(function(s,t){return s+Math.abs(t.amount);},0);
}

function getAccountBalance(acctId) {
  if (!acctId) return null;
  var a = getAccountById(acctId);
  if (!a) return null;
  // Mirror calcBalance() (the Accounts page) so linked goals, safe-to-spend and
  // the home-lot needs all agree with the canonical balance.
  var isDebt = !!ACCT_IS_DEBT[a.type];
  var allTxns = (state.transactions||[]).filter(function(t){ return t.account===acctId && !t.isOpeningBalance; });
  var sb = (state.startingBalances||{})[acctId] || null;
  var hasSB = sb && sb.amount != null && sb.date;
  var balance;
  if (hasSB) {
    var cutoff = sb.date;
    var txnSum = allTxns.filter(function(t){ return toISO(t.date||'') > cutoff; })
      .reduce(function(s,t){ return s+(parseFloat(t.amount)||0); }, 0);
    balance = isDebt ? parseFloat(sb.amount) - txnSum : parseFloat(sb.amount) + txnSum;
  } else {
    var txnSum2 = allTxns.reduce(function(s,t){ return s+(parseFloat(t.amount)||0); }, 0);
    balance = isDebt ? -txnSum2 : txnSum2;
  }
  return Math.round(balance*100)/100;
}

// Shared goal-progress resolver. When a goal is linked to an account its saved
// amount = that account's current balance; otherwise fall back to the manual
// "current" figure plus transaction-tagged contributions. Used by renderGoals
// and the V7 home lot's garden plants so both stay in sync.
function goalSavedAmount(g) {
  if (!g) return 0;
  if (g.accountId) {
    var bal = getAccountBalance(g.accountId);
    return bal != null ? Math.max(0, bal) : 0;
  }
  return (g.current || 0) + getGoalContributions(g.id);
}

// (Re)populate the goal modal's account picker from state.accounts.
function populateGoalAccountSelect() {
  var sel = document.getElementById('goal-account');
  if (!sel) return;
  var keep = sel.value;
  var opts = '<option value="">— None (track manually) —</option>';
  (state.accounts || []).forEach(function(a) {
    var label = a.nickname || a.name || a.type || 'Account';
    var who = a.isJoint ? 'Joint' : (a.person || '');
    opts += '<option value="' + a.id + '">' + label + (who ? ' — ' + who : '') + '</option>';
  });
  sel.innerHTML = opts;
  sel.value = keep;
}

function renderGoals(){
  populateGoalAccountSelect();
  document.getElementById('goals-container').innerHTML=state.goals.map(g=>{
    const contributed = getGoalContributions(g.id);
    const linkedAcct = g.accountId ? getAccountById(g.accountId) : null;
    const totalSaved = goalSavedAmount(g);
    const pct=Math.min(100,Math.round((totalSaved/g.target)*100));
    const remaining=g.target-totalSaved;
    const daysLeft=g.date?Math.ceil((new Date(g.date)-new Date())/86400000):null;
    const monthlyNeeded=daysLeft&&daysLeft>0?(remaining/(daysLeft/30)).toFixed(0):null;
    const nameEl=g.link
      ?'<a href="'+g.link+'" target="_blank" class="goal-name-link">'+g.emoji+' '+g.name+' &#128279;</a>'
      :'<span style="font-weight:700;font-size:15px">'+g.emoji+' '+g.name+'</span>';
    const notesSpan=g.notes?'<span style="margin-left:8px;font-size:11px;color:var(--muted)">'+g.notes+'</span>':'';
    const targetSpan=g.date?'<span>Target: '+g.date+(daysLeft>0?' &middot; $'+monthlyNeeded+'/mo needed':' Done!')+'</span>':'';
    const txnCount = state.transactions.filter(t=>t.category==='goal:'+g.id).length;
    const contribLine = linkedAcct
      ? '<div style="font-size:11px;color:var(--accent);margin-top:3px">&#128279; Tracking '+(linkedAcct.name||linkedAcct.type||'account')+' balance</div>'
      : (contributed>0
        ? '<div style="font-size:11px;color:var(--green);margin-top:3px">+'+fmt(contributed)+' from '+txnCount+' transaction'+(txnCount!==1?'s':'')+' &middot; manual: '+fmt(g.current)+'</div>'
        : '');
    const isDone = pct >= 100;
    const barColor = isDone ? 'var(--green)' : pct > 75 ? 'var(--accent)' : pct > 40 ? 'var(--accent2)' : 'var(--muted)';
    return '<div class="goal-card">'
      +'<div class="goal-header" style="gap:12px">'
      +'<div class="goal-pct-badge'+(isDone?' done':'')+'">'+pct+'%</div>'
      +'<div style="flex:1"><div style="display:flex;justify-content:space-between;align-items:flex-start">'
      +'<div>'+nameEl+notesSpan+'</div>'
      +'<div style="display:flex;gap:6px;flex-shrink:0">'
      +'<button class="btn btn-ghost btn-sm" onclick="editGoal(\''+g.id+'\')">&#9998;</button>'
      +'<button class="btn btn-danger btn-sm" onclick="deleteGoal(\''+g.id+'\')">&#x1F5D1;</button>'
      +'</div></div>'
      +'<div class="goal-progress-label">'
      +'<span style="color:var(--accent);font-weight:800">'+fmt(totalSaved)+'</span>'
      +'<span style="color:var(--muted)">of '+fmt(g.target)+'</span>'
      +'</div>'
      +'<div class="progress-bar" style="height:10px"><div class="progress-fill" style="width:'+pct+'%;background:'+barColor+'"></div></div>'
      +contribLine
      +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px">'
      +'<span>'+fmt(remaining)+' to go</span>'+targetSpan
      +'</div></div></div></div>';
  }).join('')||'<div style="color:var(--muted);text-align:center;padding:40px">No goals yet — add your first one!</div>';
}
function saveGoal(){
  const editId=document.getElementById('goal-edit-id').value;
  const g={id:editId||uid(),name:document.getElementById('goal-name').value,emoji:document.getElementById('goal-emoji').value||'🎯',target:parseFloat(document.getElementById('goal-target').value)||0,current:parseFloat(document.getElementById('goal-current').value)||0,date:document.getElementById('goal-date').value,link:document.getElementById('goal-link').value,notes:document.getElementById('goal-notes').value,accountId:document.getElementById('goal-account').value||'',flowerType:(document.getElementById('goal-flower')?document.getElementById('goal-flower').value:'auto')||'auto'};
  if(editId){const idx=state.goals.findIndex(x=>x.id===editId);state.goals[idx]=g;}else state.goals.push(g);
  saveState();closeModal('goal-modal');clearGoalForm();renderGoals();
}
function editGoal(id){
  const g=state.goals.find(x=>x.id===id);if(!g)return;
  populateGoalAccountSelect();
  document.getElementById('goal-edit-id').value=id;document.getElementById('goal-name').value=g.name;document.getElementById('goal-emoji').value=g.emoji;document.getElementById('goal-target').value=g.target;document.getElementById('goal-current').value=g.current;document.getElementById('goal-date').value=g.date||'';document.getElementById('goal-link').value=g.link||'';document.getElementById('goal-notes').value=g.notes||'';document.getElementById('goal-account').value=g.accountId||'';
  var gf=document.getElementById('goal-flower');if(gf)gf.value=g.flowerType||'auto';
  openModal('goal-modal');
}
function deleteGoal(id) {
  var g = state.goals.find(function(x){return x.id===id;});
  if (!g) return;
  var txnCount = state.transactions.filter(function(t){return t.category==='goal:'+id;}).length;
  var msg = 'Remove goal <strong>'+g.emoji+'  '+g.name+'</strong>?'
    + (txnCount ? '<br><br>⚠️ '+txnCount+' transaction'+(txnCount!==1?'s':'')+' tagged to this goal will be moved to <em>Other</em>.' : '');
  hhConfirm(msg, '🗑️', 'Remove Goal').then(function(ok) {
    if (!ok) return;
    state.goals = state.goals.filter(function(x){return x.id!==id;});
    state.transactions.forEach(function(t){ if(t.category==='goal:'+id) t.category='other'; });
    if (state.goalSplits) {
      Object.keys(state.goalSplits).forEach(function(txnId){
        state.goalSplits[txnId] = (state.goalSplits[txnId]||[]).filter(function(s){return s.goalId!==id;});
      });
    }
    state.transactions = state.transactions.filter(function(t){
      return !(t.source==='split' && t.category==='goal:'+id);
    });
    if ((state.house||{}).linkedGoalId === id) state.house.linkedGoalId = '';
    if ((state.wedding||{}).linkedGoalId === id) state.wedding.linkedGoalId = '';
    saveState();
    renderGoals();
    if (document.getElementById('page-budget').classList.contains('active')) renderBudget();
    if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
  });
}
