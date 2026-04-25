# Home Hub — Phase 2: Easy Sharing & Access

Paste this entire document into a new Cowork session to execute Phase 2.

**Prerequisite:** Phase 1 must be complete. `python build.py` must run successfully and produce a minified output file.

---

## What this project is

Home Hub is a single-file HTML household management app for Matt & Holly (Ontario, Canada). No npm, no server, no build dependencies beyond Python. Source files sit flat in `D:\Claude\Home Planner\`. Running `python build.py` produces `App_VX_Y.html`.

**Working folder:** `D:\Claude\Home Planner\`

**Current built file:** `App_V6_29.html` (or whatever the latest version is after Phase 1)

---

## Context: why sharing matters

Matt's top frustration is sharing the app. Currently the only way to share is:
1. Email someone the 977 KB HTML file (unwieldy)
2. Export a config JSON file and tell them to import it (requires explanation)

The goal of this phase: the app lives at a public URL, and sharing it with friends or family is a single link or QR code scan.

---

## Source file map (all flat at root, no src/ subdirectory)

| File | Role |
|------|------|
| `style.css` | All CSS |
| `shell.html` | Page skeleton, nav, all page divs |
| `modals.html` | Modal HTML first half |
| `tail.html` | Modal HTML second half + closing tags |
| `01-core.js` | State, storage, helpers, dialogs |
| `02-dashboard.js` | Dashboard |
| `03-finance.js` | Calendar, transactions, budget |
| `04-planning.js` | Wedding, house, bills |
| `05-household.js` | Net worth, cars, tax, retirement |
| `06-insights.js` | Tips, grocery, meal plan, recipes |
| `07-upload.js` | Bank import, career, charts, setup wizard, `_initApp()` |
| `build.py` | Build script |
| `chart.umd.min.js` | Inlined Chart.js (downloaded in Phase 1) |

---

## Relevant existing functions (do not duplicate)

- `exportShareableConfig()` in `07-upload.js` — already exports a JSON config file with household name, members, pets, goals, features, budgets, categories. **We will extend this** to also support URL-based sharing.
- `openSetupWizard()` in `07-upload.js` — the setup wizard. Already accepts a pre-loaded `wizData` object. **We will extend it** to accept config from URL hash.
- `_initApp()` in `07-upload.js` — app startup. **We will add** URL hash detection here.

---

## Phase 2 tasks — do all of these in order

### Task 1 — URL hash config sharing

When a user opens the app with a URL like `App_V6_29.html#setup=<base64>`, the app detects the hash and pre-loads the Setup Wizard with that config.

**In `07-upload.js`, modify `_initApp()`:**

After `loadState()` and before the `showPage('dashboard')` call, add:

```javascript
// URL hash config import
var hashMatch = window.location.hash.match(/^#setup=(.+)$/);
if (hashMatch) {
  try {
    var decoded = JSON.parse(atob(hashMatch[1]));
    if (decoded && decoded._type === 'homehub_config') {
      window.location.hash = ''; // clean the URL
      hhConfirm(
        '<strong>Setup invitation found!</strong><br>Pre-fill the Setup Wizard with the shared household template?<br><small style="color:var(--muted)">Your existing data (if any) will not be affected.</small>',
        '🏠', 'Shared Setup'
      ).then(function(ok) {
        if (ok) {
          // Convert config to wizData format then open wizard
          importConfigToWizard(decoded);
        }
      });
    }
  } catch(e) {
    // Malformed hash — ignore silently
  }
}
```

**Add a new function `importConfigToWizard(config)`** that maps the config JSON (same shape as `exportShareableConfig()` output) into the `wizData` global and calls `openSetupWizard(wizData)`.

**Add a new function `generateShareURL()`** that:
1. Calls the same logic as `exportShareableConfig()` to build the config object
2. Encodes it with `btoa(JSON.stringify(config))`
3. Constructs the share URL as `window.location.href.split('#')[0] + '#setup=' + encoded`
4. Copies it to clipboard via `navigator.clipboard.writeText(url)`
5. Shows `hhToast('Share link copied to clipboard!', '🔗')`
6. Also shows the URL in a modal (see Task 3 for the modal)

### Task 2 — GitHub Pages deploy script

Create a new file `deploy_github.py` in the project root. This script:

1. Reads the latest built `App_VX_Y.html` from the project folder (finds the highest version number)
2. Creates (or overwrites) a file called `index.html` in the project folder that is a simple HTML redirect:
   ```html
   <!DOCTYPE html>
   <html>
   <head><meta http-equiv="refresh" content="0; url=App_VX_Y.html"></head>
   <body><a href="App_VX_Y.html">Click here if not redirected</a></body>
   </html>
   ```
3. Prints clear instructions:
   ```
   GitHub Pages deploy steps:
   1. Push this folder to a GitHub repo (if not already done)
	- Matt did do this manually previously, and has created a repo at "https://github.com/msindall/HomeHub" and has an outdated version
   2. Go to repo Settings → Pages → Source: main branch, / (root)
   3. Your app will be live at: https://YOUR-USERNAME.github.io/REPO-NAME/
   4. index.html will redirect to the latest version automatically
   ```
