function renderWedding() {
  var w = state.wedding || {};
  var vendors = state.weddingVendors || [];
  var totalCommitted = vendors.reduce(function(s,v){ return s+(v.totalCost||0); }, 0);
  var totalDeposits = vendors.reduce(function(s,v){ return s+(v.depositAmount||0); }, 0);
  var depositsPaid = vendors.filter(function(v){ return v.paid; }).reduce(function(s,v){ return s+(v.depositAmount||0); }, 0);
  var weddingTxnContrib = getWeddingContributions();
  var budget = w.budget || 0;
  var remaining = budget - totalCommitted;
  var pct = budget ? Math.min(100, Math.round((totalCommitted/budget)*100)) : 0;
  var barColor = pct > 95 ? 'var(--red)' : pct > 80 ? 'var(--yellow)' : 'var(--green)';

  // Savings progress — linked goal (matches Goals page exactly)
  var linkedGoal = w.linkedGoalId ? (state.goals||[]).find(function(g){return g.id===w.linkedGoalId;}) : null;
  var goalSaved  = linkedGoal ? (linkedGoal.current + getGoalContributions(linkedGoal.id)) : 0;
  var goalTarget = linkedGoal ? linkedGoal.target : 0;
  var savingsPct = goalTarget > 0 ? Math.min(100, Math.round(goalSaved/goalTarget*100)) : 0;
  var savingsBarColor = savingsPct >= 100 ? 'var(--green)' : savingsPct >= 50 ? 'var(--accent)' : 'var(--accent2)';

  // Countdown
  var countdownHtml = '';
  if (w.date) {
    var wDate = new Date(w.date + 'T00:00:00');
    var today = new Date(); today.setHours(0,0,0,0);
    var diff = Math.ceil((wDate - today) / 86400000);
    if (diff > 0) countdownHtml = '<div style="font-size:28px;font-weight:900;color:var(--accent)">' + diff + ' days to go! 🎉</div>';
    else if (diff === 0) countdownHtml = '<div style="font-size:22px;font-weight:900;color:var(--green)">Today is the day! 💍</div>';
    else countdownHtml = '<div style="font-size:16px;color:var(--muted)">Married ' + Math.abs(diff) + ' days ago 💑</div>';
  } else {
    countdownHtml = '<div style="font-size:13px;color:var(--muted)">No wedding date set — click ⚙️ Settings to add one.</div>';
  }

  document.getElementById('wedding-overview-card').innerHTML =
    '<div class="card" style="margin-bottom:0">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">' +
    '<div>' +
    (w.venue ? '<div style="font-size:13px;color:var(--muted);margin-bottom:4px">📍 ' + w.venue + (w.date ? ' &nbsp;·&nbsp; ' + w.date : '') + '</div>' : '') +
    countdownHtml +
    (w.notes ? '<div style="font-size:12px;color:var(--muted);margin-top:6px;font-style:italic">' + w.notes + '</div>' : '') +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center">' +
    '<div><div style="font-size:18px;font-weight:900;color:var(--text)">' + fmt(totalCommitted) + '</div><div style="font-size:11px;color:var(--muted)">Committed</div></div>' +
    '<div><div style="font-size:18px;font-weight:900;color:' + (remaining < 0 ? 'var(--red)' : 'var(--green)') + '">' + (remaining < 0 ? '-' : '') + fmt(Math.abs(remaining)) + '</div><div style="font-size:11px;color:var(--muted)">' + (budget ? 'Remaining' : 'No budget set') + '</div></div>' +
    '<div><div style="font-size:18px;font-weight:900;color:var(--accent)">' + fmt(depositsPaid) + ' / ' + fmt(totalDeposits) + '</div><div style="font-size:11px;color:var(--muted)">Deposits Paid</div></div>' +
    '</div></div>' +
    (linkedGoal
      ? '<div style="margin-top:14px;padding:12px 14px;background:color-mix(in srgb,var(--green) 8%,transparent);border-radius:10px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        + '<div style="font-size:13px;font-weight:700;color:var(--text)">💰 Savings Progress — ' + linkedGoal.emoji + ' ' + linkedGoal.name + '</div>'
        + '<div style="font-size:13px;font-weight:900;color:' + savingsBarColor + '">' + savingsPct + '%</div></div>'
        + '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px"><span>' + fmt(goalSaved) + ' saved</span><span>' + fmt(goalTarget) + ' goal</span></div>'
        + '<div class="progress-bar" style="height:10px"><div class="progress-fill" style="width:' + savingsPct + '%;background:' + savingsBarColor + '"></div></div>'
        + (goalSaved !== weddingTxnContrib + (linkedGoal.current||0) ? '' : '')
        + '</div>'
      : (weddingTxnContrib > 0
          ? '<div style="font-size:12px;color:var(--green);margin-top:8px">✅ ' + fmt(weddingTxnContrib) + ' in wedding-categorized transactions tracked</div>'
          : '<div style="font-size:12px;color:var(--muted);margin-top:8px">💡 Link a savings goal in ⚙️ Settings to track your savings progress here.</div>')
    ) +
    (budget ? '<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px"><span>📋 Budget: ' + fmt(budget) + '</span><span>' + pct + '% committed to vendors</span></div><div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:'+pct+'%;background:'+barColor+'"></div></div></div>' : '') +
    '</div>';

  // Deposit alerts — upcoming within 30 days
  var today2 = new Date(); today2.setHours(0,0,0,0);
  var alerts = vendors.filter(function(v){
    if (v.paid || !v.depositDue) return false;
    var dd = new Date(v.depositDue + 'T00:00:00');
    var days = Math.ceil((dd - today2) / 86400000);
    return days >= 0 && days <= 30;
  }).sort(function(a,b){ return new Date(a.depositDue) - new Date(b.depositDue); });

  document.getElementById('wedding-alerts').innerHTML = alerts.map(function(v){
    var days = Math.ceil((new Date(v.depositDue + 'T00:00:00') - today2) / 86400000);
    var urgency = days <= 7 ? 'var(--red)' : 'var(--yellow)';
    return '<div class="alert" style="border-left:4px solid '+urgency+';background:color-mix(in srgb,'+urgency+' 8%,var(--card));margin-bottom:8px">⚠️ <strong>' + v.name + '</strong> deposit of ' + fmt(v.depositAmount||0) + ' due in <strong>' + days + ' day' + (days===1?'':'s') + '</strong> (' + v.depositDue + ')</div>';
  }).join('');

  // Vendor grid grouped by category
  if (!vendors.length) {
    document.getElementById('wedding-vendors-grid').innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px">No vendors yet — click <strong>+ Add Vendor</strong> to get started!</div>';
    renderWeddingChecklist();
    return;
  }
  var cats = {};
  vendors.forEach(function(v){ if (!cats[v.category]) cats[v.category] = []; cats[v.category].push(v); });
  var html = '';
  Object.keys(cats).sort().forEach(function(cat) {
    html += '<div style="margin-bottom:20px"><div style="font-size:12px;font-weight:800;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px">' + (WEDDING_CAT_ICONS[cat]||'📦') + ' ' + cat + '</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">';
    cats[cat].forEach(function(v) {
      var dd = v.depositDue ? new Date(v.depositDue + 'T00:00:00') : null;
      var daysUntil = dd ? Math.ceil((dd - today2) / 86400000) : null;
      var depositStatus = v.paid
        ? '<span style="color:var(--green);font-weight:700">✅ Deposit Paid</span>'
        : (v.depositAmount ? '<span style="color:' + (daysUntil !== null && daysUntil <= 7 ? 'var(--red)' : 'var(--yellow)') + ';font-weight:700">⏳ ' + fmt(v.depositAmount) + ' due' + (v.depositDue ? ' ' + v.depositDue : '') + '</span>' : '<span style="color:var(--muted)">No deposit set</span>');
      html += '<div class="card" style="margin-bottom:0;padding:14px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div style="font-weight:700;font-size:14px">' + v.name + '</div>' +
        '<div style="display:flex;gap:6px">' +
        '<button class="btn btn-ghost btn-sm" onclick="editWeddingVendor(\'' + v.id + '\')">✏️</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteWeddingVendor(\'' + v.id + '\')">🗑️</button>' +
        '</div></div>' +
        (v.contact ? '<div style="font-size:12px;color:var(--muted);margin-top:2px">📞 ' + v.contact + '</div>' : '') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">' +
        '<div style="font-size:18px;font-weight:900;color:var(--accent)">' + fmt(v.totalCost||0) + '</div>' +
        '<div style="font-size:12px;text-align:right">' + depositStatus + '</div>' +
        '</div>' +
        (v.notes ? '<div style="font-size:11px;color:var(--muted);margin-top:6px;font-style:italic">' + v.notes + '</div>' : '') +
        '</div>';
    });
    html += '</div></div>';
  });
  document.getElementById('wedding-vendors-grid').innerHTML = html;
  renderWeddingChecklist();
}

function openWeddingVendorModal() {
  document.getElementById('wedding-vendor-edit-id').value = '';
  document.getElementById('wv-category').value = 'Venue';
  document.getElementById('wv-name').value = '';
  document.getElementById('wv-contact').value = '';
  document.getElementById('wv-total').value = '';
  document.getElementById('wv-deposit').value = '';
  document.getElementById('wv-deposit-due').value = '';
  document.getElementById('wv-paid').checked = false;
  document.getElementById('wv-notes').value = '';
  document.getElementById('wedding-vendor-modal-title').textContent = '💍 Add Vendor';
  openModal('wedding-vendor-modal');
}

function editWeddingVendor(id) {
  var v = (state.weddingVendors||[]).find(function(x){ return x.id === id; });
  if (!v) return;
  document.getElementById('wedding-vendor-edit-id').value = id;
  document.getElementById('wv-category').value = v.category || 'Other';
  document.getElementById('wv-name').value = v.name || '';
  document.getElementById('wv-contact').value = v.contact || '';
  document.getElementById('wv-total').value = v.totalCost || '';
  document.getElementById('wv-deposit').value = v.depositAmount || '';
  document.getElementById('wv-deposit-due').value = v.depositDue || '';
  document.getElementById('wv-paid').checked = !!v.paid;
  document.getElementById('wv-notes').value = v.notes || '';
  document.getElementById('wedding-vendor-modal-title').textContent = '✏️ Edit Vendor';
  openModal('wedding-vendor-modal');
}

function saveWeddingVendor() {
  var name = document.getElementById('wv-name').value.trim();
  if (!name) { hhToast('Please enter a vendor name.', '⚠️'); return; }
  var editId = document.getElementById('wedding-vendor-edit-id').value;
  var v = {
    id: editId || uid(),
    category: document.getElementById('wv-category').value,
    name: name,
    contact: document.getElementById('wv-contact').value.trim(),
    totalCost: parseFloat(document.getElementById('wv-total').value) || 0,
    depositAmount: parseFloat(document.getElementById('wv-deposit').value) || 0,
    depositDue: document.getElementById('wv-deposit-due').value,
    paid: document.getElementById('wv-paid').checked,
    notes: document.getElementById('wv-notes').value.trim()
  };
  if (!state.weddingVendors) state.weddingVendors = [];
  if (editId) {
    var idx = state.weddingVendors.findIndex(function(x){ return x.id === editId; });
    if (idx >= 0) state.weddingVendors[idx] = v; else state.weddingVendors.push(v);
  } else {
    state.weddingVendors.push(v);
  }
  saveState();
  closeModal('wedding-vendor-modal');
  renderWedding();
  hhToast('Vendor saved!', '💍');
}

function deleteWeddingVendor(id) {
  hhConfirm('Remove this vendor?', '🗑️', 'Remove Vendor').then(function(ok) {
    if (!ok) return;
    state.weddingVendors = (state.weddingVendors||[]).filter(function(v){ return v.id !== id; });
    saveState();
    renderWedding();
    hhToast('Vendor removed.', '🗑️');
  });
}

