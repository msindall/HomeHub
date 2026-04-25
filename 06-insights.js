function renderTipsPage(){
  var sorted=[...state.tips].sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var allClaimed=state.tips.reduce(function(s,t){return s+(t.amount||0);},0);
  var allUnclaimed=state.tips.reduce(function(s,t){return s+(t.cashAmount||0);},0);
  var allGoal=state.tips.reduce(function(s,t){return s+(t.goalAmount||0);},0);
  var mk=getCurrentMonthKey();
  var inMk=function(t){var d=new Date(t.date);return(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))===mk;};
  var mClaimed=state.tips.filter(inMk).reduce(function(s,t){return s+(t.amount||0);},0);
  var mUnclaimed=state.tips.filter(inMk).reduce(function(s,t){return s+(t.cashAmount||0);},0);
  document.getElementById('tips-stats').innerHTML=''
    +'<div class="stat"><div class="stat-label">Claimed (Deposit)</div><div class="stat-value" style="color:'+(getTipsMember()?getTipsMember().color:'var(--pink)')+'">'+fmt(allClaimed)+'</div><div class="stat-sub">CRA reserve: '+fmt(allClaimed*0.25)+'</div></div>'
    +'<div class="stat"><div class="stat-label">Unclaimed (Cash)</div><div class="stat-value clr-accent">'+fmt(allUnclaimed)+'</div></div>'
    +'<div class="stat"><div class="stat-label">Put Toward Goals</div><div class="stat-value clr-green">'+fmt(allGoal)+'</div></div>'
    +'<div class="stat"><div class="stat-label">This Month</div><div class="stat-value" style="color:'+(getTipsMember()?getTipsMember().color:'var(--pink)')+'">'+fmt(mClaimed+mUnclaimed)+'</div><div class="stat-sub">Claimed: '+fmt(mClaimed)+'</div></div>';

  // ── Weekly trend chart (last 12 weeks) ──
  var weeklyData = _buildWeeklyTips(12);
  var chartCanvas = document.getElementById('tips-weekly-chart');
  var chartEmpty = document.getElementById('tips-weekly-empty');
  if (weeklyData.totals.every(function(v){return v===0;})) {
    chartCanvas.style.display = 'none';
    chartEmpty.style.display = '';
  } else {
    chartCanvas.style.display = '';
    chartEmpty.style.display = 'none';
    _renderTipsWeeklyChart(weeklyData);
  }

  // ── Tax installment card ──
  var ytdTotal = _getTipsYTD();
  var craReserve = ytdTotal * 0.25;
  var today = new Date();
  var craDates = [
    { label: 'Mar 15', month: 2, day: 15 },
    { label: 'Jun 15', month: 5, day: 15 },
    { label: 'Sep 15', month: 8, day: 15 },
    { label: 'Dec 15', month: 11, day: 15 },
  ];
  var nextInstallment = null;
  for (var ci = 0; ci < craDates.length; ci++) {
    var cd = new Date(today.getFullYear(), craDates[ci].month, craDates[ci].day);
    if (cd >= today) { nextInstallment = { label: craDates[ci].label + ' ' + today.getFullYear(), date: cd, daysAway: Math.ceil((cd-today)/86400000) }; break; }
  }
  if (!nextInstallment) { nextInstallment = { label: 'Mar 15 ' + (today.getFullYear()+1), daysAway: null }; }
  var taxCardHtml = '<div class="card" style="margin-bottom:0">' +
    '<div class="card-title">🇨🇦 CRA Tax Installments</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">If tips income is significant, CRA may require quarterly installments. Set aside ~25% of cash tips year-round.</div>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">' +
    '<div><div style="font-size:12px;color:var(--muted)">Tips income YTD</div><div style="font-size:18px;font-weight:900;color:var(--text)">' + fmt(ytdTotal) + '</div></div>' +
    '<div style="text-align:right"><div style="font-size:12px;color:var(--muted)">Recommended reserve (25%)</div><div style="font-size:18px;font-weight:900;color:var(--red)">' + fmt(craReserve) + '</div></div>' +
    '</div>' +
    '<div style="padding:10px 12px;background:color-mix(in srgb,var(--accent) 8%,var(--card));border-radius:8px;border:1px solid color-mix(in srgb,var(--accent) 30%,transparent)">' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:2px">Next CRA installment due</div>' +
    '<div style="font-size:16px;font-weight:900;color:var(--accent)">' + nextInstallment.label + '</div>' +
    (nextInstallment.daysAway !== null ? '<div style="font-size:11px;color:var(--muted)">in ' + nextInstallment.daysAway + ' days</div>' : '') +
    '</div>' +
    '<div style="font-size:11px;color:var(--muted);padding:6px 8px;background:var(--surface);border-radius:6px">💡 Installment dates: Mar 15 · Jun 15 · Sep 15 · Dec 15. Required if you expect to owe $3,000+ in tax from self-employment / unreported income.</div>' +
    '</div></div>';
  document.getElementById('tips-tax-card').innerHTML = taxCardHtml;

  // ── YTD breakdown by month ──
  var ytdMonths = _getTipsYTDByMonth();
  var ytdRows = ytdMonths.map(function(m) {
    var total = m.claimed + m.unclaimed;
    return '<tr><td style="font-weight:600">' + m.label + '</td><td>' + fmt(m.claimed) + '</td><td>' + fmt(m.unclaimed) + '</td><td style="font-weight:700">' + fmt(total) + '</td><td style="color:var(--red)">' + fmt(total * 0.25) + '</td></tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No tips this year yet.</td></tr>';
  document.getElementById('tips-ytd-card').innerHTML = '<div class="card" style="margin-bottom:0">' +
    '<div class="card-title">📅 Year-to-Date Breakdown</div>' +
    '<div class="table-wrap"><table><thead><tr><th>Month</th><th>Claimed</th><th>Cash</th><th>Total</th><th>CRA Reserve</th></tr></thead>' +
    '<tbody>' + ytdRows + '</tbody></table></div></div>';

  // ── Insights card ──
  var insights = _buildTipsInsights();
  document.getElementById('tips-insights-card').innerHTML = '<div class="card" style="margin-bottom:0">' +
    '<div class="card-title">💡 Insights</div>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' +
    insights.map(function(ins) {
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">' +
        '<div style="font-size:20px;flex-shrink:0">' + ins.icon + '</div>' +
        '<div><div style="font-size:13px;font-weight:700;color:var(--text)">' + ins.title + '</div>' +
        '<div style="font-size:12px;color:var(--muted)">' + ins.body + '</div></div></div>';
    }).join('') +
    '</div></div>';

  // ── Day-of-week chart ──
  var dowData = _buildTipsByDayOfWeek();
  var dowCanvas = document.getElementById('tips-dayofweek-chart');
  var dowEmpty  = document.getElementById('tips-dayofweek-empty');
  if (dowData.avgs.every(function(v){return v===0;})) {
    if (dowCanvas) dowCanvas.style.display = 'none';
    if (dowEmpty)  dowEmpty.style.display = '';
  } else {
    if (dowCanvas) dowCanvas.style.display = '';
    if (dowEmpty)  dowEmpty.style.display = 'none';
    _renderTipsDayOfWeekChart(dowData);
  }
  _renderTipsBestDaysCard(dowData);

  // ── History (paged) ──
  _tipsCurrentPage = 0;
  _renderTipsHistoryPage();
}
// Tips analytics helpers
function _getTipsYTD() {
  var year = new Date().getFullYear();
  return state.tips.filter(function(t){ return t.date && t.date.startsWith(year); })
    .reduce(function(s,t){ return s+(t.amount||0)+(t.cashAmount||0); }, 0);
}
function _getTipsYTDByMonth() {
  var year = new Date().getFullYear();
  var months = {};
  state.tips.filter(function(t){ return t.date && t.date.startsWith(year); }).forEach(function(t) {
    var mk = t.date.substring(0,7);
    if (!months[mk]) months[mk] = { claimed:0, unclaimed:0 };
    months[mk].claimed   += (t.amount||0);
    months[mk].unclaimed += (t.cashAmount||0);
  });
  var mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return Object.keys(months).sort().map(function(mk) {
    var parts = mk.split('-');
    return { label: mNames[parseInt(parts[1])-1] + ' ' + parts[0], claimed: months[mk].claimed, unclaimed: months[mk].unclaimed };
  });
}
function _buildWeeklyTips(numWeeks) {
  var labels = [], totals = [], claimed = [], unclaimed = [];
  var today = new Date(); today.setHours(0,0,0,0);
  for (var w = numWeeks-1; w >= 0; w--) {
    var wStart = new Date(today); wStart.setDate(today.getDate() - today.getDay() - w*7);
    var wEnd   = new Date(wStart); wEnd.setDate(wStart.getDate()+6);
    var wLabel = (wStart.getMonth()+1)+'/'+wStart.getDate();
    var wTips  = state.tips.filter(function(t){
      var d = new Date(t.date+'T00:00:00'); return d>=wStart && d<=wEnd;
    });
    var wClaimed   = wTips.reduce(function(s,t){return s+(t.amount||0);},0);
    var wUnclaimed = wTips.reduce(function(s,t){return s+(t.cashAmount||0);},0);
    labels.push(wLabel);
    claimed.push(wClaimed);
    unclaimed.push(wUnclaimed);
    totals.push(wClaimed+wUnclaimed);
  }
  return { labels:labels, totals:totals, claimed:claimed, unclaimed:unclaimed };
}
var _tipsCurrentPage = 0;
var TIPS_PER_PAGE = 15;

function tipsPrevPage() { if (_tipsCurrentPage > 0) { _tipsCurrentPage--; _renderTipsHistoryPage(); } }
function tipsNextPage() { _tipsCurrentPage++; _renderTipsHistoryPage(); }

function _renderTipsHistoryPage() {
  var sorted = [...state.tips].sort(function(a,b){ return new Date(b.date)-new Date(a.date); });
  var total = sorted.length;
  var totalPages = Math.max(1, Math.ceil(total / TIPS_PER_PAGE));
  if (_tipsCurrentPage >= totalPages) _tipsCurrentPage = totalPages - 1;
  if (_tipsCurrentPage < 0) _tipsCurrentPage = 0;
  var start = _tipsCurrentPage * TIPS_PER_PAGE;
  var page = sorted.slice(start, start + TIPS_PER_PAGE);

  var prevBtn = document.getElementById('tips-prev-btn');
  var nextBtn = document.getElementById('tips-next-btn');
  var indicator = document.getElementById('tips-page-indicator');
  var controls = document.getElementById('tips-pagination-controls');
  if (controls) controls.style.display = total > TIPS_PER_PAGE ? '' : 'none';
  if (prevBtn) prevBtn.disabled = _tipsCurrentPage === 0;
  if (nextBtn) nextBtn.disabled = _tipsCurrentPage >= totalPages - 1;
  if (indicator) indicator.textContent = total > 0 ? 'Page ' + (_tipsCurrentPage+1) + ' of ' + totalPages + ' (' + total + ' records)' : '';

  var rows = page.map(function(t){
    var tot=(t.totalTips||((t.amount||0)+(t.cashAmount||0)));
    var goalBadge='';
    if(t.goalAmount&&t.goalAmount>0&&t.goalId){
      var g=state.goals.find(function(x){return x.id===t.goalId;});
      goalBadge=' <span style="background:var(--green-light);color:var(--green);font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700">+'+fmt(t.goalAmount)+' to '+(g?g.name:'goal')+'</span>';
    }
    var editBtn='<button class="btn btn-ghost btn-sm" onclick="editTip(this.dataset.id)" data-id="'+t.id+'">&#9998;</button>';
    var delBtn='<button class="btn btn-danger btn-sm" onclick="deleteTip(this.dataset.id)" data-id="'+t.id+'">&#x1F5D1;</button>';
    return '<tr>'
      +'<td>'+new Date(t.date+'T12:00:00').toLocaleDateString('en-CA')+'</td>'
      +'<td style="font-weight:700">'+fmt(tot)+'</td>'
      +'<td style="color:var(--member2);font-weight:700">'+fmt(t.amount||0)+'</td>'
      +'<td style="color:var(--accent)">'+fmt(t.cashAmount||0)+'</td>'
      +'<td style="color:var(--red)">'+fmt((t.amount||0)*0.25)+'</td>'
      +'<td>'+(t.notes||'&mdash;')+goalBadge+'</td>'
      +'<td><div style="display:flex;gap:4px">'+editBtn+delBtn+'</div></td>'
      +'</tr>';
  });
  document.getElementById('tips-tbody').innerHTML = rows.join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px">No tips logged yet.</td></tr>';
}

var _tipsWeeklyChartInstance = null;
function _renderTipsWeeklyChart(data) {
  var canvas = document.getElementById('tips-weekly-chart');
  if (!canvas) return;
  if (_tipsWeeklyChartInstance) { try { _tipsWeeklyChartInstance.destroy(); } catch(e){} _tipsWeeklyChartInstance = null; }
  var style = getComputedStyle(document.documentElement);
  var mutedRaw = style.getPropertyValue('--muted').trim() || '#888888';
  // Use safe explicit colours for bar fills rather than CSS var hex-alpha manipulation
  var claimedFill   = 'rgba(224,122,154,0.6)';
  var claimedBorder = 'rgba(224,122,154,1)';
  var cashFill      = 'rgba(108,142,191,0.6)';
  var cashBorder    = 'rgba(108,142,191,1)';
  _tipsWeeklyChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        { label: 'Claimed', data: data.claimed,   backgroundColor: claimedFill,  borderColor: claimedBorder, borderWidth:1.5, borderRadius:3 },
        { label: 'Cash',    data: data.unclaimed,  backgroundColor: cashFill,     borderColor: cashBorder,    borderWidth:1.5, borderRadius:3 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: mutedRaw, font: { size: 11 } } },
        tooltip: { callbacks: { label: function(ctx){ return ctx.dataset.label + ': $' + ctx.parsed.y.toFixed(2); } } }
      },
      scales: {
        x: { stacked: true, ticks: { color: mutedRaw, font: { size: 10 } }, grid: { display: false } },
        y: { stacked: true, ticks: { color: mutedRaw, font: { size: 10 }, callback: function(v){ return '$' + v; } }, grid: { color: 'rgba(128,128,128,0.1)' } }
      }
    }
  });
}
function _buildTipsInsights() {
  var insights = [];
  if (!state.tips.length) return [{ icon:'💵', title:'No tips logged yet', body:'Start logging your tips to see insights here.' }];
  var weeklyData = _buildWeeklyTips(12);
  var nonZero = weeklyData.totals.filter(function(v){return v>0;});
  if (nonZero.length) {
    var avg = nonZero.reduce(function(s,v){return s+v;},0)/nonZero.length;
    var best = Math.max.apply(null, weeklyData.totals);
    var bestIdx = weeklyData.totals.indexOf(best);
    insights.push({ icon:'📈', title:'Weekly average: '+fmt(avg), body:'Best week: '+fmt(best)+' (w/o '+weeklyData.labels[bestIdx]+')' });
  }
  var ytd = _getTipsYTD();
  var monthNum = new Date().getMonth()+1;
  if (ytd && monthNum) {
    insights.push({ icon:'📅', title:'On pace for '+fmt(ytd/monthNum*12)+' this year', body:'Based on your '+fmt(ytd)+' earned in '+monthNum+' month'+(monthNum===1?'':'s')+' so far.' });
  }
  var reserve = ytd * 0.25;
  insights.push({ icon:'🇨🇦', title:'Recommended CRA reserve: '+fmt(reserve), body:'~25% of total tips income ('+fmt(ytd)+'). Set this aside before spending.' });
  var allTotals = state.tips.map(function(t){return (t.amount||0)+(t.cashAmount||0);});
  if (allTotals.length >= 2) {
    var recentAvg = allTotals.slice(0,5).reduce(function(s,v){return s+v;},0)/Math.min(5,allTotals.length);
    insights.push({ icon:'💰', title:'Recent avg per shift: '+fmt(recentAvg), body:'Based on your last '+Math.min(5,allTotals.length)+' logged shifts.' });
  }
  return insights;
}

// ── TIPS: Day-of-Week Analysis ───────────────────────────────────────────────
var _tipsDayChartInstance = null;

function _buildTipsByDayOfWeek() {
  var DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var totals = [0,0,0,0,0,0,0];
  var counts = [0,0,0,0,0,0,0];
  state.tips.forEach(function(t) {
    if (!t.date) return;
    var d = new Date(t.date + 'T12:00:00');
    var dow = d.getDay();
    totals[dow] += (t.amount||0) + (t.cashAmount||0);
    counts[dow]++;
  });
  var avgs = totals.map(function(total, i) {
    return counts[i] > 0 ? Math.round(total / counts[i] * 100) / 100 : 0;
  });
  var maxAvg = Math.max.apply(null, avgs);
  var bestDayIdx = avgs.indexOf(maxAvg);
  // Reorder to start on Monday (index 1) for a work-week feel
  var order = [1,2,3,4,5,6,0]; // Mon..Sun
  return {
    labels: order.map(function(i){ return DAY_SHORT[i]; }),
    avgs:   order.map(function(i){ return avgs[i]; }),
    counts: order.map(function(i){ return counts[i]; }),
    totals: order.map(function(i){ return totals[i]; }),
    bestDayIdx: bestDayIdx,
    bestDayName: DAY_NAMES[bestDayIdx],
    bestAvg: maxAvg,
    allAvgs: avgs,
    dayNames: DAY_NAMES,
    dayShort: DAY_SHORT,
    order: order,
  };
}

function _renderTipsDayOfWeekChart(data) {
  var canvas = document.getElementById('tips-dayofweek-chart');
  if (!canvas) return;
  if (_tipsDayChartInstance) { try { _tipsDayChartInstance.destroy(); } catch(e){} _tipsDayChartInstance = null; }
  var style = getComputedStyle(document.documentElement);
  var mutedRaw = style.getPropertyValue('--muted').trim() || '#888';
  // Colour bars: best day gold, weekends warm, weekdays muted
  var WEEKEND_IDX_IN_ORDER = [5, 6]; // Sat=index5, Sun=index6 in Mon-first order
  var barColors = data.avgs.map(function(avg, i) {
    if (avg === data.bestAvg && avg > 0) return 'rgba(212,160,23,0.9)';  // gold for best
    if (WEEKEND_IDX_IN_ORDER.indexOf(i) >= 0) return 'rgba(224,122,154,0.75)'; // pink weekend
    return 'rgba(155,127,189,0.7)'; // purple weekday
  });
  _tipsDayChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Avg Tips / Shift',
        data: data.avgs,
        backgroundColor: barColors,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function(ctx) { return ctx[0].label; },
            label: function(ctx) {
              var i = ctx.dataIndex;
              var cnt = data.counts[i];
              return '$' + ctx.parsed.y.toFixed(2) + ' avg  (' + cnt + ' shift' + (cnt===1?'':'s') + ')';
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: mutedRaw, font: { size: 11, weight: '700' } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: mutedRaw, font: { size: 10 }, callback: function(v){ return '$'+v; } }, grid: { color: 'rgba(128,128,128,0.1)' } }
      }
    }
  });
}

function _renderTipsBestDaysCard(data) {
  var el = document.getElementById('tips-bestdays-card');
  if (!el) return;
  if (!state.tips.length) {
    el.innerHTML = '<div class="card" style="margin-bottom:0"><div class="card-title">🏆 Shift Insights</div><div style="color:var(--muted);font-size:13px;padding:8px 0">Log tips to see your best days.</div></div>';
    return;
  }
  // Sort days by avg
  var ranked = data.order.map(function(origIdx, i) {
    return { name: data.dayNames[origIdx], short: data.dayShort[origIdx], avg: data.avgs[i], count: data.counts[i], total: data.totals[i] };
  }).filter(function(d){ return d.count > 0; }).sort(function(a,b){ return b.avg - a.avg; });

  var weekendAvg = 0, weekendCount = 0, weekdayAvg = 0, weekdayCount = 0;
  ranked.forEach(function(d) {
    if (d.name === 'Saturday' || d.name === 'Sunday') { weekendAvg += d.avg * d.count; weekendCount += d.count; }
    else { weekdayAvg += d.avg * d.count; weekdayCount += d.count; }
  });
  weekendAvg = weekendCount ? weekendAvg / weekendCount : 0;
  weekdayAvg = weekdayCount ? weekdayAvg / weekdayCount : 0;
  var weekendPremium = weekdayAvg > 0 ? Math.round((weekendAvg - weekdayAvg) / weekdayAvg * 100) : null;

  // Medal emoji for top 3
  var medals = ['🥇','🥈','🥉'];

  var podiumHtml = ranked.slice(0,3).map(function(d, i) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:10px;background:' + (i===0?'color-mix(in srgb,var(--yellow) 15%,var(--card))':'var(--surface)') + ';border:1.5px solid ' + (i===0?'var(--yellow)':'var(--border)') + ';margin-bottom:8px">'
      + '<div style="display:flex;align-items:center;gap:10px">'
        + '<span style="font-size:20px">' + medals[i] + '</span>'
        + '<div>'
          + '<div style="font-weight:800;font-size:14px;color:var(--text)">' + d.name + '</div>'
          + '<div style="font-size:11px;color:var(--muted)">' + d.count + ' shift' + (d.count===1?'':'s') + ' logged</div>'
        + '</div>'
      + '</div>'
      + '<div style="text-align:right">'
        + '<div style="font-size:18px;font-weight:900;color:' + (i===0?'var(--yellow)':'var(--text)') + ';font-family:Playfair Display,serif">$' + d.avg.toFixed(2) + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">avg / shift</div>'
      + '</div>'
      + '</div>';
  }).join('');

  var weekendLine = '';
  if (weekendCount && weekdayCount) {
    weekendLine = '<div style="margin-top:12px;padding:10px 14px;background:color-mix(in srgb,var(--member2) 10%,var(--card));border-radius:10px;border:1.5px solid color-mix(in srgb,var(--member2) 35%,var(--border))">'
      + '<div style="font-size:12px;font-weight:800;color:var(--member2);margin-bottom:4px">💅 Weekend vs Weekday</div>'
      + '<div style="display:flex;justify-content:space-between;font-size:13px">'
        + '<div><span style="color:var(--muted)">Weekend avg:</span> <strong>$' + weekendAvg.toFixed(2) + '</strong></div>'
        + '<div><span style="color:var(--muted)">Weekday avg:</span> <strong>$' + weekdayAvg.toFixed(2) + '</strong></div>'
      + '</div>'
      + (weekendPremium !== null && weekendPremium !== 0
        ? '<div style="font-size:12px;color:' + (weekendPremium>0?'var(--green)':'var(--red)') + ';margin-top:4px;font-weight:700">'
            + (weekendPremium>0?'↑':'↓') + ' ' + Math.abs(weekendPremium) + '% ' + (weekendPremium>0?'more':'less') + ' on weekends</div>'
        : '')
      + '</div>';
  }

  // Worst day (only if has enough data)
  var worstLine = '';
  if (ranked.length >= 3) {
    var worst = ranked[ranked.length-1];
    worstLine = '<div style="margin-top:8px;padding:8px 14px;border-radius:8px;background:var(--surface);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">'
      + '<span style="font-size:12px;color:var(--muted)">📉 Slowest day: <strong style="color:var(--text)">' + worst.name + '</strong></span>'
      + '<span style="font-size:12px;font-weight:700;color:var(--muted)">$' + worst.avg.toFixed(2) + ' avg</span>'
      + '</div>';
  }

  el.innerHTML = '<div class="card" style="margin-bottom:0;height:100%">'
    + '<div class="card-title">🏆 Shift Insights</div>'
    + podiumHtml
    + weekendLine
    + worstLine
    + '</div>';
}

// ── WEDDING CHECKLIST ────────────────────────────────────────────────────────

