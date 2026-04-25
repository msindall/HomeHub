# Home Hub — CLAUDE.md

Project-specific instructions for Claude. Read this before touching any code.

---

## What This Project Is

**Home Hub** is a household management web app for Matt & Holly — a Canadian couple in Ontario saving for a wedding, house, cars, and retirement. It is a single-file HTML app that runs entirely in the browser with no server, no npm, no build dependencies beyond Python.

Holly is a waitress with a taxable base wage + cash tips. Matt is a salaried banker with health benefits and a pension. All financial logic must account for this split.

---

## Architecture — How the Build Works

Source files live flat in this folder (the `src/` subdirectory structure described in README.md is the intended layout, but currently files are at the root). The build script `build.py` assembles them into a single deployable `App_VX_Y.html`.

**Source files:**

| File | Responsibility |
|---|---|
| `style.css` | All CSS — uses CSS custom properties (`--accent`, `--bg`, `--card`, etc.) for theming |
| `shell.html` | Page skeleton: nav sidebar, topbar, all page `<div>` containers |
| `modals.html` | Modal dialog HTML (first half) |
| `tail.html` | Modal dialog HTML (second half) + closing tags |
| `01-core.js` | Storage layer, state, helpers, dialogs (`hhAlert`/`hhConfirm`/`hhToast`), navigation, weather, pet toggles |
| `02-dashboard.js` | Dashboard page rendering and reminders |
| `03-finance.js` | Calendar (iCal sync), transactions table, budget, account balances |
| `04-planning.js` | Wedding planner, house/mortgage calculator, bills & subscriptions |
| `05-household.js` | Net worth, car funds, home maintenance, Ontario tax prep, retirement projector, pets page |
| `06-insights.js` | Tips tracker (Holly), grocery/shopping list, Flipp flyer scanner, pantry, meal planner, recipes, wedding checklist |
| `07-upload.js` | Bank statement upload (CSV + AI-PDF), career planner, data export/import, setup wizard, theme system, forecast/budget charts, feature toggles, `_initApp()` |

**To build after editing:**
```bash
python build.py
```
This increments the version number automatically and produces a new `App_VX_Y.html`.

---

## State & Storage

- Single global `state` object. Persisted as JSON under the key `mh_v5` in localStorage.
- If localStorage is unavailable (sandboxed iframe, Claude Desktop app), the app falls back to IndexedDB automatically — handled in `01-core.js`.
- `saveState()` must be called after every mutation. Never mutate `state` without saving.
- `loadState()` is called once at startup inside `_initApp()`.
- `defaultState()` defines the full schema — add new keys there with sensible defaults.
- Missing keys are patched on load (the "migration block" near the bottom of `01-core.js` / top of `07-upload.js`). When adding a new state key, also add a migration guard so existing users don't get undefined errors.

---

## Conventions

### JavaScript
- Vanilla ES5/ES6 — no frameworks, no TypeScript, no modules. Functions are global.
- Async operations use `async/await` where possible; older callbacks where needed.
- Dialog replacements: **never use `window.alert()` or `window.confirm()`** — they are blocked in some environments. Always use `hhAlert()`, `hhConfirm()`, or `hhToast()`.
- IDs in HTML must match exactly what JS calls with `document.getElementById()`. If you add a modal, add its `<div id="modal-xxx">` to `modals.html` or `tail.html`.
- Currency formatting: use `fmt(n)` for `$0.00`, `fmtC(n)` for `$1,000`, `fmtSigned(n)` for `+$0.00 / -$0.00`.

### CSS
- All colours are CSS variables. Never hardcode hex values in new CSS — extend the variable set in `style.css`.
- Dark mode and theming are handled by swapping CSS variable values via `applyTheme()` in `07-upload.js`. If you add a new colour, also add it to `_buildThemeObj()`.

### HTML
- Pages are `<div id="page-xxx" class="page">` inside `shell.html`, toggled visible by `showPage()`.
- Modals are `<div id="modal-xxx" class="modal-overlay">` inside `modals.html` / `tail.html`, opened by `openModal()` and closed by `closeModal()`.

---

## Canada / Ontario-Specific Rules

These are load-bearing — do not change without verifying against CRA/Ontario rules:

