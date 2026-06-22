# Home Hub — Feature Roadmap (post-V7)

Last updated: 2026-06-22

> **Update (2026-06-22): Phase 0 is no longer hypothetical — the Wix backend is
> proven and live.** The `cardLookup` proxy fetches an external page server-side
> with no CORS and returns clean JSON (verified against a real RBC Avion page:
> title, description, and annual fee all returned). That single proof flips the
> feasibility verdict on a whole row of items below — see the revised table and the
> revised build order at the bottom. Caveat from the live test: values that only
> appear after JavaScript runs (e.g. `rewardsRate`) come back null, so lookup is an
> accelerator for the preset/manual-entry approach in 3.2, not a replacement.

This roadmap takes the brainstorm list, checks each idea against Home Hub's hard
architectural constraint — **a single static HTML file, no backend, no server,
browser-only** — and sorts everything into phases by feasibility and value.

---

## The one constraint that decides everything

Every idea below lives or dies on the same rule from CLAUDE.md: **there is no
server.** That has three consequences worth stating once, up front, because they
explain most of the "not feasible" verdicts:

1. **CORS blocks the browser from reading most third-party sites.** The app
   cannot fetch a RBC card page, a SmartThings endpoint, or a realtor.ca listing
   directly from JavaScript — the browser refuses the response unless that site
   sends a permissive CORS header, and almost none do.
2. **OAuth to a third-party cloud needs a registered, hosted client and usually a
   server to hold tokens.** Client-side-only OAuth works for *login* (who you
   are) but not for *acting on your behalf* on most platforms.
3. **There is no shared database, so users can't see each other's data.** Anything
   "social" needs a server holding shared state, which the project rules forbid.

What *thrives* under this constraint: anything that runs on data the app already
has (cashflow logic, achievements, charts) and anything cosmetic (weather,
flowers, scenery). Those are the high-value, low-risk wins — and they happen to
be some of your best ideas.

---

## Feasibility verdict at a glance

| Idea | Verdict | Where |
|---|---|---|
| Home/Lot View as default (desktop) | ✅ Easy, ship now | Phase 1 |
| Weather refresh + live weather effects | ✅ Easy | Phase 1 |
| Flowers & trees (selectable) | ✅ Easy, cosmetic | Phase 1 |
| Scenery / sky / ponds around the lot | ✅ Moderate, cosmetic | Phase 2 |
| Achievements & rewards system | ✅ Great fit, pure client-side | Phase 2 |
| **Cashflow Advisor** | ✅ **Highest value, fully feasible** | Phase 3 |
| Account rewards/rates (manual + presets) | ✅ via curated DB + manual entry | Phase 3 |
| Receipt scanner (itemized) | ✅ Extends existing Vision pipeline | Phase 4 |
| Simplified / guided setup wizard | ✅ Feasible (UI work) | Phase 4 |
| **Wix backend (card-lookup proxy)** | ✅ **PROVEN LIVE (2026-06-22)** | Phase 0 ✔ |
| Account rewards/rates pulled from a URL | ✅ Now feasible — backend fetches server-side (JS-only fields still need 3.2) | Phase 0/3.2 |
| Cross-device sync (Matt & Holly) | ✅ Now feasible via Wix Data | Phase 0.5 |
| Real per-user login | ✅ Now feasible via Wix Members | Phase 0.5 |
| Hide Anthropic API key server-side | ✅ Now feasible via Wix Secrets | Phase 0.5 |
| Basic social (share recipes/achievements) | ✅ Now feasible via shared DB | Later |
| Google login (basic profile only) | ⚠️ Limited — login yes, data import no | Phase 5 |
| Deep-link integrations (realtor/autotrader/travel/Amazon) | ⚠️ Links only, not data sync | Phase 5 |
| Billing third parties via Google login | ❌ Not a thing Google offers | — |
| Smart home automation (Google/Alexa/SmartThings) | ❌ Needs approved OAuth dev project | — |
| True real-time social (friends, compare, shared feed) | ⚠️ Possible w/ backend but heavy | Later |
| Amazon account/shopping integration | ❌ No consumer API | — |