var WEDDING_CHECKLIST_PRESETS = [
  { id:'wc01', task:'Set your wedding date & overall budget', monthsBefore:18, category:'Planning', emoji:'📅' },
  { id:'wc02', task:'Book your ceremony & reception venue', monthsBefore:15, category:'Venue', emoji:'🏛️' },
  { id:'wc03', task:'Choose & book photographer', monthsBefore:12, category:'Photography', emoji:'📷' },
  { id:'wc04', task:'Book videographer', monthsBefore:12, category:'Videography', emoji:'🎥' },
  { id:'wc05', task:'Start wedding dress / suit shopping', monthsBefore:12, category:'Attire', emoji:'👗' },
  { id:'wc06', task:'Book caterer / confirm venue catering', monthsBefore:10, category:'Catering', emoji:'🍽️' },
  { id:'wc07', task:'Book officiant', monthsBefore:10, category:'Ceremony', emoji:'⛪' },
  { id:'wc08', task:'Book DJ or live band', monthsBefore:10, category:'Music', emoji:'🎵' },
  { id:'wc09', task:'Book florist / décor', monthsBefore:9, category:'Flowers', emoji:'💐' },
  { id:'wc10', task:'Order wedding dress (allow time for alterations)', monthsBefore:9, category:'Attire', emoji:'👰' },
  { id:'wc11', task:'Plan & book honeymoon travel', monthsBefore:8, category:'Honeymoon', emoji:'✈️' },
  { id:'wc12', task:'Book hair & makeup artists', monthsBefore:8, category:'Beauty', emoji:'💄' },
  { id:'wc13', task:'Send save-the-dates', monthsBefore:8, category:'Invitations', emoji:'📬' },
  { id:'wc14', task:'Book wedding cake / desserts', monthsBefore:7, category:'Catering', emoji:'🎂' },
  { id:'wc15', task:'Create wedding website', monthsBefore:7, category:'Planning', emoji:'🌐' },
  { id:'wc16', task:'Finalise guest list', monthsBefore:6, category:'Planning', emoji:'📋' },
  { id:'wc17', task:'Order invitations & stationery', monthsBefore:6, category:'Invitations', emoji:'💌' },
  { id:'wc18', task:'Book hotel room block for guests', monthsBefore:6, category:'Accommodation', emoji:'🏨' },
  { id:'wc19', task:'Book wedding night accommodation', monthsBefore:6, category:'Accommodation', emoji:'🛏️' },
  { id:'wc20', task:'Book transportation (limo, vintage car, etc.)', monthsBefore:5, category:'Transport', emoji:'🚗' },
  { id:'wc21', task:'Mail invitations', monthsBefore:3, category:'Invitations', emoji:'📮' },
  { id:'wc22', task:'Schedule food tasting with caterer', monthsBefore:3, category:'Catering', emoji:'🍴' },
  { id:'wc23', task:'Confirm all vendor contracts & final payments', monthsBefore:2, category:'Planning', emoji:'✅' },
  { id:'wc24', task:'Final dress / suit fittings', monthsBefore:2, category:'Attire', emoji:'👔' },
  { id:'wc25', task:'Create ceremony & reception seating plan', monthsBefore:2, category:'Planning', emoji:'💺' },
  { id:'wc26', task:'Apply for marriage licence (Ontario: 89-day window)', monthsBefore:2, category:'Legal', emoji:'📄' },
  { id:'wc27', task:'Write vows', monthsBefore:1, category:'Ceremony', emoji:'💍' },
  { id:'wc28', task:'Send final guest counts to caterer', monthsBefore:1, category:'Catering', emoji:'🔢' },
  { id:'wc29', task:'Prepare vendor tips & day-of payments', monthsBefore:0.25, category:'Planning', emoji:'💵' },
  { id:'wc30', task:'Pack for honeymoon', monthsBefore:0.25, category:'Honeymoon', emoji:'🧳' },
];

function loadWeddingChecklistPresets() {
  if (!state.weddingChecklist) state.weddingChecklist = [];
  var existing = state.weddingChecklist.map(function(t){ return t.presetId; });
  var toAdd = WEDDING_CHECKLIST_PRESETS.filter(function(p){ return existing.indexOf(p.id) === -1; });
  if (!toAdd.length) { hhToast('All starter tasks are already loaded!','✅'); return; }
  toAdd.forEach(function(p) {
    state.weddingChecklist.push({
      id: uid(), presetId: p.id, task: p.task,
      monthsBefore: p.monthsBefore, category: p.category, emoji: p.emoji,
      done: false, notes: '',
    });
  });
  saveState();
  renderWeddingChecklist();
  hhToast('Loaded ' + toAdd.length + ' checklist tasks!','💍');
}

function getWeddingChecklistDueDate(item) {
  var wDate = (state.wedding||{}).date;
  if (!wDate || !item.monthsBefore) return null;
  var d = new Date(wDate + 'T00:00:00');
  d.setMonth(d.getMonth() - Math.round(item.monthsBefore));
  return d;
}

function weddingChecklistStatus(item) {
  if (item.done) return { label: 'Done ✅', color: 'var(--green)', urgency: 0 };
  var due = getWeddingChecklistDueDate(item);
  if (!due) return { label: 'No date set', color: 'var(--muted)', urgency: 3 };
  var today = new Date(); today.setHours(0,0,0,0);
  var days = Math.ceil((due - today) / 86400000);
  if (days < 0) return { label: Math.abs(days) + 'd overdue', color: 'var(--red)', urgency: 1 };
  if (days === 0) return { label: 'Due today!', color: 'var(--red)', urgency: 1 };
  if (days <= 14) return { label: 'Due in ' + days + 'd', color: 'var(--yellow)', urgency: 2 };
  var months = Math.round(days / 30.5);
  return { label: months > 0 ? 'In ~' + months + 'mo' : 'Soon', color: 'var(--muted)', urgency: 3 };
}

function toggleChecklistItem(id) {
  var item = (state.weddingChecklist||[]).find(function(x){ return x.id===id; });
  if (!item) return;
  item.done = !item.done;
  saveState();
  renderWeddingChecklist();
}

function deleteChecklistItem(id) {
  hhConfirm('Remove this checklist task?','🗑️','Remove Task').then(function(ok){
    if (!ok) return;
    state.weddingChecklist = (state.weddingChecklist||[]).filter(function(x){ return x.id!==id; });
    saveState();
    renderWeddingChecklist();
  });
}

function saveNewChecklistTask() {
  var taskEl = document.getElementById('wc-new-task');
  var catEl  = document.getElementById('wc-new-cat');
  var moEl   = document.getElementById('wc-new-months');
  var task = taskEl ? taskEl.value.trim() : '';
  if (!task) { hhToast('Please enter a task name.','⚠️'); return; }
  if (!state.weddingChecklist) state.weddingChecklist = [];
  state.weddingChecklist.push({
    id: uid(), presetId: null, task: task,
    monthsBefore: parseFloat(moEl&&moEl.value)||0,
    category: catEl ? catEl.value : 'Planning',
    emoji: '📌', done: false, notes: '',
  });
  saveState();
  taskEl.value = ''; if (moEl) moEl.value = '';
  renderWeddingChecklist();
  hhToast('Task added!','💍');
}

function renderWeddingChecklist() {
  var el = document.getElementById('wedding-checklist-wrap');
  if (!el) return;
  var items = state.weddingChecklist || [];
  var wDate = (state.wedding||{}).date;

  // Progress
  var done = items.filter(function(x){ return x.done; }).length;
  var total = items.length;
  var pct = total > 0 ? Math.round(done/total*100) : 0;
  var overdue = items.filter(function(x){ if(x.done) return false; var s=weddingChecklistStatus(x); return s.urgency===1; }).length;
  var duesSoon = items.filter(function(x){ if(x.done) return false; var s=weddingChecklistStatus(x); return s.urgency===2; }).length;

  // Sort: overdue → due soon → upcoming (by due date) → no date → done
  var sorted = items.slice().sort(function(a,b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    var sa = weddingChecklistStatus(a), sb = weddingChecklistStatus(b);
    if (sa.urgency !== sb.urgency) return sa.urgency - sb.urgency;
    var da = getWeddingChecklistDueDate(a), db = getWeddingChecklistDueDate(b);
    if (da && db) return da - db;
    if (da) return -1; if (db) return 1;
    return (a.monthsBefore||0) - (b.monthsBefore||0);
  });

  var CAT_COLORS = {
    'Planning':'var(--accent)','Venue':'var(--purple)','Photography':'var(--member1)',
    'Videography':'var(--member1)','Attire':'var(--member2)','Catering':'var(--green)',
    'Ceremony':'var(--yellow)','Music':'var(--accent2)','Flowers':'var(--pink)',
    'Beauty':'var(--member2)','Invitations':'var(--accent)','Accommodation':'var(--purple)',
    'Transport':'var(--yellow)','Legal':'var(--red)','Honeymoon':'var(--green)',
    'Other':'var(--muted)',
  };

  var rowsHtml = sorted.map(function(item) {
    var st = weddingChecklistStatus(item);
    var dueDateStr = '';
    var due = getWeddingChecklistDueDate(item);
    if (due) dueDateStr = due.toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
    var catColor = CAT_COLORS[item.category] || 'var(--muted)';
    var rowBg = item.done ? 'opacity:0.5;' : '';
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:var(--surface);border:1.5px solid '+(item.done?'var(--green)':st.urgency===1?'color-mix(in srgb,var(--red) 40%,var(--border))':st.urgency===2?'color-mix(in srgb,var(--yellow) 40%,var(--border))':'var(--border)')+';margin-bottom:7px;'+rowBg+'">'
      + '<input type="checkbox"'+(item.done?' checked':'')+' onchange="toggleChecklistItem(\''+item.id+'\')" style="width:18px;height:18px;accent-color:var(--green);cursor:pointer;flex-shrink:0">'
      + '<span style="font-size:18px;flex-shrink:0">'+item.emoji+'</span>'
      + '<div style="flex:1;min-width:0">'
        + '<div style="font-weight:700;font-size:13px;color:var(--text);'+(item.done?'text-decoration:line-through;color:var(--muted)':'')+'">'+item.task+'</div>'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:3px">'
          + '<span style="font-size:10px;font-weight:700;background:'+catColor+'22;color:'+catColor+';border-radius:5px;padding:1px 7px">'+item.category+'</span>'
          + (dueDateStr ? '<span style="font-size:11px;color:var(--muted)">📅 '+dueDateStr+'</span>' : '')
          + '<span style="font-size:11px;font-weight:700;color:'+st.color+'">'+st.label+'</span>'
        + '</div>'
      + '</div>'
      + '<button onclick="deleteChecklistItem(\''+item.id+'\')" title="Remove" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:15px;padding:2px 5px;flex-shrink:0">🗑️</button>'
      + '</div>';
  }).join('');

  var noItemsHtml = !total ? '<div style="text-align:center;padding:28px;color:var(--muted)">'
    + '<div style="font-size:36px;margin-bottom:10px">📋</div>'
    + '<div style="font-size:14px;font-weight:700;margin-bottom:6px">No checklist tasks yet</div>'
    + '<div style="font-size:13px;margin-bottom:14px">Load the starter checklist or add your own tasks.</div>'
    + '<button class="btn btn-primary" onclick="loadWeddingChecklistPresets()">📋 Load Starter Checklist</button>'
    + '</div>' : '';

  // Add task inline form
  var addFormHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:10px 0 0">'
    + '<div style="flex:2;min-width:200px"><label style="font-size:10px;text-transform:uppercase;font-weight:800;color:var(--muted)">New Task</label><input type="text" id="wc-new-task" placeholder="e.g. Book rehearsal dinner venue" style="margin-top:4px"></div>'
    + '<div style="min-width:130px"><label style="font-size:10px;text-transform:uppercase;font-weight:800;color:var(--muted)">Category</label><select id="wc-new-cat" style="margin-top:4px;width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);font-family:Nunito,sans-serif;font-size:13px">'
      + ['Planning','Venue','Photography','Videography','Attire','Catering','Ceremony','Music','Flowers','Beauty','Invitations','Accommodation','Transport','Legal','Honeymoon','Other'].map(function(c){return '<option>'+c+'</option>';}).join('')
    + '</select></div>'
    + '<div style="min-width:110px"><label style="font-size:10px;text-transform:uppercase;font-weight:800;color:var(--muted)">Months Before</label><input type="number" id="wc-new-months" placeholder="e.g. 6" min="0" step="0.5" style="margin-top:4px"></div>'
    + '<button class="btn btn-primary btn-sm" onclick="saveNewChecklistTask()" style="margin-bottom:2px;white-space:nowrap">+ Add Task</button>'
    + '</div>';

  var barColor = pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--accent)' : 'var(--member2)';

  el.innerHTML = '<div class="card">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">'
      + '<div class="card-title" style="margin:0">📋 Wedding Checklist</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
        + (total === 0 ? '<button class="btn btn-primary btn-sm" onclick="loadWeddingChecklistPresets()">📋 Load Starter Checklist</button>' : '<button class="btn btn-ghost btn-sm" onclick="loadWeddingChecklistPresets()">📋 Load Presets</button>')
      + '</div>'
    + '</div>'
    + (total > 0 ? '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px">'
      + '<div style="flex:1;min-width:160px"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px"><span>'+done+' of '+total+' done</span><span style="font-weight:800;color:'+barColor+'">'+pct+'%</span></div><div style="background:var(--border);border-radius:6px;height:8px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+barColor+';border-radius:6px;transition:width 0.4s"></div></div></div>'
      + (overdue ? '<span style="font-size:12px;font-weight:800;color:var(--red);background:var(--red-light);padding:3px 10px;border-radius:20px">⚠️ '+overdue+' overdue</span>' : '')
      + (duesSoon ? '<span style="font-size:12px;font-weight:700;color:var(--yellow);background:var(--yellow-light);padding:3px 10px;border-radius:20px">⏰ '+duesSoon+' due soon</span>' : '')
      + (pct===100 ? '<span style="font-size:12px;font-weight:800;color:var(--green);background:var(--green-light);padding:3px 10px;border-radius:20px">🎉 All done!</span>' : '')
      + '</div>' : '')
    + noItemsHtml
    + rowsHtml
    + addFormHtml
    + '</div>';
}

