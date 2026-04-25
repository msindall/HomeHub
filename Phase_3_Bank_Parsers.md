# Home Hub — Phase 3: New Bank Parsers & Smart CSV Import

Paste this entire document into a new Cowork session to execute Phase 3.

**Prerequisite:** Phase 1 must be complete (working build pipeline). Phase 2 is optional before this.

---

## What this project is

Home Hub is a single-file HTML household management app for Matt & Holly (Ontario, Canada). No npm, no server. Source files sit flat in `D:\Claude\Home Planner\`. Running `python build.py` produces `App_VX_Y.html`.

**Working folder:** `D:\Claude\Home Planner\`

---

## Context: bank statement importing

The app already imports CSV bank statements. Two parsers exist in `07-upload.js`:

- `parseBMOStatement()` — BMO chequing/savings
- `parseCTMastercardStatement()` — Canadian Tire Mastercard

A format detector `detectCSVFormat(lines)` reads the header row and returns a format string (`'bmo'`, `'ctmc'`, or `'unknown'`). The import flow is:

1. User picks a CSV file
2. `detectCSVFormat()` identifies the bank
3. The appropriate parser runs
4. `showImportPreview()` shows a preview table — user confirms before committing
5. Duplicate detection runs (same date + amount + description)
6. Accepted rows merge into `state.transactions`

**All new parsers must follow this exact same pattern.** Never auto-import — always go through the preview step.

Each transaction in `state.transactions` has this shape:
```javascript
{
  id: 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2),
  date: 'YYYY-MM-DD',        // ISO 8601
  description: 'string',
  amount: -50.00,            // negative = expense, positive = income/credit
  category: 'other',         // default; user can change
  account: 'string',         // e.g. 'RBC Chequing', 'Capital One MC'
  tags: [],
  notes: ''
}
```

Helper `toISO(dateStr)` already exists in `01-core.js` — use it to normalise all date formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.).

---

## Banks to add (confirmed by Matt)

1. **RBC chequing / savings** (separate format from RBC Visa)
2. **RBC Visa**
3. **Alterna Savings** (online credit union)
4. **Capital One Mastercard** (Canadian)
5. **Generic AI fallback** — when no parser matches, use Claude API to identify columns

---

## Phase 3 tasks

### Task 1 — Research actual CSV formats

Before writing any parser, fetch sample CSV header rows for each bank. Use web search or the following known formats:

**RBC chequing/savings** — typical headers:
`Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$`

**RBC Visa** — typical headers:
`Transaction Date,Description 1,Description 2,Amount,Currency`
(Amount: negative = charge to card, positive = payment/credit)

**Alterna Savings** — typical headers (online banking export):
`Date,Description,Debit,Credit,Balance`
(Debit and Credit are separate positive columns)

**Capital One Mastercard (Canada)** — typical headers:
`Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit`

Verify these formats by web search before implementing. If you find a different actual format, use that.

### Task 2 — Add RBC chequing/savings parser

Add to `07-upload.js` (near the existing parsers, before `detectCSVFormat`):

```javascript
function parseRBCStatement(lines) {
  // RBC chequing / savings
  // Headers: Account Type, Account Number, Transaction Date, Cheque Number, 
  //          Description 1, Description 2, CAD$, USD$
  var txns = [];
  var accountName = 'RBC Chequing';
  // Extract account type from first data row if available
  for (var i = 1; i < lines.length; i++) {
    var cols = parseCSVLine(lines[i]);
    if (!cols || cols.length < 7) continue;
    var accountType = (cols[0] || '').trim();
    if (accountType) accountName = 'RBC ' + accountType;
    var dateStr  = (cols[2] || '').trim();
    var desc1    = (cols[4] || '').trim();
    var desc2    = (cols[5] || '').trim();
    var desc     = desc2 ? desc1 + ' ' + desc2 : desc1;
    var cadAmt   = parseFloat((cols[6] || '0').replace(/[,$]/g, '')) || 0;
    if (!dateStr || isNaN(cadAmt)) continue;
    txns.push({
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
      date: toISO(dateStr),
      description: desc,
      amount: cadAmt,   // RBC uses negative for debits already
      category: 'other',
      account: accountName,
      tags: [], notes: ''
    });
  }
  return txns;
}
```

### Task 3 — Add RBC Visa parser

```javascript
function parseRBCVisaStatement(lines) {
  // RBC Visa credit card
  // Headers: Transaction Date, Description 1, Description 2, Amount, Currency
  var txns = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = parseCSVLine(lines[i]);
    if (!cols || cols.length < 4) continue;
    var dateStr = (cols[0] || '').trim();
    var desc1   = (cols[1] || '').trim();
    var desc2   = (cols[2] || '').trim();
    var desc    = desc2 ? desc1 + ' ' + desc2 : desc1;
    var amt     = parseFloat((cols[3] || '0').replace(/[,$]/g, '')) || 0;
    var curr    = (cols[4] || 'CAD').trim();
    if (!dateStr || isNaN(amt)) continue;
    // RBC Visa: positive amount = charge, negative = payment — flip sign for our convention
    txns.push({
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
      date: toISO(dateStr),
      description: desc,
      amount: -amt,   // flip: charges become negative expenses
      category: 'other',
      account: 'RBC Visa' + (curr !== 'CAD' ? ' (' + curr + ')' : ''),
      tags: [], notes: ''
    });
  }
  return txns;
}
```

### Task 4 — Add Alterna Savings parser

```javascript
function parseAlternaStatement(lines) {
  // Alterna Savings — separate Debit / Credit columns
  // Headers: Date, Description, Debit, Credit, Balance
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
    txns.push({
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
      date: toISO(dateStr),
      description: desc,
      amount: amount,
      category: 'other',
      account: 'Alterna Savings',
      tags: [], notes: ''
    });
  }
  return txns;
}
```

### Task 5 — Add Capital One Mastercard parser

```javascript
function parseCapitalOneMCStatement(lines) {
  // Capital One Mastercard Canada
  // Headers: Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit
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
    // Map Capital One's own category to our categories where possible
    var capOneCat = (cols[4] || '').trim().toLowerCase();
    var category = 'other';
    if (capOneCat.includes('dining') || capOneCat.includes('restaurant')) category = 'dining';
    else if (capOneCat.includes('grocer')) category = 'groceries';
    else if (capOneCat.includes('gas') || capOneCat.includes('fuel')) category = 'gas';
    else if (capOneCat.includes('travel') || capOneCat.includes('hotel') || capOneCat.includes('airline')) category = 'travel';
    else if (capOneCat.includes('entertainment')) category = 'entertainment';
    else if (capOneCat.includes('health') || capOneCat.includes('pharmacy')) category = 'health';
    txns.push({
      id: 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
      date: toISO(dateStr),
      description: desc,
      amount: amount,
      category: category,
      account: 'Capital One MC',
      tags: [], notes: ''
    });
  }
  return txns;
}
```

### Task 6 — Update detectCSVFormat() to recognise new banks

In `detectCSVFormat(lines)` in `07-upload.js`, add detection for the new formats. Detection works by inspecting the header row (`lines[0]`). Add these cases:

```javascript
var header = lines[0].toLowerCase();

