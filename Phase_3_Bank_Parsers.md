# Home Hub — Phase 3: New Bank Parsers & Smart CSV Import

Paste this entire document into a new Cowork session to execute Phase 3.

**Prerequisite:** Phase 1 (build pipeline) must be complete. ✅ Already done.

---

## What this project is

Home Hub is a single-file HTML household management app for Matt & Holly (Ontario, Canada). No npm, no server. Source files sit flat in `D:\Claude\Home Planner\`. Running `python build.py` produces `App_VX_Y.html`.

**Working folder:** `D:\Claude\Home Planner\`  
**Current version:** `App_V6_39.html` (check folder for the actual latest)

---

## Current state of bank parsers

Two parsers already exist in `07-upload.js`:

- `parseBMOStatement()` — BMO chequing/savings ✅ done
- `parseCTMastercardStatement()` — Canadian Tire Mastercard ✅ done

`detectCSVFormat(lines)` reads the header row and returns a format string. The import flow is: detect → parse → `showImportPreview()` (user confirms) → duplicate check → merge into `state.transactions`. **Never auto-import — always go through the preview step.**

Each transaction shape:
```javascript
{
  id: uid(),
  date: 'M/D/YYYY',           // app's internal format (not ISO)
  description: 'string',
  amount: -50.00,              // negative = expense, positive = income/credit
  category: 'other',
  person: 'Joint',
  account: 'string',
  source: 'import'
}
```

`toISO(dateStr)` exists in `07-upload.js` — use it for date normalisation. `parseCSVLine(line)` handles quoted CSV fields.

---

## Banks to add (confirmed by Matt)

1. **RBC chequing / savings**
2. **RBC Visa**
3. **Alterna Savings** (online credit union)
4. **Capital One Mastercard** (Canadian)
5. **Generic AI fallback** — when no parser matches, use Claude API

---

## Task 1 — Research actual CSV formats

Before writing any parser, verify the real CSV header rows. Known formats (verify with web search):

**RBC chequing/savings:**
`Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$`
Amount column (CAD$): negative = debit/expense, positive = credit.

**RBC Visa:**
`Transaction Date,Description 1,Description 2,Amount,Currency`
Amount: positive = charge (must flip to negative), negative = payment (flip to positive).

**Alterna Savings:**
`Date,Description,Debit,Credit,Balance`
Separate Debit/Credit columns. Credit > 0 means money in (positive). Debit > 0 means money out (negative).

**Capital One Mastercard (Canada):**
`Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit`
Separate Debit/Credit columns. Same convention as Alterna.

Verify these with a quick web search before implementing. If the real format differs, use the real one.

---

## Task 2 — Add RBC chequing/savings parser

Add to `07-upload.js` (near the existing parsers, before `detectCSVFormat`):

```javascript
function parseRBCStatement(lines) {
  var txns = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = parseCSVLine(lines[i]);
    if (!cols || cols.length < 7) continue;
    var accountType = (cols[0] || '').trim();
    var dateStr  = (cols[2] || '').trim();
    var desc1    = (cols[4] || '').trim();
    var desc2    = (cols[5] || '').trim();
    var desc     = (desc2 && desc2 !== desc1) ? desc1 + ' ' + desc2 : desc1;
    var cadAmt   = parseFloat((cols[6] || '0').replace(/[,$]/g, '')) || 0;
    if (!dateStr || isNaN(cadAmt)) continue;
    var accountName = 'RBC ' + (accountType || 'Chequing');
    txns.push({ id:uid(), date:toISO(dateStr), description:desc, amount:cadAmt,
      category:'other', person:'Joint', account:accountName, source:'import' });
  }
  return txns;
}
```

---

## Task 3 — Add RBC Visa parser

```javascript
function parseRBCVisaStatement(lines) {
  var txns = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = parseCSVLine(lines[i]);
    if (!cols || cols.length < 4) continue;
    var dateStr = (cols[0] || '').trim();
    var desc1   = (cols[1] || '').trim();
    var desc2   = (cols[2] || '').trim();
    var desc    = (desc2 && desc2 !== desc1) ? desc1 + ' ' + desc2 : desc1;
    var amt     = parseFloat((cols[3] || '0').replace(/[,$]/g, '')) || 0;
    if (!dateStr) continue;
    // RBC Visa: positive = charge on card → flip to negative expense
    txns.push({ id:uid(), date:toISO(dateStr), description:desc, amount:-amt,
      category:'other', person:'Joint', account:'RBC Visa', source:'import' });
  }
  return txns;
}
```

---

## Task 4 — Add Alterna Savings parser

```javascript
function parseAlternaStatement(lines) {
  var txns = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = parseCSVLine(lines[i]);
    if (!cols || cols.length < 4) continue;
    var dateStr = (cols[0] || '').trim();
    var desc    = (cols[1] || '').trim();
    var debit   = parseFloat((cols[2] || '0').replace(/[,$]/g, '')) || 0;
    var credit  = parseFloat((cols[3] || '0').replace(/[,$]/g, '')) || 0;
    if (!dateStr || (!debit && !credit)) continue;
    var amount = credit > 0 ? credit : -debit;
    txns.push({ id:uid(), date:toISO(dateStr), description:desc, amount:amount,
      category:'other', person:'Joint', account:'Alterna Savings', source:'import' });
  }
  return txns;
}
```

---

## Task 5 — Add Capital One Mastercard parser

```javascript
function parseCapitalOneMCStatement(lines) {
  var txns = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = parseCSVLine(lines[i]);
    if (!cols || cols.length < 6) continue;
    var dateStr = (cols[0] || '').trim();
    var desc    = (cols[3] || '').trim();
    var debit   = parseFloat((cols[5] || '0').replace(/[,$]/g, '')) || 0;
    var credit  = parseFloat((cols[6] || '0').replace(/[,$]/g, '')) || 0;
    if (!dateStr || (!debit && !credit)) continue;
    var amount = credit > 0 ? credit : -debit;
    // Use Capital One's own category as a starting hint
    var capCat = (cols[4] || '').trim().toLowerCase();
    var category = 'other';
    if (/dining|restaurant/.test(capCat))  category = 'dining';
    else if (/grocer/.test(capCat))         category = 'groceries';
    else if (/gas|fuel/.test(capCat))       category = 'gas';
    else if (/travel|hotel|airline/.test(capCat)) category = 'travel';
    else if (/entertainment/.test(capCat))  category = 'entertainment';
    else if (/health|pharma/.test(capCat))  category = 'health';
    txns.push({ id:uid(), date:toISO(dateStr), description:desc, amount:amount,
      category:category, person:'Joint', account:'Capital One MC', source:'import' });
  }
  return txns;
}
```

---

## Task 6 — Update `detectCSVFormat()` and the parser dispatch

In `detectCSVFormat(lines)` in `07-upload.js`, add to the header detection block:

```javascript
var h = (lines[0]||'').toLowerCase();
// Add these before the existing checks so more-specific patterns are tested first:
if (h.includes('transaction date') && h.includes('cheque number') && h.includes('cad$'))
  return 'rbc';
