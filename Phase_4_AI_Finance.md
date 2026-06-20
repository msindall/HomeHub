# Home Hub — Phase 4: AI-Powered Financial Intelligence

Paste this entire document into a new Cowork session to execute Phase 4.

**Prerequisite:** Phase 1 (build pipeline) must be complete. ✅ Already done. Phase 0 (bug fixes) recommended first.

---

## What this project is

Home Hub is a single-file HTML household management app for Matt & Holly (Ontario, Canada). No npm, no server. Source files sit flat in `D:\Claude\Home Planner\`. Running `python build.py` produces `App_VX_Y.html`.

**Working folder:** `D:\Claude\Home Planner\`  
**Current version:** `App_V6_39.html` (check folder for actual latest)

Matt is a salaried banker with a pension and health benefits. Holly is a waitress with a taxable base wage plus cash tips. Both are Ontario residents saving for a wedding, a house, two cars, and retirement.

---

## Relevant existing infrastructure

### AI / Claude API
- `callClaude(prompt, maxTokens)` — async, in `01-core.js`, sends to Anthropic API at `api.anthropic.com`
- `callClaudeVision(prompt, base64Images, maxTokens)` — vision variant
- `getApiKey()` / `saveApiKey()` — API key in localStorage as `hh_api_key`
- **Token budget:** keep `maxTokens` conservative. Matt pays per token from his own API key.

### State
- `state.transactions` — all transactions
- `state.categories` — `{ id, name, color }` — use existing IDs when categorising
- `state.bills` — recurring bills
- `state.budgets` — keyed by category id, monthly budget amount
- `state.members` — salary member has `hasPension: true` or `incomeType: 'salary'`; tips member has `hasTips: true`
- `getTipsMember()` — helper in `02-dashboard.js` to find the tips member

### Helpers
- `fmt(n)` → `$0.00`, `fmtC(n)` → `$1,000`, `fmtSigned(n)` → `+$0.00`
- `getCatById(id)` — returns `{ name, color }` for any category, goal, or car fund ID
- `getGoalContributions(goalId)` — sums transactions tagged `goal:xxx`
- `calcOntarioTax(income)` — Ontario + federal tax estimate (in `05-household.js`)
- `getMarginalRate(income)` — marginal tax rate (in `05-household.js`)
- `hhAlert()`, `hhConfirm()`, `hhToast()` — always use these, never native dialogs

### Existing pages
- `page-transactions` — rendered by `renderTransactions()` in `03-finance.js`
- `page-dashboard` — rendered by `renderDashboard()` in `02-dashboard.js`
- `page-tax` — rendered by `renderTax()` in `05-household.js`
- `page-retirement` — rendered in `05-household.js`

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
- Token conservation: batch AI calls, cap `maxTokens` tightly
- Ontario/Canada only — all tax logic uses Ontario brackets
- Do not hardcode "Matt" or "Holly" — use `state.members` and check `hasPension`/`hasTips`/`incomeType` flags

---

## Task 1 — Savings rate dashboard widget

Add a Savings Rate card to `renderDashboard()` in `02-dashboard.js`.

Calculate savings rate = (money going to savings goals + categorised as 'savings') / total income for the month. Display as a percentage with a colour indicator: 🟢 ≥20%, 🟡 10–19%, 🔴 <10%. Show the prior month comparison as a small trend arrow.

```javascript
function calcSavingsRate(mk) {
  var txns = state.transactions.filter(function(t){return getMonthKey(t.date)===mk;});
  var income = txns.filter(function(t){
    return t.amount>0 && t.category!=='transfer' && t.source!=='tips' && t.source!=='split';
  }).reduce(function(s,t){return s+t.amount;},0) + getTipsForMonth(mk);

  var savings = txns.filter(function(t){
    return t.amount<0 && (t.category==='savings' || (t.category&&t.category.startsWith('goal:')));
  }).reduce(function(s,t){return s+Math.abs(t.amount);},0);

  return income > 0 ? Math.round((savings/income)*100) : 0;
}
```

Add the card to the stats row in `renderDashboard()`. Show: percentage, label "Savings Rate", colour coding, and "vs last month" sub-label.

---

## Task 2 — Net worth forward projection chart

Enhance the net worth page (`page-networth`) to show a forward projection alongside the historical chart.

The projection should:
1. Start from current net worth
2. Project forward using monthly savings (from goal contributions + average monthly surplus from last 6 months)
3. Draw horizontal milestone lines for: house down payment target, wedding budget, each car fund target
4. Annotate where each milestone line intersects the projection: "5% down payment: Mar 2027"

Use Chart.js (available globally as `Chart`). Add `<canvas id="nw-projection-chart">` in `shell.html` below the existing net worth chart. Target projection period: from now to the furthest goal target date, or 10 years if no goals have dates.

```javascript
function renderNWProjection() {
  var canvas = document.getElementById('nw-projection-chart');
  if (!canvas) return;
  var now = calcCurrentNetWorth();
  var base = now.netWorth;

  // Estimate monthly savings from last 6 months average
  var mk6 = [];
  for (var i = 1; i <= 6; i++) {
    var d = new Date(); d.setMonth(d.getMonth()-i);
    mk6.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
  }
  var avgSurplus = mk6.reduce(function(s,mk){
    var inc = state.transactions.filter(function(t){return getMonthKey(t.date)===mk&&t.amount>0&&t.category!=='transfer'&&t.source!=='tips'&&t.source!=='split'}).reduce(function(a,t){return a+t.amount;},0) + getTipsForMonth(mk);
    var exp = state.transactions.filter(function(t){return getMonthKey(t.date)===mk&&t.amount<0&&t.category!=='transfer'}).reduce(function(a,t){return a+Math.abs(t.amount);},0);
    return s+(inc-exp);
  },0) / Math.max(mk6.length,1);

  var months = 120; // 10 years
  var labels = [], data = [];
  for (var m = 0; m <= months; m++) {
    var d2 = new Date(); d2.setMonth(d2.getMonth()+m);
    labels.push(d2.toLocaleString('default',{month:'short',year:'2-digit'}));
    data.push(Math.round(base + avgSurplus * m));
  }

  // Draw chart with milestone annotations
  // ... (use Chart.js annotation plugin or draw lines via afterDraw hook)
}
```

---

## Task 3 — Monthly household report

Add a **"📄 Monthly Report"** button to the Upload/Data page (`page-upload`). When clicked, generates a print-ready summary of the most recently completed month and opens it in a new window with `window.print()`.

Report contents:
- Household name, report month, generated date
- Income: salary member's income, tips member's income + tips, total
- Spending by category: budget vs actual vs variance (colour-coded)
- Top 5 largest transactions
- Net worth change: opening snapshot → closing, amount and %
- Savings rate for the month
- Goal progress: each goal with balance, target, % complete
- RRSP reminder if month is January or February

```javascript
function generateMonthlyReport() {
  var months = getMonths();
  // Default to most recently completed month (not current if it's early in the month)
  var targetMk = months.find(function(mk){return mk < getCurrentMonthKey();}) || months[0];
  if (!targetMk) { hhAlert('No transaction data yet.','ℹ️'); return; }

  // Build HTML string with @media print styles
  var html = '<!DOCTYPE html><html><head><title>Home Hub Report — '+targetMk+'</title>'
    + '<style>body{font-family:system-ui,sans-serif;color:#111;padding:32px;max-width:800px;margin:0 auto}'
    + 'table{width:100%;border-collapse:collapse;margin:16px 0}'
    + 'th,td{padding:8px 10px;border:1px solid #ddd;text-align:left}'
    + 'th{background:#f5f5f5;font-weight:700}'
    + '.green{color:#16a34a} .red{color:#dc2626} .muted{color:#888}'
    + '@media print{button{display:none}}'
    + '</style></head><body>';

  // ... populate report sections
  html += '<button onclick="window.print()" style="margin-bottom:24px;padding:8px 20px;cursor:pointer">🖨️ Print</button>';
  // ... close html

  var w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
}
```

---

## Build & verify

```bash
python build.py
```

Open the built file and verify:

- [ ] "🤖 Auto-categorise" button appears on the transactions page
- [ ] Clicking it with uncategorised transactions sends batches to API and categorises them
- [ ] Savings rate card appears on dashboard with correct % and colour coding
- [ ] FHSA section on house page shows remaining contribution room, tax savings estimate, and deadline
- [ ] Net worth projection chart renders with at least one milestone line
- [ ] Monthly report button generates a print-ready report in a new window
- [ ] No JavaScript errors in browser console

---

## After Phase 4

`Phase_5_Quality_of_Life.md` and `Phase_6_Improvements.md` are independent — do either next.
