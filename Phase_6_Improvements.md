# Home Hub — Phase 6: Improvements & UX Gaps

Paste this entire document into a new Cowork session to execute Phase 6.

**Prerequisite:** Phase 0 (bug fixes) should be complete first.

---

## What this project is

Home Hub is a single-file HTML household management app for Matt & Holly (Ontario, Canada). No npm, no server. Source files sit flat in `D:\Claude\Home Planner\`. Running `python build.py` produces `App_VX_Y.html`.

**Working folder:** `D:\Claude\Home Planner\`  
**Current version:** `App_V6_39.html` (check folder for latest)

---

## Source file map

| File | Role |
|------|------|
| `style.css` | All CSS — CSS custom properties only |
| `shell.html` | Page skeleton, nav, all page `<div>` containers |
| `modals.html` | Modal HTML (first half) |
| `tail.html` | Modal HTML (second half) + closing tags |
| `01-core.js` | State, storage, helpers, dialogs, navigation |
| `02-dashboard.js` | Dashboard rendering and reminders |
| `03-finance.js` | Transactions, budget, accounts, goals |
| `04-planning.js` | Wedding, house/mortgage, bills |
| `05-household.js` | Net worth, car funds, tax prep, retirement, tips, pets |
| `06-insights.js` | Grocery, shopping list, pantry, meal plan, recipes |
| `07-upload.js` | Bank import, career, charts, setup wizard, `_initApp()` |

---

## Conventions — never violate these

- Never use `window.alert()`, `window.confirm()`, `window.prompt()` — use `hhAlert()`, `hhConfirm()`, `hhToast()`
- Never hardcode hex colours in CSS — use CSS custom properties
- `saveState()` after every state mutation
- Modal HTML in `modals.html` (simple) or `tail.html` (complex)
- Ontario/Canada only — no US tax logic

---

## Task 1 — Auto-classification rules manager

**Problem:** When users click "Apply to All" on a transaction, a catRule is silently saved to `state.catRules`. There is no UI to view, edit, or delete these rules. Stale rules can misclassify future imports indefinitely.

**Add a "Auto-Rules" section to the Categories modal** (which already exists at `id="category-modal"` or similar). The section should:

1. List all entries in `state.catRules` as a table: Match String | → Category | Delete button
2. Allow adding new rules manually: a text input for the match string, a category dropdown, an "Add Rule" button
3. "Delete" on a rule removes it from `state.catRules` and saves

```javascript
function renderCatRules() {
  var el = document.getElementById('cat-rules-list');
  if (!el) return;
  var rules = state.catRules || [];
  if (!rules.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0">No auto-rules yet. When you choose "Apply to All" on a transaction, rules are saved here.</div>';
    return;
  }
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px">'
    + rules.map(function(r, i) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface);border-radius:8px;font-size:12px">'
          + '<span style="flex:1;font-family:monospace">'+r.match+'</span>'
          + '<span style="color:var(--muted)">→</span>'
          + '<span style="font-weight:600">'+getCatById(r.cat).name+'</span>'
          + '<button class="btn btn-danger btn-sm" onclick="deleteCatRule('+i+')">✕</button>'
          + '</div>';
      }).join('')
    + '</div>';
}

function deleteCatRule(index) {
  state.catRules.splice(index, 1);
  saveState();
  renderCatRules();
}

