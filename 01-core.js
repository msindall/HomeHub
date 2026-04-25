// HOME HUB v4.0 — CROSS-PLATFORM COMPATIBILITY LAYER | Works in: Chrome, Firefox, Safari, Edge, Claude Desktop App

// Native alert/confirm are blocked in some contexts (iframes, Claude Desktop)
var _dlgQueue = [];
var _dlgActive = false;

function hhDialog(opts) {
  // opts: { type:'alert'|'confirm', icon, title, message, okText, cancelText, onOk, onCancel }
  return new Promise(function(resolve) {
    _dlgQueue.push({ opts: opts, resolve: resolve });
    if (!_dlgActive) _processDialogQueue();
  });
}

function _processDialogQueue() {
  if (!_dlgQueue.length) { _dlgActive = false; return; }
  _dlgActive = true;
  var item = _dlgQueue.shift();
  var o = item.opts;
  var overlay = document.getElementById('hh-dialog-overlay');
  if (!overlay) {
    // Fallback if DOM not ready — use native as last resort
    if (o.type === 'confirm') { item.resolve(window.confirm(o.message)); }
    else { window.alert(o.message); item.resolve(true); }
    _processDialogQueue();
    return;
  }
  document.getElementById('hh-dialog-icon').textContent = o.icon || (o.type === 'confirm' ? '❓' : 'ℹ️');
  document.getElementById('hh-dialog-title').textContent = o.title || (o.type === 'confirm' ? 'Confirm' : 'Notice');
  document.getElementById('hh-dialog-message').innerHTML = o.message || '';
  var btns = document.getElementById('hh-dialog-btns');
  btns.innerHTML = '';
  if (o.type === 'confirm') {
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = o.cancelText || 'Cancel';
    cancelBtn.onclick = function() { _closeDialog(); item.resolve(false); _processDialogQueue(); };
    btns.appendChild(cancelBtn);
  }
  var okBtn = document.createElement('button');
  okBtn.className = 'btn btn-primary';
  okBtn.textContent = o.okText || 'OK';
  okBtn.onclick = function() { _closeDialog(); item.resolve(true); _processDialogQueue(); };
  btns.appendChild(okBtn);
  overlay.classList.add('open');
  okBtn.focus();
}

function _closeDialog() {
  var overlay = document.getElementById('hh-dialog-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Async wrappers that match alert/confirm signatures
function hhAlert(message, icon, title) {
  return hhDialog({ type: 'alert', message: message, icon: icon, title: title });
}
function hhConfirm(message, icon, title) {
  return hhDialog({ type: 'confirm', message: message, icon: icon, title: title });
}
function hhToast(message, type) {
  // Remove any existing toast
  var old = document.getElementById('hh-toast');
  if (old) old.remove();
  var icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  var colors = { success: 'var(--green)', error: 'var(--red)', info: 'var(--accent)', warning: '#f59e0b' };
  var t = type || 'success';
  var el = document.createElement('div');
  el.id = 'hh-toast';
  el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--card);border:1.5px solid '+(colors[t]||colors.success)+';color:var(--text1);padding:10px 20px;border-radius:30px;font-size:13px;font-weight:700;box-shadow:0 4px 20px rgba(0,0,0,0.18);z-index:99999;white-space:nowrap;max-width:90vw;text-align:center;animation:fadeInUp 0.2s ease';
  el.textContent = (icons[t] || '') + ' ' + message;
  document.body.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.remove(); }, 3000);
}

// localStorage is blocked in some sandboxed environments (Claude Desktop, certain iframes)
var _storageCache = {};
var _useIDB = false;
var _idbReady = false;
var _idbDB = null;
var _idbQueue = [];

(function initStorage() {
  // Test localStorage
  try {
    var testKey = '__hh_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    // localStorage works — nothing more needed
  } catch(e) {
    // localStorage blocked — use IndexedDB
    _useIDB = true;
    console.log('[HomeHub] localStorage unavailable, switching to IndexedDB');
    var req = indexedDB.open('HomeHubDB', 1);
    req.onupgradeneeded = function(e) {
      e.target.result.createObjectStore('kv');
    };
    req.onsuccess = function(e) {
      _idbDB = e.target.result;
      _idbReady = true;
      // Replay queued reads
      _idbQueue.forEach(function(fn) { fn(); });
      _idbQueue = [];
    };
    req.onerror = function() {
      // Both storage methods failed — use in-memory only (data won't persist)
      console.warn('[HomeHub] Both localStorage and IndexedDB unavailable — running in memory mode');
      _useIDB = false;
    };
  }
})();

function _idbGet(key, cb) {
  if (!_idbDB) { cb(null); return; }
  var tx = _idbDB.transaction('kv', 'readonly');
  var req = tx.objectStore('kv').get(key);
  req.onsuccess = function() { cb(req.result); };
  req.onerror = function() { cb(null); };
}
function _idbSet(key, value) {
  if (!_idbDB) return;
  var tx = _idbDB.transaction('kv', 'readwrite');
  tx.objectStore('kv').put(value, key);
}
function _idbRemove(key) {
  if (!_idbDB) return;
  var tx = _idbDB.transaction('kv', 'readwrite');
  tx.objectStore('kv').delete(key);
}

// Synchronous-style wrappers that use cache
function hhStorageGet(key) {
  if (!_useIDB) {
    try { return localStorage.getItem(key); } catch(e) { return _storageCache[key] || null; }
  }
  return _storageCache[key] || null; // IDB is async — cache is populated on load
}
function hhStorageSet(key, value) {
  _storageCache[key] = value;
  if (!_useIDB) {
    try { localStorage.setItem(key, value); } catch(e) {}
  } else {
    _idbSet(key, value);
  }
}
function hhStorageRemove(key) {
  delete _storageCache[key];
  if (!_useIDB) {
    try { localStorage.removeItem(key); } catch(e) {}
  } else {
    _idbRemove(key);
  }
}

// Load IDB data into cache on startup (async, called after IDB ready)
function _preloadIDBCache(cb) {
  if (!_useIDB || !_idbDB) { if(cb)cb(); return; }
  var tx = _idbDB.transaction('kv', 'readonly');
  var store = tx.objectStore('kv');
  var req = store.getAllKeys();
  req.onsuccess = function() {
    var keys = req.result;
    var pending = keys.length;
    if (!pending) { if(cb)cb(); return; }
    keys.forEach(function(key) {
      _idbGet(key, function(val) {
        if (val !== null) _storageCache[key] = val;
        pending--;
        if (pending === 0 && cb) cb();
      });
    });
  };
  req.onerror = function() { if(cb)cb(); };
}

// Flipp API blocks direct browser calls in Firefox/Safari/Desktop
// We try direct first, then fall back to a CORS proxy
var FLIPP_CORS_PROXIES = [
  '', // Direct first
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url='
];
var _flippProxyIndex = 0;

async function flippFetch(url) {
  var lastErr;
  for (var i = _flippProxyIndex; i < FLIPP_CORS_PROXIES.length; i++) {
    try {
      var fetchUrl = i === 0 ? url : FLIPP_CORS_PROXIES[i] + encodeURIComponent(url);
      var resp = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var text = await resp.text();
      var data = JSON.parse(text);
      _flippProxyIndex = i; // Remember what worked
      return data;
    } catch(e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All Flipp fetch methods failed');
}

// PDF TEXT EXTRACTION (uses PDF.js — no server needed)
async function extractPDFText(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js not loaded — please refresh the page.');
  const arrayBuf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf), disableWorker: true, disableFontFace: true }).promise;
  let fullText = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let lastY = null;
    tc.items.forEach(function(item) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) fullText += '\n';
      fullText += item.str;
      lastY = item.transform[5];
    });
    fullText += '\n';
  }
  return fullText.trim();
}

// Render each PDF page to a canvas and return base64 JPEG images.
// Used for image-based / scanned PDFs where text extraction returns nothing.
async function extractPDFImages(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js not loaded.');
  const arrayBuf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf), disableWorker: true, disableFontFace: true }).promise;
  const images = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better OCR readability
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    images.push({ page: p, base64: base64, total: pdf.numPages });
  }
  return images;
}

