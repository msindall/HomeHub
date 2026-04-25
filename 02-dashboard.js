function renderDashboard() {
  const now = new Date();
  // Update nav brand
  var household = state.household || {};
  var navBrand = document.getElementById('nav-brand');
  if (navBrand) navBrand.textContent = (household.emoji || '🏠') + ' ' + (household.name || 'Home Hub');
  document.getElementById('dashboard-date').textContent = now.toLocaleDateString('en-CA',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  var hr = now.getHours();
  var greet = hr < 12 ? 'Good morning! ☀️' : hr < 17 ? 'Good afternoon! 🌤️' : hr < 21 ? 'Good evening! 🌙' : 'Good night! 🌛';
  var greetEl = document.getElementById('dashboard-greeting');
  if (greetEl) {
    var hname = household.name ? ', ' + household.name.replace(/the |house|home/gi,'').trim() : '';
    greetEl.textContent = greet;
  }
  // Household composition strip
  var compHtml = '';
  var today = new Date();
  function dashAgeStr(dob) {
    if (!dob) return '';
    var d = new Date(dob);
    var mos = (today.getFullYear()-d.getFullYear())*12+(today.getMonth()-d.getMonth());
    if (mos < 12) return mos+'mo';
    return Math.floor(mos/12)+'yr';
  }
  (state.members||[]).forEach(function(m) {
    var age = m.dob ? ' · '+dashAgeStr(m.dob) : '';
    compHtml += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;background:'+(m.color||'var(--accent)')+'18;border:1.5px solid '+(m.color||'var(--accent)')+'40;font-size:12px;font-weight:700;color:'+(m.color||'var(--accent)')+'">&#x1F464; '+(m.name)+age+'</span>';
  });
  (state.children||[]).forEach(function(c) {
    var age = c.dob ? ' · '+dashAgeStr(c.dob) : '';
    var d = new Date(c.dob||'2000-01-01');
    var mos = (today.getFullYear()-d.getFullYear())*12+(today.getMonth()-d.getMonth());
    var ico = mos<12?'&#x1F476;':mos<36?'&#x1F9F8;':mos<72?'&#x1F9D2;':'&#x1F9D1;';
    compHtml += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;background:#f5e9c830;border:1.5px solid #c97d5a50;font-size:12px;font-weight:700;color:var(--accent)">'+ico+' '+(c.name)+age+'</span>';
  });
  (state.pets||[]).forEach(function(p) {
    compHtml += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;background:var(--green-light);border:1.5px solid var(--green)50;font-size:12px;font-weight:700;color:var(--green)">'+p.emoji+' '+p.name+'</span>';
  });
  if (compHtml) {
    var greetParent = greetEl ? greetEl.closest('.section-header') : null;
    var compStrip = document.getElementById('dash-comp-strip');
    if (!compStrip) {
      compStrip = document.createElement('div');
      compStrip.id = 'dash-comp-strip';
      compStrip.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px';
      var statsEl = document.getElementById('dashboard-stats');
      if (statsEl) statsEl.parentNode.insertBefore(compStrip, statsEl);
    }
    compStrip.innerHTML = compHtml;
  }

  renderPetToggles();
  renderWeatherWidget();
  const mk = getCurrentMonthKey();
  const mt = state.transactions.filter(t=>getMonthKey(t.date)===mk);
  const txnIncome = mt.filter(t=>t.amount>0 && t.category!=='transfer' && t.source!=='tips').reduce((s,t)=>s+t.amount,0);
  const expenses = mt.filter(t=>t.amount<0 && t.category!=='transfer' && t.source!=='tips').reduce((s,t)=>s+Math.abs(t.amount),0);
  const tipsThisMonth = getTipsForMonth(mk);
  const income = txnIncome + tipsThisMonth;
  const net = income - expenses;
  var tipsMember = getTipsMember();
  var tipsStatHtml = tipsMember
    ? `<div class="stat"><div class="stat-label">&#8627; incl. ${tipsMember.name}'s Tips</div><div class="stat-value" style="color:${tipsMember.color}">${fmt(tipsThisMonth)}</div><div class="stat-sub">Deposit: ${fmt(getTipsDepositForMonth(mk))} | Cash: ${fmt(tipsThisMonth-getTipsDepositForMonth(mk))}</div></div>`
    : '';

  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat"><div class="stat-label">Income This Month</div><div class="stat-value clr-green">${fmt(income)}</div></div>
    <div class="stat"><div class="stat-label">Expenses This Month</div><div class="stat-value clr-red">${fmt(expenses)}</div></div>
    <div class="stat"><div class="stat-label">Net This Month</div><div class="stat-value ${net>=0?'clr-green':'clr-red'}">${fmtSigned(net)}</div></div>
    ${tipsStatHtml}
  `;

  const todayStr = now.toISOString().split('T')[0];
  const todayEvents = state.calEvents.filter(e=>e.date===todayStr);
  document.getElementById('dash-today-events').innerHTML = todayEvents.length
    ? todayEvents.map(e=>{
        var color = getMemberColor(e.person);
        return '<div class="quick-stat"><div class="quick-icon" style="color:'+color+'">●</div><div class="fill"><div class="quick-val">'+e.title+'</div><div class="quick-label">'+e.person+(e.start?' · '+e.start:'')+'</div></div></div>';
      }).join('')
    : '<div style="color:var(--muted);font-size:13px;padding:8px 0">No events today — a free day! 🎉</div>';

  // Dynamic reminders — delegated to renderReminders()
  renderReminders();

  // Pet care alerts on dashboard
  var dashPetAlerts = document.getElementById('dash-pet-alerts');
  var petCareLink = document.getElementById('pet-care-link');
  if (dashPetAlerts && isFeatureOn('pets')) {
    var petAlerts = getPetAlerts();
    if (petAlerts.length) {
      dashPetAlerts.innerHTML = petAlerts.slice(0,3).map(function(a){
        var urgency = a.days < 0 ? 'var(--red)' : a.days <= 7 ? 'var(--yellow)' : 'var(--muted)';
        return '<div style="font-size:11px;color:'+urgency+';margin-top:3px">'+a.emoji+' '+a.pet+': '+(a.type==='vaccine'?'💉':'💊')+' '+a.name+' '+(a.days<0?'OVERDUE':a.days===0?'due today':'in '+a.days+'d')+'</div>';
      }).join('');
      if (petCareLink) petCareLink.style.display = '';
    } else {
      dashPetAlerts.innerHTML = '';
      if (petCareLink) petCareLink.style.display = 'none';
    }
  }

  const recent = [...state.transactions].sort((a,b)=>parseDate(b.date)-parseDate(a.date)).slice(0,6);
  document.getElementById('dash-recent').innerHTML = recent.map(t=>{
    const cat=getCatById(t.category);
    return `<div class="quick-stat"><div class="quick-icon" style="color:${cat.color}">●</div><div class="fill"><div class="quick-val">${t.description.substring(0,26)}</div><div class="quick-label">${t.date} · ${cat.name}</div></div><div style="color:${t.amount<0?'var(--red)':'var(--green)'};font-weight:700">${fmtSigned(t.amount)}</div></div>`;
  }).join('') || '<div style="color:var(--muted);font-size:13px;padding:8px 0">No transactions yet — upload a statement!</div>';

  document.getElementById('dash-goals').innerHTML = (state.goals||[]).slice(0,4).map(g=>{
    const contributed = getGoalContributions(g.id);
    const totalSaved = g.current + contributed;
    const pct=Math.min(100,Math.round((totalSaved/g.target)*100));
    return '<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px"><span>'+g.emoji+' '+g.name+'</span><span style="color:var(--muted)">'+pct+'%</span></div><div class="progress-bar"><div class="progress-fill" style="width:'+pct+'%;background:var(--accent)"></div></div><div style="font-size:11px;color:var(--muted)">'+fmt(totalSaved)+' of '+fmt(g.target)+'</div></div>';
  }).join('') || '<div style="color:var(--muted);font-size:13px;padding:8px 0">No goals yet — add them in the Goals tab!</div>';

  const catSpend={};
  mt.filter(t=>t.amount<0).forEach(t=>{ catSpend[t.category]=(catSpend[t.category]||0)+Math.abs(t.amount); });
  const sortedCats=Object.entries(catSpend).sort((a,b)=>b[1]-a[1]).slice(0,8);
  document.getElementById('dash-categories').innerHTML = sortedCats.map(([catId,amt])=>{
    const cat=getCatById(catId); const budget=state.budgets[catId]||0; const pct=budget?Math.min(100,Math.round((amt/budget)*100)):0;
    return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><span><span class="cat-dot" style="background:${cat.color}"></span>${cat.name}</span><span>${fmt(amt)}${budget?' / '+fmt(budget):''}</span></div>${budget?`<div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pct>90?'var(--red)':pct>70?'var(--yellow)':cat.color}"></div></div>`:''}</div>`;
  }).join('') || '<div style="color:var(--muted)">No spending this month yet.</div>';

  // Wedding dashboard widget
  var dashWedding = document.getElementById('dash-wedding-wrap');
  if (dashWedding && isFeatureOn('wedding')) {
    var w = state.wedding || {};
    var vendors = state.weddingVendors || [];
    if (w.date || vendors.length) {
      var wToday = new Date(); wToday.setHours(0,0,0,0);
      var daysLeft = w.date ? Math.ceil((new Date(w.date+'T00:00:00') - wToday)/86400000) : null;
      var totalCommitted = vendors.reduce(function(s,v){return s+(v.totalCost||0);},0);
      var unpaidDeposits = vendors.filter(function(v){return !v.paid && v.depositAmount;}).length;
      var urgentDeposits = vendors.filter(function(v){
        if(v.paid||!v.depositDue)return false;
        return Math.ceil((new Date(v.depositDue+'T00:00:00')-wToday)/86400000)<=30;
      }).length;
      dashWedding.innerHTML = '<div class="card" style="border:2px solid color-mix(in srgb,var(--accent) 40%,transparent)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<div class="card-title" style="margin:0">💍 Wedding</div>' +
        '<button class="btn btn-ghost btn-sm" onclick="showPage(\'wedding\')">View →</button>' +
        '</div>' +
        '<div style="display:flex;gap:24px;flex-wrap:wrap">' +
        (daysLeft !== null ? '<div><div style="font-size:22px;font-weight:900;color:var(--accent)">' + (daysLeft > 0 ? daysLeft + ' days' : daysLeft === 0 ? 'Today! 🎉' : 'Married!') + '</div><div style="font-size:11px;color:var(--muted)">Until wedding</div></div>' : '') +
        '<div><div style="font-size:18px;font-weight:800;color:var(--text)">' + vendors.length + '</div><div style="font-size:11px;color:var(--muted)">Vendors</div></div>' +
        '<div><div style="font-size:18px;font-weight:800;color:var(--text)">' + fmt(totalCommitted) + '</div><div style="font-size:11px;color:var(--muted)">Committed</div></div>' +
        (urgentDeposits ? '<div><div style="font-size:18px;font-weight:800;color:var(--red)">' + urgentDeposits + '</div><div style="font-size:11px;color:var(--muted)">Deposit alert' + (urgentDeposits>1?'s':'') + '</div></div>' : '') +
        '</div></div>';
    } else {
      dashWedding.innerHTML = '';
    }
  } else if (dashWedding) {
    dashWedding.innerHTML = '';
  }

  // House dashboard widget
  var dashHouse = document.getElementById('dash-house-wrap');
  if (dashHouse && isFeatureOn('house')) {
    var h = state.house || {};
    if (h.targetPrice) {
      var price = h.targetPrice, saved = h.savedAmount||0, monthly = h.monthlyContribution||0;
      var pct20 = Math.min(100, Math.round((saved/(price*0.20))*100));
      var months20 = calcHouseProjection(price, saved, monthly, 0.20);
      var nextMilestone = saved < price*0.05 ? '5% Down' : saved < price*0.10 ? '10% Down' : saved < price*0.20 ? '20% Down' : null;
      var nextMonths = saved < price*0.05 ? calcHouseProjection(price,saved,monthly,0.05) : saved < price*0.10 ? calcHouseProjection(price,saved,monthly,0.10) : months20;
      dashHouse.innerHTML = '<div class="card" style="border:2px solid color-mix(in srgb,var(--green) 40%,transparent)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<div class="card-title" style="margin:0">🏡 House Savings</div>' +
        '<button class="btn btn-ghost btn-sm" onclick="showPage(\'house\')">View →</button>' +
        '</div>' +
        '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:10px">' +
        '<div><div style="font-size:20px;font-weight:900;color:var(--green)">' + fmt(saved) + '</div><div style="font-size:11px;color:var(--muted)">Saved</div></div>' +
        '<div><div style="font-size:20px;font-weight:900;color:var(--text)">' + pct20 + '%</div><div style="font-size:11px;color:var(--muted)">to 20% down</div></div>' +
        (nextMilestone && nextMonths !== null ? '<div><div style="font-size:14px;font-weight:800;color:var(--accent)">' + (nextMonths<=0?'✅ Ready':nextMonths+'mo') + '</div><div style="font-size:11px;color:var(--muted)">' + nextMilestone + '</div></div>' : '') +
        '</div>' +
        '<div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:' + pct20 + '%;background:var(--green)"></div></div>' +
        '</div>';
    } else { dashHouse.innerHTML = ''; }
  } else if (dashHouse) { dashHouse.innerHTML = ''; }

  // Bills dashboard widget
  var dashBills = document.getElementById('dash-bills-wrap');
  if (dashBills && isFeatureOn('bills')) {
    var bills = state.bills || [];
    if (bills.length) {
      var today3 = new Date(); today3.setHours(0,0,0,0);
      var upcoming = bills.filter(function(b){ var d=_billNextDue(b); return d && Math.ceil((d-today3)/86400000)<=7 && Math.ceil((d-today3)/86400000)>=0; });
      var overdue  = bills.filter(function(b){ var d=_billNextDue(b); return d && d<today3; });
      var monthlyTotal = bills.reduce(function(s,b){ return s+_billMonthlyCost(b); },0);
      dashBills.innerHTML = '<div class="card" style="border:2px solid color-mix(in srgb,var(--yellow) 40%,transparent)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<div class="card-title" style="margin:0">🧾 Bills & Subscriptions</div>' +
        '<button class="btn btn-ghost btn-sm" onclick="showPage(\'bills\')">View →</button>' +
        '</div>' +
        '<div style="display:flex;gap:24px;flex-wrap:wrap">' +
        '<div><div style="font-size:20px;font-weight:900;color:var(--text)">' + fmt(monthlyTotal) + '</div><div style="font-size:11px;color:var(--muted)">est. monthly</div></div>' +
        '<div><div style="font-size:20px;font-weight:900;color:var(--text)">' + bills.length + '</div><div style="font-size:11px;color:var(--muted)">active bills</div></div>' +
        (overdue.length  ? '<div><div style="font-size:20px;font-weight:900;color:var(--red)">'    + overdue.length  + '</div><div style="font-size:11px;color:var(--muted)">overdue</div></div>' : '') +
        (upcoming.length ? '<div><div style="font-size:20px;font-weight:900;color:var(--yellow)">' + upcoming.length + '</div><div style="font-size:11px;color:var(--muted)">due this week</div></div>' : '') +
        '</div></div>';
    } else { dashBills.innerHTML = ''; }
  } else if (dashBills) { dashBills.innerHTML = ''; }

  // Net worth dashboard widget
  var dashNW = document.getElementById('dash-nw-wrap');
  if (dashNW && isFeatureOn('networth')) {
    var nwCurrent = calcCurrentNetWorth();
    var history = state.netWorthHistory || [];
    var prev = history.length >= 2 ? history[history.length-2] : null;
    var change = prev ? nwCurrent.netWorth - prev.netWorth : null;
    dashNW.innerHTML = '<div class="card" style="border:2px solid color-mix(in srgb,var(--green) 35%,transparent)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<div class="card-title" style="margin:0">📈 Net Worth</div>' +
      '<button class="btn btn-ghost btn-sm" onclick="showPage(\'networth\')">View →</button>' +
      '</div>' +
      '<div style="display:flex;gap:24px;flex-wrap:wrap">' +
      '<div><div style="font-size:22px;font-weight:900;color:'+(nwCurrent.netWorth>=0?'var(--green)':'var(--red)')+'">'+fmt(nwCurrent.netWorth)+'</div><div style="font-size:11px;color:var(--muted)">Net Worth</div></div>' +
      '<div><div style="font-size:18px;font-weight:800;color:var(--text)">'+fmt(nwCurrent.assets)+'</div><div style="font-size:11px;color:var(--muted)">Assets</div></div>' +
      '<div><div style="font-size:18px;font-weight:800;color:var(--red)">'+fmt(nwCurrent.debts)+'</div><div style="font-size:11px;color:var(--muted)">Debts</div></div>' +
      (change !== null ? '<div><div style="font-size:18px;font-weight:800;color:'+(change>=0?'var(--green)':'var(--red)')+'">'+(change>=0?'+':'')+fmt(change)+'</div><div style="font-size:11px;color:var(--muted)">vs last month</div></div>' : '') +
      '</div></div>';
  } else if (dashNW) { dashNW.innerHTML = ''; }

  // Car funds dashboard widget
  var dashCars = document.getElementById('dash-cars-wrap');
  if (dashCars && isFeatureOn('carfunds')) {
    var carFunds = state.carFunds || [];
    if (carFunds.length) {
      var totalSaved = carFunds.reduce(function(s,c){ return s+(c.savedAmount||0); },0);
      var totalTarget = carFunds.reduce(function(s,c){ return s+(c.targetPrice||0); },0);
      var pct = totalTarget > 0 ? Math.min(100, Math.round(totalSaved/totalTarget*100)) : 0;
      var nearest = carFunds.slice().filter(function(c){ return (c.targetPrice||0)>(c.savedAmount||0); })
        .sort(function(a,b){
          function mo(c){ var rem=Math.max(0,(c.targetPrice||0)-(c.savedAmount||0)); var contrib=c.monthlyContrib||1; return rem/contrib; }
          return mo(a)-mo(b);
        })[0];
      var nearestStr = '';
      if (nearest) {
        var remMo = Math.max(0,(nearest.targetPrice||0)-(nearest.savedAmount||0));
        var contrib = nearest.monthlyContrib||0;
        if (contrib > 0) {
          var months = Math.ceil(remMo/contrib);
          var td = new Date(); td.setMonth(td.getMonth()+months);
          nearestStr = (nearest.emoji||'🚗')+' '+nearest.name+' — '+td.toLocaleDateString('en-CA',{month:'short',year:'numeric'});
        }
      }
      dashCars.innerHTML = '<div class="card" style="border:2px solid color-mix(in srgb,var(--accent) 30%,transparent);margin-top:16px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
        +'<div class="card-title" style="margin:0">🚗 Car Funds</div>'
        +'<button class="btn btn-ghost btn-sm" onclick="showPage(\'cars\')">View →</button></div>'
        +'<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:10px">'
        +'<div><div style="font-size:20px;font-weight:900;color:var(--green)">'+fmt(totalSaved)+'</div><div style="font-size:11px;color:var(--muted)">Total Saved</div></div>'
        +'<div><div style="font-size:20px;font-weight:900;color:var(--text)">'+fmt(totalTarget)+'</div><div style="font-size:11px;color:var(--muted)">Combined Target</div></div>'
        +'<div><div style="font-size:20px;font-weight:900;color:var(--accent)">'+pct+'%</div><div style="font-size:11px;color:var(--muted)">Overall Progress</div></div>'
        +(nearestStr ? '<div><div style="font-size:13px;font-weight:700;color:var(--text)">'+nearestStr+'</div><div style="font-size:11px;color:var(--muted)">Soonest goal</div></div>' : '')
        +'</div>'
        +'<div style="background:var(--bg);border-radius:6px;height:8px;overflow:hidden">'
        +'<div style="height:100%;width:'+pct+'%;background:var(--accent);border-radius:6px;transition:width .4s"></div></div>'
        +'</div>';
    } else { dashCars.innerHTML = ''; }
  } else if (dashCars) { dashCars.innerHTML = ''; }

  // Maintenance dashboard widget
  var dashMaint = document.getElementById('dash-maintenance-wrap');
  if (dashMaint && isFeatureOn('maintenance')) {
    var tasks = state.maintenanceTasks || [];
    if (tasks.length) {
      var today = new Date(); today.setHours(0,0,0,0);
      var overdue = [], dueSoon = [];
      tasks.forEach(function(t) {
        if (!t.intervalDays) return;
        var next = getMaintenanceNextDue(t);
        var days = Math.ceil((next - today) / 86400000);
        if (days < 0) overdue.push({ task:t, days:days });
        else if (days <= 7) dueSoon.push({ task:t, days:days });
      });
      if (overdue.length || dueSoon.length) {
        var rows = overdue.concat(dueSoon).slice(0,4).map(function(item) {
          var d = item.days;
          var label = d < 0 ? Math.abs(d)+' day'+(Math.abs(d)!==1?'s':'')+' overdue' : d===0?'Due today':'Due in '+d+' day'+(d!==1?'s':'');
          var col = d < 0 ? 'var(--red)' : d===0 ? 'var(--red)' : 'var(--yellow)';
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">'
            +'<span style="font-size:13px">'+(item.task.emoji||'🔧')+' '+item.task.name+'</span>'
            +'<span style="font-size:12px;font-weight:700;color:'+col+'">'+label+'</span></div>';
        }).join('');
        dashMaint.innerHTML = '<div class="card" style="border:2px solid color-mix(in srgb,var(--red) 40%,transparent);margin-top:16px">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
          +'<div class="card-title" style="margin:0">🔧 Maintenance Alerts</div>'
          +'<button class="btn btn-ghost btn-sm" onclick="showPage(\'maintenance\')">View All →</button></div>'
          +(overdue.length?'<div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:6px">⚠️ '+overdue.length+' task'+(overdue.length!==1?'s':'')+' overdue</div>':'')
          +rows+'</div>';
      } else { dashMaint.innerHTML = ''; }
    } else { dashMaint.innerHTML = ''; }
  } else if (dashMaint) { dashMaint.innerHTML = ''; }
}

function getTipsForMonth(mk) {
  // Returns total tips (deposit + cash) for a given month key
  return state.tips.filter(t=>{
    const d=new Date(t.date); return (d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))===mk;
  }).reduce((s,t)=>s+(t.amount||0)+(t.cashAmount||0),0);
}
function getTipsDepositForMonth(mk) {
  return state.tips.filter(t=>{
    const d=new Date(t.date); return (d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))===mk;
  }).reduce((s,t)=>s+(t.amount||0),0);
}

// CALENDAR