function openWeddingChecklistModal() {
  // Just scroll to the checklist on the page
  renderWeddingChecklist();
  var el = document.getElementById('wedding-checklist-wrap');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function editTip(id){
  var t=state.tips.find(function(x){return x.id===id;});if(!t)return;
  document.getElementById('tips-edit-id').value=id;
  document.getElementById('tips-date').value=t.date;
  var setV=function(elId,v){var el=document.getElementById(elId);if(el)el.value=v;};
  setV('tips-total-input',t.totalTips||((t.amount||0)+(t.cashAmount||0)));
  setV('tips-amount',t.amount||0);
  setV('tips-notes',t.notes||'');
  populateTipsGoalDropdown();
  setV('tips-goal-amt',t.goalAmount||'');
  if(t.goalId)setV('tips-goal-id',t.goalId);
  if(t.goalAccount)setV('tips-goal-acct',t.goalAccount);
  calcTips();
  openModal('tips-modal');
}
function deleteTip(id){
  hhConfirm('Delete this tip entry?','🗑️','Delete').then(function(ok){
    if(!ok)return;
    state.tips=state.tips.filter(t=>t.id!==id);
    state.transactions=state.transactions.filter(t=>t.tipsId!==id);
    saveState();renderTipsPage();
    if(document.getElementById('page-budget').classList.contains('active'))renderBudget();
    if(document.getElementById('page-dashboard').classList.contains('active'))renderDashboard();
  });
}

function clearAllTips(){
  if(!state.tips||!state.tips.length) return hhAlert('No tip records to clear.','ℹ️');
  hhConfirm('Delete ALL '+state.tips.length+' tip records and their transactions? This cannot be undone.','🗑️','Clear All Tips').then(function(ok){
    if(!ok)return;
    state.tips=[];
    state.transactions=state.transactions.filter(function(t){ return t.source!=='tips'; });
    saveState();renderTipsPage();
    if(document.getElementById('page-budget').classList.contains('active'))renderBudget();
    if(document.getElementById('page-dashboard').classList.contains('active'))renderDashboard();
    if(document.getElementById('page-goals').classList.contains('active'))renderGoals();
    renderAccountBalances();
  });
}

// ─── TIP TRACKER CSV IMPORT (scan-tips skill) ───────────────────────────────
var _tipImportParsed = null; // holds parsed result until user confirms

function parseTipTrackerCSV(csvText) {
  var lines = csvText.split(/\r?\n/);
  var records = [];
  var skipped = 0;
  var MONTHS = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  var DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];

  function cleanNum(v) {
    if (v === undefined || v === null) return 0;
    var s = String(v).replace(/[$,\s"]/g,'').trim();
    if (!s || s === '#DIV/0!' || s === '' ) return 0;
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function parseISODate(v) {
    if (!v) return null;
    var s = String(v).replace(/"/g,'').trim();
    var m = s.match(/^(\w{3})\s+(\d{1,2}),\s*(\d{4})$/);
    if (!m) return null;
    var mo = MONTHS[m[1]];
    if (!mo) return null;
    return m[3]+'-'+String(mo).padStart(2,'0')+'-'+String(parseInt(m[2])).padStart(2,'0');
  }

  // Simple CSV row splitter that respects quoted fields
  function splitCSVRow(line) {
    var cols = [];
    var cur = '';
    var inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { cols.push(cur); cur = ''; }
      else { cur += c; }
    }
    cols.push(cur);
    return cols;
  }

  for (var li = 0; li < lines.length; li++) {
    var line = lines[li].trim();
    if (!line) { skipped++; continue; }
    var cols = splitCSVRow(line);
    if (cols.length < 10) { skipped++; continue; }

    var dayOfWeek = (cols[0] || '').replace(/"/g,'').trim().toUpperCase();
    var rawDate   = (cols[1] || '').replace(/"/g,'').trim();
    var hours     = cleanNum(cols[2]);
    var tips      = cleanNum(cols[3]);
    var tipsToClaim = cleanNum(cols[9]);

    if (DAYS.indexOf(dayOfWeek) === -1) { skipped++; continue; }
    var isoDate = parseISODate(rawDate);
    if (!isoDate) { skipped++; continue; }
    if (tips <= 0)  { skipped++; continue; }
    if (hours <= 0) { skipped++; continue; }

    var unclaimed = Math.round(Math.max(0, tips - tipsToClaim) * 100) / 100;
    records.push({
      date: isoDate,
      dayOfWeek: dayOfWeek,
      hours: Math.round(hours * 100) / 100,
      totalTips: Math.round(tips * 100) / 100,
      tipsToClaim: Math.round(tipsToClaim * 100) / 100,
      unclaimedCash: unclaimed
    });
  }

  records.sort(function(a,b){ return a.date.localeCompare(b.date); });

  var totalHours   = Math.round(records.reduce(function(s,r){ return s+r.hours; }, 0)*100)/100;
  var totalTips    = Math.round(records.reduce(function(s,r){ return s+r.totalTips; }, 0)*100)/100;
  var totalClaimed = Math.round(records.reduce(function(s,r){ return s+r.tipsToClaim; }, 0)*100)/100;
  var totalUnclaimed = Math.round(records.reduce(function(s,r){ return s+r.unclaimedCash; }, 0)*100)/100;

  return {
    records: records,
    summary: {
      totalDaysWorked: records.length,
      totalHours: totalHours,
      totalTips: totalTips,
      totalClaimed: totalClaimed,
      totalUnclaimed: totalUnclaimed,
      dateRangeStart: records.length ? records[0].date : null,
      dateRangeEnd:   records.length ? records[records.length-1].date : null
    },
    skippedRows: skipped
  };
}

function handleTipTrackerUpload(input) {
  var file = input.files[0];
  if (!file) return;
  input.value = ''; // reset so same file can be re-uploaded
  var reader = new FileReader();
  reader.onload = function(e) {
    var parsed = parseTipTrackerCSV(e.target.result);
    if (!parsed.records.length) {
      hhAlert('No tip records found in that CSV. Make sure it\'s the correct Tip Tracker file.','⚠️');
      return;
    }
    _tipImportParsed = parsed;
    showTipImportPreview(parsed);
  };
  reader.readAsText(file);
}

function showTipImportPreview(parsed) {
  var existingDates = new Set(state.tips.map(function(t){ return t.date; }));
  var s = parsed.summary;

  // Summary bar
  document.getElementById('tip-import-summary').innerHTML =
    '<strong>File contains '+s.totalDaysWorked+' worked days</strong> &nbsp;|&nbsp; '
    +s.dateRangeStart+' → '+s.dateRangeEnd
    +(s.totalHours?' &nbsp;|&nbsp; '+s.totalHours+' hrs total':'');

  // Stat pills
  document.getElementById('tip-import-stats').innerHTML =
    '<div class="tips-stat-card" style="flex:1;min-width:120px"><div class="tips-stat-icon">💵</div><div class="tips-stat-value">'+fmt(s.totalTips)+'</div><div class="tips-stat-label">Total Tips</div></div>'
    +'<div class="tips-stat-card" style="flex:1;min-width:120px"><div class="tips-stat-icon">🏦</div><div class="tips-stat-value">'+fmt(s.totalClaimed)+'</div><div class="tips-stat-label">To Claim (T4)</div></div>'
    +'<div class="tips-stat-card" style="flex:1;min-width:120px"><div class="tips-stat-icon">💸</div><div class="tips-stat-value">'+fmt(s.totalUnclaimed)+'</div><div class="tips-stat-label">Unclaimed Cash</div></div>'
    +'<div class="tips-stat-card" style="flex:1;min-width:120px"><div class="tips-stat-icon">🇨🇦</div><div class="tips-stat-value">'+fmt(s.totalTips*0.25)+'</div><div class="tips-stat-label">CRA Reserve (25%)</div></div>';

  // Table rows
  var newCount = 0;
  var rows = parsed.records.map(function(r) {
    var isDupe = existingDates.has(r.date);
    if (!isDupe) newCount++;
    var statusBadge = isDupe
      ? '<span style="background:#f5f5f5;color:#aaa;font-size:10px;padding:2px 7px;border-radius:5px;font-weight:700">Already imported</span>'
      : '<span style="background:var(--green-light);color:var(--green);font-size:10px;padding:2px 7px;border-radius:5px;font-weight:700">New ✓</span>';
    return '<tr style="opacity:'+(isDupe?'0.45':'1')+'">'
      +'<td>'+r.date+'</td>'
      +'<td style="font-size:11px;color:var(--muted)">'+r.dayOfWeek.charAt(0)+r.dayOfWeek.slice(1).toLowerCase()+'</td>'
      +'<td>'+r.hours+'h</td>'
      +'<td style="font-weight:700">'+fmt(r.totalTips)+'</td>'
      +'<td style="color:var(--member2)">'+fmt(r.tipsToClaim)+'</td>'
      +'<td style="color:var(--accent)">'+fmt(r.unclaimedCash)+'</td>'
      +'<td>'+statusBadge+'</td>'
      +'</tr>';
  });
  document.getElementById('tip-import-tbody').innerHTML = rows.join('');

  var btn = document.getElementById('tip-import-confirm-btn');
  if (newCount === 0) {
    btn.disabled = true;
    btn.textContent = '✅ All records already imported';
    document.getElementById('tip-import-status').textContent = 'Nothing new to add — all dates already exist in your Tips history.';
  } else {
    btn.disabled = false;
    btn.textContent = '✅ Import ' + newCount + ' New Record' + (newCount===1?'':'s');
    document.getElementById('tip-import-status').textContent = newCount + ' new + ' + (parsed.records.length - newCount) + ' already imported (skipped).';
  }

  document.getElementById('tip-import-card').style.display = 'block';
  document.getElementById('tip-import-card').scrollIntoView({behavior:'smooth', block:'start'});
}

function confirmTipImport() {
  if (!_tipImportParsed) return;
  ensureCashAccounts();
  var existingDates = new Set(state.tips.map(function(t){ return t.date; }));
  var tipsMember = getTipsMember() || (state.members&&state.members.length?state.members[0]:{name:'Member 1'});
  var imported = 0;

  _tipImportParsed.records.forEach(function(r) {
    if (existingDates.has(r.date)) return; // skip dupes
    var t = {
      id: uid(),
      date: r.date,
      totalTips: r.totalTips,
      amount: r.tipsToClaim,       // claimed = depositable
      cashAmount: r.unclaimedCash, // unclaimed = cash kept
      goalAmount: 0,
      goalId: '',
      goalAccount: 'Cash-Claimed',
      notes: 'Imported — Tip Tracker ('+r.hours+'h)'
    };
    state.tips.push(t);

    // Create income transactions (same logic as saveTips)
    var dp = r.date.split('-');
    var fmtD = dp[1]+'/'+dp[2]+'/'+dp[0];
    if (r.tipsToClaim > 0) {
      state.transactions.push({id:uid(),date:fmtD,description:'Tips — Claimed (Deposit)',amount:r.tipsToClaim,
        category:'income',person:tipsMember.name,account:'Cash-Claimed',source:'tips',tipsId:t.id});
    }
    if (r.unclaimedCash > 0) {
      state.transactions.push({id:uid(),date:fmtD,description:'Tips — Unclaimed Cash',amount:r.unclaimedCash,
        category:'income',person:tipsMember.name,account:'Cash-Unclaimed',source:'tips',tipsId:t.id});
    }
    imported++;
  });

  saveState();
  _tipImportParsed = null;
  document.getElementById('tip-import-card').style.display = 'none';
  renderTipsPage();
  if(document.getElementById('page-budget').classList.contains('active'))renderBudget();
  if(document.getElementById('page-dashboard').classList.contains('active'))renderDashboard();
  hhAlert('Imported '+imported+' tip record'+(imported===1?'':'s')+' from Tip Tracker! 🎉','✅');
}

function cancelTipImport() {
  _tipImportParsed = null;
  document.getElementById('tip-import-card').style.display = 'none';
}
// ─── END TIP TRACKER CSV IMPORT ──────────────────────────────────────────────

// GROCERY
function renderGrocery(){
  if(!state.pantry)state.pantry=[];
  if(!state.shoppingList)state.shoppingList=[];
  renderFlyers();
  if(state.mealPlan)renderMealPlanGrid();
  renderShoppingList();
  renderPantry();
  // Ensure the flyer tab is active on page load
  var flyerBtn=document.getElementById('tab-flyer');
  if(flyerBtn&&!flyerBtn.classList.contains('active')){
    switchGroceryTab('flyer',flyerBtn);
  }
}
function renderFlyers(){
  if(!state.flyers) state.flyers=[];
  var container=document.getElementById('flyers-container');
  if(!container)return;
  if(!state.flyers.length){
    container.innerHTML='<div class="empty-sm">No flyers loaded yet. Upload a PDF or import from Flipp above!</div>';
    // Remove stale expired banner if present
    var stale=document.getElementById('flyer-expired-banner');
    if(stale)stale.innerHTML='';
    return;
  }

  // V6.22: All-expired banner
  var now=new Date(); now.setHours(0,0,0,0);
  function flyerIsExpired(f){ var vt=f.validTo?new Date(f.validTo):null; if(vt){vt.setHours(0,0,0,0);} return vt&&vt<now; }
  function daysLeft(f){ if(!f.validTo||flyerIsExpired(f))return null; var vt=new Date(f.validTo);vt.setHours(0,0,0,0); return Math.ceil((vt-now)/86400000); }
  var hasActive=state.flyers.some(function(f){return !flyerIsExpired(f);});
  var expiredBanner=document.getElementById('flyer-expired-banner');
  if(!expiredBanner){
    expiredBanner=document.createElement('div');
    expiredBanner.id='flyer-expired-banner';
    container.parentNode.insertBefore(expiredBanner,container);
  }
  if(!hasActive){
    expiredBanner.innerHTML='<div class="alert alert-warning" style="margin-bottom:12px">'
      +'&#9888;&#65039; <strong>All your flyers have expired.</strong> Meal plan AI will generate without sale prices. '
      +'<button class="btn btn-ghost btn-sm" style="margin-left:10px" onclick="openModal(\'flipp-modal\')">&#x1F6D2; Import Fresh Flyers</button></div>';
  } else {
    expiredBanner.innerHTML='';
  }

  if(!window._flyerOpen) window._flyerOpen={};
  container.innerHTML='';
  state.flyers.forEach(function(f,idx){
    var isOpen=window._flyerOpen[idx]!==false;
    var expired=flyerIsExpired(f);
    var dl=daysLeft(f);
    var inPantryCount=(f.items||[]).filter(function(item){
      return (state.pantry||[]).some(function(p){return p.name.toLowerCase()===item.name.toLowerCase();});
    }).length;
    var sourceTag=f.source==='flipp'
      ?'<span style="font-size:10px;background:#e8f5e9;color:#388e3c;border-radius:4px;padding:1px 6px;font-weight:600">Flipp</span>':'' ;
    // Expiry badge — red if expired, amber if expiring in ≤3 days, grey otherwise
    var validTag='';
    if(expired){
      validTag='<span style="font-size:10px;background:var(--red-light);color:var(--red);border-radius:4px;padding:2px 7px;font-weight:700;border:1px solid color-mix(in srgb,var(--red) 40%,transparent)">&#9888; Expired '+f.validTo+'</span>';
    } else if(f.validFrom){
      if(dl!==null&&dl<=3){
        validTag='<span style="font-size:10px;background:var(--yellow-light);color:var(--yellow);border-radius:4px;padding:2px 7px;font-weight:700;border:1px solid color-mix(in srgb,var(--yellow) 40%,transparent)">&#9200; Expires in '+dl+' day'+(dl===1?'':'s')+'</span>';
      } else {
        validTag='<span style="font-size:10px;color:var(--muted)">'+f.validFrom+' &ndash; '+f.validTo+'</span>';
      }
    }
    var pantryTag=inPantryCount>0
      ?'<span style="font-size:10px;background:var(--green-light);color:var(--green);border-radius:4px;padding:1px 6px;font-weight:600">&#10003; '+inPantryCount+' in pantry</span>':'';
    var itemsHtml='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px">';
    (f.items||[]).forEach(function(item,iIdx){
      if(expired){
        // Greyed-out, no action buttons, strikethrough name
        itemsHtml+='<div style="display:flex;flex-direction:column;padding:8px 10px;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;font-size:12px;gap:3px;opacity:0.45">'
          +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">'
            +'<span style="font-weight:700;color:var(--muted);flex:1;line-height:1.3;text-decoration:line-through">'+item.name+'</span>'
            +'<span style="color:var(--muted);white-space:nowrap;font-size:13px">'+(item.price||'')+'</span>'
          +'</div>'
          +((item.unit||item.description)?'<div style="font-size:11px;color:var(--muted)">'+(item.unit||item.description)+'</div>':'')
          +'</div>';
      } else {
        var inPantry=(state.pantry||[]).some(function(p){return p.name.toLowerCase()===item.name.toLowerCase();});
        var onList=(state.shoppingList||[]).some(function(s){return s.name.toLowerCase()===item.name.toLowerCase();});
        itemsHtml+='<div style="display:flex;flex-direction:column;padding:8px 10px;background:var(--surface);border:1.5px solid '+(inPantry?'var(--green)':onList?'var(--accent)':'var(--border)')+';border-radius:10px;font-size:12px;gap:3px">'
          +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">'
            +'<span style="font-weight:700;color:var(--text1);flex:1;line-height:1.3">'+item.name+'</span>'
            +'<span style="color:var(--green);font-weight:800;white-space:nowrap;font-size:13px">'+(item.price||'')+'</span>'
          +'</div>'
          +((item.unit||item.description)?'<div style="font-size:11px;color:var(--muted)">'+(item.unit||item.description)+'</div>':'')
          +'<div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap">'
          +'<button onclick="addFlyerItemToList(\''+f.store+'\','+idx+','+iIdx+')" style="font-size:10px;background:'+(onList?'var(--accent)':'var(--surface2,#e8f0fe)')+';color:'+(onList?'#fff':'var(--accent)')+';border:1.5px solid var(--accent);border-radius:6px;padding:2px 8px;cursor:pointer;font-weight:700;white-space:nowrap">'+(onList?'✓ On List':'🛒 Add to List')+'</button>'
          +'<button onclick="addFlyerItemToPantry(\''+f.store+'\','+idx+','+iIdx+')" style="font-size:10px;background:var(--green-light);color:var(--green);border:1.5px solid var(--green);border-radius:6px;padding:2px 8px;cursor:pointer;font-weight:700;white-space:nowrap">'+(inPantry?'+ Stock Up':'+ Pantry')+'</button>'
          +'</div>'
          +'</div>';
      }
    });
    itemsHtml+='</div>';
    // Expired: red-tinted border and body callout with remove button
    var cardBorder=expired?'1.5px solid color-mix(in srgb,var(--red) 35%,var(--border))':'1.5px solid var(--border)';
    var cardBg=expired?'color-mix(in srgb,var(--red) 3%,var(--card))':'var(--card)';
    var hdrBg=expired?'color-mix(in srgb,var(--red) 5%,var(--surface))':'var(--surface)';
    var expiredNote=expired
      ?'<div style="margin-bottom:10px;padding:10px 12px;background:var(--red-light);border-radius:8px;border:1px solid color-mix(in srgb,var(--red) 40%,transparent);font-size:12px;color:var(--red);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
          +'<span>&#9888; This flyer expired on <strong>'+f.validTo+'</strong>. Items are shown for reference only — not used in meal plans.</span>'
          +'<button onclick="event.stopPropagation();flyerRemoveConfirm(document.getElementById(\'flyer-rm-'+idx+'\'),'+idx+')" style="background:var(--red);color:#fff;border:none;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:700">Remove</button>'
        +'</div>'
      :'';
    var el=document.createElement('div');
    el.style.cssText='border:'+cardBorder+';border-radius:14px;margin-bottom:10px;overflow:hidden;background:'+cardBg;
    el.innerHTML=
      '<div id="flyer-hdr-'+idx+'" onclick="toggleFlyerAccordion('+idx+')" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;cursor:pointer;user-select:none;background:'+hdrBg+';border-bottom:'+(isOpen?'1.5px solid var(--border)':'none')+'">'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
          +'<span style="font-size:15px">'+(expired?'🕰️':'&#127991;&#65039;')+'</span>'
          +'<span style="font-weight:800;font-size:14px;'+(expired?'color:var(--muted)':'')+'">'+f.store+'</span>'
          +sourceTag
          +'<span style="font-size:11px;color:var(--muted);font-weight:400">'+(f.items?f.items.length:0)+' items</span>'
          +validTag+pantryTag
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:8px">'
          +'<span id="flyer-chevron-'+idx+'" style="font-size:11px;color:var(--muted);transition:transform .2s;display:inline-block;transform:'+(isOpen?'rotate(180deg)':'rotate(0deg)')+'">&#9660;</span>'
          +'<button onclick="event.stopPropagation();flyerRemoveConfirm(this,'+idx+')" id="flyer-rm-'+idx+'" style="background:none;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:2px 10px;font-size:11px;cursor:pointer">Remove</button>'
        +'</div>'
      +'</div>'
      +'<div id="flyer-body-'+idx+'" style="display:'+(isOpen?'block':'none')+';padding:12px">'+expiredNote+itemsHtml+'</div>';
    container.appendChild(el);
  });
  if(document.getElementById('flyer-search-input')&&document.getElementById('flyer-search-input').value) renderFlyerSearch();
}
function toggleFlyerAccordion(idx){
  if(!window._flyerOpen) window._flyerOpen={};
  window._flyerOpen[idx]=(window._flyerOpen[idx]===false)?true:false;
  var open=window._flyerOpen[idx]!==false;
  var body=document.getElementById('flyer-body-'+idx);
  var hdr=document.getElementById('flyer-hdr-'+idx);
  var chev=document.getElementById('flyer-chevron-'+idx);
  if(body) body.style.display=open?'block':'none';
  if(hdr) hdr.style.borderBottom=open?'1.5px solid var(--border)':'none';
  if(chev) chev.style.transform=open?'rotate(180deg)':'rotate(0deg)';
}

function flyerRemoveConfirm(btn,idx){
  if(btn.dataset.confirm==='1'){
    if(!state.flyers)return;
    state.flyers.splice(idx,1);
    if(window._flyerOpen)delete window._flyerOpen[idx];
    saveState();renderFlyers();
  } else {
    btn.dataset.confirm='1';btn.textContent='Sure?';
    btn.style.cssText='background:var(--red);color:#fff;border:none;border-radius:6px;padding:2px 10px;font-size:11px;cursor:pointer';
    setTimeout(function(){
      if(btn.dataset.confirm){btn.dataset.confirm='';btn.textContent='Remove';btn.style.cssText='background:none;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:2px 10px;font-size:11px;cursor:pointer';}
    },3000);
  }
}

function addFlyerItemToPantry(store,flyerIdx,itemIdx){
  var flyer=(state.flyers||[])[flyerIdx]; if(!flyer)return;
  var item=(flyer.items||[])[itemIdx]; if(!item)return;
  if(!state.pantry) state.pantry=[];
  var exists=state.pantry.find(function(p){return p.name.toLowerCase()===item.name.toLowerCase();});
  if(exists){
    exists.stock=(exists.stock||0)+1;
    hhAlert('Updated pantry: '+item.name+' \u2014 now '+exists.stock+' in stock.','\u2705');
  } else {
    var flyerPantrySection=classifyNonFoodItem(item.name)||'Groceries';
    state.pantry.push({id:uid(),name:item.name,qty:item.unit||item.description||'',
      stock:1,price:item.price||'',store:store,section:flyerPantrySection,
      addedDate:new Date().toISOString().split('T')[0],fromFlyer:true});
    hhAlert('Added to pantry: '+item.name+' from '+store+'.','\u2705');
  }
  saveState();renderPantry();renderFlyers();
  if(document.getElementById('flyer-search-input')&&document.getElementById('flyer-search-input').value)renderFlyerSearch();
}

function addFlyerItemToList(store,flyerIdx,itemIdx){
  var flyer=(state.flyers||[])[flyerIdx]; if(!flyer)return;
  var item=(flyer.items||[])[itemIdx]; if(!item)return;
  if(!state.shoppingList) state.shoppingList=[];
  var exists=state.shoppingList.find(function(s){return s.name.toLowerCase()===item.name.toLowerCase();});
  if(exists){
    hhToast(item.name+' is already on your shopping list \uD83D\uDC4D','info');
  } else {
    var price=item.price?(parseFloat((item.price||'').replace(/[^0-9.]/g,''))||null):null;
    state.shoppingList.push({id:uid(),name:item.name,qty:item.unit||item.description||'',store:store,price:price,checked:false,section:classifyNonFoodItem(item.name)||'Groceries',fromFlyer:true});
    hhToast('\uD83D\uDED2 '+item.name+' added to shopping list','success');
  }
  saveState();renderShoppingList();renderFlyers();
  if(document.getElementById('flyer-search-input')&&document.getElementById('flyer-search-input').value)renderFlyerSearch();
}

function renderFlyerSearch(){
  var input=document.getElementById('flyer-search-input');
  var results=document.getElementById('flyer-search-results');
  if(!results)return;
  var query=((input&&input.value)||'').trim().toLowerCase();
  if(!query){results.innerHTML='';return;}
  var matches=[];
  (state.flyers||[]).forEach(function(f,flyerIdx){
    var validTo=f.validTo?new Date(f.validTo):null;
    if(validTo&&validTo<new Date())return;
    (f.items||[]).forEach(function(item,iIdx){
      var searchable=(item.name+' '+(item.unit||'')+' '+(item.category||'')).toLowerCase();
      if(searchable.includes(query)){
        var priceNum=parseFloat((item.price||'').replace(/[^0-9.]/g,''))||null;
        matches.push({item:item,store:f.store,flyerIdx:flyerIdx,iIdx:iIdx,priceNum:priceNum});
      }
    });
  });
  if(!matches.length){
    // V6.22: check if matches exist only in expired flyers
    var expiredMatches=[];
    (state.flyers||[]).forEach(function(f){
      var vt=f.validTo?new Date(f.validTo):null; if(vt){vt.setHours(0,0,0,0);}
      var isExp=vt&&vt<new Date(); if(!isExp)return;
      (f.items||[]).forEach(function(item){
        var searchable=(item.name+' '+(item.unit||'')+' '+(item.category||'')).toLowerCase();
        if(searchable.includes(query)) expiredMatches.push({store:f.store,name:item.name});
      });
    });
    if(expiredMatches.length){
      results.innerHTML='<div style="padding:10px 12px;background:var(--yellow-light);border-radius:8px;border:1px solid color-mix(in srgb,var(--yellow) 40%,transparent);font-size:12px;color:var(--text)">'
        +'&#9200; Matching items found in <strong>'+expiredMatches.length+' expired flyer'+(expiredMatches.length!==1?'s':'')+'</strong> '
        +'(e.g. <em>'+expiredMatches.slice(0,3).map(function(x){return x.name;}).join(', ')+'</em>) — '
        +'but those flyers have expired. <button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="openModal(\'flipp-modal\')">&#x1F6D2; Import Fresh Flyers</button>'
        +'</div>';
    } else {
      results.innerHTML='<div style="color:var(--muted);font-size:13px;padding:6px 0">No items found for "<strong>'+query+'</strong>"</div>';
    }
    return;
  }
  matches.sort(function(a,b){return (a.priceNum||999)-(b.priceNum||999);});
  results.innerHTML='<div style="font-size:11px;color:var(--muted);margin-bottom:8px;font-weight:600">'+matches.length+' result'+(matches.length!==1?'s':'')+' &middot; cheapest first</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px">'
    +matches.map(function(m){
      var inPantry=(state.pantry||[]).some(function(p){return p.name.toLowerCase()===m.item.name.toLowerCase();});
      var onList=(state.shoppingList||[]).some(function(s){return s.name.toLowerCase()===m.item.name.toLowerCase();});
      return '<div style="display:flex;flex-direction:column;padding:9px 11px;background:var(--surface);border:1.5px solid '+(inPantry?'var(--green)':'var(--border)')+';border-radius:10px;font-size:12px;gap:3px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">'
          +'<span style="font-weight:700;flex:1;line-height:1.3">'+m.item.name+'</span>'
          +'<span style="color:var(--green);font-weight:800;font-size:13px;white-space:nowrap">'+(m.item.price||'&mdash;')+'</span>'
        +'</div>'
        +((m.item.unit||m.item.description)?'<div style="font-size:11px;color:var(--muted)">'+(m.item.unit||m.item.description)+'</div>':'')
        +'<div style="font-size:10px;color:var(--muted)">&#128205; '+m.store+'</div>'
        +'<div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap">'
        +'<button onclick="addFlyerItemToList(\''+m.store+'\','+m.flyerIdx+','+m.iIdx+')" style="font-size:10px;background:'+(onList?'var(--accent)':'var(--surface2,#e8f0fe)')+';color:'+(onList?'#fff':'var(--accent)')+';border:1.5px solid var(--accent);border-radius:6px;padding:2px 8px;cursor:pointer;font-weight:700;white-space:nowrap">'+(onList?'✓ On List':'🛒 Add to List')+'</button>'
        +'<button onclick="addFlyerItemToPantry(\''+m.store+'\','+m.flyerIdx+','+m.iIdx+')" style="font-size:10px;background:var(--green-light);color:var(--green);border:1.5px solid var(--green);border-radius:6px;padding:2px 8px;cursor:pointer;font-weight:700;white-space:nowrap">'+(inPantry?'+ Stock Up':'+ Pantry')+'</button>'
        +'</div>'
        +'</div>';
    }).join('')+'</div>';
}

function removeFlyer(idx) {
  if (!state.flyers) return;
  state.flyers.splice(idx, 1);
  saveState();
  renderFlyers();
}

async function uploadFlyer(){
  var storeName = document.getElementById('flyer-store-name').value.trim();
  var fileInput = document.getElementById('flyer-upload-input');
  var file = fileInput.files[0];
  if (!storeName) { hhAlert('Please enter the store name.', '🏪'); return; }
  if (!file) { hhAlert('Please select a flyer PDF.', '📄'); return; }
  var status = document.getElementById('flyer-upload-status');

  try {
    // Step 1 — try text extraction first (fast, cheap)
    status.innerHTML = '<div class="spinner" style="display:inline-block"></div> Reading PDF...';
    var pdfText = '';
    try { pdfText = await extractPDFText(file); } catch(e) { pdfText = ''; }

    var allItems = [];

    if (pdfText && pdfText.length > 100) {
      // Text-based PDF — send text to Claude
      status.innerHTML = '<div class="spinner" style="display:inline-block"></div> Scanning text with AI...';
      var flyerPrompt = 'Here is text from a ' + storeName + ' grocery flyer:\n\n' + pdfText.slice(0, 12000)
        + '\n\nExtract ALL sale items with prices. Return ONLY a JSON array, no markdown: '
        + '[{"name":"item name","price":"$X.XX/unit","category":"meat|produce|dairy|bakery|pantry|frozen|other"}].';
      var rawText = await callClaude(flyerPrompt, 2000);
      try { allItems = JSON.parse(rawText.replace(/```json|```/g,'').trim()); } catch(e) { allItems = []; }

    } else {
      // Image-based PDF (like No Frills, Food Basics) — render pages and use Vision AI
      status.innerHTML = '<div class="spinner" style="display:inline-block"></div> Rendering pages...';
      var pages = await extractPDFImages(file);
      var maxPages = Math.min(pages.length, 8); // Cap at 8 pages to keep cost down

      for (var i = 0; i < maxPages; i++) {
        var pg = pages[i];
        status.innerHTML = '<div class="spinner" style="display:inline-block"></div> Scanning page ' + (i+1) + ' of ' + maxPages + '...';

        try {
          var pageItems = await scanFlyerPageWithVision(pg.base64, storeName, i+1, maxPages);
          allItems = allItems.concat(pageItems);
        } catch(pageErr) {
          console.warn('Page ' + (i+1) + ' scan failed:', pageErr.message);
        }
      }

      // Deduplicate by name
      var seen = {};
      allItems = allItems.filter(function(item) {
        var key = item.name.toLowerCase().trim();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }

    if (allItems.length === 0) {
      status.innerHTML = '&#9888; Could not extract any sale items. Make sure the PDF is a flyer with visible prices.';
      return;
    }

    // Split compound "Item A or Item B" names and sort by category
    allItems = splitFlyerItems(allItems);

    var newFlyer = { id: uid(), store: storeName, validFrom: '', validTo: '', items: allItems, uploadedAt: new Date().toLocaleDateString() };
    if (!state.flyers) state.flyers = [];
    state.flyers.push(newFlyer);
    saveState();
    renderFlyers();
    status.innerHTML = '&#x2705; Scanned ' + allItems.length + ' items from ' + storeName + '!';
    fileInput.value = '';
    document.getElementById('flyer-store-name').value = '';
    // Suggest non-food items
    var nfItems=detectNonFoodItems(allItems.map(function(it){return {name:it.name,price:it.price,store:storeName};}));
    if(nfItems.length)setTimeout(function(){showNonFoodConfirm(nfItems);},400);

  } catch(e) {
    status.innerHTML = '&#10060; Error scanning flyer: ' + e.message;
  }
}

// Vision scan a single flyer page image — returns array of sale items
async function scanFlyerPageWithVision(base64, storeName, pageNum, totalPages) {
  var apiKey = getApiKey();
  var headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-calls': 'true'
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  var resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text:
              'This is page ' + pageNum + ' of ' + totalPages + ' of a ' + storeName + ' grocery flyer. '
              + 'Extract every product that has a SALE PRICE shown. '
              + 'Return ONLY a JSON array, no markdown, no explanation: '
              + '[{"name":"product name","price":"$X.XX","category":"meat|produce|dairy|bakery|pantry|frozen|other"}]. '
              + 'If no sale items are visible on this page, return an empty array: []'
            }
          ]
        }]
      })
    });
  } catch(netErr) {
    throw new Error('Network error: ' + netErr.message);
  }

  if (!resp.ok) {
    var j = {}; try { j = await resp.json(); } catch(e) {}
    if (resp.status === 401) throw new Error('Invalid API key — check the &#x1F511; API Key button.');
    throw new Error('API error ' + resp.status + ': ' + ((j.error && j.error.message) || resp.statusText));
  }

  var data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  var text = ((data.content || []).find(function(c){ return c.type === 'text'; }) || {}).text || '[]';
  var cleaned = text.replace(/```json|```/g, '').trim();
  var match = cleaned.match(/\[[\s\S]*\]/);
  try { return JSON.parse(match ? match[0] : '[]'); } catch(e) { return []; }
}