// Send a single PDF page image to Claude Vision API and get transactions back.
async function callClaudeVision(base64, pageNum, totalPages) {
  var resp;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: (function(){ var h={'Content-Type':'application/json','anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-calls':'true'}; var k=getApiKey(); if(k) h['x-api-key']=k; return h; })(),
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text:
              'This is page ' + pageNum + ' of ' + totalPages + ' of a Canadian bank statement image.\n' +
              'Extract every transaction row visible. Return ONLY a JSON array, no markdown:\n' +
              '[{"date":"M/D/YYYY","description":"payee name","amount":-50.00}]\n' +
              'Rules:\n' +
              '(1) Negative amount for withdrawals/debits/purchases. Positive for deposits/credits/refunds.\n' +
              '(2) Skip opening/closing balance rows, column headers, and summary totals.\n' +
              '(3) Date format: M/D/YYYY (e.g. 2/28/2026).\n' +
              '(4) Clean descriptions: remove terminal codes, city codes, reference numbers.\n' +
              'Return ONLY the JSON array.'
            }
          ]
        }]
      })
    });
  } catch(netErr) {
    throw new Error('Network error during vision scan: ' + netErr.message);
  }
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  const text = ((data.content || []).find(function(c){return c.type==='text';}) || {}).text || '[]';
  const arr = text.replace(/```json|```/g, '').trim().match(/\[[\s\S]*\]/);
  try { return JSON.parse(arr ? arr[0] : '[]'); } catch(e) { return []; }
}

// STATE & PERSISTENCE
const KEY = 'mh_v5';
function loadState() { try { return JSON.parse(hhStorageGet(KEY)) || defaultState(); } catch { return defaultState(); } }
function saveState() { hhStorageSet(KEY, JSON.stringify(state)); }
function uid() { return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }

function defaultState() {
  return {
    household: { name: '', emoji: '🏠', province: 'ON', city: '', setupComplete: false },
    members: [],
    pets: [],
    transactions: [],
    tips: [],
    goals: [],
    wedding: { budget: 0, date: '', venue: '', notes: '' },
    weddingVendors: [],
    house: {
      targetPrice: 0, savedAmount: 0, monthlyContribution: 0, targetDate: '', notes: '',
      fhsa: { mattBalance: 0, hollyBalance: 0, mattYearStart: new Date().getFullYear(), hollyYearStart: new Date().getFullYear() },
      hbp: { mattEligible: 35000, hollyEligible: 35000, mattUsed: 0, hollyUsed: 0 }
    },
    bills: [],
    netWorthHistory: [],
    manualAssets: [],
    categories: defaultCategories(),
    budgets: defaultBudgets(),
    statements: [],
    shoppingList: [],
    pantry: [],
    mealPlan: null,
    mealRatings: {},
    cookedMeals: {},
    lockedMeals: {},
    dietPrefs: { avoid:"", favourites:"", notes:"", complexity:"moderate", dietStyle:["omnivore"] },
    catRules: defaultCatRules(),
    calEvents: [],
    gcalConfig: {},
    flyers: [],
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    weatherLocations: [],
    weatherLocationIndex: 0,
    petFeeding: {},
    theme: null,
    startingBalances: {},
    accounts: [],
    features: { calendar:true, tips:true, grocery:true, pets:true, upload:true, wedding:true, house:true, bills:true, networth:true, carfunds:true, maintenance:true, tax:true, retirement:true, career:true },
    // Fields that were previously missing from defaultState — included here so
    // backup/restore cycles always produce a fully-valid state object.
    maintenanceTasks: [],
    carFunds: [],
    taxData: {},
    retirementData: {},
    goalSplits: {},
    nonFoodKeywords: [],
    mealPlanDayOrder: null,
    mealPlanDates: {},
    weddingChecklist: [],
    recipes: [],
    careerData: {},
  };
}

function defaultCategories() {
  return [
    { id:'groceries',     name:'Groceries',          color:'#5a9e7a' },
    { id:'dining',        name:'Dining Out',          color:'#e07a9a' },
    { id:'gas',           name:'Gas & Transport',     color:'#d4a017' },
    { id:'phone',         name:'Phone & Internet',    color:'#9b7fbd' },
    { id:'fitness',       name:'Fitness',             color:'#5bb8f7' },
    { id:'insurance',     name:'Insurance',           color:'#c97d5a' },
    { id:'subscriptions', name:'Subscriptions',       color:'#a78bfa' },
    { id:'shopping',      name:'Shopping',            color:'#e8734a' },
    { id:'pets',          name:'Pets',                color:'#34d399' },
    { id:'entertainment', name:'Entertainment',       color:'#f472b6' },
    { id:'savings',       name:'Savings',             color:'#60a5fa' },
    { id:'transfer',      name:'Transfers',           color:'#94a3b8' },
    { id:'income',        name:'Income',              color:'#5a9e7a' },
    { id:'cannabis',      name:'Cannabis',            color:'#6ee7b7' },
    { id:'auto',          name:'Auto & Maintenance',  color:'#fbbf24' },
    { id:'charity',       name:'Charity',             color:'#60a5fa' },
    { id:'travel',        name:'Travel',              color:'#a78bfa' },
    { id:'health',        name:'Health & Dental',     color:'#34d399' },
    { id:'other',         name:'Other',               color:'#b8957a' },
    { id:'wedding',       name:'Wedding',            color:'#f9a8d4' },
    { id:'maintenance',   name:'Home Maintenance',   color:'#fb923c' },
  ];
}

function defaultBudgets() {
  return { groceries:600,dining:300,gas:300,phone:200,fitness:100,insurance:250,subscriptions:100,shopping:200,pets:150,entertainment:150,cannabis:100,auto:150,charity:50,travel:100,health:100,savings:500,other:200 };
}

function defaultCatRules() {
  return [
    // Groceries
    {match:'FOOD BASICS',cat:'groceries'},{match:'NO FRILLS',cat:'groceries'},
    {match:'METRO',cat:'groceries'},{match:'PC EXPRESS PASS',cat:'subscriptions'},
    {match:'PC EXPRESS',cat:'groceries'},{match:'COBS BREAD',cat:'groceries'},
    {match:'COUNTRY TRADI',cat:'groceries'},
    // Dining
    {match:'MCDONALDS',cat:'dining'},{match:"MCDONALD'S",cat:'dining'},
    {match:'SKIPTHEDISHES',cat:'dining'},{match:'RAXX BAR',cat:'dining'},
    {match:'THE BARRIEFIELD',cat:'dining'},{match:'HONEYBEAR',cat:'dining'},
    {match:"TANYA'S",cat:'dining'},{match:'THE ORCHID',cat:'dining'},
    // Auto
    {match:'DAVID GOUETT',cat:'auto'},{match:'MIDAS',cat:'auto'},
    // Gas
    {match:'PETRO-CANADA',cat:'gas'},{match:'MOHAWK DUTY',cat:'gas'},
    {match:'611 TRUCK STOP',cat:'gas'},
    // Phone
    {match:'TELUS',cat:'phone'},
    // Fitness
    {match:'GOODLIFE',cat:'fitness'},
    // Insurance
    {match:'ALLSTATE',cat:'insurance'},{match:'ELITE INSURANCE',cat:'insurance'},
    {match:'CANADIAN SECURI',cat:'insurance'},
    // Cannabis
    {match:'CALYX',cat:'cannabis'},
    // Entertainment
    {match:'LCBO',cat:'entertainment'},{match:'THE BEER STORE',cat:'entertainment'},
    {match:'GRAND THEAT',cat:'entertainment'},{match:'TICKETSCENE',cat:'entertainment'},
    {match:'OLG',cat:'entertainment'},{match:'UPPER CANADA',cat:'entertainment'},
    {match:'WHATNOT',cat:'entertainment'},
    // Shopping
    {match:'SVP SPORTS',cat:'shopping'},{match:'CANADIAN TIRE',cat:'shopping'},
    {match:'AMAZON',cat:'shopping'},{match:'AMZN',cat:'shopping'},
    {match:'SLPC',cat:'shopping'},{match:'CHARM DIAMOND',cat:'shopping'},
    // Pets
    {match:'M&R KAHLON',cat:'pets'},{match:'HAIR OF THE DOG',cat:'pets'},
    // Subscriptions
    {match:'KOHO',cat:'subscriptions'},{match:'SPOTIFY',cat:'subscriptions'},
    {match:'MICROSOFT*PC GAME PASS',cat:'subscriptions'},
    // Health
    {match:'INSURANCE RBC DENTAL',cat:'health'},
    // Charity
    {match:'CHEO',cat:'charity'},
    // Other
    {match:'MECP-FERRIS',cat:'other'},{match:'BROOM FACTO',cat:'other'},
    {match:'ATM WITHDRAWAL',cat:'other'},
    // NOTE: E-TRANSFER RECEIVED is NOT here — handled by isTransferDesc / isIncomeDesc
  ];
}

// Pre-loaded flyer data
let state = loadState();

