/* ============================================================================
 * 09-cashflow.js — Cashflow Advisor (Phase 3.1, MVP: forecast + shortfall flags)
 *
 * Pure client-side logic over data the app already holds: account balances,
 * recurring bills, and an editable income schedule. Projects a forward calendar
 * of money in vs. out for a primary account and flags when the balance dips
 * below a safety buffer ("checking dips below $0 on the 14th").
 *
 * No backend, no external calls. Canada/Ontario context is inherited from the
 * underlying account/bill data — this layer only does timing + arithmetic.
 *
 * State: state.cashflowConfig = {
 *   horizonDays, primaryAccountId, buffer, seeded,
 *   incomes: [ { id, label, amount, frequency, nextDate } ]
 * }
 * ========================================================================== */

var CF_INCOME_FREQS = ['Weekly', 'Bi-weekly', 'Semi-monthly', 'Monthly'];

function getCashflowConfig() {
  if (!state.cashflowConfig) {
    state.cashflowConfig = { horizonDays: 60, primaryAccountId: '', buffer: 0, seeded: false, incomes: [] };
  }
  var c = state.cashflowConfig;
  if (c.horizonDays == null) c.horizonDays = 60;
  if (c.buffer == null) c.buffer = 0;
  if (!Array.isArray(c.incomes)) c.incomes = [];
  return c;
}