function saveWeddingSettings() {
  if (!state.wedding) state.wedding = {};
  state.wedding.budget = parseFloat(document.getElementById('ws-budget').value) || 0;
  state.wedding.date = document.getElementById('ws-date').value;
  state.wedding.venue = document.getElementById('ws-venue').value.trim();
  state.wedding.notes = document.getElementById('ws-notes').value.trim();
  var sel = document.getElementById('ws-linked-goal');
  state.wedding.linkedGoalId = sel ? sel.value : '';
  saveState();
  closeModal('wedding-settings-modal');
  renderWedding();
  renderDashboard();
  hhToast('Wedding settings saved!', '💍');
}

function openWeddingSettingsModal() {
  var w = state.wedding || {};
  document.getElementById('ws-budget').value = w.budget || '';
  document.getElementById('ws-date').value = w.date || '';
  document.getElementById('ws-venue').value = w.venue || '';
  document.getElementById('ws-notes').value = w.notes || '';
  var sel = document.getElementById('ws-linked-goal');
  if (sel) {
    sel.innerHTML = '<option value="">None — enter savings manually</option>' +
      (state.goals||[]).map(function(g){
        return '<option value="'+g.id+'"'+(g.id===w.linkedGoalId?' selected':'')+'>'+g.emoji+' '+g.name+' ('+fmt(g.current + getGoalContributions(g.id))+' / '+fmt(g.target)+')</option>';
      }).join('');
  }
  openModal('wedding-settings-modal');
}

// HOUSE DOWN PAYMENT PLANNER
function calcCMHC(price, downAmt) {
  var pct = downAmt / price;
  if (pct >= 0.20) return 0;
  var premium = 0;
  if (pct >= 0.15) premium = 0.028;
  else if (pct >= 0.10) premium = 0.031;
  else if (pct >= 0.05) premium = 0.040;
  else return null; // below min
  return (price - downAmt) * premium;
}

function calcMinDown(price) {
  // Canadian minimum down payment rules
  if (!price) return 0;
  if (price >= 1000000) return Math.ceil(price * 0.20);
  if (price > 500000)   return Math.ceil(500000 * 0.05 + (price - 500000) * 0.10);
  return Math.ceil(price * 0.05);
}

function calcOntarioLTT(price) {
  var ltt = 0;
  if (price <= 55000)           ltt = price * 0.005;
  else if (price <= 250000)     ltt = 275 + (price - 55000) * 0.010;
  else if (price <= 400000)     ltt = 2225 + (price - 250000) * 0.015;
  else if (price <= 2000000)    ltt = 4475 + (price - 400000) * 0.020;
  else                          ltt = 36475 + (price - 2000000) * 0.025;
  return ltt;
}

function calcFirstTimeLTTRebate(price) {
  // Ontario first-time buyer LTT rebate — max $4,000
  return Math.min(calcOntarioLTT(price), 4000);
}

// ── New Home HST / FTHB Rebates (new construction only) ──
// Federal FTHB GST/HST Rebate: up to 100% of GST (5%), max $50,000
//   ≤ $1M: min(price × 0.05, 50000)
//   $1M–$1.5M: phases out linearly to $0
//   ≥ $1.5M: no rebate
// Ontario: Full 8% provincial HST component rebate on new homes under $1M (first-time buyer)
function calcFederalGSTRebate(price) {
  if (price <= 0) return 0;
  if (price <= 1000000) return Math.min(Math.round(price * 0.05), 50000);
  if (price < 1500000)  return Math.round(50000 * (1500000 - price) / 500000);
  return 0;
}
function calcOntarioHSTProvincialRebate(price) {
  // Ontario proposes full 8% provincial rebate on new homes under $1M for eligible first-time buyers
  if (price < 1000000) return Math.round(price * 0.08);
  return 0;
}

// ── Mortgage Calculator ──
function calcMortgagePayment(principal, annualRate, amortYears, frequency) {
  // frequency: 'monthly'=12, 'semi-monthly'=24, 'bi-weekly'=26, 'accel-bi-weekly'=26, 'weekly'=52, 'accel-weekly'=52
  var freqMap = { monthly: 12, 'semi-monthly': 24, 'bi-weekly': 26, 'accel-bi-weekly': 26, weekly: 52, 'accel-weekly': 52 };
  var n = freqMap[frequency] || 12;
  var r = (annualRate / 100) / 2; // Canadian semi-annual compounding
  var effectiveRate = Math.pow(1 + r, 2 / n) - 1;
  var totalPayments = amortYears * n;
  if (effectiveRate === 0) return principal / totalPayments;
  var payment = principal * effectiveRate / (1 - Math.pow(1 + effectiveRate, -totalPayments));
  // Accelerated = monthly / (n/12) effectively pays one extra monthly payment per year
  if (frequency === 'accel-bi-weekly') payment = (principal * (Math.pow(1 + (annualRate/100)/2, 2/12) - 1) / (1 - Math.pow(1 + (Math.pow(1+(annualRate/100)/2,2/12)-1), -(amortYears*12)))) / 2;
  if (frequency === 'accel-weekly')    payment = (principal * (Math.pow(1 + (annualRate/100)/2, 2/12) - 1) / (1 - Math.pow(1 + (Math.pow(1+(annualRate/100)/2,2/12)-1), -(amortYears*12)))) / 4;
  return payment;
}

function calcAmortizationSchedule(principal, annualRate, amortYears, frequency) {
  var freqMap = { monthly: 12, 'semi-monthly': 24, 'bi-weekly': 26, 'accel-bi-weekly': 26, weekly: 52, 'accel-weekly': 52 };
  var n = freqMap[frequency] || 12;
  var payment = calcMortgagePayment(principal, annualRate, amortYears, frequency);
  var r = (annualRate / 100) / 2;
  var effectiveRate = Math.pow(1 + r, 2 / n) - 1;
  var balance = principal;
  var totalInterest = 0;
  var schedule = [];
  var totalPayments = amortYears * n;
  var i = 0;
  while (balance > 0.01 && i < totalPayments) {
    var interest = balance * effectiveRate;
    var principalPaid = Math.min(payment - interest, balance);
    balance -= principalPaid;
    totalInterest += interest;
    i++;
    // Capture snapshot years
    var yr = Math.floor(i / n);
    var rem = i % n;
    if (rem === 0 && yr > 0) {
      schedule.push({ year: yr, balance: Math.max(0, balance), totalInterest: totalInterest });
    }
  }
  return { payment: payment, totalInterest: totalInterest, schedule: schedule, totalPayments: i };
}

function calcHouseProjection(targetPrice, savedAmount, monthlyContribution, downPct) {
  var target = targetPrice * downPct;
  if (savedAmount >= target) return 0;
  if (monthlyContribution <= 0) return null;
  return Math.ceil((target - savedAmount) / monthlyContribution);
}

function renderHouse() {
  var h = state.house || {};
  var price = h.targetPrice || 0;
  var manualSaved = h.savedAmount || 0;
  var goalContrib = h.linkedGoalId ? getGoalContributions(h.linkedGoalId) : 0;
  var saved = manualSaved + goalContrib;
  var monthly = h.monthlyContribution || 0;
  var members = state.members || [];
  var m1 = members[0] || { name: 'Person 1' };
  var m2 = members[1] || { name: 'Person 2' };

  // ── Overview Card ──
  var pct5  = price ? Math.min(100, Math.round((saved / (price * 0.05))  * 100)) : 0;
  var pct10 = price ? Math.min(100, Math.round((saved / (price * 0.10))  * 100)) : 0;
  var pct20 = price ? Math.min(100, Math.round((saved / (price * 0.20))  * 100)) : 0;
  var currentPct = price ? (saved / price * 100).toFixed(1) : 0;
  var months20 = price ? calcHouseProjection(price, saved, monthly, 0.20) : null;
  var months10 = price ? calcHouseProjection(price, saved, monthly, 0.10) : null;
  var months5  = price ? calcHouseProjection(price, saved, monthly, 0.05) : null;

  function projDate(months) {
    if (months === null) return 'N/A (set monthly contribution)';
    if (months <= 0) return '✅ Already there!';
    var d = new Date(); d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString('en-CA', { year:'numeric', month:'long' }) + ' (' + (months < 12 ? months + ' mo' : Math.floor(months/12) + 'y ' + (months%12) + 'm') + ')';
  }

  var overviewHtml = '<div class="card">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px">' +
    '<div>' +
    '<div style="font-size:24px;font-weight:900;color:var(--accent)">' + fmt(saved) + ' saved</div>' +
    (price ? '<div style="font-size:13px;color:var(--muted)">toward ' + fmt(price) + ' target &nbsp;·&nbsp; ' + currentPct + '% of purchase price</div>' : '<div style="font-size:13px;color:var(--muted)">No target price set — click ⚙️ Settings</div>') +
    (goalContrib > 0 ? '<div style="font-size:12px;color:var(--green);margin-top:3px">✅ ' + fmt(goalContrib) + ' from linked goal &nbsp;+&nbsp; ' + fmt(manualSaved) + ' manual</div>' : '') +
    (h.notes ? '<div style="font-size:12px;color:var(--muted);margin-top:4px;font-style:italic">' + h.notes + '</div>' : '') +
    '</div>' +
    (monthly ? '<div style="text-align:right"><div style="font-size:18px;font-weight:800;color:var(--text)">' + fmt(monthly) + '/mo</div><div style="font-size:11px;color:var(--muted)">monthly contribution</div></div>' : '') +
    '</div>' +
    (price ? '<div style="display:flex;flex-direction:column;gap:10px">' +
      _houseThresholdBar('5% Down (' + fmt(price*0.05) + ')', pct5, 'var(--accent)') +
      _houseThresholdBar('10% Down (' + fmt(price*0.10) + ')', pct10, 'var(--accent2)') +
      _houseThresholdBar('20% Down — No CMHC (' + fmt(price*0.20) + ')', pct20, 'var(--green)') +
    '</div>' : '') +
    '</div>';
  document.getElementById('house-overview-card').innerHTML = overviewHtml;

  // ── CMHC Card ──
  var cmhcHtml = '<div class="card" style="margin-bottom:0">' +
    '<div class="card-title">🏦 CMHC Mortgage Insurance</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">Required when down payment is under 20%. Added to your mortgage principal.</div>';
  if (price) {
    var tiers = [
      { label: '5% down', down: price * 0.05, rate: '4.00%' },
      { label: '10% down', down: price * 0.10, rate: '3.10%' },
      { label: '15% down', down: price * 0.15, rate: '2.80%' },
      { label: '20% down', down: price * 0.20, rate: 'None' },
    ];
    cmhcHtml += '<div style="display:flex;flex-direction:column;gap:8px">';
    tiers.forEach(function(t) {
      var premium = calcCMHC(price, t.down);
      var isCurrent = saved >= t.down * 0.98 && saved < (t.down * 1.5);
      cmhcHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:8px;background:' + (isCurrent ? 'color-mix(in srgb,var(--accent) 10%,var(--card))' : 'var(--surface)') + ';border:1px solid ' + (isCurrent ? 'var(--accent)' : 'var(--border)') + '">' +
        '<div><span style="font-weight:700;font-size:13px">' + t.label + '</span> <span style="font-size:11px;color:var(--muted)">(' + t.rate + ')</span></div>' +
        '<div style="font-weight:700;color:' + (premium === 0 ? 'var(--green)' : 'var(--red)') + '">' + (premium === 0 ? '✅ No premium' : fmt(premium)) + '</div>' +
        '</div>';
    });
    cmhcHtml += '</div>';
  } else {
    cmhcHtml += '<div style="color:var(--muted);font-size:13px">Set a target price to see CMHC estimates.</div>';
  }
  cmhcHtml += '</div>';
  document.getElementById('house-cmhc-card').innerHTML = cmhcHtml;

  // ── LTT Card ──
  var lttHtml = '<div class="card" style="margin-bottom:0">' +
    '<div class="card-title">🧾 Ontario Land Transfer Tax</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">Paid at closing. First-time buyers get up to $4,000 rebate.</div>';
  if (price) {
    var ltt = calcOntarioLTT(price);
    var rebate = calcFirstTimeLTTRebate(price);
    var net = ltt - rebate;
    lttHtml += '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">' +
      '<span style="font-size:13px">Ontario LTT (full)</span><span style="font-weight:700">' + fmt(ltt) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">' +
      '<span style="font-size:13px">First-Time Buyer Rebate</span><span style="font-weight:700;color:var(--green)">- ' + fmt(rebate) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:10px 12px;background:color-mix(in srgb,var(--accent) 10%,var(--card));border-radius:8px;border:2px solid var(--accent)">' +
      '<span style="font-size:14px;font-weight:800">Net LTT (first-time)</span><span style="font-weight:900;color:var(--accent);font-size:15px">' + fmt(net) + '</span></div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:4px">💡 Add LTT to your closing cost savings target. Typical closing costs in Ontario are 1.5–4% of purchase price.</div>' +
      '</div>';
  } else {
    lttHtml += '<div style="color:var(--muted);font-size:13px">Set a target price to see LTT estimates.</div>';
  }
  lttHtml += '</div>';
  document.getElementById('house-ltt-card').innerHTML = lttHtml;

  renderHouseHSTRebate();
  renderHouseComparison();
  renderHouseMortgage();
  renderHouseAffordability();
}