// Initialize missing state keys on first load
(function() {
  if (!state.flyers) { state.flyers = []; saveState(); }
  if (!state.calEvents) { state.calEvents = []; saveState(); }
  if (!state.household) { state.household = { name:'', emoji:'🏠', province:'ON', city:'', setupComplete:false }; saveState(); }
  if (!state.members) { state.members = []; saveState(); }
  if (!state.children) { state.children = []; saveState(); }
  if (!state.lifestyle) { state.lifestyle = {}; saveState(); }
  if (!state.pets) {
    state.pets = [];
    saveState();
  }
  if (!state.gcalConfig) { state.gcalConfig = {}; saveState(); }
  if (!state.weatherLocations || !state.weatherLocations.length) {
    var city = state.household && state.household.city ? state.household.city : '';
    var prov = state.household && state.household.province ? state.household.province : 'ON';
    state.weatherLocations = city ? [{ city: city, province: prov }] : [];
    state.weatherLocationIndex = 0;
    saveState();
  }
  if (state.weatherLocationIndex === undefined) { state.weatherLocationIndex = 0; saveState(); }
  if (!state.petFeeding) { state.petFeeding = {}; saveState(); }
  if (!state.startingBalances) { state.startingBalances = {}; saveState(); }
  if (!state.accounts) { state.accounts = []; saveState(); }
  if (!state.wedding) { state.wedding = { budget: 0, date: '', venue: '', notes: '' }; saveState(); }
  if (!state.weddingVendors) { state.weddingVendors = []; saveState(); }
  if (!state.house) { state.house = { targetPrice:0, savedAmount:0, monthlyContribution:0, targetDate:'', notes:'', fhsa:{mattBalance:0,hollyBalance:0,mattYearStart:new Date().getFullYear(),hollyYearStart:new Date().getFullYear()}, hbp:{mattEligible:35000,hollyEligible:35000,mattUsed:0,hollyUsed:0} }; saveState(); }
  if (!state.bills) { state.bills = []; saveState(); }
  if (!state.netWorthHistory) { state.netWorthHistory = []; saveState(); }
  if (!state.manualAssets) { state.manualAssets = []; saveState(); }
  // Migrate existing pets to include medical fields
  var petsNeedSave = false;
  (state.pets||[]).forEach(function(pet) {
    if (!pet.vetVisits)    { pet.vetVisits = [];     petsNeedSave = true; }
    if (!pet.vaccinations) { pet.vaccinations = [];  petsNeedSave = true; }
    if (!pet.medications)  { pet.medications = [];   petsNeedSave = true; }
    if (pet.dob === undefined)    { pet.dob = '';    petsNeedSave = true; }
    if (pet.weight === undefined) { pet.weight = ''; petsNeedSave = true; }
  });
  if (petsNeedSave) saveState();
  if (!state.features) {
    // Auto-detect sensible defaults for existing setups
    state.features = {
      calendar: true,
      tips: !!(state.members||[]).find(function(m){return m.hasTips;}),
      grocery: true,
      pets: (state.pets||[]).length > 0,
      upload: true
    };
    saveState();
  }
  // Initialize petFeeding for all dynamic pets
  var today = new Date().toISOString().split('T')[0];
  (state.pets || []).forEach(function(pet) {
    if (!state.petFeeding[pet.id]) { state.petFeeding[pet.id] = { fed: false, time: null, date: null }; }
    if (state.petFeeding[pet.id].date !== today) { state.petFeeding[pet.id] = { fed: false, time: null, date: today }; }
  });
  saveState();

  // Ensure 'transfer' category exists (migrating from old state)
  if (!state.categories.find(function(c){return c.id==='transfer';})) {
    state.categories.push({ id:'transfer', name:'Transfers', color:'#94a3b8' });
    saveState();
  }
  // Rename old 'Savings & Transfers' category to just 'Savings'
  var savCat = state.categories.find(function(c){return c.id==='savings';});
  if (savCat && savCat.name === 'Savings & Transfers') { savCat.name = 'Savings'; saveState(); }

  // ── Init guards for fields missing from older saved-state versions ────────
  // These mirror what is now in defaultState() so restore/backup cycles work too.
  if (!state.maintenanceTasks)  { state.maintenanceTasks  = [];  saveState(); }
  if (!state.carFunds)          { state.carFunds          = [];  saveState(); }
  if (!state.weddingChecklist)  { state.weddingChecklist  = [];  saveState(); }
  if (!state.recipes)           { state.recipes           = [];  saveState(); }
  if (!state.taxData)           { state.taxData           = {};  saveState(); }
  if (!state.retirementData)    { state.retirementData    = {};  saveState(); }
  if (!state.goalSplits)        { state.goalSplits        = {};  saveState(); }
  if (!state.nonFoodKeywords)   { state.nonFoodKeywords   = [];  saveState(); }
  if (!state.mealPlanDayOrder)  { state.mealPlanDayOrder  = null; }
  if (!state.mealPlanDates)     { state.mealPlanDates     = {};  }
  if (!state.careerData)        { state.careerData        = {};  saveState(); }

  // Reclassify old transactions that were wrongly saved as 'savings' or 'income'
  // when they were actually transfers between accounts
  var changed = false;
  state.transactions.forEach(function(t) {
    var raw = t.rawDescription || t.description || '';
    if ((t.category === 'savings' || t.category === 'income') && isTransferDesc(raw)) {
      t.category = 'transfer'; changed = true;
    }
  });
  if (changed) saveState();
})();

