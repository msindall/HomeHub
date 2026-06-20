# Home Hub — Phase 5: Quality of Life & New Trackers

Paste this entire document into a new Cowork session to execute Phase 5.

**Prerequisite:** Phase 1 (build pipeline) must be complete. ✅ Already done.

---

## What this project is

Home Hub is a single-file HTML household management app for Matt & Holly (Ontario, Canada). No npm, no server. Source files sit flat in `D:\Claude\Home Planner\`. Running `python build.py` produces `App_VX_Y.html`.

**Working folder:** `D:\Claude\Home Planner\`  
**Current version:** `App_V6_39.html` (check folder for actual latest)

Matt is a salaried banker with a pension and health benefits. Holly is a waitress with a taxable base wage plus cash tips. They have one dog and one cat. Saving for a wedding, a house, cars, and retirement.

---

## Current state — what already exists

Check these before implementing — some may already be built:
- **Wedding vendor log** — `state.weddingVendors` exists with vendor fields. The wedding page renders it in `04-planning.js`

Verify which of the tasks below are already done before starting.

---

## Source file map

| File | Role |
|------|------|
| `style.css` | All CSS — CSS custom properties only |
| `shell.html` | Page skeleton, nav, all page `<div>` containers |
| `modals.html` | Modal HTML (first half) |
| `tail.html` | Modal HTML (second half) + closing tags |
| `01-core.js` | State, storage, helpers, dialogs, navigation, reminders |
| `02-dashboard.js` | Dashboard rendering |
| `03-finance.js` | Transactions, budget, accounts, goals |
| `04-planning.js` | Wedding, house/mortgage, bills |
| `05-household.js` | Net worth, car funds, tax prep, retirement, tips, pets |
| `06-insights.js` | Grocery, shopping list, pantry, meal plan, recipes |
| `07-upload.js` | Bank import, career, charts, setup wizard, `_initApp()` |

---

## Conventions — never violate these

- Never use `window.alert()`, `window.confirm()`, `window.prompt()` — use `hhAlert()`, `hhConfirm()`, `hhToast()`
- Never hardcode hex colours in CSS — use CSS custom properties
- Always add migration guards for new state keys in the init block of `01-core.js`
- `saveState()` after every state mutation
- Modal HTML in `modals.html` (simple) or `tail.html` (complex)
- Do not hardcode "Matt" or "Holly" — use `state.members` and check `hasTips`/`hasPension` flags

---

## Task 1 — Wedding vendor communication log

**Check first:** Look at `state.weddingVendors` shape and the vendor cards in `renderWedding()`. If a "Log contact" button already exists, skip this task.

**Extend vendor shape** (with migration guard):
```javascript
v.communications = v.communications || [];
// Each entry: { date, type:'email'|'call'|'meeting'|'text', summary, followUpDate }
```

On each vendor card in the wedding page:
- Add a "Log contact" button → small modal to add a communication entry
- Show last 3 contacts as a timeline on the card
- Show a "Follow-up needed" badge if `followUpDate` is past and vendor is not booked

**Dashboard reminder** (in `buildReminders()`): If any vendor has a `followUpDate` in the past and `booked` is false: "📋 Follow up with [vendor name] (wedding vendor)"

---

## Task 2 — Gas price widget (manual entry)

Direct CORS fetch of GasBuddy is blocked in browser. Implement as a clean manual-entry widget instead.

**Add to state** (with migration guard):
```javascript
if (!state.gasPrice) state.gasPrice = { price: 0, updated: null, city: '' };
```

**Dashboard card** (small, after other widgets): Shows current price per litre, city, date last updated, and a ✏️ button to update.

```javascript
// In renderDashboard(), add:
var dashGas = document.getElementById('dash-gas-wrap');
if (dashGas && isFeatureOn('gas')) {
  var gp = state.gasPrice || {};
  var daysSince = gp.updated ? Math.floor((Date.now()-new Date(gp.updated).getTime())/86400000) : null;
  var stale = daysSince !== null && daysSince > 7;
  dashGas.innerHTML = '<div class="card" style="margin-top:16px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    + '<div class="card-title" style="margin:0">⛽ Gas Price</div>'
    + '<button class="btn btn-ghost btn-sm" onclick="openGasPriceModal()">✏️ Update</button></div>'
    + (gp.price ? '<div style="font-size:22px;font-weight:900;color:var(--accent)">'+gp.price.toFixed(1)+'¢/L</div>' : '<div style="color:var(--muted);font-size:13px">Not set</div>')
    + (gp.city ? '<div style="font-size:11px;color:var(--muted)">'+gp.city+'</div>' : '')
    + (daysSince !== null ? '<div style="font-size:11px;color:'+(stale?'var(--yellow)':'var(--muted)')+'">Updated '+daysSince+'d ago'+(stale?' — tap to refresh':'')+'</div>' : '')
    + '</div>';
}
```

Add a simple modal: city field, price in cents/L, save button. `openGasPriceModal()` opens it, saving updates `state.gasPrice` and calls `saveState()`.

**Feature flag:** Add `gas: true` to `defaultState().features` and the feature toggle list. Add a migration guard for existing users.

**Dashboard reminder** (in `buildReminders()`): If gas price was updated more than 7 days ago, show: "⛽ Gas price data is 7+ days old — tap to update"

---

## Task 3 — Setup wizard polish

Improve the setup wizard (`openSetupWizard()` in `07-upload.js`) for non-technical new users (friends/family sharing via the share URL):

1. **Progress bar** — add a `<div class="progress-bar">` at the top of the wizard modal showing current step / total steps. Update it on each `wizNext()` / `wizBack()` call.

2. **Back button** — add a "← Back" button to the wizard footer. Implement `wizBack()` that decrements the current wizard step and re-renders the previous step.

3. **Helper text** — on the income type step, add: "Salary = regular paycheque from an employer. Tips = variable income from gratuities (like a restaurant server)."

4. **RRSP tooltip** — on the savings step, add a `ℹ️` tooltip: "RRSP is a Canadian Registered Retirement Savings Plan — contributions reduce your taxable income and grow tax-sheltered."

5. **Review step** — before the final "Launch" button, show a summary card of everything entered: household name, members with income types, pets, enabled features, primary goals.

6. **Post-wizard welcome screen** — after `wizFinish()` runs, show a brief welcome screen (render into the dashboard area) with 3 suggested first actions:
   - "📥 Upload your first bank statement"
   - "💰 Add your first savings goal"
   - "📊 Explore your dashboard"
   Each is a clickable card that navigates to the relevant page.

---

## Build & verify

```bash
python build.py
```

Open the built file and verify:

- [ ] Pet health records section (if new): vet visit, vaccination, and medication can be added; vaccination due reminder appears on dashboard
- [ ] Grocery price history tab shows tracked prices; flyer sale item below average triggers dashboard alert
- [ ] Tips page shows weekly forecast chart; CRA instalment estimate is calculated
- [ ] Wedding vendor cards have "Log contact" button; follow-up reminder appears on dashboard
- [ ] Gas price card appears on dashboard; updating price saves and shows correctly
- [ ] Setup wizard has progress bar and Back button
- [ ] Post-wizard welcome screen shows 3 first-action suggestions
- [ ] No JavaScript errors in browser console

---

## After Phase 5

All phases complete. Consider opening a new chat for Phase 7 ideas — potential topics include offline PWA service worker, mobile layout improvements, and YNAB/CSV export to external tools.
