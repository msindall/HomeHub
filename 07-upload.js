// Version constant — replaced at build time by build.py
var HH_VERSION = '6.28';

function renderStatements(){
  renderAccountsList();
  const container=document.getElementById('statements-list');
  if(!state.statements.length){container.innerHTML='<div class="empty-sm">No statements uploaded yet.</div>';return;}
  container.innerHTML=`<table><thead><tr><th>File</th><th>Person</th><th>Account</th><th>Date</th><th>Transactions</th><th>Actions</th></tr></thead><tbody>${state.statements.map(s=>`<tr><td>${s.name}</td><td><span class="badge badge-accent">${s.person}</span></td><td>${s.account}</td><td>${s.date}</td><td>${s.count}</td><td><button class="btn btn-danger btn-sm" onclick="removeStatement('${s.id}')">Remove</button></td></tr>`).join('')}</tbody></table>`;
}
function removeStatement(id){
  hhConfirm('Remove this statement and all its transactions?','🗑️','Remove Statement').then(function(ok){
    if(!ok)return;
    state.transactions=state.transactions.filter(t=>t.statementId!==id);
    state.statements=state.statements.filter(s=>s.id!==id);saveState();renderStatements();
  });
}

// STATEMENT SCANNING (CSV + PDF)

// Normalize any bank date format to M/D/YYYY for internal storage
function normDate(raw) {
  if (!raw) return '';
  raw = raw.trim();
  const MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  // Already M/D/YYYY or MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return raw;
  // YYYY-MM-DD — TD / Amex credit card format
  var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return parseInt(iso[2]) + '/' + parseInt(iso[3]) + '/' + iso[1];
  // Mon-DD-YYYY — DMD savings account format (e.g. Feb-28-2026) ← CRITICAL
  var monDDYYYY = raw.match(/^([A-Za-z]{3})-(\d{1,2})-(\d{4})$/);
  if (monDDYYYY) { var m0 = MONTHS[monDDYYYY[1].toLowerCase()]; if (m0) return m0 + '/' + parseInt(monDDYYYY[2]) + '/' + monDDYYYY[3]; }
  // DD-Mon-YYYY (e.g. 15-Jan-2025)
  var ddMon = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (ddMon) { var m1 = MONTHS[ddMon[2].toLowerCase()]; if (m1) return m1 + '/' + parseInt(ddMon[1]) + '/' + ddMon[3]; }
  // Named month: January 15, 2025 or Jan 15 2025
  var named = raw.match(/([A-Za-z]+)\s+(\d{1,2})[,\s]+(\d{4})/);
  if (named) { var m2 = MONTHS[named[1].slice(0,3).toLowerCase()]; if (m2) return m2 + '/' + parseInt(named[2]) + '/' + named[3]; }
  // DD/MM/YYYY — day > 12 means it can't be month
  var dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy && parseInt(dmy[1]) > 12) return parseInt(dmy[2]) + '/' + parseInt(dmy[1]) + '/' + dmy[3];
  return raw; // fallback — store as-is
}

// Convert any stored date format to YYYY-MM-DD for reliable string comparison
function toISO(raw) {
  if (!raw) return '';
  raw = raw.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // M/D/YYYY or MM/DD/YYYY
  var mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return mdy[3] + '-' + mdy[1].padStart(2,'0') + '-' + mdy[2].padStart(2,'0');
  // Try normDate first then recurse once
  var normed = normDate(raw);
  if (normed !== raw) return toISO(normed);
  return raw;
}

// Parse CSV statement — handles RBC Chequing, TD/Amex Credit Card, DMD Savings, BMO Chequing, and generic formats
// Returns { txns, openingBalance }
function parseCSVStatement(text) {
  // Strip BOM and normalize line endings
  text = text.replace(/^\uFEFF/, '');
  var allLines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');

  // ── Canadian Tire Mastercard detection ──
  // Format: line 0 = "MY ACCOUNT TRANSACTIONS", lines 1-2 = metadata, line 3 = real headers
  // REF,TRANSACTION DATE,POSTED DATE,TYPE,DESCRIPTION,Category,AMOUNT
  if (/my account transactions/i.test(allLines[0]||'')) {
    return parseCTMastercardStatement(allLines);
  }

  // ── BMO detection: file starts with a metadata timestamp line ──
  // e.g. "Following data is valid as of 20260306183627 ..."
  var isBMO = /following data is valid as of/i.test(allLines[0]||'');
  if (isBMO) {
    return parseBMOStatement(allLines);
  }

  var lines = allLines.filter(function(l){return l.trim();});
  if (lines.length < 2) return { txns: [], openingBalance: null };

  function parseLine(line) {
    var fields = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
      else if (c===',' && !inQ) { fields.push(cur.trim()); cur=''; }
      else cur+=c;
    }
    fields.push(cur.trim());
    return fields;
  }
  function cleanField(v) { return v.replace(/^"+|"+$/g,'').trim(); }
  function toAmt(v) { return parseFloat((v||'').replace(/[\$,\s]/g,''))||0; }

  var headers = parseLine(lines[0]).map(cleanField);

  // Format detection by header signature
  var isRBC = headers.includes('CAD$');
  var isTD  = (headers.includes('Card No.') || headers.includes('Card No')) &&
               headers.includes('Debit') && headers.includes('Credit');
  var isDMD = !isRBC && !isTD && headers.includes('Transaction') && headers.includes('Balance');
  // Headerless CSV detection (first cell looks like a date)
  var hasHeaders = isRBC || isTD || isDMD ||
    (isNaN(parseFloat(headers[0])) && !(/^\d{1,2}[\/\-]/.test(headers[0])) && !(/^[A-Za-z]{3}-\d{1,2}-\d{4}/.test(headers[0])));
  var dataStart = hasHeaders ? 1 : 0;
  if (!hasHeaders) headers = ['Date','Description','Amount'];

  var txns = [];
  for (var i = dataStart; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    var vals = parseLine(lines[i]).map(cleanField);
    if (vals.length < 2) continue;
    var row = {};
    headers.forEach(function(h,j){ row[h] = vals[j]!==undefined ? vals[j] : ''; });

    var desc='', amount=0, rawDate='';

    if (isRBC) {
      var d1 = (row['Description 1']||'').trim();
      var d2 = (row['Description 2']||'').trim();
      desc = d1;
      if (d2 && !/^\d+$/.test(d2) && d2.toLowerCase()!==d1.toLowerCase()) desc += (desc?' ':'')+d2;
      amount = toAmt(row['CAD$']);
      rawDate = row['Transaction Date']||'';

    } else if (isTD) {
      desc = (row['Description']||'').trim();
      var dv = toAmt(row['Debit']);
      var cv = toAmt(row['Credit']);
      amount = cv>0 ? cv : (dv>0 ? -dv : 0);
      rawDate = row['Transaction Date']||'';

    } else if (isDMD) {
      var txnCol = (row['Transaction']||'').trim();
      var dscCol = (row['Description']||'').trim();
      desc = dscCol || txnCol;
      if (txnCol && dscCol && txnCol!==dscCol) desc = txnCol + ': ' + dscCol;
      var rawAmt = (row['Amount']||'').replace(/\s/g,'');
      var neg = rawAmt.startsWith('-');
      amount = parseFloat(rawAmt.replace(/[^0-9.]/g,''))||0;
      if (neg) amount = -amount;
      rawDate = row['Transaction date']||row['Transaction Date']||'';

    } else {
      desc = row['Description 1']||row['Description']||row['Merchant']||row['Payee']||vals[1]||'';
      var d2g = row['Description 2']||'';
      if (d2g && !/^\d+$/.test(d2g.trim())) desc += (desc?' ':'')+d2g.trim();
      if (row['CAD$']!==undefined && row['CAD$']!=='') {
        amount = toAmt(row['CAD$']);
      } else if (row['Debit']!==undefined || row['Credit']!==undefined) {
        var gdv = toAmt(row['Debit']||row['Withdrawals']||'');
        var gcv = toAmt(row['Credit']||row['Deposits']||'');
        amount = gcv>0 ? gcv : (gdv>0 ? -gdv : 0);
      } else {
        amount = toAmt(row['Amount']||row['Transaction Amount']||vals[2]||'');
      }
      rawDate = row['Transaction Date']||row['Date']||row['Transaction date']||vals[0]||'';
    }

    desc = desc.trim();
    var date = normDate(rawDate);

    if (!desc && amount===0) continue;
    if (amount===0 && isDMD) continue;
    if (/^(opening|closing|beginning|ending|total|balance|summary)/i.test(desc)) continue;

    var rowBalance = null;
    if (isDMD && row['Balance']) {
      var rawBal = (row['Balance']||'').replace(/\s/g,'');
      var negBal = rawBal.startsWith('-');
      rowBalance = parseFloat(rawBal.replace(/[^0-9.]/g,''))||0;
      if (negBal) rowBalance = -rowBalance;
    }

    txns.push({ date: date, description: desc, amount: amount, balance: rowBalance });
  }

  var openingBalance = null;
  if (isDMD && txns.length) {
    var sorted = txns.slice().sort(function(a,b){ return new Date(a.date) - new Date(b.date); });
    var oldest = sorted[0];
    if (oldest.balance != null) openingBalance = oldest.balance - oldest.amount;
  }

  return { txns: txns, openingBalance: openingBalance };
}

// ── Canadian Tire Mastercard CSV parser ─────────────────────────────────────
// Format: 4-line header block, then data rows with REF column for dedup
// Line 0: "MY ACCOUNT TRANSACTIONS"
// Line 1: "Start Date,End Date,Current Balance,Available Credit"
// Line 2: metadata values
// Line 3: "REF,TRANSACTION DATE,POSTED DATE,TYPE,DESCRIPTION,Category,AMOUNT"
function parseCTMastercardStatement(allLines) {
  function parseLine(line) {
    var fields = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
      else if (c===',' && !inQ) { fields.push(cur.trim()); cur=''; }
      else cur+=c;
    }
    fields.push(cur.trim());
    return fields;
  }
  function cleanField(v) { return v.replace(/^"+|"+$/g,'').trim(); }
  function toAmt(v) { return parseFloat((v||'').replace(/[\$,\s]/g,''))||0; }

  // Find the real header row (contains REF and TRANSACTION DATE)
  var headerIdx = -1;
  for (var i = 0; i < allLines.length; i++) {
    var upper = (allLines[i]||'').toUpperCase();
    if (upper.includes('REF') && upper.includes('TRANSACTION DATE') && upper.includes('AMOUNT')) {
      headerIdx = i; break;
    }
  }
  if (headerIdx < 0) return { txns: [], openingBalance: null };

  var headers = parseLine(allLines[headerIdx]).map(cleanField);

  var txns = [];
  for (var i = headerIdx + 1; i < allLines.length; i++) {
    var line = allLines[i];
    if (!line || !line.trim()) continue;
    var vals = parseLine(line).map(cleanField);
    if (vals.length < 4) continue;
    var row = {};
    headers.forEach(function(h, j) { row[h] = vals[j] !== undefined ? vals[j] : ''; });

    var ref         = (row['REF'] || '').trim();
    var desc        = (row['DESCRIPTION'] || '').trim();
    var rawDate     = (row['TRANSACTION DATE'] || '').trim();
    var rawAmt      = (row['AMOUNT'] || '').trim();

    if (!desc && !rawAmt) continue;

    // CT amounts are positive for charges (debits on a credit card)
    // Store as negative so they reduce the account balance (consistent with other credit card parsers)
    var amount = toAmt(rawAmt);
    if (amount > 0) amount = -amount; // charges are outflows

    var date = normDate(rawDate);

    txns.push({ date: date, description: desc, amount: amount, sourceRef: ref });
  }

  return { txns: txns, openingBalance: null };
}

// ── BMO Chequing/Savings CSV parser ──────────────────────────────────────────
// Format: metadata line, blank lines, then header row:
//   First Bank Card, Transaction Type, Date Posted, Transaction Amount, Description
// Data rows: 'CARDNUMBER', DEBIT|CREDIT, YYYYMMDD, -amount, [XX]MERCHANT CITY PROV
function parseBMOStatement(allLines) {
  // Find the actual header row (contains "First Bank Card")
  var headerIdx = -1;
  for (var i = 0; i < allLines.length; i++) {
    if (/first bank card/i.test(allLines[i])) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return { txns: [], openingBalance: null };

  function parseLine(line) {
    var fields = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === "'") { inQ = !inQ; } // BMO uses single quotes around card numbers
      else if (c === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    fields.push(cur.trim());
    return fields;
  }

  // BMO transaction type code descriptions
  var bmoTypeCodes = {
    'PR':  'Purchase',
    'CW':  'Interac/Wire Transfer',
    'DN':  'Direct Deposit',
    'SC':  'Service Charge',
    'OP':  'Online Purchase',
    'INT': 'Interest',
    'ATM': 'ATM Withdrawal',
    'BP':  'Bill Payment',
    'CHQ': 'Cheque',
    'TF':  'Transfer'
  };

  var txns = [];
  for (var i = headerIdx + 1; i < allLines.length; i++) {
    var line = allLines[i].trim();
    if (!line) continue;

    var vals = parseLine(line);
    if (vals.length < 5) continue;

    // vals: [cardNumber, txnType, datePosted, amount, description]
    var txnType  = (vals[1]||'').trim().toUpperCase();
    var rawDate  = (vals[2]||'').trim();   // YYYYMMDD
    var rawAmt   = (vals[3]||'').trim();   // negative for debits
    var rawDesc  = (vals[4]||'').trim();

    // Parse date YYYYMMDD → YYYY-MM-DD
    var dateStr = '';
    if (/^\d{8}$/.test(rawDate)) {
      dateStr = rawDate.slice(0,4) + '-' + rawDate.slice(4,6) + '-' + rawDate.slice(6,8);
    } else {
      dateStr = normDate(rawDate);
    }

    // Parse amount (already signed: negative = debit)
    var amount = parseFloat(rawAmt) || 0;

    // Clean description: strip [XX] prefix code and extra whitespace
    var typeCode = '';
    var descClean = rawDesc.replace(/^\[([A-Z0-9]+)\]/, function(m, code) {
      typeCode = code;
      return '';
    }).replace(/\s+/g, ' ').trim();

    // For transfers, include the recipient name if present
    // BMO transfer desc format: "INTERAC ETRNSFR SENT     RECIPIENT NAME   REFERENCE"
    // Clean up to readable form
    descClean = descClean
      .replace(/\s{2,}/g, ' ')       // collapse multiple spaces
      .trim();

    // Friendly label: combine type code meaning + cleaned description
    var typeLabel = bmoTypeCodes[typeCode] || typeCode;
    var desc = descClean;
    // If it's a payroll deposit, label it clearly
    if (/paie\/payroll|pay\/pay/i.test(desc)) desc = 'Payroll Deposit';
    // If it's a performance plan fee
    if (/performance plan/i.test(desc)) desc = 'BMO Performance Plan Fee';
    // If it's an e-transfer out, extract recipient
    if (/interac etrnsfr sent/i.test(desc)) {
      var recipMatch = desc.match(/INTERAC ETRNSFR SENT\s+([A-Z\s]+?)\s+\d/i);
      if (recipMatch) desc = 'e-Transfer Sent — ' + recipMatch[1].trim();
      else desc = 'e-Transfer Sent';
    }
    // If it's an e-transfer received
    if (/interac etrnsfr recvd/i.test(desc)) {
      var recipMatchR = desc.match(/INTERAC ETRNSFR RECVD\s+([A-Z\s]+?)\s+\d/i);
      if (recipMatchR) desc = 'e-Transfer Received — ' + recipMatchR[1].trim();
      else desc = 'e-Transfer Received';
    }
    // Canada government payments
    if (/canada.*fhb|fhb.*canada/i.test(desc)) desc = 'Canada FHB Grant';
    if (/canada.*rrsp|canada.*ccb|canada.*gst/i.test(desc)) desc = 'Government Benefit';

    if (!desc || amount === 0) continue;

    txns.push({ date: dateStr, description: desc, amount: amount, balance: null, bmoTypeCode: typeCode });
  }

  return { txns: txns, openingBalance: null };
}

// Pending import state for CSV preview/confirm flow
var pendingImport = null;

// Helper: detect human-readable format name from CSV first-line headers
function detectCSVFormat(headerLine) {
  var h = headerLine.toUpperCase();
  if (/FOLLOWING DATA IS VALID AS OF/.test(h)) return { label: 'BMO Chequing / Savings', icon: '🏦', color: 'var(--green)' };
  if (/MY ACCOUNT TRANSACTIONS/.test(h)) return { label: 'Canadian Tire Mastercard', icon: '🍁', color: '#e8393a' };
  if (h.includes('CAD$')) return { label: 'RBC Chequing / Savings', icon: '🏦', color: 'var(--accent)' };
  if (h.includes('CARD NO') && h.includes('DEBIT')) return { label: 'TD / Amex Credit Card', icon: '💳', color: 'var(--member1)' };
  if (h.includes('TRANSACTION') && h.includes('BALANCE')) return { label: 'DMD Savings Account', icon: '💰', color: 'var(--green)' };
  if (h.includes('FIRST BANK CARD') && h.includes('TRANSACTION TYPE')) return { label: 'BMO Chequing / Savings', icon: '🏦', color: 'var(--green)' };
  return { label: 'Generic CSV', icon: '📄', color: 'var(--muted)' };
}

async function handleStatementUpload(input) {
  var file = input.files[0]; if (!file) return;
  var accountId = getUploadAccountId();
  if (!accountId) { input.value=''; return; }
  var person  = getUploadPerson();
  var account = accountId;   // transactions store account id
  var status = document.getElementById('upload-status');
  var statId = uid();
  var isPDF = file.name.toLowerCase().endsWith('.pdf');

  status.style.color = 'var(--muted)';
  status.innerHTML = '<div class="spinner" style="display:inline-block;width:16px;height:16px;vertical-align:middle;margin-right:6px"></div> Reading file...';
  document.getElementById('upload-preview').style.display = 'none';

  // ======================================================
  // PDF HANDLING — text extraction first, Vision fallback
  // ======================================================
  if (isPDF) {
    try {
      status.innerHTML = '<div class="spinner" style="display:inline-block;width:16px;height:16px;vertical-align:middle;margin-right:6px"></div> Reading PDF...';

      var pdfText = await extractPDFText(file);
      var txns = [];

      if (pdfText && pdfText.length > 100) {
        // ---- Text-based PDF ----
        status.innerHTML = '<div class="spinner" style="display:inline-block;width:16px;height:16px;vertical-align:middle;margin-right:6px"></div> 🤖 Extracting transactions with AI (10–20 sec)...';
        var prompt = 'Here is raw text extracted from a Canadian bank or credit card statement:\n\n'
          + pdfText.slice(0, 15000)
          + '\n\nExtract every transaction AND the opening/starting balance. Return ONLY a JSON object, no markdown, no explanation:\n'
          + '{"openingBalance":1234.56,"openingDate":"M/D/YYYY","transactions":[{"date":"M/D/YYYY","description":"payee name","amount":-50.00}]}\n'
          + 'Rules:\n'
          + '(1) amount NEGATIVE for purchases/withdrawals/debits, POSITIVE for deposits/credits/refunds.\n'
          + '(2) Skip balance lines, opening/closing balance, totals — only actual transactions.\n'
          + '(3) Clean descriptions: remove terminal IDs, city codes, reference numbers.\n'
          + '(4) Date format: M/D/YYYY (e.g. 3/15/2025).\n'
          + '(5) For compound lines like "Service Fee -$1.20" extract as a single transaction.\n'
          + '(6) openingBalance: the account balance at the START of the statement period (before any transactions). Set to null if not found.\n'
          + '(7) openingDate: the date of the first transaction or statement start date.\n'
          + 'Return ONLY the JSON object starting with { and ending with }.';
        var rawText = await callClaude(prompt, 8000);
        rawText = rawText.replace(/```json|```/g,'').trim();
        // Try to parse as object with openingBalance first
        var pdfOpeningBalance = null;
        var objMatch = rawText.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            var parsedObj = JSON.parse(objMatch[0]);
            if (parsedObj.transactions) {
              txns = parsedObj.transactions;
              pdfOpeningBalance = (parsedObj.openingBalance != null) ? parseFloat(parsedObj.openingBalance) : null;
            } else {
              // Fallback: maybe it's just an array wrapped in an object
              var arr2 = rawText.match(/\[[\s\S]*\]/);
              try { txns = JSON.parse(arr2 ? arr2[0] : '[]'); } catch(e) { txns = []; }
            }
          } catch(e) {
            var arr = rawText.match(/\[[\s\S]*\]/);
            try { txns = JSON.parse(arr ? arr[0] : '[]'); } catch(e2) { txns = []; }
          }
        } else {
          var arr = rawText.match(/\[[\s\S]*\]/);
          try { txns = JSON.parse(arr ? arr[0] : '[]'); } catch(e) { txns = []; }
        }

      } else {
        // ---- Image-based PDF (scanned) — use Claude Vision per page ----
        status.innerHTML = '<div class="spinner" style="display:inline-block;width:16px;height:16px;vertical-align:middle;margin-right:6px"></div> 📷 Scanned PDF detected — rendering pages for AI Vision (20–40 sec)...';
        var images = await extractPDFImages(file);
        if (!images.length) throw new Error('No pages found in PDF.');
        var allTxns = [];
        for (var pi = 0; pi < images.length; pi++) {
          var img = images[pi];
          status.innerHTML = '<div class="spinner" style="display:inline-block;width:16px;height:16px;vertical-align:middle;margin-right:6px"></div> 📷 Reading page ' + img.page + ' of ' + img.total + ' with AI Vision...';
          var pageTxns = await callClaudeVision(img.base64, img.page, img.total);
          allTxns = allTxns.concat(pageTxns);
        }
        // Deduplicate across pages
        var seen = {};
        txns = allTxns.filter(function(t) {
          var key = (t.date||'') + '|' + (t.description||'') + '|' + (t.amount||0);
          if (seen[key]) return false; seen[key]=true; return true;
        });
      }

      if (!txns.length) {
        status.style.color = 'var(--yellow)';
        status.innerHTML = '⚠️ No transactions found in this PDF. Try downloading as CSV from your bank instead.';
        input.value = ''; return;
      }

      // Remove old version if re-uploading same file
      var existing = state.statements.find(function(s){return s.name===file.name;});
      if (existing) {
        state.transactions = state.transactions.filter(function(t){return t.statementId!==existing.id;});
        state.statements = state.statements.filter(function(s){return s.id!==existing.id;});
      }

      var newTxns = txns
        .filter(function(t){return t.description && t.amount!==0;})
        .map(function(t){
          var d = cleanDesc(t.description||'');
          return { id:uid(), date:normDate(t.date||''), description:d, rawDescription:t.description,
            amount:parseFloat(t.amount)||0, category:autoCategorize(d),
            person:person, account:account, source:'import', statementId:statId };
        });

      // Inject opening balance as a synthetic transaction so account balance calculates correctly
      if (typeof pdfOpeningBalance === 'number' && !isNaN(pdfOpeningBalance) && pdfOpeningBalance !== 0) {
        var firstDate = newTxns.length ? newTxns.reduce(function(a,b){ return parseDate(a.date)<parseDate(b.date)?a:b; }).date : normDate(new Date().toLocaleDateString('en-CA'));
        newTxns.unshift({ id:uid(), date:firstDate, description:'Opening Balance (Statement)', amount:pdfOpeningBalance,
          category:'transfer', person:person, account:account, source:'opening_balance', statementId:statId, isOpeningBalance:true });
      }

      state.transactions = [...state.transactions, ...newTxns];
      state.statements.push({ id:statId, name:file.name, person:person, account:account,
        date:new Date().toLocaleDateString('en-CA'), count:newTxns.length });
      saveState(); renderStatements();
      status.style.color = 'var(--green)';
      status.innerHTML = '✓ Imported <strong>' + newTxns.length + '</strong> transactions from PDF.'
        + ' <span style="color:var(--muted)">Go to Transactions to review categories.</span>';
      if (document.getElementById('page-transactions').classList.contains('active')) renderTransactions();
      if (document.getElementById('page-budget').classList.contains('active')) renderBudget();

    } catch(e) {
      status.style.color = 'var(--red)';
      status.innerHTML = '✗ PDF error: ' + e.message + '. Try CSV export from your bank.';
    }

  // ======================================================
  // CSV HANDLING — parse, deduplicate, show preview
  // ======================================================
  } else {
    try {
      var text = await new Promise(function(res,rej){
        var r = new FileReader();
        r.onload = function(){res(r.result);}; r.onerror = rej;
        r.readAsText(file, 'UTF-8');
      });

      // Show detected format
      var firstLine = text.replace(/^\uFEFF/,'').split('\n')[0]||'';
      var fmt = detectCSVFormat(firstLine);
      status.innerHTML = '<span style="background:'+fmt.color+'22;border:1px solid '+fmt.color+'44;color:'+fmt.color+';padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">'+fmt.icon+' '+fmt.label+'</span> &nbsp; Parsing...';

      var parsed = parseCSVStatement(text);
      var parsedTxns = parsed.txns || parsed; // backward compat
      var csvOpeningBalance = parsed.openingBalance || null;
      if (!parsedTxns.length) {
        status.style.color = 'var(--yellow)';
        status.innerHTML = '⚠️ No transactions found. Make sure the file has Date, Description, and Amount columns.'
          + '<br><small style="color:var(--muted)">First row: ' + firstLine.substring(0,160) + '</small>';
        input.value = ''; return;
      }

      // Deduplicate against existing transactions
      // For CT Mastercard, also match on sourceRef (unique REF# per transaction)
      var newOnes = [], dupCount = 0;
      parsedTxns.forEach(function(t) {
        var cleanedDesc = cleanDesc(t.description||'');
        var isDup = state.transactions.some(function(ex){
          // REF-based dedup: catches same transaction uploaded from two CT cardholders
          if (t.sourceRef && ex.sourceRef && t.sourceRef === ex.sourceRef) return true;
          return ex.date === normDate(t.date||'')
            && ex.description === cleanedDesc
            && Math.abs(ex.amount - t.amount) < 0.01;
        });
        if (isDup) dupCount++; else newOnes.push(t);
      });

      if (!newOnes.length) {
        status.style.color = 'var(--muted)';
        status.innerHTML = 'ℹ All ' + parsedTxns.length + ' transactions already imported — nothing new.';
        input.value = ''; return;
      }

      pendingImport = { file:file, person:person, account:account, statId:statId, newOnes:newOnes, dupCount:dupCount, openingBalance:csvOpeningBalance };
      showImportPreview(newOnes, dupCount, parsedTxns.length, fmt);
      status.style.color = 'var(--green)';
      status.innerHTML = '<span style="background:'+fmt.color+'22;border:1px solid '+fmt.color+'44;color:'+fmt.color+';padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">'+fmt.icon+' '+fmt.label+'</span>'
        + ' &nbsp; ✓ <strong>' + newOnes.length + '</strong> new transactions'
        + (dupCount > 0 ? ' <span style="color:var(--muted)">(' + dupCount + ' duplicate' + (dupCount>1?'s':'')+' skipped)</span>' : '')
        + ' — review below and confirm.';

    } catch(e) {
      status.style.color = 'var(--red)';
      status.innerHTML = '✗ CSV error: ' + e.message;
    }
  }
  input.value = '';
}