// HELPERS
function fmt(n) { return '$' + Math.abs(n).toFixed(2); }
function fmtC(n) { return '$' + Math.abs(n).toLocaleString('en-CA', {minimumFractionDigits:0, maximumFractionDigits:0}); }
function fmtSigned(n) { return (n>=0?'+$':'-$') + Math.abs(n).toFixed(2); }
function getCatById(id) {
  if(id && id.startsWith('goal:')) {
    const goalId = id.slice(5);
    const g = state.goals.find(g=>g.id===goalId);
    if(g) return {name: g.emoji+' '+g.name, color:'#c97d5a', isGoal:true, goalId};
  }
  if(id && id.startsWith('car:')) {
    const carId = id.slice(4);
    const c = (state.carFunds||[]).find(function(x){return x.id===carId;});
    if(c) return {name:(c.emoji||'🚗')+' '+c.name, color:c.color||'#4f8ef7', isCar:true, carId};
  }
  return state.categories.find(c=>c.id===id) || {name:id,color:'#b8957a'};
}
function parseDate(s) { if (!s) return new Date(0); const p=s.split('/'); if(p.length===3) return new Date(p[2],p[0]-1,p[1]); return new Date(s); }
function getMonthKey(dateStr) { const d=parseDate(dateStr); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function getMonths() { return [...new Set(state.transactions.map(t=>getMonthKey(t.date)))].sort().reverse(); }
function getCurrentMonthKey() { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; }

// TRANSFER & INCOME DETECTION

// Returns true if the transaction is money moving between household members' own accounts.
// These must NEVER count as income or expenses — they are neutral transfers.
function isTransferDesc(desc) {
  const d = (desc || '').toUpperCase();
  // Internal RBC bank transfers
  if (/ONLINE TRANSFER TO DEPOSIT|ONLINE BANKING TRANSFER|BR TO BR/.test(d)) return true;
  // E-transfer sent to self
  if (/E-TRANSFER SENT ME\b/.test(d)) return true;
  // Household members sending to each other internally (not external income)
  // DMD savings account: member funding another member's savings
  // DMD loan/savings transfer out
  if (/TRANSFER OUT/.test(d)) return true;
  // DMD bank-generated fee/interest summary rows
  if (/SYSTEM GENERATED ENTRY/.test(d)) return true;
  // TFSA deposit — savings vehicle, not an expense
  if (/MISC PAYMENT TFSA/.test(d)) return true;
  // Credit card payment — paying off balance from chequing (not income on card)
  if (/^PAYMENT$/.test(d.trim())) return true;
  // Online bill pay routing
  if (/ONLINE BANKING PAYMENT/.test(d)) return true;
  return false;
}

// Returns true only for real external money coming in (actual earnings/benefits)
function isIncomeDesc(desc) {
  const d = (desc || '').toUpperCase();
  // Employment income
  if (/PAYROLL|STAFF\s*-\s*PAY|DIRECT DEP|SALARY|WAGES/.test(d)) return true;
  // Government benefits
  if (/EI BENEFIT|CPP|OAS|GST CANADA|HST CANADA|TRILLIUM/.test(d)) return true;
  // Known external e-transfer senders — internal household transfers are handled above
  if (/E-TRANSFER RECEIVED WOODBECK/.test(d)) return true;
  if (/E-TRANSFER RECEIVED VICTORIACORDEIRO/.test(d)) return true;
  if (/E-TRANSFER RECEIVED TAMARABORRELLO/.test(d)) return true;
  // Rewards / cashback from merchants
  if (/MISC PAYMENT OFFER/.test(d)) return true;
  return false;
}

function autoCategorize(desc) {
  const d = (desc || '').toUpperCase();
  // 1. Transfers first — never count as income or expense
  if (isTransferDesc(desc)) return 'transfer';
  // 2. User-defined rules
  for (const r of state.catRules) { if (d.includes(r.match.toUpperCase())) return r.cat; }
  // 3. Real income
  if (isIncomeDesc(desc)) return 'income';
  // 4. Groceries
  if (/FOOD BASIC|NO FRILLS|METRO|SOBEYS|LOBLAWS|WALMART GROCERY|SAVE ON|REAL CANADIAN|IGA|FARM BOY|FORTINOS|ZEHRS|FRESHCO|WHOLE FOOD|COSTCO|COBS BREAD|COUNTRY TRADI/.test(d)) return 'groceries';
  if (/PC EXPRESS/.test(d) && !/PC EXPRESS PASS/.test(d)) return 'groceries';
  // 5. Dining
  if (/MCDONALD|TIM HORTON|STARBUCKS|SUBWAY|TANYA|THE ORCHID|BARRIEFIELD|HONEYBEAR|RAXX BAR|SKIPTHEDISHES|SKIP THE DISH|DOORDASH|UBER EATS|PIZZA|RESTAURANT|BISTRO|CAFE|COFFEE|WENDY|BURGER KING|KFC|POPEYE|A&W|HARVEY|SWISS CHALET|BOSTON PIZZA|EAST SIDE|JACK ASTOR|THE KITCH|PITA|SUSHI|THAI|CHINESE/.test(d)) return 'dining';
  // 6. Gas
  if (/PETRO.CANADA|SHELL|ESSO|HUSKY|MOHAWK DUTY|MOHAWK|PIONEER|ULTRAMAR|611 TRUCK|GAS STATION|FUEL/.test(d)) return 'gas';
  // 7. Phone
  if (/TELUS|ROGERS|BELL |FIDO|VIRGIN MOBILE|KOODO|CHATR|WIND MOBILE|FREEDOM|PUBLIC MOBILE|SHAW|COGECO/.test(d)) return 'phone';
  // 8. Fitness
  if (/GOODLIFE|YMCA|GYM|FITNESS|PLANET FITNESS|ANYTIME FITNESS|CRUNCH|EQUINOX|CROSSFIT|YOGA|SPIN CLASS/.test(d)) return 'fitness';
  // 9. Insurance
  if (/ALLSTATE|INTACT|BELAIR|CO.OP INSURANCE|TD INSURANCE|RBC INSURANCE|AVIVA|COOPERATORS|INSURANCE RBC|CANADIAN SECURI|ELITE INSURANCE/.test(d)) return 'insurance';
  // 10. Subscriptions
  if (/NETFLIX|SPOTIFY|DISNEY|AMAZON PRIME|APPLE\.COM|GOOGLE PLAY|YOUTUBE|HULU|CRAVE|PARAMOUNT|KOHO|PC EXPRESS PASS|MICROSOFT.PC GAME PASS|MEMBERSHIP|SUBSCRIPTION/.test(d)) return 'subscriptions';
  // 11. Shopping
  if (/AMAZON|AMZN|CANADIAN TIRE|WALMART|WINNERS|HOMESENSE|MARSHALLS|THE BAY|HUDSON|IKEA|BEST BUY|STAPLES|DOLLARAMA|DOLLAR TREE|SVP SPORTS|SPORT CHEK|MEC|REITMANS|OLD NAVY|H&M|UNIQLO|ZARA|SLPC|CHARM DIAMOND/.test(d)) return 'shopping';
  // 12. Pets
  if (/PET SMART|PETCO|PETSMART|M&R KAHLON|HAIR OF THE DOG|GLOBAL PET|PET VALUE|PET SUPPLY|VET|VETERINAR|ANIMAL HOSP/.test(d)) return 'pets';
  // 13. Entertainment
  if (/LCBO|THE BEER STORE|LIQUOR|CINEMA|THEATRE|THEATER|TICKETMASTER|TICKETSCENE|EVENTBRITE|GRAND THEAT|OLG|CASINO|LOTTERY|UPPER CANADA|WHATNOT/.test(d)) return 'entertainment';
  // 14. Auto
  if (/DAVID GOUETT|MIDAS|JIFFY LUBE|MR LUBE|CARWASH|CAR WASH|MECHANIC|AUTO PART|WOODBECK|TRANSMISSION|TIRE|BRAKES/.test(d)) return 'auto';
  // 15. Cannabis
  if (/CALYX|TRICHOM|OCS|ONTARIO CANNABIS|CANNABIS|DISPENSARY|WEED|420|FIRE & FLOWER|CANNA/.test(d)) return 'cannabis';
  // 16. Health
  if (/PHARMACY|SHOPPERS DRUG|REXALL|LONDON DRUG|JEAN COUTU|UNIPRIX|DENTAL|VISION|OPTOM|HOSPITAL|CLINIC|DOCTOR|PHYSIO|CHIRO|MASSAGE|LAB WORK|MEDICAL/.test(d)) return 'health';
  // 17. Charity
  if (/CHEO|UNICEF|RED CROSS|SALVATION ARMY|FOOD BANK|DONATION|CHARITY/.test(d)) return 'charity';
  // 18. Travel
  if (/AIRBNB|EXPEDIA|BOOKING\.COM|HOTELS\.COM|AIR CANADA|WESTJET|PORTER|SUNWING|VIA RAIL|TRAVELODGE|HOLIDAY INN|MARRIOTT|HILTON/.test(d)) return 'travel';
  // 19. Bank fees / charges
  if (/INTEREST CHARGES|INTEREST CHARGE|NSF|OVERDRAFT|SERVICE FEE|BANK FEE|ATM WITHDRAWAL/.test(d)) return 'other';
  return 'other';
}

function cleanDesc(desc) {
  return (desc || '')
    .replace(/^(CONTACTLESS INTERAC PURCHASE|VISA DEBIT PURCHASE|INTERAC PURCHASE|VISA DEBIT CORRECTION|VISA DEBIT AUTHORIZATION EXPIRED|VISA DEBIT REVERSAL|VISA DEBIT REFUND)\s*-\s*\d+\s*/i, '')
    .replace(/\s+CA[A-Z0-9]{8}$/i, '')
    .trim();
}

// NAVIGATION
function showPage(id) {
  // Guard: redirect to dashboard if feature is disabled
  var featureMap = { calendar:'calendar', tips:'tips', grocery:'grocery', upload:'upload', career:'career' };
  if (featureMap[id] && !isFeatureOn(featureMap[id])) { id = 'dashboard'; }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  var pageEl = document.getElementById('page-'+id);
  if (pageEl) pageEl.classList.add('active');
  // Activate matching sidebar button by ID
  var activeBtn = document.getElementById('nav-'+id+'-btn');
  if (activeBtn) activeBtn.classList.add('active');
  // Update topbar title
  var PAGE_TITLES = { dashboard:'🏠 Home', calendar:'📅 Calendar', transactions:'📋 Transactions', budget:'💰 Budget', goals:'🎯 Goals', tips:'💵 Tips', grocery:'🛒 Grocery', upload:'📤 Upload', career:'💼 Career Planner' };
  var tbTitle = document.getElementById('topbar-title');
  if (tbTitle) {
    var tipsM = getTipsMember();
    if (id==='tips' && tipsM) { tbTitle.textContent = '💵 ' + tipsM.name + "'s Tips"; }
    else { tbTitle.textContent = PAGE_TITLES[id] || id; }
  }
  const renders = { dashboard:renderDashboard, calendar:renderCalendar, transactions:renderTransactions, budget:renderBudget, goals:renderGoals, wedding:renderWedding, house:renderHouse, pets:renderPetsPage, bills:renderBills, networth:renderNetWorth, cars:renderCarFunds, maintenance:renderMaintenance, tax:renderTax, retirement:renderRetirement, tips:renderTipsPage, grocery:renderGrocery, upload:renderStatements, career:renderCareer };
  if (renders[id]) renders[id]();
  // Auto-sync live calendar links when switching to Calendar tab
  if (id === 'calendar') {
    setTimeout(function() { autoSyncAllCalendars(true); }, 300);
  }
  // Close mobile sidebar after navigation
  closeMobileSidebar();
}

function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  if (!sb) return;
  sb.classList.toggle('collapsed');
  try { localStorage.setItem('hh_sidebar_collapsed', sb.classList.contains('collapsed') ? '1' : '0'); } catch(e){}
}

function openMobileSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.add('mobile-open');
  if (ov) ov.classList.add('mobile-open');
}

function closeMobileSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.remove('mobile-open');
  if (ov) ov.classList.remove('mobile-open');
}

function openModal(id) {
  if(id==='manual-txn-modal'){document.getElementById('m-date').value=today();populateCatSelect('m-category',true);}
  if(id==='cash-modal'){document.getElementById('cash-date').value=today();populateCatSelect('cash-cat',true);}
  if(id==='tips-modal'){populateTipsGoalDropdown();if(!document.getElementById('tips-edit-id').value){document.getElementById('tips-date').value=today();['tips-total-input','tips-amount','tips-goal-amt','tips-notes'].forEach(function(x){var el=document.getElementById(x);if(el)el.value='';});calcTips();}}
  if(id==='category-modal') renderCategoriesList();
  if(id==='budget-edit-modal') renderBudgetEditFields();
  if(id==='goal-modal'&&!document.getElementById('goal-edit-id').value) clearGoalForm();
  if(id==='event-modal'&&!document.getElementById('event-edit-id').value){document.getElementById('event-date').value=today();clearEventForm(true);}

  if(id==='diet-prefs-modal'){
    var p=state.dietPrefs||{};
    var getEl=function(i){return document.getElementById(i);};
    if(getEl('pref-avoid'))getEl('pref-avoid').value=p.avoid||'';
    if(getEl('pref-favourites'))getEl('pref-favourites').value=p.favourites||'';
    if(getEl('pref-notes'))getEl('pref-notes').value=p.notes||'';
    if(getEl('pref-complexity'))getEl('pref-complexity').value=p.complexity||'moderate';
    var savedStyle=p.dietStyle||['omnivore'];
    document.querySelectorAll('#pref-diet-chips input').forEach(function(cb){cb.checked=savedStyle.includes(cb.value);});
    var ratings=state.mealRatings||{};
    var rkeys=Object.keys(ratings);
    var sumEl=document.getElementById('pref-ratings-summary');
    var listEl=document.getElementById('pref-ratings-list');
    if(sumEl&&listEl){
      if(rkeys.length>0){
        sumEl.style.display='';
        listEl.innerHTML=rkeys.sort(function(a,b){return ratings[b]-ratings[a];}).map(function(k){
          var s='&#9733;'.repeat(ratings[k])+'&#9734;'.repeat(5-ratings[k]);
          return '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)"><span>'+k+'</span><span style="color:#f59e0b">'+s+'</span></div>';
        }).join('');
      } else { sumEl.style.display='none'; }
    }
  }
  if(id==='flipp-modal'){
    var postalEl=document.getElementById('flipp-postal-input');
    if(postalEl&&state.flippPostalCode)postalEl.value=state.flippPostalCode;
    document.getElementById('flipp-step-postal').style.display='';
    document.getElementById('flipp-step-select').style.display='none';
    document.getElementById('flipp-fetch-status').textContent='';
  }

  var el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) { var el = document.getElementById(id); if (el) el.classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');}));

function today() { return new Date().toISOString().split('T')[0]; }
function populateCatSelect(id, includeGoals) {
  const sel=document.getElementById(id);
  let opts = state.categories.filter(c=>c.id!=='income').map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  if(includeGoals && state.goals && state.goals.length) {
    opts += '<optgroup label="--- Savings Goals ---">' +
      state.goals.map(g=>`<option value="goal:${g.id}">${g.emoji} ${g.name}</option>`).join('') +
      '</optgroup>';
  }
  if(includeGoals && state.carFunds && state.carFunds.length) {
    opts += '<optgroup label="--- Car Funds ---">' +
      state.carFunds.map(function(c){return '<option value="car:'+c.id+'">'+(c.emoji||'🚗')+' '+c.name+'</option>';}).join('') +
      '</optgroup>';
  }
  sel.innerHTML=opts;
}
function clearGoalForm() {
  ['goal-name','goal-emoji','goal-target','goal-current','goal-date','goal-link','goal-notes'].forEach(id=>{document.getElementById(id).value='';});
  document.getElementById('goal-edit-id').value='';
}
function clearTipsForm() { document.getElementById('tips-edit-id').value=''; }
function clearEventForm(withDate) {
  ['event-title','event-start','event-end','event-notes'].forEach(id=>{document.getElementById(id).value='';});
  document.getElementById('event-edit-id').value='';
  if(withDate) document.getElementById('event-date').value=today();
}

// PET FEEDING TOGGLES
function renderPetToggles() {
  var today = new Date().toISOString().split('T')[0];
  var pets = state.pets || [];
  var container = document.getElementById('pet-toggles');
  if (!container) return;
  if (!pets.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">No pets configured — add them in ⚙️ Setup!</div>';
    return;
  }
  if (!state.petFeeding) state.petFeeding = {};
  pets.forEach(function(pet) {
    if (!state.petFeeding[pet.id]) state.petFeeding[pet.id] = { fed:false, time:null, date:null };
    if (state.petFeeding[pet.id].date !== today) state.petFeeding[pet.id] = { fed:false, time:null, date:today };
  });
  saveState();
  var typeLabels = { dog:'Good Dog', cat:'Cool Cat', other:'Good Pet' };
  var typeUnfed = { dog:'Hungry pup! 🐾', cat:'Meowing for food 🐟', other:'Waiting for food...' };
  container.innerHTML = pets.map(function(p) {
    var data = state.petFeeding[p.id] || {};
    var isFed = data.fed;
    var timeStr = isFed && data.time ? '🕒 Fed at ' + data.time : (typeUnfed[p.type] || 'Waiting...');
    var btnLabel = isFed ? '✔️ Fed!' : '🍽️ Feed ' + p.name;
    return '<div class="pet-card' + (isFed ? ' fed' : '') + '" onclick="togglePetFed(&#39;' + p.id + '&#39;,' + (!isFed) + ')" title="' + (isFed ? 'Undo feeding' : 'Mark as fed') + '">'
      + '<div class="pet-card-emoji">' + p.emoji + '</div>'
      + '<div class="pet-card-name">' + p.name + '</div>'
      + '<div class="pet-card-label">' + (typeLabels[p.type] || 'Pet') + '</div>'
      + '<div class="pet-card-btn">' + btnLabel + '</div>'
      + '<div class="pet-card-timestamp">' + timeStr + '</div>'
      + '</div>';
  }).join('');
}

function togglePetFed(petKey, isFed) {
  var today = new Date().toISOString().split('T')[0];
  var now = new Date();
  var timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  if (!state.petFeeding) state.petFeeding = {};
  state.petFeeding[petKey] = { fed: isFed, time: isFed ? timeStr : null, date: today };
  saveState();
  renderPetToggles();
}

// WEATHER WIDGET
var weatherCache = {}; // { 'Kingston,ON': { data, fetchedAt } }
var weatherRefreshTimer = null;

function getWeatherIcon(code, isDay) {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code <= 2) return isDay ? '⛅' : '🌙';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌧️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 86) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌤️';
}
function getWeatherDesc(code) {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 55) return 'Drizzle';
  if (code <= 57) return 'Freezing drizzle';
  if (code <= 65) return 'Rain';
  if (code <= 67) return 'Freezing rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}
function getWeatherClass(code) {
  if (code === 0 || code <= 2) return '';
  if (code === 3 || code <= 48) return 'cloudy';
  if (code <= 77) return 'rainy';
  if (code <= 86) return 'snowy';
  if (code <= 99) return 'rainy';
  return '';
}