function selectHouseDownScenario(key) {
  if (!state.house) state.house = {};
  if (!state.house.mortgage) state.house.mortgage = {};
  state.house.mortgage.selectedScenario = key;
  // Map scenario key to a downOverride amount
  var h     = state.house;
  var price = h.targetPrice || 0;
  var saved = (h.savedAmount || 0) + (h.linkedGoalId ? getGoalContributions(h.linkedGoalId) : 0);
  var down  = 0;
  if      (key === '5')    down = Math.ceil(price * 0.05);
  else if (key === '10')   down = Math.ceil(price * 0.10);
  else if (key === '15')   down = Math.ceil(price * 0.15);
  else if (key === '20')   down = Math.ceil(price * 0.20);
  else if (key === 'saved') down = saved;
  state.house.mortgage.downOverride = down;
  saveState();
  renderHouseComparison();
  renderHouseMortgage();
}

// ── Down Payment Comparison Table (ratehub-style) ──
function renderHouseComparison() {
  var h     = state.house || {};
  var price = h.targetPrice || 0;
  var mort  = h.mortgage    || {};
  var saved = (h.savedAmount || 0) + (h.linkedGoalId ? getGoalContributions(h.linkedGoalId) : 0);
  var isFTHB = (state.members||[]).length > 0 && (state.members||[]).every(function(m){ return m.isFirstTimeBuyer; });
  var selected = mort.selectedScenario || 'saved';

  if (!price) {
    document.getElementById('house-comparison-card').innerHTML =
      '<div class="card"><div class="card-title">📊 Down Payment Scenarios</div>' +
      '<div style="color:var(--muted);font-size:13px">Set a target home price in ⚙️ Settings to see scenarios.</div></div>';
    return;
  }

  var scenarios = [
    { key:'5',    label:'5%',       down: Math.ceil(price * 0.05), pctLabel:'5%' },
    { key:'10',   label:'10%',      down: Math.ceil(price * 0.10), pctLabel:'10%' },
    { key:'15',   label:'15%',      down: Math.ceil(price * 0.15), pctLabel:'15%' },
    { key:'20',   label:'20%',      down: Math.ceil(price * 0.20), pctLabel:'20%' },
    { key:'saved',label:'💰 Saved', down: saved,                   pctLabel: (saved > 0 && price) ? (saved/price*100).toFixed(1)+'%' : '—' }
  ];

  var rate  = mort.rate      || 4.99;
  var amort = mort.amort     || 25;
  var freq  = mort.frequency || 'monthly';
  var hstInPrice = mort.hstInPrice !== false;
  var isNew = !!h.isNewConstruction;
  var freqLabel = { monthly:'Monthly', 'semi-monthly':'Semi-Mo.', 'bi-weekly':'Bi-Wkly', 'accel-bi-weekly':'Accel Bi-Wkly', weekly:'Weekly', 'accel-weekly':'Accel Wkly' };

  // Build per-scenario numbers using calcMortgageContext for each down amount
  var cols = scenarios.map(function(sc) {
    // Pass sc.down directly — no state mutation needed or permitted
    var ctx = calcMortgageContext(price, sc.down);

    var payment = ctx.principal > 0 ? calcMortgagePayment(ctx.principal, ctx.rate, ctx.amort, ctx.freq) : 0;
    var ltt     = calcOntarioLTT(price);
    var lttRebate = isFTHB ? calcFirstTimeLTTRebate(price) : 0;
    var fedHST  = (isNew && isFTHB) ? calcFederalGSTRebate(price) : 0;
    var provHST = (isNew && isFTHB) ? calcOntarioHSTProvincialRebate(price) : 0;
    var totalHSTRebate = fedHST + provHST;
    var netLTT  = ltt - lttRebate;
    var hstCredit = (isNew && isFTHB && !hstInPrice) ? totalHSTRebate : 0;
    var cashToClose = sc.down + netLTT - hstCredit;
    return {
      key: sc.key, label: sc.label, pctLabel: sc.pctLabel,
      down: sc.down, cmhc: ctx.cmhc, principal: ctx.principal,
      payment: payment, ltt: ltt, lttRebate: lttRebate, netLTT: netLTT,
      fedHST: fedHST, provHST: provHST, totalHSTRebate: totalHSTRebate,
      cashToClose: cashToClose
    };
  });

  // ── Table ──
  var COL = cols.length;
  // accent colour per column
  var accents = ['var(--accent)','var(--accent2)','var(--accent)','var(--green)','var(--accent)'];

  function row(label, cells, opts) {
    opts = opts || {};
    var rowBg  = opts.highlight ? 'background:color-mix(in srgb,var(--accent) 6%,var(--card))' : '';
    var lStyle = 'font-size:11px;color:var(--muted);padding:8px 10px 8px 0;white-space:nowrap;vertical-align:middle;' + (opts.bold ? 'font-weight:700;color:var(--text)' : '');
    var html   = '<tr style="' + rowBg + '"><td style="' + lStyle + '">' + label + '</td>';
    cells.forEach(function(c, i) {
      var isSel = cols[i].key === selected;
      var cStyle = 'font-size:12px;font-weight:' + (opts.bold||isSel?'800':'500') + ';text-align:center;padding:8px 4px;' +
        (opts.color ? 'color:' + (c.val >= 0 ? 'var(--green)' : 'var(--red)') + ';' : '') +
        (opts.accent ? 'color:' + accents[i] + ';font-size:13px;' : '');
      html += '<td style="' + cStyle + '">' + c.text + '</td>';
    });
    return html + '</tr>';
  }

  function divider(label) {
    return '<tr><td colspan="' + (COL+1) + '" style="padding:6px 0 2px;font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;border-top:1px solid var(--border)">' + label + '</td></tr>';
  }

  var colHeaders = '<tr>' +
    '<th style="font-size:11px;color:var(--muted);font-weight:400;padding:0 0 10px 0;text-align:left">Scenario</th>' +
    cols.map(function(c) {
      var isSel = c.key === selected;
      return '<th onclick="selectHouseDownScenario(\'' + c.key + '\')" style="cursor:pointer;text-align:center;padding:4px 4px 10px;font-size:12px;' +
        (isSel ? 'color:var(--accent);font-weight:900;border-bottom:3px solid var(--accent)' : 'color:var(--text);font-weight:700;border-bottom:3px solid transparent') + '">' +
        c.label + '<br><span style="font-size:10px;font-weight:400;color:var(--muted)">' + c.pctLabel + '</span></th>';
    }).join('') + '</tr>';

  var tbody =
    row('Down Payment',    cols.map(function(c){ return {text: c.down > 0 ? fmtC(c.down) : '—'};  })) +
    row('CMHC Insurance',  cols.map(function(c){ return {text: c.cmhc>0 ? fmtC(c.cmhc) : '✅ None'}; }), {color:false}) +
    row('Total Mortgage',  cols.map(function(c){ return {text: fmtC(c.principal)};    }), {bold:true, accent:true}) +
    divider('Rate · Amort · Frequency') +
    '<tr><td style="font-size:11px;color:var(--muted);padding:6px 10px 6px 0" colspan="' + (COL+1) + '">' +
      rate.toFixed(2) + '% &nbsp;·&nbsp; ' + amort + '-yr amort &nbsp;·&nbsp; ' + (freqLabel[freq]||freq) +
      ' &nbsp;<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 8px" onclick="openHouseUnifiedModal(\'mortgage\')">✏️ Change</button></td></tr>' +
    row((freqLabel[freq]||'Monthly') + ' Payment', cols.map(function(c){ return {text: fmtC(c.payment)}; }), {bold:true, accent:true}) +
    divider('Closing Costs') +
    row('Ontario LTT',       cols.map(function(c){ return {text: fmtC(c.ltt)};        })) +
    row('LTT Rebate' + (isFTHB ? ' (FTHB)' : ''), cols.map(function(c){ return {text: isFTHB ? '− '+fmtC(c.lttRebate) : '—'}; }), {color:false}) +
    (isNew && isFTHB
      ? row('GST/HST Rebate (FTHB)', cols.map(function(c){ return {text: '− '+fmtC(c.totalHSTRebate)}; }), {color:false})
      : '') +
    row('Net Cash to Close', cols.map(function(c){ return {text: fmtC(c.cashToClose)}; }), {bold:true, accent:true});

  // Wrap in scrollable container for mobile
  var html = '<div class="card" style="overflow-x:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
    '<div class="card-title" style="margin:0">📊 Down Payment Scenarios</div>' +
    '<span style="font-size:11px;color:var(--muted)">Tap a column to select it</span>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;min-width:420px">' +
    '<thead>' + colHeaders + '</thead>' +
    '<tbody>' + tbody + '</tbody>' +
    '</table>' +
    '<div style="font-size:11px;color:var(--muted);margin-top:10px">Selected scenario drives the Mortgage Calculator below. ' +
    (isNew && isFTHB ? 'HST rebate ' + (hstInPrice ? 'assumed in quoted price.' : 'deducted from principal (pre-construction).') : '') +
    '</div></div>';

  document.getElementById('house-comparison-card').innerHTML = html;
}

function _houseThresholdBar(label, pct, color) {
  return '<div>' +
    '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">' +
    '<span style="font-weight:600">' + label + '</span>' +
    '<span style="color:' + (pct>=100?'var(--green)':'var(--muted)') + '">' + (pct>=100?'✅ Ready!':pct+'%') + '</span>' +
    '</div>' +
    '<div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
    '</div>';
}