function showImportPreview(txns, dupCount, totalCount, fmt) {
  document.getElementById('upload-preview').style.display = '';
  document.getElementById('preview-count').textContent = txns.length + ' new';
  document.getElementById('preview-dup-info').textContent = dupCount > 0
    ? '(' + dupCount + ' duplicate' + (dupCount>1?'s':'') + ' skipped)' : '';

  // Category breakdown chips
  var catCounts = {};
  txns.forEach(function(t) {
    var cat = autoCategorize(cleanDesc(t.description||''));
    catCounts[cat] = (catCounts[cat]||0) + 1;
  });
  var chips = Object.entries(catCounts).sort(function(a,b){return b[1]-a[1];}).slice(0,10).map(function(kv){
    var catObj = getCatById(kv[0]);
    var col = catObj ? catObj.color : '#b8957a';
    var name = catObj ? catObj.name : kv[0];
    return '<span style="background:'+col+'22;border:1px solid '+col+'44;color:'+col+';padding:2px 8px;border-radius:16px;font-size:11px;font-weight:700;white-space:nowrap">'+name+' ('+kv[1]+')</span>';
  }).join(' ');
  document.getElementById('preview-cat-breakdown').innerHTML = chips;

  var rows = txns.slice(0, 50).map(function(t) {
    var cleanedDesc = cleanDesc(t.description||'');
    var cat = autoCategorize(cleanedDesc);
    var catObj = getCatById(cat);
    var catName = catObj ? catObj.name : cat;
    var catCol  = catObj ? catObj.color : '#b8957a';
    var amt = parseFloat(t.amount)||0;
    var amtColor = amt<0?'var(--red)':amt===0?'var(--muted)':'var(--green)';
    var sign = amt>=0?'+':'';
    return '<tr>'
      + '<td style="font-size:12px;white-space:nowrap">' + (t.date||'—') + '</td>'
      + '<td style="font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+cleanedDesc+'">' + cleanedDesc + '</td>'
      + '<td><span style="background:'+catCol+'22;color:'+catCol+';padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap">'+catName+'</span></td>'
      + '<td style="text-align:right;font-weight:700;color:'+amtColor+';white-space:nowrap">' + sign+'$'+Math.abs(amt).toFixed(2) + '</td>'
      + '</tr>';
  }).join('');
  if (txns.length > 50) rows += '<tr><td colspan="4" style="text-align:center;color:var(--muted);font-size:12px">… and '+(txns.length-50)+' more</td></tr>';
  document.getElementById('preview-tbody').innerHTML = rows;
}

function cancelPreview() {
  pendingImport = null;
  document.getElementById('upload-preview').style.display = 'none';
  document.getElementById('upload-status').innerHTML = 'Import cancelled.';
  document.getElementById('upload-status').style.color = 'var(--muted)';
}

function confirmImport() {
  if (!pendingImport) return;
  var p = pendingImport;
  pendingImport = null;

  // Replace if same filename exists
  var existing = state.statements.find(function(s){ return s.name === p.file.name; });
  if (existing) {
    state.transactions = state.transactions.filter(function(t){ return t.statementId !== existing.id; });
    state.statements = state.statements.filter(function(s){ return s.id !== existing.id; });
  }

  var newTxns = p.newOnes.map(function(t) {
    var txn = {
      id: uid(), date: normDate(t.date||'') || t.date, description: cleanDesc(t.description),
      rawDescription: t.description, amount: t.amount,
      category: autoCategorize(t.description), person: p.person,
      account: p.account, source: 'import', statementId: p.statId
    };
    if (t.sourceRef) txn.sourceRef = t.sourceRef; // CT Mastercard REF# for cross-upload dedup
    return txn;
  });

  // Inject opening balance as synthetic transaction so balance calculates from statement start
  if (p.openingBalance != null && !isNaN(p.openingBalance) && p.openingBalance !== 0) {
    var firstDate = newTxns.length ? newTxns.reduce(function(a,b){ return parseDate(a.date)<parseDate(b.date)?a:b; }).date : normDate(new Date().toLocaleDateString('en-CA'));
    // Check if we already have an opening balance for this account/date combo
    var alreadyHasOB = state.transactions.some(function(t){ return t.isOpeningBalance && t.account === p.account; });
    if (!alreadyHasOB) {
      newTxns.unshift({ id:uid(), date:firstDate, description:'Opening Balance (Statement)', amount:p.openingBalance,
        category:'transfer', person:p.person, account:p.account, source:'opening_balance', statementId:p.statId, isOpeningBalance:true });
    }
  }

  state.transactions = [...state.transactions, ...newTxns];
  state.statements.push({ id: p.statId, name: p.file.name, person: p.person, account: p.account,
    date: new Date().toLocaleDateString('en-CA'), count: newTxns.length });
  saveState(); renderStatements(); populateAccountDropdowns();
  document.getElementById('upload-preview').style.display = 'none';
  var status = document.getElementById('upload-status');
  status.style.color = 'var(--green)';
  status.innerHTML = '&#10003; Imported <strong>' + newTxns.length + '</strong> transactions'
    + (p.dupCount > 0 ? ' (' + p.dupCount + ' duplicates skipped)' : '') + '! Go to <strong>Transactions</strong> to review categories.';
  if (document.getElementById('page-transactions').classList.contains('active')) renderTransactions();
  if (document.getElementById('page-budget').classList.contains('active')) renderBudget();
}
// File drop zone
(function() {
  var dropZone = document.getElementById('file-drop');
  if (!dropZone) return;
  dropZone.addEventListener('dragover', function(e){e.preventDefault();dropZone.classList.add('drag-over');});
  dropZone.addEventListener('dragleave', function(){dropZone.classList.remove('drag-over');});
  dropZone.addEventListener('drop', function(e){
    e.preventDefault(); dropZone.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (file) {
      var input = document.getElementById('stmt-upload');
      var dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
      handleStatementUpload(input);
    }
  });
})();

// BACKUP / RESTORE
// ── FLIPP INTEGRATION ────────────────────────────────────────────────────────

function togglePDFUpload(){
  var sec=document.getElementById('pdf-upload-section');
  var btn=document.getElementById('toggle-pdf-btn');
  if(sec.style.display==='none'){sec.style.display='';btn.textContent='🙈 Hide PDF Upload';}
  else{sec.style.display='none';btn.textContent='📄 Show PDF Upload';}
}

function flippGenerateSid(){return Array.from({length:16},function(){return Math.floor(Math.random()*10);}).join('');}

function flippBackToPostal(){
  document.getElementById('flipp-step-select').style.display='none';
  document.getElementById('flipp-step-postal').style.display='';
  document.getElementById('flipp-fetch-status').textContent='';
}

async function flippFetchFlyers(){
  var postalRaw=document.getElementById('flipp-postal-input').value.trim().toUpperCase().replace(/\s/g,'');
  var statusEl=document.getElementById('flipp-fetch-status');
  if(!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postalRaw)){statusEl.innerHTML='<span style="color:#e05c5c">Please enter a valid postal code (e.g. K7L1A1)</span>';return;}
  state.flippPostalCode=postalRaw; saveState();
  statusEl.innerHTML='<span class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;margin-right:6px"></span> Fetching flyers...';
  var checkedBoxes=document.querySelectorAll('#flipp-store-filters input[type=checkbox]:checked');
  var selectedStores=Array.from(checkedBoxes).map(function(cb){return cb.value.toLowerCase();});
  try {
    var sid=flippGenerateSid();
    var data=await flippFetch('https://flyers-ng.flippback.com/api/flipp/data?locale=en&postal_code='+postalRaw+'&sid='+sid);
    var flyers=data.flyers||[];
    var filtered=flyers.filter(function(f){
      var merchant=(f.merchant||'').toLowerCase();
      var cats=Array.isArray(f.categories)?f.categories:(f.categories||'').split(',').map(function(s){return s.trim();});
      var isGrocery=cats.some(function(c){return c.toLowerCase().includes('grocer')||c.toLowerCase().includes('food');});
      var storeMatch=selectedStores.some(function(s){return merchant.includes(s);});
      return storeMatch||(isGrocery&&selectedStores.length===0);
    });
    if(filtered.length===0){statusEl.innerHTML='<span style="color:#e05c5c">No matching flyers found for '+postalRaw+'.</span>';return;}
    var listEl=document.getElementById('flipp-flyer-list');
    listEl.innerHTML=filtered.map(function(f,i){
      var vf=f.valid_from?new Date(f.valid_from).toLocaleDateString('en-CA',{month:'short',day:'numeric'}):'';
      var vt=f.valid_to?new Date(f.valid_to).toLocaleDateString('en-CA',{month:'short',day:'numeric'}):'';
      var dr=(vf&&vt)?vf+' - '+vt:'';
      var already=(state.flyers||[]).some(function(sf){return sf.flippId==f.id;});
      return '<label style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;cursor:pointer;background:var(--card)">'
        +'<input type="checkbox" '+(already?'':'checked')+' value="'+i+'" data-flyer-idx="'+i+'">'
        +'<div style="flex:1"><div style="font-weight:600;font-size:14px">'+(f.merchant||'Unknown')+'</div>'
        +'<div class="muted-sm">'+(dr||f.name||'')+(already?' - already imported':'')+'</div></div>'
        +'</label>';
    }).join('');
    window._flippFoundFlyers=filtered;
    statusEl.textContent='';
    document.getElementById('flipp-step-postal').style.display='none';
    document.getElementById('flipp-step-select').style.display='';
    document.getElementById('flipp-import-status').textContent='';
  } catch(e){statusEl.innerHTML='<span style="color:#e05c5c">Could not reach Flipp: '+e.message+'</span><br><div class="flipp-fallback-note" style="display:block">💡 <strong>Tip:</strong> Flipp works best in Chrome. In other browsers, try uploading a flyer PDF instead using the "Upload PDF" button.</div>';}
}

async function flippImportSelected(){
  var statusEl=document.getElementById('flipp-import-status');
  var flyers=window._flippFoundFlyers||[];
  if(!flyers.length){closeModal('flipp-modal');return;}
  var checked=document.querySelectorAll('#flipp-flyer-list input[type=checkbox]:checked');
  var selectedIdxs=Array.from(checked).map(function(cb){return parseInt(cb.getAttribute('data-flyer-idx'));});
  if(!selectedIdxs.length){statusEl.innerHTML='<span style="color:#e05c5c">Please select at least one flyer.</span>';return;}
  if(!state.flyers)state.flyers=[];
  var imported=0,errors=0;
  for(var i=0;i<selectedIdxs.length;i++){
    var flyerObj=flyers[selectedIdxs[i]];if(!flyerObj)continue;
    statusEl.innerHTML='<span class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;margin-right:6px"></span> Fetching '+flyerObj.merchant+' ('+(i+1)+'/'+selectedIdxs.length+')...';
    try{
      var sid=flippGenerateSid();
      var rawItems=await flippFetch('https://flyers-ng.flippback.com/api/flipp/flyers/'+flyerObj.id+'/flyer_items?locale=en&sid='+sid);
      var items=rawItems.filter(function(it){return it.name&&(it.price||it.current_price);}).map(function(it){
        var price=it.current_price||it.price||'';
        if(typeof price==='number')price='$'+price.toFixed(2);
        return{name:it.name,price:String(price),category:guessFlippCategory(it.name),description:it.description||'',unit:it.display_size||''};
      });
      // Split compound "Item A or Item B" names and sort by category
      items = splitFlyerItems(items);
      var vf2=flyerObj.valid_from?new Date(flyerObj.valid_from).toLocaleDateString('en-CA'):'';
      var vt2=flyerObj.valid_to?new Date(flyerObj.valid_to).toLocaleDateString('en-CA'):'';
      state.flyers.push({id:uid(),flippId:flyerObj.id,store:flyerObj.merchant,validFrom:vf2,validTo:vt2,items:items,uploadedAt:new Date().toLocaleDateString(),source:'flipp'});
      imported++;
    }catch(e){console.warn('Failed:',flyerObj.merchant,e);errors++;}
  }
  saveState();renderFlyers();
  if(imported>0){statusEl.innerHTML='Imported '+imported+' flyer'+(imported>1?'s':'')+'!'+(errors?' ('+errors+' failed)':'');
    // Suggest non-food items from all newly imported flyers
    var allNewItems=[];
    state.flyers.slice(-imported).forEach(function(f){(f.items||[]).forEach(function(it){allNewItems.push({name:it.name,price:it.price,store:f.store});});});
    var nfItems=detectNonFoodItems(allNewItems);
    if(nfItems.length)setTimeout(function(){closeModal('flipp-modal');setTimeout(function(){showNonFoodConfirm(nfItems);},300);},1500);
    else setTimeout(function(){closeModal('flipp-modal');},1500);
  }
  else{statusEl.innerHTML='<span style="color:#e05c5c">Could not import any flyers.</span>';}
}

function guessFlippCategory(name){
  var n=(name||'').toLowerCase();
  if(/beef|pork|chicken|lamb|turkey|steak|bacon|sausage|salmon|shrimp|fish|seafood/.test(n))return'meat';
  if(/apple|banana|lettuce|spinach|tomato|broccoli|carrot|berry|grape|avocado|pepper|onion|fruit|vegetable|salad/.test(n))return'produce';
  if(/milk|cheese|yogurt|cream|butter|egg/.test(n))return'dairy';
  if(/bread|bagel|muffin|croissant|cake|donut|bun|pastry|loaf/.test(n))return'bakery';
  if(/frozen|pizza|ice cream|fries/.test(n))return'frozen';
  return'pantry';
}

// ── Flyer item splitter ───────────────────────────────────────────────────────
// Splits compound flyer item names joined by " or " / " OR " into individual
// items, each inheriting the original price, unit, and description.
// Also sorts the final list by category for a cleaner browsing experience.
//
// Example: "ARMSTRONG CHEESE 250g or PC CHEESE 400g" → two items at same price.
// Example: "MILK ($4.98 EA.) OR CHOCOLATE MILK OR YOGURT" → three items.
function splitFlyerItems(items) {
  // Custom category display order: produce and meat first, other last
  var CAT_ORDER = ['produce','meat','dairy','bakery','frozen','pantry','other'];

  var result = [];

  items.forEach(function(item) {
    var rawName = (item.name || '').trim();

    // ── Step 1: strip embedded per-unit sub-prices like ($4.98 EA.) ──────────
    // These appear in compound strings to explain each sub-item's individual
    // price alongside a multi-unit deal price. Strip them before splitting.
    var cleanedName = rawName.replace(/\(\$[\d.]+\s*(?:EA\.?|EACH|\/\s*EA\.?)?\s*\)/gi, '').trim();

    // ── Step 2: split on " or " (case-insensitive, spaces required) ──────────
    // Requiring surrounding spaces prevents splitting mid-word (e.g. "organic").
    var fragments = cleanedName.split(/\s+or\s+/i);

    if (fragments.length <= 1) {
      // Nothing to split — push original item unchanged
      result.push(item);
      return;
    }

    // ── Step 3: create one item per fragment ──────────────────────────────────
    fragments.forEach(function(frag) {
      frag = frag.replace(/\s+/g, ' ').trim();
      // Skip blank or punctuation-only fragments
      if (!frag || frag.length < 2 || /^[,;.\-\/]+$/.test(frag)) return;

      result.push({
        name:        frag,
        price:       item.price       || '',
        category:    guessFlippCategory(frag), // re-classify per fragment
        description: item.description || '',
        unit:        item.unit        || ''
      });
    });
  });

  // ── Step 4: deduplicate ───────────────────────────────────────────────────
  // Build a normalised key: lowercase, strip punctuation/trademark symbols,
  // collapse whitespace. Two items that normalise to the same key are dupes;
  // keep the first one encountered (which will have a price if any do).
  var seenKeys = {};
  result = result.filter(function(item) {
    var key = (item.name || '')
      .toLowerCase()
      .replace(/[™®©†‡°]/g, '')
      .replace(/\bor\b/gi, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!key) return false;
    if (seenKeys[key]) return false;
    seenKeys[key] = true;
    return true;
  });

  // ── Step 5: sort by category using the defined display order ─────────────
  result.sort(function(a, b) {
    var ai = CAT_ORDER.indexOf(a.category || 'other');
    var bi = CAT_ORDER.indexOf(b.category || 'other');
    if (ai === -1) ai = CAT_ORDER.length;
    if (bi === -1) bi = CAT_ORDER.length;
    if (ai !== bi) return ai - bi;
    // Within same category, sort alphabetically by name
    return (a.name || '').localeCompare(b.name || '');
  });

  return result;
}

