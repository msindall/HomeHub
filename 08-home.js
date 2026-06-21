/* ============================================================================
   08-home.js  —  V7 "Sims-style" isometric Home landing screen.
   Wrapped in an IIFE so its generic helpers (money, toast, hint, G, season…)
   never collide with the app's globals. Exposes only window.HHHome.
   Phase A: rooms/plants/sims launch the real pages via showPage(); easy live
   reads (members, pets, goals, net-worth snapshot) are bound now.
   ========================================================================== */
(function () {
  'use strict';

  var mq = window.matchMedia('(max-width:820px)');
  var built = false, started = false;
  function G(id) { return document.getElementById(id); }
  function hex2rgb(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function rgb2hex(a){return '#'+a.map(function(v){return ('0'+Math.max(0,Math.min(255,Math.round(v))).toString(16)).slice(-2);}).join('');}
  function lerpHex(a,b,t){var x=hex2rgb(a),y=hex2rgb(b);return rgb2hex(x.map(function(v,i){return v+(y[i]-v)*t;}));}
  function shade(hex,f){var c=hex2rgb(hex);return rgb2hex(c.map(function(v){return f>=0? v+(255-v)*f : v*(1+f);}));}
  function hexA(h,a){var c=hex2rgb(h);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}
  function money(n){return (n<0?'-$':'$')+Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0});}

  var PALETTE = ['#2f9bd8','#e0729a','#46c46a','#f0b541','#9b8fe0','#f0875d','#13b6a4','#7d93a3'];
  var FLOWERS = ['#bfe3f2','#ffc6da','#9fe7b0','#ffe39a','#d7c6f2','#ffd2bd','#b8efe8','#cdd9e2'];

  /* ===================== ISO ENGINE ===================== */
  var TW=58, TH=29, ZH=46;
  function prj(x,y,z){return [(x-y)*TW, (x+y)*TH - z*ZH];}
  function ptStr(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}
  var DRAW=[];
  function push(k,s){DRAW.push({k:k,s:s});}
  // Build 2: gentle idle wandering. Outer <g> carries an additive SMIL translate
  // that drifts the sprite slowly between a few nearby offsets; the inner
  // .hh-sim keeps its CSS bob. Per-seed pseudo-random so each sim differs.
  function wanderWrap(seed,inner){var r=Math.sin(seed*12.9898)*43758.5453;r=r-Math.floor(r);
    var dx1=(8+r*14),dy1=(4+r*5),dx2=-(6+(1-r)*12),dy2=(2+(1-r)*5),dur=(16+r*12),beg=(-r*10);
    return '<g><animateTransform attributeName="transform" type="translate" additive="sum" '
      +'values="0 0; '+dx1.toFixed(1)+' '+dy1.toFixed(1)+'; '+dx2.toFixed(1)+' '+dy2.toFixed(1)+'; 0 0" '
      +'keyTimes="0;0.35;0.7;1" dur="'+dur.toFixed(1)+'s" begin="'+beg.toFixed(1)+'s" repeatCount="indefinite" '
      +'calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>'+inner+'</g>';}
  function poly(points,fill,stroke){return '<polygon points="'+points.map(ptStr).join(' ')+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="0.7" stroke-linejoin="round"':'')+'/>';}
  function tile(x,y,base,grid){var p=[prj(x,y,0),prj(x+1,y,0),prj(x+1,y+1,0),prj(x,y+1,0)];push((x+y)-0.4, poly(p, base, grid?shade(base,-0.12):null));}
  function box(x,y,z,w,d,h,base,depthBias){
    var top=shade(base,0.16), left=shade(base,-0.04), right=shade(base,-0.22), edge=shade(base,-0.32);
    var T=[prj(x,y,z+h),prj(x+w,y,z+h),prj(x+w,y+d,z+h),prj(x,y+d,z+h)];
    var R=[prj(x+w,y,z),prj(x+w,y+d,z),prj(x+w,y+d,z+h),prj(x+w,y,z+h)];
    var F=[prj(x,y+d,z),prj(x+w,y+d,z),prj(x+w,y+d,z+h),prj(x,y+d,z+h)];
    push((x+w)+(y+d)+(z*0.02)+(depthBias||0), poly(R,right,edge)+poly(F,left,edge)+poly(T,top,edge));
  }
  function wall(orient,fixed,from,to,base,hgt){var H=hgt||1.7, th=0.16, x, y;
    if(orient==='h'){ for(x=from;x<to;x++) box(x,fixed,0,1,th,H,base,-0.05); }
    else { for(y=from;y<to;y++) box(fixed,y,0,th,1,H,base,-0.05); }}
  function label(x,y,emoji,text,col){var c=prj(x,y,0); var w=text.length*8+44;
    push(1000+(x+y), '<g pointer-events="none" transform="translate('+c[0]+','+(c[1]-4)+')">'
      +'<rect x="'+(-w/2)+'" y="-15" width="'+w+'" height="30" rx="15" fill="#ffffff" opacity="0.94"/>'
      +'<rect x="'+(-w/2)+'" y="-15" width="'+w+'" height="30" rx="15" fill="none" stroke="'+col+'" stroke-width="1.5" opacity="0.6"/>'
      +'<text x="'+(-w/2+18)+'" y="6" text-anchor="middle" font-size="17">'+emoji+'</text>'
      +'<text x="10" y="5" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="13.5" fill="#33414e">'+text+'</text></g>');}
  function petSprite(x,y,p){var b=prj(x+0.5,y+0.5,0), k=900+(x+y);
    var dog=/dog|pup|canine|hound/i.test(p.type||p.role||'');
    var body=dog?'#b07a4a':'#9aa0a8', ear=shade(body,-0.16), belly=shade(body,0.28);
    var fed=(p.fed!==false);
    var s='<g class="hh-sim">'
      +'<ellipse cx="'+b[0]+'" cy="'+(b[1]+3)+'" rx="15" ry="5.5" fill="#000" opacity="0.16"/>'
      +'<path d="M'+(b[0]+11)+','+(b[1]-6)+' q'+(dog?'11,-3 7,-13':'12,-10 2,-21')+'" stroke="'+body+'" stroke-width="5" fill="none" stroke-linecap="round"/>'
      +'<ellipse cx="'+b[0]+'" cy="'+(b[1]-8)+'" rx="13" ry="11" fill="'+body+'"/>'
      +'<ellipse cx="'+b[0]+'" cy="'+(b[1]-4)+'" rx="7.5" ry="6.5" fill="'+belly+'"/>'
      +'<rect x="'+(b[0]-8)+'" y="'+(b[1]-2)+'" width="5" height="9" rx="2.5" fill="'+ear+'"/><rect x="'+(b[0]+3)+'" y="'+(b[1]-2)+'" width="5" height="9" rx="2.5" fill="'+ear+'"/>'
      +'<circle cx="'+b[0]+'" cy="'+(b[1]-20)+'" r="9" fill="'+body+'"/>'
      +(dog
        ? '<path d="M'+(b[0]-9)+','+(b[1]-22)+' q-5,'+(fed?2:9)+' -1,9 q4,-3 5,-7Z" fill="'+ear+'"/><path d="M'+(b[0]+9)+','+(b[1]-22)+' q5,'+(fed?2:9)+' 1,9 q-4,-3 -5,-7Z" fill="'+ear+'"/>'
        : '<path d="M'+(b[0]-8)+','+(b[1]-25)+' l'+(fed?'-1,-7':'-3,-1')+' l6,4Z" fill="'+ear+'"/><path d="M'+(b[0]+8)+','+(b[1]-25)+' l'+(fed?'1,-7':'3,-1')+' l-6,4Z" fill="'+ear+'"/>')
      +'<circle cx="'+(b[0]-3.4)+'" cy="'+(b[1]-21)+'" r="1.4" fill="#2b2b2b"/><circle cx="'+(b[0]+3.4)+'" cy="'+(b[1]-21)+'" r="1.4" fill="#2b2b2b"/>'
      +'<circle cx="'+b[0]+'" cy="'+(b[1]-17.6)+'" r="1.6" fill="#d98a8a"/>'
      +(fed?'<path d="M'+(b[0]-3)+','+(b[1]-15)+' q3,3 6,0" stroke="#2b2b2b" stroke-width="1" fill="none"/>':'<line x1="'+(b[0]-2.5)+'" y1="'+(b[1]-14.5)+'" x2="'+(b[0]+2.5)+'" y2="'+(b[1]-14.5)+'" stroke="#2b2b2b" stroke-width="1"/>')
      +(fed?'':'<text x="'+(b[0]+11)+'" y="'+(b[1]-25)+'" font-size="11">🍽️</text>')
      +'<g transform="translate('+b[0]+','+(b[1]+12)+')"><rect x="-24" y="0" width="48" height="16" rx="8" fill="#fff" opacity="0.92"/><text x="0" y="11" text-anchor="middle" font-family="Nunito" font-weight="800" font-size="9.5" fill="#33414e">'+p.name+'</text></g>'
      +'</g>';
    push(k,wanderWrap(k,s));}
  function sim(x,y,p,plumbob){if(p&&p.kind==='pet'){return petSprite(x,y,p);}var col=p.color, name=p.name, b=prj(x+0.5,y+0.5,0), k=900+(x+y), sk='#f1c9a5';
    var s='<g class="hh-sim">'
      +'<ellipse cx="'+b[0]+'" cy="'+(b[1]+2)+'" rx="16" ry="6" fill="#000" opacity="0.16"/>'
      +(plumbob?'<g class="hh-housePlumb"><polygon points="'+(b[0]-7)+','+(b[1]-66)+' '+(b[0]+7)+','+(b[1]-66)+' '+b[0]+','+(b[1]-54)+'" fill="#2faa46"/><polygon points="'+(b[0]-7)+','+(b[1]-66)+' '+(b[0]+7)+','+(b[1]-66)+' '+b[0]+','+(b[1]-78)+'" fill="#46d160"/></g>':'')
      +'<path d="M'+(b[0]-10)+','+b[1]+' q-1,-22 10,-22 q11,0 10,22 Z" fill="'+col+'"/>'
      +'<rect x="'+(b[0]-9)+'" y="'+(b[1]-2)+'" width="7" height="12" rx="3" fill="'+shade(col,-0.18)+'"/><rect x="'+(b[0]+2)+'" y="'+(b[1]-2)+'" width="7" height="12" rx="3" fill="'+shade(col,-0.18)+'"/>'
      +'<circle cx="'+b[0]+'" cy="'+(b[1]-30)+'" r="9" fill="'+sk+'"/>'
      +'<path d="M'+(b[0]-9)+','+(b[1]-32)+' q9,-12 18,0 q-9,-6 -18,0Z" fill="#5b4636"/>'
      +'<g transform="translate('+b[0]+','+(b[1]+14)+')"><rect x="-26" y="0" width="52" height="17" rx="8" fill="#ffffff" opacity="0.92"/><text x="0" y="12" text-anchor="middle" font-family="Nunito" font-weight="800" font-size="10" fill="#33414e">'+name+'</text></g>'
      +'</g>';
    push(k, wanderWrap(k,s));}
  function plant(x,y,goal){var pct=goal.target?Math.min(goal.saved/goal.target,1):0, b=prj(x+0.5,y+0.5,0);
    var grow=0.5+pct*0.9, stemH=22+pct*46, bloom=pct>0.25, full=pct>=0.999, fl=goal.flower, cc=goal.color, petals='', a, rx, ry, i, ANG=[0,72,144,216,288];
    if(bloom){for(i=0;i<ANG.length;i++){a=ANG[i];rx=Math.cos(a*Math.PI/180)*11*grow;ry=Math.sin(a*Math.PI/180)*11*grow;petals+='<ellipse cx="'+(b[0]+rx)+'" cy="'+(b[1]-stemH+ry)+'" rx="'+(8*grow)+'" ry="'+(11*grow)+'" fill="'+fl+'"/>';}}
    var s='<g>'
      +'<ellipse cx="'+b[0]+'" cy="'+(b[1]+2)+'" rx="'+(16*grow)+'" ry="6" fill="#000" opacity="0.14"/>'
      +'<path d="M'+(b[0]-9)+','+(b[1]+4)+' L'+(b[0]+9)+','+(b[1]+4)+' L'+(b[0]+6)+','+(b[1]-8)+' L'+(b[0]-6)+','+(b[1]-8)+' Z" fill="#c98a5a"/>'
      +'<rect x="'+(b[0]-2.5)+'" y="'+(b[1]-stemH)+'" width="5" height="'+stemH+'" rx="2.5" fill="#4f9a44"/>'
      +'<ellipse cx="'+(b[0]-10*grow)+'" cy="'+(b[1]-stemH*0.6)+'" rx="'+(10*grow)+'" ry="5" fill="#5fae4f" transform="rotate(-25 '+b[0]+' '+(b[1]-stemH*0.6)+')"/>'
      +'<ellipse cx="'+(b[0]+10*grow)+'" cy="'+(b[1]-stemH*0.78)+'" rx="'+(10*grow)+'" ry="5" fill="#6cba5b" transform="rotate(25 '+b[0]+' '+(b[1]-stemH*0.78)+')"/>'
      +(bloom?petals+'<circle cx="'+b[0]+'" cy="'+(b[1]-stemH)+'" r="'+(8*grow)+'" fill="'+cc+'"/>'+(full?'<text x="'+b[0]+'" y="'+(b[1]-stemH+5)+'" text-anchor="middle" font-size="'+(13*grow)+'">✨</text>':''):'<circle cx="'+b[0]+'" cy="'+(b[1]-stemH)+'" r="'+(6*grow)+'" fill="#7cc063"/>')
      +'<g transform="translate('+b[0]+','+(b[1]+18)+')"><rect x="-26" y="0" width="52" height="22" rx="6" fill="#fff" stroke="'+cc+'" stroke-width="1.5"/>'
      +'<text x="0" y="11" text-anchor="middle" font-size="11">'+goal.emoji+'</text><text x="0" y="19" text-anchor="middle" font-family="Nunito" font-weight="800" font-size="8" fill="#6b7a88">'+Math.round(pct*100)+'%</text></g></g>';
    push(500+(x+y), s);}
  function treeAt(x,y){var t=prj(x,y,0), col=seasonTree();
    push((x+y)+0.65, '<g class="hh-sim" style="animation-duration:6s"><rect x="'+(t[0]-7)+'" y="'+(t[1]-50)+'" width="14" height="56" rx="6" fill="#8a5f3c"/>'
      +'<circle cx="'+t[0]+'" cy="'+(t[1]-60)+'" r="30" fill="'+col[0]+'"/><circle cx="'+(t[0]-22)+'" cy="'+(t[1]-44)+'" r="22" fill="'+col[1]+'"/><circle cx="'+(t[0]+22)+'" cy="'+(t[1]-44)+'" r="22" fill="'+col[2]+'"/></g>');}

  /* ===================== DATA (from real state with fallbacks) ===================== */
  var GOALS=[], PEOPLE={}, SIMS=[], activeSim=null;
  var ROOMS={
    office:{eye:'FINANCE',emoji:'💼',title:'The Study',color:'#2f9bd8',body:'Your desk, accounts and ledger. Open a finance module:',pages:[['transactions','📋 Transactions'],['budget','💰 Budget'],['networth','📈 Net worth'],['upload','📤 Upload statement']]},
    bedroom:{eye:'WEDDING PLAN',emoji:'💍',title:'The Bedroom',color:'#e0729a',body:'Wedding budget, vendors, guest list and countdown.',pages:[['wedding','💍 Wedding']]},
    sunroom:{eye:'RETIREMENT & TAX',emoji:'🌅',title:'The Sunroom',color:'#9b8fe0',body:'Long-range projections and Ontario tax prep.',pages:[['retirement','🌅 Retirement'],['tax','🧾 Tax prep']]},
    kitchen:{eye:'MEALS & GROCERIES',emoji:'🍲',title:'The Kitchen',color:'#f0b541',body:'Grocery list, pantry, flyers and the meal planner.',pages:[['grocery','🛒 Grocery & meals']]},
    living:{eye:'HOME & PETS',emoji:'🐾',title:'The Living Room',color:'#46c46a',body:'The heart of the home — pets, bills, upkeep and calendar.',pages:[['pets','🐾 Pets'],['bills','🧾 Bills'],['maintenance','🔧 Maintenance'],['calendar','📅 Calendar']]},
    garage:{eye:'CARS & CAREER',emoji:'🚗',title:'The Garage',color:'#7d93a3',body:'Vehicle funds, upkeep and your career planner.',pages:[['cars','🚗 Cars'],['career','💼 Career']]}
  };
  var NEEDS=[];            // computed each loadData() — {k,em,room,v,parts,unknown}
  var NOTIF=0, SAFE=null, SAFE_LIQUID=0, SAFE_BILLS=0, SAFE_GOALS=0;  // mailbox count + safe-to-spend ($) + its parts

  /* ---- needs-HUD sub-score helpers (all read live `state`, null = no data) ---- */
  function clamp01(x){return x<0?0:x>1?1:x;}
  function avgParts(parts){var d=parts.filter(function(p){return p.v!=null;});if(!d.length)return null;return d.reduce(function(a,p){return a+p.v;},0)/d.length;}
  function S(){return (typeof state==='object'&&state)?state:{};}
  function txnsInLastDays(n){var cut=Date.now()-n*86400000;return (S().transactions||[]).filter(function(t){var d=new Date(t.date);return !isNaN(d.getTime())&&d.getTime()>=cut;});}
  function liquidBalance(){var accts=S().accounts||[];if(!accts.length)return null;var sum=0;accts.forEach(function(a){var debt=(typeof ACCT_IS_DEBT==='object'&&ACCT_IS_DEBT)?ACCT_IS_DEBT[a.type]:false;if(!debt&&typeof getAccountBalance==='function'){var b=getAccountBalance(a.id);if(b!=null)sum+=Math.max(0,b);}});return sum;}
  function goalsScore(){var gs=(S().goals||[]).filter(function(g){return g.target>0;});if(!gs.length)return null;var ps=gs.map(function(g){var sv=(typeof goalSavedAmount==='function')?goalSavedAmount(g):((g.current||0)+(typeof getGoalContributions==='function'?getGoalContributions(g.id):0));return clamp01(sv/g.target);});return ps.reduce(function(a,b){return a+b;},0)/ps.length;}
  function cashflowScore(){var ts=txnsInLastDays(60);if(!ts.length)return null;var inc=0,exp=0;ts.forEach(function(t){if(t.amount>0)inc+=t.amount;else exp+=-t.amount;});if(inc<=0)return exp>0?0:null;return clamp01(0.5+((inc-exp)/inc)*2);}
  function savingsScore(){var liquid=liquidBalance();if(liquid==null)return null;var exp=0;txnsInLastDays(60).forEach(function(t){if(t.amount<0)exp+=-t.amount;});var monthly=exp/2;if(monthly<=0)return liquid>0?1:null;return clamp01((liquid/monthly)/6);}
  function pantryScore(){var p=S().pantry||[];if(!p.length)return null;var inStock=p.filter(function(x){return x.stock==null||x.stock>0;}).length;return inStock/p.length;}
  function billsOnTimeScore(){var bs=S().bills||[];if(!bs.length)return null;var t0=new Date();t0.setHours(0,0,0,0);var over=bs.filter(function(b){if(!b.nextDue)return false;return new Date(b.nextDue+'T00:00:00')<t0;}).length;return (bs.length-over)/bs.length;}
  function maintScore(){var ts=(S().maintenanceTasks||[]).filter(function(t){return t.intervalDays;});if(!ts.length)return null;var t0=new Date();t0.setHours(0,0,0,0);var over=ts.filter(function(t){var nd=(typeof getMaintenanceNextDue==='function')?getMaintenanceNextDue(t):null;return nd&&nd<t0;}).length;return (ts.length-over)/ts.length;}
  function petsScore(){var ps=S().pets||[];if(!ps.length)return null;var pf=S().petFeeding||{};var day=new Date().toISOString().split('T')[0];var fed=ps.filter(function(p){var r=pf[p.id];return r&&r.fed&&r.date===day;}).length;return fed/ps.length;}
  function weddingScore(){var w=S().wedding||{};if(!(w.budget>0))return null;var c=(typeof getWeddingContributions==='function')?getWeddingContributions():0;return clamp01(c/w.budget);}
  function houseScore(){var h=S().house||{};if(!(h.targetPrice>0))return null;var dp=h.targetPrice*0.2;var fhsa=h.fhsa?((h.fhsa.mattBalance||0)+(h.fhsa.hollyBalance||0)):0;return clamp01(((h.savedAmount||0)+fhsa)/dp);}
  function retirementScore(){try{if(typeof getRetInputs!=='function'||typeof _retCalcMember!=='function'||typeof getHHMembers!=='function')return null;var rd=getRetInputs();var ms=getHHMembers();if(!ms.some(function(m){var d=rd.members[m.id]||{};return d.age&&d.retireAge;}))return null;var gr=rd.growthRate||5;var act=ms.map(function(m,i){return _retCalcMember(m,rd,gr,i);}).filter(function(c){return c.d.age&&c.d.retireAge;});var hhMo=act.reduce(function(s,c){return s+c.totalMonthly;},0);var cur=act.reduce(function(s,c){return s+(c.effSalary||0);},0);if(cur<=0)return null;return clamp01((hhMo/(cur/12))/0.8);}catch(e){return null;}}

  function computeNeeds(){
    var defs=[
      {k:'Money',em:'💰',room:'office',parts:[{label:'Goals',v:goalsScore()},{label:'Cashflow',v:cashflowScore()},{label:'Savings',v:savingsScore()}]},
      {k:'Home', em:'🧹',room:'living',parts:[{label:'Pantry',v:pantryScore()},{label:'Bills on time',v:billsOnTimeScore()},{label:'Maintenance',v:maintScore()}]},
      {k:'Pets', em:'🐾',room:'living',parts:[{label:'Fed today',v:petsScore()}]},
      {k:'Plans',em:'🎯',room:'sunroom',parts:[{label:'Goals',v:goalsScore()},{label:'Wedding',v:weddingScore()},{label:'House',v:houseScore()},{label:'Retirement',v:retirementScore()}]}
    ];
    NEEDS=defs.map(function(d){var v=avgParts(d.parts);return {k:d.k,em:d.em,room:d.room,parts:d.parts,v:(v==null?0.7:v),unknown:(v==null)};})
      .filter(function(d){return !(d.k==='Pets'&&!(S().pets||[]).length);});
  }

  function fmtDays(days){return days<0?Math.abs(days)+'d overdue':days===0?'today':days===1?'tomorrow':'in '+days+'d';}
  function buildReminders(){
    var st=S(), out=[], DAY=86400000;
    var t0=new Date(); t0.setHours(0,0,0,0);
    (st.maintenanceTasks||[]).forEach(function(t){if(!t.intervalDays)return;var nd=(typeof getMaintenanceNextDue==='function')?getMaintenanceNextDue(t):null;if(!nd)return;var days=Math.ceil((nd-t0)/DAY);if(days>7)return;out.push({emoji:(t.emoji||'🔧'),text:(t.name||'Maintenance'),sub:fmtDays(days),days:days,urg:days<0?0:1,go:'maintenance'});});
    (st.bills||[]).forEach(function(b){if(!b.nextDue)return;var d=new Date(b.nextDue+'T00:00:00');var days=Math.ceil((d-t0)/DAY);if(days>7)return;out.push({emoji:'🧾',text:(b.name||'Bill'),sub:((typeof fmt==='function')?fmt(b.amount||0):'$'+(b.amount||0))+' · '+fmtDays(days),days:days,urg:days<0?0:1,go:'bills'});});
    (st.calEvents||[]).forEach(function(e){var ds=e.date||e.start;if(!ds)return;var d=new Date(ds);if(isNaN(d.getTime()))return;d.setHours(0,0,0,0);var days=Math.round((d-t0)/DAY);if(days<0||days>7)return;out.push({emoji:'📅',text:(e.title||e.summary||'Event'),sub:fmtDays(days),days:days,urg:days<=1?1:2,go:'calendar'});});
    (function(){var now=new Date(),yr=now.getFullYear(),mar1=new Date(yr,2,1);if(mar1<t0)mar1=new Date(yr+1,2,1);var days=Math.ceil((mar1-t0)/DAY);if(days<=60)out.push({emoji:'🍁',text:'RRSP contribution deadline',sub:'in '+days+'d ('+mar1.toLocaleDateString('en-CA',{month:'short',day:'numeric'})+')',days:days,urg:days<=14?0:2,go:'tax'});})();
    (function(){var now=new Date(),yr=now.getFullYear(),apr30=new Date(yr,3,30);if(apr30<t0)apr30=new Date(yr+1,3,30);var days=Math.ceil((apr30-t0)/DAY);if(days<=45)out.push({emoji:'🧮',text:'Tax filing deadline',sub:'in '+days+'d ('+apr30.toLocaleDateString('en-CA',{month:'short',day:'numeric'})+')',days:days,urg:days<=14?0:2,go:'tax'});})();
    out.sort(function(a,b){return (a.urg-b.urg)||(a.days-b.days);});
    return out;
  }
  function computeNotif(){ NOTIF = buildReminders().length; }

  function computeSafe(){
    var liquid=liquidBalance();
    if(liquid==null){SAFE=null;SAFE_LIQUID=0;SAFE_BILLS=0;SAFE_GOALS=0;return;}
    var bills=S().bills||[], soon=0, now=Date.now(), c30=now+30*86400000;
    bills.forEach(function(b){if(!b.nextDue)return;var d=new Date(b.nextDue+'T00:00:00').getTime();if(d>=now&&d<=c30)soon+=(b.amount||0);});
    // money already earmarked for goals (held in linked accounts) isn't free to spend
    var reserved=0;(S().goals||[]).forEach(function(g){if(g.accountId&&typeof goalSavedAmount==='function')reserved+=goalSavedAmount(g);});
    reserved=Math.min(reserved,liquid);
    SAFE_LIQUID=liquid; SAFE_BILLS=soon; SAFE_GOALS=reserved; SAFE=liquid-reserved-soon;
  }

  function loadData(){
    var st=(typeof state==='object'&&state)?state:{};
    // goals -> plants (cap 5) — saved reads the linked account balance (Phase B)
    GOALS=(st.goals||[]).slice(0,5).map(function(g,i){var sv=(typeof goalSavedAmount==='function')?goalSavedAmount(g):(+g.current||0);return {id:g.id||('g'+i),emoji:g.emoji||'🎯',name:g.name||'Goal',saved:sv,target:+g.target||0,date:g.date||'',color:PALETTE[i%PALETTE.length],flower:FLOWERS[i%FLOWERS.length]};});
    // members + pets -> sims/tray
    PEOPLE={}; SIMS=[];
    var positions=[{x:1.5,y:1.9},{x:4.5,y:2.0},{x:7.3,y:2.0},{x:1.6,y:4.6},{x:4.6,y:4.0},{x:7.4,y:4.6}];
    var pi=0;
    (st.members||[]).forEach(function(m,i){var id='m'+i;PEOPLE[id]={name:m.name||'Member',role:m.incomeType||m.role||'Household member',income:m.incomeType||'—',monthlyIncome:+m.monthlyIncome||0,hasTips:!!m.hasTips,color:m.color||PALETTE[i%PALETTE.length],emoji:m.emoji||(i%2?'👩':'👨'),kind:'member'};var pos=positions[pi++%positions.length];SIMS.push({id:id,x:pos.x,y:pos.y});});
    var _pf=st.petFeeding||{}, _day=new Date().toISOString().split('T')[0];
    (st.pets||[]).forEach(function(p,i){var id='p'+i;var fr=_pf[p.id];var fed=!!(fr&&fr.fed&&fr.date===_day);PEOPLE[id]={name:p.name||'Pet',role:(p.type||'pet'),type:(p.type||'pet'),fed:fed,income:'—',color:'#6b5a48',emoji:p.emoji||'🐾',kind:'pet'};var pos=positions[pi++%positions.length];SIMS.push({id:id,x:pos.x,y:pos.y});});
    if(!SIMS.length){PEOPLE['demo']={name:(st.household&&st.household.name)||'You',role:'Household',income:'—',color:'#3f7fae',emoji:'🏠',kind:'member'};SIMS.push({id:'demo',x:1.4,y:2.2});}
    activeSim=SIMS[0].id;
    // net worth pill — live calc (accounts + manual assets + car funds), else snapshot, else accounts
    var nw=null;
    if(typeof calcCurrentNetWorth==='function'){try{var snap=calcCurrentNetWorth();if(snap&&snap.netWorth!=null)nw=snap.netWorth;}catch(e){}}
    if(nw==null){var hist=st.netWorthHistory||[];if(hist.length){var last=hist[hist.length-1];nw=(typeof last==='object')?(last.value!=null?last.value:last.netWorth):last;}}
    if(nw==null&&(st.accounts||[]).length){nw=st.accounts.reduce(function(a,x){return a+(+x.balance||0);},0);}
    var nwEl=G('hhNw'); if(nwEl) nwEl.textContent= nw!=null? money(nw) : '—';
    // brand household name
    var bn=G('hhBrandSub'); if(bn&&st.household&&st.household.name) bn.textContent=st.household.name+' · '+((st.household.province)||'ON');
    // income split — each member's share of household monthly income
    var totalInc=0; for(var k in PEOPLE){ if(PEOPLE[k].kind==='member') totalInc+=PEOPLE[k].monthlyIncome||0; }
    for(var k2 in PEOPLE){ if(PEOPLE[k2].kind==='member') PEOPLE[k2].incShare = totalInc>0 ? (PEOPLE[k2].monthlyIncome/totalInc) : null; }
    // derived figures: needs HUD, mailbox count, safe-to-spend
    computeNeeds(); computeNotif(); computeSafe();
    var safeEl=G('hhSafe'); if(safeEl) safeEl.textContent = (SAFE!=null ? money(SAFE) : '—');
  }

  /* ===================== BUILD THE LOT ===================== */
  var FLOOR={office:'#b88c5a',bedroom:'#d8a7c4',sunroom:'#cfe3b0',kitchen:'#dcc9a6',living:'#a9c8e0',garage:'#bcc3ca'};
  var RECT={office:[0,0,3,3],bedroom:[3,0,6,3],sunroom:[6,0,9,3],kitchen:[0,3,3,6],living:[3,3,6,6],garage:[6,3,9,6]};
  function buildLot(){
    DRAW.length=0;
    var g=seasonGrass(), grassA=g[0], grassB=g[1], x, y, id, r;
    for(x=-2;x<11;x++)for(y=-2;y<9;y++){ if(x>=0&&x<9&&y>=0&&y<6) continue; tile(x,y, ((x+y)&1)?grassA:grassB, false); }
    for(id in RECT){r=RECT[id];for(x=r[0];x<r[2];x++)for(y=r[1];y<r[3];y++)tile(x,y,FLOOR[id],true);}
    wall('h',0,0,9,'#e7d3b0'); wall('v',0,0,6,'#e0cba6');
    wall('v',3,0,6,'#ead9bb',1.0); wall('v',6,0,6,'#ead9bb',1.0); wall('h',3,0,9,'#ecdcc0',0.55);
    // furniture
    box(0.4,0.5,0,1.7,0.7,0.7,'#8a5a32'); box(1.1,0.6,0.7,0.5,0.4,0.4,'#2f3b46'); box(0.5,1.5,0,0.6,0.6,0.5,'#3f7fae');
    box(3.5,0.6,0,1.5,2.0,0.45,'#c98ab0'); box(3.5,0.6,0.45,1.5,0.7,0.25,'#ffffff'); box(5.2,0.6,0,0.5,0.5,0.5,'#9b6f8f');
    box(6.5,1.4,0,0.8,0.8,0.6,'#caa6e0'); box(7.7,0.6,0,0.45,0.45,0.42,'#a9742f');
    var pp=prj(7.92,0.82,0.95); push((7.7)+(0.6)+0.4, '<circle cx="'+pp[0]+'" cy="'+pp[1]+'" r="13" fill="#6cba5b"/><circle cx="'+(pp[0]-8)+'" cy="'+(pp[1]+4)+'" r="9" fill="#7cc863"/>');
    box(0.3,3.4,0,2.3,0.7,0.85,'#e8e2d6'); box(0.4,3.5,0.85,0.5,0.5,0.12,'#5b6b78'); box(0.3,5.0,0,0.8,0.8,1.5,'#cfd6db'); box(1.5,5.0,0,0.8,0.8,0.85,'#b9c0c6');
    box(3.4,3.5,0,2.0,0.8,0.6,'#6fae8a'); box(3.6,3.5,0.6,2.0,0.3,0.25,'#5c9a78'); box(4.0,4.5,0,1.0,0.6,0.3,'#a9742f'); box(3.4,5.4,0,1.8,0.18,1.0,'#2f3b46');
    box(6.6,3.6,0,1.7,0.95,0.55,'#d65a5a'); box(7.0,3.7,0.55,0.9,0.75,0.4,'#e88a8a');
    box(6.75,3.55,0,0.3,0.3,0.18,'#2b2b2b'); box(7.95,3.55,0,0.3,0.3,0.18,'#2b2b2b'); box(6.75,4.35,0,0.3,0.3,0.18,'#2b2b2b'); box(7.95,4.35,0,0.3,0.3,0.18,'#2b2b2b');
    // labels
    label(1.5,1.5,'💼','Study','#2f9bd8');label(4.5,1.5,'💍','Bedroom','#e0729a');label(7.5,1.5,'🌅','Sunroom','#9b8fe0');
    label(1.5,4.5,'🍲','Kitchen','#f0b541');label(4.5,4.5,'🐾','Living','#46c46a');label(7.5,4.5,'🚗','Garage','#7d93a3');
    // sims
    SIMS.forEach(function(s){sim(s.x,s.y,PEOPLE[s.id],s.id===activeSim);});
    // front path + goal plants
    for(y=6;y<9;y++)tile(4,y,'#d7c9ad',true);
    var spots=[[1,7],[2.4,8],[6,8],[7.4,7],[8.6,6.4]];
    GOALS.forEach(function(gg,i){plant(spots[i][0],spots[i][1],gg);});
    treeAt(-1.4,6.4); treeAt(10.6,7.2);
    DRAW.sort(function(a,b){return a.k-b.k;});
    var svg=DRAW.map(function(d){return d.s;}).join('');
    svg+=roomOverlays(); svg+=mailboxSVG();
    G('hhLot').innerHTML=svg; bindLot();
  }
  function mailboxSVG(){var mb=prj(5.0,8.5,0), n=NOTIF;
    // Outer group positions the mailbox; inner .hh-mailbox carries the bounce
    // animation. They MUST stay separate — a CSS transform animation on the same
    // element overrides the inline translate and snaps it back to the lot origin.
    return '<g transform="translate('+mb[0]+','+mb[1]+')"><g class="hh-mailbox" data-room="mailbox">'
      +'<ellipse cx="0" cy="6" rx="20" ry="7" fill="#000" opacity="0.16"/>'
      +'<rect x="-4" y="-34" width="8" height="40" rx="3" fill="#9c6b43"/>'
      +'<g transform="translate(0,-56)"><rect x="-23" y="0" width="46" height="29" rx="9" fill="#5fa0d6"/>'
      +'<path d="M-23,0 a23,17 0 0 1 46,0 Z" fill="#4f8fc4"/><rect x="-31" y="6" width="9" height="17" rx="3" fill="#e0729a"/>'
      +'<text x="0" y="21" text-anchor="middle" font-size="17">✉️</text>'
      +(n>0?'<g class="hh-mnotif" transform="translate(21,-4)"><circle r="12" fill="#e3473f" stroke="#fff" stroke-width="2"/><text y="4" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="13" fill="#fff">'+n+'</text></g>':'')
      +'</g><text x="0" y="26" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="12" fill="#33414e">'+(n>0?n+' new':'Mail')+'</text></g></g>';}
  function roomOverlays(){var s='', id, r, p;
    for(id in RECT){r=RECT[id];p=[prj(r[0],r[1],0),prj(r[2],r[1],0),prj(r[2],r[3],0),prj(r[0],r[3],0)];
      s+='<polygon class="hh-roomHit hh-hit" data-room="'+id+'" points="'+p.map(ptStr).join(' ')+'"/>';}
    var spots=[[1,7],[2.4,8],[6,8],[7.4,7],[8.6,6.4]];
    GOALS.forEach(function(gg,i){var x=spots[i][0],y=spots[i][1];var pp=[prj(x-0.4,y-0.4,0),prj(x+0.6,y-0.4,0),prj(x+0.6,y+0.6,0),prj(x-0.4,y+0.6,0)];
      s+='<polygon class="hh-goalHit hh-hit" data-goal="'+gg.id+'" points="'+pp.map(ptStr).join(' ')+'"/>';});
    SIMS.forEach(function(pn){var c=prj(pn.x+0.5,pn.y+0.5,0);s+='<circle class="hh-hit" data-person="'+pn.id+'" cx="'+c[0]+'" cy="'+(c[1]-18)+'" r="24" fill="rgba(255,255,255,0)"/>';});
    return s;}
  function bindLot(){
    document.querySelectorAll('#hhLot [data-room]').forEach(function(el){
      el.onclick=function(){openRoom(el.dataset.room);};
      el.onmouseenter=function(){var r=ROOMS[el.dataset.room];showTip(r?r.emoji+' '+r.title:'✉️ Mailbox', r?r.eye:'REMINDERS');};
      el.onmousemove=moveTip;el.onmouseleave=hideTip;});
    document.querySelectorAll('#hhLot [data-goal]').forEach(function(el){var gg=GOALS.find(function(x){return x.id===el.dataset.goal;});
      el.onclick=function(){openGoal(el.dataset.goal);};
      el.onmouseenter=function(){showTip(gg.emoji+' '+gg.name, (gg.target?Math.round(gg.saved/gg.target*100):0)+'% · '+money(gg.saved));};
      el.onmousemove=moveTip;el.onmouseleave=hideTip;});
    document.querySelectorAll('#hhLot [data-person]').forEach(function(el){var p=PEOPLE[el.dataset.person];
      el.onclick=function(){selectSim(el.dataset.person);};
      el.onmouseenter=function(){showTip(p.emoji+' '+p.name,'Click to select & edit');};
      el.onmousemove=moveTip;el.onmouseleave=hideTip;});
  }

  /* ===================== SEASON ===================== */
  var season='summer';
  function seasonGrass(){return {spring:['#9ad36a','#8ecb5e'],summer:['#8ec64f','#83bd45'],fall:['#bdaa55','#b09f49'],winter:['#e8eef2','#dfe7ec']}[season];}
  function seasonTree(){return {spring:['#f7c6dd','#ffd6e6','#f3b8d2'],summer:['#7bb86a','#86c074','#6fae5e'],fall:['#e6a14b','#d9663b','#f0b541'],winter:['#cfe0d6','#dbe8e0','#c5d8cd']}[season];}

  /* ===================== NEEDS / TRAY ===================== */
  function needBreakdown(n){if(n.unknown)return 'No data yet — add details to see this';var ps=n.parts.filter(function(p){return p.v!=null;});if(!ps.length)return 'No data yet';return ps.map(function(p){return p.label+' '+Math.round(p.v*100)+'%';}).join(' · ');}
  function renderNeeds(){if(!NEEDS.length)return;var mood=NEEDS.reduce(function(a,n){return a+n.v;},0)/NEEDS.length;
    var col=function(v){return v>0.7?'#46c46a':v>0.45?'#ecae3e':'#e3675f';};
    G('hhNeedcol').innerHTML=NEEDS.map(function(n,i){return '<div class="hh-need hh-hit" data-need="'+i+'" data-room="'+n.room+'"><div class="hh-track"><i style="height:'+(n.v*100)+'%;background:'+col(n.v)+'"></i></div><span class="hh-em">'+n.em+'</span><span class="hh-lab">'+n.k+'</span></div>';}).join('');
    document.querySelectorAll('#hhNeedcol .hh-need').forEach(function(el){var n=NEEDS[+el.dataset.need];
      el.onclick=function(){openInsight(+el.dataset.need);};
      el.onmouseenter=function(){showTip(n.em+' '+n.k+' · '+Math.round(n.v*100)+(n.unknown?'% (est.)':'%'), needBreakdown(n));};
      el.onmousemove=moveTip;el.onmouseleave=hideTip;});
    var mc=col(mood);G('hhPlumbMood').style.borderBottomColor=mc;G('hhPlumbMood').style.filter='drop-shadow(0 0 10px '+mc+'aa)';
    G('hhMoodTxt').textContent=mood>0.78?'Happy':mood>0.6?'Fine':mood>0.45?'Tense':'Stressed';}
  function renderTray(){G('hhTray').innerHTML=SIMS.map(function(s){var p=PEOPLE[s.id];
    return '<button class="hh-port '+(s.id===activeSim?'on':'')+'" data-sel="'+s.id+'"><span class="hh-pav" style="background:'+p.color+'">'+p.emoji+'</span><span class="hh-pnm">'+p.name+'</span></button>';}).join('');
    document.querySelectorAll('#hhTray .hh-port').forEach(function(b){b.onclick=function(){selectSim(b.dataset.sel);};});}
  function selectSim(id){activeSim=id;buildLot();renderTray();openPerson(id);}

  /* ===================== BUILD 2 — STATS / INSIGHTS ===================== */
  function pctTxt(v){return v==null?'—':Math.round(v*100)+'%';}
  function toneFor(v){return v==null?'':v>0.7?'pos':v>0.45?'':'neg';}
  function txnsByCat(cat,days){var cut=Date.now()-days*86400000;return (S().transactions||[]).filter(function(t){var d=new Date(t.date).getTime();return t.category===cat&&!isNaN(d)&&d>=cut;});}
  function goalPace(id){var ts=txnsByCat('goal:'+id,90);if(!ts.length)return null;var sum=0;ts.forEach(function(t){sum+=Math.abs(t.amount||0);});return sum/3;}
  function net30(){var inc=0,exp=0;txnsInLastDays(30).forEach(function(t){if(t.amount>0)inc+=t.amount;else exp+=-t.amount;});return inc-exp;}
  function weakest(parts,okMsg){var known=parts.filter(function(p){return p.v!=null;});if(!known.length)return {text:'Add details to unlock insights here.',tone:''};known=known.slice().sort(function(a,b){return a.v-b.v;});var w=known[0];if(w.v>0.7)return {text:okMsg,tone:'pos'};return {text:'Focus: '+w.s+'.',tone:w.v>0.45?'':'neg'};}
  function tilesHTML(tiles){if(!tiles||!tiles.length)return '';return '<div class="hh-tiles">'+tiles.map(function(t){return '<div class="hh-tile"><div class="tv '+(t.tone||'')+'">'+t.value+'</div><div class="tl">'+t.label+'</div></div>';}).join('')+'</div>';}
  function insightHTML(ins){if(!ins)return '';return '<div class="hh-insight '+(ins.tone||'')+'"><span class="hi-em">💡</span><span>'+ins.text+'</span></div>';}
  function roomStats(key){
    var st=S();
    if(key==='office'){var nw=G('hhNw')?G('hhNw').textContent:'—';var net=net30();
      var tiles=[{label:'Net worth',value:nw},{label:'Safe to spend',value:SAFE!=null?money(SAFE):'—',tone:SAFE!=null?(SAFE>=0?'pos':'neg'):''},{label:'30-day cashflow',value:money(net),tone:net>=0?'pos':'neg'}];
      var ins=weakest([{l:'goals',v:goalsScore(),s:'funnel more into your savings goals'},{l:'cashflow',v:cashflowScore(),s:'spending is close to income — trim a category'},{l:'savings',v:savingsScore(),s:'build your emergency buffer toward 6 months'}],'Money looks healthy — keep it up.');
      return {tiles:tiles,insight:ins};}
    if(key==='bedroom'){var w=st.wedding||{};var budget=+w.budget||0;
      var lg=w.linkedGoalId?(st.goals||[]).find(function(g){return g.id===w.linkedGoalId;}):null;
      var contrib=lg?((typeof goalSavedAmount==='function')?goalSavedAmount(lg):((lg.current||0)+(typeof getGoalContributions==='function'?getGoalContributions(lg.id):0))):((typeof getWeddingContributions==='function')?getWeddingContributions():0);
      var pctF=budget>0?clamp01(contrib/budget):null;var days=w.date?Math.ceil((new Date(w.date)-new Date())/86400000):null;
      var tiles=[{label:'Budget',value:budget>0?money(budget):'—'},{label:'Saved',value:budget>0?(money(contrib)+' · '+pctTxt(pctF)):'—',tone:toneFor(pctF)},{label:'Countdown',value:days==null?'No date':days<0?'Past':days+'d'}];
      var ins;if(budget<=0)ins={text:'Set a wedding budget to start tracking funding.',tone:''};else if(days!=null&&days>0){var perMo=Math.max(0,budget-contrib)/Math.max(1,days/30);ins={text:'About '+money(perMo)+'/mo keeps you on pace for the date.',tone:pctF>0.7?'pos':pctF>0.4?'':'neg'};}else ins={text:Math.round((pctF||0)*100)+'% funded.',tone:toneFor(pctF)};
      return {tiles:tiles,insight:ins};}
    if(key==='sunroom'){var rs=retirementScore();var t0=new Date();t0.setHours(0,0,0,0);
      var rrsp=(function(){var yr=t0.getFullYear(),m=new Date(yr,2,1);if(m<t0)m=new Date(yr+1,2,1);return Math.ceil((m-t0)/86400000);})();
      var taxd=(function(){var yr=t0.getFullYear(),m=new Date(yr,3,30);if(m<t0)m=new Date(yr+1,3,30);return Math.ceil((m-t0)/86400000);})();
      var tiles=[{label:'Retirement ready',value:pctTxt(rs),tone:toneFor(rs)},{label:'RRSP deadline',value:rrsp+'d',tone:rrsp<=30?'neg':''},{label:'Tax filing',value:taxd+'d',tone:taxd<=30?'neg':''}];
      var ins;if(rs==null)ins={text:'Add ages & retirement targets in the projector.',tone:''};else if(rs>0.7)ins={text:'On pace to replace most of your income.',tone:'pos'};else ins={text:'Projected income is light — raise contributions or retire later.',tone:rs>0.45?'':'neg'};
      return {tiles:tiles,insight:ins};}
    if(key==='kitchen'){var ps=pantryScore();var list=(st.shoppingList||[]).length;var mp=st.mealPlan;var meals=(function(){if(!mp)return 0;try{return Object.keys(mp).length;}catch(e){return 0;}})();
      var todayName=new Date().toLocaleDateString('en-US',{weekday:'long'});var tp=(mp&&mp[todayName])?mp[todayName]:null;
      var tiles=[{label:'Pantry stocked',value:pctTxt(ps),tone:toneFor(ps)},{label:'Shopping list',value:list+(list===1?' item':' items')},{label:'Tonight',value:tp&&tp.dinner?'Planned':(meals?'—':'None'),tone:tp&&tp.dinner?'pos':''}];
      var ins;
      if(tp){var lines=[];Object.keys(tp).forEach(function(k){var mB=/(.*)Breakfast$/.exec(k),mL=/(.*)Lunch$/.exec(k);if(mB&&tp[k])lines.push('🥣 '+(mB[1].charAt(0).toUpperCase()+mB[1].slice(1))+': '+tp[k]);else if(mL&&tp[k])lines.push('🥪 '+(mL[1].charAt(0).toUpperCase()+mL[1].slice(1))+': '+tp[k]);});if(tp.dinner)lines.push('🍽️ Dinner: '+tp.dinner+(tp.estimatedCost?' · '+tp.estimatedCost:''));ins={text:'<b>Today — '+todayName+'</b><br>'+(lines.length?lines.join('<br>'):'Nothing planned for today.'),tone:'pos'};}
      else if(ps!=null&&ps<0.5)ins={text:'Pantry running low — build a shop list before the week.',tone:'neg'};
      else if(!meals)ins={text:'No meal plan yet — generate one from pantry + flyers.',tone:''};
      else ins={text:'No meals set for today ('+todayName+'). Open the planner to fill it in.',tone:''};
      return {tiles:tiles,insight:ins};}
    if(key==='living'){var bo=billsOnTimeScore(),mt=maintScore(),pf=petsScore();
      var dueSoon=(function(){var n=0,now=Date.now(),c=now+7*86400000;(st.bills||[]).forEach(function(b){if(!b.nextDue)return;var d=new Date(b.nextDue+'T00:00:00').getTime();if(d>=now&&d<=c)n++;});return n;})();
      var tiles=[{label:'Bills (7d)',value:dueSoon?dueSoon+' due':'Clear',tone:dueSoon?'neg':'pos'},{label:'Maintenance',value:pctTxt(mt),tone:toneFor(mt)},{label:'Pets fed',value:pf==null?'—':pctTxt(pf),tone:toneFor(pf)}];
      var ins=weakest([{l:'bills',v:bo,s:'a bill is overdue — clear it'},{l:'maintenance',v:mt,s:'home upkeep tasks are overdue'},{l:'pets',v:pf,s:'pets aren’t fed yet today'}],'Home and pets are in good shape.');
      return {tiles:tiles,insight:ins};}
    if(key==='garage'){var funds=st.carFunds||[];var saved=funds.reduce(function(s,c){return s+((c.savedAmount||0)+(typeof getCarFundContributions==='function'?getCarFundContributions(c.id):0));},0);var goal=funds.reduce(function(s,c){return s+(c.financing?(c.downPayment||0):(c.targetPrice||0));},0);var pf=goal>0?clamp01(saved/goal):null;
      var tiles=[{label:'Vehicles',value:funds.length?funds.length:'None'},{label:'Car savings',value:funds.length?money(saved):'—',tone:toneFor(pf)},{label:'Funded',value:pctTxt(pf),tone:toneFor(pf)}];
      var ins;if(!funds.length)ins={text:'Add a car fund to plan your next vehicle.',tone:''};else if(pf!=null&&pf>=1)ins={text:'Car fund target reached.',tone:'pos'};else ins={text:money(Math.max(0,goal-saved))+' to go on your car goal.',tone:pf>0.5?'':'neg'};
      return {tiles:tiles,insight:ins};}
    return {tiles:[],insight:null};
  }
  var SUGG={'Money|Goals':'Funnel more into your savings goals','Money|Cashflow':'Spending is near income — trim a category this month','Money|Savings':'Build your emergency buffer toward 6 months','Home|Pantry':'Restock the pantry / build a shop list','Home|Bills on time':'A bill is overdue — clear it','Home|Maintenance':'Home upkeep tasks are overdue','Pets|Fed today':'Feed the pets and log it','Plans|Goals':'Top up your savings goals','Plans|Wedding':'Add to the wedding fund','Plans|House':'Grow the down-payment / FHSA','Plans|Retirement':'Raise retirement contributions'};
  function needSuggestion(n,parts){if(!parts.length)return '';var known=parts.slice().sort(function(a,b){return a.v-b.v;});var w=known[0];if(w.v>0.7)return insightHTML({text:'Looking strong — nothing urgent here.',tone:'pos'});var msg=SUGG[n.k+'|'+w.label]||('Improve '+w.label);return insightHTML({text:msg+' ('+w.label+' is lowest at '+Math.round(w.v*100)+'%)',tone:w.v>0.45?'':'neg'});}
  function openInsight(i){var n=NEEDS[i];if(!n)return;var col=function(v){return v>0.7?'#46c46a':v>0.45?'#ecae3e':'#e3675f';};
    G('hhPEye').textContent='HOUSEHOLD NEED';G('hhPEmoji').textContent=n.em;G('hhPTitle').textContent=n.k;
    G('hhPHead').style.background='linear-gradient(135deg,'+hexA(col(n.v),0.26)+','+hexA(col(n.v),0.05)+')';
    var parts=n.parts.filter(function(p){return p.v!=null;});
    var bars=parts.length?parts.map(function(p){return '<div class="hh-mini"><span class="ml">'+p.label+'</span><div class="mt"><i style="width:'+(p.v*100)+'%;background:'+col(p.v)+'"></i></div><span class="mv">'+Math.round(p.v*100)+'%</span></div>';}).join(''):'<p style="color:#6b7a88">No data yet — add details to unlock this score.</p>';
    G('hhPBody').innerHTML='<p>Overall '+Math.round(n.v*100)+(n.unknown?'% (estimated)':'%')+'. Here’s what feeds it:</p><div style="margin-top:10px">'+bars+'</div>'+needSuggestion(n,parts)
      +'<div style="margin-top:14px"><span class="hh-chip" data-openroom="'+n.room+'">Open '+(ROOMS[n.room]?ROOMS[n.room].title:'room')+' ›</span></div>';
    document.querySelectorAll('#hhPanel [data-openroom]').forEach(function(c){c.onclick=function(){openRoom(c.dataset.openroom);};});
    G('hhPanel').classList.add('show');}

  /* ===================== PANEL ===================== */
  function openRoom(key){var r=ROOMS[key];
    if(key==='mailbox'){G('hhPEye').textContent='REMINDERS & BILLS';G('hhPEmoji').textContent='✉️';G('hhPTitle').textContent='The Mailbox';
      G('hhPHead').style.background='linear-gradient(135deg,rgba(47,155,216,.25),rgba(47,155,216,.05))';
      var rem=buildReminders();
      var ucol=function(u){return u===0?'#e3675f':u===1?'#ecae3e':'#46c46a';};
      var body;
      if(!rem.length){body='<p style="text-align:center;padding:18px 0;color:#6b7a88">All clear ✨<br><small>Nothing due in the next week.</small></p>';}
      else{body='<p style="margin:0 0 10px;font-size:12px;color:#6b7a88">'+rem.length+' thing'+(rem.length!==1?'s':'')+' needing attention — click to jump there.</p>'
        +rem.map(function(r){return '<div class="hh-rem" data-go="'+r.go+'" style="border-left:3px solid '+ucol(r.urg)+'"><span class="hh-rem-em">'+r.emoji+'</span><span class="hh-rem-tx"><b>'+r.text+'</b><small>'+r.sub+'</small></span><span class="hh-rem-go">›</span></div>';}).join('');}
      G('hhPBody').innerHTML=body;bindChips();G('hhPanel').classList.add('show');return;}
    if(!r)return;
    G('hhPEye').textContent=r.eye;G('hhPEmoji').textContent=r.emoji;G('hhPTitle').textContent=r.title;
    G('hhPHead').style.background='linear-gradient(135deg, '+hexA(r.color,0.26)+', '+hexA(r.color,0.05)+')';
    var rs=roomStats(key);
    var h='<p>'+r.body+'</p>'+tilesHTML(rs.tiles)+insightHTML(rs.insight)+'<div style="margin-top:14px">';
    r.pages.forEach(function(pg){h+='<span class="hh-chip" data-go="'+pg[0]+'">'+pg[1]+' ›</span>';});
    if(key==='office')h+='<span class="hh-chip" data-assets="1">🏷️ Add an asset ›</span>';
    h+='</div>';G('hhPBody').innerHTML=h;bindChips();G('hhPanel').classList.add('show');}
  function openGoal(id){var g=GOALS.find(function(x){return x.id===id;});if(!g)return;var pct=g.target?Math.min(g.saved/g.target,1):0, rem=Math.max(g.target-g.saved,0);
    var daysLeft=g.date?Math.ceil((new Date(g.date)-new Date())/86400000):null;
    var needed=(daysLeft&&daysLeft>0)?(rem/(daysLeft/30)):null;
    var pace=goalPace(g.id);
    var monthsLeft=(pace&&pace>0&&rem>0)?Math.ceil(rem/pace):null;
    var finishTxt;if(rem<=0)finishTxt='✓ Funded';else if(monthsLeft!=null){var fd=new Date();fd.setMonth(fd.getMonth()+monthsLeft);finishTxt=fd.toLocaleDateString('en-CA',{month:'short',year:'numeric'});}else finishTxt='—';
    var onTrack=null;if(rem<=0)onTrack=true;else if(needed!=null&&pace!=null)onTrack=pace>=needed*0.95;else if(pace!=null)onTrack=pace>0;
    G('hhPEye').textContent='GARDEN · SAVINGS GOAL';G('hhPEmoji').textContent=g.emoji;G('hhPTitle').textContent=g.name;
    G('hhPHead').style.background='linear-gradient(135deg, '+hexA(g.color,0.26)+', '+hexA(g.color,0.05)+')';
    G('hhPBody').innerHTML='<p>This plant grows as you fund the goal. '+(pct>=1?'<b>In full bloom — funded! 🌸</b>':'Keep it watered.')+'</p>'
      +'<div style="margin-top:12px"><div class="hh-srow"><span class="k">Saved</span><span class="v pos">'+money(g.saved)+'</span></div>'
      +'<div class="hh-srow"><span class="k">Target</span><span class="v">'+money(g.target)+'</span></div>'
      +'<div class="hh-srow"><span class="k">Remaining</span><span class="v '+(rem?'':'pos')+'">'+(rem?money(rem):'✓ funded')+'</span></div>'
      +(needed!=null?'<div class="hh-srow"><span class="k">Needed / mo</span><span class="v">'+money(needed)+'</span></div>':'')
      +(pace!=null?'<div class="hh-srow"><span class="k">Your pace</span><span class="v '+(needed!=null?(pace>=needed*0.95?'pos':'neg'):'')+'">'+money(pace)+'/mo</span></div>':'')
      +'<div class="hh-srow"><span class="k">Projected finish</span><span class="v">'+finishTxt+'</span></div></div>'
      +'<div style="margin-top:8px;font-weight:800;font-size:12px;color:#6b7a88">'+Math.round(pct*100)+'% GROWN</div><div class="hh-pbar"><i style="width:'+(pct*100)+'%"></i></div>'
      +(onTrack!=null?insightHTML({text:(rem<=0?'Goal funded! 🌸':onTrack?'On track to finish on time.':'Behind pace — increase monthly contributions.'),tone:onTrack?'pos':'neg'}):'')
      +'<div style="margin-top:14px"><span class="hh-chip" data-go="goals">🎯 Open Goals ›</span></div>';
    bindChips();G('hhPanel').classList.add('show');}
  function openPerson(id){var p=PEOPLE[id];
    G('hhPEye').textContent=(p.kind==='pet'?'PET':'HOUSEHOLD MEMBER');G('hhPEmoji').textContent=p.emoji;G('hhPTitle').textContent=p.name;
    G('hhPHead').style.background='linear-gradient(135deg, '+hexA(p.color,0.26)+', '+hexA(p.color,0.05)+')';
    if(p.kind==='pet'){
      var fed=(p.fed!==false);
      G('hhPBody').innerHTML='<p>'+p.name+' — '+(p.type||'pet')+'. '+(fed?'All fed and happy for today. 🐾':'Hasn’t been fed yet today — tap below to log it.')+'</p>'
        +'<div style="margin-top:12px"><div class="hh-srow"><span class="k">Fed today</span><span class="v '+(fed?'pos':'neg')+'">'+(fed?'✅ Yes':'🍽️ Not yet')+'</span></div></div>'
        +'<div style="margin-top:14px"><span class="hh-chip" data-go="pets">🐾 Open Pets ›</span></div>';
      bindChips();G('hhPanel').classList.add('show');return;
    }
    var incBlock='';
    if(p.kind==='member' && p.monthlyIncome>0){
      incBlock='<div style="margin-top:12px"><div class="hh-srow"><span class="k">Income</span><span class="v">'+money(p.monthlyIncome)+'/mo</span></div>'
        +(p.incShare!=null?'<div class="hh-srow"><span class="k">Household share</span><span class="v pos">'+Math.round(p.incShare*100)+'%</span></div>':'')+'</div>';
    }
    var tipsBlock='';
    if(p.kind==='member' && p.hasTips && typeof getHollyTipsForYear==='function'){
      var yr=new Date().getFullYear(); var tips=getHollyTipsForYear(yr)||0; var reserve=tips*0.25;
      tipsBlock='<div style="margin-top:12px"><div class="hh-srow"><span class="k">Tips YTD ('+yr+')</span><span class="v pos">'+money(tips)+'</span></div>'
        +'<div class="hh-srow"><span class="k">CRA reserve (25%)</span><span class="v neg">'+money(reserve)+'</span></div></div>';
    }
    var goalBlock='';
    if(p.kind==='member' && typeof getAccountById==='function'){
      var mine=(S().goals||[]).filter(function(gg){if(!gg.accountId)return false;var a=getAccountById(gg.accountId);return a&&((a.person===p.name)||a.isJoint);});
      if(mine.length){var tot=mine.reduce(function(s,gg){return s+(typeof goalSavedAmount==='function'?goalSavedAmount(gg):0);},0);
        goalBlock='<div style="margin-top:12px"><div class="hh-srow"><span class="k">Goal savings ('+mine.length+')</span><span class="v pos">'+money(tot)+'</span></div></div>';}
    }
    G('hhPBody').innerHTML='<p>'+p.name+' — '+p.role+'. Details used across budgeting, the income split and Ontario tax estimates.</p>'
      +incBlock+tipsBlock+goalBlock
      +'<div style="margin-top:14px"><span class="hh-chip" data-setup="1">⚙️ Edit in Setup ›</span></div>';
    bindChips();G('hhPanel').classList.add('show');}
  function bindChips(){
    document.querySelectorAll('#hhPanel [data-go]').forEach(function(c){c.onclick=function(){go(c.dataset.go);};});
    document.querySelectorAll('#hhPanel [data-setup]').forEach(function(c){c.onclick=function(){hide();if(typeof openSetupWizard==='function')openSetupWizard(true);};});
    document.querySelectorAll('#hhPanel [data-assets]').forEach(function(c){c.onclick=function(){hide();if(typeof showPage==='function')showPage('networth');if(typeof openManualAssetModal==='function')setTimeout(openManualAssetModal,200);};});}

  /* ===================== TOOLTIP / TOAST / HINT ===================== */
  function showTip(t,s){G('hhTipT').textContent=t;G('hhTipS').textContent=s;G('hhTip').style.opacity=1;}
  function moveTip(e){var tip=G('hhTip');tip.style.left=(e.clientX+16)+'px';tip.style.top=(e.clientY+16)+'px';}
  function hideTip(){G('hhTip').style.opacity=0;}
  function toast(e,x,d){G('hhToastE').textContent=e;G('hhToastX').textContent=x;G('hhToastD').textContent=d||'';var t=G('hhToastBox');t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2000);}
  var hT;function hint(t){var h=G('hhHint');h.textContent=t;h.classList.add('show');clearTimeout(hT);hT=setTimeout(function(){h.classList.remove('show');},5500);}

  /* ===================== SKY / TIME ===================== */
  var SKYK=[{h:0,top:'#101a35',mid:'#1c2b50',bot:'#2b3a67',sun:'#cdd7ff',br:0.05},{h:5,top:'#3a4a7a',mid:'#7a6a9a',bot:'#e9a78c',sun:'#ffd9a0',br:0.3},{h:7,top:'#9fc4e8',mid:'#cfe6f2',bot:'#ffe7c4',sun:'#ffe08a',br:0.7},{h:12,top:'#a9dbf0',mid:'#d6f0ec',bot:'#fff4d9',sun:'#ffd36b',br:1},{h:17,top:'#bfe0ef',mid:'#ffe6cf',bot:'#ffd9a8',sun:'#ffc878',br:0.85},{h:19,top:'#6f6aa0',mid:'#e7896a',bot:'#ffb27a',sun:'#ff9d5c',br:0.45},{h:21,top:'#2e3566',mid:'#4a3f74',bot:'#a86a7e',sun:'#ffcaa0',br:0.18},{h:24,top:'#101a35',mid:'#1c2b50',bot:'#2b3a67',sun:'#cdd7ff',br:0.05}];
  function skyAt(hr){var a=SKYK[0],b=SKYK[SKYK.length-1],i;for(i=0;i<SKYK.length-1;i++){if(hr>=SKYK[i].h&&hr<=SKYK[i+1].h){a=SKYK[i];b=SKYK[i+1];break;}}var t=(hr-a.h)/((b.h-a.h)||1);
    return {top:lerpHex(a.top,b.top,t),mid:lerpHex(a.mid,b.mid,t),bot:lerpHex(a.bot,b.bot,t),sun:lerpHex(a.sun,b.sun,t),br:a.br+(b.br-a.br)*t};}
  var rootEl, minutes=840, live=false, liveTimer=null;
  function applyTime(min){var hr=min/60,s=skyAt(hr);rootEl.style.setProperty('--sky-top',s.top);rootEl.style.setProperty('--sky-mid',s.mid);rootEl.style.setProperty('--sky-bot',s.bot);rootEl.style.setProperty('--sun-col',s.sun);
    var dayT=(hr-6)/12,x=150+dayT*1300,y=520-Math.sin(Math.max(0,Math.min(1,dayT))*Math.PI)*380,isDay=hr>=6&&hr<=18;
    G('hhSun').setAttribute('cx',x);G('hhSun').setAttribute('cy',y);G('hhSunHalo').setAttribute('cx',x);G('hhSunHalo').setAttribute('cy',y);
    G('hhSun').style.opacity=isDay?1:0;G('hhSunHalo').style.opacity=isDay?(0.4+s.br*0.5):0;
    var nT=hr>18?(hr-18)/12:(hr+6)/12,mx=150+nT*1300,my=520-Math.sin(Math.max(0,Math.min(1,nT))*Math.PI)*340;
    G('hhMoon').setAttribute('transform','translate('+(mx-300)+','+(my-220)+')');G('hhMoon').style.opacity=isDay?0:1;
    G('hhStars').style.opacity=isDay?0:Math.min(1,(1-s.br)*1.4);
    var _ck=G('hhClock');if(_ck)_ck.textContent=fmtC(min,false);var _tn=G('hhTnow');if(_tn)_tn.textContent=fmtC(min,true);}
  function fmtC(min,ap){var h=Math.floor(min/60)%24,m=min%60,a=h<12?'am':'pm',hh=h%12;if(hh===0)hh=12;return ap?(hh+':'+('0'+m).slice(-2)+' '+a):(hh+':'+('0'+m).slice(-2));}
  function makeStars(){var s='',i,x,y,r;for(i=0;i<90;i++){x=Math.random()*1600;y=Math.random()*520;r=Math.random()*1.5+0.4;s+='<circle cx="'+x.toFixed(0)+'" cy="'+y.toFixed(0)+'" r="'+r.toFixed(1)+'" fill="#fff" opacity="'+(0.4+Math.random()*0.6).toFixed(2)+'"><animate attributeName="opacity" values="'+(0.2+Math.random()*0.3).toFixed(2)+';1;'+(0.2+Math.random()*0.3).toFixed(2)+'" dur="'+(2+Math.random()*3).toFixed(1)+'s" repeatCount="indefinite"/></circle>';}G('hhStars').innerHTML=s;}
  function makeClouds(){var s='',i,y,sc,dur,delay,op;for(i=0;i<5;i++){y=50+Math.random()*220;sc=0.6+Math.random()*0.8;dur=80+Math.random()*70;delay=-Math.random()*dur;op=0.75+Math.random()*0.2;s+='<g class="hh-cloud" style="animation-duration:'+dur+'s;animation-delay:'+delay+'s" transform="translate(0,'+y+') scale('+sc+')" opacity="'+op+'"><ellipse cx="0" cy="0" rx="70" ry="38" fill="#fff"/><ellipse cx="58" cy="10" rx="58" ry="32" fill="#fff"/><ellipse cx="-54" cy="12" rx="48" ry="28" fill="#fff"/><ellipse cx="8" cy="-20" rx="44" ry="28" fill="#fff"/></g>';}G('hhClouds').innerHTML=s;}

  /* ===================== WEATHER ===================== */
  var weather='sun', autoWeather=true;
  function setWeather(w){weather=w;var map={sun:['☀️','Clear'],cloud:['⛅','Cloudy'],rain:['🌧️','Light rain'],snow:['❄️','Snow']};G('hhWEmoji').textContent=map[w][0];G('hhWSub').textContent=map[w][1];refreshFX();}
  function refreshFX(){var s='',i,x,d,r,sx,col;
    if(weather==='rain')for(i=0;i<70;i++){x=Math.random()*1600;d=0.5+Math.random()*0.5;s+='<line x1="'+x+'" y1="-20" x2="'+(x-8)+'" y2="10" stroke="#9cc4e0" stroke-width="2" opacity="0.6"><animate attributeName="y1" values="-40;1040" dur="'+d+'s" repeatCount="indefinite"/><animate attributeName="y2" values="-10;1070" dur="'+d+'s" repeatCount="indefinite"/></line>';}
    if(weather==='snow')for(i=0;i<60;i++){x=Math.random()*1600;d=4+Math.random()*4;r=1.5+Math.random()*2.5;sx=Math.random()*40-20;s+='<circle cx="'+x+'" cy="-10" r="'+r+'" fill="#fff" opacity="0.9"><animate attributeName="cy" values="-10;1020" dur="'+d+'s" repeatCount="indefinite"/><animate attributeName="cx" values="'+x+';'+(x+sx)+';'+x+'" dur="'+d+'s" repeatCount="indefinite"/></circle>';}
    if(season==='fall')for(i=0;i<22;i++){x=Math.random()*1600;d=5+Math.random()*5;col=['#e6a14b','#d9663b','#f0b541'][i%3];s+='<path d="M0,0 q6,-8 12,0 q-6,8 -12,0Z" fill="'+col+'" opacity="0.85"><animateTransform attributeName="transform" type="translate" values="'+x+',-20;'+(x-60)+',1020" dur="'+d+'s" repeatCount="indefinite"/></path>';}
    G('hhWeatherFX').innerHTML=s;}
  function codeToWeather(c){if(c<=2)return 'sun';if(c===3||c===45||c===48)return 'cloud';if((c>=51&&c<=67)||(c>=80&&c<=82)||c>=95)return 'rain';if((c>=71&&c<=77)||c===85||c===86)return 'snow';return 'cloud';}
  var PROV_CAPITALS={ON:['Toronto','ON'],QC:['Quebec City','QC'],BC:['Vancouver','BC'],AB:['Edmonton','AB'],MB:['Winnipeg','MB'],SK:['Regina','SK'],NS:['Halifax','NS'],NB:['Fredericton','NB'],NL:["St. John's",'NL'],PE:['Charlottetown','PE'],YT:['Whitehorse','YT'],NT:['Yellowknife','NT'],NU:['Iqaluit','NU']};
  function lotWeatherLocation(){var st=S();var locs=st.weatherLocations||[];var idx=st.weatherLocationIndex||0;if(idx>=locs.length)idx=0;
    if(locs[idx]&&locs[idx].city)return {city:locs[idx].city,province:locs[idx].province||'ON'};
    if(st.household&&st.household.city)return {city:st.household.city,province:st.household.province||'ON'};
    var pv=(st.household&&st.household.province)||'ON';var c=PROV_CAPITALS[pv]||PROV_CAPITALS.ON;return {city:c[0],province:c[1]};}
  function initWeather(){var loc=lotWeatherLocation();if(typeof fetchWeatherForLocation!=='function')return;
    fetchWeatherForLocation(loc.city,loc.province).then(function(w){var te=G('hhWText');if(te)te.textContent=w.temp+'°';if(autoWeather)setWeather(codeToWeather(w.code));}).catch(function(){});}

  /* ===================== CONTROLS / LIVE ===================== */
  function syncLive(){var d=new Date();minutes=d.getHours()*60+d.getMinutes();var sl=G('hhTimeSlider');if(sl)sl.value=minutes;applyTime(minutes);}
  function startLive(){live=true;syncLive();liveTimer=setInterval(syncLive,30000);}
  function closePanel(){var p=G('hhPanel');if(p)p.classList.remove('show');}
  function wireControls(){
    var x=G('hhPClose');if(x)x.onclick=closePanel;
    var cb=G('hhClassicBtn');if(cb)cb.onclick=function(){hide();};
    // safe-to-spend explainer tooltip
    var safeEl=G('hhSafe'), safePill=safeEl?safeEl.parentNode:null;
    if(safePill){safePill.style.cursor='help';
      safePill.onmouseenter=function(){showTip('💵 Safe to spend'+(SAFE!=null?' · '+money(SAFE):''), SAFE!=null?('Liquid '+money(SAFE_LIQUID)+'  −  goal savings '+money(SAFE_GOALS)+'  −  bills due 30d '+money(SAFE_BILLS)):'Add accounts to calculate');};
      safePill.onmousemove=moveTip;safePill.onmouseleave=hideTip;}
    // click anywhere outside the panel (and not on a hotspot) closes it
    var root=G('hh-home');
    if(root&&!root._closeBound){root._closeBound=true;root.addEventListener('click',function(e){
      var p=G('hhPanel');if(!p||!p.classList.contains('show'))return;
      if(p.contains(e.target))return;
      if(e.target.closest&&e.target.closest('[data-room],[data-goal],[data-person],.hh-need,.hh-port'))return;
      closePanel();
    },true);}
    // Esc closes
    if(!window._hhEscBound){window._hhEscBound=true;document.addEventListener('keydown',function(e){if(e.key==='Escape')closePanel();});}
  }

  /* ===================== SHOW / HIDE / INIT ===================== */
  function buildOnce(){ if(built) return; built=true; rootEl=G('hh-home');
    [loadData,makeStars,makeClouds,buildLot,renderNeeds,renderTray,function(){applyTime(minutes);},refreshFX,wireControls,startLive,initWeather].forEach(function(step){try{step();}catch(e){if(window.console&&console.warn)console.warn('[HHHome] init step failed:',e);}});
    setInterval(initWeather,600000);
  }
  function show(){ if(mq.matches) return; buildOnce(); loadData(); buildLot(); renderTray(); renderNeeds();
    var h=G('hh-home'); if(h) h.classList.remove('hh-hidden'); document.body.classList.add('hh-home-open');
    if(!started){ started=true; runBoot(); } }
  function hide(){ var h=G('hh-home'); if(h) h.classList.add('hh-hidden'); document.body.classList.remove('hh-home-open'); }
  function go(pageId){ hide(); if(typeof showPage==='function') showPage(pageId); }
  function runBoot(){ setTimeout(function(){
      var b=G('hhBoot'); if(b)b.classList.add('gone');
      ['hhTop','hhNeeds','hhTray'].forEach(function(id){var el=G(id);if(el)el.classList.add('show');});
      hint('CLICK A ROOM TO OPEN IT · PLANTS ARE YOUR GOALS · TIME & WEATHER ARE LIVE · ✕ CLASSIC VIEW TOP-RIGHT');
    },900); }
  function init(){
    if(mq.matches){ hide(); return; }                  // mobile -> classic view
    var st=(typeof state==='object'&&state)?state:{};
    if(!st.household || !st.household.setupComplete){ hide(); return; } // let wizard run
    show();
  }

  window.HHHome = { init:init, show:show, hide:hide, go:go };
})();