function switchGroceryTab(tab,btn){
  // Only clear grocery tab buttons, not all toggle buttons across the page
  var groceryTabBtns = document.querySelectorAll('#tab-flyer, #tab-meals, #tab-list, #tab-pantry, #tab-recipes');
  groceryTabBtns.forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  document.getElementById('grocery-flyer').style.display=tab==='flyer'?'':'none';
  document.getElementById('grocery-meals').style.display=tab==='meals'?'':'none';
  document.getElementById('grocery-list').style.display=tab==='list'?'':'none';
  document.getElementById('grocery-pantry').style.display=tab==='pantry'?'':'none';
  document.getElementById('grocery-recipes').style.display=tab==='recipes'?'':'none';
  if(tab==='list')renderShoppingList();
  if(tab==='pantry')renderPantry();
  if(tab==='meals'&&state.mealPlan)renderMealPlanGrid();
  if(tab==='recipes')renderRecipesTab();
}

function renderPantry(){
  const container=document.getElementById('pantry-container');if(!container)return;
  if(!state.pantry)state.pantry=[];
  if(!state.pantry.length){
    container.innerHTML='<div class="empty-state">Your pantry is empty. Add items from flyers, or check off shopping list items!</div>';
    return;
  }
  const SECTION_ORDER=['Groceries','Household','Bathroom','Pet','Other'];
  const SECTION_ICONS={Groceries:'🛒',Household:'🏠',Bathroom:'🧴',Pet:'🐾',Other:'📦'};
  // Default missing sections
  state.pantry.forEach(function(p){if(!p.section)p.section='Groceries';});
  // Sort state
  if(!window._pantrySortCol)window._pantrySortCol='name';
  if(!window._pantrySortDir)window._pantrySortDir=1;
  const col=window._pantrySortCol, dir=window._pantrySortDir;
  function sortItems(items){
    return items.slice().sort(function(a,b){
      var av='', bv='';
      if(col==='name'){av=(a.name||'').toLowerCase();bv=(b.name||'').toLowerCase();}
      else if(col==='stock'){av=a.stock!==undefined?a.stock:1;bv=b.stock!==undefined?b.stock:1;return dir*(av-bv);}
      else if(col==='price'){av=parseFloat(a.price)||0;bv=parseFloat(b.price)||0;return dir*(av-bv);}
      else if(col==='added'){av=a.addedDate||'';bv=b.addedDate||'';}
      return dir*(av<bv?-1:av>bv?1:0);
    });
  }
  function sortArrow(c){
    if(col!==c)return '<span style="color:var(--muted);font-size:10px;margin-left:3px">⇅</span>';
    return '<span style="font-size:10px;margin-left:3px">'+(dir===1?'↑':'↓')+'</span>';
  }
  function thStyle(c){
    var active=col===c;
    return 'cursor:pointer;padding:7px 10px;font-size:11px;font-weight:700;color:'+(active?'var(--accent)':'var(--text2)')+';white-space:nowrap;user-select:none;';
  }

  // ── Build a shared row renderer used by both Staples and regular sections ──
  function buildItemRow(p, isStapleSection){
    var stock=p.stock!==undefined?p.stock:1;
    var outOfStock=stock===0;
    var stockColor=outOfStock?'var(--red)':stock===1?'var(--yellow)':'var(--green)';
    var rowBg=outOfStock?(isStapleSection?'background:rgba(239,68,68,0.07)':'background:rgba(239,68,68,0.04)'):'';
    var sourceTag=p.fromFlyer&&p.store?'<span style="font-size:10px;background:var(--green-light);color:var(--green);border-radius:4px;padding:1px 5px;font-weight:600;margin-left:5px">📍'+p.store+'</span>':'';
    var addedShort=p.addedDate?p.addedDate.slice(5).replace('-','/'):'';
    // Section badge shown inside staple rows so you know what category it is
    var secBadge=isStapleSection?'<span style="font-size:10px;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:1px 5px;margin-left:5px">'+SECTION_ICONS[p.section||'Groceries']+(p.section||'Groceries')+'</span>':'';
    // Restock badge — shown when staple is out of stock
    var restockBadge=outOfStock&&isStapleSection?'<span style="font-size:10px;font-weight:800;background:var(--red-light);color:var(--red);border-radius:5px;padding:2px 7px;margin-left:6px;border:1px solid var(--red)">⚠️ Restock Needed</span>':'';
    // Staple toggle button
    var stapleBtn=isStapleSection
      ?'<button onclick="removeFromStaples(\''+p.id+'\')" title="Remove from Staples" style="background:rgba(212,160,23,0.12);border:1px solid var(--yellow);border-radius:6px;padding:2px 7px;cursor:pointer;color:var(--yellow);font-size:12px;font-weight:700" title="Remove from Staples">★ Staple</button>'
      :'<button onclick="togglePantryStaple(\''+p.id+'\')" title="Mark as Staple" style="background:none;border:1px solid var(--border);border-radius:6px;padding:2px 7px;cursor:pointer;color:var(--muted);font-size:12px;font-weight:700">☆ Staple</button>';
    return '<tr style="border-bottom:1px solid var(--border);'+rowBg+'">'
      +'<td style="padding:8px 10px;font-weight:600">'+p.name+sourceTag+secBadge+restockBadge+(p.qty?'<span style="font-size:11px;color:var(--muted);margin-left:6px">'+p.qty+'</span>':'')+'</td>'
      +'<td style="padding:8px 10px;text-align:center">'
        +'<div style="display:flex;align-items:center;justify-content:center;gap:5px">'
          +'<button onclick="adjustPantryStock(\''+p.id+'\',-1)" style="background:var(--red-light);border:none;border-radius:5px;padding:1px 7px;cursor:pointer;color:var(--red);font-weight:700;font-size:13px">&minus;</button>'
          +'<span style="min-width:22px;text-align:center;font-weight:800;color:'+stockColor+';font-size:13px">'+stock+'</span>'
          +'<button onclick="adjustPantryStock(\''+p.id+'\',1)" style="background:var(--green-light);border:none;border-radius:5px;padding:1px 7px;cursor:pointer;color:var(--green);font-weight:700;font-size:13px">+</button>'
        +'</div>'
      +'</td>'
      +'<td style="padding:8px 10px;text-align:right;color:var(--green);font-weight:700">'+(p.price?'$'+parseFloat(p.price).toFixed(2):'<span style="color:var(--muted)">—</span>')+'</td>'
      +'<td style="padding:8px 10px;color:var(--muted);font-size:12px">'+addedShort+'</td>'
      +'<td style="padding:8px 10px;display:flex;gap:5px;align-items:center;flex-wrap:wrap">'
        +stapleBtn
        +'<button onclick="removePantryItem(\''+p.id+'\')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:2px 9px;cursor:pointer;color:var(--red);font-size:12px;font-weight:700">✕</button>'
      +'</td>'
    +'</tr>';
  }

  function buildSectionTable(items, isStapleSection){
    return '<div style="overflow-x:auto">'
      +'<table style="width:100%;border-collapse:collapse;font-size:13px">'
      +'<thead><tr style="border-bottom:1.5px solid var(--border);background:var(--surface)">'
        +'<th style="'+thStyle('name')+'" onclick="pantrySort(\'name\')">Item '+sortArrow('name')+'</th>'
        +'<th style="'+thStyle('stock')+';text-align:center" onclick="pantrySort(\'stock\')">Stock '+sortArrow('stock')+'</th>'
        +'<th style="'+thStyle('price')+';text-align:right" onclick="pantrySort(\'price\')">Price '+sortArrow('price')+'</th>'
        +'<th style="'+thStyle('added')+'" onclick="pantrySort(\'added\')">Added '+sortArrow('added')+'</th>'
        +'<th style="padding:7px 10px;font-size:11px;font-weight:700;color:var(--text2)">Actions</th>'
      +'</tr></thead>'
      +'<tbody>'
      +items.map(function(p){return buildItemRow(p, isStapleSection);}).join('')
      +'</tbody></table></div>';
  }

  var html='';

  // ── STAPLES SECTION (always at the top) ────────────────────────────────
  var staples = state.pantry.filter(function(p){return !!p.isStaple;});
  if(staples.length){
    // Out-of-stock first, then alphabetical
    staples.sort(function(a,b){
      var aOut=(a.stock||0)===0, bOut=(b.stock||0)===0;
      if(aOut!==bOut) return aOut?-1:1;
      return (a.name||'').toLowerCase().localeCompare((b.name||'').toLowerCase());
    });
    var staplesOutOfStock=staples.filter(function(p){return (p.stock||0)===0;}).length;
    var staplesOk=staples.length-staplesOutOfStock;
    html+='<div style="margin-bottom:28px">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:2.5px solid var(--yellow)">'
        +'<span style="font-size:18px">⭐</span>'
        +'<span style="font-weight:900;color:var(--yellow);font-size:14px;letter-spacing:0.5px">STAPLES</span>'
        +'<span style="font-size:11px;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:1px 10px;margin-left:2px">'+staples.length+' items</span>'
        +(staplesOk>0?'<span style="font-size:11px;font-weight:700;color:var(--green);background:var(--green-light);border-radius:20px;padding:1px 10px">✓ '+staplesOk+' in stock</span>':'')
        +(staplesOutOfStock>0?'<span style="font-size:11px;font-weight:800;color:var(--red);background:var(--red-light);border-radius:20px;padding:1px 10px">⚠️ '+staplesOutOfStock+' need restocking</span>':'')
        +'<div style="margin-left:auto;font-size:11px;color:var(--muted)">Always-on essentials — stock counter turns red at zero so you never miss a restock</div>'
      +'</div>'
      +buildSectionTable(staples, true)
      +'</div>';
  } else {
    // Hint strip when no staples exist yet
    html+='<div style="margin-bottom:20px;padding:12px 16px;background:color-mix(in srgb,var(--yellow) 8%,var(--card));border:1.5px dashed color-mix(in srgb,var(--yellow) 50%,var(--border));border-radius:12px;display:flex;align-items:center;gap:10px">'
      +'<span style="font-size:22px">⭐</span>'
      +'<div><div style="font-size:13px;font-weight:700;color:var(--text)">No Staples yet</div>'
      +'<div style="font-size:12px;color:var(--muted)">Click the <strong>☆ Staple</strong> button on any pantry item — or check <strong>Mark as Staple</strong> when adding — to pin household essentials here. Stock turns red at zero so you\'ll always know what to grab at the store.</div></div>'
      +'</div>';
  }

  // ── REGULAR SECTIONS ──────────────────────────────────────────────────
  // Exclude staple items from section groups (they're already shown above)
  var nonStaples = state.pantry.filter(function(p){return !p.isStaple;});
  var bySection={};
  nonStaples.forEach(function(p){var s=p.section||'Groceries';if(!bySection[s])bySection[s]=[];bySection[s].push(p);});
  SECTION_ORDER.filter(function(sec){return bySection[sec]&&bySection[sec].length;}).forEach(function(sec){
    var items=sortItems(bySection[sec]);
    var outOfStock=items.filter(function(p){return (p.stock||0)===0;}).length;
    html+='<div style="margin-bottom:24px">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:2.5px solid var(--accent)">'
        +'<span style="font-size:18px">'+(SECTION_ICONS[sec]||'📦')+'</span>'
        +'<span style="font-weight:900;color:var(--accent);font-size:14px;letter-spacing:0.5px">'+sec.toUpperCase()+'</span>'
        +'<span style="margin-left:auto;font-size:12px;color:var(--muted)">'+items.length+' item'+(items.length!==1?'s':'')+(outOfStock?' &middot; <span style="color:var(--red);font-weight:700">'+outOfStock+' out</span>':'')+'</span>'
      +'</div>'
      +buildSectionTable(items, false)
      +'</div>';
  });

  container.innerHTML=html;
}
function pantrySort(col){
  if(window._pantrySortCol===col){window._pantrySortDir=(window._pantrySortDir||1)*-1;}
  else{window._pantrySortCol=col;window._pantrySortDir=1;}
  renderPantry();
}
function togglePantryStaple(id){
  var item=state.pantry.find(function(p){return p.id===id;});
  if(!item)return;
  item.isStaple=true;
  saveState();renderPantry();
  hhToast('⭐ '+item.name+' added to Staples','success');
}
function removeFromStaples(id){
  var item=state.pantry.find(function(p){return p.id===id;});
  if(!item)return;
  item.isStaple=false;
  saveState();renderPantry();
  hhToast(item.name+' removed from Staples','info');
}
function adjustPantryStock(id, delta){
  var item=state.pantry.find(function(p){return p.id===id;});
  if(!item)return;
  if(item.stock===undefined)item.stock=1;
  item.stock=Math.max(0,item.stock+delta);
  saveState();renderPantry();
}
function addPantryItem(){
  const name=document.getElementById('pantry-item-name').value.trim();if(!name)return;
  if(!state.pantry)state.pantry=[];
  const stock=parseInt(document.getElementById('pantry-item-stock').value)||1;
  const section=document.getElementById('pantry-item-section')?document.getElementById('pantry-item-section').value:'Groceries';
  const isStaple=!!(document.getElementById('pantry-item-staple')&&document.getElementById('pantry-item-staple').checked);
  const exists=state.pantry.find(p=>p.name.toLowerCase()===name.toLowerCase());
  if(exists){ exists.stock=(exists.stock||1)+stock; if(isStaple)exists.isStaple=true; }
  else { state.pantry.push({id:uid(),name,qty:document.getElementById('pantry-item-qty').value,stock:stock,section:section,isStaple:isStaple,addedDate:new Date().toISOString().split('T')[0]}); }
  saveState();closeModal('add-pantry-modal');
  document.getElementById('pantry-item-name').value='';document.getElementById('pantry-item-qty').value='';document.getElementById('pantry-item-stock').value='1';
  if(document.getElementById('pantry-item-section'))document.getElementById('pantry-item-section').value='Groceries';
  if(document.getElementById('pantry-item-staple'))document.getElementById('pantry-item-staple').checked=false;
  renderPantry();
}
function removePantryItem(id){state.pantry=state.pantry.filter(p=>p.id!==id);saveState();renderPantry();}
function clearPantry(){hhConfirm('Clear all pantry items?','🗑️','Clear Pantry').then(function(ok){if(!ok)return;state.pantry=[];saveState();renderPantry();});}

// API KEY MANAGEMENT
function getApiKey() {
  return hhStorageGet('mh_anthropic_key') || '';
}
function saveApiKey() {
  var key = (document.getElementById('api-key-input').value || '').trim();
  if (!key) { document.getElementById('api-key-status').innerHTML = '<span style="color:var(--red)">Please enter a key.</span>'; return; }
  if (!key.startsWith('sk-ant-')) { document.getElementById('api-key-status').innerHTML = '<span style="color:var(--yellow)">&#9888; Key should start with sk-ant- — double check you copied it correctly.</span>'; }
  hhStorageSet('mh_anthropic_key', key);
  document.getElementById('api-key-status').innerHTML = '<span style="color:var(--green)">&#10003; Key saved!</span>';
  updateApiKeyBtn();
  setTimeout(function(){ closeModal('api-key-modal'); }, 800);
}
function clearApiKey() {
  hhConfirm('Remove your saved API key?', '🔑').then(function(ok) {
    if (!ok) return;
    hhStorageRemove('mh_anthropic_key');
    document.getElementById('api-key-input').value = '';
    document.getElementById('api-key-status').innerHTML = '<span style="color:var(--muted)">Key cleared.</span>';
    updateApiKeyBtn();
  });
}
function updateApiKeyBtn() {
  var btn = document.getElementById('api-key-btn');
  if (!btn) return;
  var hasKey = !!getApiKey();
  btn.innerHTML = hasKey ? '&#x1F511; API Key &#x2713;' : '&#x1F511; API Key';
  btn.style.color = hasKey ? 'var(--green)' : '';
  btn.style.borderColor = hasKey ? 'var(--green)' : '';
}
// Pre-fill input when opening modal
var _origOpenModal = openModal;
openModal = function(id) {
  if (id === 'api-key-modal') {
    var stored = getApiKey();
    document.getElementById('api-key-input').value = stored ? stored : '';
    document.getElementById('api-key-status').innerHTML = stored
      ? '<span style="color:var(--green)">&#10003; Key is saved — AI features are enabled.</span>'
      : '<span style="color:var(--muted)">No key saved yet.</span>';
  }
  _origOpenModal(id);
};

// Shared helper — wraps all Anthropic API calls, uses stored API key
async function callClaude(prompt, maxTokens) {
  var apiKey = getApiKey();
  var headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-calls': 'true'
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  var resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens || 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
  } catch(netErr) {
    throw new Error('Could not reach Anthropic API. Check your internet connection. (' + netErr.message + ')');
  }
  if (!resp.ok) {
    var errText = '';
    try {
      var j = await resp.json();
      errText = (j.error && j.error.message) || resp.statusText;
      // 401 = bad/missing key
      if (resp.status === 401) {
        throw new Error('Invalid or missing API key. Click the &#x1F511; API Key button in the top-right to add your key from console.anthropic.com');
      }
    } catch(e2) {
      if (e2.message && e2.message.includes('API key')) throw e2;
      errText = resp.statusText;
    }
    throw new Error('API error ' + resp.status + ': ' + errText);
  }
  var data = await resp.json();
  if (data.error) throw new Error(data.error.message || 'API error');
  return ((data.content || []).find(function(c){ return c.type === 'text'; }) || {}).text || '';
}

// ── Sale catalogue helpers ────────────────────────────────────────────────
function buildSaleCatalogue(){
  var allItems=[];
  (state.flyers||[]).forEach(function(f){
    var validTo=f.validTo?new Date(f.validTo):null; if(validTo&&validTo<new Date())return;
    (f.items||[]).forEach(function(i){
      var pm=(i.price||'').match(/\$?([\d]+\.?\d*)/);
      allItems.push({name:i.name||'',price:i.price||'',priceNum:pm?parseFloat(pm[1]):null,
        store:f.store||'Unknown',category:i.category||'other',unit:i.unit||i.description||''});
    });
  });
  // Normalize: strip units/numbers, keep meaningful words, sort alphabetically so
  // "Boneless Chicken Breast" and "Chicken Breast Boneless" map to the same key
  function normKey(n){
    return n.toLowerCase()
      .replace(/\d+\s*(g|kg|lb|lbs|oz|ml|l|pk|pack|packs|count|ct|piece|pieces)\b/gi,'')
      .replace(/[^a-z\s]/g,'').replace(/\s+/g,' ').trim()
      .split(' ').filter(function(w){return w.length>2;})
      .sort().slice(0,4).join(' ');
  }
  var grouped={};
  allItems.forEach(function(item){
    var k=normKey(item.name);
    if(!k)return; // skip items that normalize to empty
    if(!grouped[k])grouped[k]=[];
    grouped[k].push(item);
  });
  var bestByKey={};
  Object.keys(grouped).forEach(function(k){
    var c=grouped[k].filter(function(i){return i.priceNum!==null;}); if(!c.length)c=grouped[k];
    c.sort(function(a,b){return (a.priceNum||999)-(b.priceNum||999);}); bestByKey[k]=c[0];
  });
  return {saleItems:allItems,bestByKey:bestByKey,grouped:grouped,normKey:normKey};
}

function strictPantryCheck(name){
  var n=name.toLowerCase().trim(); var nWords=n.split(/\s+/);
  return (state.pantry||[]).some(function(p){
    var pn=(p.name||'').toLowerCase().trim(); var pWords=pn.split(/\s+/);
    if(pn===n)return true;
    if(pn.includes(n)&&nWords.length>=2)return true;
    if(n.includes(pn)&&pWords.length>=2)return true;
    if(pWords.length===1&&nWords.length===1&&pWords[0]===nWords[0])return true;
    return false;
  });
}

function findBestPrice(name,cat){
  var n=name.toLowerCase().trim(); var words=n.split(/\s+/).filter(function(w){return w.length>2;}); var matches=[];
  Object.keys(cat.bestByKey).forEach(function(k){
    var item=cat.bestByKey[k]; var iname=item.name.toLowerCase(); var score=0;
    if(iname.includes(n)||n.includes(iname))score=3; else words.forEach(function(w){if(iname.includes(w))score++;});
    if(score>0)matches.push({item:item,score:score});
  });
  if(!matches.length)return null;
  matches.sort(function(a,b){return b.score!==a.score?b.score-a.score:(a.item.priceNum||999)-(b.item.priceNum||999);});
  return matches[0].item;
}

