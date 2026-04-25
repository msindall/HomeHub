# Home Hub — Phase 4: AI-Powered Financial Intelligence

Paste this entire document into a new Cowork session to execute Phase 4.

**Prerequisite:** Phase 1 must be complete (working build pipeline). Phases 2 and 3 are independent.

---

## What this project is

Home Hub is a single-file HTML household management app for Matt & Holly (Ontario, Canada). No npm, no server. Source files sit flat in `D:\Claude\Home Planner\`. Running `python build.py` produces `App_VX_Y.html`.

**Working folder:** `D:\Claude\Home Planner\`

Matt is a salaried banker with a pension and health benefits. Holly is a waitress with a taxable base wage plus cash tips. Both are Ontario residents saving for a wedding, a house, two cars, and retirement. They use BMO, RBC, Alterna Savings, and Capital One Mastercard.

---

## Relevant existing infrastructure

### AI / Claude API
- `callClaude(prompt, maxTokens)` — async function in `01-core.js`, sends to Anthropic API
- `callClaudeVision(prompt, base64Images, maxTokens)` — vision variant
- `getApiKey()` / `saveApiKey()` — manages API key stored in localStorage as `hh_api_key`
- **Token budget:** keep `maxTokens` conservative. Matt pays per token from his own API key.

### State / transactions
- `state.transactions` — array of all transactions
- Transaction shape: `{ id, date, description, amount, category, account, tags, notes }`
- `state.categories` — array of `{ id, name, color }` — use existing IDs when categorising
- `state.bills` — array of recurring bills
- `state.budgets` — object keyed by category id, value = monthly budget amount
- `state.members` — Matt is the member with `hasPension: true`, Holly has `hasTips: true`

### Currency helpers
- `fmt(n)` → `$0.00`
- `fmtC(n)` → `$1,000`
- `fmtSigned(n)` → `+$0.00` or `-$0.00`

### Existing pages
- `page-transactions` — transactions table (rendered by `renderTransactions()` in `03-finance.js`)
- `page-dashboard` — dashboard (rendered by `renderDashboard()` in `02-dashboard.js`)
- `page-tax` — Ontario tax page (rendered in `05-household.js`)
- `page-retirement` — retirement projector (rendered in `05-household.js`)

---

## Phase 4 tasks

### Task 1 — AI transaction auto-categorisation

Add a button "Auto-categorise uncategorised" to the transactions page (`page-transactions`). When clicked:

1. Finds all transactions in `state.transactions` where `category === 'other'` (the default)
2. Batches them in groups of 30 to stay within token limits
3. For each batch, sends to Claude API:

```javascript
async function autoCategoriseTransactions() {
  var uncategorised = state.transactions.filter(function(t) { return t.category === 'other'; });
  if (!uncategorised.length) { hhToast('All transactions already have categories', '✅'); return; }

  var catList = state.categories.map(function(c) { return c.id + ' (' + c.name + ')'; }).join(', ');
  var confirmed = await hhConfirm(
    uncategorised.length + ' transactions need categories. Use AI to categorise them? This will use ~' + 
    Math.ceil(uncategorised.length / 30) + ' API call(s).',
    '🤖', 'Auto-categorise'
  );
  if (!confirmed) return;

  var updated = 0;
  var batchSize = 30;
  for (var i = 0; i < uncategorised.length; i += batchSize) {
    var batch = uncategorised.slice(i, i + batchSize);
    var lines = batch.map(function(t, idx) {
      return idx + ': ' + t.date + ' | ' + t.description + ' | ' + fmt(t.amount);
    }).join('\n');
    var prompt = 'Categorise these Canadian bank transactions. Available categories: ' + catList + '\n\n' + lines + '\n\nRespond with ONLY a JSON array of category IDs in the same order, e.g. ["groceries","dining","other"]. Use "other" if unsure.';

    try {
      var resp = await callClaude(prompt, 200);
      var cats = JSON.parse(resp.trim().replace(/^```json|```$/g,'').trim());
      batch.forEach(function(t, idx) {
        if (cats[idx] && state.categories.find(function(c){ return c.id === cats[idx]; })) {
          t.category = cats[idx];
          updated++;
        }
      });
    } catch(e) {
      hhToast('Batch ' + (Math.floor(i/batchSize)+1) + ' failed: ' + e.message, '⚠️');
    }
  }

  saveState();
  renderTransactions();
  hhToast(updated + ' transactions categorised', '✅');
}
```

### Task 2 — Bill detection from transaction patterns

Add a function `detectRecurringBills()` that scans `state.transactions` and identifies likely recurring charges. Add a "Detect recurring bills" button to the Bills page (`page-bills`).

Algorithm:
1. Group transactions by a normalised description key (lowercase, strip numbers/dates)
2. For each group with 2+ occurrences, check if amounts are similar (within 5%) and dates are roughly monthly (25–35 days apart) or weekly/bi-weekly
3. Flag candidates with: description, estimated monthly amount, detected frequency, suggested category

Display results in a modal with checkboxes. User selects which ones to add to `state.bills`. For each selected:

```javascript
state.bills.push({
  id: 'bill_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
  name: candidate.description,
  amount: candidate.amount,
  frequency: candidate.frequency,   // 'monthly', 'weekly', 'biweekly'
  category: candidate.category,
  dueDay: candidate.likelyDueDay,   // day of month
  autopay: false,
  notes: 'Auto-detected from transactions'
});
```

After adding, call `saveState()` and refresh the bills page.

### Task 3 — Savings rate dashboard widget

Add a "Savings Rate" card to the dashboard (`renderDashboard()` in `02-dashboard.js`).

**Calculate savings rate:**
```javascript
function calcSavingsRate(monthsBack) {
  // monthsBack: 1 = current month, 3 = last 3 months average
  var now = new Date();
  var cutoff = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  var txns = state.transactions.filter(function(t) { return new Date(t.date) >= cutoff; });

  var income = txns.filter(function(t) { return t.category === 'income' && t.amount > 0; })
                   .reduce(function(s,t){ return s + t.amount; }, 0);
  // Also add member monthly incomes if no income transactions found
  if (income === 0) {
    income = (state.members || []).reduce(function(s,m){ return s + (m.monthlyIncome || 0) * monthsBack; }, 0);
  }

  var savings = txns.filter(function(t) { return t.category === 'savings' && t.amount > 0; })
                    .reduce(function(s,t){ return s + t.amount; }, 0);
  // Add goal contributions
  (state.goals || []).forEach(function(g) {
    if (g.monthlyContribution) savings += g.monthlyContribution * monthsBack;
  });

  return income > 0 ? (savings / income) * 100 : 0;
}
```

Display as a metric card: percentage (1 decimal), a label "30-day savings rate", and a small trend indicator comparing to the prior month (up arrow green, down arrow red). Target: 20%+ is green, 10–20% is amber, under 10% is red.

### Task 4 — FHSA contribution optimiser

Add an FHSA Optimiser section to the house page (`page-house`) in `04-planning.js`. The FHSA (First Home Savings Account) rules for 2024–2025:

- Annual contribution room: $8,000 per person
- Lifetime limit: $40,000 per person
- Unused room carries forward (max carryforward: $8,000)
- Contributions are tax-deductible (like RRSP)
- Withdrawals for qualifying home purchase are tax-free (like TFSA)
- Matt and Holly each have their own FHSA — both are first-time buyers

The existing state has: `state.house.fhsa.mattBalance`, `state.house.fhsa.hollyBalance`, `state.house.fhsa.mattYearStart`, `state.house.fhsa.hollyYearStart`.

Add fields for annual contributions made this year and calculate:
- Remaining contribution room for current year (including any carryforward)
- Estimated tax savings from FHSA contribution at each member's marginal rate
- Days until December 31 FHSA contribution deadline
- Projected FHSA balance at target house purchase date
- Alert on dashboard if FHSA room is unused in Q4

Use `calcOntarioTax()` from `05-household.js` to estimate marginal rates. Use member `monthlyIncome` for the estimate.

### Task 5 — Net worth milestone chart

Enhance the net worth page (`page-networth`) in `05-household.js` to show a forward-looking projection chart alongside the historical chart.

The projection should:
1. Start from current net worth
2. Add monthly savings contributions from `state.goals` and member incomes minus estimated spending
3. Project forward to the longest goal's target date
4. Plot horizontal lines for each savings goal target amount (wedding, house down payment, car funds, retirement milestone)
5. Show where each goal line is crossed — annotate with "Wedding fund reached: Jan 2027" etc.

Use Chart.js (already available as `Chart` global). Add the chart to a `<canvas id="nw-projection-chart">` below the existing net worth display.

The chart should be a line chart with:
- X axis: months from now to target date
- Y axis: dollar amount
- Series 1 (purple): projected net worth
- Horizontal annotations (dashed, each a different muted colour): each goal target

### Task 6 — Monthly household report (print/save)

Add a "Monthly Report" button to the Upload/Data page (`page-upload`). When clicked, it generates a print-ready HTML summary of the most recently completed calendar month.

The report should include:
- Household name, report month, generated date
- Income summary: Matt salary, Holly tips declared, total
- Spending by category: table with budget vs actual vs variance
- Top 5 largest transactions
- Net worth change: opening → closing, change amount and %
- Savings rate for the month
- Goals progress: each goal with current balance and % toward target
- RRSP reminder if in Q1 (January/February)

Implement as `generateMonthlyReport(year, month)` that builds an HTML string, opens it in a new window, and calls `window.print()`. Use `@media print` CSS to hide everything except the report content. Style it cleanly — black text on white, no colours needed for print.

---

## Conventions to follow

- Never use `alert()`, `confirm()`, `prompt()` — use `hhAlert()`, `hhConfirm()`, `hhToast()`
- Never hardcode hex colours in CSS — use CSS custom properties
- `saveState()` after every state mutation
- Token conservation: batch AI calls, cap `maxTokens` tightly
- Ontario/Canada only — all tax logic uses Ontario brackets and CRA rules
- FHSA rules: verify against CRA if in doubt — these are load-bearing financial calculations
- Do not hardcode Matt and Holly's names — use `state.members` to find them by flags (`hasPension`, `hasTips`)

---

## Success criteria for Phase 4

- [ ] "Auto-categorise" button appears on transactions page; clicking it categorises uncategorised transactions
- [ ] API calls are batched (no more than 30 transactions per call)
- [ ] "Detect recurring bills" shows likely bills with correct amounts and frequency
- [ ] Accepted detected bills appear in the bills tracker
- [ ] Savings rate card appears on dashboard with correct % calculation
- [ ] Savings rate colour-codes correctly (green/amber/red)
- [ ] FHSA section on house page shows remaining room, tax savings estimate, and deadline alert
- [ ] Net worth projection chart shows forward projection with goal milestones
- [ ] Monthly report generates and opens print dialog
- [ ] No JavaScript errors in browser console

---

## After Phase 4 is complete

Phase 5 adds quality-of-life improvements: pet health records, grocery price history, Holly's tip forecasting, wedding vendor log, Ontario gas price tracker, and setup wizard polish. The Phase 5 plan document is `Phase_5_Quality_of_Life.md` in this folder.