function addCatRule() {
  var match = (document.getElementById('new-rule-match').value||'').trim().toUpperCase();
  var cat = document.getElementById('new-rule-cat').value;
  if (!match || !cat) { hhToast('Enter a match keyword and select a category.','⚠️'); return; }
  if (!state.catRules) state.catRules = [];
  if (state.catRules.find(function(r){return r.match===match;})) { hhToast('That rule already exists.','ℹ️'); return; }
  state.catRules.push({match:match, cat:cat});
  saveState();
  document.getElementById('new-rule-match').value = '';
  renderCatRules();
}
```

Add the rules list, a match input, and a category select (using `populateCatSelect()`) to the categories modal. Call `renderCatRules()` when the modal opens.

---

## Task 2 — Tax page: auto-fill income from transactions

**Problem:** The tax prep page requires manual entry of employment income. The user has already imported transactions — income is already in the system but isn't pulled into the tax form.

**Add an "Auto-fill from transactions" button** to the tax inputs modal (in `tail.html`, near the tax income fields).

When clicked, call `autoFillTaxIncome(year)`:

```javascript
function autoFillTaxIncome(year) {
  var yr = year || getTaxYear();
  // Find the salary member (hasPension flag) and tips member (hasTips flag)
  var salaryMember = (state.members||[]).find(function(m){return m.incomeType==='salary'||m.hasPension;});
  var tipsMember   = getTipsMember();

  // Sum income transactions for the year by person
  var incomeByPerson = {};
  (state.transactions||[]).forEach(function(t) {
    if (t.category !== 'income') return;
    if (t.source === 'tips' || t.source === 'split') return;
    var tYear = new Date(toISO(t.date)+'T00:00:00').getFullYear();
    if (tYear !== yr) return;
    var p = t.person || 'Joint';
    incomeByPerson[p] = (incomeByPerson[p]||0) + (parseFloat(t.amount)||0);
  });

  // Assign to the salary member's tax field
  if (salaryMember) {
    var sal = incomeByPerson[salaryMember.name] || 0;
    if (sal > 0) {
      var el = document.getElementById('tax-matt-employment'); // keep existing ID
      if (el) { el.value = sal.toFixed(2); }
    }
  }
  // Holly's employment income (from transactions, not tips)
  if (tipsMember) {
    var hollyBase = incomeByPerson[tipsMember.name] || 0;
    if (hollyBase > 0) {
      var hEl = document.getElementById('tax-holly-employment');
      if (hEl) { hEl.value = hollyBase.toFixed(2); }
    }
  }

  var total = Object.values(incomeByPerson).reduce(function(s,v){return s+v;},0);
  hhToast('Auto-filled from ' + yr + ' transactions — review and adjust as needed.', '✅');
}
```

Note: This gives a starting point; users must still review and enter T4 box 22 (tax withheld), pension adjustment (box 52), RRSP receipts etc. Make this clear with a note in the UI.

---

## Task 3 — Bulk transaction re-categorise

**Problem:** Changing categories one-by-one is slow when importing a new bank account for the first time.

**Add multi-select to the transactions table.** Implement as:

1. A checkbox column (leftmost) — check individual rows
2. A "Select All" checkbox in the header
3. A bulk action bar that appears when ≥1 transaction is checked: shows count, a category dropdown, and an "Apply to selected" button

```javascript
var _selectedTxnIds = new Set();

function toggleTxnSelect(id, checked) {
  if (checked) _selectedTxnIds.add(id);
  else _selectedTxnIds.delete(id);
  updateBulkActionBar();
}

function updateBulkActionBar() {
  var bar = document.getElementById('txn-bulk-bar');
  if (!bar) return;
  var count = _selectedTxnIds.size;
  bar.style.display = count ? '' : 'none';
  if (count) {
    bar.innerHTML = '<strong>' + count + '</strong> selected &nbsp;'
      + '<select id="bulk-cat-select" style="padding:4px 8px;border-radius:6px;background:var(--bg);color:var(--text);border:1px solid var(--border)">'
      + buildCatOptions('') + '</select> &nbsp;'
      + '<button class="btn btn-primary btn-sm" onclick="applyBulkCategory()">Apply Category</button>'
      + ' &nbsp;<button class="btn btn-ghost btn-sm" onclick="clearTxnSelection()">Clear</button>';
  }
}

function applyBulkCategory() {
  var cat = document.getElementById('bulk-cat-select').value;
  if (!cat) return;
  var count = 0;
  state.transactions.forEach(function(t){
    if (_selectedTxnIds.has(t.id)) { t.category = cat; count++; }
  });
  saveState();
  _selectedTxnIds.clear();
  renderTransactions();
  hhToast(count + ' transactions updated to ' + getCatById(cat).name, '✅');
}