// ── HST New Home Rebate Card ──
function renderHouseHSTRebate() {
  var h = state.house || {};
  var price = h.targetPrice || 0;
  var isNew = !!h.isNewConstruction;
  var members = state.members || [];
  var isFTHB = members.length > 0 && members.every(function(m) { return m.isFirstTimeBuyer; });

  var fedRebate  = (price && isFTHB) ? calcFederalGSTRebate(price) : 0;
  var provRebate = (price && isFTHB) ? calcOntarioHSTProvincialRebate(price) : 0;
  var totalRebate = fedRebate + provRebate;

  // Eligibility flags
  var fedEligible  = isFTHB && price > 0 && price < 1500000;
  var fedPhaseOut  = isFTHB && price > 1000000 && price < 1500000;
  var provEligible = isFTHB && price > 0 && price < 1000000;

  var html = '<div class="card">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:4px">' +
    '<div class="card-title" style="margin:0">🏗️ GST/HST New Home Rebates</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    '<span style="font-size:11px;padding:3px 8px;border-radius:12px;font-weight:700;background:' + (isNew ? 'color-mix(in srgb,var(--green) 15%,var(--card))' : 'var(--surface)') + ';color:' + (isNew ? 'var(--green)' : 'var(--muted)') + ';border:1px solid ' + (isNew ? 'var(--green)' : 'var(--border)') + '">' + (isNew ? '🏗️ New Construction' : '🏠 Resale') + '</span>' +
    '<span style="font-size:11px;padding:3px 8px;border-radius:12px;font-weight:700;background:' + (isFTHB ? 'color-mix(in srgb,var(--accent) 15%,var(--card))' : 'var(--surface)') + ';color:' + (isFTHB ? 'var(--accent)' : 'var(--muted)') + ';border:1px solid ' + (isFTHB ? 'var(--accent)' : 'var(--border)') + '">' + (isFTHB ? '🏠 First-Time Buyers' : '🏠 Not First-Time') + '</span>' +
    '</div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:14px">New construction only. First-time buyer status is set on each member profile. Resale homes are not eligible for HST rebates.</div>';

  if (!isFTHB) {
    html += '<div style="padding:10px 12px;border-radius:8px;background:color-mix(in srgb,var(--red) 8%,var(--card));border:1px solid color-mix(in srgb,var(--red) 30%,var(--border));font-size:12px;color:var(--muted);margin-bottom:8px">' +
      '⚠️ One or both household members are not marked as first-time home buyers. Update member profiles in ⚙️ Settings to enable these rebates.' +
      '</div>';
  }

  html += '<div style="display:flex;flex-direction:column;gap:8px">';

  // Federal FTHB GST/HST rebate row
  var fedActive = isNew && fedEligible;
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 12px;border-radius:8px;background:' + (fedActive ? 'color-mix(in srgb,var(--accent) 8%,var(--card))' : 'var(--surface)') + ';border:1px solid ' + (fedActive ? 'var(--accent)' : 'var(--border)') + ';opacity:' + (isNew && isFTHB ? '1' : '0.5') + '">' +
    '<div>' +
    '<div style="font-weight:700;font-size:13px">🇨🇦 First-Time Home Buyers\' GST/HST Rebate</div>' +
    '<div style="font-size:11px;color:var(--muted);margin-top:2px">Up to 100% of GST paid, max $50,000. Applies on new builds ≤ $1M. Phases out $1M–$1.5M. None above $1.5M.</div>' +
    (price && isFTHB && price >= 1500000 ? '<div style="font-size:11px;color:var(--red);margin-top:3px">⚠️ Not eligible — purchase price $1.5M or over</div>' : '') +
    (price && fedPhaseOut ? '<div style="font-size:11px;color:var(--accent);margin-top:3px">📉 Partial rebate — price is in the $1M–$1.5M phase-out range</div>' : '') +
    (!isFTHB ? '<div style="font-size:11px;color:var(--red);margin-top:3px">⚠️ First-time buyers only</div>' : '') +
    '</div>' +
    '<div style="font-weight:800;font-size:15px;color:' + (fedActive ? 'var(--green)' : 'var(--muted)') + ';white-space:nowrap;margin-left:12px">' +
    (isNew && price && isFTHB ? (fedEligible ? '+ ' + fmt(fedRebate) : fmt(0)) : (price && isFTHB && fedEligible ? fmt(fedRebate) + ' eligible' : '—')) +
    '</div>' +
    '</div>';

  // Ontario provincial rebate row
  var provActive = isNew && provEligible;
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 12px;border-radius:8px;background:' + (provActive ? 'color-mix(in srgb,var(--accent2) 8%,var(--card))' : 'var(--surface)') + ';border:1px solid ' + (provActive ? 'var(--accent2)' : 'var(--border)') + ';opacity:' + (isNew && isFTHB ? '1' : '0.5') + '">' +
    '<div>' +
    '<div style="font-weight:700;font-size:13px">🏛️ Ontario Provincial Top-Up (8%)</div>' +
    '<div style="font-size:11px;color:var(--muted);margin-top:2px">Full 8% provincial HST component rebate for eligible first-time buyers on new homes under $1M.</div>' +
    (price && isFTHB && price >= 1000000 ? '<div style="font-size:11px;color:var(--red);margin-top:3px">⚠️ Not eligible — purchase price $1M or over</div>' : '') +
    (!isFTHB ? '<div style="font-size:11px;color:var(--red);margin-top:3px">⚠️ First-time buyers only</div>' : '') +
    '</div>' +
    '<div style="font-weight:800;font-size:15px;color:' + (provActive ? 'var(--green)' : 'var(--muted)') + ';white-space:nowrap;margin-left:12px">' +
    (isNew && price && isFTHB ? (provEligible ? '+ ' + fmt(provRebate) : fmt(0)) : (price && isFTHB && provEligible ? fmt(provRebate) + ' eligible' : '—')) +
    '</div>' +
    '</div>';

  // Total row
  if (price && isNew && isFTHB) {
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-radius:8px;background:color-mix(in srgb,var(--green) 10%,var(--card));border:2px solid var(--green)">' +
      '<div>' +
      '<div style="font-size:14px;font-weight:800">Total HST Rebate (new build, first-time buyers)</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:2px">Federal FTHB + Ontario provincial. Applied at closing.</div>' +
      '</div>' +
      '<div style="font-weight:900;font-size:17px;color:var(--green)">+ ' + fmt(totalRebate) + '</div>' +
      '</div>';
  } else if (price && !isNew) {
    html += '<div style="padding:10px 12px;border-radius:8px;background:var(--surface);border:1px solid var(--border);font-size:12px;color:var(--muted)">' +
      '💡 Switch to <strong>New Construction</strong> in ⚙️ Settings to see your potential HST rebate. On a resale home, HST rebates do not apply — but you still benefit from the LTT rebate above.' +
      '</div>';
  } else if (!price) {
    html += '<div style="color:var(--muted);font-size:13px">Set a target price in ⚙️ Settings to see rebate estimates.</div>';
  }

  html += '</div></div>';
  document.getElementById('house-hst-rebate-card').innerHTML = html;
}

// ── Shared mortgage context — single source of truth used by both calculators ──
// Both renderHouseMortgage and renderHouseAffordability call this so they
// are guaranteed to use identical assumptions and produce consistent numbers.
function calcMortgageContext(priceOverride, downOverrideParam) {
  var h    = state.house || {};
  var mort = h.mortgage  || {};
  var price   = (priceOverride !== undefined) ? priceOverride : (h.targetPrice || 0);
  var saved   = (h.savedAmount || 0) + (h.linkedGoalId ? getGoalContributions(h.linkedGoalId) : 0);
  var rate    = mort.rate      || 4.99;
  var amort   = mort.amort     || 25;
  var freq    = mort.frequency || 'monthly';
  var hstInPrice = mort.hstInPrice !== false; // default true

  var isFTHB  = (state.members||[]).length > 0 && (state.members||[]).every(function(m){ return m.isFirstTimeBuyer; });

  // Rebates
  var lttRebate = price ? calcFirstTimeLTTRebate(price) : 0;
  var fedHST    = (price && h.isNewConstruction && isFTHB) ? calcFederalGSTRebate(price)            : 0;
  var provHST   = (price && h.isNewConstruction && isFTHB) ? calcOntarioHSTProvincialRebate(price)  : 0;
  var hstRebate = fedHST + provHST;
  var totalRebates = lttRebate + hstRebate;

  // Effective price: if new construction, FTHB eligible, and HST NOT already in quoted price,
  // deduct the HST rebate from the purchase price before calculating the mortgage principal.
  var effectivePrice = (h.isNewConstruction && isFTHB && !hstInPrice && hstRebate > 0)
    ? Math.max(0, price - hstRebate)
    : price;

  // Down payment priority:
  // 1. downOverrideParam — passed directly by comparison table, never touches state
  // 2. mort.downOverride — user-set value saved in settings
  // 3. selectedScenario  — column selected in comparison table
  // 4. fallback to saved amount or min required
  var minDown = calcMinDown(effectivePrice);
  var downAmt;
  if (downOverrideParam !== undefined) {
    downAmt = downOverrideParam;
  } else if (mort.downOverride > 0) {
    downAmt = mort.downOverride;
  } else {
    var sc = mort.selectedScenario || 'saved';
    if      (sc === '5')    downAmt = Math.ceil(effectivePrice * 0.05);
    else if (sc === '10')   downAmt = Math.ceil(effectivePrice * 0.10);
    else if (sc === '15')   downAmt = Math.ceil(effectivePrice * 0.15);
    else if (sc === '20')   downAmt = Math.ceil(effectivePrice * 0.20);
    else                    downAmt = saved || minDown;
  }

  // CMHC insurance (added to principal when down < 20%)
  var cmhc      = (effectivePrice && downAmt) ? (calcCMHC(effectivePrice, downAmt) || 0) : 0;
  var principal = effectivePrice ? Math.max(0, effectivePrice - downAmt) + cmhc : 0;

  return {
    price: price, effectivePrice: effectivePrice,
    downAmt: downAmt, minDown: minDown, saved: saved,
    cmhc: cmhc, principal: principal,
    rate: rate, amort: amort, freq: freq, hstInPrice: hstInPrice,
    isFTHB: isFTHB,
    lttRebate: lttRebate, fedHST: fedHST, provHST: provHST,
    hstRebate: hstRebate, totalRebates: totalRebates,
    isNew: !!h.isNewConstruction
  };
}