function exportGroceryData(){
  var rows=[['Item','Qty','Store','Price','On Sale','From Meal Plan','Checked']];
  (state.shoppingList||[]).slice().sort(function(a,b){return (a.store||'Any').localeCompare(b.store||'Any');}).forEach(function(item){
    rows.push([item.name,item.qty||'',item.store||'Any',
      item.price?'$'+parseFloat(item.price).toFixed(2):'',
      (item.fromMealPlan&&item.store&&item.store!=='Any')?'Yes':'No',
      item.fromMealPlan?'Yes':'No',item.checked?'Yes':'No']);
  });
  var total=(state.shoppingList||[]).reduce(function(s,i){return s+(parseFloat(i.price)||0);},0);
  rows.push(['','','TOTAL','$'+total.toFixed(2),'','','']);
  var csv=rows.map(function(r){return r.map(function(c){return '"'+(String(c).replace(/"/g,'""'))+'"';}).join(',');}).join('\n');
  var d=new Date();
  var fileName='ShoppingList_'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'.csv';
  hhConfirm('How would you like to export?\n\nOK = Download CSV file\nCancel = Copy to clipboard (paste into Google Sheets)','📤','Export Shopping List').then(function(download){
    if(download){
      var blob=new Blob([csv],{type:'text/csv'});var url=URL.createObjectURL(blob);
      var a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
    } else {
      try{navigator.clipboard.writeText(csv);}catch(e){}
      hhAlert('Shopping list copied to clipboard!\n\nTo save to Google Drive:\n1. Go to drive.google.com\n2. New \u2192 Google Sheets\n3. Paste (Ctrl+V / Cmd+V) and save as "'+fileName+'"','📋');
    }
  });
}

function importGroceryData(input){
  var file=input.files[0];if(!file)return;
  var r=new FileReader();
  r.onload=function(){
    try{
      var data=JSON.parse(r.result);
      if(!data._type&&!data.transactions)throw new Error('Not a recognised export file.');
      if(!state.shoppingList)state.shoppingList=[];
      if(!state.pantry)state.pantry=[];
      if(!state.flyers)state.flyers=[];
      var existingListIds=state.shoppingList.map(function(i){return i.id;});
      var newList=(data.shoppingList||[]).filter(function(i){return !existingListIds.includes(i.id);});
      var existingPantryIds=state.pantry.map(function(p){return p.id;});
      var newPantry=(data.pantry||[]).filter(function(p){return !existingPantryIds.includes(p.id);});
      var existingFlyerIds=state.flyers.map(function(f){return f.flippId||f.id;});
      var newFlyers=(data.flyers||[]).filter(function(f){return !existingFlyerIds.includes(f.flippId||f.id);});
      state.shoppingList=state.shoppingList.concat(newList);
      state.pantry=state.pantry.concat(newPantry);
      state.flyers=state.flyers.concat(newFlyers);
      if(data.mealPlan&&!state.mealPlan)state.mealPlan=data.mealPlan;
      saveState();renderShoppingList();renderPantry();renderFlyers();
      var summary=[];
      if(newList.length)summary.push(newList.length+' list item'+(newList.length!==1?'s':''));
      if(newPantry.length)summary.push(newPantry.length+' pantry item'+(newPantry.length!==1?'s':''));
      if(newFlyers.length)summary.push(newFlyers.length+' flyer'+(newFlyers.length!==1?'s':''));
      hhAlert(summary.length?'Imported: '+summary.join(', ')+'.':'Nothing new to import — already up to date.', summary.length?'✅':'ℹ️');
    }catch(e){hhAlert('Could not import: '+e.message, '⚠️');}
    input.value='';
  };
  r.readAsText(file);
}

function exportData() {
  var dataStr = JSON.stringify(state, null, 2);
  var blob = new Blob([dataStr], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var d = new Date();
  a.download = ((state.household&&state.household.name?state.household.name.replace(/\s+/g,''):'HomeHub')+'_backup_') + d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function resetApp() {
  hhConfirm(
    '<strong>Reset Home Hub?</strong><br><br>' +
    'This will:<br>' +
    '&nbsp;&nbsp;1. <strong>Auto-download a backup</strong> of all your current data<br>' +
    '&nbsp;&nbsp;2. <strong>Erase everything</strong> from this device<br>' +
    '&nbsp;&nbsp;3. <strong>Restart the setup wizard</strong> as if fresh<br><br>' +
    '<span style="color:var(--red)">This cannot be undone. Your backup file is your only restore point.</span>',
    '⚠️', 'Reset & Start Over'
  ).then(function(ok) {
    if (!ok) return;
    // Step 1 — auto-backup first
    exportData();
    // Step 2 — short delay so the download dialog has time to trigger
    setTimeout(function() {
      // Clear localStorage
      try { localStorage.removeItem(KEY); } catch(e) {}
      // Clear IDB if that's what's in use
      if (_useIDB && _idbDB) {
        try {
          var tx = _idbDB.transaction('kv', 'readwrite');
          tx.objectStore('kv').clear();
          tx.oncomplete = function() { location.reload(); };
          tx.onerror = function() { location.reload(); };
          return; // reload handled by tx.oncomplete
        } catch(e) {}
      }
      // Clear in-memory cache too
      _storageCache = {};
      location.reload();
    }, 800);
  });
}

function importData(input) {
  var file = input.files[0]; if (!file) return;
  hhConfirm('<strong>Restore from backup?</strong><br>This will REPLACE all current data. This cannot be undone.','⚠️','Restore Backup').then(function(ok){
    if(!ok){ input.value=''; return; }
    var r = new FileReader();
    r.onload = function() {
      try {
        var data = JSON.parse(r.result);
        // Detect shareable config (not a full backup)
        if (data._type === 'homehub_config') {
          hhConfirm('Import this setup config? This will pre-fill the Setup Wizard with the shared household details. Your existing data will be kept.', function(yes) {
            if (!yes) return;
            wizData.household = data.household || wizData.household;
            wizData.members = (data.members||[]).map(function(m){ return Object.assign({ id: uid(), dob:'', hasTips:false, hasPension:false, hasHealthBenefits:false, isFirstTimeBuyer:true, monthlyIncome:0 }, m); });
            wizData.children = (data.children||[]).map(function(c){ return Object.assign({ id: uid(), color:'var(--accent)' }, c); });
            wizData.pets = (data.pets||[]).map(function(p){ return Object.assign({ id: uid() }, p); });
            wizData.lifestyle = data.lifestyle || {};
            wizData.goals = (data.goals||[]).map(function(g){ return g._wizId; }).filter(Boolean);
            wizData.features = data.features || null;
            wizData.budgets = data.budgets || null;
            openSetupWizard(false);
            hhToast('Config loaded — review and tap Launch!', '📋');
          }, '📋 Import Setup Config?');
          return;
        }
        if (!data.transactions || !data.categories) throw new Error('Invalid backup file');
        Object.assign(state, data);
        saveState();
        location.reload();
      } catch(e) {
        hhAlert('Could not restore backup: ' + e.message, '⚠️');
      }
    };
    r.readAsText(file);
    input.value = '';
  });
}

// SETUP WIZARD
var wizCurrentStep = 1;
var WIZ_TOTAL = 10;
var MEMBER_COLORS = ['#9b7fbd','#e07a9a','#5a9e7a','#c97d5a','#5bb8f7','#f59e0b','#6ee7b7','#f472b6'];
var wizData = {
  household: { name:'', emoji:'🏠', province:'ON', city:'' },
  members: [],
  pets: [],
  goals: ['wedding','house','car','travel'],
  budgets: null,
  features: null
};

function openSetupWizard(isEdit) {
  if (isEdit && state.household && state.household.setupComplete) {
    // Pre-fill from state
    wizData.household = Object.assign({}, state.household);
    wizData.members = JSON.parse(JSON.stringify(state.members || []));
    wizData.children = JSON.parse(JSON.stringify(state.children || []));
    wizData.pets = JSON.parse(JSON.stringify(state.pets || []));
    wizData.goals = (state.goals || []).map(function(g){ return g._wizId || g.id; });
    wizData.budgets = Object.assign({}, state.budgets);
    wizData.features = Object.assign({}, state.features);
    wizData.lifestyle = JSON.parse(JSON.stringify(state.lifestyle || { housingType:'rent', numVehicles:0, vehicleOwnership:'own', dietPrefs:{}, allergies:'', insurances:[] }));
  } else {
    wizData = {
      household: { name:'', emoji:'🏠', province:'ON', city:'' },
      members: [],
      children: [],
      pets: [],
      goals: ['wedding','house','car','travel'],
      budgets: null,
      lifestyle: { housingType:'rent', numVehicles:0, vehicleOwnership:'own', dietPrefs:{}, allergies:'', insurances:[] }
    };
  }
  wizCurrentStep = 1;
  var overlay = document.getElementById('setup-wizard-overlay');
  overlay.classList.remove('hidden');
  renderWizardStep(1);
}

function closeSetupWizard() {
  document.getElementById('setup-wizard-overlay').classList.add('hidden');
}

function renderWizardStep(step) {
  // Update progress dots
  var progressEl = document.getElementById('wiz-progress');
  progressEl.innerHTML = Array.from({length:WIZ_TOTAL}, function(_,i) {
    var cls = i+1 < step ? 'done' : i+1 === step ? 'active' : '';
    return '<div class="wiz-dot ' + cls + '"></div>';
  }).join('');
  // Update step counter
  document.getElementById('wiz-step-counter').textContent = 'Step ' + step + ' of ' + WIZ_TOTAL;
  // Show/hide all steps
  for (var i=1; i<=WIZ_TOTAL; i++) {
    var el = document.getElementById('wiz-step-'+i);
    if (el) el.classList.toggle('active', i===step);
  }
  // Back button
  var backBtn = document.getElementById('wiz-back-btn');
  backBtn.style.display = step > 1 ? '' : 'none';
  // Next button label
  var nextBtn = document.getElementById('wiz-next-btn');
  nextBtn.textContent = step === WIZ_TOTAL ? '🚀 Launch Home Hub!' : 'Next →';
  // Step titles
  var titles = ['','Your Household','Who Lives Here?','Children','Features','Pets','Income & Employment','Lifestyle Details','Savings Goals','Monthly Budget','Review & Launch'];
  var subs = ['','Name your household and tell us where you live.','Add household members — each gets their own calendar and tracking.','Do you have any children? Ages help personalise meals and savings goals.','Choose which features to enable — you can change these anytime.','Add your pets (or skip if you have none).','How does each person earn income?','Tell us about your lifestyle so we can build a smarter budget.','What are your financial goals? Select all that apply.','Set your starting monthly budget for each category.','Here\'s what we\'ve set up for you!'];
  document.getElementById('wiz-title').textContent = titles[step] || 'Setup';
  document.getElementById('wiz-subtitle').textContent = subs[step] || '';
  // Render dynamic content for steps
  if (step === 1) renderWizardStep1();
  if (step === 2) renderWizardMemberCards();
  if (step === 3) renderWizardChildrenList();
  if (step === 4) renderWizardFeatures();
  if (step === 5) renderWizardPetList();
  if (step === 6) renderWizardIncomeCards();
  if (step === 7) renderWizardLifestyle();
  if (step === 8) renderWizardGoals();
  if (step === 9) renderWizardBudgetFields();
  if (step === 10) renderWizardReview();
}

function renderWizardStep1() {
  document.getElementById('wiz-household-name').value = wizData.household.name || '';
  document.getElementById('wiz-province').value = wizData.household.province || 'ON';
  document.getElementById('wiz-city').value = wizData.household.city || '';
  // Mark selected emoji
  document.querySelectorAll('#wiz-emoji-options .wiz-chip').forEach(function(chip) {
    chip.classList.toggle('selected', chip.getAttribute('onclick').includes("'" + wizData.household.emoji + "'"));
  });
}

function selectHouseholdEmoji(el, emoji) {
  wizData.household.emoji = emoji;
  document.querySelectorAll('#wiz-emoji-options .wiz-chip').forEach(function(c){ c.classList.remove('selected'); });
  el.classList.add('selected');
}

function renderWizardFeatures() {
  var f = wizData.features || (state.features ? Object.assign({}, state.features) : { calendar:true, tips:true, grocery:true, pets:true, upload:true });
  var hasTipsMember = wizData.members.some(function(m){ return m.hasTips; });
  var hasPets = wizData.pets && wizData.pets.length > 0;
  if (hasTipsMember) f.tips = true;
  if (hasPets) f.pets = true;
  wizData.features = f;
  var defs = [
    { id:'calendar', label:'📅 Calendar',       desc:'Sync & view Google Calendar for each member' },
    { id:'tips',     label:'💵 Cash Tips',       desc:'Track tip income and CRA tax reserve' + (hasTipsMember ? ' — auto-enabled' : '') },
    { id:'grocery',  label:'🛒 Grocery & Meals', desc:'Flyer deals, meal planning, pantry, shopping list' },
    { id:'pets',     label:'🐾 Pet Tracker',      desc:'Daily feeding tracker on the dashboard' + (hasPets ? ' — auto-enabled' : '') },
    { id:'upload',   label:'📤 Upload',           desc:'Import bank & credit card CSVs and PDF statements' },
  ];
  var list = document.getElementById('wiz-features-list');
  if (!list) return;
  list.innerHTML = defs.map(function(d) {
    var on = f[d.id] !== false;
    var locked = (d.id === 'tips' && hasTipsMember) || (d.id === 'pets' && hasPets);
    return '<label style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:2px solid ' + (on?'var(--accent)':'var(--border)') + ';border-radius:12px;' + (locked?'':'cursor:pointer;') + 'background:var(--card);transition:border-color 0.15s" ' + (locked?'':'onclick="wizToggleFeature(this)"') + '>'
      + '<input type="checkbox" data-fid="' + d.id + '"' + (on?' checked':'') + (locked?' disabled':'') + ' style="width:16px;height:16px;margin-top:3px;accent-color:var(--accent);flex-shrink:0;pointer-events:none">'
      + '<div><div style="font-size:14px;font-weight:800;color:var(--text)">' + d.label + (locked?' <span style="font-size:11px;color:var(--green);font-weight:600">✓ auto</span>':'') + '</div>'
      + '<div style="font-size:12px;color:var(--muted);margin-top:2px">' + d.desc + '</div></div>'
      + '</label>';
  }).join('');
}

function wizToggleFeature(label) {
  var cb = label.querySelector('input[type="checkbox"]');
  if (!cb || cb.disabled) return;
  cb.checked = !cb.checked;
  if (!wizData.features) wizData.features = {};
  wizData.features[cb.dataset.fid] = cb.checked;
  label.style.borderColor = cb.checked ? 'var(--accent)' : 'var(--border)';
}

function renderWizardMemberCards() {
  if (!wizData.members.length) {
    wizData.members = [
      { id: uid(), name: '', dob: '', color: MEMBER_COLORS[0], incomeType: 'salary', hasTips: false, hasPension: false, isFirstTimeBuyer: true }
    ];
  }
  var list = document.getElementById('wiz-members-list');
  list.innerHTML = wizData.members.map(function(m, idx) {
    var colorSwatches = MEMBER_COLORS.map(function(c) {
      return '<div class="color-swatch' + (m.color === c ? ' selected' : '') + '" style="background:' + c + '" onclick="wizSetMemberColor(\'' + m.id + '\',\'' + c + '\')"></div>';
    }).join('');
    return '<div class="wiz-member-card" id="wiz-member-' + m.id + '">'
      + '<div class="wiz-avatar" style="background:' + m.color + '20;font-size:20px">&#x1F464;</div>'
      + '<div class="wiz-member-fields">'
      + '<div class="wiz-member-row">'
      + '<div><label style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;color:var(--muted)">Name</label><input type="text" placeholder="e.g. Alex" value="' + (m.name||'') + '" style="min-width:0" oninput="wizData.members.find(function(x){return x.id===\'' + m.id + '\'}).name=this.value"></div>'
      + '<div><label style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;color:var(--muted)">Date of Birth</label><input type="date" value="' + (m.dob||'') + '" style="min-width:0" onchange="wizData.members.find(function(x){return x.id===\'' + m.id + '\'}).dob=this.value" max="' + new Date().toISOString().split('T')[0] + '"></div>'
      + '</div>'
      + '<div><label style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;color:var(--muted);margin-bottom:4px;display:block">Colour</label><div class="color-swatch-group">' + colorSwatches + '</div></div>'
      + '</div>'
      + (wizData.members.length > 1 ? '<button onclick="wizRemoveMember(\'' + m.id + '\')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;padding:4px" title="Remove">&#x2715;</button>' : '')
      + '</div>';
  }).join('');
}

function wizAddMember() {
  wizData.members.push({ id: uid(), name: '', dob: '', color: MEMBER_COLORS[wizData.members.length % MEMBER_COLORS.length], incomeType: 'salary', hasTips: false, hasPension: false, isFirstTimeBuyer: true });
  renderWizardMemberCards();
}

function wizRemoveMember(id) {
  wizData.members = wizData.members.filter(function(m){ return m.id !== id; });
  renderWizardMemberCards();
}

function wizSetMemberColor(memberId, color) {
  var m = wizData.members.find(function(m){ return m.id === memberId; });
  if (m) m.color = color;
  renderWizardMemberCards();
}

// ── Children Wizard Step ──────────────────────────────────────────────────
function renderWizardChildrenList() {
  var list = document.getElementById('wiz-children-list');
  if (!list) return;
  if (!wizData.children) wizData.children = [];
  if (!wizData.children.length) {
    list.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0">No children added yet. Click <strong>Add Child</strong> below, or skip this step.</p>';
    return;
  }
  var today = new Date();
  list.innerHTML = wizData.children.map(function(c) {
    var ageStr = '';
    if (c.dob) {
      var dob = new Date(c.dob);
      var months = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
      if (months < 12) ageStr = months + ' month' + (months===1?'':'s');
      else { var yrs = Math.floor(months/12); ageStr = yrs + ' yr' + (yrs===1?'':'s'); }
      var stage = months < 12 ? '👶 Baby' : months < 36 ? '🧸 Toddler' : months < 72 ? '🧒 Pre-schooler' : months < 144 ? '🧑 Child' : '🧑‍🎓 Teen';
      ageStr = ageStr + ' • ' + stage;
    }
    return '<div class="wiz-member-card" style="margin-bottom:8px">'
      + '<div class="wiz-avatar" style="background:#f5e9c820;font-size:20px">👶</div>'
      + '<div class="wiz-member-fields">'
      + '<div class="wiz-member-row">'
      + '<div><label style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;color:var(--muted)">Name / Nickname</label>'
      + '<input type="text" placeholder="e.g. Emma" value="' + (c.name||'') + '" style="min-width:0" oninput="wizData.children.find(function(x){return x.id===\'' + c.id + '\' }).name=this.value;renderWizardChildrenList()"></div>'
      + '<div><label style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:800;color:var(--muted)">Date of Birth</label>'
      + '<input type="date" value="' + (c.dob||'') + '" style="min-width:0" max="' + today.toISOString().split('T')[0] + '" onchange="wizData.children.find(function(x){return x.id===\'' + c.id + '\' }).dob=this.value;renderWizardChildrenList()"></div>'
      + '</div>'
      + (ageStr ? '<div style="font-size:12px;color:var(--accent);font-weight:600;margin-top:4px">' + ageStr + '</div>' : '')
      + '</div>'
      + '<button onclick="wizRemoveChild(\'' + c.id + '\')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;padding:4px" title="Remove">&#x2715;</button>'
      + '</div>';
  }).join('');
}

function wizAddChild() {
  if (!wizData.children) wizData.children = [];
  wizData.children.push({ id: uid(), name: '', dob: '', color: 'var(--accent)' });
  renderWizardChildrenList();
}

function wizRemoveChild(id) {
  wizData.children = wizData.children.filter(function(c){ return c.id !== id; });
  renderWizardChildrenList();
}

function wizSkipChildren() {
  wizData.children = [];
  wizCurrentStep++;
  renderWizardStep(wizCurrentStep);
}

// ── Lifestyle Wizard Step ──────────────────────────────────────────────────
function renderWizardLifestyle() {
  var ls = wizData.lifestyle || {};
  var el = document.getElementById('wiz-lifestyle-content');
  if (!el) return;

  var dietOptions = [
    { id:'omnivore', label:'🍖 Omnivore', desc:'Eat everything' },
    { id:'vegetarian', label:'🥦 Vegetarian', desc:'No meat' },
    { id:'vegan', label:'🌱 Vegan', desc:'No animal products' },
    { id:'pescatarian', label:'🐟 Pescatarian', desc:'Fish, no meat' },
    { id:'glutenfree', label:'🍞 Gluten-Free', desc:'Celiac / preference' },
    { id:'dairyfree', label:'🥛 Dairy-Free', desc:'Lactose or preference' },
    { id:'halal', label:'🕌 Halal', desc:'Halal certified' },
    { id:'kosher', label:'✡️ Kosher', desc:'Kosher certified' },
  ];

  var insOptions = [
    { id:'home', label:'🏠 Home / Tenant' },
    { id:'auto', label:'🚗 Auto' },
    { id:'life', label:'💚 Life' },
    { id:'disability', label:'🦺 Disability' },
    { id:'travel', label:'✈️ Travel' },
    { id:'critical', label:'🏥 Critical Illness' },
  ];

  var memberDietRows = (wizData.members||[]).map(function(m) {
    var sel = (ls.memberDiets && ls.memberDiets[m.id]) || [];
    return '<div style="margin-bottom:10px">'
      + '<div style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:6px">' + m.name + '\u2019s diet</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
      + dietOptions.map(function(d) {
          var checked = sel.indexOf(d.id) >= 0;
          return '<span role="button" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:5px 10px;border:1.5px solid '+(checked?'var(--accent)':'var(--border)')+';border-radius:20px;cursor:pointer;background:'+(checked?'var(--accent)18':'var(--card)')+';user-select:none;transition:border-color 0.15s,background 0.15s" onclick="wizToggleMemberDiet(this,\'' + m.id + '\',\'' + d.id + '\')">'
            + (checked ? '<span style="font-size:10px;color:var(--accent)">&#x2713;</span> ' : '')
            + d.label + '</span>';
        }).join('')
      + '</div></div>';
  }).join('');

  var ins = ls.insurances || [];
  var insHtml = insOptions.map(function(d) {
    var checked = ins.indexOf(d.id) >= 0;
    return '<span role="button" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:5px 10px;border:1.5px solid '+(checked?'var(--green)':'var(--border)')+';border-radius:20px;cursor:pointer;background:'+(checked?'var(--green-light)':'var(--card)')+';user-select:none;transition:border-color 0.15s,background 0.15s" onclick="wizToggleInsurance(this,\'' + d.id + '\')">'
      + (checked ? '<span style="font-size:10px;color:var(--green)">&#x2713;</span> ' : '')
      + d.label + '</span>';
  }).join('');

  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:16px">'

    // Housing
    + '<div><div style="font-size:12px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:6px">🏠 Housing</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div><label style="font-size:11px;font-weight:800;color:var(--muted)">Do you rent or own?</label>'
    + '<select id="ls-housing" onchange="wizData.lifestyle.housingType=this.value">'
    + '<option value="rent"'+(ls.housingType==='rent'?' selected':'')+'>Renting</option>'
    + '<option value="own"'+(ls.housingType==='own'?' selected':'')+'>Own (mortgage)</option>'
    + '<option value="own-outright"'+(ls.housingType==='own-outright'?' selected':'')+'>Own (outright)</option>'
    + '<option value="living-family"'+(ls.housingType==='living-family'?' selected':'')+'>Living with family</option>'
    + '</select></div>'
    + '<div><label style="font-size:11px;font-weight:800;color:var(--muted)">Monthly housing cost ($)</label>'
    + '<input type="number" id="ls-housing-cost" placeholder="e.g. 1800" min="0" value="'+(ls.housingCost||'')+'" style="min-width:0" oninput="wizData.lifestyle.housingCost=parseFloat(this.value)||0"></div>'
    + '</div></div>'

    // Vehicles
    + '<div><div style="font-size:12px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:6px">🚗 Vehicles</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">'
    + '<div><label style="font-size:11px;font-weight:800;color:var(--muted)">Number of vehicles</label>'
    + '<select id="ls-vehicles" onchange="wizData.lifestyle.numVehicles=parseInt(this.value)">'
    + [0,1,2,3,4].map(function(n){ return '<option value="'+n+'"'+(ls.numVehicles===n?' selected':'')+'>'+n+'</option>'; }).join('')
    + '</select></div>'
    + '<div><label style="font-size:11px;font-weight:800;color:var(--muted)">Own or lease?</label>'
    + '<select id="ls-vehicle-own" onchange="wizData.lifestyle.vehicleOwnership=this.value">'
    + '<option value="own"'+(ls.vehicleOwnership==='own'?' selected':'')+'>Own</option>'
    + '<option value="lease"'+(ls.vehicleOwnership==='lease'?' selected':'')+'>Lease</option>'
    + '<option value="both"'+(ls.vehicleOwnership==='both'?' selected':'')+'>Mix</option>'
    + '</select></div>'
    + '<div><label style="font-size:11px;font-weight:800;color:var(--muted)">Monthly car payment ($)</label>'
    + '<input type="number" placeholder="0" min="0" value="'+(ls.carPayment||'')+'" style="min-width:0" oninput="wizData.lifestyle.carPayment=parseFloat(this.value)||0"></div>'
    + '</div></div>'

    // Dietary preferences per member
    + '<div><div style="font-size:12px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:6px">🥗 Dietary Preferences</div>'
    + memberDietRows
    + '<div style="margin-top:8px"><label style="font-size:11px;font-weight:800;color:var(--muted)">Allergies or restrictions to note (all members)</label>'
    + '<input type="text" id="ls-allergies" placeholder="e.g. tree nuts, shellfish" value="'+(ls.allergies||'')+'" oninput="wizData.lifestyle.allergies=this.value"></div>'
    + '</div>'

    // Insurance
    + '<div><div style="font-size:12px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:6px">🛡️ Insurance (what do you currently hold?)</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px">' + insHtml + '</div></div>'

    + '</div>';
}

function wizToggleMemberDiet(el, memberId, dietId) {
  if (!wizData.lifestyle) wizData.lifestyle = {};
  if (!wizData.lifestyle.memberDiets) wizData.lifestyle.memberDiets = {};
  if (!wizData.lifestyle.memberDiets[memberId]) wizData.lifestyle.memberDiets[memberId] = [];
  var arr = wizData.lifestyle.memberDiets[memberId];
  var idx = arr.indexOf(dietId);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(dietId);
  var checked = arr.indexOf(dietId) >= 0;
  el.style.borderColor = checked ? 'var(--accent)' : 'var(--border)';
  el.style.background   = checked ? 'var(--accent-light, #f5e9e0)' : 'var(--card)';
  // Update checkmark
  var existing = el.querySelector('span[data-ck]');
  if (checked && !existing) {
    var ck = document.createElement('span');
    ck.setAttribute('data-ck','1');
    ck.style.cssText = 'font-size:10px;color:var(--accent);pointer-events:none';
    ck.innerHTML = '&#x2713;';
    el.insertBefore(ck, el.firstChild);
  } else if (!checked && existing) {
    existing.remove();
  }
}

function wizToggleInsurance(el, insId) {
  if (!wizData.lifestyle) wizData.lifestyle = {};
  if (!wizData.lifestyle.insurances) wizData.lifestyle.insurances = [];
  var arr = wizData.lifestyle.insurances;
  var idx = arr.indexOf(insId);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(insId);
  var checked = arr.indexOf(insId) >= 0;
  el.style.borderColor = checked ? 'var(--green)' : 'var(--border)';
  el.style.background   = checked ? 'var(--green-light)' : 'var(--card)';
  var existing = el.querySelector('span[data-ck]');
  if (checked && !existing) {
    var ck = document.createElement('span');
    ck.setAttribute('data-ck','1');
    ck.style.cssText = 'font-size:10px;color:var(--green);pointer-events:none';
    ck.innerHTML = '&#x2713;';
    el.insertBefore(ck, el.firstChild);
  } else if (!checked && existing) {
    existing.remove();
  }
}

function wizSaveLifestyleFromDOM() {
  // DOM values are saved via oninput/onchange handlers in renderWizardLifestyle
  // This is a no-op safety flush
  if (!wizData.lifestyle) wizData.lifestyle = {};
}

function renderWizardPetList() {
  var list = document.getElementById('wiz-pets-list');
  if (!wizData.pets.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:13px;margin-bottom:10px">No pets added yet — use the buttons below, or skip this step.</div>';
    return;
  }
  var petEmojis = { dog:'🐶', cat:'🐱', other:'🐾' };
  list.innerHTML = wizData.pets.map(function(p) {
    return '<div class="wiz-pet-row">'
      + '<span class="wiz-pet-emoji">' + (petEmojis[p.type]||'🐾') + '</span>'
      + '<input type="text" placeholder="Pet name" value="' + (p.name||'') + '" style="flex:2;min-width:0" oninput="wizData.pets.find(function(x){return x.id===\'' + p.id + '\'}).name=this.value">'
      + '<select style="flex:1;min-width:0" onchange="wizChangePetType(\'' + p.id + '\',this.value)">'
      + '<option value="dog"' + (p.type==='dog'?' selected':'') + '>🐶 Dog</option>'
      + '<option value="cat"' + (p.type==='cat'?' selected':'') + '>🐱 Cat</option>'
      + '<option value="other"' + (p.type==='other'?' selected':'') + '>🐾 Other</option>'
      + '</select>'
      + '<button onclick="wizRemovePet(\'' + p.id + '\')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;padding:4px">✕</button>'
      + '</div>';
  }).join('');
}

function wizAddPet(type) {
  var emojis = { dog:'🐶', cat:'🐱', other:'🐾' };
  var names = { dog:'Dog', cat:'Cat', other:'Pet' };
  wizData.pets.push({ id: uid(), name: names[type] || 'Pet', emoji: emojis[type]||'🐾', type: type });
  renderWizardPetList();
}

function wizRemovePet(id) {
  wizData.pets = wizData.pets.filter(function(p){ return p.id !== id; });
  renderWizardPetList();
}

function wizChangePetType(id, type) {
  var emojis = { dog:'🐶', cat:'🐱', other:'🐾' };
  var p = wizData.pets.find(function(p){ return p.id === id; });
  if (p) { p.type = type; p.emoji = emojis[type]||'🐾'; }
}

function wizSkipPets() { wizData.pets = []; wizNext(); }

function wizIncomeMemberUpdate(el, field) {
  var mid = el.closest('[data-mid]').dataset.mid;
  var m = wizData.members.find(function(x){ return x.id === mid; });
  if (!m) return;
  if (field === 'incomeType') m.incomeType = el.value;
  else if (field === 'monthlyIncome') m.monthlyIncome = parseFloat(el.value) || 0;
  else if (field === 'hasTips') m.hasTips = el.checked;
  else if (field === 'hasPension') m.hasPension = el.checked;
  else if (field === 'hasHealthBenefits') m.hasHealthBenefits = el.checked;
  else if (field === 'isFirstTimeBuyer') m.isFirstTimeBuyer = el.checked;
}

function renderWizardIncomeCards() {
  var list = document.getElementById('wiz-income-list');
  list.innerHTML = wizData.members.map(function(m) {
    var col = m.color || 'var(--accent)';
    var ini = (m.name||'?').charAt(0).toUpperCase();
    var ckLabel = function(field, checked, emoji, label) {
      return '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:6px 12px;border:1.5px solid var(--border);border-radius:20px">'
        + '<input type="checkbox"' + (checked ? ' checked' : '') + ' onchange="wizIncomeMemberUpdate(this,\'' + field + '\')">'
        + ' ' + emoji + ' ' + label + '</label>';
    };
    return '<div class="wiz-income-section" data-mid="' + m.id + '">'
      + '<h4 style="display:flex;align-items:center;gap:8px">'
      + '<span style="width:28px;height:28px;border-radius:50%;background:' + col + ';display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:#fff;font-weight:800">' + ini + '</span>'
      + (m.name || 'Person') + '</h4>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
      + '<div><label style="font-size:10px;text-transform:uppercase;font-weight:800;color:var(--muted)">Employment Type</label>'
      + '<select onchange="wizIncomeMemberUpdate(this,\'incomeType\')">'
      + '<option value="salary"'   + (m.incomeType==='salary'       ? ' selected' : '') + '>💼 Salaried</option>'
      + '<option value="hourly"'   + (m.incomeType==='hourly'       ? ' selected' : '') + '>⏰ Hourly / Wage</option>'
      + '<option value="selfemployed"' + (m.incomeType==='selfemployed' ? ' selected' : '') + '>🧾 Self-Employed</option>'
      + '<option value="freelance"'+ (m.incomeType==='freelance'    ? ' selected' : '') + '>💻 Freelance / Contract</option>'
      + '<option value="parttime"' + (m.incomeType==='parttime'     ? ' selected' : '') + '>🕐 Part-Time</option>'
      + '</select></div>'
      + '<div><label style="font-size:10px;text-transform:uppercase;font-weight:800;color:var(--muted)">Gross Monthly Income</label>'
      + '<input type="number" placeholder="e.g. 4500" min="0" value="' + (m.monthlyIncome || '') + '" style="min-width:0" oninput="wizIncomeMemberUpdate(this,\'monthlyIncome\')"></div>'
      + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px">'
      + ckLabel('hasTips',           !!m.hasTips,           '💰', 'Earns cash tips')
      + ckLabel('hasPension',        !!m.hasPension,        '🏛️', 'Has pension / DB plan')
      + ckLabel('hasHealthBenefits', !!m.hasHealthBenefits, '🏥', 'Employer health benefits')
      + ckLabel('isFirstTimeBuyer',  !!m.isFirstTimeBuyer,  '🏠', 'First-time home buyer')
      + '</div>'
      + '</div>';
  }).join('');
}

function renderWizardGoals() {
  // Already in HTML, just mark selected ones
  document.querySelectorAll('#wiz-goals-grid .wiz-goal-card').forEach(function(card) {
    card.classList.toggle('selected', wizData.goals.indexOf(card.getAttribute('data-id')) >= 0);
  });
}

function wizToggleGoal(el) {
  var id = el.getAttribute('data-id');
  var idx = wizData.goals.indexOf(id);
  if (idx >= 0) wizData.goals.splice(idx, 1);
  else wizData.goals.push(id);
  el.classList.toggle('selected', idx < 0);
}

function renderWizardBudgetFields() {
  var budgets = wizData.budgets || defaultBudgets();
  var cats = [
    {id:'groceries',name:'Groceries',icon:'🛒'},{id:'dining',name:'Dining Out',icon:'🍽️'},
    {id:'gas',name:'Gas & Transport',icon:'⛽'},{id:'phone',name:'Phone & Internet',icon:'📱'},
    {id:'fitness',name:'Fitness',icon:'🏋️'},{id:'insurance',name:'Insurance',icon:'🛡️'},
    {id:'subscriptions',name:'Subscriptions',icon:'📺'},{id:'shopping',name:'Shopping',icon:'🛍️'},
    {id:'pets',name:'Pets',icon:'🐾'},{id:'entertainment',name:'Entertainment',icon:'🎭'},
    {id:'savings',name:'Savings',icon:'💰'},{id:'auto',name:'Auto & Maintenance',icon:'🚗'},
    {id:'health',name:'Health & Dental',icon:'🏥'},{id:'other',name:'Other',icon:'📦'},
  ];
  // Add children-related categories automatically
  var hasChildren = (wizData.children||[]).length > 0;
  if (hasChildren) {
    var today2 = new Date();
    var hasInfantToddler = (wizData.children||[]).some(function(c) {
      if (!c.dob) return false;
      var months = (today2.getFullYear()-new Date(c.dob).getFullYear())*12+(today2.getMonth()-new Date(c.dob).getMonth());
      return months < 60;
    });
    cats.push({id:'children',name:'Kids (clothing, activities)',icon:'👶'});
    if (hasInfantToddler) cats.push({id:'childcare',name:'Childcare / Daycare',icon:'🏫'});
  }
  // Add housing if housingCost set
  if ((wizData.lifestyle||{}).housingType && (wizData.lifestyle||{}).housingType !== 'living-family') {
    if (!cats.find(function(c){return c.id==='housing';})) {
      cats.unshift({id:'housing',name:(wizData.lifestyle.housingType==='rent'?'Rent':'Mortgage'),icon:'🏠'});
    }
  }
  document.getElementById('wiz-budget-fields').innerHTML = cats.map(function(c) {
    return '<div class="form-row" style="margin-bottom:0">'
      + '<label>' + c.icon + ' ' + c.name + '</label>'
      + '<input type="number" placeholder="0" value="' + (budgets[c.id]||0) + '" style="min-width:0"'
      + ' oninput="if(!wizData.budgets)wizData.budgets={}; wizData.budgets[\'' + c.id + '\']=parseFloat(this.value)||0">'
      + '</div>';
  }).join('');
}

function calcAge(dob) {
  if (!dob) return null;
  var today = new Date();
  var d = new Date(dob);
  var months = (today.getFullYear()-d.getFullYear())*12+(today.getMonth()-d.getMonth());
  return months;
}

function ageLabel(months) {
  if (months === null) return '';
  if (months < 12) return months + 'mo';
  var yrs = Math.floor(months/12);
  return yrs + ' yr' + (yrs===1?'':'s');
}

function childStageEmoji(months) {
  if (months < 12) return '\u{1F476}';
  if (months < 36) return '\u{1F9F8}';
  if (months < 72) return '\u{1F9D2}';
  if (months < 156) return '\u{1F9D1}';
  return '\u{1F9D1}\u200D\u{1F393}';
}

function renderWizardReview() {
  var h = wizData.household;
  var goalMap = {wedding:'\u{1F48D} Wedding Fund',house:'\u{1F3E0} House Down Payment',car:'\u{1F697} Car / Vehicle',travel:'\u2708\uFE0F Travel Fund',emergency:'\u{1F6E1}\uFE0F Emergency Fund',retirement:'\u{1F305} Retirement',education:'\u{1F393} Education / RESP',renovation:'\u{1F528} Renovations',baby:'\u{1F476} Starting a Family',business:'\u{1F4BC} Business'};
  var html = '';
  html += '<div class="wiz-review-section"><h4>Household</h4>';
  html += '<span class="wiz-review-pill">' + h.emoji + ' ' + (h.name || 'My Household') + '</span>';
  html += '<span class="wiz-review-pill">\u{1F4CD} ' + (h.city ? h.city + ', ' : '') + h.province + '</span>';
  html += '</div>';

  html += '<div class="wiz-review-section"><h4>Adults (' + wizData.members.length + ')</h4>';
  html += wizData.members.map(function(m) {
    var mos = calcAge(m.dob);
    var agePart = mos !== null ? ' \u00B7 ' + Math.floor(mos/12) + ' yrs' : '';
    return '<span class="wiz-review-pill" style="border-color:' + m.color + ';color:' + m.color + '">\u25CF ' + (m.name||'Unnamed') + agePart + (m.hasTips?' \u{1F4B0}':'') + (m.hasPension?' \u{1F3DB}\uFE0F':'') + '</span>';
  }).join('');
  html += '</div>';

  var kids = wizData.children || [];
  if (kids.length) {
    html += '<div class="wiz-review-section"><h4>Children (' + kids.length + ')</h4>';
    html += kids.map(function(c) {
      var mos = calcAge(c.dob);
      var agePart = mos !== null ? ' \u00B7 ' + ageLabel(mos) : '';
      return '<span class="wiz-review-pill">' + childStageEmoji(mos) + ' ' + (c.name||'Child') + agePart + '</span>';
    }).join('');
    html += '</div>';
  }

  if (wizData.pets && wizData.pets.length) {
    html += '<div class="wiz-review-section"><h4>Pets (' + wizData.pets.length + ')</h4>';
    html += wizData.pets.map(function(p){ return '<span class="wiz-review-pill">' + p.emoji + ' ' + (p.name||'Pet') + '</span>'; }).join('');
    html += '</div>';
  }

  var ls = wizData.lifestyle || {};
  if (ls.housingType || ls.numVehicles) {
    html += '<div class="wiz-review-section"><h4>Lifestyle</h4>';
    if (ls.housingType) {
      var htLabels = {rent:'Renting',own:'Own (mortgage)','own-outright':'Own (outright)','living-family':'With family'};
      html += '<span class="wiz-review-pill">\u{1F3E0} ' + (htLabels[ls.housingType]||ls.housingType) + '</span>';
    }
    if (ls.numVehicles > 0) html += '<span class="wiz-review-pill">\u{1F697} ' + ls.numVehicles + ' vehicle' + (ls.numVehicles===1?'':'s') + '</span>';
    if (ls.allergies) html += '<span class="wiz-review-pill">\u{1F6AB} ' + ls.allergies + '</span>';
    html += '</div>';
  }

  html += '<div class="wiz-review-section"><h4>Goals (' + wizData.goals.length + ')</h4>';
  html += wizData.goals.map(function(g){ return '<span class="wiz-review-pill">' + (goalMap[g]||g) + '</span>'; }).join('');
  html += '</div>';

  var fDefs2 = [{id:'calendar',label:'\u{1F4C5} Calendar'},{id:'tips',label:'\u{1F4B5} Tips'},{id:'grocery',label:'\u{1F6D2} Grocery'},{id:'pets',label:'\u{1F43E} Pets'},{id:'upload',label:'\u{1F4E4} Upload'}];
  var fOn2 = fDefs2.filter(function(d){ return !wizData.features || wizData.features[d.id] !== false; });
  html += '<div class="wiz-review-section"><h4>Features (' + fOn2.length + ' enabled)</h4>';
  html += fOn2.map(function(d){ return '<span class="wiz-review-pill">' + d.label + '</span>'; }).join('');
  html += '</div>';
  document.getElementById('wiz-review-content').innerHTML = html;

  // Rich tax tip
  var province = h.province;
  var tipsMember = wizData.members.find(function(m){ return m.hasTips; });
  var fhsaMembers = wizData.members.filter(function(m){ return m.isFirstTimeBuyer; });
  var hasKids = (wizData.children||[]).length > 0;
  var tips = [];
  if (province === 'ON') tips.push('Ontario: use your TFSA first for flexible, tax-free savings.');
  else if (province === 'BC') tips.push('BC: TFSA and FHSA are your best tools for tax-free growth.');
  else if (province === 'QC') tips.push('Quebec: RRSPs give both provincial and federal deductions.');
  else tips.push(province + ': TFSA contributions grow completely tax-free.');
  if (fhsaMembers.length) tips.push(fhsaMembers.map(function(m){return m.name;}).join(' & ') + ' qualify for the FHSA (\u20248,000/yr, tax-deductible).');
  if (tipsMember) tips.push(tipsMember.name + "'s cash tips are taxable income \u2014 set aside ~22% for CRA each month.");
  if (hasKids) tips.push('You have children \u2014 consider opening a RESP (up to $2,500/yr qualifies for 20% CESG grant).');
  wizData.members.forEach(function(m) {
    if (m.dob) {
      var yrs = Math.floor(calcAge(m.dob)/12);
      if (yrs >= 55) tips.push(m.name + ' is ' + yrs + ' \u2014 review RRSP contribution room before age 71 conversion deadline.');
      else if (yrs <= 35) tips.push(m.name + ' has ' + (65-yrs) + ' years to retirement \u2014 starting RRSP/TFSA now maximises compounding.');
    }
  });
  document.getElementById('wiz-tax-tip').textContent = '\u{1F4A1} ' + tips.join(' ');
}

function wizBack() {
  if (wizCurrentStep > 1) {
    wizCurrentStep--;
    renderWizardStep(wizCurrentStep);
  }
}

function wizNext() {
  // Collect current step data before advancing
  if (wizCurrentStep === 1) {
    wizData.household.name = document.getElementById('wiz-household-name').value.trim();
    wizData.household.province = document.getElementById('wiz-province').value;
    wizData.household.city = document.getElementById('wiz-city').value.trim();
    if (!wizData.household.name) {
      document.getElementById('wiz-household-name').focus();
      document.getElementById('wiz-household-name').style.borderColor = 'var(--red)';
      return;
    }
    document.getElementById('wiz-household-name').style.borderColor = '';
  }
  if (wizCurrentStep === 2) {
    // Validate at least one member with a name
    var named = wizData.members.filter(function(m){ return m.name.trim(); });
    if (!named.length) {
      hhAlert('Please add at least one person to your household.', '\u{1F464}');
      return;
    }
    wizData.members = wizData.members.filter(function(m){ return m.name.trim(); });
  }
  if (wizCurrentStep === 3) {
    // Children saved via oninput — just filter out unnamed
    wizData.children = (wizData.children || []).filter(function(c){ return c.name.trim() || c.dob; });
  }
  if (wizCurrentStep === 4) {
    var fCbs = document.querySelectorAll('#wiz-features-list input[data-fid]');
    if (!wizData.features) wizData.features = {};
    fCbs.forEach(function(cb){ wizData.features[cb.dataset.fid] = cb.checked; });
    // Auto-enable RESP tip if children exist
    if ((wizData.children||[]).length > 0) wizData.features.resp = true;
  }
  if (wizCurrentStep === 5) {
    // Pet names saved via oninput
  }
  if (wizCurrentStep === 7) {
    // Lifestyle collected via oninput/onchange — just save current DOM values
    wizSaveLifestyleFromDOM();
  }
  if (wizCurrentStep === WIZ_TOTAL) {
    wizFinish();
    return;
  }
  wizCurrentStep++;
  renderWizardStep(wizCurrentStep);
}


function exportShareableConfig() {
  var config = {
    _type: 'homehub_config',
    _version: HH_VERSION,
    _exported: new Date().toISOString().split('T')[0],
    household: { name: state.household.name, emoji: state.household.emoji, province: state.household.province, city: state.household.city },
    members: (state.members||[]).map(function(m){
      return { name: m.name, dob: m.dob||'', color: m.color, incomeType: m.incomeType, hasTips: !!m.hasTips, hasPension: !!m.hasPension, hasHealthBenefits: !!m.hasHealthBenefits, isFirstTimeBuyer: !!m.isFirstTimeBuyer, monthlyIncome: m.monthlyIncome||0 };
    }),
    children: (state.children||[]).map(function(c){ return { name: c.name, dob: c.dob||'', color: c.color||'' }; }),
    pets: (state.pets||[]).map(function(p){ return { name: p.name, emoji: p.emoji, type: p.type }; }),
    lifestyle: state.lifestyle || {},
    goals: (state.goals||[]).map(function(g){ return { emoji: g.emoji, name: g.name, target: g.target, notes: g.notes||'', _wizId: g._wizId||g.id }; }),
    features: state.features || {},
    budgets: state.budgets || {},
    categories: (state.categories||[]).map(function(c){ return { id: c.id, name: c.name, color: c.color }; }),
  };
  var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  var hName = (state.household && state.household.name) ? state.household.name.replace(/\s+/g,'') : 'HomeHub';
  a.download = hName + '_config_' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  hhToast('Setup config exported — share this file with friends!', '📋');
}

// ── URL-BASED SHARING ─────────────────────────────────────────────────────────

function importConfigToWizard(config) {
  // Map the shareable config JSON into wizData and open the Setup Wizard
  try {
    window.wizData = {
      step: 1,
      household: {
        name:     (config.household && config.household.name)     || '',
        emoji:    (config.household && config.household.emoji)    || '🏠',
        province: (config.household && config.household.province) || 'ON',
        city:     (config.household && config.household.city)     || '',
      },
      members: (config.members || []).map(function(m, i) {
        return {
          id: uid(), name: m.name || ('Person ' + (i + 1)),
          dob: m.dob || '', color: m.color || 'var(--accent)',
          incomeType: m.incomeType || 'salary',
          hasTips: !!m.hasTips, hasPension: !!m.hasPension,
          hasHealthBenefits: !!m.hasHealthBenefits,
          isFirstTimeBuyer: !!m.isFirstTimeBuyer,
          monthlyIncome: m.monthlyIncome || 0,
        };
      }),
      children: (config.children || []).map(function(c) {
        return { id: uid(), name: c.name || '', dob: c.dob || '', color: c.color || 'var(--accent)' };
      }),
      pets: (config.pets || []).map(function(p) {
        return { id: uid(), name: p.name || '', emoji: p.emoji || '🐾', type: p.type || 'dog' };
      }),
      lifestyle: config.lifestyle || {},
      goals: (config.goals || []).map(function(g) {
        return { id: uid(), _wizId: g._wizId || uid(), emoji: g.emoji || '🎯', name: g.name || '', target: g.target || 0, notes: g.notes || '', saved: 0, monthly: 0 };
      }),
      features: config.features || {},
      budgets: config.budgets || {},
      categories: config.categories || [],
    };
    openSetupWizard(window.wizData);
  } catch (e) {
    hhAlert('Could not load the shared config: ' + e.message, '⚠️', 'Import Error');
  }
}

function _buildShareConfig() {
  // Same shape as exportShareableConfig but returned as an object (not downloaded)
  return {
    _type: 'homehub_config',
    _version: HH_VERSION,
    _exported: new Date().toISOString().split('T')[0],
    household: { name: state.household.name, emoji: state.household.emoji, province: state.household.province, city: state.household.city },
    members: (state.members || []).map(function(m) {
      return { name: m.name, dob: m.dob || '', color: m.color, incomeType: m.incomeType, hasTips: !!m.hasTips, hasPension: !!m.hasPension, hasHealthBenefits: !!m.hasHealthBenefits, isFirstTimeBuyer: !!m.isFirstTimeBuyer, monthlyIncome: m.monthlyIncome || 0 };
    }),
    children: (state.children || []).map(function(c) { return { name: c.name, dob: c.dob || '', color: c.color || '' }; }),
    pets: (state.pets || []).map(function(p) { return { name: p.name, emoji: p.emoji, type: p.type }; }),
    lifestyle: state.lifestyle || {},
    goals: (state.goals || []).map(function(g) { return { emoji: g.emoji, name: g.name, target: g.target, notes: g.notes || '', _wizId: g._wizId || g.id }; }),
    features: state.features || {},
    budgets: state.budgets || {},
    categories: (state.categories || []).map(function(c) { return { id: c.id, name: c.name, color: c.color }; }),
  };
}

function generateShareURL() {
  var config = _buildShareConfig();
  var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
  var url = window.location.href.split('#')[0] + '#setup=' + encoded;
  return url;
}

function copyShareURL() {
  var url = generateShareURL();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function() {
      hhToast('Share link copied to clipboard!', '🔗');
    }).catch(function() {
      _fallbackCopyShareURL(url);
    });
  } else {
    _fallbackCopyShareURL(url);
  }
  // Refresh the input in the modal too
  var inp = document.getElementById('share-url-input');
  if (inp) inp.value = url;
}

function _fallbackCopyShareURL(url) {
  var ta = document.createElement('textarea');
  ta.value = url;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); hhToast('Share link copied!', '🔗'); } catch(e) {}
  document.body.removeChild(ta);
}

function openShareModal() {
  var url = generateShareURL();
  var body = document.getElementById('share-modal-body');
  if (!body) return;
  body.innerHTML = [
    '<div style="margin-bottom:20px">',
    '  <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--text2);margin-bottom:8px">🔗 Share Link</div>',
    '  <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">',
    '    <input id="share-url-input" type="text" readonly value="" style="flex:1;font-size:11px;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text2);font-family:monospace;cursor:text" onclick="this.select()">',
    '    <button class="btn btn-primary btn-sm" onclick="copyShareURL()">📋 Copy</button>',
    '  </div>',
    '  <div style="font-size:11px;color:var(--muted)">Anyone who opens this link will see the Setup Wizard pre-filled with your household template. Their data stays separate from yours.</div>',
    '</div>',
    '<div style="margin-bottom:20px">',
    '  <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--text2);margin-bottom:8px">📱 QR Code</div>',
    '  <div id="share-qr-container" style="display:flex;justify-content:center;padding:16px;background:var(--surface);border-radius:12px;border:1px solid var(--border)">',
    '    <div id="share-qr-canvas"></div>',
    '  </div>',
    '</div>',
    '<div style="border-top:1px solid var(--border);padding-top:16px">',
    '  <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--text2);margin-bottom:8px">📁 File Download</div>',
    '  <button class="btn btn-ghost" style="width:100%" onclick="exportShareableConfig()">⬇️ Download config file instead</button>',
    '  <div style="font-size:11px;color:var(--muted);margin-top:6px">Old-school method: download a .json file and send it directly.</div>',
    '</div>',
  ].join('\n');

  // Set the URL in the input
  var inp = document.getElementById('share-url-input');
  if (inp) inp.value = url;

  openModal('modal-share');

  // Load QR code library and render
  _loadQRAndRender(url);
}

function _loadQRAndRender(url) {
  if (window.QRCode) {
    _renderQR(url);
    return;
  }
  var script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  script.onload = function() { _renderQR(url); };
  script.onerror = function() {
    var c = document.getElementById('share-qr-canvas');
    if (c) c.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center">QR code unavailable offline.<br>Copy the link above instead.</div>';
  };
  document.head.appendChild(script);
}

function _renderQR(url) {
  var container = document.getElementById('share-qr-canvas');
  if (!container) return;
  container.innerHTML = '';
  try {
    new QRCode(container, { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
  } catch(e) {
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center">Could not render QR code.</div>';
  }
}

function wizFinish() {
  // Save household
  state.household = { name: wizData.household.name, emoji: wizData.household.emoji, province: wizData.household.province, city: wizData.household.city, setupComplete: true };

  // Save members
  state.members = wizData.members.map(function(m) {
    return { id: m.id, name: m.name.trim(), dob: m.dob||'', color: m.color, incomeType: m.incomeType, hasTips: m.hasTips, hasPension: m.hasPension, hasHealthBenefits: m.hasHealthBenefits||false, isFirstTimeBuyer: m.isFirstTimeBuyer, monthlyIncome: m.monthlyIncome||0 };
  });

  // Save pets
  state.pets = wizData.pets.map(function(p) {
    return { id: p.id, name: p.name.trim() || p.type, emoji: p.emoji, type: p.type };
  });
  // Init pet feeding
  var today = new Date().toISOString().split('T')[0];
  if (!state.petFeeding) state.petFeeding = {};
  state.pets.forEach(function(pet) {
    if (!state.petFeeding[pet.id]) state.petFeeding[pet.id] = { fed:false, time:null, date:today };
  });

  // Save children
  state.children = (wizData.children || []).filter(function(c){ return c.name.trim() || c.dob; }).map(function(c) {
    return { id: c.id||uid(), name: c.name.trim()||'Child', dob: c.dob||'', color: c.color||'var(--accent)' };
  });

  // Save lifestyle details
  state.lifestyle = wizData.lifestyle || {};

  // ── Seed dietPrefs from lifestyle data if not yet customised ─────────────
  // Only auto-fill fields that are still at their factory defaults so we never
  // overwrite deliberate changes the user made in the Meal Preferences modal.
  var dp = state.dietPrefs || {};
  var isDefaultDiet = !dp.avoid && !dp.favourites && !dp.notes &&
    (dp.complexity === 'moderate' || !dp.complexity) &&
    JSON.stringify(dp.dietStyle || ['omnivore']) === JSON.stringify(['omnivore']);

  if (isDefaultDiet) {
    var ls = state.lifestyle || {};
    // Allergies → avoid list
    if (ls.allergies && ls.allergies.trim()) {
      dp.avoid = ls.allergies.trim();
    }
    // Member diets → dietStyle (union of all members, mapped to dietPrefs values)
    var dietMap = {
      omnivore:'omnivore', vegetarian:'vegetarian', vegan:'vegetarian',
      pescatarian:'omnivore', glutenfree:'omnivore', dairyfree:'omnivore',
      halal:'omnivore', kosher:'omnivore'
    };
    var allDiets = [];
    Object.values(ls.memberDiets || {}).forEach(function(arr) {
      (arr || []).forEach(function(d) { if (allDiets.indexOf(d) === -1) allDiets.push(d); });
    });
    if (allDiets.length) {
      // Build a dietStyle list — keep specific flags like vegetarian; default to omnivore
      var styleSet = [];
      if (allDiets.indexOf('vegetarian') !== -1 || allDiets.indexOf('vegan') !== -1) styleSet.push('vegetarian');
      else styleSet.push('omnivore');
      if (allDiets.indexOf('glutenfree') !== -1 || allDiets.indexOf('dairyfree') !== -1) styleSet.push('low-carb');
      dp.dietStyle = styleSet.length ? styleSet : ['omnivore'];
    }
    // Housing cost → budget hint (sets housing budget if wizard budget step was skipped/zero)
    if (ls.housingCost && ls.housingCost > 0 && (!state.budgets.housing || state.budgets.housing === 0)) {
      state.budgets.housing = ls.housingCost;
    }
    state.dietPrefs = dp;
  }

  // Generate goals (only if no goals yet, or if resetting)
  var goalTemplates = {
    wedding: { emoji:'💍', name:'Wedding Fund', target:25000, notes:'TFSA' },
    house:   { emoji:'🏠', name:'House Down Payment', target:80000, notes:'FHSA + RRSP HBP', link:'https://www.ratehub.ca/mortgage-affordability-calculator' },
    car:     { emoji:'🚗', name:'Car / Vehicle Fund', target:20000, notes:'Savings account' },
    travel:  { emoji:'✈️', name:'Travel Fund', target:5000, notes:'TFSA' },
    emergency:{ emoji:'🛡️', name:'Emergency Fund', target:15000, notes:'HISA' },
    retirement:{ emoji:'🌅', name:'Retirement', target:500000, notes:'RRSP + TFSA' },
    education: { emoji:'🎓', name:'Education / RESP', target:50000, notes:'RESP' },
    renovation:{ emoji:'🔨', name:'Home Renovations', target:20000, notes:'HELOC or TFSA' },
    baby:    { emoji:'👶', name:'Starting a Family', target:15000, notes:'TFSA' },
    business:{ emoji:'💼', name:'Business Fund', target:20000, notes:'Savings account' },
  };
  if (!state.goals || !state.goals.length) {
    var now = new Date();
    state.goals = wizData.goals.map(function(gId) {
      var tmpl = goalTemplates[gId] || { emoji:'🎯', name:gId, target:10000, notes:'' };
      return { id: uid(), _wizId: gId, emoji: tmpl.emoji, name: tmpl.name, target: tmpl.target, current: 0, date: new Date(now.getFullYear()+2, now.getMonth(), 1).toISOString().split('T')[0], notes: tmpl.notes, link: tmpl.link||'' };
    });
  }

  // Update budgets
  if (wizData.budgets) {
    Object.assign(state.budgets, wizData.budgets);
  }

  // Setup gcalConfig for each member
  if (!state.gcalConfig) state.gcalConfig = {};
  state.members.forEach(function(m) {
    if (!state.gcalConfig[m.id]) state.gcalConfig[m.id] = { url:'', name: m.name + "'s Calendar" };
  });

  // Weather location
  if (state.household.city) {
    state.weatherLocations = [{ city: state.household.city, province: state.household.province }];
    state.weatherLocationIndex = 0;
  }

  // Apply features chosen in wizard step 3
  if (wizData.features) {
    state.features = wizData.features;
  } else {
    if (!state.features) state.features = { calendar:true, tips:true, grocery:true, pets:true, upload:true };
  }
  if ((state.members||[]).find(function(m){return m.hasTips;})) state.features.tips = true;
  if ((state.pets||[]).length > 0) state.features.pets = true;
  saveState();
  closeSetupWizard();
  seedCareerDataFromMembers();
  applyHouseholdConfig();
  renderDashboard();
}


// ── Feature Toggle System ──────────────────────────────────────────────────
var FEATURE_DEFS = [
  { id:'calendar', label:'📅 Calendar',             desc:'Sync & view personal calendars' },
  { id:'tips',     label:'💵 Cash Tips',             desc:'Track tip income and CRA reserve' },
  { id:'grocery',  label:'🛒 Grocery & Meal Plan',   desc:'Flyers, meal planning, pantry, shopping list' },
  { id:'pets',     label:'🐾 Pet Tracker',            desc:'Feeding tracker, vet visits, vaccinations & medications for Ellie & Jim' },
  { id:'upload',   label:'📤 Statement Upload',       desc:'Import bank & credit card CSVs / PDFs' },
  { id:'wedding',  label:'💍 Wedding Planner',        desc:'Vendor tracking, budget, deposit alerts & countdown' },
  { id:'house',    label:'🏡 Down Payment Planner',    desc:'FHSA, HBP, CMHC, LTT & savings projection for your first home' },
  { id:'bills',    label:'🧾 Bill & Subscription Tracker', desc:'Track recurring bills, get due-date alerts, spot unused subscriptions' },
  { id:'networth', label:'📈 Net Worth Timeline',          desc:'Month-over-month net worth chart, asset & liability breakdown' },
  { id:'carfunds',     label:'🚗 Car Fund Tracker',            desc:'Save toward one or more vehicle goals with projected purchase dates' },
  { id:'maintenance',  label:'🔧 Household Maintenance',       desc:'Track recurring home tasks, get overdue alerts, never miss a furnace filter again' },
  { id:'tax',          label:'🧾 Tax Prep Helper',             desc:'CRA summary, RRSP planner, Holly\'s tips breakdown, key deadlines — all in one place' },
  { id:'retirement',   label:'📊 Retirement Projector',        desc:'Project Matt\'s pension + RRSP/TFSA, CPP/OAS estimates, and retirement income timeline' },
  { id:'career',       label:'💼 Career Planner',              desc:'Track roles, plan promotions, log training — salary milestones feed the Forecast & Retirement projectors' },
];

function getFeatures() {
  if (!state.features) state.features = { calendar:true, tips:true, grocery:true, pets:true, upload:true };
  return state.features;
}

function isFeatureOn(id) { return getFeatures()[id] !== false; }

function applyFeatureToggles() {
  var f = getFeatures();
  // Map feature id → { navId, pageId }
  var map = [
    { id:'calendar', navId:'nav-calendar-btn', pageId:'page-calendar' },
    { id:'tips',     navId:'nav-tips-btn',      pageId:'page-tips'     },
    { id:'grocery',  navId:'nav-grocery-btn',   pageId:'page-grocery'  },
    { id:'upload',   navId:'nav-upload-btn',    pageId:'page-upload'   },
    { id:'wedding',  navId:'nav-wedding-btn',   pageId:'page-wedding'  },
    { id:'house',    navId:'nav-house-btn',      pageId:'page-house'    },
    { id:'pets',     navId:'nav-pets-btn',        pageId:'page-pets'     },
    { id:'bills',    navId:'nav-bills-btn',       pageId:'page-bills'    },
    { id:'networth', navId:'nav-networth-btn',    pageId:'page-networth' },
    { id:'carfunds',    navId:'nav-cars-btn',              pageId:'page-cars'        },
    { id:'maintenance', navId:'nav-maintenance-btn',       pageId:'page-maintenance' },
    { id:'tax',         navId:'nav-tax-btn',               pageId:'page-tax'         },
    { id:'retirement',  navId:'nav-retirement-btn',        pageId:'page-retirement'  },
    { id:'career',      navId:'nav-career-btn',            pageId:'page-career'      },
  ];
  map.forEach(function(m) {
    var show = f[m.id] !== false;
    // Nav button
    var navBtn = document.getElementById(m.navId);
    if (navBtn) {
      if (m.id === 'tips') {
        // Tips button already controlled by hasTips — only show if BOTH feature is on AND someone has tips
        var tipsMember = getTipsMember();
        navBtn.style.display = (show && tipsMember) ? '' : 'none';
      } else {
        navBtn.style.display = show ? '' : 'none';
      }
    }
    // Page visibility (hide so if someone lands on a disabled page it shows nothing)
    var pageEl = document.getElementById(m.pageId);
    if (pageEl && !show) pageEl.classList.remove('active');
  });
  // Pet tracker widget on dashboard — controlled by pets feature
  var petWidget = document.getElementById('pet-feeding-card');
  if (petWidget) petWidget.style.display = f['pets'] !== false ? '' : 'none';
  // Update topbar title in case tips member name changed
  var activePage = document.querySelector('.page.active');
  if (activePage) {
    var curId = activePage.id.replace('page-','');
    var tbTitle = document.getElementById('topbar-title');
    if (tbTitle) {
      var PAGE_TITLES2 = { dashboard:'🏠 Home', calendar:'📅 Calendar', transactions:'📋 Transactions', budget:'💰 Budget', goals:'🎯 Goals', tips:'💵 Tips', grocery:'🛒 Grocery', upload:'📤 Upload' };
      var tipsM2 = getTipsMember();
      if (curId==='tips' && tipsM2) tbTitle.textContent = '💵 ' + tipsM2.name + "'s Tips";
      else tbTitle.textContent = PAGE_TITLES2[curId] || curId;
    }
  }
}

function openFeaturesModal() {
  var f = getFeatures();
  var list = document.getElementById('features-toggle-list');
  if (!list) return;
  list.innerHTML = FEATURE_DEFS.map(function(def) {
    var checked = f[def.id] !== false;
    var extra = '';
    if (def.id === 'tips' && !(state.members||[]).find(function(m){return m.hasTips;})) {
      extra = '<div style="font-size:11px;color:var(--muted);margin-top:2px">⚠️ No household member is set up as a tip earner. Edit Setup to enable this.</div>';
    }
    if (def.id === 'pets' && !(state.pets||[]).length) {
      extra = '<div style="font-size:11px;color:var(--muted);margin-top:2px">⚠️ No pets are configured. Edit Setup to add pets first.</div>';
    }
    return '<label style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;cursor:pointer;background:var(--card)">'
      + '<input type="checkbox" data-fid="' + def.id + '"' + (checked?' checked':'') + ' style="width:16px;height:16px;margin-top:2px;accent-color:var(--accent);flex-shrink:0">'
      + '<div><div style="font-size:14px;font-weight:700;color:var(--text)">' + def.label + '</div>'
      + '<div style="font-size:12px;color:var(--muted)">' + def.desc + '</div>'
      + extra + '</div></label>';
  }).join('');
  openModal('features-modal');
}

function saveFeatures() {
  var f = getFeatures();
  document.querySelectorAll('#features-toggle-list input[data-fid]').forEach(function(cb) {
    f[cb.dataset.fid] = cb.checked;
  });
  state.features = f;
  saveState();
  applyFeatureToggles();
  populatePersonSelects(); // refresh nav tips button state
  closeModal('features-modal');
  // If currently on a now-disabled page, go home
  var activePage = document.querySelector('.page.active');
  if (activePage) {
    var pageId = activePage.id.replace('page-','');
    var featureMap = { calendar:'calendar', tips:'tips', grocery:'grocery', upload:'upload', wedding:'wedding', house:'house', pets:'pets', bills:'bills', networth:'networth', cars:'carfunds', maintenance:'maintenance', tax:'tax', retirement:'retirement', career:'career' };
    if (featureMap[pageId] && !isFeatureOn(featureMap[pageId])) showPage('dashboard');
  }
  hhToast('Features updated!','✅');
}
// ── End Feature Toggle System ─────────────────────────────────────────────

function applyHouseholdConfig() {
  var household = state.household || {};
  // Nav brand
  var navBrand = document.getElementById('nav-brand');
  if (navBrand) navBrand.textContent = (household.emoji || '🏠') + ' ' + (household.name || 'Home Hub');
  // Populate all person selects
  populatePersonSelects();
  populateAccountDropdowns();
  renderAccountsList();
  // Goals tax tip
  var goalsTipEl = document.getElementById('goals-tax-tip');
  if (goalsTipEl) {
    var prov = household.province || 'ON';
    var fhsaMs = (state.members||[]).filter(function(m){return m.isFirstTimeBuyer;});
    var tipMs = getTipsMember();
    var tip = '💡 ';
    if (prov === 'ON') tip += 'Ontario: ';
    else if (prov === 'BC') tip += 'BC: ';
    else if (prov === 'QC') tip += 'Quebec: ';
    else tip += prov + ': ';
    tip += 'TFSA for flexible goals (tax-free growth, $7,000/yr). ';
    if (fhsaMs.length) tip += fhsaMs.map(function(m){return m.name;}).join(' & ') + ' qualify for FHSA ($8,000/yr tax-deductible). ';
    if (tipMs) tip += tipMs.name + "'s tips are taxable — see the Tips page for CRA tracking. ";
    tip += 'Click a goal name to visit its linked webpage.';
    goalsTipEl.textContent = tip;
  }
  // Tips page alert
  var tipsAlertEl = document.getElementById('tips-page-alert');
  if (tipsAlertEl) {
    var prov2 = household.province || 'ON';
    tipsAlertEl.textContent = '⚠️ Cash tips ARE taxable in ' + prov2 + ' / Canada. Keep records — CRA expects you to report them. Set aside ~20–25% for tax season.';
  }
  // Apply feature visibility
  applyFeatureToggles();
}

// ═══════════════════════════════════════════════════════════════════════════
// CAREER PLANNER  — V6.27
// ═══════════════════════════════════════════════════════════════════════════

// ── Active member tab for career page ────────────────────────────────────
var _careerActiveMemberId = null;

// ── Seed careerData from wizard member profiles ───────────────────────────
// Called once on first load and whenever a member is added via Setup.
// Only fills fields that haven't been manually edited yet (no overwrite).
function seedCareerDataFromMembers() {
  if (!state.careerData) state.careerData = {};
  (state.members || []).forEach(function(m) {
    var existing = state.careerData[m.id] || {};
    // Only auto-fill if these specific fields are still blank
    var seeded = {
      memberId:    m.id,
      memberName:  m.name,
      title:       existing.title       || '',
      employer:    existing.employer    || '',
      empType:     existing.empType     || m.incomeType || 'salary',
      startDate:   existing.startDate   || '',
      salary:      existing.salary      || (m.monthlyIncome ? Math.round(m.monthlyIncome * 12) : 0),
      hourlyRate:  existing.hourlyRate  || 0,
      pension:     existing.pension     || (m.hasPension ? 'db' : 'none'),
      benefits:    existing.benefits    || (m.hasHealthBenefits ? 'full' : 'none'),
      yearsService:existing.yearsService|| 0,
      industry:    existing.industry    || '',
      notes:       existing.notes       || '',
      milestones:  existing.milestones  || [],
      training:    existing.training    || [],
    };
    // Default titles based on known roles
    if (!seeded.title) {
      if (m.incomeType === 'salary')  seeded.title = 'Employee';
      if (m.incomeType === 'hourly')  seeded.title = 'Team Member';
      if (m.hasTips)                  seeded.title = 'Server';
    }
    state.careerData[m.id] = seeded;
  });
  saveState();
}

// ── Helper: get career profile for a member id ────────────────────────────
function getCareerProfile(memberId) {
  if (!state.careerData) state.careerData = {};
  return state.careerData[memberId] || null;
}

// ── Helper: get projected salary at a given date from milestones ──────────
// Used by Forecast and Retirement to pull salary trajectory per member.
function getProjectedSalaryAt(memberId, targetDateStr) {
  var profile = getCareerProfile(memberId);
  if (!profile) return 0;
  var base = profile.salary || 0;
  var milestones = (profile.milestones || [])
    .filter(function(ms) { return ms.salary > 0 && ms.date && ms.date <= targetDateStr; })
    .sort(function(a, b) { return a.date.localeCompare(b.date); });
  if (!milestones.length) return base;
  return milestones[milestones.length - 1].salary;
}

// ── Helper: get all salary milestones for the forecast chart ─────────────
function getCareerSalarySteps(memberId) {
  // Returns array of {date, salary} sorted chronologically, starting from today
  var profile = getCareerProfile(memberId);
  if (!profile) return [];
  var steps = [{ date: new Date().toISOString().split('T')[0], salary: profile.salary || 0 }];
  (profile.milestones || [])
    .filter(function(ms) { return ms.salary > 0 && ms.date; })
    .sort(function(a, b) { return a.date.localeCompare(b.date); })
    .forEach(function(ms) { steps.push({ date: ms.date, salary: ms.salary }); });
  return steps;
}

// ── RENDER: Main career page ──────────────────────────────────────────────
function renderCareer() {
  // Ensure careerData is seeded from member profiles
  seedCareerDataFromMembers();
  var members = state.members || [];
  if (!members.length) {
    document.getElementById('career-content').innerHTML =
      '<div class="empty-state">No household members found. Complete ⚙️ Setup first to add members.</div>';
    return;
  }
  // Default active tab to first member
  if (!_careerActiveMemberId || !members.find(function(m){ return m.id === _careerActiveMemberId; })) {
    _careerActiveMemberId = members[0].id;
  }
  // Build member tabs
  var tabsEl = document.getElementById('career-member-tabs');
  tabsEl.innerHTML = members.map(function(m) {
    var active = m.id === _careerActiveMemberId;
    return '<button onclick="switchCareerTab(\'' + m.id + '\')" style="background:none;border:none;'
      + 'border-bottom:3px solid ' + (active ? m.color || 'var(--accent)' : 'transparent') + ';'
      + 'padding:9px 20px;font-size:13px;font-weight:' + (active ? '800' : '600') + ';'
      + 'color:' + (active ? (m.color || 'var(--accent)') : 'var(--muted)') + ';cursor:pointer;'
      + 'transition:all 0.15s;font-family:Nunito,sans-serif">'
      + (m.emoji || '👤') + ' ' + m.name + '</button>';
  }).join('');
  // Render active member
  renderCareerMember(_careerActiveMemberId);
}

function switchCareerTab(memberId) {
  _careerActiveMemberId = memberId;
  renderCareer();
}

function renderCareerMember(memberId) {
  var profile = getCareerProfile(memberId);
  var member  = (state.members || []).find(function(m){ return m.id === memberId; });
  if (!profile || !member) return;
  var container = document.getElementById('career-content');
  var color = member.color || 'var(--accent)';
  var today = new Date(); today.setHours(0,0,0,0);
  var milestones = (profile.milestones || []).sort(function(a, b){ return a.date.localeCompare(b.date); });
  var training   = (profile.training   || []).sort(function(a, b){ return (a.date || '9999').localeCompare(b.date || '9999'); });

  // ── Ontario tax + RRSP impact of career growth ──────────────────────────
  var currentSalary   = profile.salary || 0;
  var futureSalaries  = milestones.filter(function(ms){ return ms.salary > 0; });
  var peakSalary      = futureSalaries.length
    ? futureSalaries.reduce(function(mx, ms){ return ms.salary > mx ? ms.salary : mx; }, currentSalary)
    : currentSalary;
  var currentRrspRoom = Math.round(currentSalary * 0.18);
  var peakRrspRoom    = Math.round(peakSalary    * 0.18);
  var currentMarginal = Math.round(getMarginalRate(currentSalary) * 100);
  var peakMarginal    = Math.round(getMarginalRate(peakSalary)    * 100);

  // ── Total training cost ──────────────────────────────────────────────────
  var totalTrainingCost = training.reduce(function(s, t){
    return s + (t.reimbursed ? 0 : (t.cost || 0));
  }, 0);
  var inProgressCount  = training.filter(function(t){ return t.status === 'in_progress'; }).length;
  var completedCount   = training.filter(function(t){ return t.status === 'completed'; }).length;
  var expiredCount     = training.filter(function(t){ return t.status === 'expired'; }).length;

  // ── EMPLOYMENT TYPE LABEL ────────────────────────────────────────────────
  var empLabels = { salary:'💼 Salaried', hourly:'⏰ Hourly', selfemployed:'🧾 Self-Employed', parttime:'🕐 Part-Time', freelance:'💻 Freelance' };
  var pensionLabels = { db:'🏛️ Defined Benefit', dc:'💼 Defined Contribution', none:'❌ None' };
  var benefitsLabels = { full:'✅ Full Benefits', partial:'⚡ Partial Benefits', none:'❌ No Benefits' };

  // ── SERVICE LENGTH ───────────────────────────────────────────────────────
  var serviceStr = '';
  if (profile.startDate) {
    var sd = new Date(profile.startDate + 'T00:00:00');
    var mos = (today.getFullYear() - sd.getFullYear()) * 12 + (today.getMonth() - sd.getMonth());
    serviceStr = mos >= 24 ? Math.floor(mos/12) + ' yr' + (Math.floor(mos/12)===1?'':'s') : mos + ' month' + (mos===1?'':'s');
  } else if (profile.yearsService > 0) {
    serviceStr = profile.yearsService + ' yr' + (profile.yearsService===1?'':'s') + ' (estimated)';
  }

  // ── TIMELINE HTML ────────────────────────────────────────────────────────
  var LIKELIHOOD_COLORS = { planned:'var(--green)', likely:'var(--accent)', possible:'var(--muted)' };
  var LIKELIHOOD_LABELS = { planned:'✅ Planned', likely:'📈 Likely', possible:'🤔 Possible' };
  var MILESTONE_ICONS   = { promotion:'🏆', raise:'💰', role_change:'🔄', certification:'📜', retirement:'🌅', other:'📌' };

  var timelineHtml = '';
  if (!milestones.length) {
    timelineHtml = '<div style="text-align:center;padding:28px;color:var(--muted);font-size:13px">'
      + '<div style="font-size:36px;margin-bottom:8px">🏆</div>'
      + '<div style="font-weight:700;margin-bottom:6px">No milestones yet</div>'
      + '<div style="margin-bottom:14px">Add a promotion, raise, or career goal to see your trajectory.</div>'
      + '<button class="btn btn-primary" onclick="openAddMilestoneModal(\'' + memberId + '\')">+ Add First Milestone</button>'
      + '</div>';
  } else {
    // Current position node
    timelineHtml = '<div style="display:flex;flex-direction:column;gap:0">';
    // "Today" node
    timelineHtml += _careerTimelineNode({
      icon: '📍', title: profile.title || 'Current Role',
      subtitle: profile.employer || '',
      badge: serviceStr ? serviceStr + ' service' : '',
      salary: currentSalary, hourlyRate: profile.hourlyRate || 0,
      empType: profile.empType,
      color: color, isToday: true, date: ''
    });
    milestones.forEach(function(ms, i) {
      var mDate = ms.date ? new Date(ms.date + 'T00:00:00') : null;
      var isPast = mDate && mDate < today;
      var daysAway = mDate ? Math.ceil((mDate - today) / 86400000) : null;
      var dateLabel = mDate ? mDate.toLocaleDateString('en-CA', { year:'numeric', month:'long' }) : '';
      var timeAway  = daysAway !== null
        ? (isPast ? Math.abs(Math.round(daysAway / 30)) + ' mo ago' : daysAway < 60 ? daysAway + ' days' : Math.round(daysAway / 30) + ' mo away')
        : '';
      var salaryIncrease = (ms.salary > 0 && currentSalary > 0)
        ? '+' + fmt(ms.salary - currentSalary) + '/yr (' + Math.round((ms.salary - currentSalary) / currentSalary * 100) + '%)'
        : '';
      // Find training items linked to this milestone
      var linked = training.filter(function(t){ return t.linkedMilestone === ms.id; });
      timelineHtml += _careerTimelineNode({
        id: ms.id, memberId: memberId,
        icon: MILESTONE_ICONS[ms.type] || '📌',
        title: ms.title,
        subtitle: ms.newTitle || '',
        badge: LIKELIHOOD_LABELS[ms.likelihood] || '',
        badgeColor: LIKELIHOOD_COLORS[ms.likelihood] || 'var(--muted)',
        salary: ms.salary || 0, hourlyRate: ms.hourlyRate || 0,
        salaryIncrease: salaryIncrease,
        dateLabel: dateLabel, timeAway: timeAway, isPast: isPast,
        notes: ms.notes,
        color: isPast ? 'var(--muted)' : (LIKELIHOOD_COLORS[ms.likelihood] || color),
        isToday: false, linkedTraining: linked
      });
    });
    timelineHtml += '</div>';
  }

  // ── TRAINING TABLE ───────────────────────────────────────────────────────
  var STATUS_COLORS  = { not_started:'var(--muted)', in_progress:'var(--accent)', completed:'var(--green)', expired:'var(--red)' };
  var STATUS_LABELS  = { not_started:'🔲 Not Started', in_progress:'⏳ In Progress', completed:'✅ Completed', expired:'⚠️ Renewal Needed' };
  var CAT_ICONS      = { certification:'📜', course:'📖', degree:'🎓', mandatory:'⚠️', skills:'🛠️', license:'🪪' };

  var trainingHtml = '';
  if (!training.length) {
    trainingHtml = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">'
      + 'No courses or certifications yet. <button class="btn btn-ghost btn-sm" onclick="openAddTrainingModal(\'' + memberId + '\')" style="margin-left:8px">+ Add Training</button></div>';
  } else {
    // Group: urgent first (in_progress / expired / not_started with date), then completed
    var urgent    = training.filter(function(t){ return t.status !== 'completed'; });
    var completed = training.filter(function(t){ return t.status === 'completed'; });
    var renderRow = function(t) {
      var daysUntil = t.date ? Math.ceil((new Date(t.date + 'T00:00:00') - today) / 86400000) : null;
      var dueTxt = daysUntil === null ? '' : daysUntil < 0 ? 'Overdue!' : daysUntil === 0 ? 'Today!' : daysUntil + 'd';
      var dueColor = daysUntil !== null && daysUntil <= 14 ? 'var(--red)' : daysUntil !== null && daysUntil <= 60 ? 'var(--yellow)' : 'var(--muted)';
      var linkedMs = t.linkedMilestone ? (profile.milestones || []).find(function(ms){ return ms.id === t.linkedMilestone; }) : null;
      var costNet = t.reimbursed ? 0 : (t.cost || 0);
      return '<tr>'
        + '<td><span style="font-size:15px">' + (CAT_ICONS[t.category] || '📖') + '</span></td>'
        + '<td style="font-weight:700;font-size:13px">' + t.name
          + (t.provider ? '<div style="font-size:11px;color:var(--muted)">' + t.provider + '</div>' : '')
        + '</td>'
        + '<td><span style="font-size:11px;font-weight:700;background:' + STATUS_COLORS[t.status] + '22;color:' + STATUS_COLORS[t.status] + ';border-radius:5px;padding:2px 7px">' + STATUS_LABELS[t.status] + '</span></td>'
        + '<td style="font-size:12px' + (daysUntil !== null && daysUntil < 0 ? ';color:var(--red);font-weight:700' : '') + '">'
          + (t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString('en-CA', {month:'short', year:'numeric'}) : '—')
          + (dueTxt ? '<div style="font-size:10px;font-weight:800;color:' + dueColor + '">' + dueTxt + '</div>' : '')
        + '</td>'
        + '<td style="font-size:12px">' + (t.cost > 0 ? fmt(t.cost) + (t.reimbursed ? ' <span style="color:var(--green);font-size:10px">✓ reimbursed</span>' : '') : '—') + '</td>'
        + '<td style="font-size:12px;color:var(--muted)">' + (linkedMs ? '🔗 ' + linkedMs.title.substring(0, 25) : '—') + '</td>'
        + '<td><div style="display:flex;gap:4px">'
          + '<button class="btn btn-ghost btn-sm" onclick="openEditTrainingModal(\'' + memberId + '\',\'' + t.id + '\')">✏️</button>'
          + '<button class="btn btn-danger btn-sm" onclick="deleteCareerTraining(\'' + memberId + '\',\'' + t.id + '\')">🗑️</button>'
        + '</div></td>'
        + '</tr>';
    };
    trainingHtml = '<div class="table-wrap"><table><thead><tr>'
      + '<th></th><th>Course / Certification</th><th>Status</th><th>Date</th><th>Cost</th><th>Linked To</th><th></th>'
      + '</tr></thead><tbody>'
      + urgent.map(renderRow).join('')
      + (completed.length && urgent.length ? '<tr><td colspan="7" style="padding:8px 0;font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-top:1px solid var(--border)">Completed</td></tr>' : '')
      + completed.map(renderRow).join('')
      + '</tbody></table></div>';
  }

  // ── ONTARIO FINANCIAL IMPACT PANEL ───────────────────────────────────────
  var rrspImpact = peakSalary > currentSalary
    ? '<div style="font-size:12px;color:var(--green);margin-top:4px">↑ RRSP room grows to ~' + fmt(peakRrspRoom) + '/yr at peak salary</div>'
    : '';
  var marginalImpact = peakMarginal > currentMarginal
    ? '<div style="font-size:12px;color:var(--yellow);margin-top:4px">⚠️ Marginal rate rises from ' + currentMarginal + '% → ' + peakMarginal + '% — maximize RRSP contributions as salary grows</div>'
    : '';

  // ── ASSEMBLE PAGE ────────────────────────────────────────────────────────
  container.innerHTML =

    // ── ROW 1: Profile snapshot stats ──────────────────────────────────────
    '<div class="grid-4" style="margin-bottom:16px">'
      + _cstat(profile.title || '—', 'Current Title', color)
      + _cstat(profile.employer || '—', 'Employer', 'var(--text)')
      + _cstat(currentSalary > 0 ? fmt(currentSalary) + '/yr' : (profile.hourlyRate > 0 ? '$' + profile.hourlyRate + '/hr' : '—'), 'Current Compensation', 'var(--green)')
      + _cstat(serviceStr || '—', 'Time at Employer', 'var(--muted)')
    + '</div>'

    // ── ROW 2: Meta badges + edit button ────────────────────────────────────
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px">'
      + '<span style="font-size:12px;font-weight:700;background:' + color + '18;color:' + color + ';border:1.5px solid ' + color + '44;border-radius:20px;padding:4px 12px">' + (empLabels[profile.empType] || '💼 Employee') + '</span>'
      + '<span style="font-size:12px;font-weight:700;background:var(--surface);border:1.5px solid var(--border);border-radius:20px;padding:4px 12px">' + (pensionLabels[profile.pension] || '—') + '</span>'
      + '<span style="font-size:12px;font-weight:700;background:var(--surface);border:1.5px solid var(--border);border-radius:20px;padding:4px 12px">' + (benefitsLabels[profile.benefits] || '—') + '</span>'
      + (profile.industry ? '<span style="font-size:12px;color:var(--muted);background:var(--surface);border:1.5px solid var(--border);border-radius:20px;padding:4px 12px">🏢 ' + profile.industry + '</span>' : '')
      + '<button class="btn btn-ghost btn-sm" onclick="openCareerSettingsModal(\'' + memberId + '\')" style="margin-left:auto">⚙️ Edit Profile</button>'
    + '</div>'

    // ── ROW 3: Ontario financial impact ─────────────────────────────────────
    + (currentSalary > 0 ? '<div class="card" style="margin-bottom:16px;border:2px solid color-mix(in srgb,var(--accent) 30%,transparent)">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<div class="card-title" style="margin:0">🇨🇦 Ontario Financial Impact</div>'
      + '</div>'
      + '<div class="grid-4" style="gap:10px">'
        + _cstat(fmt(currentSalary) + '/yr', 'Current Gross', 'var(--text)')
        + _cstat(currentMarginal + '%', 'Marginal Rate', currentMarginal >= 43 ? 'var(--red)' : 'var(--yellow)')
        + _cstat(fmt(currentRrspRoom) + '/yr', 'Current RRSP Room', 'var(--green)')
        + _cstat(peakSalary > currentSalary ? fmt(peakSalary) + '/yr' : '—', 'Projected Peak', 'var(--accent)')
      + '</div>'
      + rrspImpact + marginalImpact
      + (peakSalary > currentSalary
          ? '<div style="font-size:12px;color:var(--muted);margin-top:8px;padding:8px;background:var(--bg);border-radius:8px">💡 Each $1,000 salary increase = $180 more RRSP room. As you grow into higher brackets, pre-emptively contributing to your RRSP each year gives you a larger tax deduction when the rate matters most.</div>'
          : '')
      + '</div>' : '')

    // ── ROW 4: Career timeline + Training in grid ────────────────────────────
    + '<div class="grid-2" style="margin-bottom:16px">'

      // Timeline card
      + '<div class="card" style="margin-bottom:0">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
          + '<div class="card-title" style="margin:0">🗺️ Career Roadmap</div>'
          + '<button class="btn btn-primary btn-sm" onclick="openAddMilestoneModal(\'' + memberId + '\')">+ Milestone</button>'
        + '</div>'
        + timelineHtml
      + '</div>'

      // Training card
      + '<div class="card" style="margin-bottom:0">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
          + '<div class="card-title" style="margin:0">📚 Training & Certifications</div>'
          + '<button class="btn btn-primary btn-sm" onclick="openAddTrainingModal(\'' + memberId + '\')">+ Add</button>'
        + '</div>'
        + (training.length ? '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">'
            + '<span style="font-size:12px;font-weight:700;color:var(--accent)">⏳ ' + inProgressCount + ' in progress</span>'
            + '<span style="font-size:12px;font-weight:700;color:var(--green)">✅ ' + completedCount + ' completed</span>'
            + (expiredCount ? '<span style="font-size:12px;font-weight:700;color:var(--red)">⚠️ ' + expiredCount + ' need renewal</span>' : '')
            + (totalTrainingCost > 0 ? '<span style="font-size:12px;font-weight:700;color:var(--muted)">💰 ' + fmt(totalTrainingCost) + ' out of pocket</span>' : '')
          + '</div>' : '')
        + trainingHtml
      + '</div>'
    + '</div>'

    // ── ROW 5: Forecast integration callout ─────────────────────────────────
    + (milestones.filter(function(ms){return ms.salary>0;}).length > 0
        ? '<div class="card" style="border:2px solid color-mix(in srgb,var(--green) 35%,transparent)">'
          + '<div class="card-title">📈 Salary Growth → Financial Forecast</div>'
          + '<div style="font-size:13px;color:var(--text2);margin-bottom:10px">Your career milestones below feed directly into the <strong>Financial Forecast</strong> and <strong>Retirement Projector</strong> pages. Each confirmed raise updates monthly income projections automatically.</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:10px">'
          + milestones.filter(function(ms){return ms.salary>0;}).map(function(ms){
              var mDate = ms.date ? new Date(ms.date + 'T00:00:00') : null;
              var dateStr = mDate ? mDate.toLocaleDateString('en-CA',{month:'short',year:'numeric'}) : 'No date';
              return '<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:10px 14px;min-width:160px">'
                + '<div style="font-size:10px;text-transform:uppercase;font-weight:800;color:var(--muted);margin-bottom:4px">' + dateStr + '</div>'
                + '<div style="font-size:15px;font-weight:900;color:var(--green)">' + fmt(ms.salary) + '/yr</div>'
                + '<div style="font-size:12px;color:var(--muted)">' + ms.title + '</div>'
                + '</div>';
            }).join('')
          + '</div>'
          + '<div style="margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="showPage(\'budget\')">View Forecast →</button>'
          + ' <button class="btn btn-ghost btn-sm" onclick="showPage(\'retirement\')">View Retirement →</button></div>'
          + '</div>'
        : '')
    ;
}

// ── Helper: render one timeline node ─────────────────────────────────────
function _careerTimelineNode(opts) {
  var isFuture = !opts.isPast && !opts.isToday;
  var salaryLine = '';
  if (opts.salary > 0) {
    salaryLine = '<div style="font-size:13px;font-weight:800;color:var(--green)">' + fmt(opts.salary) + '/yr</div>';
  } else if (opts.hourlyRate > 0) {
    salaryLine = '<div style="font-size:13px;font-weight:800;color:var(--green)">$' + opts.hourlyRate + '/hr</div>';
  }
  var editBtns = opts.id ? '<div style="display:flex;gap:5px;flex-shrink:0">'
    + '<button class="btn btn-ghost btn-sm" onclick="openEditMilestoneModal(\'' + opts.memberId + '\',\'' + opts.id + '\')">✏️</button>'
    + '<button class="btn btn-danger btn-sm" onclick="deleteCareerMilestone(\'' + opts.memberId + '\',\'' + opts.id + '\')">🗑️</button>'
    + '</div>' : '';
  var linkedList = (opts.linkedTraining && opts.linkedTraining.length)
    ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">'
        + opts.linkedTraining.map(function(t){
            var sc = { not_started:'var(--muted)', in_progress:'var(--accent)', completed:'var(--green)', expired:'var(--red)' };
            return '<span style="font-size:10px;background:' + (sc[t.status]||'var(--muted)') + '18;color:' + (sc[t.status]||'var(--muted)') + ';border:1px solid ' + (sc[t.status]||'var(--muted)') + '44;border-radius:5px;padding:1px 6px;font-weight:700">📚 ' + t.name + '</span>';
          }).join('')
      + '</div>'
    : '';

  return '<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border)">'
    // Circle node
    + '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">'
      + '<div style="width:36px;height:36px;border-radius:50%;background:' + (opts.isToday ? opts.color : (opts.isPast ? 'var(--surface)' : opts.color + '22')) + ';border:2.5px solid ' + opts.color + ';display:flex;align-items:center;justify-content:center;font-size:16px">' + opts.icon + '</div>'
      + (opts.isToday ? '' : '<div style="width:2px;flex:1;min-height:16px;background:' + (isFuture ? 'var(--border)' : 'var(--accent)') + ';margin:4px 0;border-radius:2px"></div>')
    + '</div>'
    // Content
    + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'
        + '<div>'
          + '<div style="font-weight:800;font-size:14px;color:' + (opts.isPast ? 'var(--muted)' : 'var(--text)') + '">' + opts.title + (opts.isToday ? ' <span style="font-size:10px;font-weight:700;background:' + opts.color + ';color:#fff;border-radius:4px;padding:1px 6px">NOW</span>' : '') + '</div>'
          + (opts.subtitle ? '<div style="font-size:12px;color:var(--muted)">' + opts.subtitle + '</div>' : '')
          + (opts.dateLabel ? '<div style="font-size:11px;color:var(--muted);margin-top:1px">📅 ' + opts.dateLabel + (opts.timeAway ? ' · ' + opts.timeAway : '') + '</div>' : '')
          + (opts.badge ? '<div style="margin-top:4px"><span style="font-size:10px;font-weight:700;background:' + (opts.badgeColor||opts.color) + '18;color:' + (opts.badgeColor||opts.color) + ';border-radius:5px;padding:2px 7px">' + opts.badge + '</span></div>' : '')
          + (salaryLine ? '<div style="margin-top:4px">' + salaryLine + (opts.salaryIncrease ? '<span style="font-size:11px;color:var(--green);margin-left:6px">' + opts.salaryIncrease + '</span>' : '') + '</div>' : '')
          + (opts.notes ? '<div style="font-size:12px;color:var(--muted);margin-top:3px;font-style:italic">' + opts.notes + '</div>' : '')
          + linkedList
        + '</div>'
        + editBtns
      + '</div>'
    + '</div>'
  + '</div>';
}

// ── CAREER SETTINGS MODAL ─────────────────────────────────────────────────
function openCareerSettingsModal(memberId) {
  seedCareerDataFromMembers();
  var members = state.members || [];
  if (!members.length) { hhAlert('No household members set up yet. Complete ⚙️ Setup first.', '👤'); return; }
  // Populate member select
  var sel = document.getElementById('cs-member-select');
  sel.innerHTML = members.map(function(m){
    return '<option value="' + m.id + '">' + m.name + '</option>';
  }).join('');
  // Use passed memberId or active tab or first member
  var targetId = memberId || _careerActiveMemberId || members[0].id;
  sel.value = targetId;
  loadCareerSettingsForMember(targetId);
  openModal('career-settings-modal');
}

function loadCareerSettingsForMember(memberId) {
  var profile = getCareerProfile(memberId) || {};
  document.getElementById('cs-member-id').value = memberId;
  document.getElementById('cs-title').value       = profile.title       || '';
  document.getElementById('cs-employer').value    = profile.employer    || '';
  document.getElementById('cs-emptype').value     = profile.empType     || 'salary';
  document.getElementById('cs-startdate').value   = profile.startDate   || '';
  document.getElementById('cs-salary').value      = profile.salary      || '';
  document.getElementById('cs-hourlyrate').value  = profile.hourlyRate  || '';
  document.getElementById('cs-pension').value     = profile.pension     || 'none';
  document.getElementById('cs-benefits').value    = profile.benefits    || 'none';
  document.getElementById('cs-yearsservice').value= profile.yearsService|| '';
  document.getElementById('cs-industry').value    = profile.industry    || '';
  document.getElementById('cs-notes').value       = profile.notes       || '';
  // Show/hide hourly rate row
  var isHourly = profile.empType === 'hourly' || profile.empType === 'parttime';
  document.getElementById('cs-hourlyrate-row').style.display = isHourly ? '' : '';
  document.getElementById('cs-emptype').onchange = function() {
    var v = this.value;
    document.getElementById('cs-hourlyrate-row').style.display = '';
  };
}

function saveCareerSettings() {
  var memberId = document.getElementById('cs-member-id').value;
  if (!memberId) return;
  if (!state.careerData) state.careerData = {};
  var existing = state.careerData[memberId] || {};
  state.careerData[memberId] = Object.assign(existing, {
    memberId:    memberId,
    title:       document.getElementById('cs-title').value.trim(),
    employer:    document.getElementById('cs-employer').value.trim(),
    empType:     document.getElementById('cs-emptype').value,
    startDate:   document.getElementById('cs-startdate').value,
    salary:      parseFloat(document.getElementById('cs-salary').value)      || 0,
    hourlyRate:  parseFloat(document.getElementById('cs-hourlyrate').value)  || 0,
    pension:     document.getElementById('cs-pension').value,
    benefits:    document.getElementById('cs-benefits').value,
    yearsService:parseFloat(document.getElementById('cs-yearsservice').value)|| 0,
    industry:    document.getElementById('cs-industry').value.trim(),
    notes:       document.getElementById('cs-notes').value.trim(),
  });
  // Also sync back to member profile so retirement/forecast use the latest salary
  var member = (state.members||[]).find(function(m){ return m.id === memberId; });
  if (member && state.careerData[memberId].salary > 0) {
    member.monthlyIncome = Math.round(state.careerData[memberId].salary / 12);
  }
  saveState();
  closeModal('career-settings-modal');
  renderCareer();
  hhToast('Career profile saved!', '💼');
}

// ── ADD / EDIT MILESTONE ──────────────────────────────────────────────────
var _careerMilestoneEditId = null;
var _careerMilestoneMemberId = null;

function openAddMilestoneModal(memberId) {
  _careerMilestoneEditId = null;
  _careerMilestoneMemberId = memberId || _careerActiveMemberId;
  document.getElementById('career-milestone-modal-title').textContent = '+ Add Career Milestone';
  document.getElementById('cm-edit-id').value    = '';
  document.getElementById('cm-member-id').value  = _careerMilestoneMemberId;
  document.getElementById('cm-title').value      = '';
  document.getElementById('cm-type').value       = 'promotion';
  document.getElementById('cm-date').value       = '';
  document.getElementById('cm-salary').value     = '';
  document.getElementById('cm-hourlyrate').value = '';
  document.getElementById('cm-likelihood').value = 'likely';
  document.getElementById('cm-newtitle').value   = '';
  document.getElementById('cm-notes').value      = '';
  document.getElementById('cm-increase-preview').style.display = 'none';
  toggleMilestoneType();
  openModal('career-milestone-modal');
}

function openEditMilestoneModal(memberId, milestoneId) {
  var profile = getCareerProfile(memberId);
  if (!profile) return;
  var ms = (profile.milestones || []).find(function(x){ return x.id === milestoneId; });
  if (!ms) return;
  _careerMilestoneEditId  = milestoneId;
  _careerMilestoneMemberId = memberId;
  document.getElementById('career-milestone-modal-title').textContent = '✏️ Edit Milestone';
  document.getElementById('cm-edit-id').value    = milestoneId;
  document.getElementById('cm-member-id').value  = memberId;
  document.getElementById('cm-title').value      = ms.title || '';
  document.getElementById('cm-type').value       = ms.type  || 'promotion';
  document.getElementById('cm-date').value       = ms.date  || '';
  document.getElementById('cm-salary').value     = ms.salary     || '';
  document.getElementById('cm-hourlyrate').value = ms.hourlyRate || '';
  document.getElementById('cm-likelihood').value = ms.likelihood || 'likely';
  document.getElementById('cm-newtitle').value   = ms.newTitle || '';
  document.getElementById('cm-notes').value      = ms.notes   || '';
  calcMilestoneIncrease();
  toggleMilestoneType();
  openModal('career-milestone-modal');
}

function toggleMilestoneType() {
  var type = document.getElementById('cm-type').value;
  var salaryBlock = document.getElementById('cm-salary-block');
  // Show salary fields for promotion, raise, role_change, retirement
  salaryBlock.style.display = (type === 'certification' || type === 'other') ? 'none' : '';
}

function calcMilestoneIncrease() {
  var memberId = document.getElementById('cm-member-id').value;
  var profile  = getCareerProfile(memberId);
  if (!profile) return;
  var newSalary = parseFloat(document.getElementById('cm-salary').value) || 0;
  var baseSalary = profile.salary || 0;
  var previewEl = document.getElementById('cm-increase-preview');
  if (newSalary > 0 && baseSalary > 0 && newSalary !== baseSalary) {
    var diff = newSalary - baseSalary;
    var pct  = Math.round(diff / baseSalary * 100);
    previewEl.style.display = '';
    previewEl.textContent = (diff > 0 ? '↑ ' : '↓ ') + fmt(Math.abs(diff)) + '/yr (' + (diff > 0 ? '+' : '') + pct + '%) — new RRSP room: ~' + fmt(Math.round(newSalary * 0.18)) + '/yr';
    previewEl.style.color = diff > 0 ? 'var(--green)' : 'var(--red)';
    previewEl.style.background = diff > 0 ? 'var(--green-light)' : 'var(--red-light)';
    previewEl.style.borderColor = diff > 0 ? 'var(--green)' : 'var(--red)';
  } else {
    previewEl.style.display = 'none';
  }
}

function saveCareerMilestone() {
  var memberId = document.getElementById('cm-member-id').value;
  var title    = document.getElementById('cm-title').value.trim();
  if (!title) { hhAlert('Please enter a milestone title.', '⚠️'); return; }
  if (!memberId) return;
  if (!state.careerData) state.careerData = {};
  if (!state.careerData[memberId]) seedCareerDataFromMembers();
  var profile = state.careerData[memberId];
  if (!profile.milestones) profile.milestones = [];
  var editId = document.getElementById('cm-edit-id').value;
  var record = {
    id:          editId || uid(),
    title:       title,
    type:        document.getElementById('cm-type').value,
    date:        document.getElementById('cm-date').value,
    salary:      parseFloat(document.getElementById('cm-salary').value)     || 0,
    hourlyRate:  parseFloat(document.getElementById('cm-hourlyrate').value) || 0,
    likelihood:  document.getElementById('cm-likelihood').value,
    newTitle:    document.getElementById('cm-newtitle').value.trim(),
    notes:       document.getElementById('cm-notes').value.trim(),
  };
  if (editId) {
    var idx = profile.milestones.findIndex(function(x){ return x.id === editId; });
    if (idx >= 0) profile.milestones[idx] = record; else profile.milestones.push(record);
  } else {
    profile.milestones.push(record);
  }
  saveState();
  closeModal('career-milestone-modal');
  renderCareer();
  hhToast((editId ? 'Milestone updated' : 'Milestone added') + '! 🏆', 'success');
}

function deleteCareerMilestone(memberId, milestoneId) {
  var profile = getCareerProfile(memberId);
  if (!profile) return;
  hhConfirm('Remove this career milestone?', '🗑️', 'Remove Milestone').then(function(ok){
    if (!ok) return;
    profile.milestones = (profile.milestones || []).filter(function(ms){ return ms.id !== milestoneId; });
    saveState(); renderCareer();
    hhToast('Milestone removed.', '🗑️');
  });
}

// ── ADD / EDIT TRAINING ───────────────────────────────────────────────────
var _careerTrainingEditId  = null;
var _careerTrainingMemberId = null;

function openAddTrainingModal(memberId) {
  _careerTrainingEditId   = null;
  _careerTrainingMemberId = memberId || _careerActiveMemberId;
  document.getElementById('career-training-modal-title').textContent = '📚 Add Training / Course';
  document.getElementById('ct-edit-id').value      = '';
  document.getElementById('ct-member-id').value    = _careerTrainingMemberId;
  document.getElementById('ct-name').value         = '';
  document.getElementById('ct-provider').value     = '';
  document.getElementById('ct-category').value     = 'course';
  document.getElementById('ct-status').value       = 'not_started';
  document.getElementById('ct-date').value         = '';
  document.getElementById('ct-cost').value         = '';
  document.getElementById('ct-reimbursed').checked = false;
  document.getElementById('ct-notes').value        = '';
  _populateTrainingMilestoneSelect(_careerTrainingMemberId, '');
  openModal('career-training-modal');
}

function openEditTrainingModal(memberId, trainingId) {
  var profile = getCareerProfile(memberId);
  if (!profile) return;
  var t = (profile.training || []).find(function(x){ return x.id === trainingId; });
  if (!t) return;
  _careerTrainingEditId   = trainingId;
  _careerTrainingMemberId = memberId;
  document.getElementById('career-training-modal-title').textContent = '✏️ Edit Training';
  document.getElementById('ct-edit-id').value      = trainingId;
  document.getElementById('ct-member-id').value    = memberId;
  document.getElementById('ct-name').value         = t.name         || '';
  document.getElementById('ct-provider').value     = t.provider     || '';
  document.getElementById('ct-category').value     = t.category     || 'course';
  document.getElementById('ct-status').value       = t.status       || 'not_started';
  document.getElementById('ct-date').value         = t.date         || '';
  document.getElementById('ct-cost').value         = t.cost         || '';
  document.getElementById('ct-reimbursed').checked = !!t.reimbursed;
  document.getElementById('ct-notes').value        = t.notes        || '';
  _populateTrainingMilestoneSelect(memberId, t.linkedMilestone || '');
  openModal('career-training-modal');
}

function _populateTrainingMilestoneSelect(memberId, selectedId) {
  var sel = document.getElementById('ct-linked-milestone');
  var profile = getCareerProfile(memberId);
  var milestones = profile ? (profile.milestones || []) : [];
  sel.innerHTML = '<option value="">— None —</option>'
    + milestones.map(function(ms){
        return '<option value="' + ms.id + '"' + (ms.id === selectedId ? ' selected' : '') + '>'
          + ms.title + (ms.date ? ' (' + ms.date.slice(0,7) + ')' : '') + '</option>';
      }).join('');
}

function saveCareerTraining() {
  var memberId = document.getElementById('ct-member-id').value;
  var name     = document.getElementById('ct-name').value.trim();
  if (!name) { hhAlert('Please enter a course or certification name.', '⚠️'); return; }
  if (!memberId) return;
  if (!state.careerData) state.careerData = {};
  if (!state.careerData[memberId]) seedCareerDataFromMembers();
  var profile = state.careerData[memberId];
  if (!profile.training) profile.training = [];
  var editId = document.getElementById('ct-edit-id').value;
  var record = {
    id:              editId || uid(),
    name:            name,
    provider:        document.getElementById('ct-provider').value.trim(),
    category:        document.getElementById('ct-category').value,
    status:          document.getElementById('ct-status').value,
    date:            document.getElementById('ct-date').value,
    cost:            parseFloat(document.getElementById('ct-cost').value) || 0,
    reimbursed:      document.getElementById('ct-reimbursed').checked,
    linkedMilestone: document.getElementById('ct-linked-milestone').value,
    notes:           document.getElementById('ct-notes').value.trim(),
  };
  if (editId) {
    var idx = profile.training.findIndex(function(x){ return x.id === editId; });
    if (idx >= 0) profile.training[idx] = record; else profile.training.push(record);
  } else {
    profile.training.push(record);
  }
  saveState();
  closeModal('career-training-modal');
  renderCareer();
  hhToast((editId ? 'Training updated' : 'Training added') + '! 📚', 'success');
}

function deleteCareerTraining(memberId, trainingId) {
  var profile = getCareerProfile(memberId);
  if (!profile) return;
  hhConfirm('Remove this training record?', '🗑️', 'Remove Training').then(function(ok){
    if (!ok) return;
    profile.training = (profile.training || []).filter(function(t){ return t.id !== trainingId; });
    saveState(); renderCareer();
    hhToast('Training removed.', '🗑️');
  });
}

// ── FORECAST INTEGRATION: inject career salary steps into avgInc calc ─────
// Called by renderForecast() to get projected monthly income at a given month offset
function getCareerProjectedMonthlyIncome(monthOffset) {
  // For each member, check if any milestone date falls at or before this offset,
  // and use the most recent salary at that point.
  var members = state.members || [];
  var total = 0;
  var targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + monthOffset);
  var targetStr = targetDate.toISOString().split('T')[0];
  members.forEach(function(m) {
    var steps = getCareerSalarySteps(m.id);
    if (!steps.length) {
      // Fall back to member monthlyIncome
      total += (m.monthlyIncome || 0);
      return;
    }
    // Find the most recent salary step at or before targetStr
    var salary = steps[0].salary; // current baseline
    steps.forEach(function(step) {
      if (step.date <= targetStr && step.salary > 0) salary = step.salary;
    });
    total += Math.round(salary / 12);
  });
  return total;
}

// ── RETIREMENT INTEGRATION: get projected final salary for pension formula ─
function getCareerFinalSalary(memberId) {
  var profile = getCareerProfile(memberId);
  if (!profile) return 0;
  var milestones = (profile.milestones || []).filter(function(ms){ return ms.salary > 0; });
  if (!milestones.length) return profile.salary || 0;
  // Return the salary of the latest milestone (closest to retirement)
  milestones.sort(function(a, b){ return a.date.localeCompare(b.date); });
  return milestones[milestones.length - 1].salary;
}

// ─────────────────────────────────────────────────────────────────────────

// INIT
function _initApp() {
  // Restore saved theme first so colours are right before any render
  if(state.theme) applyTheme(state.theme);
  // Restore sidebar collapsed state
  try { if(localStorage.getItem('hh_sidebar_collapsed')==='1') { var sb=document.getElementById('sidebar'); if(sb) sb.classList.add('collapsed'); } } catch(e){}
  // Migrate: if any account has type Cash-Claimed/Unclaimed but a uid()-based id,
  // re-point its transactions to the canonical fixed id and remove the orphan.
  // This cleans up accounts that were accidentally created via the Upload form.
  ['Cash-Claimed','Cash-Unclaimed'].forEach(function(canonId) {
    var orphans = (state.accounts||[]).filter(function(a){ return a.type === canonId && a.id !== canonId; });
    orphans.forEach(function(orphan) {
      state.transactions.forEach(function(t){ if (t.account === orphan.id) t.account = canonId; });
      state.accounts = state.accounts.filter(function(a){ return a.id !== orphan.id; });
    });
    if (orphans.length) saveState();
  });
  // Migrate: re-point transactions stored with legacy plain-string account IDs
  // (e.g. t.account === 'Chequing') to the real uid-based account for that person+type.
  // This fixes the filter mismatch where acctBadge hides the wrong ID visually.
  (function migrateLeagcyAccountIds() {
    var legacyTypes = ['Chequing','Savings','Credit Card','TFSA','RRSP','FHSA','Loan','Line of Credit'];
    var accounts = state.accounts || [];
    var changed = false;
    state.transactions.forEach(function(t) {
      // Only process transactions whose account value is one of the legacy plain-type strings
      // AND that string is not itself a valid account id (i.e. no account has id === that string)
      if (!t.account) return;
      var isLegacyString = legacyTypes.indexOf(t.account) !== -1;
      if (!isLegacyString) return;
      var alreadyValid = accounts.some(function(a) { return a.id === t.account; });
      if (alreadyValid) return; // e.g. Cash-Claimed which uses type as id — already handled above
      // Find the best matching real account: same type, same person (or joint)
      var matches = accounts.filter(function(a) {
        return a.type === t.account && (a.person === t.person || a.isJoint);
      });
      // If only one match, re-point unconditionally
      // If multiple, prefer the one whose person matches exactly
      var best = null;
      if (matches.length === 1) {
        best = matches[0];
      } else if (matches.length > 1) {
        best = matches.find(function(a) { return a.person === t.person; }) || matches[0];
      }
      if (best) {
        t.account = best.id;
        changed = true;
      }
    });
    if (changed) saveState();
  })();

  // Migrate: ensure Cash-Claimed / Cash-Unclaimed exist as real accounts if tips present
  if (state.tips && state.tips.length) ensureCashAccounts();
  // Migrate: re-classify pantry items that are missing a section or defaulted
  // to 'Groceries' but actually match a non-food keyword (e.g. Dish Soap, Cat Litter)
  (function migratePantrySections() {
    var changed = false;
    (state.pantry || []).forEach(function(p) {
      if (!p.section || p.section === 'Groceries') {
        var detected = classifyNonFoodItem(p.name || '');
        if (detected && detected !== 'Groceries') {
          p.section = detected;
          changed = true;
        }
      }
    });
    if (changed) saveState();
  })();

  // ── URL hash config import (#setup=<base64>) ──────────────────────────────
  var hashMatch = window.location.hash.match(/^#setup=(.+)$/);
  if (hashMatch) {
    try {
      var decoded = JSON.parse(decodeURIComponent(escape(atob(hashMatch[1]))));
      if (decoded && decoded._type === 'homehub_config') {
        window.location.hash = ''; // clean the URL
        hhConfirm(
          '<strong>Setup invitation found!</strong><br>Pre-fill the Setup Wizard with the shared household template?<br><small style="color:var(--muted)">Your existing data (if any) will not be affected until you finish the wizard.</small>',
          '🏠', 'Shared Setup'
        ).then(function(ok) {
          if (ok) {
            importConfigToWizard(decoded);
          } else if (!state.household || !state.household.setupComplete) {
            openSetupWizard(false);
          } else {
            applyHouseholdConfig(); seedCareerDataFromMembers(); takeNetWorthSnapshot(false); renderDashboard();
          }
        });
        updateApiKeyBtn();
        return; // Don't fall through to the normal init path
      }
    } catch(e) {
      // Malformed hash — ignore silently, fall through to normal init
    }
  }

  if (!state.household || !state.household.setupComplete) {
    openSetupWizard(false);
  } else {
    applyHouseholdConfig();
    seedCareerDataFromMembers();
    takeNetWorthSnapshot(false);
    renderDashboard();
  }
  updateApiKeyBtn();
  var brand = document.getElementById('nav-brand');
  if (brand && !brand.querySelector('.v-badge')) {
    var badge = document.createElement('span');
    badge.className = 'v-badge';
    badge.style.cssText = 'font-size:9px;font-weight:800;background:var(--accent);color:#fff;border-radius:6px;padding:1px 5px;vertical-align:middle;margin-left:4px;opacity:0.7';
    badge.textContent = 'v6.27';
    brand.appendChild(badge);
  }
}

// ── THEME SYSTEM ─────────────────────────────────────────────────────────────

var THEMES = {
  'Warm Terracotta': {
    label:'Warm Terracotta', emoji:'🧡', dark:false,
    '--bg':'#fdf8f4','--surface':'#fff9f5','--card':'#ffffff','--border':'#eeddd0',
    '--accent':'#c97d5a','--accent-dark':'#a5623e','--accent2':'#e8a87c',
    '--text':'#3d2b1f','--text2':'#7a5a48','--muted':'#b8957a',
    '--shadow':'0 2px 20px rgba(180,100,60,0.08)',
    '--shadow-md':'0 4px 24px rgba(180,100,60,0.11)',
    '--shadow-lg':'0 8px 40px rgba(180,100,60,0.16)',
  },
  'Midnight Slate': {
    label:'Midnight Slate', emoji:'🌑', dark:true,
    '--bg':'#0f1117','--surface':'#181c26','--card':'#1e2330','--border':'#2e3650',
    '--accent':'#5b8dee','--accent-dark':'#3a6fd8','--accent2':'#7aa5f5',
    '--text':'#e8eaf0','--text2':'#9ba3bb','--muted':'#5c6480',
    '--shadow':'0 2px 20px rgba(0,0,0,0.35)',
    '--shadow-md':'0 4px 24px rgba(0,0,0,0.45)',
    '--shadow-lg':'0 8px 40px rgba(0,0,0,0.55)',
  },
  'Forest Green': {
    label:'Forest Green', emoji:'🌿', dark:false,
    '--bg':'#f3f8f4','--surface':'#eaf4ec','--card':'#ffffff','--border':'#c8e0cb',
    '--accent':'#3a7d52','--accent-dark':'#2a5c3c','--accent2':'#5aaa74',
    '--text':'#1a3324','--text2':'#3d6650','--muted':'#7aaa8a',
    '--shadow':'0 2px 20px rgba(40,100,60,0.09)',
    '--shadow-md':'0 4px 24px rgba(40,100,60,0.13)',
    '--shadow-lg':'0 8px 40px rgba(40,100,60,0.18)',
  },
  'Soft Lavender': {
    label:'Soft Lavender', emoji:'💜', dark:false,
    '--bg':'#f7f5fc','--surface':'#f0ebfa','--card':'#ffffff','--border':'#d8cef0',
    '--accent':'#7c5cbf','--accent-dark':'#5e3fa0','--accent2':'#a07ed4',
    '--text':'#2a1f3d','--text2':'#5a4878','--muted':'#9e8abf',
    '--shadow':'0 2px 20px rgba(100,70,180,0.09)',
    '--shadow-md':'0 4px 24px rgba(100,70,180,0.13)',
    '--shadow-lg':'0 8px 40px rgba(100,70,180,0.18)',
  },
  'Ocean Blue': {
    label:'Ocean Blue', emoji:'🌊', dark:false,
    '--bg':'#f0f7ff','--surface':'#e6f0fb','--card':'#ffffff','--border':'#bcd6f0',
    '--accent':'#1a7abf','--accent-dark':'#115c96','--accent2':'#3a9edd',
    '--text':'#0d2a40','--text2':'#2d5870','--muted':'#6a9bb8',
    '--shadow':'0 2px 20px rgba(20,80,140,0.09)',
    '--shadow-md':'0 4px 24px rgba(20,80,140,0.13)',
    '--shadow-lg':'0 8px 40px rgba(20,80,140,0.18)',
  },
  'High Contrast': {
    label:'High Contrast', emoji:'⚫', dark:false,
    '--bg':'#ffffff','--surface':'#f2f2f2','--card':'#ffffff','--border':'#bbbbbb',
    '--accent':'#111111','--accent-dark':'#000000','--accent2':'#444444',
    '--text':'#000000','--text2':'#222222','--muted':'#666666',
    '--shadow':'0 2px 12px rgba(0,0,0,0.15)',
    '--shadow-md':'0 4px 18px rgba(0,0,0,0.20)',
    '--shadow-lg':'0 8px 30px rgba(0,0,0,0.28)',
  },
};

var _activeThemeName = 'Warm Terracotta';
var _themeDark = false;
var _themeCustomAccent = null;

function applyTheme(themeObj) {
  var t = themeObj || {};
  var root = document.documentElement;
  // Core palette
  var vars = ['--bg','--surface','--card','--border','--accent','--accent-dark','--accent2',
               '--text','--text2','--muted','--shadow','--shadow-md','--shadow-lg'];
  vars.forEach(function(v){ if(t[v]) root.style.setProperty(v, t[v]); });
  // Custom accent override
  if(t.customAccent) {
    root.style.setProperty('--accent', t.customAccent);
    root.style.setProperty('--accent-dark', shadeColor(t.customAccent, -15));
    root.style.setProperty('--accent2', shadeColor(t.customAccent, 18));
  }
}

function shadeColor(hex, pct) {
  // Lighten (positive) or darken (negative) a hex colour by pct percent
  var num = parseInt(hex.replace('#',''), 16);
  var r = Math.min(255, Math.max(0, (num>>16) + Math.round(2.55*pct)));
  var g = Math.min(255, Math.max(0, ((num>>8)&0xff) + Math.round(2.55*pct)));
  var b = Math.min(255, Math.max(0, (num&0xff) + Math.round(2.55*pct)));
  return '#'+(r<16?'0':'')+r.toString(16)+(g<16?'0':'')+g.toString(16)+(b<16?'0':'')+b.toString(16);
}

function _buildThemeObj() {
  var base = THEMES[_activeThemeName] || THEMES['Warm Terracotta'];
  var t = Object.assign({}, base);
  if(_themeCustomAccent) t.customAccent = _themeCustomAccent;
  t._name = _activeThemeName;
  t._dark = _themeDark;
  t._customAccent = _themeCustomAccent;
  return t;
}

function openThemePicker() {
  // Sync state
  var saved = state.theme || {};
  _activeThemeName = saved._name || 'Warm Terracotta';
  _themeDark = !!saved._dark;
  _themeCustomAccent = saved._customAccent || null;

  // Render preset tiles
  var container = document.getElementById('theme-presets');
  container.innerHTML = Object.keys(THEMES).map(function(name){
    var th = THEMES[name];
    var isActive = name === _activeThemeName;
    return '<div onclick="selectThemePreset(\''+name+'\')" style="cursor:pointer;border-radius:14px;border:2.5px solid '+(isActive?'var(--accent)':'var(--border)')+';padding:12px 10px;background:'+th['--card']+';transition:border-color 0.2s;text-align:center;user-select:none" id="theme-tile-'+name.replace(/\s/g,'-')+'">'
      +'<div style="width:100%;height:28px;border-radius:8px;background:linear-gradient(90deg,'+th['--accent']+','+th['--accent2']+');margin-bottom:8px"></div>'
      +'<div style="display:flex;gap:4px;margin-bottom:8px;justify-content:center">'
        +'<div style="width:22px;height:14px;border-radius:4px;background:'+th['--bg']+'"></div>'
        +'<div style="width:22px;height:14px;border-radius:4px;background:'+th['--surface']+'"></div>'
        +'<div style="width:22px;height:14px;border-radius:4px;background:'+th['--border']+'"></div>'
      +'</div>'
      +'<div style="font-size:12px;font-weight:800;color:'+th['--text']+'">'+th.emoji+' '+th.label+'</div>'
      +'</div>';
  }).join('');

  // Dark mode button state
  document.getElementById('theme-dark-btn').textContent = _themeDark ? 'On ✓' : 'Off';
  document.getElementById('theme-dark-btn').style.background = _themeDark ? 'var(--accent)' : '';
  document.getElementById('theme-dark-btn').style.color = _themeDark ? '#fff' : '';

  // Accent input
  var accentInput = document.getElementById('theme-accent-input');
  accentInput.value = _themeCustomAccent || (THEMES[_activeThemeName]||THEMES['Warm Terracotta'])['--accent'];
}

function selectThemePreset(name) {
  _activeThemeName = name;
  // Update tile borders
  Object.keys(THEMES).forEach(function(n){
    var tile = document.getElementById('theme-tile-'+n.replace(/\s/g,'-'));
    if(tile) tile.style.borderColor = n===name ? 'var(--accent)' : 'var(--border)';
  });
  // Preview immediately
  applyTheme(_buildThemeObj());
}

function toggleThemeDark() {
  _themeDark = !_themeDark;
  var btn = document.getElementById('theme-dark-btn');
  btn.textContent = _themeDark ? 'On ✓' : 'Off';
  btn.style.background = _themeDark ? 'var(--accent)' : '';
  btn.style.color = _themeDark ? '#fff' : '';
  // Apply dark overrides on top of current theme
  var t = _buildThemeObj();
  if(_themeDark) {
    t['--bg'] = '#0f1117'; t['--surface'] = '#181c26'; t['--card'] = '#1e2330'; t['--border'] = '#2e3650';
    t['--text'] = '#e8eaf0'; t['--text2'] = '#9ba3bb'; t['--muted'] = '#5c6480';
    t['--shadow'] = '0 2px 20px rgba(0,0,0,0.35)';
    t['--shadow-md'] = '0 4px 24px rgba(0,0,0,0.45)';
    t['--shadow-lg'] = '0 8px 40px rgba(0,0,0,0.55)';
  }
  applyTheme(t);
}

function previewAccent(hex) {
  _themeCustomAccent = hex;
  applyTheme(_buildThemeObj());
}

function saveThemePick() {
  var t = _buildThemeObj();
  state.theme = t;
  saveState();
  closeModal('theme-modal');
}

// Populate the theme picker before opening the modal
var _origOpenModal2 = openModal;
openModal = function(id) {
  if(id === 'theme-modal') openThemePicker();
  _origOpenModal2(id);
};

(function() {
  if (_useIDB) {
    // Wait for IDB to be ready, then preload cache, then init
    function waitForIDB() {
      if (_idbReady) {
        _preloadIDBCache(function() {
          // Re-load state from IDB cache
          try { Object.assign(state, JSON.parse(hhStorageGet(KEY)) || {}); } catch(e){}
          _initApp();
        });
      } else {
        setTimeout(waitForIDB, 50);
      }
    }
    waitForIDB();
  } else {
    _initApp();
  }
})();

// CHART STATE
var budgetChartInst = null;
var txnChartInst = null;
var currentBudgetView = 'bars';
var currentTxnView = 'table';

// BUDGET CHART VIEWS
function setBudgetView(view, btn){
  document.querySelectorAll('#bud-v-bars,#bud-v-pie,#bud-v-bar').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  currentBudgetView = view;
  renderBudgetChart();
}

function renderBudgetChart(){
  var mk = document.getElementById('budget-month-select').value || getCurrentMonthKey();
  var mt = state.transactions.filter(function(t){return getMonthKey(t.date)===mk && t.amount<0;});
  var catSpend = {};
  mt.forEach(function(t){
    if(t.category==='savings'||t.category==='income') return;
    catSpend[t.category] = (catSpend[t.category]||0) + Math.abs(t.amount);
  });

  if(currentBudgetView === 'bars'){
    document.getElementById('budget-bars').style.display = '';
    document.getElementById('budget-chart-wrap').style.display = 'none';
    return;
  }

  document.getElementById('budget-bars').style.display = 'none';
  document.getElementById('budget-chart-wrap').style.display = '';

  var cats = state.categories.filter(function(c){ return c.id!=='income'&&c.id!=='savings'&&(catSpend[c.id]||state.budgets[c.id]); });
  var labels = cats.map(function(c){return c.name;});
  var spent = cats.map(function(c){return catSpend[c.id]||0;});
  var budgets = cats.map(function(c){return state.budgets[c.id]||0;});
  var colors = cats.map(function(c){return c.color;});

  if(budgetChartInst){ budgetChartInst.destroy(); budgetChartInst=null; }
  var ctx = document.getElementById('budget-chart').getContext('2d');

  if(currentBudgetView === 'pie'){
    budgetChartInst = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: spent, backgroundColor: colors, borderWidth: 2 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'right'}, tooltip:{ callbacks:{ label:function(ctx){ return ctx.label+': $'+ctx.parsed.toFixed(2); } } } } }
    });
  } else {
    budgetChartInst = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: [
        { label:'Spent', data: spent, backgroundColor: colors, borderRadius:4 },
        { label:'Budget', data: budgets, backgroundColor: 'rgba(180,100,60,0.15)', borderColor:'rgba(180,100,60,0.5)', borderWidth:1, borderRadius:4 }
      ]},
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:true} }, scales:{ y:{ beginAtZero:true, ticks:{ callback:function(v){return '$'+v;} } } } }
    });
  }
}