// Local-time YYYY-MM-DD (avoids UTC off-by-one from toISOString()).
function _cfISO(d) {
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

function _cfStep(d, freq) {
  switch (freq) {
    case 'Weekly':      d.setDate(d.getDate() + 7);   break;
    case 'Bi-weekly':   d.setDate(d.getDate() + 14);  break;
    case 'Monthly':     d.setMonth(d.getMonth() + 1); break;
    case 'Bi-monthly':  d.setMonth(d.getMonth() + 2); break;
    case 'Quarterly':   d.setMonth(d.getMonth() + 3); break;
    case 'Semi-annual': d.setMonth(d.getMonth() + 6); break;
    case 'Annual':      d.setFullYear(d.getFullYear() + 1); break;
    default:            d.setMonth(d.getMonth() + 1);
  }
}

// All occurrences of a recurring item within [startMs, endMs] (inclusive).
function _cfOccurrences(firstISO, freq, startMs, endMs) {
  var out = [];
  if (!firstISO) return out;
  var d = new Date(firstISO + 'T00:00:00');
  var guard = 0;

  if (freq === 'Semi-monthly') {
    var baseDay = d.getDate();
    var cur = new Date(d.getFullYear(), d.getMonth(), 1);
    while (cur.getTime() <= endMs && guard++ < 480) {
      [baseDay, baseDay + 15].forEach(function (day) {
        var dd = new Date(cur.getFullYear(), cur.getMonth(), day);
        var ms = dd.getTime();
        if (ms >= startMs && ms <= endMs) out.push(_cfISO(dd));
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out.sort();
  }

  while (d.getTime() <= endMs && guard++ < 3000) {
    if (d.getTime() >= startMs) out.push(_cfISO(d));
    _cfStep(d, freq);
  }
  return out;
}

function _cfDefaultAccountId() {
  var accts = state.accounts || [];
  var chq = accts.find(function (a) { return a.type === 'Chequing'; });
  if (chq) return chq.id;
  return accts.length ? accts[0].id : '';
}

// Seed income lines from member salaries the first time only, so clearing them
// doesn't get undone on the next render.
function _cfSeedIncomesIfEmpty() {
  var c = getCashflowConfig();
  if (c.seeded || (c.incomes && c.incomes.length)) return;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var firstOfNext = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  (state.members || []).forEach(function (m) {
    var amt = +m.monthlyIncome || 0;
    if (amt <= 0) return;
    c.incomes.push({
      id: (typeof uid === 'function' ? uid() : 'inc' + Math.random().toString(36).slice(2)),
      label: (m.name || 'Member') + ' pay',
      amount: amt,
      frequency: 'Monthly',
      nextDate: _cfISO(firstOfNext)
    });
  });
  c.seeded = true;
  saveState();
}

/* ---- Forecast engine -------------------------------------------------- */
function buildCashflowForecast() {
  var cfg = getCashflowConfig();
  var acctId = cfg.primaryAccountId || _cfDefaultAccountId();
  var startBal = acctId ? getAccountBalance(acctId) : null;

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var startMs = today.getTime();
  var endMs = startMs + (cfg.horizonDays || 60) * 86400000;

  var events = [];

  (cfg.incomes || []).forEach(function (inc) {
    if (!inc.amount || !inc.nextDate) return;
    _cfOccurrences(inc.nextDate, inc.frequency || 'Monthly', startMs, endMs).forEach(function (iso) {
      events.push({ date: iso, label: inc.label || 'Income', amount: Math.abs(+inc.amount), type: 'in' });
    });
  });

  (state.bills || []).forEach(function (b) {
    if (!b.amount || !b.nextDue) return;
    _cfOccurrences(b.nextDue, b.frequency || 'Monthly', startMs, endMs).forEach(function (iso) {
      events.push({ date: iso, label: b.name || 'Bill', amount: -Math.abs(+b.amount), type: 'out', category: b.category });
    });
  });

  // Date asc; on a tie, money in before money out (best-case ordering).
  events.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return b.amount - a.amount;
  });

  var buffer = +cfg.buffer || 0;
  var running = (startBal == null ? 0 : startBal);
  var totalIn = 0, totalOut = 0;
  var shortfallDays = {};
  var firstShortfall = null;
  var lowest = { bal: running, date: _cfISO(today) };

  events.forEach(function (e) {
    running = Math.round((running + e.amount) * 100) / 100;
    e.running = running;
    if (e.amount >= 0) totalIn += e.amount; else totalOut += -e.amount;
    if (running < lowest.bal) lowest = { bal: running, date: e.date };
    if (running < buffer) {
      shortfallDays[e.date] = true;
      if (!firstShortfall) firstShortfall = { date: e.date, bal: running };
    }
  });

  return {
    acctId: acctId,
    hasAccount: !!acctId,
    startBal: startBal,
    events: events,
    buffer: buffer,
    horizonDays: cfg.horizonDays || 60,
    totalIn: totalIn,
    totalOut: totalOut,
    netChange: Math.round((totalIn - totalOut) * 100) / 100,
    endBal: running,
    lowest: lowest,
    firstShortfall: firstShortfall,
    shortfallCount: Object.keys(shortfallDays).length
  };
}

/* ---- Rendering -------------------------------------------------------- */
function _cfFmtDate(iso) {
  if (!iso) return '';
  var d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function _cfSparkline(fc) {
  var pts = [{ b: (fc.startBal == null ? 0 : fc.startBal) }].concat(
    fc.events.map(function (e) { return { b: e.running }; })
  );
  if (pts.length < 2) return '';
  var W = 720, H = 120, pad = 6;
  var vals = pts.map(function (p) { return p.b; }).concat([fc.buffer]);
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  if (max === min) { max += 1; min -= 1; }
  var x = function (i) { return pad + (i / (pts.length - 1)) * (W - 2 * pad); };
  var y = function (v) { return pad + (1 - (v - min) / (max - min)) * (H - 2 * pad); };

  var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.b).toFixed(1); }).join(' ');
  var area = line + ' L' + x(pts.length - 1).toFixed(1) + ' ' + (H - pad) + ' L' + x(0).toFixed(1) + ' ' + (H - pad) + ' Z';
  var zeroY = y(fc.buffer);
  var dipped = fc.shortfallCount > 0;
  var stroke = dipped ? 'var(--red)' : 'var(--green)';

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:120px;display:block">' +
    '<defs><linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + stroke + '" stop-opacity="0.28"/>' +
    '<stop offset="100%" stop-color="' + stroke + '" stop-opacity="0.02"/>' +
    '</linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#cfGrad)" stroke="none"/>' +
    '<line x1="' + pad + '" y1="' + zeroY.toFixed(1) + '" x2="' + (W - pad) + '" y2="' + zeroY.toFixed(1) +
    '" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4" opacity="0.6"/>' +
    '<path d="' + line + '" fill="none" stroke="' + stroke + '" stroke-width="2.5" stroke-linejoin="round"/>' +
    '</svg>';
}