// ── Mortgage Calculator Card ──
function renderHouseMortgage() {
  var h    = state.house || {};
  var mort = h.mortgage  || {};
  var ctx  = calcMortgageContext();
  var freqLabel   = { monthly:'Monthly', 'semi-monthly':'Semi-Monthly', 'bi-weekly':'Bi-Weekly', 'accel-bi-weekly':'Accel. Bi-Weekly', weekly:'Weekly', 'accel-weekly':'Accel. Weekly' };
  var freqPerYear = { monthly:12, 'semi-monthly':24, 'bi-weekly':26, 'accel-bi-weekly':26, weekly:52, 'accel-weekly':52 };

  var scLabels = { '5':'5% Down', '10':'10% Down', '15':'15% Down', '20':'20% Down', 'saved':'💰 Saved Amount' };
  var scKey    = mort.selectedScenario || 'saved';
  var scBadge  = '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:color-mix(in srgb,var(--accent) 12%,var(--card));color:var(--accent);font-weight:700;margin-left:8px">' + (scLabels[scKey]||scKey) + '</span>';

  var html = '<div class="card">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
    '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px"><div class="card-title" style="margin:0">🏦 Mortgage Calculator</div>' + scBadge + '</div>' +
    '<button class="btn btn-ghost btn-sm" onclick="openHouseUnifiedModal(\'mortgage\')">✏️ Settings</button>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:14px">Showing the selected scenario from the table above. Uses Canadian semi-annual compounding.</div>';

  if (!ctx.price) {
    html += '<div style="color:var(--muted);font-size:13px">Set a target home price in ⚙️ Settings to use the mortgage calculator.</div></div>';
    document.getElementById('house-mortgage-card').innerHTML = html;
    return;
  }

  var result       = calcAmortizationSchedule(ctx.principal, ctx.rate, ctx.amort, ctx.freq);
  var payment      = result.payment;
  var totalInterest = result.totalInterest;
  var totalCost    = ctx.principal + totalInterest;

  html += '<div class="grid-3" style="gap:10px;margin-bottom:16px">' +
    _cstat(fmt(payment), (freqLabel[ctx.freq]||'Monthly') + ' Payment') +
    _cstat(fmt(ctx.principal), 'Mortgage Principal' + (ctx.cmhc > 0 ? ' (incl. CMHC)' : '')) +
    _cstat(fmt(ctx.downAmt), 'Down Payment') +
    _cstat(ctx.rate.toFixed(2) + '%', 'Interest Rate') +
    _cstat(ctx.amort + ' yrs', 'Amortization') +
    _cstat(fmt(totalInterest), 'Total Interest') +
    '</div>';

  // Cost + rebates block
  html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">' +
    '<div style="padding:10px 12px;background:color-mix(in srgb,var(--accent) 8%,var(--card));border-radius:8px;border:1px solid var(--accent);display:flex;justify-content:space-between;align-items:center">' +
    '<div><div style="font-size:13px;font-weight:800">Total Cost of Home</div><div style="font-size:11px;color:var(--muted)">Purchase price + all interest over ' + ctx.amort + ' years</div></div>' +
    '<div style="font-size:17px;font-weight:900;color:var(--accent)">' + fmt(totalCost) + '</div>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">' +
    '<div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:2px">Government Rebates at Closing</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:12px"><span>🧾 Ontario LTT First-Time Buyer Rebate</span><span style="color:var(--green);font-weight:700">− ' + fmt(ctx.lttRebate) + '</span></div>' +
    (ctx.isNew
      ? (ctx.isFTHB
          ? '<div style="display:flex;justify-content:space-between;font-size:12px"><span>🇨🇦 First-Time Home Buyers\' GST/HST Rebate</span><span style="color:var(--green);font-weight:700">− ' + fmt(ctx.fedHST) + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:12px"><span>🏛️ Ontario Provincial HST Rebate (8%)</span><span style="color:var(--green);font-weight:700">− ' + fmt(ctx.provHST) + '</span></div>' +
            (!ctx.hstInPrice && ctx.hstRebate > 0
              ? '<div style="font-size:11px;color:var(--accent);margin-top:3px;padding:5px 8px;background:color-mix(in srgb,var(--accent) 8%,var(--card));border-radius:6px">✅ HST rebate deducted from mortgage principal — purchase price reduced to ' + fmt(ctx.effectivePrice) + '</div>'
              : '<div style="font-size:11px;color:var(--muted);margin-top:3px;padding:5px 8px;background:var(--bg);border-radius:6px">ℹ️ HST rebate assumed already in quoted price. Change in ⚙️ Settings if buying pre-construction.</div>')
          : '<div style="font-size:11px;color:var(--muted);font-style:italic">FTHB GST/HST rebates not shown — update member profiles to mark both as first-time buyers.</div>')
      : '<div style="font-size:11px;color:var(--muted);font-style:italic">HST rebates not applicable (resale). Enable New Construction in ⚙️ Settings if buying new.</div>') +
    '</div>' +
    '<div style="padding:10px 12px;background:color-mix(in srgb,var(--green) 10%,var(--card));border-radius:8px;border:2px solid var(--green);display:flex;justify-content:space-between;align-items:center">' +
    '<div><div style="font-size:13px;font-weight:800">Net Out-of-Pocket Cost</div><div style="font-size:11px;color:var(--muted)">Total cost minus all eligible government rebates</div></div>' +
    '<div style="font-size:17px;font-weight:900;color:var(--green)">' + fmt(totalCost - ctx.totalRebates) + '</div>' +
    '</div>' +
    '</div>';

  // Amortization snapshot table
  if (result.schedule.length > 0) {
    var snapYears  = [1, 5, 10, Math.floor(ctx.amort / 2), ctx.amort];
    var uniqueSnaps = snapYears.filter(function(y, i, a){ return a.indexOf(y) === i && y <= ctx.amort; });
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Balance Remaining by Year</div>';
    html += '<div style="display:flex;flex-direction:column;gap:4px">';
    uniqueSnaps.forEach(function(yr) {
      var snap = result.schedule.find(function(s){ return s.year === yr; });
      if (!snap) snap = result.schedule[result.schedule.length - 1];
      var paidPct = Math.min(100, Math.round((ctx.principal - snap.balance) / ctx.principal * 100));
      html += '<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:7px;background:var(--surface);border:1px solid var(--border)">' +
        '<div style="min-width:52px;font-size:12px;font-weight:700;color:var(--muted)">Yr ' + yr + '</div>' +
        '<div style="flex:1"><div class="progress-bar" style="height:6px"><div class="progress-fill" style="width:' + paidPct + '%;background:var(--green)"></div></div></div>' +
        '<div style="min-width:80px;text-align:right;font-size:12px;font-weight:700;color:' + (snap.balance < 1 ? 'var(--green)' : 'var(--text)') + '">' + (snap.balance < 1 ? '✅ Paid off' : fmt(snap.balance)) + '</div>' +
        '</div>';
    });
    html += '</div>';
  }

  if (ctx.cmhc > 0) {
    html += '<div style="font-size:11px;color:var(--muted);margin-top:10px;padding:8px;background:var(--surface);border-radius:7px">⚠️ CMHC insurance of ' + fmt(ctx.cmhc) + ' added to principal. Reach 20% down (' + fmt(ctx.effectivePrice * 0.20) + ') to eliminate this cost.</div>';
  }
  html += '<div style="font-size:11px;color:var(--muted);margin-top:8px">💡 Update rate and terms via ✏️ Settings. Uses Canadian semi-annual compounding.</div>';
  html += '</div>';
  document.getElementById('house-mortgage-card').innerHTML = html;
}

// ── Affordability (Reverse) Calculator Card ──
function renderHouseAffordability() {
  var h    = state.house || {};
  var mort = h.mortgage  || {};
  var comfortPayment = mort.comfortPayment || 0;
  var freqLabel   = { monthly:'Monthly', 'semi-monthly':'Semi-Monthly', 'bi-weekly':'Bi-Weekly', 'accel-bi-weekly':'Accel. Bi-Weekly', weekly:'Weekly', 'accel-weekly':'Accel. Weekly' };
  var freqPerYear = { monthly:12, 'semi-monthly':24, 'bi-weekly':26, 'accel-bi-weekly':26, weekly:52, 'accel-weekly':52 };

  // Read rate/amort/freq from context (without price) so we match mortgage calc settings
  var baseCtx = calcMortgageContext(0);
  var rate  = baseCtx.rate;
  var amort = baseCtx.amort;
  var freq  = baseCtx.freq;

  var html = '<div class="card">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
    '<div class="card-title" style="margin:0">🔄 How Much House Can We Afford?</div>' +
    '<button class="btn btn-ghost btn-sm" onclick="openHouseUnifiedModal(\'mortgage\')">✏️ Settings</button>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:14px">Enter a comfortable payment amount and see the maximum home price it supports at your current rate and amortization.</div>';

  if (!comfortPayment) {
    html += '<div style="color:var(--muted);font-size:13px">Set a <strong>Comfortable Payment Amount</strong> in ✏️ Settings to use this calculator.</div></div>';
    document.getElementById('house-affordability-card').innerHTML = html;
    return;
  }

  // Binary search: find the purchase price where calcMortgageContext(price).principal
  // produces exactly comfortPayment when fed to calcMortgagePayment.
  // This uses the IDENTICAL logic as renderHouseMortgage — guaranteed to match.
  var lo = 50000; var hi = 6000000; var maxPrice = lo;
  var i = 0;
  while (lo <= hi && i < 80) {
    var mid  = Math.floor((lo + hi) / 2);
    var mctx = calcMortgageContext(mid);
    var pmt  = mctx.principal > 0 ? calcMortgagePayment(mctx.principal, mctx.rate, mctx.amort, mctx.freq) : 0;
    if (Math.abs(pmt - comfortPayment) < 0.50) { maxPrice = mid; break; }
    if (pmt < comfortPayment) { lo = mid + 1; maxPrice = mid; }
    else hi = mid - 1;
    i++;
  }

  // Get context at the found maxPrice for display
  var ctx = calcMortgageContext(maxPrice);
  var n = freqPerYear[freq] || 12;
  var totalPayments = amort * n;
  var totalInterest = (comfortPayment * totalPayments) - ctx.principal;

  html += '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:10px;background:color-mix(in srgb,var(--green) 10%,var(--card));border:2px solid var(--green);margin-bottom:14px">' +
    '<div style="font-size:32px">🏠</div>' +
    '<div>' +
    '<div style="font-size:22px;font-weight:900;color:var(--green)">' + fmt(maxPrice) + '</div>' +
    '<div style="font-size:12px;color:var(--muted)">Max home price at ' + fmt(comfortPayment) + ' ' + (freqLabel[freq]||'monthly').toLowerCase() + ' · ' + rate.toFixed(2) + '% · ' + amort + '-yr amort</div>' +
    '</div></div>';

  html += '<div class="grid-3" style="gap:10px;margin-bottom:12px">' +
    _cstat(fmt(ctx.principal), 'Max Mortgage' + (ctx.cmhc > 0 ? ' (incl. CMHC)' : '')) +
    _cstat(fmt(ctx.downAmt), 'Min. Required Down') +
    _cstat(fmt(Math.max(0, totalInterest)), 'Est. Total Interest') +
    '</div>';

  // Rebates block — identical structure to mortgage calculator
  html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">' +
    '<div style="display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">' +
    '<div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:2px">Government Rebates at Closing</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:12px"><span>🧾 Ontario LTT First-Time Buyer Rebate</span><span style="color:var(--green);font-weight:700">− ' + fmt(ctx.lttRebate) + '</span></div>' +
    (ctx.isNew
      ? (ctx.isFTHB
          ? '<div style="display:flex;justify-content:space-between;font-size:12px"><span>🇨🇦 First-Time Home Buyers\' GST/HST Rebate</span><span style="color:var(--green);font-weight:700">− ' + fmt(ctx.fedHST) + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:12px"><span>🏛️ Ontario Provincial HST Rebate (8%)</span><span style="color:var(--green);font-weight:700">− ' + fmt(ctx.provHST) + '</span></div>' +
            (!ctx.hstInPrice && ctx.hstRebate > 0
              ? '<div style="font-size:11px;color:var(--accent);margin-top:3px;padding:5px 8px;background:color-mix(in srgb,var(--accent) 8%,var(--card));border-radius:6px">✅ HST rebate not in quoted price — effective max price is ' + fmt(ctx.effectivePrice) + ' after rebate</div>'
              : '<div style="font-size:11px;color:var(--muted);margin-top:3px">HST rebate assumed already in quoted price.</div>')
          : '<div style="font-size:11px;color:var(--muted);font-style:italic">FTHB GST/HST rebates not shown — update member profiles to mark both as first-time buyers.</div>')
      : '<div style="font-size:11px;color:var(--muted);font-style:italic">HST rebates not applicable (resale). Enable New Construction in ⚙️ Settings if buying new.</div>') +
    '</div>' +
    '<div style="padding:10px 12px;background:color-mix(in srgb,var(--green) 10%,var(--card));border-radius:8px;border:2px solid var(--green);display:flex;justify-content:space-between;align-items:center">' +
    '<div><div style="font-size:13px;font-weight:800">Net Out-of-Pocket Cost</div><div style="font-size:11px;color:var(--muted)">Max home price minus all eligible government rebates</div></div>' +
    '<div style="font-size:17px;font-weight:900;color:var(--green)">' + fmt(maxPrice - ctx.totalRebates) + '</div>' +
    '</div>' +
    '</div>';

  // Stress test — same binary search at rate + 2%
  var stressRate = rate + 2;
  var slo = 50000; var shi = 6000000; var stressPrice = slo;
  var si = 0;
  while (slo <= shi && si < 80) {
    var smid = Math.floor((slo + shi) / 2);
    var sctx = calcMortgageContext(smid);
    // Temporarily override rate for stress test payment calc
    var spmt = sctx.principal > 0 ? calcMortgagePayment(sctx.principal, stressRate, amort, freq) : 0;
    if (Math.abs(spmt - comfortPayment) < 0.50) { stressPrice = smid; break; }
    if (spmt < comfortPayment) { slo = smid + 1; stressPrice = smid; }
    else shi = smid - 1;
    si++;
  }

  html += '<div style="padding:10px 12px;background:color-mix(in srgb,var(--red) 8%,var(--card));border-radius:8px;border:1px solid color-mix(in srgb,var(--red) 30%,var(--border));display:flex;justify-content:space-between;align-items:center">' +
    '<div><div style="font-size:12px;font-weight:700">🧪 Stress Test (' + stressRate.toFixed(2) + '%)</div><div style="font-size:11px;color:var(--muted)">OSFI requires qualification at rate + 2%. Same payment qualifies for less.</div></div>' +
    '<div style="font-size:14px;font-weight:800;color:var(--red)">' + fmt(stressPrice) + '</div>' +
    '</div>';

  html += '</div>';
  document.getElementById('house-affordability-card').innerHTML = html;
}

