# 🏠 Home Hub — Developer Guide

A household management app for Matt & Holly. Built as a single-file HTML app
that works on XAMPP, direct file open, or GitHub Pages.

---

## Project Structure

```
home-hub/
│
├── build.py                 ← Run this to produce a deployable HTML file
│
├── src/                     ← Edit files here
│   ├── css/
│   │   └── style.css        ← All visual styling (~810 lines)
│   │
│   ├── html/
│   │   ├── shell.html       ← Page structure: nav, sidebar, page divs (~1,960 lines)
│   │   ├── modals.html      ← All modal dialog HTML (~465 lines)
│   │   └── tail.html        ← Remaining modals + closing tags (~1,134 lines)
│   │
│   └── js/
│       ├── 01-core.js       ← State, storage, helpers, dialogs, navigation, weather
│       ├── 02-dashboard.js  ← Dashboard page rendering, reminders, pet toggles
│       ├── 03-finance.js    ← Calendar, transactions, budget, goals
│       ├── 04-planning.js   ← Wedding, house, bills, net worth (partial)
│       ├── 05-household.js  ← Net worth, cars, maintenance, tips (partial)
│       ├── 06-insights.js   ← Tips page, grocery, meal plan, recipes, pantry
│       └── 07-upload.js     ← Bank statements, CSV/PDF parsing, career, charts, init
│
└── App_V6_28.html           ← Built output — this is what you deploy
```

---

## How to Make a Change

1. **Edit** the relevant file in `src/`
2. **Run the build** from your terminal:
   ```
   python build.py
   ```
3. A new `App_V6_28.html` (or next version) appears in the folder
4. Open it in your browser or copy it to XAMPP `htdocs/`

That's it. No npm, no Node, no other tools needed.

---

## Which File Do I Edit?

| Feature | File |
|---|---|
| Visual styling, colours, fonts | `src/css/style.css` |
| Navigation, sidebar, page layout | `src/html/shell.html` |
| Any modal dialog (popup form) | `src/html/modals.html` or `src/html/tail.html` |
| Dashboard, weather, reminders | `src/js/02-dashboard.js` |
| Transactions, budget, goals | `src/js/03-finance.js` |
| Calendar | `src/js/03-finance.js` |
| Wedding planner | `src/js/04-planning.js` |
| House / mortgage calculator | `src/js/04-planning.js` |
| Bills & subscriptions | `src/js/04-planning.js` |
| Net worth, car funds | `src/js/05-household.js` |
| Maintenance tracker | `src/js/05-household.js` |
| Tips tracker | `src/js/06-insights.js` |
| Grocery, meal plan, recipes, pantry | `src/js/06-insights.js` |
| Bank statement uploads | `src/js/07-upload.js` |
| Career planner | `src/js/07-upload.js` |
| Tax prep, retirement projector | `src/js/07-upload.js` |
| State management, local storage | `src/js/01-core.js` |
| App startup logic (`_initApp`) | `src/js/07-upload.js` |

---

## Build Options

```bash
# Auto-increment version (recommended)
python build.py

# Specify a version manually
python build.py --version=6.29
```

---

## Deployment Options

### Option 1 — XAMPP (local)
Copy the output `.html` file to:
```
C:\xampp\htdocs\homehub\App_V6_28.html
```
Then visit `http://localhost/homehub/App_V6_28.html`

### Option 2 — Double-click (simplest)
Just double-click `App_V6_28.html` in File Explorer.
Works because the output is a single self-contained file.

### Option 3 — GitHub Pages
1. Push the entire `home-hub/` folder to a GitHub repo
2. Enable GitHub Pages on the repo (Settings → Pages → main branch)
3. Your app is live at `https://yourusername.github.io/home-hub/App_V6_28.html`

Or rename the output to `index.html` before pushing for a cleaner URL.

---

## Adding a New Feature (workflow)

1. Decide which `src/js/` file the feature belongs in (see table above)
2. Add your JS functions to that file
3. If the feature needs a modal, add it to `src/html/modals.html`
4. If the feature needs a new page section, add it to `src/html/shell.html`
5. Run `python build.py`
6. Test in browser

---

## Data & Privacy

All data is stored in `localStorage` in your browser — nothing is sent to any server
except Anthropic API calls (meal planning, flyer scanning, PDF extraction).
Your Anthropic API key is stored in `localStorage` and sent only to `api.anthropic.com`.