async function generateMealPlan(){
  var btn=document.getElementById('gen-meal-btn');
  // V6.22: warn if all flyers are expired before burning an API call
  var nowCheck=new Date(); nowCheck.setHours(0,0,0,0);
  var activeFlyers0=(state.flyers||[]).filter(function(f){
    var vt=f.validTo?new Date(f.validTo):null; if(vt)vt.setHours(0,0,0,0); return !vt||vt>=nowCheck;
  });
  var hasAnyFlyers=(state.flyers||[]).length>0;
  if(hasAnyFlyers&&activeFlyers0.length===0){
    var proceed=await hhConfirm(
      'All your loaded flyers have expired so the meal plan <strong>won\u2019t use any sale prices</strong>.<br><br>'
      +'<strong>Tip:</strong> Import fresh flyers first for the best results.<br><br>'
      +'Generate anyway?',
      '⚠️','Flyers Expired');
    if(!proceed)return;
  }
  btn.disabled=true;btn.innerHTML='<div class="spinner"></div> Generating...';
  switchGroceryTab('meals',document.getElementById('tab-meals'));
  document.getElementById('meal-plan-loading').style.display='block';
  document.getElementById('meal-plan-grid').innerHTML='';
  document.getElementById('meal-plan-empty').style.display='none';
  try{
    var catalogue=buildSaleCatalogue(); var saleItems=catalogue.saleItems;
    // Build per-category sale string with best price first, all alternatives listed
    var byCat={};
    Object.keys(catalogue.grouped).forEach(function(normK){
      var variants=catalogue.grouped[normK];
      // Sort all variants cheapest first
      variants.sort(function(a,b){return (a.priceNum||999)-(b.priceNum||999);});
      var best=variants[0]; var cat=best.category||'other';
      if(!byCat[cat])byCat[cat]=[];
      // Show best price store, then all other stores with their prices
      var alts=variants.slice(1)
        .filter(function(v,i,arr){return arr.findIndex(function(x){return x.store===v.store;})==i;}) // dedupe stores
        .map(function(v){return v.store+(v.price?' '+v.price:'');}).join(', ');
      byCat[cat].push(best.name+(best.price?' '+best.price:'')+'@'+best.store+(alts?' (also: '+alts+')':''));
    });
    // Active (non-expired) flyers with item counts for the prompt header
    var activeFlyers=(state.flyers||[]).filter(function(f){var vt=f.validTo?new Date(f.validTo):null;return !vt||vt>=new Date();});
    var storeNames=activeFlyers.map(function(f){return f.store;}).filter(function(s,i,a){return a.indexOf(s)===i;});
    var flyerSummary=activeFlyers.length
      ? 'FLYERS LOADED ('+activeFlyers.length+'): '+activeFlyers.map(function(f){return f.store+' ('+( f.items||[]).length+' items)';}).join(', ')
      : '';
    var saleStr=Object.keys(byCat).map(function(cat){return cat.toUpperCase()+':\n  '+byCat[cat].join('\n  ');}).join('\n');
    if(!saleStr)saleStr='chicken breast, ground beef, eggs, mixed vegetables, pasta, rice';
    var pantryItems=(state.pantry||[]).map(function(p){return p.name;});
    var pantryStr=pantryItems.length?pantryItems.join(', '):'basic pantry staples (oil, salt, pepper, garlic, onion)';
    var prefs=state.dietPrefs||{}; var prefLines=[];
    if(prefs.avoid)prefLines.push('NEVER use: '+prefs.avoid);
    if(prefs.favourites)prefLines.push('Favourite meals/cuisines: '+prefs.favourites);
    if(prefs.dietStyle&&prefs.dietStyle.length)prefLines.push('Diet style: '+prefs.dietStyle.join(', '));
    if(prefs.complexity)prefLines.push('Cooking complexity: '+prefs.complexity);
    if(prefs.notes)prefLines.push('Notes: '+prefs.notes);
    var ratings=state.mealRatings||{}; var liked=[],disliked=[];
    Object.keys(ratings).forEach(function(meal){if(ratings[meal]>=4)liked.push(meal);else if(ratings[meal]<=2)disliked.push(meal);});
    if(liked.length)prefLines.push('Loved (re-use): '+liked.slice(0,8).join(', '));
    if(disliked.length)prefLines.push('Disliked (avoid): '+disliked.slice(0,8).join(', '));
    var dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var now=new Date();
    // Start from today if before 7 PM, otherwise start from tomorrow
    var planStart=new Date(now);
    planStart.setHours(0,0,0,0);
    if(now.getHours()>=19) planStart.setDate(planStart.getDate()+1);
    // Build DAYS array as 7 consecutive days from planStart
    var DAYS=[];
    for(var _i=0;_i<7;_i++){var _sd=new Date(planStart);_sd.setDate(planStart.getDate()+_i);DAYS.push(dayNames[_sd.getDay()]);}
    var nextMonday=planStart; // alias so remaining code using nextMonday still works
    // Keywords that identify a work/shift calendar event title
    var WORK_KWS=['work','shift','office','on shift','opening','closing','morning shift','afternoon shift','evening shift','breakfast shift','lunch shift','dinner shift','am shift','pm shift','early shift','late shift','on duty'];
    function isWorkEvent(title){
      var t=(title||'').toLowerCase().trim();
      return WORK_KWS.some(function(kw){return t===kw||t.startsWith(kw+' ')||t.endsWith(' '+kw)||t.indexOf(kw)!==-1;});
    }
    // Parse time string ("6:00 AM", "14:30", "6:00") → decimal hours
    function parseHour(str){
      if(!str)return null;
      var s=str.trim().toUpperCase();
      var pm=s.indexOf('PM')!==-1, am=s.indexOf('AM')!==-1;
      s=s.replace(/AM|PM/g,'').trim();
      var parts=s.split(':'); var h=parseInt(parts[0])||0, mn=parseInt(parts[1])||0;
      if(pm&&h!==12)h+=12; if(am&&h===12)h=0;
      return h+mn/60;
    }
    // Build rich per-member per-day schedule
    var richSchedule={};
    DAYS.forEach(function(d){richSchedule[d]={};});
    for(var d=0;d<7;d++){
      var dd=new Date(nextMonday);dd.setDate(nextMonday.getDate()+d);
      var dateStr=dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0')+'-'+String(dd.getDate()).padStart(2,'0');
      var dayName=dayNames[dd.getDay()];
      (state.calEvents||[]).filter(function(e){return e.date===dateStr;}).forEach(function(e){
        if(!isWorkEvent(e.title))return;
        // Prefer resolved name (e.person) over raw calendar ID (e.gcalPerson)
        var personName=(e.person||'').toLowerCase();
        var startH=parseHour(e.start), endH=parseHour(e.end);
        var timeStr=e.start?(e.start+(e.end?' – '+e.end:'')):(e.allDay?'all day':'');
        (state.members||[]).forEach(function(mb){
          if(personName!==mb.name.toLowerCase())return;
          var mk=mb.name.charAt(0).toLowerCase()+mb.name.slice(1);
          richSchedule[dayName][mk]={
            working:true, timeStr:timeStr, startH:startH, endH:endH,
            atBreakfast: startH!==null && startH<=9,
            atLunch:     startH!==null && startH<=13 && (endH===null||endH>=12),
            atDinner:    endH!==null   && endH>=17
          };
        });
      });
      // Members with no matching work event = day off
      (state.members||[]).forEach(function(mb){
        var mk=mb.name.charAt(0).toLowerCase()+mb.name.slice(1);
        if(!richSchedule[dayName][mk])
          richSchedule[dayName][mk]={working:false,timeStr:'',atBreakfast:false,atLunch:false,atDinner:false};
      });
    }
    // Store on window so renderMealPlanGrid can use schedule data and dates for labels
    window._richSchedule=richSchedule;
    window._mealPlanDayOrder=DAYS;
    var _dayDateMap={};
    for(var _d=0;_d<7;_d++){var _dd=new Date(planStart);_dd.setDate(planStart.getDate()+_d);_dayDateMap[dayNames[_dd.getDay()]]=_dd.toISOString();}
    window._mealPlanDates=_dayDateMap;
    // Persist to state so dates and order survive page reload
    state.mealPlanDayOrder=DAYS;
    state.mealPlanDates=_dayDateMap;
    // Build AI prompt context
    var calCtxLines=[], workingDayCount=0;
    DAYS.forEach(function(dayName){
      var parts=[];
      (state.members||[]).forEach(function(mb){
        var mk=mb.name.charAt(0).toLowerCase()+mb.name.slice(1);
        var info=richSchedule[dayName][mk];
        if(!info||!info.working){parts.push('  '+mb.name+': DAY OFF → plan sit-down meals');return;}
        workingDayCount++;
        var meals=[];
        if(info.atBreakfast) meals.push('at work for breakfast → grab-and-go');
        if(info.atLunch)     meals.push('at work for lunch → packed/portable');
        if(info.atDinner)    meals.push('at work for dinner → quick or make-ahead');
        if(!meals.length)    meals.push('home for all meals');
        parts.push('  '+mb.name+': WORKING '+info.timeStr+' → '+meals.join(', '));
      });
      calCtxLines.push(dayName+':\n'+parts.join('\n'));
    });
    var calCtx=calCtxLines.length
      ? 'WORK SCHEDULES FOR NEXT 7 DAYS (derived from calendar):\n'+calCtxLines.join('\n')
        +'\n\nSCHEDULE RULES:\n'
        +'- "at work for breakfast" → that person gets grab-and-go breakfast (e.g. "Granola bar & coffee to go", "Overnight oats in a jar")\n'
        +'- "at work for lunch" → that person gets a packed portable lunch (e.g. "Packed: chicken wrap", "Thermos soup")\n'
        +'- "at work for dinner" → dinner is late or solo; use quick/make-ahead option\n'
        +'- "DAY OFF" → plan a proper sit-down meal, no grab-and-go needed\n'
        +'- If only one person is home for a meal, plan a simple single-portion option'
      : 'No work schedule events found in calendar — apply sensible weekday/weekend defaults.';
    var prefCtx=prefLines.length?'\nPREFERENCES:\n'+prefLines.join('\n'):'';
    var lmEl=document.getElementById('meal-plan-loading-msg');
    if(lmEl)lmEl.textContent='Reading calendar & preferences...';
    var hintEl=document.getElementById('meal-plan-cal-hint');
    if(hintEl)hintEl.innerHTML=workingDayCount>0
      ?'&#x1F4C5; Work schedules read for <strong>'+workingDayCount+' member-day'+(workingDayCount!==1?'s':'')+'</strong> this week.'
      :'';
    // Locked meals context
    var locked=state.lockedMeals||{}; var lockedDays=DAYS.filter(function(d){return locked[d];});
    var lockedCtx='';
    if(lockedDays.length&&state.mealPlan){
      lockedCtx='\nLOCKED MEALS — keep these EXACTLY as written:\n';
      lockedDays.forEach(function(day){
        var lm=state.mealPlan[day]; if(!lm)return;
        var _lmMems=(state.members||[]);
        var _lmParts=_lmMems.map(function(mb){var mk=mb.name.charAt(0).toLowerCase()+mb.name.slice(1);return mb.name+' breakfast='+lm[mk+'Breakfast']+', lunch='+lm[mk+'Lunch'];});
        lockedCtx+=day+': '+_lmParts.join(' / ')+', dinner='+lm.dinner+'\n';
      });
    }
    if(lmEl)lmEl.textContent='Generating meal plan with AI...';
    var numPeople=(state.members||[]).length||2;
    var numChildren=(state.children||[]).length;
    var totalPeople=numPeople+numChildren;
    var memberNames=(state.members||[]).map(function(m){return m.name;}).join(' and ')||'a couple';
    // Build dietary context
    var dietCtx='';
    var ls=state.lifestyle||{};
    if(ls.allergies) dietCtx+='ALLERGIES/RESTRICTIONS: '+ls.allergies+'\n';
    if(ls.memberDiets) {
      (state.members||[]).forEach(function(m){
        var d=(ls.memberDiets[m.id]||[]);
        if(d.length) dietCtx+=m.name+' diet: '+d.join(', ')+'\n';
      });
    }
    if(numChildren>0) {
      var today=new Date();
      var childDesc=(state.children||[]).map(function(c){
        if(!c.dob) return c.name+' (child)';
        var mos=(today.getFullYear()-new Date(c.dob).getFullYear())*12+(today.getMonth()-new Date(c.dob).getMonth());
        var stage=mos<12?'baby/infant':mos<36?'toddler':mos<72?'pre-schooler':mos<144?'child':'teen';
        return c.name+' ('+stage+', '+Math.floor(mos/12)+'yr)';
      }).join(', ');
      dietCtx+='CHILDREN: '+childDesc+'\n';
      dietCtx+='Note: include simple kid-friendly options for young children.\n';
    }
    var storeList=storeNames.length?storeNames.join(', '):'any grocery store';
    // Build name-based JSON keys for the prompt example so AI returns mattBreakfast, hollyLunch etc.
    var mems=state.members&&state.members.length?state.members:[{name:'Member1'},{name:'Member2'}];
    var mk1=mems[0].name.charAt(0).toLowerCase()+mems[0].name.slice(1); // e.g. "matt"
    var mk2=mems[1]?(mems[1].name.charAt(0).toLowerCase()+mems[1].name.slice(1)):'member2';
    var exampleDay='{"'+mk1+'Breakfast":"Oatmeal with berries","'+mk2+'Breakfast":"Greek yogurt & granola",'
      +'"'+mk1+'Lunch":"Turkey sandwich","'+mk2+'Lunch":"Caesar salad wrap",'
      +'"dinner":"Chicken stir-fry","estimatedCost":"~$18","dinnerTag":"quick",'
      +'"recipe":{"prepTime":"10 min","cookTime":"25 min","servings":"'+numPeople+'","ingredients":["2 chicken breasts","1 cup rice"],"steps":["Cook rice","Stir-fry chicken"]},'
      +'"toBuy":[{"item":"chicken breast","qty":"500g","store":"FoodBasics","price":4.99},{"item":"sandwich bread","qty":"1 loaf","store":"Any","price":null}]}';
    var prompt='Create a 7-day meal plan for '+memberNames+(numChildren?' plus '+numChildren+' child'+(numChildren>1?'ren':''):'')+'  ('+totalPeople+' total) in Ontario, Canada.\n\n'
      +(flyerSummary?flyerSummary+'\n\n':'')
      +'AVAILABLE STORES: '+storeList+'\n\n'
      +'SALE ITEMS THIS WEEK — use items from ALL stores listed above (format: best price@store, alternatives in brackets):\n'+saleStr+'\n\n'
      +'PANTRY (do NOT include in toBuy):\n'+pantryStr+'\n\n'
      +dietCtx+'\n'+calCtx+'\n'+prefCtx+'\n'+lockedCtx+'\n'
      +'RULES:\n'
      +'- CRITICAL: Every person must have a breakfast AND lunch entry every single day — never leave these fields empty, null, or omitted. On early work days use quick options like "Grab-and-go: granola bar & coffee" but always fill the field.\n'
      +'- Draw ingredients from ALL available flyers, not just one store. Use the cheapest option when the same item appears in multiple flyers.\n'
      +'- Match meals to work schedules. Early start = quick grab-and-go breakfast & packed lunch. Late finish = quick dinner.\n'
      +'- Dinner always together, under 40 min unless slow-cooker.\n'
      +'- Never repeat the same protein two nights in a row.\n'
      +'- Use pantry items first. Only list genuinely needed items in toBuy.\n'
      +'- toBuy must cover ALL meals that day not in pantry. One item per entry.\n'
      +'- Use sale items and estimate realistic CAD daily cost for '+totalPeople+' people.\n\n'
      +'Return ONLY a JSON object with keys Monday-Sunday. Each day must use these EXACT key names (replace with actual values):\n'
      +exampleDay+'\n'
      +'IMPORTANT: Use "'+mk1+'" and "'+mk2+'" as the name prefixes in ALL keys (e.g. '+mk1+'Breakfast, '+mk2+'Lunch). Never use "mem1" or "mem2".\n'
      +'dinnerTag: quick|slow-cooker|make-ahead|special|normal. price: number or null.\n'
      +'Raw JSON only.';
    var text=await callClaude(prompt,6000);
    var cleaned=text.replace(/```json|```/g,'').trim();
    var match=cleaned.match(/\{[\s\S]*\}/); var plan;
    try{plan=JSON.parse(match?match[0]:cleaned);}catch(e){plan=null;}
    if(plan){
      if(state.mealPlan&&lockedDays.length){lockedDays.forEach(function(day){if(state.mealPlan[day])plan[day]=state.mealPlan[day];});}
      state.mealPlan=plan;state.cookedMeals={};state.lockedMeals=state.lockedMeals||{};
      generateShoppingListFromPlan(plan,catalogue);
      saveState();renderMealPlanGrid();
    } else {throw new Error('Could not parse meal plan - please try again.');}
  } catch(e){
    var errEl=document.getElementById('meal-plan-empty');errEl.style.display='block';
    errEl.innerHTML='<div style="padding:16px;text-align:center"><div style="font-size:24px;margin-bottom:8px">&#9888;&#65039;</div><div style="color:var(--red);font-weight:700;margin-bottom:6px">Generation failed</div><div style="color:var(--muted);font-size:12px;margin-bottom:12px">'+e.message+'</div><button class="btn btn-primary btn-sm" onclick="generateMealPlan()">&#8635; Try Again</button></div>';
  }
  document.getElementById('meal-plan-loading').style.display='none';
  var lm2=document.getElementById('meal-plan-loading-msg');if(lm2)lm2.textContent='Generating meal ideas with AI...';
  btn.disabled=false;btn.innerHTML='&#10024; Generate Meal Plan';
}

function clearMealPlan(){
  hhConfirm('Clear the current meal plan?','🗑️','Clear Plan').then(function(ok){
    if(!ok)return;
    state.mealPlan=null; saveState();
    document.getElementById('meal-plan-grid').innerHTML='';
    var emp=document.getElementById('meal-plan-empty');
    emp.style.display='block';
    emp.innerHTML='Click <strong>&#x2728; Generate Meal Plan</strong> to create your week of meals! &#x1F37D;&#xFE0F;';
    var hintEl=document.getElementById('meal-plan-cal-hint'); if(hintEl)hintEl.textContent='';
  });
}

function rateMeal(day,stars,mealKey){
  var plan=state.mealPlan&&state.mealPlan[day]; if(!plan)return;
  mealKey=mealKey||'dinner';
  if(!state.mealRatings)state.mealRatings={};
  // Key by day+mealKey so each slot is rated independently
  state.mealRatings[day+'__'+mealKey]=stars;
  // Auto-save to Recipe Book when rated 4+ stars (dinners only — they have full recipe data)
  if(stars>=4 && mealKey==='dinner' && plan.dinner && plan.recipe){
    autoSaveRecipeFromMealPlan(day, stars);
  }
  saveState(); renderMealPlanGrid();
}