// ── Mortgage Modal ──
function openHouseUnifiedModal(tab) {
  var h    = state.house   || {};
  var mort = h.mortgage    || {};
  var price = h.targetPrice || 0;
  var saved = (h.savedAmount || 0) + (h.linkedGoalId ? getGoalContributions(h.linkedGoalId) : 0);
  var minDown = calcMinDown(price);
  var pct20   = price ? Math.ceil(price * 0.20) : 0;

  // Tab 1 — Home Details
  document.getElementById('hu-price').value    = price    || '';
  document.getElementById('hu-saved').value    = h.savedAmount || '';
  document.getElementById('hu-monthly').value  = h.monthlyContribution || '';
  document.getElementById('hu-notes').value    = h.notes  || '';
  document.getElementById('hu-new-construction').checked = !!h.isNewConstruction;
  var sel = document.getElementById('hu-linked-goal');
  if (sel) {
    sel.innerHTML = '<option value="">None — enter savings manually</option>' +
      (state.goals||[]).map(function(g){
        return '<option value="'+g.id+'"'+(g.id===h.linkedGoalId?' selected':'')+'>'+g.emoji+' '+g.name+' ('+fmt(g.current+getGoalContributions(g.id))+' / '+fmt(g.target)+')</option>';
      }).join('');
  }

  // Tab 2 — Mortgage Terms
  document.getElementById('hu-rate').value     = mort.rate      || 4.99;
  document.getElementById('hu-amort').value    = mort.amort     || 25;
  document.getElementById('hu-freq').value     = mort.frequency || 'monthly';
  document.getElementById('hu-hst-in-price').checked = mort.hstInPrice !== false;
  document.getElementById('hu-comfort').value  = mort.comfortPayment || '';

  // Down payment — stored override, else min required
  var downVal = mort.downOverride > 0 ? mort.downOverride : (minDown || '');
  document.getElementById('hu-down').value = downVal;

  // Wire quick-fill buttons
  var btnMin  = document.getElementById('hu-btn-mindown');
  var btnSave = document.getElementById('hu-btn-saved');
  var btn20   = document.getElementById('hu-btn-20pct');
  if (btnMin)  { btnMin.dataset.val  = minDown; btnMin.textContent  = '⬇️ Min Required (' + fmt(minDown) + ')'; }
  if (btnSave) { btnSave.dataset.val = saved;   btnSave.textContent = '💰 Saved Amount (' + fmt(saved) + ')'; }
  if (btn20)   { btn20.dataset.val   = pct20;   btn20.textContent   = '🏆 20% No CMHC (' + fmt(pct20) + ')'; }

  var downHint = document.getElementById('hu-down-hint');
  if (downHint) {
    if (price >= 1000000)     downHint.textContent = '⚠️ Homes $1M+ require a minimum 20% down — CMHC is not available.';
    else if (price > 500000)  downHint.textContent = 'Min: 5% on first $500K + 10% on remainder = ' + fmt(minDown) + '.';
    else if (price)           downHint.textContent = 'Min: 5% of purchase price = ' + fmt(minDown) + '.';
    else                      downHint.textContent = 'Set a target home price above to calculate minimums.';
  }

  // Switch to the requested tab
  huSwitchTab(tab || 'home');
  openModal('house-unified-modal');
}

function huSwitchTab(tab) {
  var tabs = ['home', 'mortgage'];
  tabs.forEach(function(t) {
    var btn   = document.getElementById('hu-tab-' + t);
    var panel = document.getElementById('hu-panel-' + t);
    if (btn)   btn.style.fontWeight   = (t === tab) ? '800' : '400';
    if (btn)   btn.style.borderBottom = (t === tab) ? '2px solid var(--accent)' : '2px solid transparent';
    if (panel) panel.style.display    = (t === tab) ? 'flex' : 'none';
  });
}

function saveHouseUnified() {
  if (!state.house)          state.house          = {};
  if (!state.house.mortgage) state.house.mortgage = {};

  // Home Details
  state.house.targetPrice         = parseFloat(document.getElementById('hu-price').value)   || 0;
  state.house.savedAmount         = parseFloat(document.getElementById('hu-saved').value)   || 0;
  state.house.monthlyContribution = parseFloat(document.getElementById('hu-monthly').value) || 0;
  state.house.notes               = document.getElementById('hu-notes').value.trim();
  state.house.isNewConstruction   = document.getElementById('hu-new-construction').checked;
  var sel = document.getElementById('hu-linked-goal');
  state.house.linkedGoalId        = sel ? sel.value : '';

  // Mortgage Terms
  state.house.mortgage.rate           = parseFloat(document.getElementById('hu-rate').value)    || 4.99;
  state.house.mortgage.amort          = parseInt(document.getElementById('hu-amort').value)     || 25;
  state.house.mortgage.frequency      = document.getElementById('hu-freq').value                || 'monthly';
  state.house.mortgage.downOverride   = parseFloat(document.getElementById('hu-down').value)    || 0;
  state.house.mortgage.hstInPrice     = document.getElementById('hu-hst-in-price').checked;
  state.house.mortgage.comfortPayment = parseFloat(document.getElementById('hu-comfort').value) || 0;

  saveState();
  closeModal('house-unified-modal');
  renderHouse();
  renderDashboard();
  hhToast('House settings saved!', '🏡');
}

// Keep old names as aliases so any remaining references (FHSA/HBP buttons etc.) still work
function openHouseSettingsModal()  { openHouseUnifiedModal('home');     }
function openHouseMortgageModal()  { openHouseUnifiedModal('mortgage'); }
function saveHouseSettings()       { saveHouseUnified(); }
function saveHouseMortgage()       { saveHouseUnified(); }

// BILLS & SUBSCRIPTIONS
var BILL_CATEGORIES = ['Streaming','Music','Software','Phone & Internet','Insurance','Utilities','Fitness','Gaming','News & Magazines','Finance','Pet','Other'];
var BILL_FREQUENCIES = ['Weekly','Bi-weekly','Monthly','Bi-monthly','Quarterly','Semi-annual','Annual'];

function _billMonthlyCost(b) {
  var amt = b.amount || 0;
  switch (b.frequency) {
    case 'Weekly':      return amt * 52 / 12;
    case 'Bi-weekly':   return amt * 26 / 12;
    case 'Monthly':     return amt;
    case 'Bi-monthly':  return amt / 2;
    case 'Quarterly':   return amt / 3;
    case 'Semi-annual': return amt / 6;
    case 'Annual':      return amt / 12;
    default:            return amt;
  }
}

function _billNextDue(b) {
  if (!b.nextDue) return null;
  return new Date(b.nextDue + 'T00:00:00');
}

function _advanceBillDue(b) {
  // Advance nextDue by one frequency period
  if (!b.nextDue) return;
  var d = new Date(b.nextDue + 'T00:00:00');
  switch (b.frequency) {
    case 'Weekly':      d.setDate(d.getDate()+7);   break;
    case 'Bi-weekly':   d.setDate(d.getDate()+14);  break;
    case 'Monthly':     d.setMonth(d.getMonth()+1); break;
    case 'Bi-monthly':  d.setMonth(d.getMonth()+2); break;
    case 'Quarterly':   d.setMonth(d.getMonth()+3); break;
    case 'Semi-annual': d.setMonth(d.getMonth()+6); break;
    case 'Annual':      d.setFullYear(d.getFullYear()+1); break;
  }
  b.nextDue = d.toISOString().slice(0,10);
}

