# Home Hub — Phase 5: Quality of Life & New Trackers

Paste this entire document into a new Cowork session to execute Phase 5.

**Prerequisite:** Phase 1 must be complete. Phases 2–4 are independent of this phase.

---

## What this project is

Home Hub is a single-file HTML household management app for Matt & Holly (Ontario, Canada). No npm, no server. Source files sit flat in `D:\Claude\Home Planner\`. Running `python build.py` produces `App_VX_Y.html`.

**Working folder:** `D:\Claude\Home Planner\`

Matt is a salaried banker with a pension and health benefits. Holly is a waitress with a taxable base wage plus cash tips. They have one dog and one cat. They're saving for a wedding, a house, cars, and retirement. They're primarily desktop users.

---

## Existing infrastructure to be aware of

- `state.pets` — array of `{ name, emoji, type }` — already has dog and cat
- `state.petFeeding` — tracks feeding/walk logs (already exists in `02-dashboard.js`)
- `state.tips` — Holly's tip entries: `{ date, amount, cashAmount, declaredAmount, shift, notes }`
- `state.pantry` — pantry items: `{ id, name, qty, unit, category, expiryDate }`
- `state.flyers` — scanned flyer sale items
- `state.weddingVendors` — wedding vendors array (already in state schema, may be sparse)
- `state.weddingChecklist` — wedding checklist items (in `06-insights.js`)
- `state.wedding` — `{ budget, date, venue, notes }`
- Feature flags in `state.features` — `isFeatureOn('pets')` etc.
- `hhAlert()`, `hhConfirm()`, `hhToast()` — always use these, never native dialogs

---

## Phase 5 tasks

### Task 1 — Pet health records

The pets page (`page-pets`) currently tracks feeding, walks, and litter. Extend it with a full health records section for each pet.

**Add to state schema** — add a migration guard in `01-core.js` (the migration block near the bottom):
```javascript
if (!state.petHealth) state.petHealth = {};
```

`state.petHealth` is keyed by pet name (or better, pet id — add `id` to pets if not present):
```javascript
{
  "buddy": {
    vetVisits: [
      { date: '2024-03-15', vet: 'Dr. Smith', reason: 'Annual checkup', notes: 'All clear', cost: 120 }
    ],
    vaccinations: [
      { name: 'Rabies', date: '2024-03-15', dueDate: '2025-03-15', notes: '' }
    ],
    medications: [
      { name: 'Heartgard', dose: '1 chew', frequency: 'Monthly', startDate: '2024-01-01', endDate: null, notes: '' }
    ],
    weight: [
      { date: '2024-03-15', weightKg: 12.3 }
    ]
  }
}
```

**Add to the pets page** (rendered in `02-dashboard.js` or `05-household.js` — check which one renders `page-pets`):

For each pet, add a collapsible "Health Records" section with four sub-tabs: Vet Visits, Vaccinations, Medications, Weight Log.

Add modals for adding each type of record. Add them to `tail.html`:
- `modal-pet-vet` — add vet visit
- `modal-pet-vaccine` — add vaccination (with due date — this is what generates reminders)
- `modal-pet-med` — add medication
- `modal-pet-weight` — add weight entry

**Dashboard reminders:** In `02-dashboard.js`, add pet health reminders to the reminders section:
- Vaccination due within 30 days: "💉 [Pet name]'s [vaccine name] is due [date]"
- Medication reminder: if end date is set and approaching, show reminder
- Annual vet checkup: if no vet visit in the last 11 months, show "🐾 [Pet name] is due for a checkup"

### Task 2 — Grocery price history

Extend the pantry/grocery system in `06-insights.js` to track price history for staple items.

**Add to state schema** (with migration guard):
```javascript
if (!state.priceHistory) state.priceHistory = {};
```

`state.priceHistory` is keyed by a normalised item name (lowercase, trimmed):
```javascript
{
  "chicken breast": [
    { date: '2024-11-01', price: 9.99, unit: 'kg', store: 'No Frills', onSale: true },
    { date: '2025-01-15', price: 11.49, unit: 'kg', store: 'Metro', onSale: false }
  ]
}
```

**Where prices are recorded:** When a user adds an item to the shopping list or pantry with a price, auto-record it to `state.priceHistory`. Add an optional "Price" field to the add-item forms.

When scanning flyers (`renderFlyers()` in `06-insights.js`), if a flyer item matches a pantry staple, auto-record the sale price.

**Add a "Price History" tab** to the grocery page (`page-grocery`). For each tracked item:
- Show a sparkline (small inline Chart.js bar or line chart) of price over last 6 records
- Show: lowest price ever seen, current average, last seen price
- Highlight in green when the current flyer price is below the historical average

**"Good deal" alert:** When a flyer is scanned and an item's price is more than 15% below its historical average, add it to the dashboard reminders: "💰 Chicken breast is on sale at No Frills — 23% below your usual price"

### Task 3 — Holly's tip forecasting

Enhance the Tips page (`page-tips`, rendered in `06-insights.js` as `renderTipsPage()`) with a forecasting section.

Holly has months of tip history in `state.tips`. Use this to:

**Weekly forecast:**
Calculate average tips by day of week (Mon–Sun) from the last 12 weeks. Display as a bar chart showing expected tips for each upcoming day of the week. Label "Expected tips this week: $XXX"

**Seasonal patterns:**
Group tips by month across all years of history. Show which months are historically high vs low. December and summer months are typically higher for restaurant workers.

**Monthly goal tracker:**
Add a field `tipMonthlyGoal` to the tips section in state. Show: current month progress vs goal, projected end-of-month total based on current pace, days remaining.

**Tax installment helper:**
Holly's cash tips are taxable. Calculate quarterly estimated tax owing on undeclared cash tips. Show: "Based on your tips this year, your next CRA instalment estimate is approximately $XXX (due [date])". CRA quarterly instalment dates: March 15, June 15, September 15, December 15. Use the existing `calcOntarioTax()` logic from `05-household.js` for the estimate.

### Task 4 — Wedding vendor communication log

The existing `state.weddingVendors` array and wedding page need a vendor communications log.

**Extend the vendor object shape:**
```javascript
{
  id: 'vendor_...',
  name: 'Pinehurst Photography',
  category: 'photography',   // photography, catering, florist, venue, music, cake, other
  contactName: '',
  phone: '',
  email: '',
  website: '',
  quotedAmount: 0,
  depositPaid: 0,
  depositDate: '',
  totalAmount: 0,
  balanceDue: 0,
  balanceDueDate: '',
  booked: false,
  notes: '',
  communications: [
    { date: '2025-01-10', type: 'email', summary: 'Requested quote', followUpDate: '2025-01-17' }
  ]
}
```

Add migration guard: existing vendors without `communications` array get `communications: []`.

**On the wedding page** (`page-wedding` in `04-planning.js`), add to each vendor card:
- A "Log contact" button that opens a small modal to add a communication entry (date, type: email/call/meeting/text, summary, optional follow-up date)
- A communications timeline showing last 3 contacts
- A "Follow-up needed" badge if there's a `followUpDate` in the past

**Dashboard reminder:** If any vendor has a `followUpDate` that is today or past and `booked` is false, add: "📋 Follow up with [vendor name] (wedding)"

**Financial summary on wedding page:** Show a table: Vendor | Quoted | Deposit Paid | Balance | Due Date. Total row. Compare to `state.wedding.budget`.

### Task 5 — Ontario gas price alert

Add a "Gas Prices" widget to the dashboard (or as a card on the `page-dashboard`) that fetches current Ontario gas prices.

Use the GasBuddy RSS feed or a simple web fetch to get local prices. The fetch should be done via the existing `fetch()` call pattern.

Try: `https://www.gasbuddy.com/home?search=${encodeURIComponent(city)}&fuel=1`

