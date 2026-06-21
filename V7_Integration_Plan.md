# Home Hub — V7 Sims-Home Integration Plan

Integrate the live V6.55 app into the Sims-style isometric home front end
(`V7_Option2_SimsHome.html`). Decisions locked with Matt:

- **Launcher model.** The Sims lot is a new landing screen; clicking a room
  opens the existing, fully-working pages unchanged via `showPage(id)`. No
  financial/tax/parser logic is rewritten.
- **Classic sidebar kept** as a toggle (safety net + pages without a room).
- **Live data** from `state` (phased — see below).
- **Goals bind to an account**, not transactions (Phase B).
- **Mobile falls back to the classic view** (the iso scene is desktop-oriented).
- **Phased builds** — each phase is its own `build.py` → test → deploy.

## Room → page mapping (covers all 17 pages)

The lot's room panel shows a short description plus "open module ›" chips, one
per related page, each calling `showPage`:

| Lot element | Opens (existing pages) |
|---|---|
| 💼 Study | Transactions · Budget · Net worth · Upload |
| 💍 Bedroom | Wedding |
| 🌅 Sunroom | Retirement · Tax |
| 🍲 Kitchen | Grocery · Meals/Recipes |
| 🐾 Living | Pets · Bills · Maintenance · Calendar |
| 🚗 Garage | Cars · Career |
| 🌱 Garden plants | Goals |
| ✉️ Mailbox | reminders / bills due |
| 👨 👩 Sims | edit member (Setup wizard) |

## Architecture / build integration

- New `08-home.js` module, **wrapped in an IIFE** exposing only
  `window.HHHome = { init, show, hide }`. This prevents the prototype's generic
  globals (`money`, `toast`, `hint`, `G`, `season`, `card`…) from clobbering the
  app's helpers in the single-file concat. **This is the #1 risk.**
- Scene markup added to `shell.html` immediately after `<body>` as a full-screen
  `#hh-home` overlay (high z-index). Fake "Study Desk" overlay is **dropped**.
- All prototype CSS **scoped under `#hh-home`** (in `style.css`) so its `.card`,
  `.pill`, `.btn`, `.tx`, `.chip`… cannot leak into the app's pages. Sims CSS
  vars (`--paper`, `--sims-green`, `--sky-*`…) live on `#hh-home`, not `:root`.
- `08-home.js` appended to `JS_FILES` in `build.py` (loads after core so
  `state` / `showPage` exist). `HHHome.init()` called at end of `_initApp()`,
  after `loadState()`.
- Fredoka font added via `<link>` in `shell.html` head.

## Phased rollout

**Phase A — Shell in (this build).**
Lot becomes the namespaced landing screen, wired into `build.py` + `_initApp`.
Rooms/plants/sims/mailbox launch the real pages. Easy live reads done now
(household name, members + pets for the tray/sims, goals → plants, latest
net-worth snapshot, live clock + weather). Harder derived numbers
(safe-to-spend, needs levels, mailbox count) stay as placeholders.
Classic-view toggle added. On screens ≤ 820px the lot is skipped and the
classic app loads directly.

**Phase B — Live data + goal→account binding.**
- Add `accountId` to the goal schema (+ migration guard). Goal progress
  (`saved`) reads the linked **account balance** instead of transactions.
- Add an account picker to the Goals page UI.
- Bind remaining lot figures (needs HUD, safe-to-spend, mailbox/reminders,
  income split) to real `state`.
- Reconcile weather to the Setup-wizard location (`household.city/province`).

**Phase C — Polish.**
Per-room multi-page chip menus, first-run/empty-state handling, performance of
`buildLot()` on state change, optional live Study-Desk glance, accessibility.

## What stays untouched
All 17 page renderers, Ontario tax/mortgage logic, bank parsers, AI features,
the theming/feature-toggle engines, and the offline single-file architecture.