function clearTxnSelection() {
  _selectedTxnIds.clear();
  renderTransactions();
}
```

Add a `<div id="txn-bulk-bar" style="display:none;...">` above the transactions table in `shell.html`, and add a checkbox column to `renderTxnTable()`.

---

## Task 4 — Net worth: fix potential car fund double-count

**File:** `04-planning.js`

**Problem:** `calcCurrentNetWorth()` adds `c.savedAmount + getCarFundContributions(c.id)` for each car fund on top of account balances. But car-tagged transactions come from those same bank accounts, which are already included in `totalAssets`. This can double-count.

**Fix:** Only include car fund data in net worth if the money is NOT in a tracked account:

```javascript
// In calcCurrentNetWorth(), replace the car funds block:
(state.carFunds||[]).forEach(function(c){
  // Only add the manually-entered savedAmount — transaction contributions
  // are already reflected in the account balances since they're real bank transactions.
  // (savedAmount is for cash/external savings not linked to an imported account)
  var manualSaved = c.savedAmount || 0;
  if (manualSaved > 0) totalAssets += manualSaved;
});
```

This removes `getCarFundContributions()` from net worth to avoid the double-count. The car fund *page* still shows transaction contributions correctly (that logic is separate). The net worth will now be accurate.

---

## Task 5 — Wedding: clarify three-measure display

**Problem:** The wedding page shows three separate money measures (vendor committed total, linked goal balance, transaction contributions) with no explanation of how they relate.

**Fix:** In `renderWedding()` in `04-planning.js`, restructure the overview card to explain each measure:

Replace the savings progress section with a unified "Wedding Money Summary" card that clearly labels each figure:

```
💰 Wedding Money Summary
─────────────────────────────────────
  Vendor quotes committed:    $X,XXX   (what you've agreed to pay)
  Deposits paid so far:       $X,XXX
  Balance remaining on vendors:$X,XXX

  Budget remaining:           $X,XXX   (budget − committed)

  Goal savings (linked):      $X,XXX   (money set aside in goal)
  Transaction contributions:  $X,XXX   (transactions tagged "Wedding")
─────────────────────────────────────
  Gap to cover vendors:       $X,XXX   (committed − goal savings)
```

Add a small info tooltip or note explaining: "Vendor committed = what you've agreed to pay vendors. Goal savings = money set aside in your savings goal. These are tracked separately — link them in Settings."

---

## Task 6 — Car savings: unify manual and transaction pools

**Problem:** `addCarSavings()` adds to `c.savedAmount` (manual number, no audit trail). `getCarFundContributions()` reads transactions tagged `car:xxx`. Both are shown added together, but they're completely separate — manual additions have no transaction record.

**Fix (in Phase 0, addCarSavings() was already converted to a modal):** Extend `saveCarSavings()` to also create a transaction:

```javascript
function saveCarSavings() {
  var id = document.getElementById('car-savings-fund-id').value;
  var fund = (state.carFunds||[]).find(function(c){return c.id===id;});
  if (!fund) return;
  var amt = parseFloat(document.getElementById('car-savings-amount').value)||0;
  if (amt <= 0) { hhToast('Enter a valid amount.','⚠️'); return; }

  // Ask if they want to create a transaction record
  hhConfirm(
    'Add <strong>'+fmt(amt)+'</strong> to <strong>'+fund.name+'</strong>.<br><br>'
    + 'Also create a transaction record for this saving?',
    '💰', 'Add Car Savings'
  ).then(function(createTxn) {
    fund.savedAmount = (fund.savedAmount||0) + amt;
    if (createTxn) {
      var d = new Date();
      var dateStr = (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
      state.transactions.push({
        id: uid(), date: dateStr,
        description: 'Car savings — '+(fund.emoji||'🚗')+' '+fund.name,
        amount: -amt,  // expense from the saving account's perspective
        category: 'car:'+fund.id,
        person: 'Joint', account: 'Savings', source: 'manual'
      });
    }
    saveState(); closeModal('car-savings-modal'); renderCarFunds(); renderDashboard();
    hhToast('+'+fmt(amt)+' added to '+fund.name,'💰');
  });
}
```

---

## Task 7 — Split-debit visual indicator in transactions table

**Problem:** When a goal split is applied, two extra transactions appear in the ledger: a positive `source:'split'` and a negative `source:'split_debit'` (a transfer). The `split_debit` has no visual badge and looks like a random negative transfer.

**Fix:** In `03-finance.js`, where badges are built for each transaction row, add a check for `split_debit`:

```javascript
var splitDebitBadge = t.source==='split_debit'
  ? '<span style="background:var(--surface);color:var(--muted);font-size:10px;padding:1px 5px;border-radius:4px;border:1px solid var(--border);margin-left:3px" title="Auto-generated transfer from goal split">↳ Goal debit</span>'
  : '';
```

Add `splitDebitBadge` to the description cell alongside the other badges.

---

## Build & verify

After all tasks:

```bash
python build.py
```

Open the built file and verify:

- [ ] Categories modal has an "Auto-Rules" section listing all catRules
- [ ] Adding and deleting rules works and saves
- [ ] Tax input modal has "Auto-fill from transactions" button that populates income fields
- [ ] Transaction table has checkboxes; selecting 3 transactions and applying a category updates all 3
- [ ] Net worth no longer double-counts car fund transaction contributions
- [ ] Wedding page clearly labels vendor committed vs goal savings vs transactions
- [ ] Adding car savings with "create transaction" checked creates a `car:xxx`-tagged transaction
- [ ] `source:'split_debit'` transactions show a "↳ Goal debit" badge in the table
- [ ] No JavaScript errors in browser console