// Existing checks (keep as-is)
if (header.includes('transaction date') && header.includes('cheque number') && header.includes('cad$')) return 'rbc';
if (header.includes('transaction date') && header.includes('description 1') && header.includes('currency')) return 'rbc_visa';
if (header.includes('date') && header.includes('debit') && header.includes('credit') && header.includes('balance') && !header.includes('card')) return 'alterna';
if (header.includes('transaction date') && header.includes('card no') && header.includes('debit') && header.includes('credit')) return 'capital_one_mc';
```

Then in the main import handler, add the new cases to the format dispatch switch:

```javascript
case 'rbc':          txns = parseRBCStatement(lines); break;
case 'rbc_visa':     txns = parseRBCVisaStatement(lines); break;
case 'alterna':      txns = parseAlternaStatement(lines); break;
case 'capital_one_mc': txns = parseCapitalOneMCStatement(lines); break;
```

Also update the "Detected format" display in `showImportPreview()` to show human-readable bank names for the new codes.

### Task 7 — Generic AI fallback parser

When `detectCSVFormat()` returns `'unknown'`, offer an AI-assisted import path. This uses the existing `callClaude()` function in `01-core.js`.

Add a new function `parseWithAI(lines, filename)` in `07-upload.js`:

```javascript
async function parseWithAI(lines, filename) {
  var key = getApiKey();
  if (!key) {
    hhAlert('An Anthropic API key is needed for AI-assisted import. Add it in Settings.', '🔑');
    return null;
  }
  // Send first 5 rows to Claude to identify column mapping
  var sample = lines.slice(0, 6).join('\n');
  var prompt = 'Here is the header and first 5 rows of a Canadian bank statement CSV:\n\n```\n' + sample + '\n```\n\n'
    + 'Identify which column index (0-based) maps to each of: date, description, amount (signed, negative=expense), debit_amount, credit_amount.\n'
    + 'If amount is split into debit/credit columns, say so.\n'
    + 'Also identify the likely bank name from the columns.\n'
    + 'Respond with ONLY valid JSON: {"date":0,"description":1,"amount":3,"debit":null,"credit":null,"bank":"Bank Name","sign_convention":"negative_expense"}\n'
    + 'sign_convention is either "negative_expense" (negative=expense, positive=income) or "positive_debit" (positive=charge, must flip).';

  hhToast('Asking AI to identify CSV format…', '🤖');
  try {
    var resp = await callClaude(prompt, 300);
    var mapping = JSON.parse(resp.trim().replace(/^```json|```$/g,'').trim());
    // Now parse all rows using mapping
    var txns = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = parseCSVLine(lines[i]);
      if (!cols || cols.length === 0) continue;
      var dateStr = (cols[mapping.date] || '').trim();
      var desc    = (cols[mapping.description] || '').trim();
      var amt;
      if (mapping.amount !== null && mapping.amount !== undefined) {
        amt = parseFloat((cols[mapping.amount] || '0').replace(/[,$]/g, '')) || 0;
        if (mapping.sign_convention === 'positive_debit') amt = -amt;
      } else {
        var deb = parseFloat((cols[mapping.debit]  || '0').replace(/[,$]/g, '')) || 0;
        var crd = parseFloat((cols[mapping.credit] || '0').replace(/[,$]/g, '')) || 0;
        amt = crd > 0 ? crd : -deb;
      }
      if (!dateStr) continue;
      txns.push({
        id: 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
        date: toISO(dateStr),
        description: desc,
        amount: amt,
        category: 'other',
        account: mapping.bank || filename.replace(/\.csv$/i,''),
        tags: [], notes: ''
      });
    }
    return txns;
  } catch(e) {
    hhAlert('AI could not parse this CSV: ' + e.message + '. Try exporting from your bank as a different format.', '⚠️');
    return null;
  }
}
```

In the import flow, when `detectCSVFormat()` returns `'unknown'`, show a prompt:
```
"Bank format not recognised. Use AI to detect columns? (requires API key)"
```
If yes, call `parseWithAI(lines, filename)` and proceed to the normal preview step.

### Task 8 — Cross-account duplicate detection improvement

The existing duplicate detection checks: same date + amount + description within the same import batch. **Extend it** to also check against existing transactions in `state.transactions` across all accounts.

In the duplicate-check logic (wherever `showImportPreview()` does its dupe scan), add a cross-account check:

```javascript
// Check against all existing transactions (cross-account)
var existingKey = state.transactions.map(function(t) {
  return t.date + '|' + t.amount + '|' + (t.description || '').toLowerCase().trim();
});
var crossAccountDupes = incoming.filter(function(t) {
  var key = t.date + '|' + t.amount + '|' + (t.description || '').toLowerCase().trim();
  return existingKey.indexOf(key) !== -1;
});
```

Flag these as "Already imported" in the preview table with a distinct colour (use CSS variable `--yellow` or `--muted`). Let the user still choose to import them (in case of legitimate duplicate transactions) but warn clearly.

Also add a "transfer detection" notice: if two transactions on the same date have opposite amounts (e.g. +$500 in chequing and -$500 on Visa), flag them as "Possible transfer — check if this is a payment between your own accounts" and auto-suggest the `transfer` category.

---

## Helper function check

Make sure `parseCSVLine(line)` exists in `07-upload.js`. This function should handle quoted fields (fields containing commas wrapped in `"..."`). If it doesn't already exist, add a robust implementation:

```javascript
function parseCSVLine(line) {
  var result = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}