function renderCashflow() {
  var page = document.getElementById('page-cashflow');
  if (!page) return;
  if (typeof isFeatureOn === 'function' && !isFeatureOn('cashflow')) return;

  _cfSeedIncomesIfEmpty();

  var statsEl = document.getElementById('cf-stats');
  var alertEl = document.getElementById('cf-alert');
  var chartEl = document.getElementById('cf-chart-card');
  var listEl  = document.getElementById('cf-timeline-card');

  if (!(state.accounts || []).length) {
    if (statsEl) statsEl.innerHTML = '';
    if (alertEl) alertEl.innerHTML = '';
    if (chartEl) chartEl.innerHTML = '';
    if (listEl) listEl.innerHTML = _cfEmpty('No accounts yet', 'Add an account (and a starting balance) on the Upload page, then add some bills. The Cashflow Advisor projects your balance forward from there.');
    return;
  }

  var fc = buildCashflowForecast();
  var acct = getAccountById(fc.acctId);
  var acctName = acct ? acct.nickname : '—';

  // Stats
  if (statsEl) {
    var lowColor = fc.lowest.bal < fc.buffer ? 'var(--red)' : 'var(--green)';
    statsEl.innerHTML =
      _cfStat('Start Balance', fc.startBal == null ? 'Set one' : fmtC(fc.startBal), acctName) +
      _cfStat('Lowest Projected', fmtC(fc.lowest.bal), _cfFmtDate(fc.lowest.date), lowColor) +
      _cfStat('Shortfall Days', String(fc.shortfallCount), 'next ' + fc.horizonDays + ' days', fc.shortfallCount ? 'var(--red)' : 'var(--green)') +
      _cfStat('Net Change', fmtSigned(fc.netChange), 'in ' + fmtC(fc.totalIn) + ' · out ' + fmtC(fc.totalOut));
  }

  // Alert banner
  if (alertEl) {
    if (fc.startBal == null) {
      alertEl.innerHTML = _cfBanner('var(--yellow)', '📌',
        'Set a starting balance for <b>' + acctName + '</b> (Upload → 📌) so the forecast starts from a real number. Projecting from $0 for now.');
    } else if (fc.firstShortfall) {
      alertEl.innerHTML = _cfBanner('var(--red)', '⚠️',
        '<b>' + acctName + '</b> dips to <b>' + fmtC(fc.firstShortfall.bal) + '</b> on <b>' + _cfFmtDate(fc.firstShortfall.date) +
        '</b>' + (fc.buffer ? ' (below your ' + fmtC(fc.buffer) + ' buffer)' : '') + '. Move a bill, shift a transfer, or top up before then.');
    } else {
      alertEl.innerHTML = _cfBanner('var(--green)', '✅',
        'No shortfalls projected for <b>' + acctName + '</b> in the next ' + fc.horizonDays + ' days. Lowest point: ' +
        fmtC(fc.lowest.bal) + ' on ' + _cfFmtDate(fc.lowest.date) + '.');
    }
  }

  // Chart
  if (chartEl) {
    if (fc.events.length) {
      chartEl.innerHTML = '<div class="card" style="margin-bottom:0"><div class="card-title">📉 Projected Balance — ' + acctName +
        ' (' + fc.horizonDays + ' days)</div>' + _cfSparkline(fc) +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:4px">' +
        '<span>Today · ' + fmtC(fc.startBal == null ? 0 : fc.startBal) + '</span>' +
        '<span>End · ' + fmtC(fc.endBal) + '</span></div></div>';
    } else {
      chartEl.innerHTML = '';
    }
  }

  // Timeline
  if (listEl) {
    if (!fc.events.length) {
      listEl.innerHTML = _cfEmpty('Nothing to project yet',
        'Add recurring bills on the Bills page and at least one income line in ⚙️ Settings. Then this becomes a day-by-day forecast.');
    } else {
      var rows = fc.events.map(function (e) {
        var amtColor = e.amount >= 0 ? 'var(--green)' : 'var(--red)';
        var runColor = e.running < fc.buffer ? 'var(--red)' : 'var(--text)';
        var icon = e.type === 'in' ? '💰' : (e.category && typeof getCatById === 'function' ? '' : '🧾');
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--border)">' +
          '<div style="width:84px;font-size:11px;color:var(--muted)">' + _cfFmtDate(e.date) + '</div>' +
          '<div style="flex:1;font-weight:600;font-size:13px">' + (icon ? icon + ' ' : '') + e.label + '</div>' +
          '<div style="width:90px;text-align:right;font-weight:700;color:' + amtColor + '">' + fmtSigned(e.amount) + '</div>' +
          '<div style="width:96px;text-align:right;font-weight:800;color:' + runColor + '">' + fmtC(e.running) + '</div>' +
          '</div>';
      }).join('');
      listEl.innerHTML = '<div class="card"><div class="card-title">🗓️ Forward Timeline</div>' +
        '<div style="display:flex;align-items:center;gap:10px;padding:4px 10px;font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--muted)">' +
        '<div style="width:84px">Date</div><div style="flex:1">Item</div>' +
        '<div style="width:90px;text-align:right">Amount</div><div style="width:96px;text-align:right">Balance</div></div>' +
        rows + '</div>';
    }
  }
}