async function fetchWeatherForLocation(city, province) {
  var cacheKey = city + ',' + province;
  var cached = weatherCache[cacheKey];
  // Use cache if less than 30 minutes old
  if (cached && (Date.now() - cached.fetchedAt) < 30 * 60 * 1000) return cached.data;

  // Geocode using Open-Meteo geocoding API (free, no key)
  var geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=5&language=en&format=json&countryCode=CA';
  var geoResp = await fetch(geoUrl);
  var geoData = await geoResp.json();
  if (!geoData.results || !geoData.results.length) throw new Error('City not found: ' + city);
  // Pick best match (prefer province match)
  var result = geoData.results.find(function(r){ return r.admin1 && r.admin1.includes(province === 'ON' ? 'Ontario' : province); }) || geoData.results[0];
  var lat = result.latitude, lon = result.longitude;

  // Fetch weather from Open-Meteo (free, no key)
  var wUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
    + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day'
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code'
    + '&timezone=America%2FToronto&forecast_days=3&temperature_unit=celsius&wind_speed_unit=kmh';
  var wResp = await fetch(wUrl);
  var wData = await wResp.json();

  var weatherResult = {
    city: city, province: province,
    temp: Math.round(wData.current.temperature_2m),
    humidity: wData.current.relative_humidity_2m,
    wind: Math.round(wData.current.wind_speed_10m),
    code: wData.current.weather_code,
    isDay: wData.current.is_day,
    desc: getWeatherDesc(wData.current.weather_code),
    icon: getWeatherIcon(wData.current.weather_code, wData.current.is_day),
    forecast: (wData.daily.time || []).slice(0, 3).map(function(date, i) {
      return {
        date: date,
        hi: Math.round(wData.daily.temperature_2m_max[i]),
        lo: Math.round(wData.daily.temperature_2m_min[i]),
        code: wData.daily.weather_code[i],
        icon: getWeatherIcon(wData.daily.weather_code[i], 1),
      };
    }),
  };
  weatherCache[cacheKey] = { data: weatherResult, fetchedAt: Date.now() };
  return weatherResult;
}

async function renderWeatherWidget() {
  var wrap = document.getElementById('weather-card-wrap');
  if (!wrap) return;
  if (!state.weatherLocations || !state.weatherLocations.length) {
    state.weatherLocations = [{ city: 'Kingston', province: 'ON' }];
    state.weatherLocationIndex = 0;
    saveState();
  }
  var idx = state.weatherLocationIndex || 0;
  if (idx >= state.weatherLocations.length) idx = 0;
  var loc = state.weatherLocations[idx];

  wrap.innerHTML = '<div class="weather-widget"><div class="weather-loading">&#x1F324;&#xFE0F; Loading weather...</div></div>';

  try {
    var w = await fetchWeatherForLocation(loc.city, loc.province);
    var cls = getWeatherClass(w.code);
    var locLabels = state.weatherLocations.map(function(l, i) {
      return '<span onclick="switchWeatherLocation(' + i + ')" style="cursor:pointer;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:' + (i === idx ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)') + ';transition:background 0.2s">' + l.city + '</span>';
    }).join('');
    var forecastHtml = w.forecast.map(function(f, i) {
      var label = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : new Date(f.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short' });
      return '<div style="text-align:center;flex:1">'
        + '<div style="font-size:10px;opacity:0.7;margin-bottom:2px">' + label + '</div>'
        + '<div style="font-size:16px">' + f.icon + '</div>'
        + '<div style="font-size:11px;font-weight:700">' + f.hi + '°</div>'
        + '<div style="font-size:10px;opacity:0.65">' + f.lo + '°</div>'
        + '</div>';
    }).join('');
    wrap.innerHTML = '<div class="weather-widget ' + cls + '">'
      + '<div class="weather-loc-row">'
      + '<div style="display:flex;gap:5px;flex-wrap:wrap">' + locLabels + '</div>'
      + '<button class="weather-loc-btn" onclick="openModal(\'weather-locations-modal\');renderWeatherLocationsList()">&#9881; Manage</button>'
      + '</div>'
      + '<div class="weather-main">'
      + '<div>'
      + '<div class="weather-temp">' + w.temp + '°C</div>'
      + '<div class="weather-desc">' + w.desc + '</div>'
      + '<div class="weather-details">'
      + '<span class="weather-detail">&#128167; ' + w.humidity + '%</span>'
      + '<span class="weather-detail">&#128168; ' + w.wind + ' km/h</span>'
      + '</div>'
      + '</div>'
      + '<div class="weather-icon">' + w.icon + '</div>'
      + '</div>'
      + '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:12px 0 10px">'
      + '<div style="display:flex;gap:8px">' + forecastHtml + '</div>'
      + '</div>';
  } catch(e) {
    var isNetworkBlock = !e.message || e.message.includes('fetch') || e.message.includes('Failed') || e.message.includes('network');
    var errMsg = isNetworkBlock
      ? "Live weather isn't available in this environment — open the app directly in your browser for forecasts."
      : 'Could not load weather for ' + loc.city + '. ' + e.message;
    wrap.innerHTML = '<div class="card" style="margin-bottom:0;padding:16px 20px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      + '<div class="card-title" style="margin:0">🌤️ Weather — ' + loc.city + ', ' + loc.province + '</div>'
      + '<button class="btn btn-ghost btn-sm" onclick="openModal(\'weather-locations-modal\');renderWeatherLocationsList()">⚙️ Locations</button>'
      + '</div>'
      + '<div style="color:var(--muted);font-size:12px;line-height:1.5">' + errMsg + '</div>'
      + '</div>';
  }
}

function switchWeatherLocation(idx) {
  state.weatherLocationIndex = idx;
  saveState();
  renderWeatherWidget();
}

function addWeatherLocation() {
  var city = document.getElementById('weather-city-input').value.trim();
  var prov = document.getElementById('weather-prov-input').value;
  if (!city) return hhAlert('Please enter a city name.', '🌆');
  if (!state.weatherLocations) state.weatherLocations = [];
  var exists = state.weatherLocations.find(function(l){ return l.city.toLowerCase() === city.toLowerCase() && l.province === prov; });
  if (exists) return hhAlert('That location is already in your list.', 'ℹ️');
  state.weatherLocations.push({ city: city, province: prov });
  saveState();
  document.getElementById('weather-city-input').value = '';
  renderWeatherLocationsList();
  renderWeatherWidget();
}

function removeWeatherLocation(idx) {
  state.weatherLocations.splice(idx, 1);
  if (state.weatherLocationIndex >= state.weatherLocations.length) state.weatherLocationIndex = 0;
  saveState();
  renderWeatherLocationsList();
  renderWeatherWidget();
}

function renderWeatherLocationsList() {
  var list = document.getElementById('weather-locations-list');
  if (!list) return;
  if (!state.weatherLocations || !state.weatherLocations.length) {
    list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:12px">No locations added yet.</div>';
    return;
  }
  list.innerHTML = state.weatherLocations.map(function(loc, i) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">'
      + '<span style="font-size:16px">&#x1F4CD;</span>'
      + '<span class="fill" style="font-size:13px;font-weight:600">' + loc.city + ', ' + loc.province + '</span>'
      + (i === (state.weatherLocationIndex||0) ? '<span style="font-size:11px;color:var(--green);font-weight:700">Current</span>' : '<button class="btn btn-ghost btn-sm" onclick="switchWeatherLocation(' + i + ');renderWeatherLocationsList()">Set Active</button>')
      + '<button class="btn btn-danger btn-sm" onclick="removeWeatherLocation(' + i + ')">&#x1F5D1;</button>'
      + '</div>';
  }).join('');
}

function getMemberColor(name) {
  if (!name || name === 'Joint') return 'var(--yellow)';
  var m = (state.members || []).find(function(m){ return m.name === name; });
  return m ? m.color : 'var(--accent)';
}
function getMemberById(id) {
  return (state.members || []).find(function(m){ return m.id === id; }) || null;
}
function getMemberByName(name) {
  return (state.members || []).find(function(m){ return m.name === name; }) || null;
}
function getTipsMember() {
  return (state.members || []).find(function(m){ return m.hasTips; }) || null;
}
function pIcon(p) {
  if (!p || p === 'Joint') return '&#x1F49B;';
  var m = getMemberByName(p);
  if (m) { return '<span style="color:' + m.color + '">&#9679;</span>'; }
  return '&#x1F49B;';
}
function populatePersonSelects() {
  var members = state.members || [];
  var children = (state.children || []);
  var allPeople = members.concat(children);
  var opts = allPeople.map(function(m){ return '<option value="' + m.name + '">' + m.name + '</option>'; }).join('');
  var optsAdultsOnly = members.map(function(m){ return '<option value="' + m.name + '">' + m.name + '</option>'; }).join('');
  var optsJoint = opts + '<option value="Joint">Joint / Both</option>';
  var ids = ['m-person','edit-person','event-person'];
  ids.forEach(function(id){ var el=document.getElementById(id); if(el) el.innerHTML=optsJoint; });
  var cashEl = document.getElementById('cash-person');
  if (cashEl) cashEl.innerHTML = opts;
  var upEl = document.getElementById('upload-person');
  if (upEl) upEl.innerHTML = '<option value="Joint">Joint / Both</option>' + optsAdultsOnly;
  var txnEl = document.getElementById('txn-person');
  if (txnEl) txnEl.innerHTML = '<option value="">All</option>' + opts;
  // Tips nav button
  var tipsMember = getTipsMember();
  var tipsBtn = document.getElementById('nav-tips-btn');
  if (tipsBtn) {
    if (tipsMember && isFeatureOn('tips')) {
      tipsBtn.style.display = '';
      var tipsLabelEl = document.getElementById('nav-tips-label');
      if (tipsLabelEl) tipsLabelEl.textContent = tipsMember.name + "'s Tips";
    } else {
      tipsBtn.style.display = 'none';
    }
  }
  // Tips page title
  var tipsTitleEl = document.getElementById('tips-page-title');
  if (tipsTitleEl) tipsTitleEl.textContent = tipsMember ? tipsMember.name + "'s Cash Tips" : 'Cash Tips';
  var budgetTipsTitle = document.getElementById('budget-tips-title');
  if (budgetTipsTitle) budgetTipsTitle.textContent = tipsMember ? '💰 ' + tipsMember.name + "'s Tips This Month" : '💰 Tips This Month';
}
// ── REMINDERS SYSTEM ─────────────────────────────────────────────────────────
// Collects reminders from all feature areas, prioritises by urgency, and renders
// into the #dash-reminders card. Call renderReminders() to refresh at any time.