---

## Phase 0 — Wix backend (the unlock) — ✅ PROVEN LIVE

> **Status (2026-06-22): done and working.** The card-lookup proxy test below
> succeeded. It runs on a **classic Wix Editor** free site (not Wix Studio —
> Studio's function routing never activated):
> `https://mattjsindall.wixsite.com/homehub/_functions/cardLookup?url=...`
> Backend code lives at `wix-backend/http-functions.js`. The pattern below now
> applies to every "read an external site" / "share state" idea in this roadmap.
> **Only piece left:** wire the Home Hub client to actually call it (see Phase 3.2
> — card-link field + lookup button). The advanced unlocks it enables are now
> grouped under the new **Phase 0.5** below.


Home Hub's biggest limits all came from "no server." **Wix Velo is a free
server** built into the Wix account you already have — server-side JavaScript, a
database (Wix Data), real logins (Members), a secrets vault, and HTTP functions
that expose a small URL your app can call. Adding this *optionally* lifts the
hardest constraints without rewriting the app: Home Hub stays where it is and just
"phones" the Wix backend when it needs server muscle.

**Important:** spin up a **new, dedicated Wix site** for this. Do not bolt it onto
an existing business site (Cottage Country Courier, Designs By Matt,
SolutionsBookkeeping, etc.).

### What moves from blocked → feasible with a free Wix backend

| Previously blocked | Now possible because… |
|---|---|
| Read a card/account URL (e.g. Avion ION+) | Wix backend fetches it server-side — **no CORS** |
| Sync data across your & Holly's devices | Data lives in Wix Data, not one browser |
| Real per-user login | Wix Members replaces "whoever opens the file" |
| Basic social (share recipes, compare achievements) | A shared database now exists |
| Hide the Anthropic API key | Lives in Wix Secrets Manager, not the browser |

### What a paid Wix plan + custom domain adds later

- Your own domain (e.g. `homehub.ca`) and no Wix ads/branding.
- Higher storage, bandwidth, and database limits.
- Reliable **scheduled backend jobs** — nightly cashflow check, server-side
  weather refresh, routine third-party fetches that run without opening the app.
- Enough headroom to *attempt* smart-home OAuth (still needs separate
  developer approval from Google/Alexa/SmartThings — keep it low priority).

### Honest trade-off

This shifts Home Hub from "one private file I fully control" to "an app that
depends on a Wix account and some backend code" — more moving parts to maintain.
So treat Phase 0 as **opt-in**: prove the value on one small feature first (below)
before committing. The cosmetic/logic phases (1–4) do **not** require any of this
and can ship independently.

### First test — the card-lookup proxy (smallest proof) — ✅ PASSED

This contained experiment proved the whole approach:

1. ✅ New free Wix site created, Dev Mode / Velo on (classic Editor, not Studio).
2. ✅ `get_cardLookup` HTTP function added — takes a URL, uses `wix-fetch` to
   retrieve the page server-side, extracts fields, returns clean JSON.
3. ✅ **Done (V7.1):** Home Hub now calls the proxy. The Edit Account modal shows
   a card-link field + "🔎 Look up" button (for Credit Card / Loan / LOC /
   Investment types) that fetches the proxy and pre-fills nickname / annual fee /
   rewards rate, with manual fallback. Fields persist as `cardUrl`, `annualFee`,
   `rewardsRate` on the account.
4. ✅ Success confirmed — the RBC Avion page returned `ok:true` with title,
   description, and `annualFee=120`, no CORS error. (`rewardsRate` null — JS-only
   field, expected; 3.2 covers the gap.)

The same pattern (backend fetch + return JSON) now unlocks every other "read an
external site" and "share state across devices" idea — see Phase 0.5.

---

## Phase 0.5 — What the proven backend now unlocks (newly feasible)

These were ❌/⚠️ in the original roadmap purely because there was no server. The
server now exists, so they're real — but each changes the app's data model or auth,
so they deserve deliberate design rather than a rushed bolt-on. Sequenced after the
high-value financial work (Phase 3), not before.

**0.5a Cross-device sync (Matt & Holly).** The biggest life-changing unlock for a
two-person household — both of you seeing the same data. Store `state` in Wix Data
behind a Wix Members login; the browser reads/writes through HTTP functions. Needs
a schema design pass and a conflict/merge strategy (last-write-wins is the simple
start). Highest value of the Phase 0.5 items.

**0.5b Real per-user login (Wix Members).** Replaces "whoever opens the file" with
actual accounts — the prerequisite for 0.5a and any sharing. Do alongside 0.5a.

**0.5c Move the Anthropic API key server-side (Wix Secrets).** Today the key sits
in `localStorage` and is sent from the browser. Routing Vision/AI calls through a
backend function keeps the key in Wix Secrets Manager instead. Security win; modest
effort once the backend is wired.

**0.5d Basic social via shared DB.** Share a recipe or an achievement card by
writing it to a shared Wix Data collection the other user can read. Lighter than
real-time social (which stays out of scope). Low priority — after the above.

---

## Phase 0.5+ — Backend opportunities (added 2026-06-22)

These fix existing weaknesses or save money rather than add new surface, which is
why several rank higher on value-per-effort than the cosmetic phases. The proven
`cardLookup` proxy pattern (browser → HTTP function → fetch/DB → JSON) is the same
mechanism behind all of them.

**★ Server-side state backup + version history (top pick — data safety).**
Today all `state` lives in `localStorage`/IndexedDB in one browser; a cache clear,
reinstall, or sandbox wipe loses everything. Mirror `state` to Wix Data on save and
keep recent versions, so the data survives the browser. For years of household
finances this matters more than any cosmetic feature. No paid plan needed.

**★ AI proxy with caching (top pick — cost control).** Route `callClaude()` /
`callClaudeVision()` through a backend function so the Anthropic key lives in Wix
Secrets (see 0.5c) **and** results are cached — a flyer page or parsed recipe
scanned once doesn't re-bill on repeat. Add server-side rate limits so a runaway
loop can't quietly burn tokens, and swap models/trim prompts in one place without
re-deploying the HTML. No paid plan needed.

**★ iCal proxy — fixes existing calendar sync (top pick — repair).** The finance
calendar already pulls iCal feeds, many of which are CORS-blocked from the browser.
The same proxy pattern makes sync reliable. Fixes a feature you already have rather
than adding one. No paid plan needed.

**Proactive email reminders.** Send real notifications even when the app is closed:
bill due in 3 days, Cashflow Advisor shortfall ("checking dips below $0 on the
14th"), RRSP March 1 deadline, goal hit. Turns Home Hub from "remember to open it"
into something that pings you. *Reliable scheduling wants a paid Wix plan.*

**Live Canadian rates, fetched server-side.** Mortgage calc, retirement projector,
and tax pages depend on hard-coded, manually-maintained rates. A backend job can
pull Bank of Canada prime/bond yields (Valet API) and posted mortgage/GIC rates
daily and cache them, CORS-free — and flag when CRA tax brackets change, cutting
the annual manual upkeep CLAUDE.md calls out. *Scheduled refresh wants a paid plan;
on-demand fetch works on free.*

**Media hosting for receipts/photos.** `localStorage`'s ~5–10MB quota is a real
ceiling for the Phase 4 receipt scanner — base64 images blow through it. Wix Media
Manager hosts the images instead, so the scanner can keep a photo history.

**Real-time between Matt & Holly.** Beyond sync-on-load, `wix-realtime` pushes one
device's change to the other live (Holly adds milk → it appears on your phone).
Natural extension of the 0.5a sync work.

**Read-only share for tax time.** A members-gated, read-only view of the
tax/net-worth page to hand an accountant — no edit access, no file export.

**Highest value-per-effort:** the three ★ items (state backup, AI proxy+caching,
iCal proxy) — all fix or protect something real and none need the paid plan.
**Trade-offs:** the reminder and live-rate jobs lean on a paid Wix plan for
reliable scheduling, and every item adds moving parts to maintain.

---

## Phase 1 — Quick wins (low effort, high delight) — ✅ SHIPPED (V7.3)

These are small, self-contained, and don't touch the financial engine.

> **Status (V7.3): done.** New `state.lotPrefs` ({defaultView, weatherFX, treeType})
> + a "🏡 Lot View" settings modal (sidebar Settings). **1.1** the lot was already
> the desktop default; added a persistent classic/lot toggle that `HHHome.init()`
> honors. **1.2** weather already refreshed (~10 min) with rain/snow/fall FX — added
> a fog state + effect, a weather-FX on/off toggle, and `prefers-reduced-motion`
> respect (FX auto-pause). **1.3** added selectable flower species per goal (rose,
> tulip, sunflower, daisy, lavender, auto) via a picker in the goal editor and
> distinct `flowerHead()` SVG shapes, plus selectable lot tree types (maple, oak,
> pine, cherry); growth stage was already tied to goal progress.

**1.1 Home/Lot View as the default landing page (desktop only)**
Detect viewport width in `_initApp()`; if it's a desktop width, call
`showPage('lot')` instead of the dashboard; on mobile keep the current default.
Add a user override toggle in settings so it's customizable (per your project
rule that everything should be configurable). Trivial, ship first.

**1.2 Live weather: 30-minute refresh + weather effects**
You already pull weather. Add a `setInterval` (~30 min) to re-fetch, and drive a
visual layer over the lot: rain, snow, fog, sun, wind, thunder, etc., all mapped
from the weather code. Pure CSS/SVG animation, no new data source. Make the
effects toggleable and respect "reduced motion" so it never gets annoying.

**1.3 Flowers & trees — selectable types**
A cosmetic picker: each goal can be assigned a flower species (rose, tulip,
sunflower, lavender…) and the user picks tree types for the lot (cherry blossom,
maple, oak, pine…). These are just SVG assets keyed by a string in state. Fun,
personal, zero financial risk. Tie growth stage to goal progress so a goal at 60%
shows a half-grown plant.

---

## Phase 2 — Engagement layer

**2.1 Achievements & rewards system**
Strong fit — runs entirely on data you already track. Two tiers:
*life milestones* (hit a savings goal, pay off a card, complete the wedding
budget, reach a net-worth threshold) and *habits* (log transactions N days in a
row, scan a statement, stay under budget for a month). Store unlocked badges in
state, show a trophy shelf, and surface a celebratory toast via `hhToast()` on
unlock. Make the badge set data-driven so new achievements are just config.
Add it behind a feature toggle.

**2.2 Scenery around the lot**
Use the lower half of the screen for environment while keeping a sky band up top.
Offer a few selectable backdrops (pond, waterfall, forest, prairie, lakeside) and
optionally bias the default to the user's setup location. Same approach as
flowers — keyed SVG layers, toggleable, customizable. Pairs naturally with the
weather effects from 1.2.

---

## Phase 3 — The financial brain (highest value)

**3.1 Cashflow Advisor — the headline feature**

> **Status (V7.2): MVP shipped.** New `09-cashflow.js` (08 was taken by the lot
> view) + "🔮 Cashflow" nav page, behind a `cashflow` feature toggle. Delivers the
> forward forecast + shortfall flags: projects a chosen account's balance over a
> 30/60/90/180-day horizon from current balance, recurring bills (outflows), and an
> editable income schedule (seeded from member salaries), with a balance sparkline,
> "dips to $X on <date>" warnings, and a configurable safety buffer. **Still to do:**
> account-pays-what optimization and rewards routing (needs 3.2 presets), and
> per-bill source-account mapping (MVP treats all bills as paid from the forecast
> account).

This is the single best idea on the list and it's *fully feasible* because it's
pure logic over data the app already holds: accounts, balances, bills, due dates,
income timing, and credit-card statement/payment cycles. It needs no external
service.

What it would do:
- Build a forward calendar of money in vs. money out (paydays, Holly's
  tips/shifts, bills, subscriptions, credit-card due dates).
- Flag shortfalls before they happen ("checking dips below \$0 on the 14th").
- Recommend *which account pays what and when* to minimize transfers — e.g. line
  up the card statement close date with payday so you carry the float interest-free.
- Optimize for rewards: route spend to the card that earns the most for each
  category, then schedule the payoff before interest accrues.
- Respect Ontario/Canada context already baked into the app.

This is where the "so many accounts" pain actually gets solved. Suggest building
it as `08-cashflow.js` (new section, new feature toggle) so it stays isolated.

**3.2 Account details: rewards points & interest rates**
*Updated 2026-06-22:* "paste a link, auto-fill the card" **is now achievable** —
the proven Phase 0 `cardLookup` proxy fetches the page server-side (no CORS) and
returns title/description/annual fee. The remaining task is purely client-side:
add a card-link field + "Look up" button in account-setup that calls the proxy URL
and pre-fills the form. Caveat: JS-only values (e.g. rewards rate) don't appear in
the fetched HTML, so the lookup fills what it can and the rest falls back to:

The preset + manual library, which still carries the bulk of the value:
- A **curated preset library** of common Canadian cards/accounts (Avion ION+,
  Tangerine, Canadian Tire Mastercard, etc.) with their earn rates and reward
  structures baked in as data. Pick from a dropdown and it auto-fills.
- **Manual entry** for anything not in the library (rate, points multiplier,
  annual fee, category bonuses).
- This data then feeds the Cashflow Advisor's rewards optimization (3.1). The two
  features are designed to work together.

---

## Phase 4 — Smarter input

**4.1 Receipt scanner (itemized transactions)**
Your "Receipt Hog parser" idea is feasible because you already have a Claude
Vision pipeline (`callClaudeVision()`) for statement PDFs. Extend it: photograph a
receipt, send to Vision, get back itemized lines, categorize them, and feed the
existing transactions table + budget. Reuse the existing preview-before-commit and
duplicate-detection flow so nothing auto-imports. (Note: "Receipt Hog" is a
separate cashback app; this is your own receipt-scanning feature, not an
integration with theirs.)

**4.2 Simplified, guided setup wizard**
Rework the wizard to ask only what's essential up front, then run *guided
tutorials* that set up features in a sensible dependency order:
Goals → Accounts → Statements → Budget → Groceries → Career → Retirement/Tax.
This is pure UI/flow work on top of the existing `wizData`/`wizFinish()` structure
— no new infrastructure, fully feasible. (The Google-login part of this idea is
handled separately in Phase 5.)

---

## Phase 5 — External hooks (limited but possible)

These are the ideas where the no-backend rule bites. They're not impossible, but
the honest version is much smaller than the brainstorm implied.

**5.1 Google login — feasible for sign-in, *not* for data import**
Client-side Google Identity Services can sign a user in and return **email, name,
profile picture, and locale** — and nothing more. It cannot hand over your home
address, income, bank accounts, or reward balances; Google simply doesn't expose
those. So "log in with Google to auto-fill the wizard" only auto-fills name +
email + maybe city. Worth doing as a convenience and to personalize the app, but
set expectations: it's a *login*, not a personal-data importer.

**5.2 Deep-link integrations (not data sync)**
- **House search (realtor.ca):** the official DDF API requires CREA *member*
  credentials — it's for realtors and tech providers, not a consumer app, and
  scraping is blocked. The feasible version is a smart **deep link**: build a
  realtor.ca search URL from the user's house-goal criteria (city, price, beds)
  and open it in a new tab.
- **Car search (AutoTrader):** no public consumer API; same deep-link approach.
- **Travel:** deep-link to a pre-filled search on a travel site tied to a trip
  goal.
- **Amazon "Wedding Shopping List":** no consumer shopping API exists, so you
  can't read a real Amazon list. The feasible version: keep the wedding shopping
  list *inside* Home Hub, show it on the wedding page, and deep-link each item to
  an Amazon search. (If you ever want true price/affiliate data, that needs the
  Product Advertising API, which requires an affiliate account **and a server** —
  out of scope for this app.)

---

## Not feasible in a static, server-less app (and why)

I'd recommend dropping these or revisiting only if the no-backend rule ever
changes:

- **Billing third parties' API usage via Google login.** Google login provides
  identity, not payment processing or metered billing. There's no mechanism to
  charge other users for API calls through it. The app's model — each user enters
  their own Anthropic API key — is the right one; the feasible improvement is just
  making that key entry clearer in setup.
- **Smart home automation (Google Home/Nest, Alexa, SmartThings).** All three
  require server-side OAuth with approved developer projects, and SmartThings
  explicitly sends no CORS header, so the browser can't even call it directly.
  This genuinely needs a backend.
- **True social features (friends, comparing achievements, a shared feed).**
  Sharing data between users requires a shared database/server. The static-file
  workaround is limited to **export/import**: e.g. export a recipe or an
  achievement card as a file the user sends to a friend, who imports it. Real-time
  social is out.
- **Pulling account rates/points from a pasted URL.** CORS-blocked, as above. The
  preset-library + manual-entry approach in 3.2 is the replacement.

---

## Extra ideas this brainstorm sparked

A few additions that fit the constraints and your goals:

- **Seasons on the lot.** Tie the scenery/trees to the calendar — autumn maples in
  October, snow in winter, blossoms in spring. Free delight, reuses the cosmetic
  engine.
- **Day/night cycle.** Sky shifts with the local clock (sunrise/sunset already
  derivable from weather data). Pairs with weather effects.
- **"What-if" cashflow simulator.** A slider sandbox on top of the Cashflow
  Advisor: "what if we cut dining \$200/mo?" → see the goal dates move. Pure logic.
- **Goal-linked plants as progress bars.** Each savings goal *is* a growing
  plant; watering = contributing. Merges the flower idea with goal tracking so the
  cosmetics carry real meaning.
- **Reminders/automation via scheduled briefings.** A daily/weekly "household
  briefing" (upcoming bills, cashflow flags, goal progress) — feasible as a
  generated summary the app surfaces on open.
- **Pet care streaks** that feed the achievements system (you already have pets).
- **Export an achievement/milestone card as an image** to share — the
  static-file-friendly version of "social."

---

## Suggested build order (summary — revised 2026-06-22)

The backend proof doesn't change the *value* ranking (Cashflow Advisor is still
#1), but it lets us finish the stranded card-lookup feature and promotes
cross-device sync from "impossible" to a real mid-list item.

1. ~~**Finish card-lookup wiring**~~ ✅ **DONE (V7.1)** — card-link field + "Look up"
   button live in the Edit Account modal, calling the proven proxy end-to-end.
   Phase 0 is fully closed.
2. **Phase 3 — Cashflow Advisor + account presets** *(the real value)* — still
   needs no backend; pure logic over data you already hold. Build as `08-cashflow.js`.
   3.2's presets now get optional auto-fill from step 1.
3. **Phase 1 — default Lot View, live weather, flowers & trees** *(quick wins)* —
   no longer have to go first; use them as low-risk palate-cleansers between the
   heavier financial work.
4. **Phase 0.5 — cross-device sync + Members login + server-side API key** *(newly
   feasible)* — the most life-changing newly-unlocked work for a two-person
   household. Deferred to here because it changes the data model and deserves its
   own design pass (Wix Data schema, conflict handling).
5. **Phase 2 — achievements, scenery** *(engagement)*.
6. **Phase 4 — receipt scanner, guided setup wizard** *(smarter input)*.
7. **Phase 5 — Google login (basic), deep-link integrations** *(nice-to-haves)*.
   Basic social (0.5d) also slots in around here once sync exists.

Phases 1–4 still need no backend and can ship today. Phase 0 is **done**; Phase 0.5
is the deliberate follow-up that turns the proven backend into cross-device sync.

Phase 3 remains where I'd put the most effort — it solves a real problem you have,
it's fully achievable with no external dependencies, and the account-presets work
feeds straight into it (now with a working lookup assist).