function _cfStat(label, value, sub, color) {
  return '<div class="stat"><div class="stat-label">' + label + '</div>' +
    '<div class="stat-value"' + (color ? ' style="color:' + color + '"' : '') + '>' + value + '</div>' +
    (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
}

function _cfBanner(color, icon, html) {
  return '<div style="display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:var(--radius-sm);' +
    'background:var(--surface);border:2px solid ' + color + '">' +
    '<span style="font-size:20px">' + icon + '</span><div style="font-size:13px;line-height:1.4">' + html + '</div></div>';
}

function _cfEmpty(title, body) {
  return '<div class="card" style="text-align:center;padding:36px"><div style="font-size:15px;font-weight:800;margin-bottom:6px">' +
    title + '</div><div style="color:var(--muted);font-size:13px;max-width:520px;margin:0 auto;line-height:1.5">' + body + '</div></div>';
}

/* ---- Settings modal -------------------------------------------------- */
function openCashflowSettings() {
  _cfSeedIncomesIfEmpty();
  var c = getCashflowConfig();

  var hz = document.getElementById('cf-horizon');
  if (hz) hz.value = String(c.horizonDays || 60);

  var buf = document.getElementById('cf-buffer');
  if (buf) buf.value = (c.buffer || 0);

  var sel = document.getElementById('cf-primary-account');
  if (sel) {
    var current = c.primaryAccountId || _cfDefaultAccountId();
    sel.innerHTML = (state.accounts || []).map(function (a) {
      var lbl = (typeof ACCT_TYPE_ICONS !== 'undefined' && ACCT_TYPE_ICONS[a.type] ? ACCT_TYPE_ICONS[a.type] + ' ' : '') +
        a.nickname + ' (' + a.type + ')';
      return '<option value="' + a.id + '"' + (a.id === current ? ' selected' : '') + '>' + lbl + '</option>';
    }).join('');
  }

  cfRenderIncomeRows(c.incomes || []);
  openModal('cashflow-settings-modal');
}

function cfRenderIncomeRows(incomes) {
  var box = document.getElementById('cf-incomes-list');
  if (!box) return;
  if (!incomes.length) {
    box.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0">No income lines. Add one, or re-seed from members.</div>';
    return;
  }
  box.innerHTML = incomes.map(function (inc, i) {
    var freqOpts = CF_INCOME_FREQS.map(function (f) {
      return '<option value="' + f + '"' + ((inc.frequency || 'Monthly') === f ? ' selected' : '') + '>' + f + '</option>';
    }).join('');
    return '<div class="cf-income-row" data-i="' + i + '" style="display:grid;grid-template-columns:1.4fr 0.9fr 1fr 1fr auto;gap:6px;align-items:center;margin-bottom:6px">' +
      '<input type="text" class="cf-in-label" placeholder="Label" value="' + (inc.label || '').replace(/"/g, '&quot;') + '">' +
      '<input type="number" class="cf-in-amount" placeholder="Amount" min="0" step="1" value="' + (inc.amount || '') + '">' +
      '<select class="cf-in-freq">' + freqOpts + '</select>' +
      '<input type="date" class="cf-in-date" value="' + (inc.nextDate || '') + '">' +
      '<button class="btn btn-danger btn-sm" onclick="cfRemoveIncomeRow(' + i + ')">🗑️</button>' +
      '</div>';
  }).join('');
}

function _cfReadIncomeRows() {
  var rows = document.querySelectorAll('#cf-incomes-list .cf-income-row');
  var out = [];
  rows.forEach(function (r) {
    var label = (r.querySelector('.cf-in-label').value || '').trim();
    var amount = parseFloat(r.querySelector('.cf-in-amount').value) || 0;
    var freq = r.querySelector('.cf-in-freq').value;
    var date = r.querySelector('.cf-in-date').value;
    if (!label && !amount) return;
    out.push({ id: (typeof uid === 'function' ? uid() : 'inc' + Math.random().toString(36).slice(2)),
      label: label || 'Income', amount: amount, frequency: freq, nextDate: date });
  });
  return out;
}

function cfAddIncomeRow() {
  var current = _cfReadIncomeRows();
  var today = new Date(); today.setHours(0, 0, 0, 0);
  current.push({ label: '', amount: 0, frequency: 'Bi-weekly', nextDate: _cfISO(today) });
  cfRenderIncomeRows(current);
}

function cfRemoveIncomeRow(i) {
  var current = _cfReadIncomeRows();
  current.splice(i, 1);
  cfRenderIncomeRows(current);
}

function cfReseedIncomes() {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var firstOfNext = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  var seeded = (state.members || []).filter(function (m) { return (+m.monthlyIncome || 0) > 0; }).map(function (m) {
    return { label: (m.name || 'Member') + ' pay', amount: +m.monthlyIncome || 0, frequency: 'Monthly', nextDate: _cfISO(firstOfNext) };
  });
  if (!seeded.length) { hhToast('No member salaries set to seed from.', 'ℹ️'); return; }
  cfRenderIncomeRows(seeded);
  hhToast('Seeded ' + seeded.length + ' income line' + (seeded.length > 1 ? 's' : '') + ' from members.', '✅');
}

function saveCashflowSettings() {
  var c = getCashflowConfig();
  var hz = document.getElementById('cf-horizon');
  var buf = document.getElementById('cf-buffer');
  var sel = document.getElementById('cf-primary-account');
  if (hz) c.horizonDays = parseInt(hz.value, 10) || 60;
  if (buf) c.buffer = parseFloat(buf.value) || 0;
  if (sel) c.primaryAccountId = sel.value;
  c.incomes = _cfReadIncomeRows();
  c.seeded = true;
  saveState();
  closeModal('cashflow-settings-modal');
  renderCashflow();
  hhToast('Cashflow settings saved!', '✅');
}