function buildReminders() {
  var reminders = [];
  var now = new Date(); now.setHours(0,0,0,0);
  var mk = getCurrentMonthKey();
  var dayOfMonth = new Date().getDate();
  var tipsMember = getTipsMember();

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr + 'T00:00:00');
    return Math.ceil((d - now) / 86400000);
  }

  // ── BILLS ─────────────────────────────────────────────────────────────────
  if (isFeatureOn('bills')) {
    (state.bills || []).forEach(function(b) {
      var d = b.nextDue ? new Date(b.nextDue + 'T00:00:00') : null;
      if (!d) return;
      var days = Math.ceil((d - now) / 86400000);
      if (days < 0) {
        reminders.push({ urgency:'urgent', icon:'🧾', days:days,
          text: '<strong>' + b.name + '</strong> is <strong>overdue</strong> by ' + Math.abs(days) + ' day' + (Math.abs(days)===1?'':'s') + ' — ' + fmt(b.amount||0),
          action: "showPage('bills')" });
      } else if (days <= 7) {
        reminders.push({ urgency:'warning', icon:'🧾', days:days,
          text: '<strong>' + b.name + '</strong> due in <strong>' + days + ' day' + (days===1?'':'s') + '</strong> — ' + fmt(b.amount||0),
          action: "showPage('bills')" });
      }
    });
  }

  // ── MAINTENANCE ───────────────────────────────────────────────────────────
  if (isFeatureOn('maintenance')) {
    (state.maintenanceTasks || []).forEach(function(t) {
      var days = getMaintenanceDaysUntil(t);
      if (days < 0) {
        reminders.push({ urgency:'urgent', icon: t.emoji||'🔧', days:days,
          text: '<strong>' + t.name + '</strong> is <strong>overdue</strong> by ' + Math.abs(days) + ' day' + (Math.abs(days)===1?'':'s'),
          action: "showPage('maintenance')" });
      } else if (days <= 7) {
        reminders.push({ urgency:'warning', icon: t.emoji||'🔧', days:days,
          text: '<strong>' + t.name + '</strong> due in <strong>' + (days===0?'today':days+' day'+(days===1?'':'s')) + '</strong>',
          action: "showPage('maintenance')" });
      }
    });
  }

  // ── PET CARE — vet/vaccine/medication alerts ───────────────────────────────
  if (isFeatureOn('pets')) {
    getPetAlerts().forEach(function(a) {
      var urg = a.days < 0 ? 'urgent' : a.days <= 7 ? 'warning' : 'info';
      var typeLabel = a.type === 'vaccine' ? '💉 Vaccine' : '💊 Medication';
      var whenLabel = a.days < 0 ? 'OVERDUE by ' + Math.abs(a.days) + 'd' : a.days === 0 ? 'due today' : 'due in ' + a.days + ' day' + (a.days===1?'':'s');
      reminders.push({ urgency:urg, icon:a.emoji, days:a.days,
        text: '<strong>' + a.pet + '</strong> — ' + typeLabel + ': ' + a.name + ' <strong>' + whenLabel + '</strong>',
        action: "showPage('pets')" });
    });
  }

  // ── WEDDING — deposit alerts ───────────────────────────────────────────────
  if (isFeatureOn('wedding')) {
    var today2 = now;
    (state.weddingVendors || []).forEach(function(v) {
      if (v.paid || !v.depositDue) return;
      var days = daysUntil(v.depositDue);
      if (days === null) return;
      if (days < 0) {
        reminders.push({ urgency:'urgent', icon:'💍', days:days,
          text: '<strong>' + v.name + '</strong> deposit of ' + fmt(v.depositAmount||0) + ' is <strong>overdue</strong>',
          action: "showPage('wedding')" });
      } else if (days <= 30) {
        var urg = days <= 7 ? 'urgent' : 'warning';
        reminders.push({ urgency:urg, icon:'💍', days:days,
          text: '<strong>' + v.name + '</strong> deposit of ' + fmt(v.depositAmount||0) + ' due in <strong>' + days + ' day' + (days===1?'':'s') + '</strong>',
          action: "showPage('wedding')" });
      }
    });
    // Wedding countdown nudge if date is set and within 90 days
    if ((state.wedding||{}).date) {
      var wDays = daysUntil(state.wedding.date);
      if (wDays !== null && wDays > 0 && wDays <= 90) {
        reminders.push({ urgency:'info', icon:'💐', days:wDays,
          text: '<strong>' + wDays + ' days</strong> until the wedding! 🎉',
          action: "showPage('wedding')" });
      }
    }
  }

  // ── TIPS — CRA reserve ────────────────────────────────────────────────────
  if (isFeatureOn('tips') && tipsMember) {
    var tipsThisMonth = getTipsForMonth(mk);
    if (tipsThisMonth > 0) {
      var reserve = getTipsDepositForMonth(mk) * 0.25;
      reminders.push({ urgency:'warning', icon:'🇨🇦', days:99,
        text: tipsMember.name + ' earned <strong>' + fmt(tipsThisMonth) + '</strong> in tips this month — set aside <strong>' + fmt(reserve) + '</strong> for CRA',
        action: "showPage('tips')" });
    }
    // CRA instalment months: March, June, September, December (due 15th)
    var instalMonths = [2, 5, 8, 11]; // 0-indexed
    var curMonth = new Date().getMonth();
    var curDay   = new Date().getDate();
    if (instalMonths.indexOf(curMonth) >= 0) {
      var daysToInstalment = 15 - curDay;
      if (daysToInstalment >= 0 && daysToInstalment <= 14) {
        var urg2 = daysToInstalment <= 3 ? 'urgent' : 'warning';
        reminders.push({ urgency:urg2, icon:'🏛️', days:daysToInstalment,
          text: 'CRA tax instalment due <strong>' + (daysToInstalment === 0 ? 'today' : 'in ' + daysToInstalment + ' day' + (daysToInstalment===1?'':'s')) + '</strong> (Mar/Jun/Sep/Dec 15)',
          action: "showPage('tax')" });
      }
    }
  }

  // ── TAX — RRSP deadline (Jan 1 – Mar 1) ──────────────────────────────────
  if (isFeatureOn('tax')) {
    var curYear = new Date().getFullYear();
    var rrspDeadline = new Date(curYear + '-03-01T00:00:00');
    var rrspDays = Math.ceil((rrspDeadline - now) / 86400000);
    if (rrspDays >= 0 && rrspDays <= 60) {
      var urg3 = rrspDays <= 7 ? 'urgent' : 'warning';
      reminders.push({ urgency:urg3, icon:'📊', days:rrspDays,
        text: 'RRSP contribution deadline in <strong>' + (rrspDays === 0 ? 'today!' : rrspDays + ' day' + (rrspDays===1?'':'s')) + '</strong> (Mar 1, ' + curYear + ')',
        action: "showPage('tax')" });
    }
    // Tax filing deadline (Apr 30)
    var fileDeadline = new Date(curYear + '-04-30T00:00:00');
    var fileDays = Math.ceil((fileDeadline - now) / 86400000);
    if (fileDays >= 0 && fileDays <= 30) {
      var urg4 = fileDays <= 7 ? 'urgent' : 'warning';
      reminders.push({ urgency:urg4, icon:'🧾', days:fileDays,
        text: 'Tax filing deadline in <strong>' + (fileDays === 0 ? 'today!' : fileDays + ' day' + (fileDays===1?'':'s')) + '</strong> (Apr 30)',
        action: "showPage('tax')" });
    }
  }

  // ── NET WORTH — snapshot nudge ────────────────────────────────────────────
  if (isFeatureOn('networth')) {
    var snaps = state.netWorthHistory || [];
    var hasThisMonth = snaps.some(function(s){ return s.date === mk; });
    if (!hasThisMonth) {
      reminders.push({ urgency:'info', icon:'📈', days:999,
        text: 'No net worth snapshot this month yet — <strong>take one now</strong> to track your progress',
        action: "showPage('networth')" });
    }
  }

  // ── GOALS — closest milestone ──────────────────────────────────────────────
  if ((state.goals||[]).length) {
    // Find goal closest to a round milestone (25/50/75/100%)
    var bestGoal = null, bestMsg = '';
    (state.goals||[]).forEach(function(g) {
      var saved = g.current + getGoalContributions(g.id);
      var pct = g.target > 0 ? Math.round(saved / g.target * 100) : 0;
      var milestones = [25, 50, 75, 90, 100];
      milestones.forEach(function(m) {
        if (pct >= m && pct < m + 5) {
          if (!bestGoal) {
            bestGoal = g;
            bestMsg = g.emoji + ' <strong>' + g.name + '</strong> is at <strong>' + pct + '%</strong> — ' + (pct >= 100 ? '🎉 Goal reached!' : fmt(Math.max(0, g.target - saved)) + ' to go');
          }
        }
      });
    });
    if (bestGoal) {
      reminders.push({ urgency:'info', icon:'🎯', days:998,
        text: bestMsg,
        action: "showPage('goals')" });
    }
  } else {
    reminders.push({ urgency:'info', icon:'✨', days:999,
      text: 'Set up your savings goals in the Goals tab to track your progress',
      action: "showPage('goals')" });
  }

  // ── CAR FUNDS — close to target ────────────────────────────────────────────
  if (isFeatureOn('carfunds')) {
    (state.carFunds || []).forEach(function(c) {
      var saved = (c.savedAmount||0) + getCarFundContributions(c.id);
      var target = c.financing ? (c.downPayment||0) : (c.targetPrice||0);
      if (!target || !c.monthlyContrib) return;
      var remaining = Math.max(0, target - saved);
      var months = remaining > 0 ? Math.ceil(remaining / c.monthlyContrib) : 0;
      if (months > 0 && months <= 3) {
        reminders.push({ urgency:'info', icon: c.emoji||'🚗', days:months * 30,
          text: (c.emoji||'🚗') + ' <strong>' + c.name + '</strong> down payment goal is only <strong>~' + months + ' month' + (months===1?'':'s') + ' away</strong>!',
          action: "showPage('cars')" });
      } else if (months === 0) {
        reminders.push({ urgency:'info', icon: c.emoji||'🚗', days:0,
          text: (c.emoji||'🚗') + ' <strong>' + c.name + '</strong> — down payment target reached! 🎉',
          action: "showPage('cars')" });
      }
    });
  }

  // ── SALARY — payroll check ─────────────────────────────────────────────────
  if (dayOfMonth <= 5) {
    (state.members || []).filter(function(m){ return m.incomeType === 'salary'; }).forEach(function(m) {
      reminders.push({ urgency:'info', icon:'🏦', days:999,
        text: m.name + "'s payroll period — check for your deposit",
        action: "showPage('transactions')" });
    });
  }

  // ── PET FEEDING — daily nudge ──────────────────────────────────────────────
  if (isFeatureOn('pets') && (state.pets||[]).length > 0) {
    var today3 = new Date().toISOString().split('T')[0];
    var unfedPets = (state.pets||[]).filter(function(p) {
      var fd = state.petFeeding && state.petFeeding[p.id];
      return !fd || !fd.fed || fd.date !== today3;
    });
    if (unfedPets.length > 0) {
      reminders.push({ urgency:'info', icon:'🐾', days:999,
        text: 'Don\'t forget to feed <strong>' + unfedPets.map(function(p){ return p.name; }).join(' & ') + '</strong> today!',
        action: '' });
    }
  }

  // ── HOUSE — savings milestone ─────────────────────────────────────────────
  if (isFeatureOn('house') && (state.house||{}).targetPrice) {
    var h = state.house;
    var saved2 = (h.savedAmount||0) + (h.linkedGoalId ? getGoalContributions(h.linkedGoalId) : 0);
    var milestoneAmounts = [h.targetPrice * 0.05, h.targetPrice * 0.10, h.targetPrice * 0.20];
    var milestoneLabels  = ['5% minimum down payment', '10% down payment', '20% down — no CMHC!'];
    for (var mi = 0; mi < milestoneAmounts.length; mi++) {
      var pct2 = saved2 / milestoneAmounts[mi] * 100;
      if (pct2 >= 95 && pct2 < 105) {
        reminders.push({ urgency:'info', icon:'🏡', days:997,
          text: 'House savings approaching the <strong>' + milestoneLabels[mi] + '</strong> milestone — ' + fmt(saved2) + ' saved!',
          action: "showPage('house')" });
        break;
      }
    }
  }

  // ── PANTRY STAPLES — restock alert when stock hits zero ──────────────────
  if (isFeatureOn('grocery')) {
    var emptyStaples = (state.pantry||[]).filter(function(p){ return p.isStaple && (p.stock||0) === 0; });
    if (emptyStaples.length === 1) {
      reminders.push({ urgency:'warning', icon:'⭐', days:998,
        text: '⭐ Staple out of stock: <strong>' + emptyStaples[0].name + '</strong> — add it to your shopping list',
        action: "showPage('grocery')" });
    } else if (emptyStaples.length > 1) {
      reminders.push({ urgency:'warning', icon:'⭐', days:998,
        text: '⭐ <strong>' + emptyStaples.length + ' staples</strong> are out of stock: ' +
          emptyStaples.map(function(p){ return p.name; }).join(', '),
        action: "showPage('grocery')" });
    }
  }

  // ── SORT: urgent → warning → info, then by days asc within each tier ──────
  var order = { urgent:0, warning:1, info:2 };
  reminders.sort(function(a, b) {
    var od = order[a.urgency] - order[b.urgency];
    if (od !== 0) return od;
    return (a.days||999) - (b.days||999);
  });

  return reminders;
}