function renderBills() {
  var bills = state.bills || [];
  var today = new Date(); today.setHours(0,0,0,0);

  // Alert bar — overdue and due within 7 days
  var alerts = bills.filter(function(b){
    var d = _billNextDue(b);
    if (!d) return false;
    var days = Math.ceil((d-today)/86400000);
    return days <= 7;
  }).sort(function(a,b){ return _billNextDue(a)-_billNextDue(b); });

  document.getElementById('bills-alert-bar').innerHTML = alerts.map(function(b){
    var d = _billNextDue(b);
    var days = Math.ceil((d-today)/86400000);
    var urgency = days < 0 ? 'var(--red)' : days === 0 ? 'var(--red)' : 'var(--yellow)';
    var label = days < 0 ? 'OVERDUE by '+Math.abs(days)+'d' : days === 0 ? 'due TODAY' : 'due in '+days+' day'+(days===1?'':'s');
    return '<div class="alert" style="border-left:4px solid '+urgency+';background:color-mix(in srgb,'+urgency+' 8%,var(--card));margin-bottom:6px">🧾 <strong>'+b.name+'</strong> — '+fmt(b.amount||0)+' <span style="color:'+urgency+';font-weight:700">'+label+'</span>'+(b.account?' &nbsp;·&nbsp; '+b.account:'')+'</div>';
  }).join('');

  // Stats
  var monthlyTotal = bills.reduce(function(s,b){ return s+_billMonthlyCost(b); }, 0);
  var annualTotal  = monthlyTotal * 12;
  var overdueCount = bills.filter(function(b){ var d=_billNextDue(b); return d && d<today; }).length;
  var dueWeek      = bills.filter(function(b){ var d=_billNextDue(b); if(!d) return false; var days=Math.ceil((d-today)/86400000); return days>=0&&days<=7; }).length;
  document.getElementById('bills-stats').innerHTML =
    '<div class="stat"><div class="stat-label">Est. Monthly</div><div class="stat-value clr-accent">'+fmt(monthlyTotal)+'</div></div>' +
    '<div class="stat"><div class="stat-label">Est. Annual</div><div class="stat-value">'+fmt(annualTotal)+'</div></div>' +
    '<div class="stat"><div class="stat-label">Due This Week</div><div class="stat-value" style="color:var(--yellow)">'+dueWeek+'</div></div>' +
    '<div class="stat"><div class="stat-label">Overdue</div><div class="stat-value" style="color:var(--red)">'+overdueCount+'</div></div>';

  if (!bills.length) {
    document.getElementById('bills-upcoming-card').innerHTML = '';
    document.getElementById('bills-by-category-card').innerHTML = '';
    document.getElementById('bills-list-card').innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px">No bills added yet. Click <strong>+ Add Bill</strong> or try <strong>🔍 Auto-Detect</strong> to find recurring charges from your transactions.</div>';
    return;
  }

  // Upcoming timeline (next 30 days)
  var upcoming30 = [];
  bills.forEach(function(b){
    var d = _billNextDue(b);
    if (!d) return;
    var days = Math.ceil((d-today)/86400000);
    if (days >= 0 && days <= 30) upcoming30.push({ bill:b, days:days, date:d });
  });
  upcoming30.sort(function(a,b){ return a.days-b.days; });
  var upcomingHtml = '<div class="card" style="margin-bottom:0"><div class="card-title">📅 Due in the Next 30 Days</div>';
  if (upcoming30.length) {
    upcomingHtml += '<div style="display:flex;flex-direction:column;gap:6px">' +
      upcoming30.map(function(u){
        var urgency = u.days === 0 ? 'var(--red)' : u.days <= 7 ? 'var(--yellow)' : 'var(--muted)';
        var dayLabel = u.days === 0 ? 'Today' : u.days === 1 ? 'Tomorrow' : 'In '+u.days+'d';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">' +
          '<div><span style="font-weight:700;font-size:13px">'+u.bill.name+'</span>' +
          (u.bill.category ? ' <span style="font-size:10px;color:var(--muted);background:var(--border);padding:1px 6px;border-radius:10px">'+getCatById(u.bill.category).name+'</span>' : '') +
          '</div>' +
          '<div style="text-align:right"><div style="font-weight:800;color:var(--text)">'+fmt(u.bill.amount||0)+'</div>' +
          '<div style="font-size:11px;color:'+urgency+';font-weight:700">'+dayLabel+' &nbsp;·&nbsp; '+u.bill.nextDue+'</div></div>' +
          '</div>';
      }).join('') + '</div>';
  } else {
    upcomingHtml += '<div style="color:var(--muted);font-size:13px;padding:8px 0">No bills due in the next 30 days. 🎉</div>';
  }
  upcomingHtml += '</div>';
  document.getElementById('bills-upcoming-card').innerHTML = upcomingHtml;

  // By category breakdown — resolve IDs to names
  var byCat = {};
  bills.forEach(function(b){
    var cat = getCatById(b.category||'other');
    var label = cat.name || 'Other';
    if (!byCat[label]) byCat[label] = 0;
    byCat[label] += _billMonthlyCost(b);
  });
  var catEntries = Object.entries(byCat).sort(function(a,b){ return b[1]-a[1]; });
  var catMax = catEntries.length ? catEntries[0][1] : 1;
  var catHtml = '<div class="card" style="margin-bottom:0"><div class="card-title">📊 Monthly Cost by Category</div><div style="display:flex;flex-direction:column;gap:8px">' +
    catEntries.map(function(e){
      var pct = Math.round((e[1]/catMax)*100);
      return '<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px"><span style="font-weight:600">'+e[0]+'</span><span>'+fmt(e[1])+'/mo</span></div>' +
        '<div class="progress-bar" style="height:6px"><div class="progress-fill" style="width:'+pct+'%;background:var(--accent)"></div></div></div>';
    }).join('') + '</div></div>';
  document.getElementById('bills-by-category-card').innerHTML = catHtml;

  // Full bills list grouped by category name
  var grouped = {};
  bills.forEach(function(b){
    var cat = getCatById(b.category||'other');
    var label = cat.name || 'Other';
    if(!grouped[label])grouped[label]=[];
    grouped[label].push(b);
  });
  var listHtml = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div class="card-title" style="margin:0">All Bills & Subscriptions</div></div>';
  Object.keys(grouped).sort().forEach(function(cat){
    listHtml += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:800;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px">'+cat+'</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">';
    grouped[cat].forEach(function(b){
      var d = _billNextDue(b);
      var days = d ? Math.ceil((d-today)/86400000) : null;
      var statusColor = days===null?'var(--muted)':days<0?'var(--red)':days<=7?'var(--yellow)':'var(--green)';
      var statusTxt   = days===null?'No due date':days<0?'Overdue '+Math.abs(days)+'d':days===0?'Due today':days===1?'Due tomorrow':'Due in '+days+'d';
      listHtml += '<div class="card" style="margin-bottom:0;padding:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div style="font-weight:700;font-size:14px">'+b.name+'</div>' +
        '<div style="display:flex;gap:4px">' +
        '<button class="btn btn-ghost btn-sm" onclick="markBillPaid(\''+b.id+'\')">✅</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="editBill(\''+b.id+'\')">✏️</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteBill(\''+b.id+'\')">🗑️</button>' +
        '</div></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:6px">' +
        '<div><div style="font-size:18px;font-weight:900;color:var(--accent)">'+fmt(b.amount||0)+'</div>' +
        '<div style="font-size:11px;color:var(--muted)">'+b.frequency+(b.account?' &nbsp;·&nbsp; '+b.account:'')+'</div></div>' +
        '<div style="text-align:right"><div style="font-size:12px;color:'+statusColor+';font-weight:700">'+statusTxt+'</div>' +
        (b.nextDue?'<div style="font-size:11px;color:var(--muted)">'+b.nextDue+'</div>':'') +
        '</div></div>' +
        (b.notes?'<div style="font-size:11px;color:var(--muted);margin-top:4px;font-style:italic">'+b.notes+'</div>':'') +
        '</div>';
    });
    listHtml += '</div></div>';
  });
  listHtml += '</div>';
  document.getElementById('bills-list-card').innerHTML = listHtml;
}

function openBillModal(prefill) {
  var p = prefill || {};
  // Populate category dropdown from transaction categories
  var catSel = document.getElementById('bill-category');
  if (catSel) {
    var prevCat = p.category || 'other';
    catSel.innerHTML = state.categories
      .filter(function(c){ return c.id !== 'income' && c.id !== 'transfer'; })
      .map(function(c){ return '<option value="'+c.id+'"'+(c.id===prevCat?' selected':'')+'>'+c.name+'</option>'; })
      .join('');
    // If category not found in list, fall back to first option
    if (!catSel.value) catSel.selectedIndex = 0;
  }
  document.getElementById('bill-edit-id').value    = p.id || '';
  document.getElementById('bill-source-desc').value = p.sourceDesc || '';
  document.getElementById('bill-name').value      = p.name || '';
  document.getElementById('bill-amount').value    = p.amount || '';
  document.getElementById('bill-frequency').value = p.frequency || 'Monthly';
  document.getElementById('bill-next-due').value  = p.nextDue || '';
  document.getElementById('bill-account').value   = p.account || '';
  document.getElementById('bill-notes').value     = p.notes || '';
  document.getElementById('bill-modal-title').textContent = p.id ? '✏️ Edit Bill' : '🧾 Add Bill';
  openModal('bill-modal');
}

function editBill(id) {
  var b = (state.bills||[]).find(function(x){ return x.id===id; });
  if (b) openBillModal(b);
}

function saveBill() {
  var name = document.getElementById('bill-name').value.trim();
  if (!name) { hhToast('Please enter a bill name.','⚠️'); return; }
  var editId = document.getElementById('bill-edit-id').value;
  var existingBill = editId ? (state.bills||[]).find(function(x){ return x.id===editId; }) : null;
  var b = {
    id:         editId || uid(),
    name:       name,
    amount:     parseFloat(document.getElementById('bill-amount').value) || 0,
    frequency:  document.getElementById('bill-frequency').value,
    category:   document.getElementById('bill-category').value,
    nextDue:    document.getElementById('bill-next-due').value,
    account:    document.getElementById('bill-account').value.trim(),
    notes:      document.getElementById('bill-notes').value.trim(),
    // Preserve sourceDesc from auto-detect; keep existing one on edit
    sourceDesc: document.getElementById('bill-source-desc').value.trim() || (existingBill && existingBill.sourceDesc) || ''
  };
  if (!state.bills) state.bills = [];
  if (editId) {
    var idx = state.bills.findIndex(function(x){ return x.id===editId; });
    if (idx>=0) state.bills[idx]=b; else state.bills.push(b);
  } else {
    state.bills.push(b);
  }
  saveState(); closeModal('bill-modal'); renderBills(); renderDashboard();
  // If we're mid-queue, advance to next suggestion
  if (_billSuggestQueue.length > 0) {
    _billSuggestNext();
  } else {
    _billSuggestCleanup();
    hhToast('Bill saved!','🧾');
  }
}

function deleteBill(id) {
  hhConfirm('Remove this bill?','🗑️','Remove Bill').then(function(ok){
    if (!ok) return;
    state.bills = (state.bills||[]).filter(function(b){ return b.id!==id; });
    saveState(); renderBills(); renderDashboard();
    hhToast('Bill removed.','🗑️');
  });
}

function markBillPaid(id) {
  var b = (state.bills||[]).find(function(x){ return x.id===id; });
  if (!b) return;
  _advanceBillDue(b);
  saveState(); renderBills(); renderDashboard();
  hhToast(b.name+' marked as paid — next due: '+b.nextDue,'✅');
}

var _billSuggestQueue = [];

