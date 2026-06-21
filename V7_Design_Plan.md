# Home Hub — V7.0 Design Plan — **Option 1: "Sunday Morning"**

*A bright, fun, glanceable household hub: top-bar nav + command palette, sunny pastel palette, money front and centre, with weather and pet trackers kept. (Companion file: `V7_Design_Mockup.html`.)*

> This is **Option 1** of two design directions. Option 2 — an off-the-wall, very creative, groundbreaking-features concept — will be drafted separately for comparison.

---

## 1. Where V6 stands today

The current interface is genuinely warm and likeable: a terracotta-and-cream palette, Playfair Display headings, soft rounded cards, springy micro-animations, full dark mode and a theming engine. It feels like a cozy home, which suits a household app.

But for a tool whose job is to help you *manage money well*, a few things work against you:

- **The numbers don't lead.** Money figures are set in the same Playfair serif as decorative titles, at sizes that compete with everything else. Nothing on screen says "this is the one number that matters right now." Figures also aren't tabular, so columns of dollars don't line up cleanly.
- **17 flat nav items.** The sidebar lists every page at one level (Dashboard, Calendar, Transactions, Budget, Wedding, House, Tax, Retirement, Cars, Pets, Tips, Grocery…). It's a lot to scan, and the money pages don't stand out from the lifestyle pages.
- **Even visual weight everywhere.** Every card has the same 2px border, same shadow, same radius. With no hierarchy, the dashboard reads as a wall of equally-loud boxes rather than "headline → supporting detail."
- **Playfair + warm peach is a recognisable, slightly dated combo.** It's pretty, but it doesn't read "sharp financial instrument." The goal is to keep the warmth while gaining precision.

None of this is broken — it's a strong V6. V7.0 is about *editing*: sharper hierarchy, calmer surfaces, money that reads at a glance.

---

## 2. The V7.0 direction

Keep the warmth, add the precision of a private bank. Three principles:

**Money is the hero.** The biggest, clearest thing on every screen is the number you came to check — net worth, safe-to-spend, goal progress. Everything else recedes to support it.

**One calm surface, sharp accents.** A warm paper background with white cards and hairline borders, a *single* confident accent (clay), and reserved semantic colours (emerald for money in, garnet for money out, gold for goals). No more rainbow of equal-weight tints.

**Read at a glance.** Tabular numerals, a clear type scale, and generous whitespace so the eye lands on the headline first and the detail second.

A live mockup of this direction is in **`V7_Design_Mockup.html`** — open it to see the dashboard.

---

## 3. Typography

| Role | V6 | V7.0 | Why |
|---|---|---|---|
| Display / headings | Playfair Display | **Fraunces** | Modern characterful serif with optical sizing — warmth without the dated feel |
| UI / body | Nunito | **Hanken Grotesk** | Cleaner, more legible at small sizes; excellent tabular figures |
| Money figures | (Playfair) | **Spline Sans Mono** (tabular) | Dollar columns align; ledgers read like a statement, not prose |

Set a real scale and stick to it: display 30/46px, section 20px, card title 16px, body 14px, label 11px uppercase. Turn on `font-variant-numeric: tabular-nums` everywhere a dollar amount appears.

---

## 4. Colour — *bright & fun, not dreary*

The first pass leaned too muddy and dark. V7.0's palette is **"Sunday Morning"**: a sunny cream canvas with soft pastel light-leaks (mint, peach, berry) in the corners, white cards, and a set of cheerful, saturated accents. It still keeps money legible — but the app should feel like a bright kitchen on a Saturday, not a bank statement.

```
--paper    #FFF8EF   sunny cream page (with pastel radial glows behind)
--card     #FFFFFF   raised surface
--line     #F1E5D6   soft hairline border
--ink      #3A2A1E   warm brown text (friendly, still high-contrast)
--ink2     #83705F   secondary text
--coral    #FF7A53   THE accent — buttons, active nav, key figures (warm & lively)
--teal     #13B6A4   fresh secondary
--sun      #FFB12E   sunny highlight
--berry    #FF5C8A   playful pink
--grape    #8B6FE0   soft purple
--green    #15A86F   money in / positive
--red      #F0506E   money out / over-budget
```

Each goal, budget category, and pet gets its own friendly colour + emoji, so the dashboard reads as a lively, glanceable space rather than a grey ledger. Gradients are used sparingly for delight (the logo, the active nav pill, the net-worth delta chip, the weather card) — never behind the money figures, which stay crisp on white.