- **Ontario Land Transfer Tax**: two-tier formula, see `calcOntarioLTT()` in `04-planning.js`.
- **First-Time Buyer LTT Rebate**: max $4,000 Ontario rebate, see `calcFirstTimeLTTRebate()`.
- **CMHC Insurance**: mandatory below 20% down on purchases under $1.5M, see `calcCMHC()`.
- **New Home HST Rebate**: federal GST rebate + Ontario provincial HST rebate, see `calcFederalGSTRebate()` / `calcOntarioHSTProvincialRebate()`.
- **Mortgage math**: uses Canadian compounding (semi-annual). `calcMortgagePayment()` converts the annual rate to a Canadian effective rate before computing. Do not swap this for simple monthly division.
- **Ontario income tax**: `calcOntarioTax()` in `05-household.js` — brackets must match the current tax year.
- **CPP / OAS projections**: `estimateCPP()` and `oasAtAge()` in `05-household.js` — verify clawback thresholds against current CRA rates when updating.
- **RRSP deadline**: March 1 of the following year — hard-coded in tax alerts.
- **Holly's tips**: tracked separately as cash vs. declared. Her income feeds into the household tax page via `getHollyTipsForYear()`, `getHollyTipsCashForYear()`, `getHollyTipsDeclaredForYear()`.

---

## AI / API Features

Several features call the Anthropic Claude API directly from the browser:

- **Meal plan generation** — AI suggests a weekly meal plan based on pantry + flyer sales.
- **Recipe AI parser** — paste a recipe URL/text and Claude extracts structured ingredients.
- **Flyer scanner** — uploads supermarket flyer PDFs page-by-page to Claude Vision.
- **Bank statement PDF extraction** — scanned/image PDFs are sent to Claude Vision page-by-page when native PDF.js text extraction returns nothing.

The API key is stored in `localStorage` (key `hh_api_key`) and sent only to `api.anthropic.com`. Functions: `getApiKey()`, `saveApiKey()`, `callClaude()`, `callClaudeVision()` in `06-insights.js` / `01-core.js`.

When editing AI features: keep `maxTokens` conservative; the app pays per token from Matt's own API key.

---

## Feature Toggle System

Features can be toggled on/off via the Features modal (gear icon). The toggle map lives in `applyFeatureToggles()` in `07-upload.js`. When adding a major new section, add it as a feature flag so it can be hidden without deleting code.

Feature IDs are strings stored in `state.features`. `isFeatureOn(id)` returns `true` by default if the key is missing.

---

## Setup Wizard

New users run a multi-step setup wizard (`openSetupWizard()`) that configures:
1. Household name + emoji
2. Features to enable
3. Household members (names, colours, income type)
4. Children (optional)
5. Lifestyle (diet, insurance)
6. Pets
7. Income details
8. Savings goals + budget
9. Review & finish

Wizard writes into `wizData` and then calls `wizFinish()` which populates `state`. Do not bypass the wizard data structure when modifying member/income/pet setup.

---

## Bank Statement Parsers

Two hardened CSV parsers exist in `07-upload.js`:
- **BMO Chequing/Savings**: `parseBMOStatement()`
- **Canadian Tire Mastercard**: `parseCTMastercardStatement()`

A format detector `detectCSVFormat()` picks the right parser. If adding a new bank, follow the same pattern: detect by header signature, map columns, normalise dates with `toISO()`. The preview step (`showImportPreview()`) is always shown before committing — never auto-import.

Duplicate detection runs before import: transactions with the same date + amount + description are flagged.

---

## Adding a New Feature — Checklist

1. Identify which `.js` file owns the feature (see table above).
2. Add the render function as `renderXxx()` — it should write into a `<div id="page-xxx">` or a sub-section.
3. If a modal is needed, add it to `modals.html` (simple) or `tail.html` (complex/late-loading).
4. If persistent data is needed, add the key to `defaultState()` and add a migration guard.
5. If it's a major section, add a feature toggle.
6. Run `python build.py` and test in browser.
7. If the feature uses Canada-specific tax/financial rules, document the formula source here.

---

## What NOT to Do

- Do not add `npm`, `node_modules`, bundlers, or any build dependency beyond Python stdlib.
- Do not add a backend or any server-side component. Everything must work as a static file.
- Do not use `alert()`, `confirm()`, or `prompt()` — use `hhAlert()` / `hhConfirm()`.
- Do not hardcode Matt and Holly's names in UI labels — they come from `state.members`.
- Do not apply US tax logic. All tax/financial defaults are Ontario, Canada.
- Do not save the Anthropic API key anywhere other than localStorage under `hh_api_key`.
