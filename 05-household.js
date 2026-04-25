function renderNetWorth() {
  // Auto-snapshot on page load if none this month
  takeNetWorthSnapshot(false);
  var history = state.netWorthHistory || [];
  var prev = history.length >= 2 ? history[history.length-2] : null;

  // Chart
  _renderNWChart();

  // Assets breakdown — compute total from the same values shown in the list
  var accounts = state.accounts || [];
  var assetAccts = accounts.filter(function(a){ return !ACCT_IS_DEBT[a.type]; });
  var debtAccts  = accounts.filter(function(a){ return  ACCT_IS_DEBT[a.type]; });

  function getAcctBalance(a) {
    var isDebt = !!ACCT_IS_DEBT[a.type];
    var allTxns = state.transactions.filter(function(t){ return t.account===a.id && !t.isOpeningBalance; });
    var sb = state.startingBalances[a.id]||null;
    if (sb && sb.amount!=null && sb.date) {
      var ts = allTxns.filter(function(t){ return toISO(t.date||'')>sb.date; }).reduce(function(s,t){return s+(parseFloat(t.amount)||0);},0);
      return isDebt ? parseFloat(sb.amount)-ts : parseFloat(sb.amount)+ts;
    }
    var ts2 = allTxns.reduce(function(s,t){return s+(parseFloat(t.amount)||0);},0);
    return isDebt ? -ts2 : ts2;
  }

  // Compute totals from breakdown line items — single source of truth
  var displayAssets = 0;
  var assetLines = assetAccts.map(function(a){ var b = getAcctBalance(a); displayAssets += b; return { name: a.nickname, value: b }; });
  (state.manualAssets||[]).filter(function(a){return !a.isDebt;}).forEach(function(a){ displayAssets += (a.value||0); });

  var displayDebts = 0;
  var debtLines = debtAccts.map(function(a){ var b = Math.max(0, getAcctBalance(a)); displayDebts += b; return { name: a.nickname, value: b }; });
  (state.manualAssets||[]).filter(function(a){return a.isDebt;}).forEach(function(a){ displayDebts += (a.value||0); });

  var displayNetWorth = displayAssets - displayDebts;
  var change = prev ? displayNetWorth - prev.netWorth : null;
  var changePct = (prev && prev.netWorth !== 0) ? ((displayNetWorth - prev.netWorth)/Math.abs(prev.netWorth)*100).toFixed(1) : null;

  // Overwrite stats with the consistent breakdown-derived numbers
  document.getElementById('nw-stats').innerHTML =
    '<div class="stat"><div class="stat-label">Net Worth</div><div class="stat-value" style="color:'+(displayNetWorth>=0?'var(--green)':'var(--red)')+'">'+fmt(displayNetWorth)+'</div></div>' +
    '<div class="stat"><div class="stat-label">Total Assets</div><div class="stat-value clr-accent">'+fmt(displayAssets)+'</div></div>' +
    '<div class="stat"><div class="stat-label">Total Debts</div><div class="stat-value" style="color:var(--red)">'+fmt(displayDebts)+'</div></div>' +
    '<div class="stat"><div class="stat-label">vs Last Month</div><div class="stat-value" style="color:'+(change===null?'var(--muted)':change>=0?'var(--green)':'var(--red)')+'">'+
      (change===null?'—':(change>=0?'+':'')+fmt(change))+'</div>'+
      (changePct!==null?'<div class="stat-sub">'+(change>=0?'+':'')+changePct+'%</div>':'')+'</div>';

  var assetsHtml = '<div class="card" style="margin-bottom:0"><div class="card-title">💰 Assets</div><div style="display:flex;flex-direction:column;gap:6px">';
  assetLines.forEach(function(line){
    assetsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface);border-radius:8px">' +
      '<span style="font-size:13px;font-weight:600">'+line.name+'</span>' +
      '<span style="font-weight:800;color:'+(line.value>=0?'var(--green)':'var(--red)')+'">'+fmt(line.value)+'</span></div>';
  });
  (state.manualAssets||[]).filter(function(a){return !a.isDebt;}).forEach(function(a){
    assetsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface);border-radius:8px">' +
      '<span style="font-size:13px;font-weight:600">'+a.name+' <span style="font-size:10px;color:var(--muted);background:var(--border);padding:1px 5px;border-radius:8px">manual</span></span>' +
      '<div style="display:flex;gap:6px;align-items:center"><span style="font-weight:800;color:var(--green)">'+fmt(a.value||0)+'</span>' +
      '<button class="btn btn-danger btn-sm" onclick="deleteManualAsset(\''+a.id+'\')">🗑️</button></div></div>';
  });
  if (!assetLines.length && !(state.manualAssets||[]).filter(function(a){return !a.isDebt;}).length)
    assetsHtml += '<div style="color:var(--muted);font-size:13px;padding:8px 0">No asset accounts yet.</div>';
  // Car funds — shown as auto-assets with a 🚗 tag
  (state.carFunds||[]).forEach(function(c){
    var saved = (c.savedAmount||0) + getCarFundContributions(c.id);
    if (saved <= 0) return;
    displayAssets += saved;
    assetsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface);border-radius:8px">' +
      '<span style="font-size:13px;font-weight:600">'+(c.emoji||'🚗')+' '+c.name+' <span style="font-size:10px;color:var(--muted);background:var(--border);padding:1px 5px;border-radius:8px">car fund</span></span>' +
      '<span style="font-weight:800;color:var(--green)">'+fmt(saved)+'</span></div>';
  });
  assetsHtml += '<div style="display:flex;justify-content:space-between;padding:10px 12px;margin-top:4px;background:color-mix(in srgb,var(--green) 8%,var(--card));border-radius:8px;border:1px solid color-mix(in srgb,var(--green) 25%,transparent)"><span style="font-weight:800">Total Assets</span><span style="font-weight:900;color:var(--green)">'+fmt(displayAssets)+'</span></div>';
  assetsHtml += '</div></div>';
  document.getElementById('nw-assets-card').innerHTML = assetsHtml;

  var debtsHtml = '<div class="card" style="margin-bottom:0"><div class="card-title">💳 Debts & Liabilities</div><div style="display:flex;flex-direction:column;gap:6px">';
  debtLines.forEach(function(line){
    debtsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface);border-radius:8px">' +
      '<span style="font-size:13px;font-weight:600">'+line.name+'</span>' +
      '<span style="font-weight:800;color:var(--red)">'+fmt(line.value)+'</span></div>';
  });
  (state.manualAssets||[]).filter(function(a){return a.isDebt;}).forEach(function(a){
    debtsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface);border-radius:8px">' +
      '<span style="font-size:13px;font-weight:600">'+a.name+' <span style="font-size:10px;color:var(--muted);background:var(--border);padding:1px 5px;border-radius:8px">manual</span></span>' +
      '<div style="display:flex;gap:6px;align-items:center"><span style="font-weight:800;color:var(--red)">'+fmt(a.value||0)+'</span>' +
      '<button class="btn btn-danger btn-sm" onclick="deleteManualAsset(\''+a.id+'\')">🗑️</button></div></div>';
  });
  if (!debtLines.length && !(state.manualAssets||[]).filter(function(a){return a.isDebt;}).length)
    debtsHtml += '<div style="color:var(--muted);font-size:13px;padding:8px 0">No debt accounts yet.</div>';
  debtsHtml += '<div style="display:flex;justify-content:space-between;padding:10px 12px;margin-top:4px;background:color-mix(in srgb,var(--red) 8%,var(--card));border-radius:8px;border:1px solid color-mix(in srgb,var(--red) 25%,transparent)"><span style="font-weight:800">Total Debts</span><span style="font-weight:900;color:var(--red)">'+fmt(displayDebts)+'</span></div>';
  debtsHtml += '</div></div>';
  document.getElementById('nw-debts-card').innerHTML = debtsHtml;

  // Manual assets info card
  document.getElementById('nw-manual-card').innerHTML = '<div class="alert alert-info">💡 <strong>Manual Assets</strong> — Add items not tracked via bank statements: pension estimated value, car market value, FHSA balance, investments, rental property, etc. Click <strong>+ Manual Asset</strong> above.</div>';

  // History table
  var histRows = history.slice().reverse().map(function(s, i, arr){
    var prevS = arr[i+1];
    var chg = prevS ? s.netWorth - prevS.netWorth : null;
    var mns = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var parts = s.date.split('-');
    var label = mns[parseInt(parts[1])-1] + ' ' + parts[0];
    return '<tr>' +
      '<td style="font-weight:700">'+label+'</td>' +
      '<td style="color:var(--green)">'+fmt(s.assets)+'</td>' +
      '<td style="color:var(--red)">'+fmt(s.debts)+'</td>' +
      '<td style="font-weight:900;color:'+(s.netWorth>=0?'var(--green)':'var(--red)')+'">'+fmt(s.netWorth)+'</td>' +
      '<td style="color:'+(chg===null?'var(--muted)':chg>=0?'var(--green)':'var(--red)')+'">'+
        (chg===null?'—':(chg>=0?'+':'')+fmt(chg))+'</td>' +
      '<td><button class="btn btn-danger btn-sm" onclick="deleteNWSnapshot(\''+s.date+'\')">🗑️</button></td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No snapshots yet — click 📸 Snapshot Now to record your first one.</td></tr>';
  document.getElementById('nw-history-tbody').innerHTML = histRows;
}

function deleteNWSnapshot(date) {
  hhConfirm('Remove snapshot for '+date+'?','🗑️','Remove').then(function(ok){
    if (!ok) return;
    state.netWorthHistory = (state.netWorthHistory||[]).filter(function(s){ return s.date!==date; });
    saveState(); renderNetWorth();
  });
}

function openManualAssetModal() {
  document.getElementById('ma-edit-id').value = '';
  document.getElementById('ma-name').value = '';
  document.getElementById('ma-value').value = '';
  document.getElementById('ma-isdebt').checked = false;
  document.getElementById('ma-notes').value = '';
  openModal('manual-asset-modal');
}

function saveManualAsset() {
  var name = document.getElementById('ma-name').value.trim();
  if (!name) { hhToast('Please enter a name.','⚠️'); return; }
  var editId = document.getElementById('ma-edit-id').value;
  var a = { id: editId||uid(), name:name, value:parseFloat(document.getElementById('ma-value').value)||0, isDebt:document.getElementById('ma-isdebt').checked, notes:document.getElementById('ma-notes').value.trim() };
  if (!state.manualAssets) state.manualAssets=[];
  if (editId) { var idx=state.manualAssets.findIndex(function(x){return x.id===editId;}); if(idx>=0)state.manualAssets[idx]=a; else state.manualAssets.push(a); }
  else state.manualAssets.push(a);
  saveState(); closeModal('manual-asset-modal');
  takeNetWorthSnapshot(false); // re-snapshot with new values
  renderNetWorth(); renderDashboard();
  hhToast('Asset saved!','💰');
}

function deleteManualAsset(id) {
  hhConfirm('Remove this asset?','🗑️','Remove').then(function(ok){
    if (!ok) return;
    state.manualAssets=(state.manualAssets||[]).filter(function(a){return a.id!==id;});
    saveState(); renderNetWorth(); renderDashboard();
  });
}


// CAR FUND TRACKER ─────────────────────────────────────────────────────────

var _carModalId = null; // null = new, else edit id

function uid6() { return Math.random().toString(36).slice(2,8); }

function openCarModal(id) {
  _carModalId = id || null;
  var fund = id ? (state.carFunds||[]).find(function(c){return c.id===id;}) : null;
  document.getElementById('car-modal-title').textContent = fund ? 'Edit Vehicle Goal' : 'Add Vehicle Goal';
  document.getElementById('car-name').value         = fund ? fund.name           : '';
  document.getElementById('car-emoji').value        = fund ? fund.emoji          : '🚗';
  document.getElementById('car-target').value       = fund ? fund.targetPrice    : '';
  document.getElementById('car-saved').value        = fund ? fund.savedAmount    : '';
  document.getElementById('car-monthly').value      = fund ? fund.monthlyContrib : '';
  document.getElementById('car-color').value        = fund ? (fund.color||'#4f8ef7') : '#4f8ef7';
  document.getElementById('car-notes').value        = fund ? (fund.notes||'')    : '';
  // Financing fields
  var fin = fund ? !!fund.financing : false;
  document.getElementById('car-financing-toggle').checked = fin;
  document.getElementById('car-down').value         = fund ? (fund.downPayment||'')   : '';
  document.getElementById('car-tradein').value      = fund ? (fund.tradeIn||'')       : '';
  document.getElementById('car-rate').value         = fund ? (fund.interestRate||'')  : '';
  document.getElementById('car-term').value         = fund ? (fund.loanTerm||60)      : 60;
  toggleCarFinancing();
  openModal('car-modal');
}

function toggleCarFinancing() {
  var on = document.getElementById('car-financing-toggle').checked;
  document.getElementById('car-financing-fields').style.display = on ? '' : 'none';
  document.getElementById('car-saved-label').textContent = on ? 'Down Payment Saved ($)' : 'Already Saved ($)';
  document.getElementById('car-monthly-hint').textContent = on
    ? 'Used to project when you reach your down payment target.'
    : 'Used to project your purchase date.';
}

function saveCarFund() {
  var name    = document.getElementById('car-name').value.trim();
  var emoji   = document.getElementById('car-emoji').value.trim() || '🚗';
  var target  = parseFloat(document.getElementById('car-target').value)  || 0;
  var saved   = parseFloat(document.getElementById('car-saved').value)   || 0;
  var monthly = parseFloat(document.getElementById('car-monthly').value) || 0;
  var color   = document.getElementById('car-color').value || '#4f8ef7';
  var notes   = document.getElementById('car-notes').value.trim();
  var fin     = document.getElementById('car-financing-toggle').checked;
  var down    = parseFloat(document.getElementById('car-down').value)    || 0;
  var tradein = parseFloat(document.getElementById('car-tradein').value) || 0;
  var rate    = parseFloat(document.getElementById('car-rate').value)    || 0;
  var term    = parseInt(document.getElementById('car-term').value)      || 60;
  if (!name)   { hhAlert('Please enter a vehicle name.','⚠️'); return; }
  if (!target) { hhAlert('Please enter a target price.','⚠️'); return; }
  if (fin && down <= 0) { hhAlert('Please enter a down payment amount for financing.','⚠️'); return; }
  var record = { name:name, emoji:emoji, targetPrice:target, savedAmount:saved, monthlyContrib:monthly, color:color, notes:notes,
    financing:fin, downPayment:fin?down:0, tradeIn:fin?tradein:0, interestRate:fin?rate:0, loanTerm:fin?term:60 };
  if (!state.carFunds) state.carFunds = [];
  if (_carModalId) {
    var idx = state.carFunds.findIndex(function(c){return c.id===_carModalId;});
    if (idx > -1) state.carFunds[idx] = Object.assign(state.carFunds[idx], record);
  } else {
    state.carFunds.push(Object.assign({ id:uid6(), createdAt:new Date().toISOString() }, record));
  }
  saveState();
  closeModal('car-modal');
  renderCarFunds();
  renderDashboard();
  hhToast((_carModalId?'Updated ':'Added ')+emoji+' '+name,'🚗');
}

function deleteCarFund(id) {
  hhConfirm('Delete this vehicle goal? This cannot be undone.','🗑️','Delete Vehicle Goal').then(function(ok) {
    if (!ok) return;
    state.carFunds = (state.carFunds||[]).filter(function(c){return c.id!==id;});
    saveState();
    renderCarFunds();
    renderDashboard();
    hhToast('Vehicle goal removed','🗑️');
  });
}

function addCarSavings(id) {
  var fund = (state.carFunds||[]).find(function(c){return c.id===id;});
  if (!fund) return;
  var amtStr = prompt('Add savings to ' + (fund.emoji||'🚗') + ' ' + fund.name + ':\nEnter amount to add (e.g. 500):');
  if (amtStr === null) return;
  var amt = parseFloat(amtStr);
  if (isNaN(amt) || amt <= 0) { hhAlert('Please enter a valid positive amount.','⚠️'); return; }
  fund.savedAmount = (fund.savedAmount||0) + amt;
  saveState();
  renderCarFunds();
  renderDashboard();
  hhToast('+$'+amt.toLocaleString()+' added to '+fund.name,'💰');
}

function calcCarPayment(principal, annualRate, termMonths) {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / termMonths;
  var r = (annualRate / 100) / 12;
  return principal * (r * Math.pow(1+r, termMonths)) / (Math.pow(1+r, termMonths) - 1);
}

function renderCarFunds() {
  var funds = state.carFunds || [];
  var listEl    = document.getElementById('cars-list');
  var emptyEl   = document.getElementById('cars-empty');
  var summaryEl = document.getElementById('cars-summary-bar');
  var tipsCard  = document.getElementById('cars-tips-card');
  var tipsBody  = document.getElementById('cars-tips-body');
  if (!listEl) return;

  if (!funds.length) {
    listEl.innerHTML = '';
    if (emptyEl)   emptyEl.style.display  = '';
    if (summaryEl) summaryEl.innerHTML    = '';
    if (tipsCard)  tipsCard.style.display = 'none';
    return;
  }
  if (emptyEl)  emptyEl.style.display  = 'none';
  if (tipsCard) tipsCard.style.display = '';

  // Summary bar — track progress toward down payment (financing) or full price (cash)
  var totalSaved = funds.reduce(function(s,c){return s+(c.savedAmount||0);},0);
  var totalGoal  = funds.reduce(function(s,c){return s+(c.financing?(c.downPayment||0):(c.targetPrice||0));},0);
  var pct = totalGoal>0 ? Math.min(100,Math.round(totalSaved/totalGoal*100)) : 0;
  if (summaryEl) {
    summaryEl.innerHTML = '<div class="card" style="padding:14px 18px">'
      +'<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'
      +'<div><div style="font-size:22px;font-weight:900;color:var(--green)">'+fmt(totalSaved)+'</div><div style="font-size:11px;color:var(--muted)">Total Saved</div></div>'
      +'<div><div style="font-size:22px;font-weight:900;color:var(--text)">'+fmt(totalGoal)+'</div><div style="font-size:11px;color:var(--muted)">Combined Goal</div></div>'
      +'<div><div style="font-size:22px;font-weight:900;color:var(--accent)">'+pct+'%</div><div style="font-size:11px;color:var(--muted)">Overall Progress</div></div>'
      +'<div style="flex:1;min-width:120px"><div style="background:var(--bg);border-radius:6px;height:10px;overflow:hidden">'
      +'<div style="height:100%;width:'+pct+'%;background:var(--accent);border-radius:6px;transition:width .5s"></div></div></div>'
      +'</div></div>';
  }

  var HST = 0.13;
  var now = new Date();

  listEl.innerHTML = funds.map(function(fund) {
    var manualSaved = fund.savedAmount    || 0;
    var txnContrib  = getCarFundContributions(fund.id);
    var saved   = manualSaved + txnContrib;
    var target  = fund.targetPrice    || 0;
    var monthly = fund.monthlyContrib || 0;
    var color   = fund.color   || '#4f8ef7';
    var emoji   = fund.emoji   || '\u{1F697}';
    var fin     = !!fund.financing;
    var down    = fund.downPayment  || 0;
    var tradein = fund.tradeIn      || 0;
    var rate    = fund.interestRate || 0;
    var term    = fund.loanTerm     || 60;
    var hst     = Math.round(target * HST);
    var priceWithTax = target + hst;
    var html = '';

    if (!fin) {
      // ── CASH ──────────────────────────────────────────────────────────────
      var rem     = Math.max(0, target - saved);
      var pctF    = target > 0 ? Math.min(100, Math.round(saved/target*100)) : 0;
      var projStr = '';
      if (monthly > 0 && rem > 0) {
        var mo = Math.ceil(rem/monthly);
        var td = new Date(now.getFullYear(), now.getMonth()+mo, 1);
        projStr = td.toLocaleDateString('en-CA',{month:'long',year:'numeric'});
      } else if (rem <= 0) { projStr = 'Ready to buy! \u{1F389}'; }
      var n12=rem>0?Math.ceil(rem/12):0, n24=rem>0?Math.ceil(rem/24):0, n36=rem>0?Math.ceil(rem/36):0;
      var sc = pctF>=100?'var(--green)':pctF>=50?'var(--yellow)':'var(--accent)';
      html = _carHeader(fund,emoji,color,false)
        + _carBar(saved,target,pctF,sc,color,'saved','goal')
        + (txnContrib > 0 ? '<div style="font-size:12px;color:var(--green);margin-bottom:10px">✅ ' + fmt(txnContrib) + ' from linked transactions  +  ' + fmt(manualSaved) + ' manual</div>' : '')
        + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px">'
        + _cstat(fmt(rem),'Still Needed')
        + _cstat(monthly>0?fmt(monthly):'-','Monthly Contribution')
        + (projStr?_cstat(projStr,'Projected Date','var(--accent)'):'')
        + _cstat(fmt(hst),'HST (13%) Est.')
        + _cstat(fmt(priceWithTax),'Total Cost w/ Tax')
        + '</div>'
        + (rem>0
          ? '<div style="font-size:12px;color:var(--muted);padding:10px 12px;background:var(--bg);border-radius:8px">'
            +'<strong>To save the remaining '+fmt(rem)+':</strong> '
            +'<span style="color:var(--text);font-weight:700">'+fmt(n12)+'/mo</span> in 1 yr \u00b7 '
            +'<span style="color:var(--text);font-weight:700">'+fmt(n24)+'/mo</span> in 2 yrs \u00b7 '
            +'<span style="color:var(--text);font-weight:700">'+fmt(n36)+'/mo</span> in 3 yrs'
            +'<br><span style="color:var(--accent)">\u{1F4A1} Keep this fund in a TFSA \u2014 withdrawals are tax-free.</span></div>'
          : '<div style="font-size:12px;color:var(--green);padding:8px 12px;background:color-mix(in srgb,var(--green) 10%,transparent);border-radius:8px;font-weight:700">'
            +'\u2705 Goal reached! Budget for total cost with HST: '+fmt(priceWithTax)+'</div>');

    } else {
      // ── FINANCING ─────────────────────────────────────────────────────────
      var effective   = priceWithTax - tradein;
      var principal   = Math.max(0, effective - down);
      var payment     = calcCarPayment(principal, rate, term);
      var totalInt    = Math.max(0, (payment * term) - principal);
      var totalCost   = down + (payment * term);
      var downPct     = target>0?Math.round(down/target*100):0;
      var remDown     = Math.max(0, down - saved);
      var pctDown     = down>0?Math.min(100,Math.round(saved/down*100)):100;
      var projStr     = '';
      if (monthly>0 && remDown>0) {
        var moD = Math.ceil(remDown/monthly);
        var tdD = new Date(now.getFullYear(), now.getMonth()+moD, 1);
        projStr = tdD.toLocaleDateString('en-CA',{month:'long',year:'numeric'});
      } else if (remDown<=0) { projStr = 'Down payment ready! \u{1F389}'; }
      var nd12=remDown>0?Math.ceil(remDown/12):0, nd24=remDown>0?Math.ceil(remDown/24):0, nd36=remDown>0?Math.ceil(remDown/36):0;
      var sc2 = pctDown>=100?'var(--green)':pctDown>=50?'var(--yellow)':'var(--accent)';
      html = _carHeader(fund,emoji,color,true)
        + '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Down Payment Progress</div>'
        + _carBar(saved,down,pctDown,sc2,color,'saved toward down payment','down payment target')
        + (txnContrib > 0 ? '<div style="font-size:12px;color:var(--green);margin-bottom:10px">✅ ' + fmt(txnContrib) + ' from linked transactions  +  ' + fmt(manualSaved) + ' manual</div>' : '')
        + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px">'
        + _cstat(fmt(down),'Down Payment ('+(downPct>0?downPct+'%':'--')+')')
        + (tradein>0?_cstat(fmt(tradein),'Trade-In Value'):'')
        + _cstat(fmt(principal),'Amount Financed')
        + _cstat(fmt(payment)+'/mo','Est. Monthly Payment','var(--accent)')
        + _cstat(rate>0?(rate+'%'):'0%','Interest Rate')
        + _cstat((term/12).toFixed(1)+' yrs ('+term+' mo)','Loan Term')
        + _cstat(fmt(totalInt),'Total Interest Paid',rate>0?'var(--red)':'var(--muted)')
        + _cstat(fmt(totalCost),'Total Cost (all-in)','var(--text)')
        + (projStr?_cstat(projStr,'Down Payment Date','var(--accent)'):'')
        + '</div>'
        + '<div style="font-size:12px;padding:10px 14px;background:var(--bg);border-radius:8px">'
        + '<strong>\u{1F4B3} Financing Summary</strong><br>'
        + fmt(target)+' sticker + '+fmt(hst)+' HST'+(tradein>0?' \u2212 '+fmt(tradein)+' trade-in':'')+' = <strong>'+fmt(effective)+'</strong><br>'
        + 'Down: <strong>'+fmt(down)+'</strong> \u2192 Loan: <strong>'+fmt(principal)+'</strong> at <strong>'+(rate||0)+'%</strong> / <strong>'+term+' mo</strong><br>'
        + 'Payment: <strong style="color:var(--accent)">'+fmt(payment)+'/mo</strong> \u00b7 Interest: <strong style="color:'+(rate>0?'var(--red)':'var(--muted)')+'">'+fmt(totalInt)+'</strong>'
        + (remDown>0
          ? '<br><br><strong>To reach your '+fmt(down)+' down payment:</strong> '
            +'<span style="color:var(--text);font-weight:700">'+fmt(nd12)+'/mo</span> in 1 yr \u00b7 '
            +'<span style="color:var(--text);font-weight:700">'+fmt(nd24)+'/mo</span> in 2 yrs \u00b7 '
            +'<span style="color:var(--text);font-weight:700">'+fmt(nd36)+'/mo</span> in 3 yrs'
            +'<br><span style="color:var(--accent)">\u{1F4A1} Save your down payment in a TFSA \u2014 tax-free growth and easy withdrawal.</span>'
          : '<br><span style="color:var(--green);font-weight:700">\u2705 Down payment saved \u2014 you\'re ready to finance!</span>')
        + '</div>';
    }

    return '<div class="card" style="margin-bottom:14px;border-left:4px solid '+color+'">' + html + '</div>';
  }).join('');

  // Ontario tips panel
  if (tipsBody) {
    tipsBody.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">'
      +'<div style="padding:10px 12px;background:var(--bg);border-radius:8px"><strong>\u{1F3F7}\uFE0F Ontario HST vs RST</strong><br>Dealer: 13% HST. Private sale: 8% RST only. Buying private can save thousands \u2014 but budget the RST regardless.</div>'
      +'<div style="padding:10px 12px;background:var(--bg);border-radius:8px"><strong>\u{1F3E6} TFSA for Down Payment</strong><br>Tax-free growth and withdrawals make a TFSA ideal for your down payment. Room is restored Jan 1 the year after withdrawal.</div>'
      +'<div style="padding:10px 12px;background:var(--bg);border-radius:8px"><strong>\u{1F4B3} Down Payment Rule</strong><br>A larger down payment reduces your loan and total interest. Aiming for 20%+ keeps payments manageable and avoids high-ratio financing fees.</div>'
      +'<div style="padding:10px 12px;background:var(--bg);border-radius:8px"><strong>\u{1F50D} UVIP Required</strong><br>Get a Used Vehicle Information Package (~$20 at ServiceOntario) for any private purchase. Shows lien history, past accidents, and ownership.</div>'
      +'<div style="padding:10px 12px;background:var(--bg);border-radius:8px"><strong>\u{1F4CB} Transfer Costs</strong><br>Budget ~$32 for ownership transfer at ServiceOntario. You can transfer existing plates. DriveON safety certificate required to license.</div>'
      +'<div style="padding:10px 12px;background:var(--bg);border-radius:8px"><strong>\u{1F697} Insurance Tip</strong><br>Get quotes before buying \u2014 Ontario rates vary widely by make/model. A sportier or newer car can cost 40\u201360% more to insure.</div>'
      +'</div>';
  }
}

function _carHeader(fund, emoji, color, isFinancing) {
  return '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'
    +'<div style="display:flex;align-items:center;gap:10px">'
    +'<div style="font-size:32px">'+emoji+'</div>'
    +'<div><div style="font-size:17px;font-weight:800;color:var(--text)">'+fund.name
    +(isFinancing?' <span style="font-size:11px;font-weight:600;color:var(--accent);background:color-mix(in srgb,var(--accent) 15%,transparent);padding:2px 7px;border-radius:20px;vertical-align:middle">Financing</span>':'')
    +'</div>'
    +(fund.notes?'<div style="font-size:12px;color:var(--muted)">'+fund.notes+'</div>':'')
    +'</div></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button class="btn btn-primary btn-sm" onclick="addCarSavings(\''+fund.id+'\')">+ Add Savings</button>'
    +'<button class="btn btn-ghost btn-sm" onclick="openCarModal(\''+fund.id+'\')">&#x270F;&#xFE0F; Edit</button>'
    +'<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteCarFund(\''+fund.id+'\')">&#x1F5D1;&#xFE0F;</button>'
    +'</div></div>';
}
function _carBar(saved, goal, pct, statusColor, barColor, labelL, labelR) {
  return '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px">'
    +'<span>'+fmt(saved)+' '+labelL+'</span>'
    +'<span style="font-weight:700;color:'+statusColor+'">'+pct+'%</span>'
    +'<span>'+fmt(goal)+' '+labelR+'</span></div>'
    +'<div style="background:var(--bg);border-radius:6px;height:10px;overflow:hidden;margin-bottom:14px">'
    +'<div style="height:100%;width:'+pct+'%;background:'+barColor+';border-radius:6px;transition:width .5s"></div></div>';
}
function _cstat(val, label, valColor) {
  return '<div style="background:var(--bg);border-radius:8px;padding:10px 12px">'
    +'<div style="font-size:15px;font-weight:800;color:'+(valColor||'var(--text)')+'">'+val+'</div>'
    +'<div style="font-size:11px;color:var(--muted)">'+label+'</div></div>';
}


// HOUSEHOLD MAINTENANCE ──────────────────────────────────────────────────────

var _maintModalId = null;

var MAINT_CATEGORIES = ['Seasonal','Monthly','Appliances','Exterior','Safety','Plumbing','Other'];

var MAINT_PRESETS = [
  { name:'Change Furnace Filter',      emoji:'🌬️', category:'Appliances', intervalDays:90,  notes:'Check brand recommendation — 1" filters typically 1–3 months' },
  { name:'Test Smoke Detectors',       emoji:'🔥', category:'Safety',     intervalDays:180, notes:'Press test button on each unit' },
  { name:'Test Carbon Monoxide Alarm', emoji:'☁️', category:'Safety',     intervalDays:180, notes:'Replace batteries while you\'re at it' },
  { name:'Clean Dryer Vent',           emoji:'🌀', category:'Appliances', intervalDays:365, notes:'Lint buildup is a leading cause of house fires' },
  { name:'Check Fire Extinguisher',    emoji:'🧯', category:'Safety',     intervalDays:365, notes:'Check pressure gauge is in green zone' },
  { name:'Clean Range Hood Filter',    emoji:'🍳', category:'Appliances', intervalDays:90,  notes:'Soak in hot soapy water or run in dishwasher' },
  { name:'Check Door & Window Caulking', emoji:'🏠', category:'Exterior', intervalDays:365, notes:'Inspect for cracks or gaps — prevents drafts and water damage' },
  { name:'Reverse Ceiling Fans',       emoji:'💨', category:'Seasonal',   intervalDays:180, notes:'Clockwise in winter (pushes warm air down), counterclockwise in summer' },
  { name:'Clean Gutters',              emoji:'🍂', category:'Exterior',   intervalDays:180, notes:'Spring and fall — prevents water damage to foundation' },
  { name:'Flush Water Heater',         emoji:'🚿', category:'Plumbing',   intervalDays:365, notes:'Removes sediment — improves efficiency and extends life' },
  { name:'Check & Clean Fridge Coils', emoji:'❄️', category:'Appliances', intervalDays:365, notes:'Pull fridge out and vacuum coils underneath or at back' },
  { name:'Deep Clean Oven',            emoji:'🧹', category:'Appliances', intervalDays:180, notes:'Use self-clean cycle or manual clean with baking soda paste' },
  { name:'Inspect Roof & Attic',       emoji:'🏡', category:'Exterior',   intervalDays:365, notes:'Look for missing shingles, water stains, or signs of pests' },
  { name:'Service Lawn Mower',         emoji:'🌿', category:'Seasonal',   intervalDays:365, notes:'Oil change, sharpen blade, fresh fuel before season' },
  { name:'Bleed Radiators / Baseboard Heaters', emoji:'🌡️', category:'Seasonal', intervalDays:365, notes:'Do this before heating season starts in fall' },
];

function getMaintenanceNextDue(task) {
  var d = new Date();
  d.setHours(0,0,0,0);
  if (!task.lastDone) return d; // never done = due now
  var last = new Date(task.lastDone + 'T00:00:00');
  last.setHours(0,0,0,0);
  last.setDate(last.getDate() + (task.intervalDays || 365));
  return last;
}

function getMaintenanceDaysUntil(task) {
  var today = new Date(); today.setHours(0,0,0,0);
  var next = getMaintenanceNextDue(task);
  return Math.ceil((next - today) / 86400000);
}

function markMaintenanceDone(id) {
  var task = (state.maintenanceTasks||[]).find(function(t){return t.id===id;});
  if (!task) return;
  var today = new Date();
  task.lastDone = today.toISOString().slice(0,10);
  saveState();
  renderMaintenance();
  renderDashboard();
  hhToast((task.emoji||'🔧')+' '+task.name+' marked done!','success');
}

function deleteMaintenanceTask(id) {
  hhConfirm('Delete this maintenance task?','🗑️','Delete Task').then(function(ok) {
    if (!ok) return;
    state.maintenanceTasks = (state.maintenanceTasks||[]).filter(function(t){return t.id!==id;});
    saveState();
    renderMaintenance();
    renderDashboard();
    hhToast('Task removed','🗑️');
  });
}

function openMaintenanceModal(id) {
  _maintModalId = id || null;
  var task = id ? (state.maintenanceTasks||[]).find(function(t){return t.id===id;}) : null;
  document.getElementById('maint-modal-title').textContent = task ? 'Edit Task' : 'Add Maintenance Task';
  document.getElementById('maint-name').value       = task ? task.name        : '';
  document.getElementById('maint-emoji').value      = task ? task.emoji       : '🔧';
  document.getElementById('maint-category').value   = task ? (task.category||'Other') : 'Other';
  document.getElementById('maint-interval').value   = task ? task.intervalDays : 90;
  document.getElementById('maint-lastdone').value   = task ? (task.lastDone||'') : '';
  document.getElementById('maint-notes').value      = task ? (task.notes||'')    : '';
  openModal('maint-modal');
}

function saveMaintenanceTask() {
  var name     = document.getElementById('maint-name').value.trim();
  var emoji    = document.getElementById('maint-emoji').value.trim() || '🔧';
  var category = document.getElementById('maint-category').value;
  var interval = parseInt(document.getElementById('maint-interval').value) || 90;
  var lastDone = document.getElementById('maint-lastdone').value;
  var notes    = document.getElementById('maint-notes').value.trim();
  if (!name) { hhAlert('Please enter a task name.','⚠️'); return; }
  if (interval < 1) { hhAlert('Interval must be at least 1 day.','⚠️'); return; }
  if (!state.maintenanceTasks) state.maintenanceTasks = [];
  var record = { name:name, emoji:emoji, category:category, intervalDays:interval, lastDone:lastDone||null, notes:notes };
  if (_maintModalId) {
    var idx = state.maintenanceTasks.findIndex(function(t){return t.id===_maintModalId;});
    if (idx > -1) state.maintenanceTasks[idx] = Object.assign(state.maintenanceTasks[idx], record);
  } else {
    state.maintenanceTasks.push(Object.assign({ id: 'mt'+Math.random().toString(36).slice(2,8), createdAt: new Date().toISOString() }, record));
  }
  saveState();
  closeModal('maint-modal');
  renderMaintenance();
  renderDashboard();
  hhToast((_maintModalId?'Updated ':'Added ')+emoji+' '+name,'success');
}

function loadMaintenancePresets() {
  if (!state.maintenanceTasks) state.maintenanceTasks = [];
  var existing = state.maintenanceTasks.map(function(t){return t.name.toLowerCase();});
  var toAdd = MAINT_PRESETS.filter(function(p){ return existing.indexOf(p.name.toLowerCase()) === -1; });
  if (!toAdd.length) { hhAlert('All starter tasks are already in your list!','✅'); return; }
  hhConfirm('Add '+toAdd.length+' starter maintenance tasks to your list?','📋','Load Starter Tasks').then(function(ok) {
    if (!ok) return;
    toAdd.forEach(function(p) {
      state.maintenanceTasks.push(Object.assign({ id:'mt'+Math.random().toString(36).slice(2,8), createdAt:new Date().toISOString(), lastDone:null }, p));
    });
    saveState();
    renderMaintenance();
    renderDashboard();
    hhToast('Added '+toAdd.length+' starter tasks!','success');
  });
}

var _maintFilter = 'All';

function setMaintFilter(cat, btn) {
  _maintFilter = cat;
  document.querySelectorAll('.maint-filter-btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderMaintenance();
}

function renderMaintenance() {
  var allTasks = state.maintenanceTasks || [];
  var listEl   = document.getElementById('maintenance-list');
  var emptyEl  = document.getElementById('maintenance-empty');
  var summaryEl= document.getElementById('maintenance-summary-bar');
  var filterEl = document.getElementById('maintenance-filter-bar');
  if (!listEl) return;

  if (!allTasks.length) {
    listEl.innerHTML = '';
    if (emptyEl)  emptyEl.style.display  = '';
    if (summaryEl) summaryEl.innerHTML = '';
    if (filterEl) filterEl.innerHTML = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  // YTD spend from transactions
  var ytdSpend = getMaintenanceSpend(new Date().getFullYear());

  var today = new Date(); today.setHours(0,0,0,0);

  // Categorise all tasks
  var overdue = 0, dueSoon = 0, ok = 0;
  allTasks.forEach(function(t) {
    var days = getMaintenanceDaysUntil(t);
    if (days < 0) overdue++;
    else if (days <= 7) dueSoon++;
    else ok++;
  });

  // Summary bar
  if (summaryEl) {
    summaryEl.innerHTML = '<div class="card" style="padding:12px 18px">'
      +'<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">'
      +'<div><div style="font-size:20px;font-weight:900;color:var(--red)">'+overdue+'</div><div style="font-size:11px;color:var(--muted)">Overdue</div></div>'
      +'<div><div style="font-size:20px;font-weight:900;color:var(--yellow)">'+dueSoon+'</div><div style="font-size:11px;color:var(--muted)">Due This Week</div></div>'
      +'<div><div style="font-size:20px;font-weight:900;color:var(--green)">'+ok+'</div><div style="font-size:11px;color:var(--muted)">Up to Date</div></div>'
      +'<div><div style="font-size:20px;font-weight:900;color:var(--text)">'+allTasks.length+'</div><div style="font-size:11px;color:var(--muted)">Total Tasks</div></div>'
      +(ytdSpend>0?'<div><div style="font-size:20px;font-weight:900;color:var(--accent)">'+fmt(ytdSpend)+'</div><div style="font-size:11px;color:var(--muted)">Spent YTD</div></div>':'')
      +'</div></div>';
  }

  // Filter bar
  var cats = ['All'].concat(MAINT_CATEGORIES.filter(function(c) {
    return allTasks.some(function(t){return (t.category||'Other')===c;});
  }));
  if (filterEl) {
    filterEl.innerHTML = cats.map(function(c) {
      var active = _maintFilter === c ? ' active' : '';
      return '<button class="toggle-btn maint-filter-btn'+active+'" onclick="setMaintFilter(\''+c+'\',this)">'+c+'</button>';
    }).join('');
  }

  // Filter tasks
  var tasks = _maintFilter === 'All' ? allTasks : allTasks.filter(function(t){return (t.category||'Other')===_maintFilter;});

  // Sort: overdue first, then due soon, then by next due date
  tasks = tasks.slice().sort(function(a,b) {
    return getMaintenanceNextDue(a) - getMaintenanceNextDue(b);
  });

  if (!tasks.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px">No tasks in this category.</div>';
    return;
  }

  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  listEl.innerHTML = tasks.map(function(task) {
    var days     = getMaintenanceDaysUntil(task);
    var nextDue  = getMaintenanceNextDue(task);
    var isOverdue   = days < 0;
    var isDueSoon   = !isOverdue && days <= 7;
    var isDueToday  = days === 0;

    var statusColor = isOverdue ? 'var(--red)' : isDueSoon ? 'var(--yellow)' : 'var(--green)';
    var statusBg    = isOverdue
      ? 'color-mix(in srgb,var(--red) 10%,transparent)'
      : isDueSoon
        ? 'color-mix(in srgb,var(--yellow) 10%,transparent)'
        : 'color-mix(in srgb,var(--green) 8%,transparent)';

    var statusLabel = isOverdue
      ? '⚠️ '+Math.abs(days)+' day'+(Math.abs(days)!==1?'s':'')+' overdue'
      : isDueToday ? '🔴 Due today'
      : isDueSoon  ? '🟡 Due in '+days+' day'+(days!==1?'s':'')
      : '🟢 Due '+months[nextDue.getMonth()]+' '+nextDue.getDate()+', '+nextDue.getFullYear();

    var lastDoneStr = task.lastDone
      ? (function(){ var d=new Date(task.lastDone+'T00:00:00'); return months[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear(); })()
      : 'Never';

    var intervalStr = task.intervalDays >= 365
      ? Math.round(task.intervalDays/365*10)/10+' yr'+(task.intervalDays>=730?'s':'')
      : task.intervalDays >= 30
        ? Math.round(task.intervalDays/30.5)+' mo'
        : task.intervalDays+' days';

    return '<div class="card" style="margin-bottom:10px;border-left:4px solid '+statusColor+';background:'+statusBg+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'
      // Left: emoji + name + meta
      +'<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">'
      +'<div style="font-size:28px;flex-shrink:0">'+(task.emoji||'🔧')+'</div>'
      +'<div style="min-width:0">'
      +'<div style="font-size:15px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+task.name+'</div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:3px">'
      +'<span style="font-size:11px;font-weight:600;color:var(--muted);background:var(--bg);padding:1px 7px;border-radius:20px">'+(task.category||'Other')+'</span>'
      +'<span style="font-size:11px;color:var(--muted)">Every '+intervalStr+'</span>'
      +'</div>'
      +(task.notes?'<div style="font-size:12px;color:var(--muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+task.notes+'</div>':'')
      +'</div></div>'
      // Right: status + buttons
      +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">'
      +'<div style="font-size:12px;font-weight:700;color:'+statusColor+';text-align:right;white-space:nowrap">'+statusLabel+'</div>'
      +'<div style="font-size:11px;color:var(--muted);text-align:right">Last done: '+lastDoneStr+'</div>'
      +'<div style="display:flex;gap:6px;margin-top:2px">'
      +'<button class="btn btn-primary btn-sm" onclick="markMaintenanceDone(\''+task.id+'\')">✅ Done</button>'
      +'<button class="btn btn-ghost btn-sm" onclick="openMaintenanceModal(\''+task.id+'\')">✏️</button>'
      +'<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteMaintenanceTask(\''+task.id+'\')">🗑️</button>'
      +'</div></div>'
      +'</div></div>';
  }).join('');
}


// TAX PREP HELPER ─────────────────────────────────────────────────────────

// 2024 Ontario + Federal combined marginal rates (approximate, mid-bracket)
var ON_TAX_BRACKETS = [
  { min:0,       max:16129,  rate:0.00  },  // Basic personal amount — no tax
  { min:16129,   max:49958,  rate:0.205 },  // ~20.5% combined (15% fed + 5.05% ON)
  { min:49958,   max:55867,  rate:0.295 },  // Fed 20.5% kicks in
  { min:55867,   max:100392, rate:0.3316},  // ~33.16%
  { min:100392,  max:111141, rate:0.4316},  // Fed 26% bracket
  { min:111141,  max:150000, rate:0.4341},  // ON surtax territory
  { min:150000,  max:220000, rate:0.4797},  // Fed 29% + ON upper
  { min:220000,  max:Infinity,rate:0.5353}, // Fed 33% + ON top
];

function calcOntarioTax(income) {
  var tax = 0;
  for (var i = 0; i < ON_TAX_BRACKETS.length; i++) {
    var b = ON_TAX_BRACKETS[i];
    if (income <= b.min) break;
    var slice = Math.min(income, b.max) - b.min;
    tax += slice * b.rate;
  }
  return Math.round(tax);
}

function getMarginalRate(income) {
  for (var i = ON_TAX_BRACKETS.length - 1; i >= 0; i--) {
    if (income > ON_TAX_BRACKETS[i].min) return ON_TAX_BRACKETS[i].rate;
  }
  return 0;
}

function getTaxYear() {
  var sel = document.getElementById('tax-year-select');
  return sel ? parseInt(sel.value) : new Date().getFullYear() - 1;
}

function populateTaxYearSelect() {
  var sel = document.getElementById('tax-year-select');
  if (!sel) return;
  // Only rebuild when the dropdown is empty (first render).
  // Subsequent calls from renderTax() preserve the user's selected year.
  if (sel.options.length > 0) return;
  var cur = new Date().getFullYear();
  var html = '';
  for (var y = cur; y >= cur - 4; y--) {
    html += '<option value="' + y + '"' + (y === cur - 1 ? ' selected' : '') + '>' + y + ' Tax Year</option>';
  }
  sel.innerHTML = html;
}

function getTaxInputs(year) {
  var td = state.taxData || {};
  return td[year] || {};
}

function saveTaxInputs(year, data) {
  if (!state.taxData) state.taxData = {};
  state.taxData[year] = Object.assign(getTaxInputs(year), data);
  saveState();
}

// Get Holly's total tips for a given year from tips tracker
function getHollyTipsForYear(year) {
  var tips = state.tips || [];
  return tips.filter(function(t) {
    return new Date(t.date).getFullYear() === year;
  }).reduce(function(s, t) {
    return s + (t.amount || 0) + (t.cashAmount || 0);
  }, 0);
}

function getHollyTipsCashForYear(year) {
  var tips = state.tips || [];
  return tips.filter(function(t) {
    return new Date(t.date).getFullYear() === year;
  }).reduce(function(s, t) { return s + (t.cashAmount || 0); }, 0);
}

function getHollyTipsDeclaredForYear(year) {
  var tips = state.tips || [];
  return tips.filter(function(t) {
    return new Date(t.date).getFullYear() === year;
  }).reduce(function(s, t) { return s + (t.amount || 0); }, 0);
}

function openTaxInputModal() {
  var year = getTaxYear();
  var td = getTaxInputs(year);
  document.getElementById('tax-input-year').textContent = year;

  // ── Seed income fields from member profile when no saved tax data exists ──
  // Only pre-fills fields still at zero so manually entered T4 values are never overwritten.
  var members = state.members || [];
  // Identify Matt (salary/pension member) and Holly (tips member) by their flags.
  // Falls back to first/second member if flags aren't set.
  var mattM  = members.find(function(m){ return m.hasPension || m.incomeType === 'salary'; }) || members[0];
  var hollyM = members.find(function(m){ return m.hasTips; }) || members[1];

  var mattEstIncome  = mattM  ? Math.round((mattM.monthlyIncome  || 0) * 12) : 0;
  var hollyEstIncome = hollyM ? Math.round((hollyM.monthlyIncome || 0) * 12) : 0;

  // Matt employment
  var mattEmpVal = td.mattEmployment || 0;
  var mattSeeded = false;
  if (!mattEmpVal && mattEstIncome > 0) { mattEmpVal = mattEstIncome; mattSeeded = true; }
  document.getElementById('tax-matt-employment').value  = mattEmpVal  || '';
  var mattHint = document.getElementById('tax-matt-employment-hint');
  if (mattHint) mattHint.style.display = mattSeeded ? '' : 'none';

  document.getElementById('tax-matt-pension-adj').value = td.mattPensionAdj  || '';
  document.getElementById('tax-matt-rrsp-room').value   = td.mattRrspRoom    || '';
  document.getElementById('tax-matt-rrsp-contrib').value= td.mattRrspContrib || '';
  document.getElementById('tax-matt-cpp').value         = td.mattCpp         || '';
  document.getElementById('tax-matt-ei').value          = td.mattEi          || '';
  document.getElementById('tax-matt-tax-withheld').value= td.mattTaxWithheld || '';

  // Holly employment
  var hollyEmpVal = td.hollyEmployment || 0;
  var hollySeeded = false;
  if (!hollyEmpVal && hollyEstIncome > 0) { hollyEmpVal = hollyEstIncome; hollySeeded = true; }
  document.getElementById('tax-holly-employment').value  = hollyEmpVal || '';
  var hollyHint = document.getElementById('tax-holly-employment-hint');
  if (hollyHint) hollyHint.style.display = hollySeeded ? '' : 'none';

  document.getElementById('tax-holly-cpp').value         = td.hollyCpp         || '';
  document.getElementById('tax-holly-ei').value          = td.hollyEi          || '';
  document.getElementById('tax-holly-tax-withheld').value= td.hollyTaxWithheld || '';
  document.getElementById('tax-holly-instalments').value = td.hollyInstalments || '';
  openModal('tax-input-modal');
}

function saveTaxInputModal() {
  var year = getTaxYear();
  saveTaxInputs(year, {
    mattEmployment:   parseFloat(document.getElementById('tax-matt-employment').value)   || 0,
    mattPensionAdj:   parseFloat(document.getElementById('tax-matt-pension-adj').value)  || 0,
    mattRrspRoom:     parseFloat(document.getElementById('tax-matt-rrsp-room').value)    || 0,
    mattRrspContrib:  parseFloat(document.getElementById('tax-matt-rrsp-contrib').value) || 0,
    mattCpp:          parseFloat(document.getElementById('tax-matt-cpp').value)          || 0,
    mattEi:           parseFloat(document.getElementById('tax-matt-ei').value)           || 0,
    mattTaxWithheld:  parseFloat(document.getElementById('tax-matt-tax-withheld').value) || 0,
    hollyEmployment:  parseFloat(document.getElementById('tax-holly-employment').value)  || 0,
    hollyCpp:         parseFloat(document.getElementById('tax-holly-cpp').value)         || 0,
    hollyEi:          parseFloat(document.getElementById('tax-holly-ei').value)          || 0,
    hollyTaxWithheld: parseFloat(document.getElementById('tax-holly-tax-withheld').value)|| 0,
    hollyInstalments: parseFloat(document.getElementById('tax-holly-instalments').value) || 0,
  });
  closeModal('tax-input-modal');
  renderTax();
  hhToast('Tax inputs saved for ' + year, 'success');
}

function exportTaxSummary() {
  var year = getTaxYear();
  var td = getTaxInputs(year);
  var hollyTips = getHollyTipsForYear(year);
  var hollyTipsCash = getHollyTipsCashForYear(year);

  var lines = [
    '========================================',
    'HOME HUB — TAX PREP SUMMARY',
    'Tax Year: ' + year,
    'Generated: ' + new Date().toLocaleDateString('en-CA'),
    '========================================',
    '',
    '--- MATT ---',
    'Employment Income:       ' + fmt(td.mattEmployment || 0),
    'Pension Adjustment (T4 Box 52): ' + fmt(td.mattPensionAdj || 0),
    'RRSP Contribution Room:  ' + fmt(td.mattRrspRoom || 0),
    'RRSP Contributions Made: ' + fmt(td.mattRrspContrib || 0),
    'RRSP Room Remaining:     ' + fmt(Math.max(0, (td.mattRrspRoom||0) - (td.mattRrspContrib||0))),
    'CPP Contributions:       ' + fmt(td.mattCpp || 0),
    'EI Premiums:             ' + fmt(td.mattEi || 0),
    'Income Tax Withheld:     ' + fmt(td.mattTaxWithheld || 0),
    '',
    '--- HOLLY ---',
    'Employment Income (T4):  ' + fmt(td.hollyEmployment || 0),
    'Tips — Declared via T4:  ' + fmt(td.hollyEmployment ? (hollyTips - hollyTipsCash) : 0),
    'Tips — Cash (unreported):' + fmt(hollyTipsCash),
    'Total Tips (tracker):    ' + fmt(hollyTips),
    'CPP Contributions:       ' + fmt(td.hollyCpp || 0),
    'EI Premiums:             ' + fmt(td.hollyEi || 0),
    'Income Tax Withheld:     ' + fmt(td.hollyTaxWithheld || 0),
    'CRA Instalments Paid:    ' + fmt(td.hollyInstalments || 0),
    '',
    '--- RRSP ---',
    'Contribution Room:       ' + fmt(td.mattRrspRoom || 0),
    'Contributions Made:      ' + fmt(td.mattRrspContrib || 0),
    'Room Remaining:          ' + fmt(Math.max(0,(td.mattRrspRoom||0)-(td.mattRrspContrib||0))),
    'RRSP Deadline:           March 1, ' + (year + 1),
    '',
    '--- KEY DATES ---',
    'Tax Filing Deadline:     April 30, ' + (year + 1),
    'CRA Instalments:         Mar 15, Jun 15, Sep 15, Dec 15',
    '========================================',
  ];

  var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'TaxSummary_' + year + '.txt';
  a.click();
  URL.revokeObjectURL(url);
  hhToast('Tax summary exported!', 'success');
}

function renderTax() {
  populateTaxYearSelect();
  var year = getTaxYear();
  var td   = getTaxInputs(year);

  // ── Deadlines banner ──────────────────────────────────────────────────────
  var deadlinesBar = document.getElementById('tax-deadlines-bar');
  if (deadlinesBar) {
    var today = new Date(); today.setHours(0,0,0,0);
    var rrspDeadline  = new Date((year+1) + '-03-01T00:00:00');
    var fileDeadline  = new Date((year+1) + '-04-30T00:00:00');
    var rrspDays  = Math.ceil((rrspDeadline - today) / 86400000);
    var fileDays  = Math.ceil((fileDeadline - today) / 86400000);
    var alerts = [];
    if (rrspDays > 0 && rrspDays <= 60)  alerts.push('<span style="color:var(--yellow);font-weight:700">⏰ RRSP deadline: ' + rrspDays + ' days</span> (March 1, ' + (year+1) + ')');
    if (rrspDays <= 0)                   alerts.push('<span style="color:var(--muted)">✅ RRSP deadline passed</span>');
    if (fileDays > 0 && fileDays <= 60)  alerts.push('<span style="color:var(--yellow);font-weight:700">📅 Filing deadline: ' + fileDays + ' days</span> (April 30, ' + (year+1) + ')');
    if (fileDays <= 0)                   alerts.push('<span style="color:var(--muted)">✅ Filing deadline passed</span>');
    deadlinesBar.innerHTML = alerts.length
      ? '<div class="card" style="padding:10px 16px;background:color-mix(in srgb,var(--yellow) 8%,transparent);border:1.5px solid color-mix(in srgb,var(--yellow) 40%,transparent)">'
        + alerts.join(' &nbsp;·&nbsp; ') + '</div>'
      : '';
  }

  // ── Matt card ─────────────────────────────────────────────────────────────
  var mattCard = document.getElementById('tax-matt-card');
  if (mattCard) {
    var mattInc   = td.mattEmployment  || 0;
    var mattPA    = td.mattPensionAdj  || 0;
    var mattRrsp  = td.mattRrspContrib || 0;
    var mattWith  = td.mattTaxWithheld || 0;
    var mattCpp   = td.mattCpp  || 0;
    var mattEi    = td.mattEi   || 0;
    var mattTaxableInc = Math.max(0, mattInc - mattRrsp);
    var mattEstTax = calcOntarioTax(mattTaxableInc);
    var mattBalance = mattEstTax - mattWith;
    var mattMarginal = Math.round(getMarginalRate(mattTaxableInc) * 100);
    mattCard.innerHTML = '<div class="card" style="height:100%">'
      + '<div class="card-title">👔 Matt — ' + year + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
      + _tstat(fmt(mattInc),      'Employment Income')
      + _tstat(fmt(mattPA),       'Pension Adjustment')
      + _tstat(fmt(mattRrsp),     'RRSP Deduction')
      + _tstat(fmt(mattTaxableInc),'Est. Taxable Income')
      + _tstat(fmt(mattCpp),      'CPP Contributions')
      + _tstat(fmt(mattEi),       'EI Premiums')
      + _tstat(fmt(mattWith),     'Tax Withheld')
      + _tstat(mattMarginal + '%','Marginal Rate')
      + '</div>'
      + '<div style="padding:10px 12px;border-radius:8px;background:'
      + (mattBalance > 0 ? 'color-mix(in srgb,var(--red) 10%,transparent)' : 'color-mix(in srgb,var(--green) 10%,transparent)') + '">'
      + '<div style="font-size:13px;font-weight:700;color:var(--muted)">Estimated Balance</div>'
      + '<div style="font-size:22px;font-weight:900;color:' + (mattBalance > 0 ? 'var(--red)' : 'var(--green)') + '">'
      + (mattBalance > 0 ? 'Owe ' + fmt(mattBalance) : 'Refund ' + fmt(Math.abs(mattBalance))) + '</div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:2px">Based on estimated tax — not a CRA calculation</div>'
      + '</div>'
      + (mattInc === 0 ? '<div style="font-size:12px;color:var(--muted);margin-top:10px;padding:8px;background:var(--bg);border-radius:8px">👆 Tap <strong>Edit Tax Inputs</strong> to enter your T4 details.</div>' : '')
      + '</div>';
  }

  // ── Holly card ────────────────────────────────────────────────────────────
  var hollyCard = document.getElementById('tax-holly-card');
  if (hollyCard) {
    var hollyInc    = td.hollyEmployment  || 0;
    var hollyTips   = getHollyTipsForYear(year);
    var hollyDeclared = getHollyTipsDeclaredForYear(year);
    var hollyCash   = getHollyTipsCashForYear(year);
    var hollyWith   = td.hollyTaxWithheld || 0;
    var hollyInst   = td.hollyInstalments || 0;
    var hollyCpp    = td.hollyCpp || 0;
    var hollyEi     = td.hollyEi  || 0;
    var hollyTotalInc = hollyInc + hollyTips;
    var hollyEstTax = calcOntarioTax(hollyTotalInc);
    var hollyTotalPaid = hollyWith + hollyInst;
    var hollyBalance = hollyEstTax - hollyTotalPaid;
    var hollyMarginal = Math.round(getMarginalRate(hollyTotalInc) * 100);
    hollyCard.innerHTML = '<div class="card" style="height:100%">'
      + '<div class="card-title">💅 Holly — ' + year + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
      + _tstat(fmt(hollyInc),     'Employment Income (T4)')
      + _tstat(fmt(hollyTips),    'Tips (tracker YTD)')
      + _tstat(fmt(hollyDeclared),'Tips Declared via T4')
      + _tstat(fmt(hollyCash),    'Cash Tips (unreported)')
      + _tstat(fmt(hollyCpp),     'CPP Contributions')
      + _tstat(fmt(hollyEi),      'EI Premiums')
      + _tstat(fmt(hollyWith),    'Tax Withheld')
      + _tstat(fmt(hollyInst),    'Instalments Paid')
      + _tstat(fmt(hollyTotalInc),'Est. Total Income')
      + _tstat(hollyMarginal + '%','Marginal Rate')
      + '</div>'
      + '<div style="padding:10px 12px;border-radius:8px;background:'
      + (hollyBalance > 0 ? 'color-mix(in srgb,var(--red) 10%,transparent)' : 'color-mix(in srgb,var(--green) 10%,transparent)') + '">'
      + '<div style="font-size:13px;font-weight:700;color:var(--muted)">Estimated Balance</div>'
      + '<div style="font-size:22px;font-weight:900;color:' + (hollyBalance > 0 ? 'var(--red)' : 'var(--green)') + '">'
      + (hollyBalance > 0 ? 'Owe ' + fmt(hollyBalance) : 'Refund ' + fmt(Math.abs(hollyBalance))) + '</div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:2px">Includes all tip income — not a CRA calculation</div>'
      + '</div>'
      + (hollyTips > 0 && hollyCash > 0
        ? '<div style="font-size:12px;color:var(--yellow);margin-top:10px;padding:8px 10px;background:color-mix(in srgb,var(--yellow) 8%,transparent);border-radius:8px">'
          + '⚠️ ' + fmt(hollyCash) + ' in cash tips tracked — confirm these are declared on your return.</div>'
        : '')
      + '</div>';
  }

  // ── RRSP Planner ──────────────────────────────────────────────────────────
  var rrspCard = document.getElementById('tax-rrsp-card');
  if (rrspCard) {
    var rrspRoom    = td.mattRrspRoom    || 0;
    var rrspContrib = td.mattRrspContrib || 0;
    var rrspPA      = td.mattPensionAdj  || 0;
    var rrspRemaining = Math.max(0, rrspRoom - rrspContrib);
    var mattInc2    = td.mattEmployment  || 0;
    var margRate    = getMarginalRate(Math.max(0, mattInc2 - rrspContrib));
    // RRSP savings estimator for remaining room
    var savingsAt500  = Math.round(Math.min(500,  rrspRemaining) * margRate);
    var savingsAt1000 = Math.round(Math.min(1000, rrspRemaining) * margRate);
    var savingsAt5000 = Math.round(Math.min(5000, rrspRemaining) * margRate);
    var pct = rrspRoom > 0 ? Math.min(100, Math.round(rrspContrib / rrspRoom * 100)) : 0;

    rrspCard.innerHTML = '<div class="card">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<div class="card-title" style="margin:0">📊 RRSP Planner — ' + year + '</div>'
      + '<div style="font-size:12px;color:var(--muted)">Deadline: March 1, ' + (year+1) + '</div></div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">'
      + _tstat(fmt(rrspRoom),      'Contribution Room')
      + _tstat(fmt(rrspContrib),   'Contributions Made')
      + _tstat(fmt(rrspRemaining), 'Room Remaining', rrspRemaining > 0 ? 'var(--accent)' : 'var(--green)')
      + _tstat(fmt(rrspPA),        'Pension Adjustment')
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px">'
      + '<span>' + fmt(rrspContrib) + ' contributed</span><span style="font-weight:700;color:var(--accent)">' + pct + '%</span><span>' + fmt(rrspRoom) + ' room</span></div>'
      + '<div style="background:var(--bg);border-radius:6px;height:8px;overflow:hidden;margin-bottom:14px">'
      + '<div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:6px;transition:width .4s"></div></div>'
      + (rrspRemaining > 0
        ? '<div style="background:var(--bg);border-radius:8px;padding:10px 14px">'
          + '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">💡 Tax savings from contributing more:</div>'
          + '<div style="display:flex;gap:12px;flex-wrap:wrap">'
          + '<div><div style="font-size:15px;font-weight:800;color:var(--green)">'+fmt(savingsAt500)+'</div><div style="font-size:11px;color:var(--muted)">Save $500 more</div></div>'
          + '<div><div style="font-size:15px;font-weight:800;color:var(--green)">'+fmt(savingsAt1000)+'</div><div style="font-size:11px;color:var(--muted)">Save $1,000 more</div></div>'
          + '<div><div style="font-size:15px;font-weight:800;color:var(--green)">'+fmt(savingsAt5000)+'</div><div style="font-size:11px;color:var(--muted)">Save $5,000 more</div></div>'
          + '</div>'
          + '<div style="font-size:11px;color:var(--muted);margin-top:6px">At Matt\'s estimated ' + Math.round(margRate*100) + '% marginal rate. Every dollar into RRSP reduces taxable income by one dollar.</div>'
          + '</div>'
        : '<div style="color:var(--green);font-weight:700;font-size:13px">✅ RRSP fully contributed — great work!</div>')
      + '</div>';
  }

  // ── Holly Tips Breakdown ───────────────────────────────────────────────────
  var tipsCard = document.getElementById('tax-tips-card');
  if (tipsCard) {
    var tips      = state.tips || [];
    var yearTips  = tips.filter(function(t){ return new Date(t.date).getFullYear() === year; });
    if (yearTips.length) {
      // Monthly breakdown
      var byMonth = {};
      yearTips.forEach(function(t) {
        var mk = new Date(t.date).getMonth();
        if (!byMonth[mk]) byMonth[mk] = { declared:0, cash:0 };
        byMonth[mk].declared += (t.amount || 0);
        byMonth[mk].cash     += (t.cashAmount || 0);
      });
      var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var totalDeclared = yearTips.reduce(function(s,t){return s+(t.amount||0);},0);
      var totalCash     = yearTips.reduce(function(s,t){return s+(t.cashAmount||0);},0);
      var totalAll      = totalDeclared + totalCash;
      var hollyInst2    = td.hollyInstalments || 0;
      var hollyInc2     = td.hollyEmployment  || 0;
      var estTaxOnTips  = Math.round(totalAll * getMarginalRate(hollyInc2 + totalAll));
      var instalNeeded  = Math.max(0, estTaxOnTips - hollyInst2);

      var monthRows = Object.keys(byMonth).sort(function(a,b){return a-b;}).map(function(m) {
        var mo = byMonth[m];
        return '<tr><td>' + monthNames[m] + '</td>'
          + '<td style="text-align:right">' + fmt(mo.declared) + '</td>'
          + '<td style="text-align:right">' + fmt(mo.cash) + '</td>'
          + '<td style="text-align:right;font-weight:700">' + fmt(mo.declared+mo.cash) + '</td></tr>';
      }).join('');

      tipsCard.innerHTML = '<div class="card">'
        + '<div class="card-title">💵 Holly\'s Tips — ' + year + ' Breakdown</div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px">'
        + _tstat(fmt(totalAll),      'Total Tips')
        + _tstat(fmt(totalDeclared), 'Via Payroll (T4)')
        + _tstat(fmt(totalCash),     'Cash Tips')
        + _tstat(fmt(hollyInst2),    'Instalments Paid')
        + _tstat(fmt(estTaxOnTips),  'Est. Tax on Tips')
        + _tstat(fmt(instalNeeded),  instalNeeded > 0 ? 'Additional Tax Owing' : 'Instalments Sufficient', instalNeeded > 0 ? 'var(--red)' : 'var(--green)')
        + '</div>'
        + '<div class="table-wrap"><table>'
        + '<thead><tr><th>Month</th><th style="text-align:right">Declared</th><th style="text-align:right">Cash</th><th style="text-align:right">Total</th></tr></thead>'
        + '<tbody>' + monthRows + '</tbody>'
        + '<tfoot><tr style="font-weight:700;border-top:2px solid var(--border)">'
        + '<td>Total</td><td style="text-align:right">' + fmt(totalDeclared) + '</td>'
        + '<td style="text-align:right">' + fmt(totalCash) + '</td>'
        + '<td style="text-align:right">' + fmt(totalAll) + '</td></tr></tfoot>'
        + '</table></div>'
        + (totalCash > 0
          ? '<div style="margin-top:10px;font-size:12px;padding:8px 12px;background:color-mix(in srgb,var(--yellow) 8%,transparent);border-radius:8px;color:var(--text)">'
            + '⚠️ <strong>Cash tips are taxable income.</strong> Ensure all ' + fmt(totalCash) + ' is declared on Holly\'s T1. CRA expects tip income to be reported.</div>'
          : '')
        + '</div>';
    } else {
      tipsCard.innerHTML = '<div class="card"><div class="card-title">💵 Holly\'s Tips — ' + year + '</div>'
        + '<div style="color:var(--muted);font-size:13px">No tips recorded for ' + year + '. Log tips in the Tips section to see the breakdown here.</div></div>';
    }
  }

  // ── CRA Deadlines detail card ─────────────────────────────────────────────
  var dlCard = document.getElementById('tax-deadlines-card');
  if (dlCard) {
    dlCard.innerHTML = '<div class="card">'
      + '<div class="card-title">📅 Key CRA Dates — ' + year + '/' + (year+1) + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">'
      + _deadline('March 1, ' + (year+1),      'RRSP Contribution Deadline', 'Last day to contribute to ' + year + ' RRSP')
      + _deadline('March 15, ' + (year+1),     'Q1 Instalment Due',          'Holly: Q1 CRA instalment payment')
      + _deadline('April 30, ' + (year+1),     'Tax Filing Deadline',        'File T1 return for ' + year + ' (or face interest & penalties)')
      + _deadline('June 15, ' + (year+1),      'Q2 Instalment Due',          'Holly: Q2 CRA instalment payment')
      + _deadline('June 15, ' + (year+1),      'Self-Employed Filing',       'Extended deadline if self-employed (tax still due Apr 30)')
      + _deadline('September 15, ' + (year+1), 'Q3 Instalment Due',          'Holly: Q3 CRA instalment payment')
      + _deadline('December 15, ' + (year+1),  'Q4 Instalment Due',          'Holly: Q4 CRA instalment payment')
      + '</div></div>';
  }
}

function _deadline(date, title, desc) {
  return '<div style="padding:10px 12px;background:var(--bg);border-radius:8px">'
    + '<div style="font-size:12px;font-weight:800;color:var(--accent)">' + date + '</div>'
    + '<div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">' + title + '</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:1px">' + desc + '</div></div>';
}

function _tstat(val, label, valColor) {
  return '<div style="background:var(--bg);border-radius:8px;padding:8px 10px">'
    + '<div style="font-size:14px;font-weight:800;color:' + (valColor || 'var(--text)') + '">' + val + '</div>'
    + '<div style="font-size:11px;color:var(--muted)">' + label + '</div></div>';
}


// RETIREMENT PROJECTOR ───────────────────────────────────────────────────────

function getRetInputs() {
  return state.retirementData || {};
}

function saveRetInputs(data) {
  state.retirementData = Object.assign(getRetInputs(), data);
  saveState();
}

function openRetirementInputModal() {
  var rd = getRetInputs();
  // Auto-populate account link dropdowns
  var accounts = state.accounts || [];
  var rrspAccts = accounts.filter(function(a){return a.type==='RRSP'||a.type==='FHSA';});
  var tfsaAccts = accounts.filter(function(a){return a.type==='TFSA';});
  function buildAcctOpts(linkedId, accts) {
    return '<option value="">Manual entry</option>' +
      accts.map(function(a){return '<option value="'+a.id+'"'+(a.id===linkedId?' selected':'')+'>'+(a.nickname||a.type)+'</option>';}).join('');
  }
  ['ret-matt-rrsp-acct','ret-matt-tfsa-acct','ret-holly-rrsp-acct','ret-holly-tfsa-acct'].forEach(function(sid) {
    var sel = document.getElementById(sid);
    if (!sel) return;
    var isRrsp = sid.includes('rrsp');
    var linkedId = rd[sid.replace('ret-','').replace('-acct','').replace(/-([a-z])/g,function(_,c){return c.toUpperCase()})+'Acct'] || '';
    sel.innerHTML = buildAcctOpts(linkedId, isRrsp ? rrspAccts : tfsaAccts);
  });

  // Matt fields
  document.getElementById('ret-matt-age').value           = rd.mattAge          || '';
  document.getElementById('ret-matt-retire-age').value    = rd.mattRetireAge    || 60;
  document.getElementById('ret-matt-salary').value        = rd.mattSalary       || '';
  document.getElementById('ret-matt-pension-mode').value  = rd.mattPensionMode  || 'db';
  document.getElementById('ret-matt-pension-pct').value   = rd.mattPensionPct   || 2;
  document.getElementById('ret-matt-pension-years').value = rd.mattPensionYears || '';
  document.getElementById('ret-matt-emp-pct').value       = rd.mattEmpPct       || '';
  document.getElementById('ret-matt-match-pct').value     = rd.mattMatchPct     || '';
  document.getElementById('ret-matt-rrsp').value          = rd.mattRrsp         || '';
  document.getElementById('ret-matt-rrsp-monthly').value  = rd.mattExtraRrsp    || '';
  document.getElementById('ret-matt-tfsa').value          = rd.mattTfsa         || '';
  document.getElementById('ret-matt-tfsa-monthly').value  = rd.mattTfsaMonthly  || '';
  document.getElementById('ret-cpp-matt').value           = rd.cppMatt          || 900;

  // Holly fields
  document.getElementById('ret-holly-age').value           = rd.hollyAge          || '';
  document.getElementById('ret-holly-retire-age').value    = rd.hollyRetireAge    || 60;
  document.getElementById('ret-holly-income').value        = rd.hollyIncome       || '';
  document.getElementById('ret-holly-pension-mode').value  = rd.hollyPensionMode  || 'none';
  document.getElementById('ret-holly-pension-pct').value   = rd.hollyPensionPct   || 2;
  document.getElementById('ret-holly-pension-years').value = rd.hollyPensionYears || '';
  document.getElementById('ret-holly-emp-pct').value       = rd.hollyEmpPct       || '';
  document.getElementById('ret-holly-match-pct').value     = rd.hollyMatchPct     || '';
  document.getElementById('ret-holly-rrsp').value          = rd.hollyRrsp         || '';
  document.getElementById('ret-holly-rrsp-monthly').value  = rd.hollyExtraRrsp    || '';
  document.getElementById('ret-holly-tfsa').value          = rd.hollyTfsa         || '';
  document.getElementById('ret-holly-tfsa-monthly').value  = rd.hollyTfsaMonthly  || '';
  document.getElementById('ret-cpp-holly').value           = rd.cppHolly          || 600;

  // Shared
  document.getElementById('ret-growth-rate').value        = rd.growthRate       || 5;
  document.getElementById('ret-inflation-rate').value     = rd.inflationRate    || 2.5;

  // Apply mode visibility
  retUpdatePensionMode('matt');
  retUpdatePensionMode('holly');
  openModal('ret-input-modal');
}

function retUpdatePensionMode(who) {
  var modeEl = document.getElementById('ret-' + who + '-pension-mode');
  if (!modeEl) return;
  var mode = modeEl.value;
  var dbPanel = document.getElementById('ret-' + who + '-db-panel');
  var dcPanel = document.getElementById('ret-' + who + '-dc-panel');
  if (dbPanel) dbPanel.style.display = (mode === 'db')   ? '' : 'none';
  if (dcPanel) dcPanel.style.display = (mode === 'dc')   ? '' : 'none';
  retUpdateDcPreview(who);
}

function retUpdateDcPreview(who) {
  var preview = document.getElementById('ret-' + who + '-dc-preview');
  if (!preview) return;
  var salary  = parseFloat((document.getElementById('ret-' + who + (who==='matt'?'-salary':'-income')) || {}).value) || 0;
  var empPct  = parseFloat((document.getElementById('ret-' + who + '-emp-pct')   || {}).value) || 0;
  var matchPct= parseFloat((document.getElementById('ret-' + who + '-match-pct') || {}).value) || 0;
  var total   = empPct + matchPct;
  var monthly = salary > 0 ? Math.round(salary * total / 100 / 12) : 0;
  preview.textContent = salary > 0
    ? 'Total: ' + total.toFixed(1) + '% of $' + salary.toLocaleString('en-CA') + ' = $' + monthly.toLocaleString('en-CA') + '/mo going into your RRSP/pension'
    : 'Enter your salary above to see the monthly amount.';
}

function saveRetirementModal() {
  function linkedBal(selId, manualId) {
    var sel = document.getElementById(selId);
    var acctId = sel ? sel.value : '';
    if (acctId) { var bal = getAccountBalance(acctId); if (bal !== null) return bal; }
    return parseFloat(document.getElementById(manualId).value)||0;
  }
  var mattRrspAcct  = (document.getElementById('ret-matt-rrsp-acct') ||{}).value || '';
  var mattTfsaAcct  = (document.getElementById('ret-matt-tfsa-acct') ||{}).value || '';
  var hollyRrspAcct = (document.getElementById('ret-holly-rrsp-acct')||{}).value || '';
  var hollyTfsaAcct = (document.getElementById('ret-holly-tfsa-acct')||{}).value || '';

  var mattPensionMode  = document.getElementById('ret-matt-pension-mode')  ? document.getElementById('ret-matt-pension-mode').value  : 'db';
  var hollyPensionMode = document.getElementById('ret-holly-pension-mode') ? document.getElementById('ret-holly-pension-mode').value : 'none';
  var mattSalary  = parseFloat(document.getElementById('ret-matt-salary').value)  || 0;
  var hollyIncome = parseFloat(document.getElementById('ret-holly-income').value) || 0;

  // DC: compute total monthly pension contribution from % inputs
  var mattEmpPct    = parseFloat(document.getElementById('ret-matt-emp-pct').value)    || 0;
  var mattMatchPct  = parseFloat(document.getElementById('ret-matt-match-pct').value)  || 0;
  var mattDcMonthly = mattPensionMode === 'dc' ? Math.round(mattSalary * (mattEmpPct + mattMatchPct) / 100 / 12) : 0;
  var mattExtraRrsp = parseFloat(document.getElementById('ret-matt-rrsp-monthly').value) || 0;
  var mattRrspMonthly = mattPensionMode === 'dc' ? mattDcMonthly + mattExtraRrsp : mattExtraRrsp;

  var hollyEmpPct    = parseFloat(document.getElementById('ret-holly-emp-pct').value)    || 0;
  var hollyMatchPct  = parseFloat(document.getElementById('ret-holly-match-pct').value)  || 0;
  var hollyDcMonthly = hollyPensionMode === 'dc' ? Math.round(hollyIncome * (hollyEmpPct + hollyMatchPct) / 100 / 12) : 0;
  var hollyExtraRrsp = parseFloat(document.getElementById('ret-holly-rrsp-monthly').value) || 0;
  var hollyRrspMonthly = hollyPensionMode === 'dc' ? hollyDcMonthly + hollyExtraRrsp : hollyExtraRrsp;

  saveRetInputs({
    mattRrspAcct:mattRrspAcct, mattTfsaAcct:mattTfsaAcct,
    hollyRrspAcct:hollyRrspAcct, hollyTfsaAcct:hollyTfsaAcct,
    mattAge:          parseInt(document.getElementById('ret-matt-age').value)          || 0,
    mattRetireAge:    parseInt(document.getElementById('ret-matt-retire-age').value)   || 60,
    mattSalary:       mattSalary,
    mattPensionMode:  mattPensionMode,
    // DB fields
    mattPensionPct:   parseFloat(document.getElementById('ret-matt-pension-pct').value)|| 2,
    mattPensionYears: parseInt(document.getElementById('ret-matt-pension-years').value)|| 0,
    // DC fields
    mattEmpPct:       mattEmpPct,
    mattMatchPct:     mattMatchPct,
    mattDcMonthly:    mattDcMonthly,
    mattExtraRrsp:    mattExtraRrsp,
    // Savings
    mattRrsp:         linkedBal('ret-matt-rrsp-acct','ret-matt-rrsp'),
    mattTfsa:         linkedBal('ret-matt-tfsa-acct','ret-matt-tfsa'),
    mattRrspMonthly:  mattRrspMonthly,
    mattTfsaMonthly:  parseFloat(document.getElementById('ret-matt-tfsa-monthly').value)||0,
    hollyAge:         parseInt(document.getElementById('ret-holly-age').value)         || 0,
    hollyRetireAge:   parseInt(document.getElementById('ret-holly-retire-age').value)  || 60,
    hollyIncome:      hollyIncome,
    hollyPensionMode: hollyPensionMode,
    hollyPensionPct:  parseFloat(document.getElementById('ret-holly-pension-pct').value)|| 2,
    hollyPensionYears:parseInt(document.getElementById('ret-holly-pension-years').value)|| 0,
    hollyEmpPct:      hollyEmpPct,
    hollyMatchPct:    hollyMatchPct,
    hollyDcMonthly:   hollyDcMonthly,
    hollyExtraRrsp:   hollyExtraRrsp,
    hollyRrsp:        linkedBal('ret-holly-rrsp-acct','ret-holly-rrsp'),
    hollyTfsa:        linkedBal('ret-holly-tfsa-acct','ret-holly-tfsa'),
    hollyRrspMonthly: hollyRrspMonthly,
    hollyTfsaMonthly: parseFloat(document.getElementById('ret-holly-tfsa-monthly').value)||0,
    growthRate:       parseFloat(document.getElementById('ret-growth-rate').value)     || 5,
    inflationRate:    parseFloat(document.getElementById('ret-inflation-rate').value)  || 2.5,
    cppMatt:          parseFloat(document.getElementById('ret-cpp-matt').value)        || 900,
    cppHolly:         parseFloat(document.getElementById('ret-cpp-holly').value)       || 600,
  });
  closeModal('ret-input-modal');
  renderRetirement();
  hhToast('Retirement inputs saved!', 'success');
}

// Project future value of a portfolio: FV = PV*(1+r)^n + PMT*[((1+r)^n -1)/r]
function projectFV(currentBalance, monthlyContrib, annualRate, years) {
  if (years <= 0) return currentBalance;
  var r = annualRate / 100 / 12;
  var n = years * 12;
  if (r === 0) return currentBalance + monthlyContrib * n;
  return currentBalance * Math.pow(1+r, n) + monthlyContrib * ((Math.pow(1+r,n)-1)/r);
}

// CPP 2024: max ~$1,364/mo at 65. OAS: ~$700/mo at 65.
// Simple linear CPP reduction for early take-up: -0.6%/month before 65, +0.7%/month after 65
function estimateCPP(baseCPP, takeupAge) {
  var diff = takeupAge - 65;
  if (diff < 0) return baseCPP * (1 + diff * 12 * 0.006);
  if (diff > 0) return baseCPP * (1 + diff * 12 * 0.007);
  return baseCPP;
}

function oasAtAge(takeupAge) {
  // OAS 2024 ~$713/mo at 65, deferred to 70 = +36%
  var base = 713;
  var diff = Math.max(0, Math.min(5, takeupAge - 65));
  return Math.round(base * (1 + diff * 0.072));
}

function renderRetirement() {
  var rd = getRetInputs();
  var hasData = rd.mattAge && rd.mattRetireAge;

  // ── No-data prompt ────────────────────────────────────────────────────────
  var summaryBar = document.getElementById('ret-summary-bar');
  if (!hasData) {
    if (summaryBar) summaryBar.innerHTML = '<div class="card" style="text-align:center;padding:32px 24px">'
      + '<div style="font-size:40px;margin-bottom:12px">📊</div>'
      + '<div style="font-size:16px;font-weight:700;margin-bottom:6px">Set up your retirement projection</div>'
      + '<div style="font-size:13px;color:var(--muted);margin-bottom:18px">Enter your ages, income, pension details, and savings — and see your projected retirement income.</div>'
      + '<button class="btn btn-primary" onclick="openRetirementInputModal()">✏️ Enter Retirement Inputs</button></div>';
    ['ret-matt-card','ret-holly-card','ret-income-card','ret-chart-card','ret-tips-card'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.innerHTML = '';
    });
    return;
  }

  var gr    = (rd.growthRate    || 5);
  var infR  = (rd.inflationRate || 2.5);
  var now   = new Date().getFullYear();

  // ── Matt projections ──────────────────────────────────────────────────────
  var mattYearsToRetire = Math.max(0, (rd.mattRetireAge||60) - (rd.mattAge||35));
  var mattRetireYear    = now + mattYearsToRetire;
  var mattPensionMode   = rd.mattPensionMode || 'db';
  // Use career projected final salary if available, else fall back to retirement input salary
  var mattM = (state.members||[]).find(function(m){ return !m.hasTips && (m.incomeType==='salary'||m.hasPension); }) || (state.members||[])[0];
  var mattCareerFinalSalary = mattM ? getCareerFinalSalary(mattM.id) : 0;
  var mattEffectiveSalary   = mattCareerFinalSalary > 0 ? mattCareerFinalSalary : (rd.mattSalary||0);
  var mattPensionIncome = mattPensionMode === 'db'
    ? Math.round((rd.mattPensionPct||2)/100 * (rd.mattPensionYears||0) * mattEffectiveSalary)
    : 0;
  // DC: monthly = salary × (emp% + match%) / 12, stored as mattRrspMonthly at save time
  var mattEmpMonthly   = mattPensionMode === 'dc' ? Math.round(mattEffectiveSalary * (rd.mattEmpPct||0)   / 100 / 12) : 0;
  var mattMatchMonthly = mattPensionMode === 'dc' ? Math.round(mattEffectiveSalary * (rd.mattMatchPct||0) / 100 / 12) : 0;
  var mattRrspFV  = projectFV(rd.mattRrsp||0, rd.mattRrspMonthly||0, gr, mattYearsToRetire);
  var mattTfsaFV  = projectFV(rd.mattTfsa||0, rd.mattTfsaMonthly||0, gr, mattYearsToRetire);
  var mattCppMo   = estimateCPP(rd.cppMatt||900, Math.min(70, Math.max(60, rd.mattRetireAge||65)));
  var mattOasMo   = oasAtAge(Math.min(70, Math.max(65, rd.mattRetireAge||65)));
  var mattRrspMonthlyDraw = mattRrspFV > 0 ? Math.round(mattRrspFV * (gr/100/12) / (1 - Math.pow(1+gr/100/12,-300))) : 0;
  var mattTfsaMonthlyDraw = mattTfsaFV > 0 ? Math.round(mattTfsaFV * (gr/100/12) / (1 - Math.pow(1+gr/100/12,-300))) : 0;
  var mattTotalMonthly = Math.round(mattPensionIncome/12) + mattCppMo + mattOasMo + mattRrspMonthlyDraw + mattTfsaMonthlyDraw;

  // ── Holly projections ─────────────────────────────────────────────────────
  var hollyYearsToRetire = Math.max(0, (rd.hollyRetireAge||60) - (rd.hollyAge||33));
  var hollyRetireYear    = now + hollyYearsToRetire;
  var hollyPensionMode   = rd.hollyPensionMode || 'none';
  var hollyM = (state.members||[]).find(function(m){ return m.hasTips; }) || (state.members||[])[1];
  var hollyCareerFinalSalary = hollyM ? getCareerFinalSalary(hollyM.id) : 0;
  var hollyEffectiveSalary   = hollyCareerFinalSalary > 0 ? hollyCareerFinalSalary : (rd.hollyIncome||0);
  var hollyPensionIncome = hollyPensionMode === 'db'
    ? Math.round((rd.hollyPensionPct||2)/100 * (rd.hollyPensionYears||0) * hollyEffectiveSalary)
    : 0;
  var hollyEmpMonthly   = hollyPensionMode === 'dc' ? Math.round(hollyEffectiveSalary * (rd.hollyEmpPct||0)   / 100 / 12) : 0;
  var hollyMatchMonthly = hollyPensionMode === 'dc' ? Math.round(hollyEffectiveSalary * (rd.hollyMatchPct||0) / 100 / 12) : 0;
  var hollyRrspFV  = projectFV(rd.hollyRrsp||0, rd.hollyRrspMonthly||0, gr, hollyYearsToRetire);
  var hollyTfsaFV  = projectFV(rd.hollyTfsa||0, rd.hollyTfsaMonthly||0, gr, hollyYearsToRetire);
  var hollyCppMo   = estimateCPP(rd.cppHolly||600, Math.min(70, Math.max(60, rd.hollyRetireAge||65)));
  var hollyOasMo   = oasAtAge(Math.min(70, Math.max(65, rd.hollyRetireAge||65)));
  var hollyRrspMonthlyDraw = hollyRrspFV > 0 ? Math.round(hollyRrspFV * (gr/100/12) / (1 - Math.pow(1+gr/100/12,-300))) : 0;
  var hollyTfsaMonthlyDraw = hollyTfsaFV > 0 ? Math.round(hollyTfsaFV * (gr/100/12) / (1 - Math.pow(1+gr/100/12,-300))) : 0;
  var hollyTotalMonthly = Math.round(hollyPensionIncome/12) + hollyCppMo + hollyOasMo + hollyRrspMonthlyDraw + hollyTfsaMonthlyDraw;

  var householdMonthly = mattTotalMonthly + hollyTotalMonthly;

  // ── Summary bar ───────────────────────────────────────────────────────────
  if (summaryBar) {
    summaryBar.innerHTML = '<div class="card" style="padding:14px 18px">'
      + '<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">'
      + '<div><div style="font-size:22px;font-weight:900;color:var(--green)">' + fmt(householdMonthly) + '/mo</div><div style="font-size:11px;color:var(--muted)">Projected Household Retirement Income</div></div>'
      + '<div><div style="font-size:22px;font-weight:900;color:var(--accent)">' + fmt(mattRrspFV + mattTfsaFV + hollyRrspFV + hollyTfsaFV) + '</div><div style="font-size:11px;color:var(--muted)">Projected Portfolio at Retirement</div></div>'
      + '<div><div style="font-size:18px;font-weight:800;color:var(--text)">' + mattRetireYear + '</div><div style="font-size:11px;color:var(--muted)">Matt retires (age ' + (rd.mattRetireAge||60) + ')</div></div>'
      + '<div><div style="font-size:18px;font-weight:800;color:var(--text)">' + hollyRetireYear + '</div><div style="font-size:11px;color:var(--muted)">Holly retires (age ' + (rd.hollyRetireAge||60) + ')</div></div>'
      + '</div></div>';
  }

  // ── Matt card ─────────────────────────────────────────────────────────────
  var mattCard = document.getElementById('ret-matt-card');
  if (mattCard) {
    var mattPensionRow = mattPensionMode === 'db'
      ? _tstat((rd.mattPensionYears||0) + ' yrs @ ' + (rd.mattPensionPct||2) + '%', 'DB Pension Formula')
        + _tstat(fmt(mattPensionIncome) + '/yr', 'Projected Pension Income', 'var(--accent)')
      : _tstat((rd.mattEmpPct||0) + '% + ' + (rd.mattMatchPct||0) + '% match', 'DC Pension Contributions')
        + _tstat(fmt(rd.mattRrspMonthly||0) + '/mo', 'Total Pension → RRSP/mo', 'var(--accent)');
    var mattCareerNote = (mattCareerFinalSalary > 0 && mattCareerFinalSalary !== (rd.mattSalary||0))
      ? '<div style="font-size:11px;color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent);border-radius:6px;padding:5px 8px;margin-bottom:8px">💼 Pension formula uses projected final salary of <strong>' + fmt(mattCareerFinalSalary) + '</strong> from Career Planner — higher than current salary of ' + fmt(rd.mattSalary||0) + '</div>'
      : '';
    mattCard.innerHTML = '<div class="card" style="height:100%">'
      + '<div class="card-title">👔 Matt — Retirement at ' + (rd.mattRetireAge||60) + ' (' + mattRetireYear + ')</div>'
      + mattCareerNote
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
      + _tstat((rd.mattAge||'?') + ' yrs',    'Current Age')
      + _tstat(mattYearsToRetire + ' yrs',    'Years to Retire')
      + _tstat(fmt(mattEffectiveSalary||0),   mattCareerFinalSalary > 0 ? 'Final Salary (Career Projected)' : 'Current Salary')
      + mattPensionRow
      + _tstat(fmt(mattRrspFV),                'RRSP at Retirement', 'var(--green)')
      + _tstat(fmt(mattTfsaFV),                'TFSA at Retirement', 'var(--green)')
      + _tstat(fmt(mattCppMo) + '/mo',         'CPP Est. at ' + (rd.mattRetireAge||65))
      + '</div>'
      + '<div style="background:color-mix(in srgb,var(--green) 10%,transparent);border-radius:8px;padding:10px 12px">'
      + '<div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:6px">Monthly Retirement Income Breakdown</div>'
      + '<div style="display:flex;flex-direction:column;gap:4px;font-size:13px">'
      + (mattPensionMode === 'db' ? _retRow('🏛️ Pension', fmt(Math.round(mattPensionIncome/12)) + '/mo') : '')
      + (mattPensionMode === 'dc'
          ? _retRow('💼 Your contributions (' + (rd.mattEmpPct||0) + '%)', fmt(mattEmpMonthly) + '/mo')
            + _retRow('🤝 Employer match (' + (rd.mattMatchPct||0) + '%)', fmt(mattMatchMonthly) + '/mo')
          : '')
      + _retRow('🏦 CPP',            fmt(mattCppMo) + '/mo')
      + _retRow('🇨🇦 OAS',           fmt(mattOasMo) + '/mo')
      + _retRow('📈 RRSP drawdown',  fmt(mattRrspMonthlyDraw) + '/mo')
      + _retRow('💰 TFSA drawdown',  fmt(mattTfsaMonthlyDraw) + '/mo')
      + '<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px;display:flex;justify-content:space-between;font-weight:900">'
      + '<span>Total</span><span style="color:var(--green);font-size:16px">' + fmt(mattTotalMonthly) + '/mo</span></div>'
      + '</div></div></div>';
  }

  // ── Holly card ────────────────────────────────────────────────────────────
  var hollyCard = document.getElementById('ret-holly-card');
  if (hollyCard) {
    var hollyPensionRow = hollyPensionMode === 'db'
      ? _tstat((rd.hollyPensionYears||0) + ' yrs @ ' + (rd.hollyPensionPct||2) + '%', 'DB Pension Formula')
        + _tstat(fmt(hollyPensionIncome) + '/yr', 'Projected Pension Income', 'var(--accent)')
      : hollyPensionMode === 'dc'
        ? _tstat((rd.hollyEmpPct||0) + '% + ' + (rd.hollyMatchPct||0) + '% match', 'DC Pension Contributions')
          + _tstat(fmt(rd.hollyRrspMonthly||0) + '/mo', 'Total Pension → RRSP/mo', 'var(--accent)')
        : '';
    hollyCard.innerHTML = '<div class="card" style="height:100%">'
      + '<div class="card-title">💅 Holly — Retirement at ' + (rd.hollyRetireAge||60) + ' (' + hollyRetireYear + ')</div>'
      + (hollyCareerFinalSalary > 0 && hollyCareerFinalSalary !== (rd.hollyIncome||0)
          ? '<div style="font-size:11px;color:var(--member2);background:color-mix(in srgb,var(--member2) 8%,transparent);border-radius:6px;padding:5px 8px;margin-bottom:8px">💼 Using projected income of <strong>' + fmt(hollyCareerFinalSalary) + '</strong> from Career Planner</div>'
          : '')
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
      + _tstat((rd.hollyAge||'?') + ' yrs',   'Current Age')
      + _tstat(hollyYearsToRetire + ' yrs',   'Years to Retire')
      + _tstat(fmt(hollyEffectiveSalary||0),  hollyCareerFinalSalary > 0 ? 'Final Income (Career Projected)' : 'Current Income')
      + hollyPensionRow
      + _tstat(fmt(hollyRrspFV),               'RRSP at Retirement', 'var(--green)')
      + _tstat(fmt(hollyTfsaFV),               'TFSA at Retirement', 'var(--green)')
      + _tstat(fmt(hollyCppMo) + '/mo',        'CPP Est. at ' + (rd.hollyRetireAge||65))
      + '</div>'
      + '<div style="background:color-mix(in srgb,var(--green) 10%,transparent);border-radius:8px;padding:10px 12px">'
      + '<div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:6px">Monthly Retirement Income Breakdown</div>'
      + '<div style="display:flex;flex-direction:column;gap:4px;font-size:13px">'
      + (hollyPensionMode === 'db' ? _retRow('🏛️ Pension', fmt(Math.round(hollyPensionIncome/12)) + '/mo') : '')
      + (hollyPensionMode === 'dc'
          ? _retRow('💼 Your contributions (' + (rd.hollyEmpPct||0) + '%)', fmt(hollyEmpMonthly) + '/mo')
            + _retRow('🤝 Employer match (' + (rd.hollyMatchPct||0) + '%)', fmt(hollyMatchMonthly) + '/mo')
          : '')
      + _retRow('🏦 CPP',           fmt(hollyCppMo) + '/mo')
      + _retRow('🇨🇦 OAS',          fmt(hollyOasMo) + '/mo')
      + _retRow('📈 RRSP drawdown', fmt(hollyRrspMonthlyDraw) + '/mo')
      + _retRow('💰 TFSA drawdown', fmt(hollyTfsaMonthlyDraw) + '/mo')
      + '<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px;display:flex;justify-content:space-between;font-weight:900">'
      + '<span>Total</span><span style="color:var(--green);font-size:16px">' + fmt(hollyTotalMonthly) + '/mo</span></div>'
      + '</div></div></div>';
  }

  // ── Combined income card ──────────────────────────────────────────────────
  var incCard = document.getElementById('ret-income-card');
  if (incCard) {
    // Use career-projected effective salaries for a more accurate replacement ratio
    var currentIncome = (mattEffectiveSalary||rd.mattSalary||0) + (hollyEffectiveSalary||rd.hollyIncome||0);
    var replacementPct = currentIncome > 0 ? Math.round(householdMonthly / (currentIncome/12) * 100) : 0;
    var replColor = replacementPct >= 80 ? 'var(--green)' : replacementPct >= 60 ? 'var(--yellow)' : 'var(--red)';
    incCard.innerHTML = '<div class="card">'
      + '<div class="card-title">🏠 Combined Household Retirement Income</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">'
      + _tstat(fmt(mattTotalMonthly) + '/mo',   'Matt\'s Income')
      + _tstat(fmt(hollyTotalMonthly) + '/mo',  'Holly\'s Income')
      + _tstat(fmt(householdMonthly) + '/mo',   'Combined Monthly', 'var(--green)')
      + _tstat(fmt(householdMonthly*12) + '/yr','Combined Annual', 'var(--green)')
      + _tstat(replacementPct + '%',            'Income Replacement', replColor)
      + _tstat(gr + '% / ' + infR + '%',        'Growth / Inflation Assumed')
      + '</div>'
      + '<div style="background:var(--bg);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text2)">'
      + (replacementPct >= 80
        ? '<span style="color:var(--green);font-weight:700">✅ On track!</span> Your projected ' + replacementPct + '% income replacement ratio meets the 80% benchmark financial planners recommend.'
        : replacementPct >= 60
          ? '<span style="color:var(--yellow);font-weight:700">⚠️ Getting there.</span> Projected replacement is ' + replacementPct + '%. Aim for 80%+ — increasing RRSP or TFSA contributions will close the gap.'
          : '<span style="color:var(--red);font-weight:700">📉 Needs attention.</span> Projected replacement is only ' + replacementPct + '%. Consider increasing monthly savings, delaying retirement, or speaking with a financial advisor.')
      + '<br><span style="color:var(--muted);font-size:11px">Projections use a ' + gr + '% annual growth rate and are estimates only. Consult a licensed financial planner for personalized advice.</span>'
      + '</div></div>';
  }

  // ── Portfolio growth chart ─────────────────────────────────────────────────
  var chartCard = document.getElementById('ret-chart-card');
  if (chartCard) {
    var maxYears = Math.max(mattYearsToRetire, hollyYearsToRetire, 1);
    var labels = [], mattVals = [], hollyVals = [], combinedVals = [];
    for (var y = 0; y <= maxYears; y += Math.max(1, Math.floor(maxYears/10))) {
      labels.push(now + y);
      var mv = projectFV(rd.mattRrsp||0, rd.mattRrspMonthly||0, gr, y) + projectFV(rd.mattTfsa||0, rd.mattTfsaMonthly||0, gr, y);
      var hv = projectFV(rd.hollyRrsp||0, rd.hollyRrspMonthly||0, gr, y) + projectFV(rd.hollyTfsa||0, rd.hollyTfsaMonthly||0, gr, y);
      mattVals.push(Math.round(mv));
      hollyVals.push(Math.round(hv));
      combinedVals.push(Math.round(mv + hv));
    }
    chartCard.innerHTML = '<div class="card">'
      + '<div class="card-title">📈 Portfolio Growth Projection (RRSP + TFSA)</div>'
      + '<div style="position:relative;height:240px"><canvas id="ret-growth-chart"></canvas></div>'
      + '</div>';
    setTimeout(function() {
      var ctx = document.getElementById('ret-growth-chart');
      if (!ctx) return;
      if (ctx._retChart) ctx._retChart.destroy();
      ctx._retChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            { label: 'Matt', data: mattVals,     borderColor: '#4f8ef7', backgroundColor: 'rgba(79,142,247,0.08)', tension: 0.3, fill: false },
            { label: 'Holly', data: hollyVals,   borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,0.08)', tension: 0.3, fill: false },
            { label: 'Combined', data: combinedVals, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', tension: 0.3, fill: true },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function(c){ return c.dataset.label+': $'+c.raw.toLocaleString(); } } } },
          scales: { y: { ticks: { callback: function(v){ return '$'+Math.round(v/1000)+'k'; } } } }
        }
      });
    }, 100);
  }

  // ── Ontario retirement tips ────────────────────────────────────────────────
  var tipsCard = document.getElementById('ret-tips-card');
  if (tipsCard) {
    tipsCard.innerHTML = '<div class="card">'
      + '<div class="card-title">💡 Ontario Retirement Planning Tips</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">'
      + _deadline('RRSP vs TFSA', 'RRSP is best while income is high (Matt now) — deduction reduces taxable income. TFSA is better once retired — withdrawals are tax-free and don\'t affect OAS/GIS clawbacks.')
      + _deadline('CPP Timing', 'Taking CPP early (60) means 36% less. Waiting to 70 means 42% more than at 65. If healthy, deferring pays off after ~12 years.')
      + _deadline('OAS Clawback', 'OAS is clawed back at 15 cents per dollar above ~$90,997 (2024). Keep registered income streams planned to stay below the threshold.')
      + _deadline('DB Pension Value', 'Matt\'s defined benefit pension is gold — it\'s a guaranteed, inflation-indexed income stream. Factor in the bridge benefit (if any) that stops at 65 when CPP starts.')
      + _deadline('Pension Splitting', 'In retirement, eligible pension income (including RRIF) can be split with a spouse for tax purposes — potentially moving income to a lower bracket.')
      + _deadline('Ontario OAS Supplement', 'Low-income retirees may qualify for the Guaranteed Income Supplement (GIS). Holly\'s income from tips should be factored into eligibility calculations.')
      + '</div></div>';
  }
}

function _retRow(label, val) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0">'
    + '<span style="color:var(--muted)">' + label + '</span>'
    + '<span style="font-weight:700;color:var(--text)">' + val + '</span></div>';
}

// PET CARE TRACKER

function getPetAlerts() {
  var alerts = [];
  var today = new Date(); today.setHours(0,0,0,0);
  (state.pets||[]).forEach(function(pet) {
    (pet.vaccinations||[]).forEach(function(v) {
      if (!v.nextDate) return;
      var nd = new Date(v.nextDate+'T00:00:00');
      var days = Math.ceil((nd - today)/86400000);
      if (days <= 30) alerts.push({ pet: pet.name, emoji: pet.emoji, type: 'vaccine', name: v.name, days: days });
    });
    (pet.medications||[]).forEach(function(m) {
      if (!m.nextDue) return;
      var nd = new Date(m.nextDue+'T00:00:00');
      var days = Math.ceil((nd - today)/86400000);
      if (days <= 14) alerts.push({ pet: pet.name, emoji: pet.emoji, type: 'med', name: m.name, days: days });
    });
  });
  return alerts;
}

function renderPetsPage() {
  var pets = state.pets || [];
  if (!pets.length) {
    document.getElementById('pets-page-cards').innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px">No pets configured — add pets in ⚙️ Setup first!</div>';
    document.getElementById('pets-alert-bar').innerHTML = '';
    return;
  }
  var today = new Date(); today.setHours(0,0,0,0);

  // Pet spend from transactions
  var petYtd = getPetSpend(new Date().getFullYear());
  var petMonth = (state.transactions||[]).filter(function(t){
    var d=new Date(t.date); var n=new Date();
    return t.category==='pets' && d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth();
  }).reduce(function(s,t){return s+Math.abs(t.amount);},0);
  var spendBar = document.getElementById('pets-spend-bar');
  if (spendBar) {
    spendBar.innerHTML = petYtd > 0 || petMonth > 0
      ? '<div class="card" style="padding:10px 16px;margin-bottom:12px;display:flex;gap:24px;flex-wrap:wrap;align-items:center">'
        + '<div><div style="font-size:18px;font-weight:900;color:var(--accent)">'+fmt(petMonth)+'</div><div style="font-size:11px;color:var(--muted)">Pet Spend This Month</div></div>'
        + '<div><div style="font-size:18px;font-weight:900;color:var(--text)">'+fmt(petYtd)+'</div><div style="font-size:11px;color:var(--muted)">Pet Spend YTD</div></div>'
        + '<div style="font-size:12px;color:var(--muted)">Categorize pet transactions as <strong>Pets</strong> to track spend here.</div>'
        + '</div>'
      : '<div style="font-size:12px;color:var(--muted);padding:0 0 8px">Categorize pet transactions as <strong>Pets</strong> to see monthly spend here.</div>';
  }

  // Alert bar
  var alerts = getPetAlerts();
  document.getElementById('pets-alert-bar').innerHTML = alerts.map(function(a) {
    var urgency = a.days < 0 ? 'var(--red)' : a.days <= 7 ? 'var(--yellow)' : 'var(--accent)';
    var label = a.days < 0 ? 'OVERDUE by '+Math.abs(a.days)+' days' : a.days === 0 ? 'due TODAY' : 'due in '+a.days+' day'+(a.days===1?'':'s');
    return '<div class="alert" style="border-left:4px solid '+urgency+';background:color-mix(in srgb,'+urgency+' 8%,var(--card));margin-bottom:6px">'+a.emoji+' <strong>'+a.pet+'</strong> — '+(a.type==='vaccine'?'💉 Vaccine':'💊 Medication')+': '+a.name+' <span style="color:'+urgency+';font-weight:700">'+label+'</span></div>';
  }).join('');

  // Per-pet cards
  document.getElementById('pets-page-cards').innerHTML = pets.map(function(pet) {
    // Age
    var ageStr = '';
    if (pet.dob) {
      var dob = new Date(pet.dob+'T00:00:00');
      var months = (today.getFullYear()-dob.getFullYear())*12 + (today.getMonth()-dob.getMonth());
      ageStr = months >= 24 ? Math.floor(months/12)+' yrs' : months+' mo';
    }
    // Annual vet cost
    var annualVet = (pet.vetVisits||[]).filter(function(v){
      return v.date && new Date(v.date+'T00:00:00').getFullYear() === today.getFullYear();
    }).reduce(function(s,v){return s+(v.cost||0);},0);
    // Vet visits table
    var vetRows = (pet.vetVisits||[]).slice().sort(function(a,b){return b.date.localeCompare(a.date);}).map(function(v) {
      return '<tr><td>'+v.date+'</td><td>'+v.reason+'</td><td>'+fmt(v.cost||0)+'</td><td style="color:var(--muted);font-size:11px">'+( v.notes||'')+'</td><td><button class="btn btn-danger btn-sm" onclick="deletePetVetVisit(\''+pet.id+'\',\''+v.id+'\')">🗑️</button></td></tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No vet visits logged yet.</td></tr>';
    // Vaccinations
    var vaccRows = (pet.vaccinations||[]).map(function(v) {
      var nd = v.nextDate ? new Date(v.nextDate+'T00:00:00') : null;
      var days = nd ? Math.ceil((nd-today)/86400000) : null;
      var statusColor = days===null?'var(--muted)':days<0?'var(--red)':days<=30?'var(--yellow)':'var(--green)';
      var statusTxt = days===null?'—':days<0?'Overdue '+Math.abs(days)+'d':days===0?'Today!':days+'d';
      return '<tr><td style="font-weight:600">'+v.name+'</td><td>'+(v.lastDate||'—')+'</td><td>'+(v.nextDate||'—')+'</td><td style="color:'+statusColor+';font-weight:700">'+statusTxt+'</td><td><button class="btn btn-danger btn-sm" onclick="deletePetVacc(\''+pet.id+'\',\''+v.id+'\')">🗑️</button></td></tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No vaccinations logged.</td></tr>';
    // Medications
    var medRows = (pet.medications||[]).map(function(m) {
      var nd = m.nextDue ? new Date(m.nextDue+'T00:00:00') : null;
      var days = nd ? Math.ceil((nd-today)/86400000) : null;
      var statusColor = days===null?'var(--muted)':days<0?'var(--red)':days<=7?'var(--yellow)':'var(--green)';
      var statusTxt = days===null?'—':days<0?'Overdue':days===0?'Today!':days+'d';
      return '<tr><td style="font-weight:600">'+m.name+'</td><td style="font-size:12px;color:var(--muted)">'+( m.dose||'')+'</td><td style="font-size:12px">'+( m.frequency||'')+'</td><td>'+(m.nextDue||'—')+'</td><td style="color:'+statusColor+';font-weight:700">'+statusTxt+'</td><td><button class="btn btn-danger btn-sm" onclick="deletePetMed(\''+pet.id+'\',\''+m.id+'\')">🗑️</button></td></tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No medications logged.</td></tr>';

    return '<div class="card" style="margin-bottom:20px">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px">'+
      '<div style="display:flex;align-items:center;gap:14px">'+
      '<div style="font-size:44px;line-height:1">'+pet.emoji+'</div>'+
      '<div>'+
        '<div style="font-size:20px;font-weight:900">'+pet.name+'</div>'+
        '<div style="font-size:12px;color:var(--muted)">'+(pet.type||'Pet')+(ageStr?' &nbsp;·&nbsp; '+ageStr:'')+(pet.weight?' &nbsp;·&nbsp; '+pet.weight+' kg':'')+'</div>'+
        '<div style="font-size:12px;color:var(--muted)">Vet costs this year: <strong style="color:var(--text)">'+fmt(annualVet)+'</strong></div>'+
      '</div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        '<button class="btn btn-ghost btn-sm" onclick="openPetProfileModal(\''+pet.id+'\')">✏️ Profile</button>'+
        '<button class="btn btn-ghost btn-sm" onclick="openPetVetModal(\''+pet.id+'\')">🏥 Log Visit</button>'+
        '<button class="btn btn-ghost btn-sm" onclick="openPetVaccModal(\''+pet.id+'\')">💉 Add Vaccine</button>'+
        '<button class="btn btn-primary btn-sm" onclick="openPetMedModal(\''+pet.id+'\')">💊 Add Med</button>'+
      '</div></div>'+
      // Vet visits
      '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:800;color:var(--muted);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:8px">🏥 Vet Visits</div>'+
      '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Reason</th><th>Cost</th><th>Notes</th><th></th></tr></thead><tbody>'+vetRows+'</tbody></table></div></div>'+
      // Vaccinations
      '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:800;color:var(--muted);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:8px">💉 Vaccinations</div>'+
      '<div class="table-wrap"><table><thead><tr><th>Vaccine</th><th>Last Given</th><th>Next Due</th><th>Status</th><th></th></tr></thead><tbody>'+vaccRows+'</tbody></table></div></div>'+
      // Medications
      '<div><div style="font-size:12px;font-weight:800;color:var(--muted);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:8px">💊 Medications & Treatments</div>'+
      '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Dose</th><th>Frequency</th><th>Next Due</th><th>Status</th><th></th></tr></thead><tbody>'+medRows+'</tbody></table></div></div>'+
      '</div>';
  }).join('');
}

// --- Pet modal openers ---
function openPetVetModal(petId) {
  _petModalTarget = petId || (state.pets&&state.pets[0]&&state.pets[0].id) || null;
  _populatePetSelect('pvet-pet-select', _petModalTarget);
  document.getElementById('pvet-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('pvet-reason').value = '';
  document.getElementById('pvet-cost').value = '';
  document.getElementById('pvet-notes').value = '';
  openModal('pet-vet-modal');
}
function openPetVaccModal(petId) {
  _petModalTarget = petId || (state.pets&&state.pets[0]&&state.pets[0].id) || null;
  _populatePetSelect('pvacc-pet-select', _petModalTarget);
  document.getElementById('pvacc-name').value = '';
  document.getElementById('pvacc-last').value = '';
  document.getElementById('pvacc-next').value = '';
  openModal('pet-vacc-modal');
}
function openPetMedModal(petId) {
  _petModalTarget = petId || (state.pets&&state.pets[0]&&state.pets[0].id) || null;
  _populatePetSelect('pmed-pet-select', _petModalTarget);
  document.getElementById('pmed-name').value = '';
  document.getElementById('pmed-dose').value = '';
  document.getElementById('pmed-freq').value = '';
  document.getElementById('pmed-next').value = '';
  openModal('pet-med-modal');
}
function openPetProfileModal(petId) {
  var pet = (state.pets||[]).find(function(p){return p.id===petId;});
  if (!pet) return;
  document.getElementById('pprof-id').value = petId;
  document.getElementById('pprof-dob').value = pet.dob || '';
  document.getElementById('pprof-weight').value = pet.weight || '';
  document.getElementById('pprof-title').textContent = '✏️ ' + pet.name + ' — Profile';
  openModal('pet-profile-modal');
}
function _populatePetSelect(selId, selectedId) {
  var sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = (state.pets||[]).map(function(p){
    return '<option value="'+p.id+'"'+(p.id===selectedId?' selected':'')+'>'+p.emoji+' '+p.name+'</option>';
  }).join('');
}

// --- Savers ---
function savePetVetVisit() {
  var petId = document.getElementById('pvet-pet-select').value;
  var pet = (state.pets||[]).find(function(p){return p.id===petId;});
  if (!pet) return;
  var reason = document.getElementById('pvet-reason').value.trim();
  if (!reason) { hhToast('Please enter a reason for the visit.','⚠️'); return; }
  if (!pet.vetVisits) pet.vetVisits = [];
  pet.vetVisits.push({ id:uid(), date:document.getElementById('pvet-date').value, reason:reason, cost:parseFloat(document.getElementById('pvet-cost').value)||0, notes:document.getElementById('pvet-notes').value.trim() });
  saveState(); closeModal('pet-vet-modal'); renderPetsPage(); hhToast('Vet visit logged!','🏥');
}
function savePetVacc() {
  var petId = document.getElementById('pvacc-pet-select').value;
  var pet = (state.pets||[]).find(function(p){return p.id===petId;});
  if (!pet) return;
  var name = document.getElementById('pvacc-name').value.trim();
  if (!name) { hhToast('Please enter a vaccine name.','⚠️'); return; }
  if (!pet.vaccinations) pet.vaccinations = [];
  pet.vaccinations.push({ id:uid(), name:name, lastDate:document.getElementById('pvacc-last').value, nextDate:document.getElementById('pvacc-next').value });
  saveState(); closeModal('pet-vacc-modal'); renderPetsPage(); hhToast('Vaccination saved!','💉');
}
function savePetMed() {
  var petId = document.getElementById('pmed-pet-select').value;
  var pet = (state.pets||[]).find(function(p){return p.id===petId;});
  if (!pet) return;
  var name = document.getElementById('pmed-name').value.trim();
  if (!name) { hhToast('Please enter a medication name.','⚠️'); return; }
  if (!pet.medications) pet.medications = [];
  pet.medications.push({ id:uid(), name:name, dose:document.getElementById('pmed-dose').value.trim(), frequency:document.getElementById('pmed-freq').value.trim(), nextDue:document.getElementById('pmed-next').value });
  saveState(); closeModal('pet-med-modal'); renderPetsPage(); hhToast('Medication saved!','💊');
}
function savePetProfile() {
  var petId = document.getElementById('pprof-id').value;
  var pet = (state.pets||[]).find(function(p){return p.id===petId;});
  if (!pet) return;
  pet.dob = document.getElementById('pprof-dob').value;
  pet.weight = document.getElementById('pprof-weight').value;
  saveState(); closeModal('pet-profile-modal'); renderPetsPage(); hhToast('Profile updated!','🐾');
}

// --- Deleters ---
function deletePetVetVisit(petId, visitId) {
  hhConfirm('Remove this vet visit?','🗑️','Remove').then(function(ok){
    if (!ok) return;
    var pet = (state.pets||[]).find(function(p){return p.id===petId;});
    if (pet) { pet.vetVisits = (pet.vetVisits||[]).filter(function(v){return v.id!==visitId;}); saveState(); renderPetsPage(); }
  });
}
function deletePetVacc(petId, vaccId) {
  hhConfirm('Remove this vaccination record?','🗑️','Remove').then(function(ok){
    if (!ok) return;
    var pet = (state.pets||[]).find(function(p){return p.id===petId;});
    if (pet) { pet.vaccinations = (pet.vaccinations||[]).filter(function(v){return v.id!==vaccId;}); saveState(); renderPetsPage(); }
  });
}
function deletePetMed(petId, medId) {
  hhConfirm('Remove this medication?','🗑️','Remove').then(function(ok){
    if (!ok) return;
    var pet = (state.pets||[]).find(function(p){return p.id===petId;});
    if (pet) { pet.medications = (pet.medications||[]).filter(function(m){return m.id!==medId;}); saveState(); renderPetsPage(); }
  });
}

// TIPS
function populateTipsGoalDropdown(){
  var sel=document.getElementById('tips-goal-id');if(!sel)return;
  var prev=sel.value;
  sel.innerHTML='<option value="">-- Select goal --</option>'+(state.goals||[]).map(function(g){return'<option value="'+g.id+'">'+g.emoji+' '+g.name+'</option>';}).join('');
  if(prev)sel.value=prev;
}
function calcTips(){
  var total=parseFloat(document.getElementById('tips-total-input').value)||0;
  var claimed=parseFloat(document.getElementById('tips-amount').value)||0;
  var unclaimed=Math.max(0,total-claimed);
  var goalAmt=parseFloat(document.getElementById('tips-goal-amt').value)||0;
  var set=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  set('tips-unclaimed-disp','$'+unclaimed.toFixed(2));
  set('tips-tax-disp','$'+(claimed*0.25).toFixed(2));
  set('tips-net-disp','$'+(claimed*0.75).toFixed(2));
  var prev=document.getElementById('tips-goal-preview');
  var gSel=document.getElementById('tips-goal-id');
  if(prev&&goalAmt>0&&gSel&&gSel.value){
    var gName=gSel.options[gSel.selectedIndex].text;
    var acct=document.getElementById('tips-goal-acct').value;
    prev.style.display='block';
    prev.innerHTML='&#10003; $'+goalAmt.toFixed(2)+' from <strong>'+acct+'</strong> will be logged to <strong>'+gName+'</strong>';
  } else if(prev){prev.style.display='none';}
}
function updateTipTotal(){calcTips();}
// Ensure Cash-Claimed and Cash-Unclaimed exist as real accounts in state.accounts
// using their type string as the id so existing tip transactions match without migration
function ensureCashAccounts() {
  if (!state.accounts) state.accounts = [];
  var tipsMember = getTipsMember();
  var person = tipsMember ? tipsMember.name : '';
  var CASH_DEFS = [
    { id: 'Cash-Claimed',   nickname: 'Cash Tips (Claimed)',   type: 'Cash-Claimed'   },
    { id: 'Cash-Unclaimed', nickname: 'Cash Tips (Unclaimed)', type: 'Cash-Unclaimed' }
  ];
  var changed = false;
  CASH_DEFS.forEach(function(def) {
    var exists = state.accounts.some(function(a){ return a.id === def.id; });
    if (!exists) {
      state.accounts.push({ id: def.id, nickname: def.nickname, type: def.type, person: person, isJoint: false });
      changed = true;
    }
  });
  if (changed) saveState();
}

function saveTips(){
  ensureCashAccounts();
  var editId=document.getElementById('tips-edit-id').value;
  var totalTips=parseFloat(document.getElementById('tips-total-input').value)||0;
  var claimed=parseFloat(document.getElementById('tips-amount').value)||0;
  var unclaimed=Math.max(0,totalTips-claimed);
  var goalAmt=parseFloat(document.getElementById('tips-goal-amt').value)||0;
  var goalId=(document.getElementById('tips-goal-id')||{}).value||'';
  var goalAcct=(document.getElementById('tips-goal-acct')||{}).value||'Cash-Claimed';
  var tipDate=document.getElementById('tips-date').value;
  var t={id:editId||uid(),date:tipDate,totalTips:totalTips,amount:claimed,cashAmount:unclaimed,goalAmount:goalAmt>0?goalAmt:0,goalId:goalId,goalAccount:goalAcct,notes:document.getElementById('tips-notes').value};
  if(editId){
    var idx=state.tips.findIndex(function(x){return x.id===editId;});
    state.tips[idx]=t;
    // remove old auto-generated tip transactions
    state.transactions=state.transactions.filter(function(tx){return tx.tipsId!==editId;});
  } else {
    state.tips.push(t);
  }

  // Create income transactions for tips so account balances update
  var dp=tipDate.split('-');
  var fmtDate=dp[1]+'/'+dp[2]+'/'+dp[0];

  if(claimed>0){
    // Claimed tips → deposited to Cash-Claimed (shows as income)
    state.transactions.push({id:uid(),date:fmtDate,description:'Tips — Claimed (Deposit)',amount:claimed,
      category:'income',person:(getTipsMember()||{name:'Joint'}).name,account:'Cash-Claimed',source:'tips',tipsId:t.id});
  }
  if(unclaimed>0){
    // Unclaimed tips → Cash-Unclaimed
    state.transactions.push({id:uid(),date:fmtDate,description:'Tips — Unclaimed Cash',amount:unclaimed,
      category:'income',person:(getTipsMember()||{name:'Joint'}).name,account:'Cash-Unclaimed',source:'tips',tipsId:t.id});
  }

  // Create a goal contribution transaction if goal was set
  if(goalAmt>0&&goalId){
    state.transactions.push({id:uid(),date:fmtDate,description:'Tips → goal',amount:goalAmt,
      category:'goal:'+goalId,person:(getTipsMember()||{name:'Joint'}).name,account:goalAcct,source:'tips',tipsId:t.id});
    // Deduct the goal contribution from the source account
    state.transactions.push({id:uid(),date:fmtDate,description:'Tips → goal (transfer out)',amount:-goalAmt,
      category:'transfer',person:(getTipsMember()||{name:'Joint'}).name,account:goalAcct==='Cash-Claimed'?'Cash-Claimed':'Cash-Unclaimed',source:'tips',tipsId:t.id});
  }

  saveState();closeModal('tips-modal');clearTipsForm();
  if(document.getElementById('page-tips').classList.contains('active'))renderTipsPage();
  if(document.getElementById('page-budget').classList.contains('active'))renderBudget();
  if(document.getElementById('page-dashboard').classList.contains('active'))renderDashboard();
  if(document.getElementById('page-goals').classList.contains('active'))renderGoals();
}
