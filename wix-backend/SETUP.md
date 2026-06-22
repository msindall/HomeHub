# Phase 0 — Wix Backend Setup (Card-Lookup Proxy)

Goal: prove Home Hub can read an external card page **without a CORS error** by
having a free Wix backend fetch it for you. ~20 minutes, no coding required —
just create a site and paste one file.

This folder contains:
- `http-functions.js` — the backend code (already written and logic-tested). You paste this in.

---

## Step 1 — Create a new, dedicated Wix site

1. Go to **wix.com** and sign in (your existing account is fine).
2. Click **+ Create New Site**.
3. When asked what kind of site, pick **"Blank"** (or any template — content
   doesn't matter; we only need the backend).
4. Name it something like **Home Hub Backend**. Do **not** reuse Cottage Country
   Courier, Designs By Matt, SolutionsBookkeeping, etc. — keep this separate.

> Why a new site: the roadmap calls for an isolated, dedicated backend so app
> code never tangles with your business sites.

---

## Step 2 — Turn on Dev Mode (Velo)

1. Open the new site in the **Wix Editor**.
2. In the top bar, find the **Dev Mode** toggle (sometimes labelled **Velo** or
   under a **{ }** / Settings menu) and switch it **ON**.
3. A code panel and a file tree appear, usually on the left/bottom.

---

## Step 3 — Add the backend function

1. In the code file tree, open the **Backend** (or **Backend & Public**) section.
2. Look for a file named **`http-functions.js`**.
   - If it exists, open it.
   - If it doesn't, right-click the Backend folder → **New .js File** → name it
     exactly `http-functions.js`.
3. Open `http-functions.js` from **this folder** on your computer, copy **all**
   of it, and paste it into the Wix file (replace anything that was there).
4. Click **Save** (or Ctrl/Cmd-S).

---

## Step 4 — Publish

1. Click **Publish** (top-right of the Editor).
2. Wix gives the live site a URL like:
   `https://YOURNAME.wixsite.com/home-hub-backend`

Your function's live address is that URL **+ `/_functions/cardLookup`**:

```
https://YOURNAME.wixsite.com/home-hub-backend/_functions/cardLookup?url=...
```

> Wix automatically maps the function `get_cardLookup` to the public path
> `/_functions/cardLookup`. You do **not** type "get_" in the URL.

---

## Step 5 — Test it (this is the Phase 0 success check)

Paste this into a normal browser address bar (replace the first part with your
real published URL), then press Enter:

```
https://YOURNAME.wixsite.com/home-hub-backend/_functions/cardLookup?url=https://www.rbcroyalbank.com/credit-cards/travel/rbc-avion-visa-infinite.html
```

✅ **Success** = you get back JSON like:

```json
{
  "ok": true,
  "url": "https://www.rbcroyalbank.com/...",
  "title": "RBC Avion Visa Infinite ...",
  "annualFee": 120,
  "rewardsRate": "1.25 points per $1 spent",
  "matchedSnippets": [ ... ]
}
```

The exact fields depend on the page. Even if `annualFee`/`rewardsRate` come back
`null` on a heavily-scripted page, **`"ok": true` with a title proves the core
win**: the page was fetched server-side with no CORS block. That's Phase 0 done.

---

## Step 6 — Send me the URL

Once it returns JSON, paste your live `/_functions/cardLookup` URL back to me. I'll
wire the matching field + lookup button into Home Hub's account-setup step
(roadmap item 3.2) so you can paste a card link and have it auto-fill.

---

## Troubleshooting

| You see | Likely cause | Fix |
|---|---|---|
| `404` page, not JSON | URL path wrong, or not published | Confirm `/_functions/cardLookup`, and that you clicked **Publish** |
| `{"ok":false,"error":"Missing ?url="}` | No `?url=` on the end | Add `?url=https://...` |
| `ok:false, Upstream HTTP 403` | The card site blocked the bot | Try a different card URL; the proxy itself still works |
| Function not found | File not named exactly `http-functions.js` | Rename it; function names must keep the `get_` / `options_` prefixes |

---

## What this does / doesn't do

- **Does:** fetch any public page server-side and return title, meta description,
  best-effort annual fee, and rewards rate as JSON — no CORS.
- **Doesn't:** log in to your bank, read your balances, or see anything behind a
  login. It only reads the same public marketing page you'd see logged out.
- **Cost:** free Wix tier is enough for this test. The page may show Wix branding;
  irrelevant for a backend-only site.