// Patch renderBudget to also call chart and forecast
var _origRenderBudget = renderBudget;
renderBudget = function(){
  _origRenderBudget();
  renderBudgetChart();
  renderForecast();
};

// FINANCIAL FORECAST
var forecastChartInst = null;
var forecastPastMonths = 6;
var forecastFutureMonths = 6;
var forecastChartView = 'cashflow';

function setForecastPast(months, btn){
  document.querySelectorAll('#fc-past-0,#fc-past-3,#fc-past-6').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  forecastPastMonths = months;
  renderForecast();
}
function setForecastFuture(months, btn){
  document.querySelectorAll('#fc-fut-6,#fc-fut-12,#fc-fut-36,#fc-fut-60').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  forecastFutureMonths = months;
  renderForecast();
}
function setForecastView(view, btn){
  document.querySelectorAll('#fc-view-cashflow,#fc-view-savings,#fc-view-goals').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  forecastChartView = view;
  renderForecast();
}

function renderForecast(){
  if(!document.getElementById('forecast-chart')) return;

  var now = new Date();
  var nowKey = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');

  // ── BUILD MONTH LIST (past + present + future) ──────────────────────────
  var allMonths = []; // { key, label, isPast, isNow, isFuture }
  for(var i = -forecastPastMonths; i <= forecastFutureMonths; i++){
    var d = new Date(now.getFullYear(), now.getMonth()+i, 1);
    var key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    var label = d.toLocaleString('default',{month:'short', year:'2-digit'});
    allMonths.push({ key:key, label:label, isPast:i<0, isNow:i===0, isFuture:i>0, offset:i });
  }

  // ── REAL DATA: income & expenses per historical month ───────────────────
  function monthIncome(mk){
    var txnInc = state.transactions
      .filter(function(t){ return getMonthKey(t.date)===mk && t.amount>0 && t.category!=='transfer' && t.source!=='tips'; })
      .reduce(function(s,t){ return s+t.amount; }, 0);
    return txnInc + getTipsForMonth(mk);
  }
  function monthExpenses(mk){
    return state.transactions
      .filter(function(t){ return getMonthKey(t.date)===mk && t.amount<0 && t.category!=='transfer' && t.source!=='tips'; })
      .reduce(function(s,t){ return s+Math.abs(t.amount); }, 0);
  }

  // Compute averages from up to last 6 months with real data
  var avgBasisKeys = [];
  for(var bi=1; bi<=6; bi++){
    var bd = new Date(now.getFullYear(), now.getMonth()-bi, 1);
    var bk = bd.getFullYear()+'-'+String(bd.getMonth()+1).padStart(2,'0');
    if(state.transactions.some(function(t){ return getMonthKey(t.date)===bk; })) avgBasisKeys.push(bk);
  }
  var numBasis = Math.max(avgBasisKeys.length, 1);
  var sumInc = avgBasisKeys.reduce(function(s,mk){ return s+monthIncome(mk); }, 0);
  var sumExp = avgBasisKeys.reduce(function(s,mk){ return s+monthExpenses(mk); }, 0);
  var avgInc = sumInc / numBasis;
  var avgExp = sumExp / numBasis;
  var avgSurplus = avgInc - avgExp;

  // Current month: use actual if data exists, else projection
  var curInc = monthIncome(nowKey) || avgInc;
  var curExp = monthExpenses(nowKey) || avgExp;

  // Tips member for CRA reserve
  var tipsMember = getTipsMember();
  var avgTips = (function(){
    var tkm = avgBasisKeys.filter(function(mk){ return getTipsForMonth(mk)>0; });
    return tkm.length ? tkm.reduce(function(s,mk){ return s+getTipsForMonth(mk); },0)/tkm.length : 0;
  })();

  // ── BUILD PER-MONTH DATA ARRAYS ─────────────────────────────────────────
  var labels=[], incData=[], expData=[], surplusData=[];
  var savingsData=[], runBal=0;

  // Running balance seeded from actual account balances (assets minus debts)
  var windowStart = allMonths[0].key;
  (function(){
    var accounts = state.accounts || [];
    var totalAssets = 0, totalDebts = 0;
    accounts.forEach(function(a){
      var isDebt = !!ACCT_IS_DEBT[a.type];
      var sb = (state.startingBalances||{})[a.id];
      var hasSB = sb && sb.amount != null && sb.date;
      var allTxns = state.transactions.filter(function(t){ return t.account===a.id && !t.isOpeningBalance; });
      var txnSum;
      if(hasSB){
        var filtered = allTxns.filter(function(t){ return toISO(t.date||'') > sb.date; });
        txnSum = filtered.reduce(function(s,t){ return s+(parseFloat(t.amount)||0); },0);
        var bal = isDebt ? parseFloat(sb.amount) - txnSum : parseFloat(sb.amount) + txnSum;
        if(isDebt) totalDebts += Math.max(0, bal);
        else totalAssets += bal;
      } else {
        txnSum = allTxns.reduce(function(s,t){ return s+(parseFloat(t.amount)||0); },0);
        var bal2 = isDebt ? -txnSum : txnSum;
        if(isDebt) totalDebts += Math.max(0, bal2);
        else totalAssets += bal2;
      }
    });
    runBal = Math.max(0, totalAssets - totalDebts);
  })();

  allMonths.forEach(function(m){
    labels.push(m.label);
    if(m.isPast){
      var inc = monthIncome(m.key);
      var exp = monthExpenses(m.key);
      // If no data for that month, use avg (greyed out in tooltip)
      var hasData = state.transactions.some(function(t){ return getMonthKey(t.date)===m.key; });
      incData.push(hasData ? inc : null);
      expData.push(hasData ? exp : null);
      surplusData.push(hasData ? (inc-exp) : null);
      // Past months: savings chart shows the current real balance for all past points
      // (we don't reconstruct historical balance — just anchor at today)
      savingsData.push(Math.round(runBal));
    } else if(m.isNow){
      incData.push(curInc);
      expData.push(curExp);
      surplusData.push(curInc - curExp);
      savingsData.push(Math.round(runBal));
    } else {
      // Future — use career-projected monthly income if available, else avgInc
      var careerProjectedInc = getCareerProjectedMonthlyIncome(m.offset);
      var forecastInc = careerProjectedInc > 0 ? careerProjectedInc : avgInc;
      var forecastSurplus = forecastInc - avgExp;
      incData.push(forecastInc);
      expData.push(avgExp);
      surplusData.push(forecastSurplus);
      runBal += Math.max(0, forecastSurplus);
      savingsData.push(Math.round(runBal));
    }
  });

  // "Today" divider index
  var todayIdx = allMonths.findIndex(function(m){ return m.isNow; });

  // ── DESTROY OLD CHART ────────────────────────────────────────────────────
  if(forecastChartInst){ forecastChartInst.destroy(); forecastChartInst=null; }
  var ctx = document.getElementById('forecast-chart').getContext('2d');

  // ── CHART: CASHFLOW ──────────────────────────────────────────────────────
  if(forecastChartView === 'cashflow'){
    // Split income/expense into past-solid vs future-faded via segment coloring
    var incColors = allMonths.map(function(m){ return m.isFuture ? 'rgba(90,158,122,0.35)' : 'rgba(90,158,122,0.85)'; });
    var expColors = allMonths.map(function(m){ return m.isFuture ? 'rgba(217,95,95,0.30)' : 'rgba(217,95,95,0.80)'; });

    forecastChartInst = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label:'Income', data:incData, backgroundColor:incColors, borderRadius:4, order:2 },
          { label:'Expenses', data:expData, backgroundColor:expColors, borderRadius:4, order:2 },
          { label:'Net Cashflow', data:surplusData, type:'line',
            borderColor:'#c97d5a', backgroundColor:'rgba(201,125,90,0.08)',
            tension:0.35, pointRadius:3, pointBackgroundColor:'#c97d5a',
            fill:false, order:1, borderWidth:2,
            segment:{ borderDash:function(ctx){ return ctx.p0DataIndex>=todayIdx?[5,4]:undefined; } }
          }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{ display:true, position:'top', labels:{font:{size:11},boxWidth:14} },
          tooltip:{ callbacks:{
            label:function(c){
              var idx=c.dataIndex;
              var tag = allMonths[idx] ? (allMonths[idx].isFuture?' (projected)':allMonths[idx].isNow?' (current)':'') : '';
              return c.dataset.label+': $'+Math.abs(Math.round(c.parsed.y)).toLocaleString()+tag;
            }
          }}
        },
        scales:{
          x:{ ticks:{font:{size:10}}, grid:{display:false} },
          y:{ beginAtZero:true, ticks:{callback:function(v){ return '$'+Math.abs(v).toLocaleString(); }, font:{size:11}}, grid:{color:'rgba(180,100,60,0.07)'} }
        }
      }
    });

  // ── CHART: SAVINGS TRAJECTORY ────────────────────────────────────────────
  } else if(forecastChartView === 'savings'){
    // Shade past vs future differently
    var savColors = savingsData.map(function(_,i){ return i<=todayIdx ? 'rgba(90,158,122,0.12)' : 'rgba(155,127,189,0.08)'; });
    forecastChartInst = new Chart(ctx, {
      type:'line',
      data:{
        labels:labels,
        datasets:[{
          label:'Savings Balance',
          data:savingsData,
          borderColor:'#5a9e7a',
          backgroundColor:'rgba(90,158,122,0.08)',
          tension:0.35, fill:true, pointRadius:2,
          segment:{
            borderColor:function(c){ return c.p0DataIndex>=todayIdx?'#9b7fbd':'#5a9e7a'; },
            borderDash:function(c){ return c.p0DataIndex>=todayIdx?[5,4]:undefined; }
          }
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{ callbacks:{ label:function(c){
            var tag = allMonths[c.dataIndex]?(allMonths[c.dataIndex].isFuture?' (projected)':''):'';
            return 'Balance: $'+Math.round(c.parsed.y).toLocaleString()+tag;
          }}}
        },
        scales:{
          x:{ticks:{font:{size:10}}, grid:{display:false}},
          y:{beginAtZero:false, ticks:{callback:function(v){ return '$'+v.toLocaleString(); }, font:{size:11}}, grid:{color:'rgba(180,100,60,0.07)'}}
        }
      }
    });

  // ── CHART: GOALS ─────────────────────────────────────────────────────────
  } else {
    var goalDatasets = [];
    var goalColors = ['#e07a9a','#9b7fbd','#c97d5a','#5a9e7a','#5bb8f7','#f59e0b'];
    (state.goals||[]).forEach(function(g, gi){
      var color = g.color || goalColors[gi % goalColors.length];
      var currentSaved = g.current + getGoalContributions(g.id);
      // Allocate a share of monthly surplus proportional to goal priority (equal split for now)
      var numGoals = Math.max((state.goals||[]).length, 1);
      var monthlyToGoal = Math.max(0, avgSurplus) / numGoals;
      var gData = [];
      var gBal = currentSaved;
      allMonths.forEach(function(m, mi){
        if(mi <= todayIdx){
          gData.push(Math.round(Math.min(gBal, g.target)));
        } else {
          gBal += monthlyToGoal;
          gData.push(Math.round(Math.min(gBal, g.target)));
        }
      });
      goalDatasets.push({
        label: (g.emoji||'🎯')+' '+g.name,
        data: gData,
        borderColor: color,
        backgroundColor: color.replace(')',',0.06)').replace('rgb','rgba'),
        tension:0.35, fill:false, pointRadius:2,
        segment:{ borderDash:function(c){ return c.p0DataIndex>=todayIdx?[5,4]:undefined; } }
      });
      // Target line
      if(g.target>0){
        goalDatasets.push({
          label: g.name+' target ($'+g.target.toLocaleString()+')',
          data: Array(allMonths.length).fill(g.target),
          borderColor: color, borderWidth:1.2, borderDash:[2,5],
          pointRadius:0, fill:false,
          backgroundColor:'transparent'
        });
      }
    });
    forecastChartInst = new Chart(ctx, {
      type:'line',
      data:{ labels:labels, datasets:goalDatasets },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{ display:true, position:'top', labels:{font:{size:11},boxWidth:14,
            filter:function(item){ return !item.text.includes('target ('); }
          }},
          tooltip:{ callbacks:{ label:function(c){
            if(c.dataset.label.includes('target (')) return null;
            var tag=allMonths[c.dataIndex]?(allMonths[c.dataIndex].isFuture?' (projected)':''):'';
            return c.dataset.label+': $'+Math.round(c.parsed.y).toLocaleString()+tag;
          }}}
        },
        scales:{
          x:{ticks:{font:{size:10}},grid:{display:false}},
          y:{beginAtZero:false, ticks:{callback:function(v){ return '$'+v.toLocaleString(); },font:{size:11}}, grid:{color:'rgba(180,100,60,0.07)'}}
        }
      }
    });
  }

  // ── RECOMMENDATIONS PANEL ────────────────────────────────────────────────
  var recs = [];
  var surplusColor = avgSurplus>0?'var(--green)':'var(--red)';
  var province = (state.household && state.household.province) || 'ON';
  var provLabel = {'ON':'Ontario','BC':'British Columbia','QC':'Quebec','AB':'Alberta','MB':'Manitoba','SK':'Saskatchewan','NS':'Nova Scotia','NB':'New Brunswick','NL':'Newfoundland','PE':'PEI','NT':'NWT','YT':'Yukon','NU':'Nunavut'}[province]||province;
  var fhsaMembers = (state.members||[]).filter(function(m){ return m.isFirstTimeBuyer; });
  var pensionMembers = (state.members||[]).filter(function(m){ return m.hasPension; });

  // Career salary steps callout — show when any member has future milestones with salary
  var careerMilestoneCount = (state.members||[]).reduce(function(total, m) {
    var steps = getCareerSalarySteps(m.id);
    return total + (steps.length > 1 ? steps.length - 1 : 0);
  }, 0);
  if (careerMilestoneCount > 0) {
    recs.push('<div style="background:color-mix(in srgb,var(--accent) 7%,var(--card));border:1.5px solid color-mix(in srgb,var(--accent) 35%,var(--border));border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;display:flex;align-items:center;gap:10px">'
      + '<span style="font-size:18px">💼</span>'
      + '<span><strong>Career salary milestones are active</strong> — future income bars on this chart reflect your planned raises from the <a href="#" onclick="showPage(\'career\');return false;" style="color:var(--accent)">Career Planner</a>. ' + careerMilestoneCount + ' milestone' + (careerMilestoneCount !== 1 ? 's' : '') + ' projecting forward.</span>'
      + '</div>');
  }

  // ─ Section A: Cashflow summary ──────────────────────────────────────────
  recs.push('<div style="margin-bottom:18px">');
  recs.push('<div style="font-size:11px;font-weight:800;color:var(--text2);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">📊 Cashflow Summary <span style="font-weight:600;color:var(--muted);text-transform:none;letter-spacing:0">(avg last '+numBasis+' month'+(numBasis!==1?'s':'')+')</span></div>');
  recs.push('<div style="display:flex;flex-wrap:wrap;gap:10px">');
  recs.push('<div style="background:var(--green-light);border:1.5px solid var(--green);border-radius:12px;padding:12px 16px;flex:1;min-width:130px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--green);font-weight:800">Avg Monthly Income</div><div style="font-size:22px;font-weight:700;color:var(--green);font-family:Playfair Display,serif">'+fmt(avgInc)+'</div>'+(avgTips>0?'<div style="font-size:11px;color:var(--muted)">incl. ~'+fmt(avgTips)+'/mo tips</div>':'')+'</div>');
  recs.push('<div style="background:var(--red-light);border:1.5px solid var(--red);border-radius:12px;padding:12px 16px;flex:1;min-width:130px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--red);font-weight:800">Avg Monthly Expenses</div><div style="font-size:22px;font-weight:700;color:var(--red);font-family:Playfair Display,serif">'+fmt(avgExp)+'</div></div>');
  recs.push('<div style="background:var(--surface);border:1.5px solid '+(avgSurplus>0?'var(--green)':'var(--red)')+';border-radius:12px;padding:12px 16px;flex:1;min-width:130px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-weight:800">Monthly Surplus</div><div style="font-size:22px;font-weight:700;color:'+surplusColor+';font-family:Playfair Display,serif">'+fmtSigned(avgSurplus)+'</div><div style="font-size:11px;color:var(--muted)">'+(avgSurplus>0?'Available to allocate':'Spending exceeds income')+'</div></div>');
  // Current month actual
  var curSurplus = curInc - curExp;
  recs.push('<div style="background:var(--surface);border:1.5px solid var(--accent2);border-radius:12px;padding:12px 16px;flex:1;min-width:130px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-weight:800">This Month</div><div style="font-size:22px;font-weight:700;color:'+(curSurplus>=0?'var(--green)':'var(--red)')+';font-family:Playfair Display,serif">'+fmtSigned(curSurplus)+'</div><div style="font-size:11px;color:var(--muted)">'+fmt(curInc)+' in / '+fmt(curExp)+' out</div></div>');
  recs.push('</div></div>');

  // ─ Section B: Savings Allocation ────────────────────────────────────────
  recs.push('<div style="margin-bottom:18px">');
  recs.push('<div style="font-size:11px;font-weight:800;color:var(--text2);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">💡 '+provLabel+' Savings Allocation</div>');

  if(avgSurplus <= 0){
    recs.push('<div style="background:var(--red-light);border:1.5px solid var(--red);border-radius:12px;padding:14px 16px;font-size:13px;color:var(--red)">⚠️ <strong>Monthly deficit detected.</strong> Expenses are exceeding income by '+fmt(Math.abs(avgSurplus))+'/mo on average. Focus on reducing spending before allocating to savings goals.</div>');
  } else {
    var remaining = avgSurplus;
    var alloc = [];

    // Priority 1 — Emergency fund check (3 months expenses)
    var emergTarget = avgExp * 3;
    var emergSaved = Math.max(0, state.transactions
      .filter(function(t){ return t.account==='Savings'||t.category==='emergency'; })
      .reduce(function(s,t){ return s+t.amount; }, 0));
    var emergOk = emergSaved >= emergTarget;
    var emergAmt = emergOk ? 0 : Math.min(remaining * 0.20, 500);
    if(!emergOk && emergAmt > 0){
      alloc.push({ color:'var(--yellow)', bg:'var(--yellow-light)', border:'var(--yellow)',
        title:'🛡️ Emergency Fund (TFSA)', amount:emergAmt,
        note: fmt(emergSaved)+' saved of '+fmt(emergTarget)+' target (3 mo expenses). Top priority.' });
      remaining -= emergAmt;
    }

    // Priority 2 — CRA reserve for tips income
    if(avgTips > 0 && tipsMember){
      var craAmt = Math.min(avgTips * 0.22, remaining * 0.15);
      if(craAmt > 0){
        alloc.push({ color:'var(--yellow)', bg:'var(--yellow-light)', border:'var(--yellow)',
          title:'⚠️ CRA Tax Reserve — '+tipsMember.name,
          amount:craAmt,
          note:'~22% of '+fmt(avgTips)+' avg tips. Tips are fully taxable in Canada — keep this in a separate HISA.' });
        remaining -= craAmt;
      }
    }

    // Priority 3 — FHSA for first-time buyers
    fhsaMembers.forEach(function(m){
      var fhsaAmt = Math.min(667, remaining * 0.25); // $8,000/yr ÷ 12
      if(fhsaAmt > 0 && remaining > 0){
        alloc.push({ color:'var(--accent)', bg:'var(--surface)', border:'var(--accent)',
          title:'🏠 FHSA — '+m.name,
          amount:fhsaAmt,
          note:'Up to $667/mo ($8,000/yr). Tax-deductible contributions + tax-free withdrawals for first home.' });
        remaining -= fhsaAmt;
      }
    });

    // Priority 4 — RRSP for pension members
    pensionMembers.forEach(function(m){
      var rrspAmt = Math.min(remaining * 0.15, 500);
      if(rrspAmt > 0 && remaining > 0){
        alloc.push({ color:'var(--purple)', bg:'var(--member1-light)', border:'var(--purple)',
          title:'💼 RRSP — '+m.name,
          amount:rrspAmt,
          note:'Pension covers base retirement. RRSP contribution reduces taxable income now. Use RRSP HBP (up to $35K) toward first home.' });
        remaining -= rrspAmt;
      }
    });

    // Priority 5 — Active goals split evenly from remainder
    var activeGoals = (state.goals||[]).filter(function(g){
      return (g.current + getGoalContributions(g.id)) < g.target;
    });
    if(activeGoals.length > 0 && remaining > 0){
      var perGoal = remaining / activeGoals.length;
      activeGoals.forEach(function(g){
        var goalColors2 = {'wedding':'var(--member2)','house':'var(--green)','car':'var(--purple)','travel':'var(--accent)'};
        var gColor = goalColors2[g.name.toLowerCase()] || 'var(--accent)';
        var saved = g.current + getGoalContributions(g.id);
        var left = g.target - saved;
        var moToGoal = left > 0 ? Math.ceil(left / Math.max(1, perGoal)) : 0;
        alloc.push({ color:gColor, bg:'var(--surface)', border:gColor,
          title:(g.emoji||'🎯')+' '+g.name+' (TFSA)',
          amount:perGoal,
          note: fmt(saved)+' of '+fmt(g.target)+' saved. '+(moToGoal>0?'~'+moToGoal+' months to goal at this rate.':'Goal reached! 🎉') });
      });
      remaining = 0;
    }

    // Leftover
    if(remaining > 5){
      alloc.push({ color:'var(--green)', bg:'var(--green-light)', border:'var(--green)',
        title:'💚 Unallocated Surplus',
        amount:remaining,
        note:'Consider topping up TFSA ($7,000/yr room) or building a travel fund.' });
    }

    recs.push('<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px">');
    alloc.forEach(function(a, i){
      recs.push('<div style="background:'+a.bg+';border:1.5px solid '+a.border+';border-radius:12px;padding:12px 14px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
        +'<div style="font-weight:800;color:'+a.color+';font-size:13px">'+a.title+'</div>'
        +'<div style="font-weight:800;color:'+a.color+';font-size:15px;font-family:Playfair Display,serif">'+fmt(a.amount)+'/mo</div>'
        +'</div>'
        +'<div style="font-size:12px;line-height:1.5;color:var(--text2)">'+a.note+'</div>'
        +'</div>');
    });
    recs.push('</div>');
  }
  recs.push('</div>');

  // ─ Section C: Goal projections ──────────────────────────────────────────
  if((state.goals||[]).length > 0){
    recs.push('<div>');
    recs.push('<div style="font-size:11px;font-weight:800;color:var(--text2);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">🎯 Goal Projections</div>');
    recs.push('<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">');
    var numGoals2 = Math.max((state.goals||[]).length, 1);
    var monthlyPerGoal = avgSurplus > 0 ? avgSurplus / numGoals2 : 0;
    (state.goals||[]).forEach(function(g){
      var saved = g.current + getGoalContributions(g.id);
      var pct = Math.min(100, Math.round(saved/Math.max(1,g.target)*100));
      var left = Math.max(0, g.target - saved);
      var moLeft = left>0 && monthlyPerGoal>0 ? Math.ceil(left/monthlyPerGoal) : 0;
      var projDate = moLeft>0 ? (function(){ var pd=new Date(now.getFullYear(),now.getMonth()+moLeft,1); return pd.toLocaleString('default',{month:'short',year:'numeric'}); })() : null;
      var barColor = pct>=100?'var(--green)':pct>=50?'var(--accent)':'var(--member2)';
      recs.push('<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:12px 14px">'
        +'<div style="font-weight:800;font-size:13px;margin-bottom:6px">'+(g.emoji||'🎯')+' '+g.name+'</div>'
        +'<div style="background:var(--border);border-radius:6px;height:7px;margin-bottom:6px"><div style="background:'+barColor+';width:'+pct+'%;height:100%;border-radius:6px;transition:width 0.4s"></div></div>'
        +'<div style="font-size:12px;color:var(--text2)">'+fmt(saved)+' <span style="color:var(--muted)">of</span> '+fmt(g.target)+' <span style="color:var(--muted)">('+pct+'%)</span></div>'
        +(pct>=100?'<div style="font-size:12px;color:var(--green);font-weight:700;margin-top:4px">🎉 Goal reached!</div>'
          :moLeft>0?'<div style="font-size:11px;color:var(--muted);margin-top:4px">~'+projDate+' at '+fmt(monthlyPerGoal)+'/mo</div>'
          :'<div style="font-size:11px;color:var(--red);margin-top:4px">No surplus to allocate</div>')
        +'</div>');
    });
    recs.push('</div></div>');
  }

  document.getElementById('forecast-recommendations').innerHTML = recs.join('');
}