If direct fetch is blocked by CORS, fall back to: manually-entered last price with a "Update price" button and a reminder alert if the stored price is more than 7 days old.

Store in state:
```javascript
if (!state.gasPrice) state.gasPrice = { lastPrice: 0, lastUpdated: null, city: '' };
```

Display: current price per litre, date updated, simple up/down indicator vs last update.

If gas prices cannot be fetched automatically (CORS is common), make the manual entry experience very clean: a small card on the dashboard with a pencil icon to update the price, showing how many days since last update.

### Task 6 — Setup wizard polish

The setup wizard (`openSetupWizard()` in `07-upload.js`) is the entry point for friends and family using the shared config link (from Phase 2). Make it smoother for non-technical users.

**Improvements:**
1. Add a progress bar at the top of the wizard showing current step / total steps
2. Add "Back" button functionality (currently likely forward-only)
3. Step 3 (household members): add clearer explanation of what "income type" means — tooltip or helper text: "Salary = regular paycheque, Tips = variable income from gratuities"
4. Step 7 (income details): add a helper for RRSP — "What is this? RRSP is a Canadian retirement savings account that reduces your taxes."
5. Step 9 (review): show a clean summary card of everything entered before the "Finish" button
6. After wizard completes, show a "Welcome to Home Hub!" screen with 3 suggested first actions: "Add your first transaction", "Set up your bank import", "Explore your dashboard"

---

## Conventions to follow

- Never use `alert()`, `confirm()`, `prompt()` — use `hhAlert()`, `hhConfirm()`, `hhToast()`
- Never hardcode hex colours — use CSS custom properties
- Always add migration guards for new state keys in `01-core.js`
- `saveState()` after every state mutation
- Modal HTML goes in `modals.html` (simple) or `tail.html` (complex)
- Do not hardcode "Matt" or "Holly" — use `state.members` and check `hasTips` / `hasPension` flags
- Ontario/Canada only

---

## Success criteria for Phase 5

- [ ] Pet health records section appears on the pets page for each pet
- [ ] Adding a vet visit, vaccination, and medication works and saves correctly
- [ ] Dashboard shows vaccination due reminder when within 30 days
- [ ] Grocery price history tab shows tracked prices and sparklines
- [ ] "Good deal" alert appears on dashboard when a flyer item is below historical average
- [ ] Tips page shows weekly forecast bar chart based on day-of-week history
- [ ] Tips page shows monthly goal progress and CRA instalment estimate
- [ ] Wedding page vendors have a "Log contact" button and communications timeline
- [ ] Dashboard shows vendor follow-up reminder when overdue
- [ ] Gas price widget appears on dashboard (auto-fetch or manual entry)
- [ ] Setup wizard has a progress bar and Back button
- [ ] Post-wizard welcome screen shows 3 suggested first actions
- [ ] No JavaScript errors in browser console

---

## You're done with all 5 phases!

At this point Home Hub will have:
- A working, minified build pipeline with git version control
- A live GitHub Pages URL with one-command deploy
- Shareable links and QR codes for onboarding friends and family
- All 4 of your banks supported for CSV import
- AI-powered transaction categorisation and bill detection
- FHSA optimiser, net worth projections, monthly reports
- Pet health records, grocery price history, tip forecasting
- A polished setup experience for new users

Consider opening a new chat to brainstorm Phase 6 ideas once these are done.