if (h.includes('transaction date') && h.includes('description 1') && h.includes('currency'))
  return 'rbc_visa';
if (h.includes('date') && h.includes('debit') && h.includes('credit') && h.includes('balance') && !h.includes('card'))
  return 'alterna';
if (h.includes('transaction date') && h.includes('card no') && h.includes('debit') && h.includes('credit'))
  return 'capital_one_mc';
```

In the main import handler switch/dispatch, add:
```javascript
case 'rbc':            txns = parseRBCStatement(lines); break;
case 'rbc_visa':       txns = parseRBCVisaStatement(lines); break;
case 'alterna':        txns = parseAlternaStatement(lines); break;
case 'capital_one_mc': txns = parseCapitalOneMCStatement(lines); break;
```

Update the "Detected format" human-readable label map wherever it's displayed to include the new format names.

---

## Task 7 — Generic AI fallback parser

When `detectCSVFormat()` returns `'unknown'`, offer an AI-assisted import path using the existing `callClaude()` function from `01-core.js`.

Add `parseWithAI(lines, filename)` in `07-upload.js`:

```javascript
async function parseWithAI(lines, filename) {
  var key = getApiKey();
  if (!key) { hhAlert('An Anthropic API key is needed for AI-assisted import. Add it in Settings.', '🔑'); return null; }
  var sample = lines.slice(0, 6).join('\n');
  var prompt = 'Here is the header and first 5 rows of a Canadian bank statement CSV:\n\n```\n' + sample + '\n```\n\n'
    + 'Identify which column index (0-based) maps to: date, description, amount (signed), debit_amount, credit_amount.\n'
    + 'If amount is split into debit/credit columns, say so. Identify the likely bank name.\n'
    + 'Respond with ONLY valid JSON: {"date":0,"description":1,"amount":3,"debit":null,"credit":null,"bank":"Bank Name","sign_convention":"negative_expense"}\n'
    + 'sign_convention: "negative_expense" means negative=spend (keep as-is). "positive_debit" means positive=charge (flip sign).';
  hhToast('Asking AI to identify CSV format…', '🤖');
  try {
    var resp = await callClaude(prompt, 300);
    var mapping = JSON.parse(resp.trim().replace(/^```json\n?|```$/g,'').trim());
    var txns = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = parseCSVLine(lines[i]);
      if (!cols || !cols.length) continue;
      var dateStr = (cols[mapping.date]||'').trim();
      var desc    = (cols[mapping.description]||'').trim();
      var amt;
      if (mapping.amount !== null && mapping.amount !== undefined) {
        amt = parseFloat((cols[mapping.amount]||'0').replace(/[,$]/g,''))||0;
        if (mapping.sign_convention === 'positive_debit') amt = -amt;
      } else {
        var deb = parseFloat((cols[mapping.debit]||'0').replace(/[,$]/g,''))||0;
        var crd = parseFloat((cols[mapping.credit]||'0').replace(/[,$]/g,''))||0;
        amt = crd > 0 ? crd : -deb;
      }
      if (!dateStr) continue;
      txns.push({ id:uid(), date:toISO(dateStr), description:desc, amount:amt,
        category:'other', person:'Joint', account:mapping.bank||filename.replace(/\.csv$/i,''), source:'import' });
    }
    return txns;
  } catch(e) {
    hhAlert('AI could not parse this CSV: ' + e.message + '. Try a different export format from your bank.', '⚠️');
    return null;
  }
}
```

In the import flow, when format is `'unknown'`:
```javascript
var useAI = await hhConfirm('Bank format not recognised. Use AI to detect columns? (requires API key in Settings)', '🤖', 'AI Import');
if (useAI) {
  txns = await parseWithAI(lines, file.name);
  if (!txns) return; // AI failed, already showed error
} else { return; }
```

---

## Task 8 — Cross-account duplicate detection

The existing duplicate check looks for same date+amount+description within the current import batch. Extend it to also warn about matches against already-imported transactions in `state.transactions`.

In `showImportPreview()` or wherever the preview table is built, add:

```javascript
var existingKeys = new Set(
  (state.transactions||[]).map(function(t){
    return toISO(t.date||'')+'|'+t.amount+'|'+(t.description||'').toLowerCase().trim();
  })
);
// For each incoming txn, flag if it's already in state.transactions
incoming.forEach(function(t){
  var key = toISO(t.date||'')+'|'+t.amount+'|'+(t.description||'').toLowerCase().trim();
  t._alreadyImported = existingKeys.has(key);
});
```

In the preview table, mark already-imported rows with a yellow "Already imported" badge. They're still selectable (in case of a legitimate duplicate) but warned clearly. Default them to unchecked in the preview.

---

## Conventions to follow

- Never use `alert()`, `confirm()`, `prompt()` — use `hhAlert()`, `hhConfirm()`, `hhToast()`
- Always go through `showImportPreview()` — never auto-import
- Use `toISO(dateStr)` for all date normalisation into YYYY-MM-DD (used internally for comparisons)
- Transaction `date` stored as M/D/YYYY (app's internal format)
- Transaction `amount`: negative = expense, positive = income/credit
- `saveState()` after every state mutation
- Ontario/Canada only

---

## Success criteria

- [ ] `python build.py` produces a working file
- [ ] Uploading an RBC chequing CSV shows "RBC Chequing/Savings" in the detected format label
- [ ] Uploading an RBC Visa CSV correctly flips positive amounts to negative
- [ ] Uploading an Alterna Savings CSV correctly handles split debit/credit columns
- [ ] Uploading a Capital One MC CSV uses Capital One's category hints as a starting point
- [ ] Uploading an unknown CSV prompts the AI fallback option
- [ ] AI fallback correctly parses a non-standard CSV in testing
- [ ] Importing a CSV that duplicates existing transactions warns with "Already imported" badge
- [ ] No JavaScript errors in browser console

---

## After Phase 3

Move on to `Phase_4_AI_Finance.md` or `Phase_5_Quality_of_Life.md` — both are independent.