Because it's all CSS variables, this is still a drop-in for the theming engine — and "Quiet Wealth" (the calmer warm version) can ship as an *alternate theme* for anyone who prefers it.

---

## 5. Navigation & information architecture — *the big change*

**Kill the sidebar.** A permanent 240px rail spent most of its width on empty space and still made you scan 17 flat items. V7.0 replaces it with a **slim top bar** that reclaims the entire viewport for content:

- **Four primary sections**, not seventeen. The 17 pages collapse into **Dashboard · Money · Plan · Life**, shown as a compact segmented control in the top bar. Today's pages become sub-pages:
  - *Money* → Transactions, Budget, Goals, Net worth
  - *Plan* → Wedding, House, Retirement, Tax prep, Career
  - *Life* → Calendar, Grocery, Meals, Maintenance, Pets, Tips
- **A context sub-row** under the top bar shows the sub-pages of whichever section is active (e.g. selecting *Money* reveals Transactions / Budget / Goals / Net worth). Two clean levels instead of one long list.
- **⌘K command palette** is the real navigation. Type "rent", "wedding", "add expense", "Holly tips" and jump straight there or run the action. For a power user this is faster than any menu, and it means the chrome can stay minimal.
- **Quick add** button + avatar live on the right. Everything else (Settings, theme, export) moves into the avatar menu.

Net effect: the content area goes from ~1,180px to the **full window width**, which is what makes the new dashboard's content + right-rail layout possible.

**Rebuild the dashboard around a money narrative (top to bottom):**

1. **Greeting + weather** — a friendly "Good morning, Matt!" with the status line ("$1,240 ahead of plan"), and the **weather widget** restored as a bright gradient card in the header (temp, condition, hi/lo, location). It stays — it's part of the daily-home feel.
2. **Hero: Net worth** with sparkline + monthly delta — the single biggest number on the page.
3. **Cashflow card** — money in, money out, net, and a *Safe-to-spend* figure (the most useful number a budget can give you).
4. **Goal rings** — Wedding, House, Cars, Retirement as progress rings, each with its own colour + emoji.
5. **This month's budget** — top categories as spend/limit bars, colour-coded by status.
6. **Pet feed tracker** — restored as a right-rail card: each pet with an emoji avatar and tappable **AM / PM feed toggles** that turn green when done, so feeding never gets missed.
7. **Coming up** — upcoming bills and income on a date timeline, including Holly's estimated tips and Matt's payday so the split is always visible.

This turns the dashboard from a status board into a *"am I okay, what's the day like, and what's next?"* answer — money front and centre, but still the warm household hub, weather and pets included.

---

## 6. Money-management wins baked into the redesign

- **Safe-to-spend** number derived from income − committed bills − goal contributions − spent-so-far. The single most behaviour-changing metric.
- **Budget bars that flip colour** at/over limit (emerald → clay → garnet) so overspend is felt, not read.
- **Holly vs Matt income clarity** — tips (cash/declared) and salary surfaced on the timeline, reinforcing the split the app already models for tax.
- **Goal velocity** — show "on track · age 61" / "fully funded by Apr 2027" beside each ring, not just a percentage.
- **Ahead/behind-of-plan** status line that gives an instant verdict every time you open the app.

---

## 7. Rollout — three low-risk phases

Because everything is driven by CSS variables and `applyTheme()` / `_buildThemeObj()`, most of this ships without touching feature logic.

**Phase A — Skin (1 build, near-zero risk).** Swap the font imports, the `:root` variable values, border 2px→1px, and add tabular numerals. Update `_buildThemeObj()` with the new tokens so dark mode + themes still work. The whole app instantly reads as V7.0 with no structural change.

**Phase B — Dashboard.** Rebuild `02-dashboard.js` rendering into the money-narrative layout above (hero net worth, cashflow + safe-to-spend, goal rings, budget bars, timeline). This is the one page worth hand-crafting.

**Phase C — Navigation & polish.** Replace the sidebar with the top bar + four-section model, wire up the ⌘K command palette and Quick-add, and apply the new type scale + hierarchy to the remaining pages.

Each phase is a normal `python build.py` → test → deploy cycle, and any phase can ship on its own.

---

## 8. What stays

Dark mode, the theming engine, the feature-toggle system, all Ontario/Canada financial logic, the offline single-file architecture — untouched. V7.0 is a visual and hierarchy upgrade, not a rewrite.