4. Optionally (if `git` is available) runs:
   ```
   git add App_VX_Y.html index.html
   git commit -m "Deploy v6.X_Y"
   git push
   ```
   But only if the user passes `--push` flag: `python deploy_github.py --push`

Also create a file `DEPLOY.md` explaining the one-time GitHub setup in plain English (Matt is a non-developer). Keep it to under 30 lines, no jargon.

### Task 3 — Share modal UI

Add a "Share App" modal to `tail.html` (add it before the closing `</body>`-equivalent tag):

```html
<div id="modal-share" class="modal-overlay" onclick="if(event.target===this)closeModal('share')">
  <div class="modal" style="max-width:500px">
    <div class="modal-header">
      <span class="modal-title">Share Home Hub</span>
      <button class="modal-close" onclick="closeModal('share')">✕</button>
    </div>
    <div class="modal-body" id="share-modal-body">
      <!-- populated by JS -->
    </div>
  </div>
</div>
```

Add a function `openShareModal()` in `07-upload.js` that populates `#share-modal-body` with:

1. **Share link section** — a text input showing the generated URL (read-only), a "Copy" button that calls `generateShareURL()`, and a note: "Anyone who opens this link will see the Setup Wizard pre-filled with your household template. Their data stays separate."

2. **QR code section** — a `<canvas id="share-qr-canvas">` that renders a QR code for the share URL. Use the `qrcodejs` library from CDN: `https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`. Load it dynamically when the modal opens (inject a script tag if not already loaded). After the library loads, instantiate: `new QRCode(document.getElementById('share-qr-canvas'), { text: shareUrl, width: 200, height: 200 })`.

3. **Download file section** — a button "Download config file instead" that calls the existing `exportShareableConfig()` for users who prefer the old file-based method.

Add a "Share" button somewhere visible in the app — either in the top bar next to the settings gear icon, or in the Upload/Data page. A small `🔗 Share` button is sufficient. It calls `openShareModal()`.

### Task 4 — Web App Manifest (PWA installability)

Add a web app manifest so Chrome shows the "Install" option when the app is opened in a browser. This makes the app feel like a native app on both desktop and (eventually) mobile.

In `build.py`, after assembling the output string, inject into the `<head>` section:

```html
<link rel="manifest" href="data:application/json;base64,MANIFEST_BASE64">
<meta name="theme-color" content="#6366f1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Home Hub">
```

Generate the manifest JSON in `build.py` and base64-encode it for inline embedding:

```json
{
  "name": "Home Hub",
  "short_name": "Home Hub",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6366f1",
  "icons": [
    {
      "src": "data:image/svg+xml;base64,...",
      "sizes": "any",
      "type": "image/svg+xml"
    }
  ]
}
```

For the icon, generate a simple SVG of a house emoji rendered in a rounded square: a blue/indigo square with a white house shape. Encode it as base64 in the manifest.

Note: A full service worker (offline caching) is deferred to a future phase. This task just adds the manifest so the "Install" prompt appears.

### Task 5 — Update exportShareableConfig version string

`exportShareableConfig()` in `07-upload.js` has a hardcoded `_version: '6.24'`. Update it to read the version dynamically. Add a global constant near the top of `07-upload.js`:

```javascript
var HH_VERSION = '6.28'; // replaced by build.py at build time
```

Then in `build.py`'s version-stamping step, replace `'6.28'` with the actual version. And reference `HH_VERSION` in `exportShareableConfig()` instead of the hardcoded string.

---

## Conventions to follow

- Never use `alert()`, `confirm()`, `prompt()` — use `hhAlert()`, `hhConfirm()`, `hhToast()`
- Never hardcode hex colours in CSS — use CSS custom properties (`--accent`, `--bg`, etc.)
- Modal IDs must match `document.getElementById()` calls exactly
- All modals: `<div id="modal-xxx" class="modal-overlay">` in `modals.html` or `tail.html`
- `saveState()` after every state mutation
- Ontario/Canada context — do not introduce US-specific logic

---

## Success criteria for Phase 2

- [ ] `python build.py` still produces a working minified file
- [ ] Opening `App_V6_30.html#setup=<valid-base64>` triggers the config import prompt
- [ ] "Share" button is visible in the app and opens the share modal
- [ ] Share modal shows: copy-link button, QR code, download file button
- [ ] Copying the link and opening it in a new tab triggers the setup wizard pre-fill
- [ ] `python deploy_github.py` creates `index.html` redirect and prints clear instructions
- [ ] `DEPLOY.md` exists and is readable by a non-technical person
- [ ] Chrome shows "Install" option when the app is open (manifest is working)
- [ ] No JavaScript errors in browser console

---

## After Phase 2 is complete

Phase 3 adds RBC, Alterna Savings, and Capital One Mastercard CSV parsers, plus a generic AI-powered fallback for any bank. The Phase 3 plan document is `Phase_3_Bank_Parsers.md` in this folder.