function clearMealRatings(){
  hhConfirm('Clear all meal ratings?','⭐','Clear Ratings').then(function(ok){
    if(!ok)return;
    state.mealRatings={}; saveState(); renderMealPlanGrid(); closeModal('diet-prefs-modal');
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RECIPE BOOK — V6.26
// ═══════════════════════════════════════════════════════════════════════════

// Auto-save a dinner from the meal plan when rated 4+ stars
function autoSaveRecipeFromMealPlan(day, stars) {
  if (!state.mealPlan || !state.mealPlan[day]) return;
  var plan = state.mealPlan[day];
  if (!plan.dinner || !plan.recipe) return;
  if (!state.recipes) state.recipes = [];
  // Check if this exact dinner name is already saved — avoid duplicates
  var exists = state.recipes.find(function(r) {
    return r.name.toLowerCase() === plan.dinner.toLowerCase() && r.source === 'mealplan';
  });
  if (exists) {
    // Update rating only
    exists.rating = stars;
    saveState();
    hhToast('⭐ Rating updated for ' + plan.dinner + ' in Recipe Book', 'success');
    return;
  }
  var recipe = {
    id: uid(),
    name: plan.dinner,
    source: 'mealplan',
    sourceDate: day,
    image: '',
    rating: stars,
    tag: plan.dinnerTag || 'normal',
    estimatedCost: plan.estimatedCost || '',
    ingredients: (plan.recipe.ingredients || []).map(function(line) {
      return { raw: line, name: _parseIngredientName(line), qty: _parseIngredientQty(line) };
    }),
    steps: plan.recipe.steps || [],
    prepTime: plan.recipe.prepTime || '',
    cookTime: plan.recipe.cookTime || '',
    servings: plan.recipe.servings || '',
    notes: '',
    addedDate: new Date().toISOString().split('T')[0],
    tags: []
  };
  state.recipes.push(recipe);
  saveState();
  hhToast('📖 ' + plan.dinner + ' saved to Recipe Book! (rated ' + stars + '★)', 'success');
}

// Parse ingredient name from a raw ingredient line like "2 cups chicken broth"
function _parseIngredientName(line) {
  return (line || '')
    .replace(/^\d[\d\/\.\s]*(cup|tbsp|tsp|oz|lb|lbs|g|kg|ml|l|clove|cloves|can|cans|pkg|bunch|head|piece|pieces|large|medium|small|whole|pinch|dash)s?\s*/i, '')
    .replace(/^(a|an|some)\s+/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/,.*$/, '')
    .trim();
}
function _parseIngredientQty(line) {
  var m = (line || '').match(/^(\d[\d\/\.\s]*(cup|tbsp|tsp|oz|lb|lbs|g|kg|ml|l|clove|cloves|can|cans|pkg|bunch|head|piece|pieces|large|medium|small|whole|pinch|dash)?s?)/i);
  return m ? m[0].trim() : '';
}

// Find sale matches for a recipe's ingredients
function _recipeSaleMatches(recipe) {
  if (!recipe || !recipe.ingredients || !recipe.ingredients.length) return [];
  var now = new Date(); now.setHours(0,0,0,0);
  var matches = [];
  recipe.ingredients.forEach(function(ing) {
    var name = (ing.name || ing.raw || '').toLowerCase();
    if (!name || name.length < 3) return;
    var words = name.split(' ').filter(function(w) { return w.length > 2; });
    (state.flyers || []).forEach(function(f) {
      var vt = f.validTo ? new Date(f.validTo) : null;
      if (vt && vt < now) return; // expired flyer
      (f.items || []).forEach(function(item) {
        var iname = (item.name || '').toLowerCase();
        var hits = words.filter(function(w) { return iname.includes(w); });
        if (hits.length >= Math.min(2, words.length)) {
          matches.push({ ingredient: ing.name || ing.raw, item: item.name, price: item.price, store: f.store });
        }
      });
    });
  });
  // Deduplicate by ingredient
  var seen = {};
  return matches.filter(function(m) {
    if (seen[m.ingredient]) return false;
    seen[m.ingredient] = true;
    return true;
  });
}

// Check if ingredients are in pantry
function _recipeIngredientPantryStatus(recipe) {
  if (!recipe || !recipe.ingredients) return [];
  return recipe.ingredients.map(function(ing) {
    var name = (ing.name || ing.raw || '').toLowerCase().trim();
    var inPantry = (state.pantry || []).some(function(p) {
      var pn = (p.name || '').toLowerCase().trim();
      return pn === name || pn.includes(name) || (name.length > 3 && name.includes(pn));
    });
    return { ing: ing, inPantry: inPantry };
  });
}

// ── RENDER RECIPES TAB ────────────────────────────────────────────────────
function renderRecipesTab() {
  if (!state.recipes) state.recipes = [];
  var container = document.getElementById('recipes-container');
  var statsBar   = document.getElementById('recipes-stats-bar');
  if (!container) return;

  var search    = (document.getElementById('recipe-search-input') || {}).value || '';
  var filterTag = (document.getElementById('recipe-filter-tag') || {}).value || '';
  var now = new Date(); now.setHours(0,0,0,0);

  // Filter
  var recipes = state.recipes.slice();
  if (search) {
    var sq = search.toLowerCase();
    recipes = recipes.filter(function(r) {
      return r.name.toLowerCase().includes(sq) ||
        (r.notes || '').toLowerCase().includes(sq) ||
        (r.ingredients || []).some(function(i) { return (i.name||i.raw||'').toLowerCase().includes(sq); });
    });
  }
  if (filterTag === 'quick')       recipes = recipes.filter(function(r){ return r.tag==='quick' || (r.prepTime && parseInt(r.prepTime)<=30 && parseInt(r.cookTime||'0')<=30); });
  else if (filterTag === 'slow-cooker')  recipes = recipes.filter(function(r){ return r.tag==='slow-cooker'; });
  else if (filterTag === 'make-ahead')   recipes = recipes.filter(function(r){ return r.tag==='make-ahead'; });
  else if (filterTag === 'special')      recipes = recipes.filter(function(r){ return r.tag==='special'; });
  else if (filterTag === 'rated')        recipes = recipes.sort(function(a,b){ return (b.rating||0)-(a.rating||0); });
  else if (filterTag === 'sale-match')   recipes = recipes.filter(function(r){ return _recipeSaleMatches(r).length > 0; });

  // Sort: by rating desc, then date desc
  if (filterTag !== 'rated') {
    recipes.sort(function(a,b) {
      var rd = (b.rating||0) - (a.rating||0);
      if (rd !== 0) return rd;
      return (b.addedDate||'').localeCompare(a.addedDate||'');
    });
  }

  // Stats bar
  var totalRecipes = state.recipes.length;
  var avgRating = totalRecipes ? (state.recipes.reduce(function(s,r){return s+(r.rating||0);},0)/totalRecipes).toFixed(1) : 0;
  var mealplanCount = state.recipes.filter(function(r){return r.source==='mealplan';}).length;
  var manualCount = totalRecipes - mealplanCount;
  if (statsBar) {
    statsBar.innerHTML = [
      '<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:4px 12px">📖 '+totalRecipes+' recipe'+(totalRecipes!==1?'s':'')+'</span>',
      mealplanCount ? '<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:4px 12px">🍽️ '+mealplanCount+' from Meal Plan</span>' : '',
      manualCount   ? '<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:4px 12px">✍️ '+manualCount+' manual</span>' : '',
      avgRating > 0 ? '<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;background:var(--yellow-light);border:1px solid var(--yellow);border-radius:20px;padding:4px 12px">⭐ '+avgRating+' avg rating</span>' : '',
    ].filter(Boolean).join('');
  }

  if (!recipes.length) {
    container.innerHTML = '<div style="text-align:center;padding:48px 24px;color:var(--muted)">'
      + '<div style="font-size:48px;margin-bottom:12px">📖</div>'
      + '<div style="font-size:16px;font-weight:700;margin-bottom:6px">No recipes yet</div>'
      + '<div style="font-size:13px;margin-bottom:18px">Rate a dinner 4★ or higher in the Meal Plan tab to save it here, or add a recipe manually.</div>'
      + '<button class="btn btn-primary" onclick="openAddRecipeModal()">+ Add Your First Recipe</button>'
      + '</div>';
    return;
  }

  var TAG_COLORS = { quick:'#22c55e', 'slow-cooker':'#f59e0b', 'make-ahead':'#8b5cf6', special:'#ec4899', normal:'var(--muted)' };
  var TAG_LABELS = { quick:'⚡ Quick', 'slow-cooker':'🍲 Slow Cooker', 'make-ahead':'⏰ Make Ahead', special:'✨ Special', normal:'' };

  container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">'
    + recipes.map(function(r) {
        var saleMatches = _recipeSaleMatches(r);
        var pantryStatus = _recipeIngredientPantryStatus(r);
        var inPantryCount = pantryStatus.filter(function(p){ return p.inPantry; }).length;
        var totalIngr = r.ingredients ? r.ingredients.length : 0;
        var tagColor = TAG_COLORS[r.tag] || TAG_COLORS.normal;
        var tagLabel = TAG_LABELS[r.tag] || '';
        var stars = '';
        for (var s=1;s<=5;s++) stars += '<span style="color:'+(s<=(r.rating||0)?'#f59e0b':'#d1d5db');stars+=';font-size:15px">★</span>';
        var sourceLabel = r.source === 'mealplan'
          ? '<span style="font-size:10px;background:var(--green-light);color:var(--green);border-radius:5px;padding:2px 7px;font-weight:700">🍽️ Meal Plan</span>'
          : r.sourceUrl
            ? '<span style="font-size:10px;background:var(--member1-light);color:var(--member1);border-radius:5px;padding:2px 7px;font-weight:700">🔗 Web</span>'
            : '<span style="font-size:10px;background:var(--surface);color:var(--muted);border-radius:5px;padding:2px 7px;font-weight:700">✍️ Manual</span>';
        var saleBadge = saleMatches.length > 0
          ? '<span style="font-size:10px;background:#fef3c7;color:#d97706;border-radius:5px;padding:2px 7px;font-weight:700;border:1px solid #fcd34d">🏷️ '+saleMatches.length+' on sale</span>'
          : '';
        var pantryBadge = (inPantryCount > 0 && totalIngr > 0)
          ? '<span style="font-size:10px;background:var(--green-light);color:var(--green);border-radius:5px;padding:2px 7px;font-weight:700">✅ '+inPantryCount+'/'+totalIngr+' in pantry</span>'
          : '';
        var metaParts = [];
        if (r.prepTime) metaParts.push('⏱ Prep: '+r.prepTime);
        if (r.cookTime) metaParts.push('🔥 Cook: '+r.cookTime);
        if (r.servings) metaParts.push('🍽️ Serves '+r.servings);
        if (r.estimatedCost) metaParts.push('💰 '+r.estimatedCost);
        return '<div class="card" style="margin-bottom:0;padding:0;overflow:hidden;transition:transform 0.2s,box-shadow 0.2s" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'var(--shadow-md)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">'
          // Header band with tag colour
          + '<div style="height:5px;background:'+(tagColor)+';"></div>'
          + '<div style="padding:14px 16px">'
          // Title row
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">'
            + '<div style="font-weight:800;font-size:15px;color:var(--text);line-height:1.3;flex:1">'+r.name+'</div>'
            + '<div style="display:flex;gap:4px;flex-shrink:0">'
              + '<button onclick="openEditRecipeModal(\''+r.id+'\')" title="Edit" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 7px;cursor:pointer;color:var(--muted);font-size:12px">✏️</button>'
              + '<button onclick="deleteRecipe(\''+r.id+'\')" title="Delete" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 7px;cursor:pointer;color:var(--red);font-size:12px">🗑️</button>'
            + '</div>'
          + '</div>'
          // Stars + badges
          + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px">'
            + stars
            + sourceLabel
            + (tagLabel ? '<span style="font-size:10px;background:'+tagColor+'22;color:'+tagColor+';border-radius:5px;padding:2px 7px;font-weight:700">'+tagLabel+'</span>' : '')
            + saleBadge
            + pantryBadge
          + '</div>'
          // Meta info
          + (metaParts.length ? '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">'+metaParts.join(' · ')+'</div>' : '')
          // Ingredients preview
          + (totalIngr > 0 ? '<div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5">'
              + (r.ingredients || []).slice(0,3).map(function(i){ return (i.name||i.raw||''); }).join(', ')
              + (totalIngr > 3 ? ' <span style="color:var(--muted)">+'+( totalIngr-3)+' more</span>' : '')
            + '</div>' : '')
          // Notes
          + (r.notes ? '<div style="font-size:11px;color:var(--muted);font-style:italic;margin-bottom:10px">'+r.notes+'</div>' : '')
          // Action buttons
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:10px;margin-top:2px">'
            + '<button class="btn btn-primary btn-sm" onclick="openRecipeDetail(\''+r.id+'\')" style="font-size:11px">👀 View</button>'
            + '<button class="btn btn-ghost btn-sm" onclick="addRecipeToShoppingList(\''+r.id+'\')" style="font-size:11px">🛒 Shop</button>'
            + '<button class="btn btn-ghost btn-sm" onclick="cookFromRecipeBook(\''+r.id+'\')" style="font-size:11px">🍳 Cook It</button>'
            + '<button class="btn btn-ghost btn-sm" onclick="slotRecipeIntoMealPlan(\''+r.id+'\')" style="font-size:11px">📅 Plan</button>'
          + '</div>'
          + '</div>'
        + '</div>';
      }).join('')
    + '</div>';
}

// ── RECIPE DETAIL MODAL ────────────────────────────────────────────────────
function openRecipeDetail(id) {
  var r = (state.recipes || []).find(function(x){ return x.id === id; });
  if (!r) return;
  var saleMatches = _recipeSaleMatches(r);
  var pantryStatus = _recipeIngredientPantryStatus(r);
  var stars = '';
  for (var s=1;s<=5;s++) stars += '<span onclick="rateRecipeInBook(\''+id+'\','+s+')" style="cursor:pointer;color:'+(s<=(r.rating||0)?'#f59e0b':'#d1d5db')+';font-size:22px;transition:transform 0.1s" onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'\'">★</span>';
  var ingHtml = pantryStatus.map(function(p, i) {
    var raw = p.ing.raw || '';
    var name = p.ing.name || raw;
    var qty  = p.ing.qty  || '';
    // Sale match for this ingredient?
    var saleMatch = saleMatches.find(function(sm){ return sm.ingredient === name; });
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:7px;background:'+(p.inPantry?'var(--green-light)':'var(--surface)')+';border:1px solid '+(p.inPantry?'var(--green)':'var(--border)');+'";margin-bottom:4px">'
      + '<span style="font-size:14px">'+(p.inPantry?'✅':'🛒')+'</span>'
      + '<span style="flex:1;font-size:13px;font-weight:600">' + (qty?'<span style="color:var(--muted);margin-right:4px">'+qty+'</span>':'') + name + '</span>'
      + (saleMatch ? '<span style="font-size:10px;background:#fef3c7;color:#d97706;border-radius:5px;padding:1px 6px;font-weight:700">🏷️ '+saleMatch.price+' @ '+saleMatch.store+'</span>' : '')
      + '</div>';
  }).join('') || '<div style="color:var(--muted);font-size:13px">No ingredients listed.</div>';

  var stepHtml = (r.steps || []).map(function(step, i) {
    return '<div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start">'
      + '<div style="min-width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">'+(i+1)+'</div>'
      + '<div style="font-size:13px;line-height:1.6">'+step+'</div>'
    + '</div>';
  }).join('') || '<div style="color:var(--muted);font-size:13px">No steps listed.</div>';

  var metaParts = [];
  if (r.prepTime) metaParts.push('⏱ Prep: '+r.prepTime);
  if (r.cookTime) metaParts.push('🔥 Cook: '+r.cookTime);
  if (r.servings) metaParts.push('🍽️ Serves '+r.servings);
  if (r.estimatedCost) metaParts.push('💰 ~'+r.estimatedCost);

  document.getElementById('recipe-detail-title').textContent = r.name;
  document.getElementById('recipe-detail-body').innerHTML =
    // Stars
    '<div style="display:flex;align-items:center;gap:4px;margin-bottom:12px">'+stars+'<span style="font-size:12px;color:var(--muted);margin-left:6px">Click to update rating</span></div>'
    // Meta
    + (metaParts.length ? '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">'+metaParts.map(function(m){return '<span style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700">'+m+'</span>';}).join('')+'</div>' : '')
    // Sale alert
    + (saleMatches.length ? '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;font-weight:700;color:#92400e">🏷️ '+saleMatches.length+' ingredient'+(saleMatches.length!==1?'s':'')+' on sale this week: '+saleMatches.map(function(s){return s.item+' ('+s.price+' @ '+s.store+')';}).join(' · ')+'</div>' : '')
    // Pantry note
    + (pantryStatus.filter(function(p){return p.inPantry;}).length ? '<div style="background:var(--green-light);border:1px solid var(--green);border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:12px;color:var(--green);font-weight:700">✅ '+pantryStatus.filter(function(p){return p.inPantry;}).length+' of '+pantryStatus.length+' ingredients already in your pantry</div>' : '')
    // Source / link
    + (r.sourceUrl ? '<div style="margin-bottom:12px"><a href="'+r.sourceUrl+'" target="_blank" style="font-size:12px;color:var(--accent);font-weight:700">🔗 View Original Recipe</a></div>' : '')
    // Ingredients
    + '<div style="font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px">Ingredients</div>'
    + ingHtml
    // Steps
    + '<div style="font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin:14px 0 8px">Steps</div>'
    + stepHtml
    // Notes
    + (r.notes ? '<div style="margin-top:12px;padding:10px 12px;background:var(--yellow-light);border-radius:8px;font-size:12px;color:var(--text2)"><strong>📝 Notes:</strong> '+r.notes+'</div>' : '');

  document.getElementById('recipe-detail-shop-btn').setAttribute('onclick', 'addRecipeToShoppingList(\''+id+'\');closeModal(\'recipe-detail-modal\')');
  document.getElementById('recipe-detail-cook-btn').setAttribute('onclick', 'cookFromRecipeBook(\''+id+'\');closeModal(\'recipe-detail-modal\')');
  document.getElementById('recipe-detail-plan-btn').setAttribute('onclick', 'slotRecipeIntoMealPlan(\''+id+'\');closeModal(\'recipe-detail-modal\')');
  openModal('recipe-detail-modal');
}

function rateRecipeInBook(id, stars) {
  var r = (state.recipes||[]).find(function(x){return x.id===id;});
  if (!r) return;
  r.rating = stars;
  saveState();
  openRecipeDetail(id); // re-render with new stars
}

// ── ADD / EDIT RECIPE MODAL ────────────────────────────────────────────────
function openAddRecipeModal() {
  _recipeEditId = null;
  document.getElementById('add-recipe-modal-title').textContent = '+ Add Recipe';
  document.getElementById('recipe-form-name').value = '';
  document.getElementById('recipe-form-url').value = '';
  document.getElementById('recipe-form-servings').value = '';
  document.getElementById('recipe-form-prep').value = '';
  document.getElementById('recipe-form-cook').value = '';
  document.getElementById('recipe-form-tag').value = 'normal';
  document.getElementById('recipe-form-ingredients').value = '';
  document.getElementById('recipe-form-steps').value = '';
  document.getElementById('recipe-form-notes').value = '';
  document.getElementById('recipe-ai-status').innerHTML = '';
  document.getElementById('recipe-ai-paste').value = '';
  _switchRecipeFormTab('manual');
  openModal('add-recipe-modal');
}

function openEditRecipeModal(id) {
  var r = (state.recipes||[]).find(function(x){return x.id===id;});
  if (!r) return;
  _recipeEditId = id;
  document.getElementById('add-recipe-modal-title').textContent = '✏️ Edit Recipe';
  document.getElementById('recipe-form-name').value = r.name || '';
  document.getElementById('recipe-form-url').value = r.sourceUrl || '';
  document.getElementById('recipe-form-servings').value = r.servings || '';
  document.getElementById('recipe-form-prep').value = r.prepTime || '';
  document.getElementById('recipe-form-cook').value = r.cookTime || '';
  document.getElementById('recipe-form-tag').value = r.tag || 'normal';
  document.getElementById('recipe-form-ingredients').value = (r.ingredients||[]).map(function(i){return i.raw||((i.qty?i.qty+' ':'')+i.name);}).join('\n');
  document.getElementById('recipe-form-steps').value = (r.steps||[]).join('\n');
  document.getElementById('recipe-form-notes').value = r.notes || '';
  document.getElementById('recipe-ai-status').innerHTML = '';
  document.getElementById('recipe-ai-paste').value = '';
  _switchRecipeFormTab('manual');
  openModal('add-recipe-modal');
}

var _recipeEditId = null;

function _switchRecipeFormTab(tab) {
  var manualPanel = document.getElementById('recipe-tab-manual-panel');
  var aiPanel     = document.getElementById('recipe-tab-ai-panel');
  var manualBtn   = document.getElementById('recipe-tab-manual-btn');
  var aiBtn       = document.getElementById('recipe-tab-ai-btn');
  var isManual = tab === 'manual';
  manualPanel.style.display = isManual ? '' : 'none';
  aiPanel.style.display     = isManual ? 'none' : '';
  manualBtn.style.fontWeight   = isManual ? '800' : '400';
  manualBtn.style.borderBottom = isManual ? '2px solid var(--accent)' : '2px solid transparent';
  manualBtn.style.color        = isManual ? 'var(--accent)' : 'var(--muted)';
  aiBtn.style.fontWeight   = !isManual ? '800' : '400';
  aiBtn.style.borderBottom = !isManual ? '2px solid var(--accent)' : '2px solid transparent';
  aiBtn.style.color        = !isManual ? 'var(--accent)' : 'var(--muted)';
}

async function parseRecipeWithAI() {
  var text = (document.getElementById('recipe-ai-paste').value || '').trim();
  var statusEl = document.getElementById('recipe-ai-status');
  if (!text) { statusEl.innerHTML = '<span style="color:var(--red)">⚠️ Please paste some recipe text first.</span>'; return; }
  statusEl.innerHTML = '<span class="spinner" style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:6px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite"></span> Parsing with AI…';
  try {
    var prompt = 'Extract a recipe from the following text. Return ONLY a JSON object, no markdown:\n'
      + '{"name":"Recipe Name","servings":"4","prepTime":"10 min","cookTime":"25 min","ingredients":["2 cups flour","1 tsp salt"],"steps":["Mix dry ingredients","Add wet ingredients"],"sourceUrl":""}\n\n'
      + 'If you can identify a URL in the text, put it in sourceUrl. Keep ingredients as raw strings with quantity included.\n\n'
      + 'Text:\n' + text.slice(0, 8000);
    var raw = await callClaude(prompt, 3000);
    var cleaned = raw.replace(/```json|```/g,'').trim();
    var match = cleaned.match(/\{[\s\S]*\}/);
    var parsed = JSON.parse(match ? match[0] : cleaned);
    // Pre-fill the manual form
    if (parsed.name)      document.getElementById('recipe-form-name').value      = parsed.name;
    if (parsed.servings)  document.getElementById('recipe-form-servings').value  = parsed.servings;
    if (parsed.prepTime)  document.getElementById('recipe-form-prep').value      = parsed.prepTime;
    if (parsed.cookTime)  document.getElementById('recipe-form-cook').value      = parsed.cookTime;
    if (parsed.sourceUrl) document.getElementById('recipe-form-url').value       = parsed.sourceUrl;
    if (parsed.ingredients && parsed.ingredients.length) {
      document.getElementById('recipe-form-ingredients').value = parsed.ingredients.join('\n');
    }
    if (parsed.steps && parsed.steps.length) {
      document.getElementById('recipe-form-steps').value = parsed.steps.join('\n');
    }
    statusEl.innerHTML = '<span style="color:var(--green)">✅ Recipe extracted! Review below and save.</span>';
    _switchRecipeFormTab('manual');
  } catch(e) {
    statusEl.innerHTML = '<span style="color:var(--red)">❌ Could not parse recipe: '+e.message+'</span>';
  }
}

function saveRecipeFromForm() {
  var name = (document.getElementById('recipe-form-name').value || '').trim();
  if (!name) { hhAlert('Please enter a recipe name.', '⚠️'); return; }
  var ingLines = (document.getElementById('recipe-form-ingredients').value || '').split('\n').map(function(l){return l.trim();}).filter(Boolean);
  var stepLines = (document.getElementById('recipe-form-steps').value || '').split('\n').map(function(l){return l.trim();}).filter(Boolean);
  var r = {
    id:          _recipeEditId || uid(),
    name:        name,
    source:      _recipeEditId ? ((state.recipes||[]).find(function(x){return x.id===_recipeEditId;})||{}).source || 'manual' : 'manual',
    sourceUrl:   (document.getElementById('recipe-form-url').value || '').trim(),
    image:       '',
    rating:      _recipeEditId ? ((state.recipes||[]).find(function(x){return x.id===_recipeEditId;})||{}).rating || 0 : 0,
    tag:         document.getElementById('recipe-form-tag').value || 'normal',
    servings:    document.getElementById('recipe-form-servings').value.trim(),
    prepTime:    document.getElementById('recipe-form-prep').value.trim(),
    cookTime:    document.getElementById('recipe-form-cook').value.trim(),
    estimatedCost: '',
    ingredients: ingLines.map(function(line) {
      return { raw: line, name: _parseIngredientName(line), qty: _parseIngredientQty(line) };
    }),
    steps:       stepLines,
    notes:       (document.getElementById('recipe-form-notes').value || '').trim(),
    addedDate:   _recipeEditId ? ((state.recipes||[]).find(function(x){return x.id===_recipeEditId;})||{}).addedDate || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    tags:        []
  };
  if (!state.recipes) state.recipes = [];
  if (_recipeEditId) {
    var idx = state.recipes.findIndex(function(x){return x.id===_recipeEditId;});
    if (idx >= 0) state.recipes[idx] = r; else state.recipes.push(r);
    hhToast('Recipe updated!', 'success');
  } else {
    state.recipes.push(r);
    hhToast('📖 Recipe saved to Recipe Book!', 'success');
  }
  saveState();
  closeModal('add-recipe-modal');
  renderRecipesTab();
}

function deleteRecipe(id) {
  var r = (state.recipes||[]).find(function(x){return x.id===id;});
  if (!r) return;
  hhConfirm('Remove "'+r.name+'" from your Recipe Book?', '🗑️', 'Delete Recipe').then(function(ok){
    if (!ok) return;
    state.recipes = state.recipes.filter(function(x){return x.id!==id;});
    saveState(); renderRecipesTab();
    hhToast('Recipe removed.', '🗑️');
  });
}

// ── ADD RECIPE INGREDIENTS TO SHOPPING LIST ────────────────────────────────
function addRecipeToShoppingList(id) {
  var r = (state.recipes||[]).find(function(x){return x.id===id;});
  if (!r || !r.ingredients || !r.ingredients.length) { hhAlert('This recipe has no ingredients to add.', 'ℹ️'); return; }
  var pantryStatus = _recipeIngredientPantryStatus(r);
  var saleMatches  = _recipeSaleMatches(r);

  // Build the confirmation list showing pantry status + sale info
  var listHtml = pantryStatus.map(function(p, i) {
    var name = p.ing.name || p.ing.raw || '';
    var qty  = p.ing.qty  || '';
    var sm = saleMatches.find(function(s){ return s.ingredient === name; });
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:'+(p.inPantry?'rgba(90,158,122,0.08)':'var(--surface)')+';border:1.5px solid '+(p.inPantry?'var(--green)':'var(--border)')+';margin-bottom:5px">'
      + '<input type="checkbox" id="rsl-ing-'+i+'" '+(p.inPantry?'':'checked')+' style="width:16px;height:16px;accent-color:var(--accent)">'
      + '<span style="flex:1;font-size:13px;'+(p.inPantry?'color:var(--muted)':'')+'">'+(qty?'<span style="color:var(--muted);margin-right:4px">'+qty+'</span>':'')+name+'</span>'
      + (p.inPantry?'<span style="font-size:10px;color:var(--green);font-weight:700">✅ In pantry</span>':'')
      + (sm?'<span style="font-size:10px;background:#fef3c7;color:#d97706;border-radius:4px;padding:1px 5px;font-weight:700">🏷️ '+sm.price+'</span>':'')
    + '</div>';
  }).join('');

  // Use a custom modal-style confirm via the hhDialog queue
  hhDialog({
    type: 'confirm',
    icon: '🛒',
    title: 'Add to Shopping List — ' + r.name,
    message: '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Pantry items are pre-unchecked. Uncheck anything you already have.</div>' + listHtml,
    okText: 'Add Selected',
    cancelText: 'Cancel'
  }).then(function(ok) {
    if (!ok) return;
    if (!state.shoppingList) state.shoppingList = [];
    var added = 0;
    pantryStatus.forEach(function(p, i) {
      var cb = document.getElementById('rsl-ing-'+i);
      if (!cb || !cb.checked) return;
      var name = p.ing.name || p.ing.raw || '';
      var qty  = p.ing.qty  || '';
      var existing = state.shoppingList.find(function(s){ return s.name.toLowerCase() === name.toLowerCase(); });
      if (existing) return; // already on list
      var sm = saleMatches.find(function(s){ return s.ingredient === name; });
      state.shoppingList.push({
        id: uid(), name: name, qty: qty,
        store: sm ? sm.store : 'Any',
        price: sm ? (parseFloat((sm.price||'').replace(/[^0-9.]/g,''))||null) : null,
        checked: false, section: classifyNonFoodItem(name) || 'Groceries',
        fromRecipe: true, recipeId: id
      });
      added++;
    });
    saveState();
    hhToast(added > 0 ? '🛒 '+added+' ingredient'+(added!==1?'s':'')+' added to shopping list!' : 'Nothing new to add.', added>0?'success':'info');
  });
}

// ── COOK IT (deducts from pantry) ─────────────────────────────────────────
function cookFromRecipeBook(id) {
  var r = (state.recipes||[]).find(function(x){return x.id===id;});
  if (!r) return;
  hhConfirm('Mark "'+r.name+'" as cooked and deduct ingredients from pantry?', '🍳', 'Cook It!').then(function(ok) {
    if (!ok) return;
    if (!state.pantry) state.pantry = [];
    var used = [], notInPantry = [];
    (r.ingredients || []).forEach(function(ing) {
      var name = (ing.name || ing.raw || '').toLowerCase().trim();
      if (!name || name.length < 2) return;
      var idx = state.pantry.findIndex(function(p) {
        var pn = (p.name||'').toLowerCase().trim();
        return pn === name || pn.includes(name) || (name.length > 3 && name.includes(pn));
      });
      if (idx >= 0) {
        var item = state.pantry[idx];
        if ((item.stock||1) > 1) { item.stock = (item.stock||1) - 1; used.push(item.name+' ('+item.stock+' left)'); }
        else { used.push(item.name+' — last one used'); state.pantry.splice(idx, 1); }
      } else {
        notInPantry.push(ing.raw || ((ing.qty?ing.qty+' ':'')+name));
      }
    });
    saveState(); renderPantry(); renderRecipesTab();
    var msg = '🍳 '+r.name+' — Cooked!\n\n';
    if (used.length)        msg += '✅ Used from pantry:\n  '+used.join('\n  ');
    if (notInPantry.length) msg += '\n\n📝 Not in pantry (bought fresh):\n  '+notInPantry.join('\n  ');
    hhAlert(msg, '✅');
  });
}

// ── SLOT RECIPE INTO MEAL PLAN ─────────────────────────────────────────────
function slotRecipeIntoMealPlan(id) {
  var r = (state.recipes||[]).find(function(x){return x.id===id;});
  if (!r) return;
  if (!state.mealPlan) { hhAlert('Generate a Meal Plan first, then come back to slot this recipe in.', '📅'); return; }
  var VALID_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var dayOrder = state.mealPlanDayOrder || window._mealPlanDayOrder || VALID_DAYS;
  var days = dayOrder.filter(function(d){ return state.mealPlan[d]; });
  var dayListHtml = days.map(function(d, i) {
    var existing = (state.mealPlan[d]||{}).dinner || '(empty)';
    return '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;margin-bottom:5px">'
      + '<input type="radio" name="slot-day" value="'+d+'" style="accent-color:var(--accent)">'
      + '<div><div style="font-weight:700;font-size:13px">'+d+'</div>'
      + '<div style="font-size:11px;color:var(--muted)">Currently: '+existing+'</div>'
      + '</div></label>';
  }).join('');
  hhDialog({
    type: 'confirm',
    icon: '📅',
    title: 'Slot "'+r.name+'" into Meal Plan',
    message: '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Choose which day to use this recipe for dinner:</div>' + dayListHtml,
    okText: 'Slot It In',
    cancelText: 'Cancel'
  }).then(function(ok) {
    if (!ok) return;
    var selected = document.querySelector('input[name="slot-day"]:checked');
    if (!selected) { hhAlert('Please select a day.', '⚠️'); return; }
    var day = selected.value;
    // Build a mealPlan-compatible entry from the recipe
    var plan = state.mealPlan[day] || {};
    plan.dinner = r.name;
    plan.dinnerTag = r.tag || 'normal';
    plan.recipe = {
      prepTime: r.prepTime || '',
      cookTime: r.cookTime || '',
      servings: r.servings || '',
      ingredients: (r.ingredients||[]).map(function(i){return i.raw||((i.qty?i.qty+' ':'')+i.name);}),
      steps: r.steps || []
    };
    // Rebuild toBuy from recipe ingredients not in pantry
    plan.toBuy = (r.ingredients||[])
      .filter(function(ing){ return !strictPantryCheck(ing.name||ing.raw||''); })
      .map(function(ing){
        var sm = _recipeSaleMatches(r).find(function(s){return s.ingredient===(ing.name||ing.raw);});
        return { item: ing.name||ing.raw, qty: ing.qty||'', store: sm?sm.store:'Any', price: sm?parseFloat((sm.price||'').replace(/[^0-9.]/g,''))||null:null };
      });
    state.mealPlan[day] = plan;
    saveState();
    switchGroceryTab('meals', document.getElementById('tab-meals'));
    renderMealPlanGrid();
    hhToast('📅 '+r.name+' slotted into '+day+' dinner!', 'success');
  });
}

// END RECIPE BOOK

function saveDietPrefs(){
  if(!state.dietPrefs)state.dietPrefs={};
  state.dietPrefs.avoid=document.getElementById('pref-avoid').value.trim();
  state.dietPrefs.favourites=document.getElementById('pref-favourites').value.trim();
  state.dietPrefs.notes=document.getElementById('pref-notes').value.trim();
  state.dietPrefs.complexity=document.getElementById('pref-complexity').value;
  state.dietPrefs.dietStyle=Array.from(document.querySelectorAll('#pref-diet-chips input:checked')).map(function(cb){return cb.value;});
  saveState(); closeModal('diet-prefs-modal');
}
function generateShoppingListFromPlan(plan,catalogue){
  var cat=(catalogue&&catalogue.bestByKey)?catalogue:null;
  var legacySale=cat?[]:(catalogue||[]);
  state.shoppingList=state.shoppingList.filter(function(s){return !s.fromMealPlan;});
  var UNIT_RE=/^\d[\d\/\.\s]*(cup|tbsp|tsp|oz|lb|lbs|g|kg|ml|l|clove|cloves|can|cans|pkg|bunch|head|slice|slices|large|medium|small|whole|handful|pinch|dash|piece|pieces|stalk|stalks|sprig|sprigs|loaf|loaves)s?\s+/i;
  function stripQty(line){return line.replace(UNIT_RE,'').replace(/^\d[\d\/\.\s]+/,'').replace(/^(a|an|some)\s+/i,'').replace(/\(.*?\)/g,'').replace(/,.*$/,'').trim().toLowerCase();}
  var structured=[];
  Object.values(plan).forEach(function(d){
    if(Array.isArray(d.toBuy)&&d.toBuy.length>0){
      d.toBuy.forEach(function(entry){if(!entry||!entry.item)return;structured.push({item:String(entry.item).trim(),qty:String(entry.qty||'').trim(),store:String(entry.store||'Any').trim(),price:(typeof entry.price==='number')?entry.price:null});});
    } else if(d.recipe&&Array.isArray(d.recipe.ingredients)){
      d.recipe.ingredients.forEach(function(line){var n=stripQty(String(line));if(n&&n.length>1)structured.push({item:n,qty:'',store:'Any',price:null});});
    }
  });
  var consolidated={};
  structured.forEach(function(entry){
    var key=entry.item.toLowerCase().replace(/[^a-z\s]/g,'').replace(/\s+/g,' ').trim();
    if(!key||key.length<2)return;
    if(!consolidated[key]){consolidated[key]={item:entry.item,qty:entry.qty,store:entry.store,price:entry.price,count:1};}
    else{var ex=consolidated[key];if(entry.price!==null&&(ex.price===null||entry.price<ex.price)){ex.store=entry.store;ex.price=entry.price;if(entry.qty)ex.qty=entry.qty;}ex.count++;}
  });
  function bestFlyer(name){
    if(cat)return findBestPrice(name,cat);
    for(var fi=0;fi<legacySale.length;fi++){var si=legacySale[fi];var sn=(si.name||'').toLowerCase();var ing=name.toLowerCase().split(' ')[0];if(sn.includes(ing)||ing.includes(sn.split(' ')[0])){var pm=(si.price||'').match(/\$?([\d.]+)/);return{store:si.store||'Any',priceNum:pm?parseFloat(pm[1]):null,unit:''};}}return null;
  }
  Object.keys(consolidated).forEach(function(key){
    var c=consolidated[key];
    if(strictPantryCheck(c.item))return;
    var store=c.store,price=c.price,unit=c.qty;
    if(store==='Any'||price===null){var flyer=bestFlyer(c.item);if(flyer){if(store==='Any')store=flyer.store;if(price===null)price=flyer.priceNum;if(!unit&&flyer.unit)unit=flyer.unit;}}
    var exists=state.shoppingList.find(function(s){return s.name.toLowerCase()===c.item.toLowerCase();});
    if(!exists)state.shoppingList.push({id:uid(),name:c.item,qty:unit,store:store,price:price,checked:false,fromMealPlan:true,section:'Groceries'});
  });
  // Check for non-food items in meal plan ingredients
  var allIngredients=[];
  Object.values(consolidated).forEach(function(c){allIngredients.push({name:c.item,price:c.price,store:c.store||'Any'});});
  var nfItems=detectNonFoodItems(allIngredients);
  if(nfItems.length)setTimeout(function(){showNonFoodConfirm(nfItems);},600);
}

function renderMealPlanGrid(){
  if(!state.mealPlan)return;
  var VALID_DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  // Use stored day order from generation if available, otherwise fall back to Mon-Sun
  var dayOrder=state.mealPlanDayOrder||window._mealPlanDayOrder||VALID_DAYS;
  var days=dayOrder.filter(function(d){return state.mealPlan[d];});
  var pantryCount=(state.pantry||[]).length;
  document.getElementById('meal-plan-empty').style.display='none';

  // Weekly cost
  var totalCostLow=0,totalCostHigh=0;
  days.forEach(function(day){
    var m=state.mealPlan[day];
    var raw=(m.estimatedCost||m.cost||'').replace(/[~$CAD\s]/gi,'');
    var parts=raw.split('-');
    var lo=parseFloat(parts[0])||0, hi=parseFloat(parts[1])||lo;
    totalCostLow+=lo; totalCostHigh+=hi;
  });
  var weekCostStr=totalCostHigh>0?(totalCostLow===totalCostHigh?'~$'+totalCostLow.toFixed(0):'~$'+totalCostLow.toFixed(0)+'–$'+totalCostHigh.toFixed(0)):'';

  // Summary bar
  var ratingCount=Object.keys(state.mealRatings||{}).length;
  var flyerCount=(state.flyers||[]).filter(function(f){var vt=f.validTo?new Date(f.validTo):null;return !vt||vt>=new Date();}).length;
  var summaryHtml='<div class="meal-week-summary">'
    +'<div class="meal-summary-chip">&#x1F4C5; 7 Days</div>'
    +(weekCostStr?'<div class="meal-summary-chip">&#x1F4B0; Est. '+weekCostStr+' this week</div>':'')
    +(pantryCount>0?'<div class="meal-summary-chip">&#x2705; '+pantryCount+' pantry items</div>':'')
    +(flyerCount>0?'<div class="meal-summary-chip">&#x1F6D2; '+flyerCount+' flyer'+(flyerCount>1?'s':'')+'</div>':'')
    +(ratingCount>0?'<div class="meal-summary-chip">&#x2B50; '+ratingCount+' rated</div>':'')
    +(state.members||[]).map(function(mb){return '<div class="meal-summary-chip"><span style="width:10px;height:10px;border-radius:50%;background:'+(mb.color||'var(--accent)')+';display:inline-block;margin-right:3px"></span>'+mb.name+'</div>';}).join('')
    +'<button class="btn btn-ghost btn-sm" onclick="openModal(\'diet-prefs-modal\')" style="font-size:11px;padding:3px 10px">&#x2699;&#xFE0F; Prefs</button>'
    +'</div>';

  // Helper: render mini star row for any slot
  function slotStars(day, mealKey) {
    var rating = (state.mealRatings||{})[day+'__'+mealKey] || 0;
    var s = '<div class="meal-slot-stars">';
    for(var i=1;i<=5;i++){
      s += '<span onclick="rateMeal(\''+day+'\','+i+',\''+mealKey+'\')" title="'+i+' star'+(i>1?'s':'')+'" style="color:'+(i<=rating?'#f59e0b':'#d1d5db')+'">&#9733;</span>';
    }
    return s+'</div>';
  }

  // Helper: lock button for any slot
  function slotLock(day, mealKey) {
    var k = mealKey ? day+'__'+mealKey : day;
    var locked = !!(state.lockedMeals&&state.lockedMeals[k]);
    return '<button class="meal-slot-lock" onclick="toggleMealLock(\''+day+'\',\''+mealKey+'\')" title="'+(locked?'Unlock — allow regeneration':'Lock — keep on regenerate')+'">'+(locked?'&#x1F512;':'&#x1F513;')+'</button>';
  }

  // Helper: Made It button or Made badge
  function madeBtn(day, mealKey, size) {
    var cooked = !!(state.cookedMeals&&state.cookedMeals[day+'_'+mealKey]);
    var sm = size==='sm';
    if(cooked) return '<button class="btn btn-sm" style="background:var(--green-light);color:var(--green);font-weight:700;border:1.5px solid var(--green);cursor:default;font-size:10px">&#x2705; Made</button>';
    return '<button onclick="cookMeal(\''+day+'\',\''+mealKey+'\')" class="btn btn-sm" style="font-size:10px;background:var(--green-light);color:var(--green);border:1px solid var(--green);border-radius:6px;padding:2px 8px;cursor:pointer">&#x1F373; Made It</button>';
  }

  var listHtml='<div class="meal-plan-list">';
  var dayEmojis={Monday:'🌙',Tuesday:'🌙',Wednesday:'🌙',Thursday:'🌙',Friday:'🎉',Saturday:'☀️',Sunday:'☀️'};

  days.forEach(function(day,idx){
    var m=state.mealPlan[day];
    var cost=m.estimatedCost||m.cost||'';
    var isWeekend=(day==='Saturday'||day==='Sunday');
    var emoji=dayEmojis[day]||'📅';
    var mems=state.members&&state.members.length?state.members:[{name:'Member1'},{name:'Member2'}];

    function getKey(memberName,meal){
      var k=memberName.charAt(0).toLowerCase()+memberName.slice(1);
      var mealCap=meal.charAt(0).toUpperCase()+meal.slice(1);
      // Try name-based key first (mattBreakfast), then positional fallbacks (mem1Breakfast), then bare meal key
      var idx=mems.findIndex(function(mb){return mb.name===memberName;});
      var posKey='mem'+(idx+1)+mealCap;
      return m[k+mealCap]||m[posKey]||m[meal]||'';
    }

    var mem1Name=mems[0].name, mem1Color=mems[0].color||'var(--accent)';
    var mem2Name=mems[1]?mems[1].name:null, mem2Color=mems[1]?(mems[1].color||'var(--pink)'):'var(--pink)';

    var mem1Breakfast=getKey(mems[0].name,'breakfast');
    var mem2Breakfast=mem2Name?getKey(mems[1].name,'breakfast'):'';
    // Derive schedule context for this day's rendering
    var mk1r=mems[0].name.charAt(0).toLowerCase()+mems[0].name.slice(1);
    var mk2r=mem2Name?(mem2Name.charAt(0).toLowerCase()+mem2Name.slice(1)):'';
    var sched1=(window._richSchedule&&window._richSchedule[day]&&window._richSchedule[day][mk1r])||{};
    var sched2=(window._richSchedule&&window._richSchedule[day]&&mk2r&&window._richSchedule[day][mk2r])||{};
    var mem2BreakfastIsAway=sched2.atBreakfast||(mem2Breakfast.toLowerCase().includes('at work')||mem2Breakfast===''||mem2Breakfast.toLowerCase().includes('n/a'));
    var mem1Lunch=getKey(mems[0].name,'lunch');
    var mem2Lunch=mem2Name?getKey(mems[1].name,'lunch'):'';
    var mem1LunchNote=sched1.atLunch?'🎒 Packed for work':(!isWeekend&&sched1.working===false?'🏠 Day off':'');
    var mem2LunchNote=sched2.atLunch?'🎒 Packed for work':(sched2.working===false&&!isWeekend?'🏠 Day off':(!isWeekend&&mem2Lunch?'🏠 At home':''));
    var dinner=m.dinner||'';
    var note=m.note||'';

    // Key aliases matching cookMeal's mealType keys
    var mk1B = mems[0].name.charAt(0).toLowerCase()+mems[0].name.slice(1)+'Breakfast'; // e.g. mem1Breakfast
    var mk1L = mems[0].name.charAt(0).toLowerCase()+mems[0].name.slice(1)+'Lunch';
    var mk2B = mem2Name?(mem2Name.charAt(0).toLowerCase()+mem2Name.slice(1)+'Breakfast'):'';
    var mk2L = mem2Name?(mem2Name.charAt(0).toLowerCase()+mem2Name.slice(1)+'Lunch'):'';

    // Compute display date for this day
    var dayDateStr='';
    var _dateMap=state.mealPlanDates||window._mealPlanDates||{};
    if(_dateMap[day]){
      var _dt=new Date(_dateMap[day]);
      dayDateStr=_dt.toLocaleDateString('en-CA',{month:'short',day:'numeric'});
    }

    listHtml+='<div class="meal-day-row" id="mdr-'+idx+'">'

      // Header
      +'<div class="meal-day-row-header" onclick="toggleMealDay('+idx+')">'
        +'<div class="meal-day-row-title">'+emoji+' '+day+(dayDateStr?'<span style="font-size:11px;font-weight:400;opacity:0.85;margin-left:8px">'+dayDateStr+'</span>':'')+'</div>'
        +'<div class="meal-day-row-meta">'
          +(cost?'<div class="meal-day-cost-pill">'+cost+'</div>':'')
          +'<div class="meal-day-chevron">▼</div>'
        +'</div>'
      +'</div>'

      // 3-column body
      +'<div class="meal-day-body-grid">'

        // ── BREAKFAST ──────────────────────────────────
        +'<div class="meal-slot-block">'
          +'<div class="meal-slot-header">'
            +'<div class="meal-slot-label" style="margin:0"><span class="meal-slot-label-icon">&#x1F305;</span>Breakfast</div>'
          +'</div>'
          +(mem1Breakfast
            ?'<div class="meal-entry-person" style="background:'+mem1Color+'15;border-color:'+mem1Color+'55;display:flex;align-items:flex-start;gap:8px">'
              +'<div style="flex:1"><div class="meal-entry-person-who" style="color:'+mem1Color+'">'+mem1Name+'</div><div class="meal-entry-person-name">'+mem1Breakfast+'</div></div>'
              +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">'+slotLock(day,mk1B)+madeBtn(day,mk1B)+slotStars(day,mk1B)+'</div>'
            +'</div>'
            :'')
          +(mem2Name?(mem2BreakfastIsAway
            ?'<div class="meal-entry-person" style="background:'+mem2Color+'15;border-color:'+mem2Color+'55"><div class="meal-entry-person-who" style="color:'+mem2Color+'">'+mem2Name+'</div><div class="meal-entry-person-name" style="color:var(--muted);font-style:italic">&#x1F3EA; At work</div></div>'
            :(mem2Breakfast
              ?'<div class="meal-entry-person" style="background:'+mem2Color+'15;border-color:'+mem2Color+'55;display:flex;align-items:flex-start;gap:8px">'
                +'<div style="flex:1"><div class="meal-entry-person-who" style="color:'+mem2Color+'">'+mem2Name+'</div><div class="meal-entry-person-name">'+mem2Breakfast+'</div></div>'
                +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">'+slotLock(day,mk2B)+madeBtn(day,mk2B)+slotStars(day,mk2B)+'</div>'
              +'</div>'
              :''))
            :'')
        +'</div>'

        // ── LUNCH ──────────────────────────────────────
        +'<div class="meal-slot-block">'
          +'<div class="meal-slot-header">'
            +'<div class="meal-slot-label" style="margin:0"><span class="meal-slot-label-icon">☀️</span>Lunch</div>'
          +'</div>'
          +(mem1Lunch
            ?'<div class="meal-entry-person" style="background:'+mem1Color+'15;border-color:'+mem1Color+'55;display:flex;align-items:flex-start;gap:8px">'
              +'<div style="flex:1"><div class="meal-entry-person-who" style="color:'+mem1Color+'">'+mem1Name+'</div><div class="meal-entry-person-name">'+mem1Lunch+'</div>'+(mem1LunchNote?'<div class="meal-entry-person-note">'+mem1LunchNote+'</div>':'')+'</div>'
              +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">'+slotLock(day,mk1L)+madeBtn(day,mk1L)+slotStars(day,mk1L)+'</div>'
            +'</div>'
            :'')
          +(mem2Name&&mem2Lunch
            ?'<div class="meal-entry-person" style="background:'+mem2Color+'15;border-color:'+mem2Color+'55;display:flex;align-items:flex-start;gap:8px">'
              +'<div style="flex:1"><div class="meal-entry-person-who" style="color:'+mem2Color+'">'+mem2Name+'</div><div class="meal-entry-person-name">'+mem2Lunch+'</div>'+(mem2LunchNote?'<div class="meal-entry-person-note">'+mem2LunchNote+'</div>':'')+'</div>'
              +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">'+slotLock(day,mk2L)+madeBtn(day,mk2L)+slotStars(day,mk2L)+'</div>'
            +'</div>'
            :'')
        +'</div>'

        // ── DINNER ─────────────────────────────────────
        +'<div class="meal-slot-block">'
          +'<div class="meal-slot-header">'
            +'<div class="meal-slot-label" style="margin:0"><span class="meal-slot-label-icon">&#x1F37D;&#xFE0F;</span>Dinner <span style="font-size:9px;color:var(--accent);font-weight:700;margin-left:4px">TOGETHER</span></div>'
          +'</div>'
          +(dinner
            ?'<div class="meal-entry-shared" style="display:flex;align-items:flex-start;gap:8px">'
              +'<div style="flex:1">'
                +'<div class="meal-entry-shared-name">'+dinner
                  +(m.dinnerTag&&m.dinnerTag!=='normal'?'<span style="font-size:9px;margin-left:6px;padding:2px 7px;border-radius:10px;font-weight:700;background:'
                    +(m.dinnerTag==='quick'?'#d1fae5;color:#065f46'
                    :m.dinnerTag==='slow-cooker'?'#fef3c7;color:#92400e'
                    :m.dinnerTag==='make-ahead'?'#ede9fe;color:#5b21b6'
                    :'#dbeafe;color:#1e40af')
                    +'">'+(m.dinnerTag==='quick'?'&#9889; Quick':m.dinnerTag==='slow-cooker'?'&#x1F958; Slow Cooker':m.dinnerTag==='make-ahead'?'&#x1F550; Make-Ahead':'&#x2728; Special')+'</span>':'')
                +'</div>'
                +'<div class="meal-entry-shared-sub">'+(state.members||[]).map(function(mb){return mb.name;}).join(' &amp; ')+'</div>'
                +(dinner?'<div style="margin-top:6px"><button onclick="viewRecipe(\''+day+'\')" class="btn btn-ghost btn-sm">📖 Recipe</button></div>':'')
              +'</div>'
              +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">'+slotLock(day,'dinner')+madeBtn(day,'dinner')+slotStars(day,'dinner')+'</div>'
            +'</div>'
            :'<div style="color:var(--muted);font-style:italic;font-size:12px">—</div>')
        +'</div>'
      +'</div>' // end body-grid

      // -- INGREDIENTS NEEDED TODAY --
      +(function(){
        var items=m.toBuy||[];
        var subtotal=0,hasPrice=false;
        items.forEach(function(it){
          if(it.price&&!isNaN(parseFloat(it.price))){subtotal+=parseFloat(it.price);hasPrice=true;}
        });
        var foodIcons={chicken:'🍗',beef:'🥩',pork:'🥓',fish:'🐟',salmon:'🐟',shrimp:'🍤',
          egg:'🥚',eggs:'🥚',milk:'🥛',butter:'🧈',cheese:'🧀',bread:'🍞',rice:'🍚',
          pasta:'🍝',noodle:'🍜',potato:'🥔',onion:'🧅',garlic:'🧄',tomato:'🍅',
          pepper:'🫑',spinach:'🥬',lettuce:'🥗',carrot:'🥕',broccoli:'🥦',mushroom:'🍄',
          lemon:'🍋',lime:'🍋',apple:'🍎',banana:'🍌',berries:'🫐',yogurt:'🥛',
          cream:'🧴',flour:'🌾',sugar:'🍬',oil:'🫙',sauce:'🧴',stock:'🍵',broth:'🍵',
          can:'🥫',tin:'🥫',beans:'🫘',lentils:'🫘',soup:'🍲',coffee:'☕',tea:'🍵',juice:'🧃'};
        function getIcon(name){
          var lc=(name||'').toLowerCase();
          for(var k in foodIcons){if(lc.includes(k))return foodIcons[k];}
          return '🛒';
        }
        var subtotalStr=hasPrice?'~$'+subtotal.toFixed(2)+' CAD':'';
        var chipsHtml=items.map(function(it){
          var priceStr=(it.price&&!isNaN(parseFloat(it.price)))?'$'+parseFloat(it.price).toFixed(2):null;
          return '<div class="meal-ingredient-chip">'
            +'<span class="meal-ingredient-chip-icon">'+getIcon(it.item)+'</span>'
            +'<span class="meal-ingredient-chip-name">'+it.item+'</span>'
            +(it.qty?'<span class="meal-ingredient-chip-qty"> ('+it.qty+')</span>':'')
            +(priceStr?'<span class="meal-ingredient-chip-price"> '+priceStr+'</span>':'<span class="meal-ingredient-chip-price unknown"> check store</span>')
            +(it.store&&it.store!=='Any'&&it.store!=='any'?'<span class="meal-ingredient-chip-store">'+it.store+'</span>':'')
          +'</div>';
        }).join('');
        return '<div class="meal-ingredients-section ing-collapsed" id="mdi-'+idx+'">'
          +'<div class="meal-ingredients-header" onclick="toggleMealIngredients('+idx+')">'
            +'<div class="meal-ingredients-title">🛒 Ingredients to Buy ('+items.length+')'
              +' <span class="meal-ingredients-toggle">▼</span></div>'
            +(subtotalStr?'<div class="meal-ingredients-subtotal">'+subtotalStr+'</div>'
              :items.length?''
              :'<span style="font-size:11px;color:var(--green);font-weight:700">✅ All in pantry</span>')
          +'</div>'
          +(items.length
            ?'<div class="meal-ingredients-grid">'+chipsHtml+'</div>'
              +'<div class="meal-ingredients-actions">'
                +'<button class="btn btn-ghost btn-sm" style="font-size:10px"'
                  +' onclick="addDayIngredientsToList(\''+day+'\',event)">➕ Add All to Shopping List</button>'
              +'</div>'
            :'')
        +'</div>';
      }())


      // Footer — note + view list only (ratings now live in slots)
      +'<div class="meal-day-footer">'
        +(note?'<div class="meal-note-tag">&#x1F6D2; '+note+'</div>':'<div style="flex:1"></div>')
        +'<div class="meal-footer-actions">'
          +'<button class="btn btn-ghost btn-sm" onclick="switchGroceryTab(\'list\',document.getElementById(\'tab-list\'))">View List &#x2192;</button>'
        +'</div>'
      +'</div>'

    +'</div>'; // end meal-day-row
  });
  listHtml+='</div>';
  document.getElementById('meal-plan-grid').innerHTML = summaryHtml + listHtml;
}

function toggleMealDay(idx){
  var row=document.getElementById('mdr-'+idx);
  if(!row)return;
  row.classList.toggle('collapsed');
}
function toggleMealIngredients(idx){
  var sec=document.getElementById('mdi-'+idx);
  if(!sec)return;
  sec.classList.toggle('ing-collapsed');
}
function addDayIngredientsToList(day,e){
  if(e)e.stopPropagation();
  var m=state.mealPlan&&state.mealPlan[day];
  if(!m||!m.toBuy||!m.toBuy.length){hhToast('No ingredients to add for '+day,'info');return;}
  if(!state.shoppingList)state.shoppingList=[];
  var added=0;
  m.toBuy.forEach(function(it){
    var label=(it.qty?it.qty+' ':'')+it.item+(it.store&&it.store!=='Any'?' ('+it.store+')':'');
    var exists=state.shoppingList.some(function(s){return s.name&&s.name.toLowerCase()===it.item.toLowerCase();});
    if(!exists){
      state.shoppingList.push({id:Date.now()+Math.random(),name:label,checked:false,price:it.price||null,category:'groceries',source:'meal-plan',day:day});
      added++;
    }
  });
  saveState();
  hhToast(added>0?added+' item'+(added>1?'s':'')+' added to shopping list \u2705':'All items already on the list \ud83d\udc4d','success');
}
function toggleMealLock(day,mealKey){
  if(!state.lockedMeals)state.lockedMeals={};
  var k = mealKey ? day+'__'+mealKey : day; // backward compat: dinner uses day only
  state.lockedMeals[k]=!state.lockedMeals[k];
  saveState();renderMealPlanGrid();
}

function viewRecipe(day){
  const m=state.mealPlan&&state.mealPlan[day];
  if(!m)return;
  const recipe=m.recipe||null;
  document.getElementById('recipe-modal-title').textContent=(m.dinner||day+' Dinner')+' — Recipe';
  if(recipe){
    const ingHtml=(recipe.ingredients||[]).map(function(ing){
      return '<li>'+ing+'</li>';
    }).join('');
    const stepHtml=(recipe.steps||[]).map(function(s,i){
      return '<li style="margin-bottom:6px">'+s+'</li>';
    }).join('');
    document.getElementById('recipe-modal-body').innerHTML=
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px">'
      +(recipe.prepTime?'<span style="background:var(--surface);padding:4px 10px;border-radius:8px;font-size:12px">&#9200; Prep: <strong>'+recipe.prepTime+'</strong></span>':'')
      +(recipe.cookTime?'<span style="background:var(--surface);padding:4px 10px;border-radius:8px;font-size:12px">&#128293; Cook: <strong>'+recipe.cookTime+'</strong></span>':'')
      +(recipe.servings?'<span style="background:var(--surface);padding:4px 10px;border-radius:8px;font-size:12px">&#127869; Serves: <strong>'+recipe.servings+'</strong></span>':'')
      +(m.estimatedCost||m.cost?'<span style="background:var(--green-light);color:var(--green);padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700">~'+(m.estimatedCost||m.cost)+'</span>':'')
      +'</div>'
      +'<div style="font-weight:700;margin-bottom:6px;color:var(--accent)">Ingredients</div>'
      +'<ul style="padding-left:18px;margin-bottom:14px">'+ingHtml+'</ul>'
      +'<div style="font-weight:700;margin-bottom:6px;color:var(--accent)">Instructions</div>'
      +'<ol style="padding-left:18px">'+stepHtml+'</ol>';
  } else {
    document.getElementById('recipe-modal-body').innerHTML='<div style="color:var(--muted);padding:20px;text-align:center">No detailed recipe available. Regenerate the meal plan to get full recipes!</div>';
  }
  document.getElementById('recipe-cook-btn').setAttribute('onclick','cookMeal(\''+day+'\',\'dinner\');closeModal(\'recipe-modal\')');
  openModal('recipe-modal');
}

function cookMeal(day,mealType){
  var m=state.mealPlan&&state.mealPlan[day]; if(!m)return;
  mealType=mealType||'dinner';
  var mealName=mealType==='dinner'?(m.dinner||day+' Dinner')
    :mealType==='mem1Breakfast'?(m.mem1Breakfast||'Breakfast')
    :mealType==='mem2Breakfast'?(m.mem2Breakfast||'Breakfast')
    :mealType==='mem1Lunch'?(m.mem1Lunch||'Lunch')
    :mealType==='mem2Lunch'?(m.mem2Lunch||'Lunch')
    :(m.dinner||day+' Dinner');
  var cookKey=day+'_'+mealType;
  hhConfirm('Mark "'+mealName+'" as made and deduct ingredients from pantry?','🍳','We Made It!').then(function(ok){
    if(!ok)return;
    var recipe=mealType==='dinner'?m.recipe:(m[mealType+'Recipe']||null);
    if(!state.cookedMeals)state.cookedMeals={};
    state.cookedMeals[cookKey]=new Date().toISOString().split('T')[0];
    if(!recipe||!recipe.ingredients||!recipe.ingredients.length){
      saveState();renderMealPlanGrid();
      hhAlert('Marked as made! Detailed recipes are for dinners \u2014 regenerate the plan for full breakfast/lunch recipes.','✅');
      return;
    }
    if(!state.pantry)state.pantry=[];
    var used=[],notInPantry=[];
    recipe.ingredients.forEach(function(ingLine){
      var name=ingLine
        .replace(/^\d+[\d\/\.\s]*(cup|tbsp|tsp|oz|lb|lbs|g|kg|ml|l|clove|cloves|can|cans|pkg|bunch|head|slice|slices|large|medium|small|whole|handful|pinch|dash)s?\s*/i,'')
        .replace(/^(a|an|some)\s+/i,'').replace(/\(.*?\)/g,'').replace(/,.*$/,'').trim().toLowerCase();
      if(!name||name.length<2)return;
      var idx=state.pantry.findIndex(function(p){
        var pn=p.name.toLowerCase();
        return pn===name||pn.includes(name)||(name.length>3&&name.includes(pn));
      });
      if(idx>=0){
        var itm=state.pantry[idx];
        if(itm.stock>1){itm.stock--;used.push(itm.name+' ('+itm.stock+' left)');}
        else{used.push(itm.name+' \u2014 last one used');state.pantry.splice(idx,1);}
      } else {notInPantry.push(ingLine.trim());}
    });
    saveState();renderPantry();renderMealPlanGrid();
    var msg='&#x1F373; '+mealName+' \u2014 Made!\n\n';
    if(used.length)msg+='\u2705 Used from pantry:\n  '+used.join('\n  ');
    if(notInPantry.length)msg+='\n\n&#x1F4DD; Not tracked (bought fresh):\n  '+notInPantry.join('\n  ');
    hhAlert(msg,'\u2705');
  });
}

// NON-FOOD ITEM DETECTION
var DEFAULT_NONFOOD_KEYWORDS=[
  {kw:'toilet paper',section:'Household'},{kw:'paper towel',section:'Household'},{kw:'paper towels',section:'Household'},
  {kw:'garbage bag',section:'Household'},{kw:'garbage bags',section:'Household'},{kw:'trash bag',section:'Household'},
  {kw:'dish soap',section:'Household'},{kw:'laundry',section:'Household'},{kw:'cleaning spray',section:'Household'},
  {kw:'bleach',section:'Household'},{kw:'sponge',section:'Household'},{kw:'aluminum foil',section:'Household'},
  {kw:'plastic wrap',section:'Household'},{kw:'zip lock',section:'Household'},{kw:'ziploc',section:'Household'},
  {kw:'fabric softener',section:'Household'},{kw:'dryer sheet',section:'Household'},{kw:'dryer sheets',section:'Household'},
  {kw:'paper plates',section:'Household'},{kw:'paper cups',section:'Household'},{kw:'napkins',section:'Household'},
  {kw:'shampoo',section:'Bathroom'},{kw:'conditioner',section:'Bathroom'},{kw:'toothpaste',section:'Bathroom'},
  {kw:'toothbrush',section:'Bathroom'},{kw:'deodorant',section:'Bathroom'},{kw:'hand soap',section:'Bathroom'},
  {kw:'body wash',section:'Bathroom'},{kw:'razor',section:'Bathroom'},{kw:'razors',section:'Bathroom'},
  {kw:'dental floss',section:'Bathroom'},{kw:'mouthwash',section:'Bathroom'},{kw:'cotton',section:'Bathroom'},
  {kw:'tissues',section:'Bathroom'},{kw:'face wash',section:'Bathroom'},{kw:'moisturizer',section:'Bathroom'},
  {kw:'dog food',section:'Pet'},{kw:'cat food',section:'Pet'},{kw:'cat litter',section:'Pet'},
  {kw:'pet treat',section:'Pet'},{kw:'dog treat',section:'Pet'},{kw:'cat treat',section:'Pet'},
  {kw:'pet food',section:'Pet'},{kw:'bird seed',section:'Pet'},{kw:'dog bed',section:'Pet'},
  {kw:'flea',section:'Pet'},{kw:'paw',section:'Pet'},{kw:'puppy',section:'Pet'},{kw:'kitten',section:'Pet'}
];
function getNonFoodKeywords(){return (state.nonFoodKeywords&&state.nonFoodKeywords.length)?state.nonFoodKeywords:DEFAULT_NONFOOD_KEYWORDS;}
function classifyNonFoodItem(name){
  var lower=name.toLowerCase();
  var kws=getNonFoodKeywords();
  for(var i=0;i<kws.length;i++){
    if(lower.indexOf(kws[i].kw)!==-1)return kws[i].section;
  }
  return null;
}
function detectNonFoodItems(items){
  // items: array of {name, price, store}
  var found=[];
  items.forEach(function(item){
    var section=classifyNonFoodItem(item.name||'');
    if(!section)return;
    var inPantry=(state.pantry||[]).some(function(p){return p.name.toLowerCase()===(item.name||'').toLowerCase();});
    if(inPantry)return;
    var onList=(state.shoppingList||[]).some(function(s){return s.name.toLowerCase()===(item.name||'').toLowerCase();});
    if(onList)return;
    found.push({name:item.name,price:item.price||null,store:item.store||'Any',section:section});
  });
  // Deduplicate by name
  var seen={};
  return found.filter(function(f){var k=f.name.toLowerCase();if(seen[k])return false;seen[k]=true;return true;});
}
function showNonFoodConfirm(items){
  if(!items||!items.length)return;
  var list=document.getElementById('nonfood-items-list');
  if(!list)return;
  var SECTION_ICONS={Groceries:'🛒',Household:'🏠',Bathroom:'🧴',Pet:'🐾',Other:'📦'};
  var SECTIONS=['Groceries','Household','Bathroom','Pet','Other'];
  list.innerHTML='';
  items.forEach(function(item,i){
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border:1.5px solid var(--border);border-radius:10px';
    var chk=document.createElement('input');
    chk.type='checkbox';
    chk.id='nf-chk-'+i;
    chk.style.cssText='width:17px;height:17px;accent-color:var(--accent);flex-shrink:0';
    row.appendChild(chk);
    var nameDiv=document.createElement('div');
    nameDiv.style.cssText='flex:1;font-size:13px;font-weight:700;color:var(--text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    nameDiv.title=String(item.name||'');
    nameDiv.textContent=String(item.name||'(unknown)');
    var priceNum=item.price?parseFloat(String(item.price).replace(/[^0-9.]/g,'')):NaN;
    if(!isNaN(priceNum)&&priceNum>0){
      var priceSpan=document.createElement('span');
      priceSpan.style.cssText='color:var(--green);font-weight:800;margin-left:6px';
      priceSpan.textContent='$'+priceNum.toFixed(2);
      nameDiv.appendChild(priceSpan);
    }
    row.appendChild(nameDiv);
    var sel=document.createElement('select');
    sel.id='nf-sec-'+i;
    sel.style.cssText='font-size:12px;border:1px solid var(--border);border-radius:6px;padding:3px 6px;background:var(--surface);color:var(--text);flex-shrink:0;max-width:140px';
    SECTIONS.forEach(function(s){
      var opt=document.createElement('option');
      opt.value=s;
      opt.textContent=(SECTION_ICONS[s]||'')+' '+s;
      if(s===item.section)opt.selected=true;
      sel.appendChild(opt);
    });
    row.appendChild(sel);
    list.appendChild(row);
  });
  window._nonFoodPending=items;
  openModal('nonfood-confirm-modal');
}
function nfToggleAll(checked){
  var items=window._nonFoodPending||[];
  items.forEach(function(_,i){var c=document.getElementById('nf-chk-'+i);if(c)c.checked=checked;});
}
function confirmAddNonFoodItems(){
  var items=window._nonFoodPending||[];
  var added=0;
  items.forEach(function(item,i){
    var chk=document.getElementById('nf-chk-'+i);
    var sec=document.getElementById('nf-sec-'+i);
    if(chk&&chk.checked){
      var section=sec?sec.value:'Household';
      state.shoppingList.push({id:uid(),name:item.name,qty:'',store:item.store||'Any',price:item.price||null,checked:false,section:section});
      added++;
    }
  });
  saveState();
  closeModal('nonfood-confirm-modal');
  if(added>0){renderShoppingList();hhToast(added+' non-food item'+(added>1?'s':'')+' added to shopping list ✅','success');}
  window._nonFoodPending=[];
}

function renderShoppingList(){
  const container=document.getElementById('shopping-list-container');if(!container)return;
  if(!state.shoppingList||!state.shoppingList.length){
    container.innerHTML='<div class="empty-state">No items yet. Generate a meal plan or add items manually!</div>';
    return;
  }
  const SECTION_ORDER=['Groceries','Household','Bathroom','Pet','Other'];
  const SECTION_ICONS={Groceries:'\u{1F6D2}',Household:'\u{1F3E0}',Bathroom:'\u{1F9F4}',Pet:'\u{1F43E}',Other:'\u{1F4E6}'};
  state.shoppingList.forEach(function(i){if(!i.section)i.section='Groceries';});
  var sorted=state.shoppingList.slice().sort(function(a,b){
    if(a.checked!==b.checked)return a.checked?1:-1;
    var sa=SECTION_ORDER.indexOf(a.section||'Groceries');var sb=SECTION_ORDER.indexOf(b.section||'Groceries');
    if(sa!==sb)return sa-sb;
    return (a.store||'Any').localeCompare(b.store||'Any');
  });
  const totalEst=state.shoppingList.reduce(function(s,i){return s+(parseFloat(i.price)||0);},0);
  const uncheckedTotal=state.shoppingList.filter(function(i){return !i.checked;}).reduce(function(s,i){return s+(parseFloat(i.price)||0);},0);
  const checkedCount=state.shoppingList.filter(function(i){return i.checked;}).length;
  const summaryHtml='<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">'
    +'<span style="font-weight:800;font-size:15px">&#x1F6D2; Est. Total: <span style="color:var(--green)">$'+totalEst.toFixed(2)+'</span></span>'
    +(uncheckedTotal<totalEst?'<span class="muted-sm">Remaining: <strong style="color:var(--accent)">$'+uncheckedTotal.toFixed(2)+'</strong></span>':'')
    +'<span style="font-size:12px;color:var(--muted);margin-left:auto">'+checkedCount+'/'+state.shoppingList.length+' checked</span>'
    +'</div>';
  const bySection={};
  sorted.forEach(function(item){var sec=item.section||'Groceries';if(!bySection[sec])bySection[sec]=[];bySection[sec].push(item);});
  const sectionHtml=SECTION_ORDER.filter(function(sec){return bySection[sec]&&bySection[sec].length;}).map(function(sec){
    var items=bySection[sec];
    var secTotal=items.reduce(function(s,i){return s+(parseFloat(i.price)||0);},0);
    var unchecked=items.filter(function(i){return !i.checked;}).length;
    var byStore={};
    items.forEach(function(item){var store=item.store||'Any';if(!byStore[store])byStore[store]=[];byStore[store].push(item);});
    var storeRows=Object.entries(byStore).map(function(kv){
      var store=kv[0];var sitems=kv[1];
      var storeSub=sitems.reduce(function(s,i){return s+(parseFloat(i.price)||0);},0);
      var storeHeader='<div style="display:flex;align-items:center;gap:8px;margin:10px 0 6px;padding:7px 12px;background:var(--surface);border:1.5px solid var(--border);border-radius:8px">'
        +'<span style="font-size:15px">&#128205;</span>'
        +'<span style="font-weight:800;font-size:13px;color:var(--text);flex:1">'+store+'</span>'
        +(storeSub>0?'<span style="font-size:12px;font-weight:700;color:var(--green)">$'+storeSub.toFixed(2)+'</span>':'')
        +'</div>';
      var itemRows=sitems.map(function(item){
        var isFlyer=item.fromMealPlan&&item.store&&item.store!=='Any';
        var inPantry=(state.pantry||[]).some(function(p){return p.name.toLowerCase()===item.name.toLowerCase();});
        var flyerBadge=isFlyer?'<span style="font-size:10px;background:var(--green-light);color:var(--green);border-radius:5px;padding:1px 6px;font-weight:600;white-space:nowrap">&#x1F3F7; On Sale</span>':'';
        var pantryNote=inPantry&&!item.checked?'<span style="font-size:10px;color:var(--accent);font-weight:600">&#10003; In pantry</span>':'';
        return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);'+(item.checked?'opacity:0.5;':'')+'">'
          +'<input type="checkbox" '+(item.checked?'checked':'')+' onchange="toggleListItem(\''+item.id+'\',this.checked)" style="width:18px;height:18px;cursor:pointer;accent-color:var(--accent);margin-top:2px;flex-shrink:0">'
          +'<div style="flex:1;min-width:0">'
            +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
              +'<span style="font-weight:700;font-size:13px;'+(item.checked?'text-decoration:line-through;color:var(--muted)':'')+'">'+(item.name||'')+'</span>'
              +flyerBadge+pantryNote
            +'</div>'
            +(item.qty?'<div style="font-size:11px;color:var(--muted);margin-top:1px">Qty: '+item.qty+'</div>':'')
          +'</div>'
          +'<div style="text-align:right;flex-shrink:0">'
            +(item.price?'<div style="color:var(--green);font-weight:800;font-size:13px">$'+parseFloat(item.price).toFixed(2)+'</div>':'<div style="color:var(--muted);font-size:11px">&mdash;</div>')
          +'</div>'
          +'<button onclick="removeListItem(\''+item.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:2px;flex-shrink:0" title="Remove">&#215;</button>'
          +'</div>';
      }).join('');
      return storeHeader+itemRows;
    }).join('');
    return '<div style="margin-bottom:22px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:6px;border-bottom:2.5px solid var(--accent)">'
        +'<div style="font-weight:900;color:var(--accent);font-size:14px;letter-spacing:0.5px">'+(SECTION_ICONS[sec]||'')+' '+sec.toUpperCase()+'</div>'
        +'<div class="muted-sm">'+unchecked+' remaining &middot; <strong style="color:var(--green)">$'+secTotal.toFixed(2)+'</strong></div>'
      +'</div>'
      +storeRows
      +'</div>';
  }).join('');
  container.innerHTML=summaryHtml+sectionHtml;
}
function toggleListItem(id,checked){
  const item=state.shoppingList.find(i=>i.id===id);
  if(!item)return;
  item.checked=checked;
  if(checked){
    if(!state.pantry)state.pantry=[];
    const cleanName=item.name.toLowerCase().trim();
    const exists=state.pantry.find(p=>p.name.toLowerCase()===cleanName);
    if(exists){exists.stock=(exists.stock||0)+1;}
    else{
      var pantrySection=item.section&&item.section!=='Groceries'
        ? item.section
        : (classifyNonFoodItem(item.name)||item.section||'Groceries');
      state.pantry.push({id:uid(),name:item.name,qty:item.qty||'',stock:1,
        section:pantrySection,
        price:item.price?'$'+parseFloat(item.price).toFixed(2):'',
        store:item.store||'',addedDate:new Date().toISOString().split('T')[0],
        fromFlyer:!!(item.fromMealPlan&&item.store&&item.store!=='Any')});
    }
  }
  saveState();renderShoppingList();renderPantry();renderFlyers();
}
function removeListItem(id){state.shoppingList=state.shoppingList.filter(i=>i.id!==id);saveState();renderShoppingList();}
function clearChecked(){state.shoppingList=state.shoppingList.filter(i=>!i.checked);saveState();renderShoppingList();}
function addListItem(){
  const name=document.getElementById('list-item-name').value.trim();if(!name)return;
  const price=parseFloat(document.getElementById('list-item-price').value)||0;
  const section=document.getElementById('list-item-section')?document.getElementById('list-item-section').value:'Groceries';
  state.shoppingList.push({id:uid(),name,qty:document.getElementById('list-item-qty').value,store:document.getElementById('list-item-store').value||'Any',price:price||null,checked:false,section:section});
  saveState();closeModal('add-list-item-modal');
  document.getElementById('list-item-name').value='';document.getElementById('list-item-qty').value='';document.getElementById('list-item-price').value='';
  if(document.getElementById('list-item-section'))document.getElementById('list-item-section').value='Groceries';
  renderShoppingList();
}

// UPLOAD (CSV + PDF)