function renderReminders(showAll) {
  var container = document.getElementById('dash-reminders');
  var moreBtn   = document.getElementById('dash-reminders-more');
  if (!container) return;

  var all = buildReminders();
  var MAX_DEFAULT = 6;
  var visible = (showAll || all.length <= MAX_DEFAULT) ? all : all.slice(0, MAX_DEFAULT);

  var urgencyStyle = {
    urgent:  'border-left:3px solid var(--red);background:color-mix(in srgb,var(--red) 6%,transparent);border-radius:8px;padding:8px 10px;margin-bottom:6px',
    warning: 'border-left:3px solid var(--yellow);background:color-mix(in srgb,var(--yellow) 6%,transparent);border-radius:8px;padding:8px 10px;margin-bottom:6px',
    info:    'border-left:3px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px'
  };
  var urgencyDot = { urgent:'🔴', warning:'🟡', info:'' };

  if (!all.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">All caught up — nothing needs attention right now! ✅</div>';
    if (moreBtn) moreBtn.style.display = 'none';
    return;
  }

  container.innerHTML = visible.map(function(r) {
    var dot = urgencyDot[r.urgency] || '';
    var clickAttr = r.action ? ' onclick="' + r.action + '" style="cursor:pointer"' : '';
    return '<div class="quick-stat"' + clickAttr + ' style="' + (urgencyStyle[r.urgency]||urgencyStyle.info) + '">'
      + '<div class="quick-icon" style="font-size:16px">' + (dot||r.icon) + '</div>'
      + '<div class="fill"><div style="font-size:12px;line-height:1.5">' + r.text + '</div></div>'
      + (r.action ? '<div style="color:var(--muted);font-size:10px;flex-shrink:0">→</div>' : '')
      + '</div>';
  }).join('');

  if (moreBtn) {
    if (!showAll && all.length > MAX_DEFAULT) {
      moreBtn.style.display = '';
      moreBtn.innerHTML = '<button class="btn btn-ghost btn-sm" onclick="renderReminders(true)" style="font-size:11px;width:100%">Show ' + (all.length - MAX_DEFAULT) + ' more reminder' + (all.length - MAX_DEFAULT === 1 ? '' : 's') + ' ▼</button>';
    } else {
      moreBtn.style.display = 'none';
    }
  }
}