```

---

## Conventions to follow

- Never use `alert()`, `confirm()`, `prompt()` — use `hhAlert()`, `hhConfirm()`, `hhToast()`
- Always go through `showImportPreview()` — never auto-import
- Use `toISO(dateStr)` for all date normalisation
- Transaction `amount`: negative = expense, positive = income/credit
- `saveState()` after every state mutation
- Ontario/Canada context only

---

## Success criteria for Phase 3

- [ ] `python build.py` produces a working file
- [ ] Upload page correctly identifies RBC chequing CSV and shows format name "RBC Chequing/Savings"
- [ ] Upload page correctly identifies RBC Visa CSV
- [ ] Upload page correctly identifies Alterna Savings CSV
- [ ] Upload page correctly identifies Capital One MC CSV
- [ ] Each parser produces correctly signed amounts (expenses negative, credits positive)
- [ ] Unknown CSVs prompt the AI fallback option (when API key is set)
- [ ] AI fallback successfully parses at least one non-standard CSV in testing
- [ ] Cross-account duplicate detection warns on dupes from previous imports
- [ ] Transfer detection flags likely account-to-account payments
- [ ] No JavaScript errors in browser console

---

## After Phase 3 is complete

Phase 4 adds AI transaction auto-categorisation, bill detection from transaction patterns, savings rate tracking, FHSA optimiser, and a monthly PDF report. The Phase 4 plan document is `Phase_4_AI_Finance.md` in this folder.