function billsSuggestFromTransactions() {
  // ── Pass 1: category-based — any transaction cat that implies recurring billing ──
  var SUGGEST_CATS = ['subscriptions','phone','fitness','insurance','entertainment','health','auto','other'];

  // ── Pass 2: keyword scan — catches streaming/media even if miscategorised ──
  // Each entry: { pattern (regex), suggestedCat (state.categories id), label (clean name) }
  var KNOWN_BILLS = [
    // Streaming / Video
    { p:/NETFLIX/,          cat:'entertainment', label:'Netflix' },
    { p:/DISNEY(\+| PLUS)/,  cat:'entertainment', label:'Disney+' },
    { p:/CRAVE/,            cat:'entertainment', label:'Crave' },
    { p:/PARAMOUNT/,        cat:'entertainment', label:'Paramount+' },
    { p:/APPLE.*TV|APPLE TV/,cat:'entertainment',label:'Apple TV+' },
    { p:/AMAZON.*VIDEO|PRIME VIDEO/, cat:'entertainment', label:'Prime Video' },
    { p:/YOUTUBE.*PREMIUM/, cat:'entertainment', label:'YouTube Premium' },
    { p:/HULU/,             cat:'entertainment', label:'Hulu' },
    { p:/HBO/,              cat:'entertainment', label:'HBO Max' },
    // Music
    { p:/SPOTIFY/,          cat:'subscriptions', label:'Spotify' },
    { p:/APPLE.*MUSIC/,     cat:'subscriptions', label:'Apple Music' },
    { p:/TIDAL/,            cat:'subscriptions', label:'Tidal' },
    { p:/DEEZER/,           cat:'subscriptions', label:'Deezer' },
    { p:/AMAZON.*MUSIC/,    cat:'subscriptions', label:'Amazon Music' },
    // Software / Cloud
    { p:/MICROSOFT.*365|OFFICE 365|MICROSOFT 365/, cat:'subscriptions', label:'Microsoft 365' },
    { p:/MICROSOFT.*GAME PASS|XBOX GAME PASS/,     cat:'subscriptions', label:'Xbox Game Pass' },
    { p:/ADOBE/,            cat:'subscriptions', label:'Adobe Creative Cloud' },
    { p:/GOOGLE.*ONE|GOOGLE STORAGE/, cat:'subscriptions', label:'Google One' },
    { p:/ICLOUD|APPLE.*ICLOUD/, cat:'subscriptions', label:'iCloud+' },
    { p:/DROPBOX/,          cat:'subscriptions', label:'Dropbox' },
    { p:/NOTION/,           cat:'subscriptions', label:'Notion' },
    { p:/CHATGPT|OPENAI/,   cat:'subscriptions', label:'ChatGPT' },
    // Gaming
    { p:/PLAYSTATION.*PLUS|PS PLUS|PSN/, cat:'subscriptions', label:'PlayStation Plus' },
    { p:/NINTENDO.*ONLINE/,  cat:'subscriptions', label:'Nintendo Online' },
    { p:/STEAM/,            cat:'subscriptions', label:'Steam' },
    // Phone / Internet
    { p:/TELUS/,            cat:'phone', label:'Telus' },
    { p:/ROGERS/,           cat:'phone', label:'Rogers' },
    { p:/BELL /,            cat:'phone', label:'Bell' },
    { p:/FIDO/,             cat:'phone', label:'Fido' },
    { p:/KOODO/,            cat:'phone', label:'Koodo' },
    { p:/FREEDOM/,          cat:'phone', label:'Freedom Mobile' },
    { p:/PUBLIC MOBILE/,    cat:'phone', label:'Public Mobile' },
    { p:/COGECO/,           cat:'phone', label:'Cogeco' },
    { p:/SHAW/,             cat:'phone', label:'Shaw' },
    { p:/EASTLINK/,         cat:'phone', label:'Eastlink' },
    // Fitness
    { p:/GOODLIFE/,         cat:'fitness', label:'GoodLife Fitness' },
    { p:/YMCA/,             cat:'fitness', label:'YMCA' },
    { p:/PLANET FITNESS/,   cat:'fitness', label:'Planet Fitness' },
    { p:/ANYTIME FITNESS/,  cat:'fitness', label:'Anytime Fitness' },
    // Shopping / Prime
    { p:/AMAZON PRIME/,     cat:'subscriptions', label:'Amazon Prime' },
    { p:/PC EXPRESS PASS/,  cat:'subscriptions', label:'PC Express Pass' },
    { p:/COSTCO/,           cat:'subscriptions', label:'Costco Membership' },
    // News / Podcasts
    { p:/NEW YORK TIMES|NYTIMES/, cat:'subscriptions', label:'New York Times' },
    { p:/GLOBE.*MAIL/,      cat:'subscriptions', label:'Globe and Mail' },
    { p:/TORONTO STAR/,     cat:'subscriptions', label:'Toronto Star' },
    { p:/PATREON/,          cat:'subscriptions', label:'Patreon' },
    // Insurance
    { p:/ALLSTATE/,         cat:'insurance', label:'Allstate Insurance' },
    { p:/INTACT/,           cat:'insurance', label:'Intact Insurance' },
    { p:/SUNLIFE|SUN LIFE/, cat:'insurance', label:'Sun Life' },
    { p:/MANULIFE/,         cat:'insurance', label:'Manulife' },
  ];

  var counts = {};
  var amts   = {};
  var catHints = {}; // key → suggested category id

  // Pass 1: category-based scan
  state.transactions.forEach(function(t){
    if (!SUGGEST_CATS.includes(t.category)) return;
    var key = t.description.substring(0,25).trim().toUpperCase();
    counts[key] = (counts[key]||0)+1;
    if (Math.abs(t.amount||0) > 0) amts[key] = Math.abs(t.amount);
    if (!catHints[key]) catHints[key] = t.category;
  });

  // Pass 2: keyword scan across ALL transactions
  state.transactions.forEach(function(t){
    var desc = (t.description||'').toUpperCase();
    KNOWN_BILLS.forEach(function(kb){
      if (!kb.p.test(desc)) return;
      var key = kb.label.toUpperCase();
      counts[key] = (counts[key]||0)+1;
      if (Math.abs(t.amount||0) > 0) amts[key] = Math.abs(t.amount);
      catHints[key] = kb.cat; // always use the smarter hint
    });
  });

  // Filter: 2+ occurrences, not already in bills list
  // Normalize helper — strip punctuation/spaces for fuzzy matching
  function _norm(s) { return s.toUpperCase().replace(/[^A-Z0-9]/g,''); }
  var existingBills = (state.bills||[]);

  function _isDuplicate(key, detectedAmt) {
    var kn = _norm(key);
    return existingBills.some(function(b){
      // Check against both the bill's display name AND its original transaction description
      var namesToCheck = [_norm(b.name)];
      if (b.sourceDesc) namesToCheck.push(_norm(b.sourceDesc));

      var nameMatch = namesToCheck.some(function(en){
        var shorter = kn.length <= en.length ? kn : en;
        var longer  = kn.length <= en.length ? en : kn;
        return longer.startsWith(shorter) && shorter.length >= 4;
      });
      if (!nameMatch) return false;
      // If either side has no amount, name match alone is enough
      if (!b.amount || !detectedAmt) return true;
      // Otherwise require amounts to be within 15% of each other
      var ratio = detectedAmt / b.amount;
      return ratio >= 0.85 && ratio <= 1.15;
    });
  }

  var allCandidates = Object.keys(counts).filter(function(k){ return counts[k] >= 2; });
  var filtered = allCandidates.filter(function(k){ return _isDuplicate(k, amts[k]||0); });
  console.log('[Auto-Detect] Candidates:', allCandidates.length, '| Filtered as duplicates:', filtered.length, filtered.map(function(k){ return _titleCase(k)+'('+fmt(amts[k]||0)+')'; }));

  var suggestions = allCandidates.filter(function(k){
    return !_isDuplicate(k, amts[k]||0);
  }).sort(function(a,b){ return (amts[b]||0)-(amts[a]||0); }); // sort by amount desc

  if (!suggestions.length) { hhToast('No new recurring charges detected from your transactions.','ℹ️'); return; }

  var msg = 'Found '+suggestions.length+' possible recurring charge'+(suggestions.length>1?'s':'')+' from your transactions:\n\n'
    + suggestions.slice(0,10).map(function(k){ return '• '+_titleCase(k)+(amts[k]?' — '+fmt(amts[k]):''); }).join('\n')
    + (suggestions.length > 10 ? '\n  …and '+(suggestions.length-10)+' more' : '')
    + '\n\nClick OK to review them one by one. Skip any you don\'t want.';

  hhConfirm(msg,'🔍','Auto-Detected Bills').then(function(ok){
    if (!ok) return;
    _billSuggestQueue = suggestions.map(function(k){
      return { name: _titleCase(k), amount: amts[k]||0, frequency:'Monthly', category: catHints[k]||'other', sourceDesc: k };
    });
    _billSuggestNext();
  });
}

function _billSuggestNext() {
  if (!_billSuggestQueue.length) {
    hhToast('All suggestions reviewed!', '✅');
    return;
  }
  var next = _billSuggestQueue.shift();
  // Add skip button label to title so user knows there are more
  var remaining = _billSuggestQueue.length;
  next._queueRemaining = remaining;
  openBillModal(next);
  // Update modal title to show progress
  var titleEl = document.getElementById('bill-modal-title');
  if (titleEl) titleEl.textContent = '🧾 Add Bill' + (remaining > 0 ? ' (' + (remaining+1) + ' remaining)' : '');
  // Add a Skip button temporarily if not already there
  var footer = document.querySelector('#bill-modal .modal-footer');
  if (footer && !document.getElementById('bill-suggest-skip-btn')) {
    var skipBtn = document.createElement('button');
    skipBtn.id = 'bill-suggest-skip-btn';
    skipBtn.className = 'btn btn-ghost';
    skipBtn.textContent = 'Skip →';
    skipBtn.onclick = function() { closeModal('bill-modal'); _billSuggestNext(); };
    footer.insertBefore(skipBtn, footer.firstChild);
  }
}

function _billSuggestCleanup() {
  // Remove the skip button after queue is done
  var skipBtn = document.getElementById('bill-suggest-skip-btn');
  if (skipBtn) skipBtn.remove();
}

function _titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, function(c){ return c.toUpperCase(); });
}

// NET WORTH TIMELINE
var _nwChartInstance = null;
var _nwRange = 12;

function setNWRange(n, btn) {
  _nwRange = n;
  document.querySelectorAll('.toggle-btn[id^="nw-range-"]').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  _renderNWChart();
}

function calcCurrentNetWorth() {
  var accounts = state.accounts || [];
  var totalAssets = 0, totalDebts = 0;
  accounts.forEach(function(a) {
    var isDebt = !!ACCT_IS_DEBT[a.type];
    var allTxns = state.transactions.filter(function(t){ return t.account === a.id && !t.isOpeningBalance; });
    var sb = state.startingBalances[a.id] || null;
    var hasStartingBalance = sb && sb.amount != null && sb.date;
    var balance;
    if (hasStartingBalance) {
      // Use toISO() to normalise dates — matches authoritative calcBalance exactly
      var filtered = allTxns.filter(function(t){ return toISO(t.date||'') > sb.date; });
      var txnSum = filtered.reduce(function(s,t){ return s+(parseFloat(t.amount)||0); }, 0);
      balance = isDebt ? parseFloat(sb.amount) - txnSum : parseFloat(sb.amount) + txnSum;
    } else {
      var txnSum2 = allTxns.reduce(function(s,t){ return s+(parseFloat(t.amount)||0); }, 0);
      balance = isDebt ? -txnSum2 : txnSum2;
    }
    if (isDebt) totalDebts += Math.max(0, balance);
    else totalAssets += balance;
  });
  // Add manual assets/liabilities
  (state.manualAssets||[]).forEach(function(a){
    if (a.isDebt) totalDebts += (a.value||0);
    else totalAssets += (a.value||0);
  });
  // Car fund savings count as assets (real saved cash toward a vehicle goal).
  // Only add the manually-entered savedAmount + categorized txn contributions —
  // NOT double-counted if the money already sits in a tracked bank account.
  (state.carFunds||[]).forEach(function(c){
    var saved = (c.savedAmount||0) + getCarFundContributions(c.id);
    if (saved > 0) totalAssets += saved;
  });
  return { assets: totalAssets, debts: totalDebts, netWorth: totalAssets - totalDebts };
}

function takeNetWorthSnapshot(manual) {
  var mk = getCurrentMonthKey();
  var existing = (state.netWorthHistory||[]).findIndex(function(s){ return s.date === mk; });
  var snap = calcCurrentNetWorth();
  snap.date = mk;
  if (!state.netWorthHistory) state.netWorthHistory = [];
  if (existing >= 0) {
    state.netWorthHistory[existing] = snap;
  } else {
    state.netWorthHistory.push(snap);
    state.netWorthHistory.sort(function(a,b){ return a.date.localeCompare(b.date); });
  }
  saveState();
  if (manual) { hhToast('Snapshot saved for ' + mk + '!', '📸'); renderNetWorth(); renderDashboard(); }
}

function _renderNWChart() {
  var history = state.netWorthHistory || [];
  var canvas = document.getElementById('nw-chart');
  var empty  = document.getElementById('nw-chart-empty');
  if (!canvas) return;
  var data = _nwRange > 0 ? history.slice(-_nwRange) : history;
  if (!data.length) {
    canvas.style.display = 'none';
    if (empty) empty.style.display = '';
    return;
  }
  canvas.style.display = '';
  if (empty) empty.style.display = 'none';
  if (_nwChartInstance) { try { _nwChartInstance.destroy(); } catch(e){} _nwChartInstance = null; }
  var mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var labels  = data.map(function(s){ var p=s.date.split('-'); return mNames[parseInt(p[1])-1]+' '+p[0]; });
  var nwVals  = data.map(function(s){ return s.netWorth; });
  var aVals   = data.map(function(s){ return s.assets; });
  var dVals   = data.map(function(s){ return s.debts; });
  _nwChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label:'Net Worth', data:nwVals, borderColor:'rgba(94,190,140,1)',    backgroundColor:'rgba(94,190,140,0.12)', borderWidth:2.5, pointRadius:3, fill:true, tension:0.3 },
        { label:'Assets',   data:aVals,  borderColor:'rgba(108,142,191,0.8)', backgroundColor:'transparent',           borderWidth:1.5, pointRadius:2, fill:false, tension:0.3, borderDash:[4,3] },
        { label:'Debts',    data:dVals,  borderColor:'rgba(220,80,80,0.7)',   backgroundColor:'transparent',           borderWidth:1.5, pointRadius:2, fill:false, tension:0.3, borderDash:[4,3] },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ labels:{ color:'#888', font:{size:11} } },
        tooltip:{ callbacks:{ label:function(ctx){ return ctx.dataset.label+': $'+ctx.parsed.y.toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0}); } } }
      },
      scales:{
        x:{ ticks:{ color:'#888', font:{size:10}, maxTicksLimit:12 }, grid:{ display:false } },
        y:{ ticks:{ color:'#888', font:{size:10}, callback:function(v){ return '$'+(Math.abs(v)>=1000?(v/1000).toFixed(0)+'k':v); } }, grid:{ color:'rgba(128,128,128,0.1)' } }
      }
    }
  });
}