// TRANSACTION CHART VIEWS
function setTxnView(view, btn){
  document.querySelectorAll('#txn-v-table,#txn-v-pie,#txn-v-bar,#txn-v-line').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  currentTxnView = view;
  if(view === 'table'){
    document.getElementById('txn-table-wrap').style.display = '';
    document.getElementById('txn-chart-wrap').style.display = 'none';
    if(txnChartInst){txnChartInst.destroy();txnChartInst=null;}
  } else {
    document.getElementById('txn-table-wrap').style.display = 'none';
    document.getElementById('txn-chart-wrap').style.display = '';
    renderTxnChart(view);
  }
}

function renderTxnChart(view){
  var txns = getFilteredTxns().filter(function(t){return t.amount<0;});
  if(txnChartInst){txnChartInst.destroy();txnChartInst=null;}
  var ctx = document.getElementById('txn-chart').getContext('2d');

  if(view === 'pie'){
    var catTotals = {};
    txns.forEach(function(t){
      var cat = getCatById(t.category);
      catTotals[cat.name] = (catTotals[cat.name]||0) + Math.abs(t.amount);
    });
    var labels = Object.keys(catTotals);
    var data = Object.values(catTotals);
    var palette = ['#c97d5a','#e07a9a','#9b7fbd','#5a9e7a','#d4a017','#d95f5f','#e8a87c','#7ab8d9','#b8957a','#6b8f6b','#d4847a','#9b8fa0'];
    var colors = labels.map(function(_,i){return palette[i%palette.length];});
    txnChartInst = new Chart(ctx, {
      type:'doughnut',
      data:{labels:labels,datasets:[{data:data,backgroundColor:colors,borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right'},tooltip:{callbacks:{label:function(c){return c.label+': $'+c.parsed.toFixed(2);}}}}}
    });

  } else if(view === 'bar'){
    var catTotals2 = {};
    var catColors = {};
    txns.forEach(function(t){
      var cat = getCatById(t.category);
      catTotals2[cat.name] = (catTotals2[cat.name]||0) + Math.abs(t.amount);
      catColors[cat.name] = cat.color||'#c97d5a';
    });
    var sortedCats = Object.entries(catTotals2).sort(function(a,b){return b[1]-a[1];});
    txnChartInst = new Chart(ctx, {
      type:'bar',
      data:{labels:sortedCats.map(function(x){return x[0];}),datasets:[{label:'Spending',data:sortedCats.map(function(x){return x[1];}),backgroundColor:sortedCats.map(function(x){return catColors[x[0]];}),borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:function(v){return '$'+v;}}}}}
    });

  } else if(view === 'line'){
    // Spending over time — group by day
    var byDay = {};
    txns.forEach(function(t){
      var d = t.date; byDay[d]=(byDay[d]||0)+Math.abs(t.amount);
    });
    var days = Object.keys(byDay).sort();
    // Running total
    var running = 0;
    var runData = days.map(function(d){running+=byDay[d];return running;});
    txnChartInst = new Chart(ctx, {
      type:'line',
      data:{labels:days,datasets:[
        {label:'Daily Spending',data:days.map(function(d){return byDay[d];}),borderColor:'#e07a9a',backgroundColor:'rgba(224,122,154,0.08)',tension:0.3,pointRadius:2},
        {label:'Cumulative',data:runData,borderColor:'#c97d5a',backgroundColor:'rgba(201,125,90,0.05)',tension:0.3,pointRadius:0,borderDash:[4,4]}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true}},scales:{y:{beginAtZero:true,ticks:{callback:function(v){return '$'+v;}}}}}
    });
  }
}

// CATEGORY SPLIT
var catSplitRows = [];

function openCatSplit(txnId){
  var t = state.transactions.find(function(x){return x.id===txnId;});
  if(!t) return;
  // If already split, load existing children; otherwise start fresh
  document.getElementById('cat-split-txn-id').value = txnId;
  document.getElementById('cat-split-txn-info').innerHTML =
    '<strong>'+(t.description||'')+'</strong><br>'
    +'<span style="color:var(--muted)">'+t.date+' &mdash; </span>'
    +'<span style="color:'+(t.amount<=0?'var(--red)':'var(--green)')+';font-weight:700">'+fmtSigned(t.amount)+'</span>';
  var existing = state.transactions.filter(function(c){return c.parentTxnId===txnId && c.source==='cat-split';});
  if(existing.length){
    catSplitRows = existing.map(function(c){return {desc:c.description,catId:c.category,amount:Math.abs(c.amount)};});
  } else {
    catSplitRows = [{desc:t.description||'',catId:t.category||'other',amount:Math.abs(t.amount)}];
  }
  renderCatSplitRows(Math.abs(t.amount));
  openModal('cat-split-modal');
}

function renderCatSplitRows(maxAmt){
  var cats = (state.categories||[]).filter(function(c){return c.id!=='transfer';});
  var catOpts = cats.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  document.getElementById('cat-split-rows').innerHTML = catSplitRows.map(function(row,i){
    return '<div style="display:flex;gap:8px;align-items:center;padding:10px 12px;background:var(--surface);border:1.5px solid var(--border);border-radius:10px">'
      +'<input type="text" value="'+(row.desc||'')+'" placeholder="Description" oninput="catSplitRows['+i+'].desc=this.value" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px">'
      +'<select onchange="catSplitRows['+i+'].catId=this.value" style="padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px">'
        +cats.map(function(c){return '<option value="'+c.id+'"'+(c.id===row.catId?' selected':'')+'>'+c.name+'</option>';}).join('')
      +'</select>'
      +'<input type="number" value="'+(row.amount||'')+'" placeholder="$0.00" step="0.01" min="0" oninput="catSplitRows['+i+'].amount=parseFloat(this.value)||0;updateCatSplitRemaining()" style="width:100px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px">'
      +(catSplitRows.length>1?'<button onclick="catSplitRows.splice('+i+',1);renderCatSplitRows('+maxAmt+')" style="background:var(--red-light);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;color:var(--red);font-weight:700;font-size:14px">&#215;</button>':'')
    +'</div>';
  }).join('');
  updateCatSplitRemaining();
}

function addCatSplitRow(){
  var txnId = document.getElementById('cat-split-txn-id').value;
  var t = state.transactions.find(function(x){return x.id===txnId;});
  catSplitRows.push({desc:'',catId:'other',amount:0});
  renderCatSplitRows(t?Math.abs(t.amount):0);
}

function updateCatSplitRemaining(){
  var txnId = document.getElementById('cat-split-txn-id').value;
  var t = state.transactions.find(function(x){return x.id===txnId;});
  var max = t ? Math.abs(t.amount) : 0;
  var used = catSplitRows.reduce(function(s,r){return s+(r.amount||0);},0);
  var rem = Math.round((max - used)*100)/100;
  var el = document.getElementById('cat-split-remaining');
  if(!el) return;
  var ok = Math.abs(rem)<0.02;
  el.style.borderColor = ok?'var(--green)':rem<0?'var(--red)':'var(--border)';
  el.style.color = ok?'var(--green)':rem<0?'var(--red)':'var(--text)';
  el.innerHTML = ok
    ? '&#10003; Splits balance perfectly &mdash; <strong>$'+used.toFixed(2)+'</strong>'
    : rem>0
      ? 'Remaining to allocate: <strong>$'+rem.toFixed(2)+'</strong>'
      : '&#9888; Over by <strong>$'+Math.abs(rem).toFixed(2)+'</strong> &mdash; reduce a split amount';
}

function saveCatSplit(){
  var txnId = document.getElementById('cat-split-txn-id').value;
  var t = state.transactions.find(function(x){return x.id===txnId;});
  if(!t) return;
  var max = Math.abs(t.amount);
  // If already split (parent zeroed), re-derive max from existing children
  if(max < 0.01){
    var oldKids = state.transactions.filter(function(c){return c.parentTxnId===txnId && c.source==='cat-split';});
    max = oldKids.reduce(function(s,c){return s+Math.abs(c.amount);},0);
  }
  var used = catSplitRows.reduce(function(s,r){return s+(r.amount||0);},0);
  if(Math.abs(used-max)>0.02){hhAlert('Split total ($'+used.toFixed(2)+') must equal the transaction amount ($'+max.toFixed(2)+').','⚠️');return;}
  var valid = catSplitRows.filter(function(r){return r.amount>0;});
  if(!valid.length){closeModal('cat-split-modal');return;}

  // Capture original sign BEFORE zeroing
  var origIsExpense = t.amount < 0 || (t.amount === 0 && t.source==='cat-split-parent' &&
    state.transactions.some(function(c){return c.parentTxnId===txnId && c.amount<0;}));

  // Remove any existing cat-split children for this transaction
  state.transactions = state.transactions.filter(function(tx){return !(tx.parentTxnId===txnId && tx.source==='cat-split');});

  // Mark parent as split (zero amount so it doesn't double-count budgets)
  t.source = 'cat-split-parent';
  t.amount = 0;

  // Create child transactions — income category → positive, everything else mirrors original sign
  valid.forEach(function(r){
    var childSign = (r.catId==='income') ? 1 : (origIsExpense ? -1 : 1);
    state.transactions.push({
      id:uid(), date:t.date, description:r.desc||t.description,
      amount: childSign * Math.abs(r.amount),
      category: r.catId, person: t.person, account: t.account,
      source: 'cat-split', parentTxnId: txnId
    });
  });

  saveState();
  closeModal('cat-split-modal');
  renderTransactions();
  if(document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
  hhToast('Transaction split into '+valid.length+' categories ✅','success');
}

// GOAL SPLIT (transaction splitting)
var splitRows = [];

function openGoalSplit(txnId){
  var t = state.transactions.find(function(x){return x.id===txnId;});
  if(!t) return;
  document.getElementById('split-txn-id').value = txnId;
  document.getElementById('split-txn-info').innerHTML =
    '<strong>'+t.description+'</strong><br>'
    +'<span style="color:var(--muted)">'+t.date+' &mdash; </span>'
    +'<span style="color:'+(t.amount<0?'var(--red)':'var(--green)')+';font-weight:700">'+fmtSigned(t.amount)+'</span>';

  // Load existing splits if any
  var existing = (state.goalSplits||{})[txnId]||[];
  splitRows = existing.length ? existing.map(function(s){return{goalId:s.goalId,amount:s.amount};}) : [{goalId:'',amount:''}];
  renderSplitRows(Math.abs(t.amount));
  openModal('split-modal');
}

function renderSplitRows(maxAmt){
  var container = document.getElementById('split-rows');
  container.innerHTML = splitRows.map(function(row, i){
    var goalOpts = (state.goals||[]).map(function(g){
      return '<option value="'+g.id+'"'+(g.id===row.goalId?' selected':'')+'>'+g.emoji+' '+g.name+'</option>';
    }).join('');
    return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">'
      +'<select onchange="splitRows['+i+'].goalId=this.value;updateSplitRemaining()" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">'
      +'<option value="">-- Select Goal --</option>'+goalOpts
      +'</select>'
      +'<input type="number" value="'+(row.amount||'')+'" placeholder="$0.00" step="0.01" oninput="splitRows['+i+'].amount=parseFloat(this.value)||0;updateSplitRemaining()" style="width:110px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">'
      +'<button onclick="splitRows.splice('+i+',1);renderSplitRows('+maxAmt+')" style="background:var(--red-light);border:none;border-radius:6px;padding:6px 10px;cursor:pointer;color:var(--red);font-weight:700">&#215;</button>'
      +'</div>';
  }).join('');
  updateSplitRemaining();
}

function addSplitRow(){
  var txnId=document.getElementById('split-txn-id').value;
  var t=state.transactions.find(function(x){return x.id===txnId;});
  splitRows.push({goalId:'',amount:''});
  renderSplitRows(t?Math.abs(t.amount):0);
}

function updateSplitRemaining(){
  var txnId=document.getElementById('split-txn-id').value;
  var t=state.transactions.find(function(x){return x.id===txnId;});
  var max=t?Math.abs(t.amount):0;
  var used=splitRows.reduce(function(s,r){return s+(parseFloat(r.amount)||0);},0);
  var rem=max-used;
  var el=document.getElementById('split-remaining');
  el.style.borderColor=rem<0?'var(--red)':'var(--border)';
  el.style.color=rem<0?'var(--red)':rem===0?'var(--green)':'var(--text)';
  el.innerHTML='Transaction total: <strong>'+fmt(max)+'</strong> &nbsp;|&nbsp; Allocated: <strong>'+fmt(used)+'</strong> &nbsp;|&nbsp; Remaining: <strong>'+fmt(rem)+'</strong>';
}

function saveGoalSplit(){
  var txnId=document.getElementById('split-txn-id').value;
  var t=state.transactions.find(function(x){return x.id===txnId;});
  if(!t) return;
  var max=Math.abs(t.amount);
  var used=splitRows.reduce(function(s,r){return s+(parseFloat(r.amount)||0);},0);
  if(used>max+0.01){hhAlert('Split total ($'+used.toFixed(2)+') exceeds transaction amount ($'+max.toFixed(2)+').', '⚠️');return;}
  var validSplits=splitRows.filter(function(r){return r.goalId&&r.amount>0;});
  if(!validSplits.length){closeModal('split-modal');return;}

  // Remove old split transactions for this txn
  if(!state.goalSplits)state.goalSplits={};
  var oldSplits=state.goalSplits[txnId]||[];
  oldSplits.forEach(function(s){
    // Also remove any balancing debit transactions created
    state.transactions=state.transactions.filter(function(tx){return tx.id!==s.splitTxnId && tx.splitDebitId!==s.splitTxnId;});
  });

  // Create new split transactions
  var savedSplits=[];
  validSplits.forEach(function(r){
    var splitId=uid();
    var desc='Split: '+t.description;
    // Positive entry to goal category
    state.transactions.push({id:splitId,date:t.date,description:desc,amount:parseFloat(r.amount),
      category:'goal:'+r.goalId,person:t.person,account:t.account,source:'split',parentTxnId:txnId});
    // Balancing debit from the source account to keep balance accurate
    var debitId=uid();
    state.transactions.push({id:debitId,date:t.date,description:desc+' (transfer)',amount:-parseFloat(r.amount),
      category:'transfer',person:t.person,account:t.account,source:'split_debit',parentTxnId:txnId,splitDebitId:splitId});
    savedSplits.push({goalId:r.goalId,amount:parseFloat(r.amount),splitTxnId:splitId,splitDebitId:debitId});
  });
  state.goalSplits[txnId]=savedSplits;
  saveState();
  closeModal('split-modal');
  if(document.getElementById('page-transactions').classList.contains('active'))renderTransactions();
  if(document.getElementById('page-goals').classList.contains('active'))renderGoals();
  if(document.getElementById('page-dashboard').classList.contains('active'))renderDashboard();
  if(document.getElementById('page-budget').classList.contains('active'))renderBudget();
}



