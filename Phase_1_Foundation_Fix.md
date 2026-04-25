# Home Hub — Phase 1: Fix the Foundation

Paste this entire document into a new Cowork session to execute Phase 1.

---

## What this project is

Home Hub is a single-file HTML household management app for Matt & Holly (Ontario, Canada). It has no npm, no server, no build dependencies beyond Python. The build script `build.py` assembles source files into a deployable `App_VX_Y.html`.

**Working folder:** `D:\Claude\Home Planner\`

---

## What was found during analysis (do not re-derive, just act on it)

1. **build.py is broken.** It reads from `os.path.join(SRC_DIR, 'css', 'style.css')` etc., where `SRC_DIR = os.path.join(os.path.dirname(__file__), 'src')`. But there is NO `src/` subdirectory — all source files sit flat at the project root. The README documents the intended `src/css/`, `src/html/`, `src/js/` layout but it was never implemented. The existing `App_V6_28.html` (977 KB) was built some other way. **The build must be fixed before any future work.**

2. **No minification.** The 977 KB output has ~309 comment lines and ~306 blank lines in `07-upload.js` alone (the largest file at 204 KB). Stripping comments and excess whitespace from all JS and CSS using Python stdlib will reduce output to roughly 550 KB with zero new dependencies.

3. **No git repo.** There is no `.git` folder. One bad edit has no rollback. Fix this.

4. **Version stamping is inconsistent.** `build.py` correctly auto-increments the filename to `App_V6_29.html` etc., but `shell.html` contains a hardcoded string `'Home Hub V6.24'` and `exportShareableConfig()` in `07-upload.js` has `_version: '6.24'`. The regex substitution in `build.py` only patches one of these.

5. **Chart.js loads from CDN.** `shell.html` loads Chart.js 4.4.1 from `cdnjs.cloudflare.com`. If that CDN is unavailable, all charts break. PDF.js also loads from CDN but it's only needed for bank statement scanning so it's lower priority to inline.

---

## Source file map (flat at root — do NOT create a src/ subdirectory)

| File | Size | Role |
|------|------|------|
| `style.css` | 41 KB | All CSS |
| `shell.html` | 109 KB | Page skeleton, nav, page divs |
| `modals.html` | 29 KB | Modal HTML first half |
| `tail.html` | 71 KB | Modal HTML second half + closing tags |
| `01-core.js` | 67 KB | State, storage, helpers, dialogs, navigation |
| `02-dashboard.js` | 22 KB | Dashboard rendering, reminders |
| `03-finance.js` | 82 KB | Calendar, transactions, budget |
| `04-planning.js` | 90 KB | Wedding, house, bills |
| `05-household.js` | 119 KB | Net worth, cars, tax, retirement |
| `06-insights.js` | 183 KB | Tips, grocery, meal plan, recipes |
| `07-upload.js` | 204 KB | Bank import, career, charts, init |
| `build.py` | 5 KB | Build script (currently broken) |

---

## Phase 1 tasks — do all of these in order

### Task 1 — Fix build.py to work with flat file layout

Rewrite `build.py` so it reads files from the project root (same directory as `build.py` itself), not from a `src/` subdirectory.

The corrected path resolution should be:
```python
ROOT = os.path.dirname(os.path.abspath(__file__))
# Then read files as:
css    = read(os.path.join(ROOT, 'style.css'))
shell  = read(os.path.join(ROOT, 'shell.html'))
modals = read(os.path.join(ROOT, 'modals.html'))
tail   = read(os.path.join(ROOT, 'tail.html'))
# JS files:
for fname in JS_FILES:
    read(os.path.join(ROOT, fname))
```

Keep everything else in build.py the same (version auto-increment logic, output filename, etc.).

After fixing, run `python build.py` from the project folder and confirm it produces `App_V6_29.html` without errors.

### Task 2 — Add Python minification to build.py

After assembling the combined JS and CSS strings (but before writing the output file), run them through a minification function written in pure Python stdlib — no pip installs.

**For JavaScript** — implement a function `minify_js(src)` that:
- Removes single-line comments (`// ...`) except ones that start with `/*!` (licence headers)
- Removes multi-line comments (`/* ... */`) except licence headers
- Collapses runs of 3+ blank lines down to one blank line
- Does NOT mangle variable names, does NOT touch strings or regex literals
- Must be safe for vanilla ES5/ES6 — when in doubt, be conservative (skip a removal rather than break the code)

**For CSS** — implement `minify_css(src)` that:
- Removes `/* ... */` comments
- Collapses runs of blank lines

Add a `--dev` flag: `python build.py --dev` skips minification and produces an unminified build for debugging. Default (no flag) = minified.

Print before/after sizes in the build summary.

### Task 3 — Fix version stamping everywhere

In `build.py`, after computing `version_label`, replace ALL of these strings in the assembled output:

- `'Home Hub V6.24'` → `f'Home Hub V{version_label}'`
- `'Home Hub V6.27'` → `f'Home Hub V{version_label}'`  
- `'Home Hub V6.28'` → `f'Home Hub V{version_label}'`  
- `_version: '6.24'` → `_version: '{version_label}'`
- `badge.textContent = 'v...';` → already handled, keep existing regex

Use a single broad regex: `re.sub(r"Home Hub V\d+\.\d+", f"Home Hub V{version_label}", output)` applied to the full assembled output string. And similarly for the `_version` key.

### Task 4 — Inline Chart.js

Download Chart.js 4.4.1 minified source from `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js` and save it as `chart.umd.min.js` in the project root.

In `build.py`, read that file and inject it as an inline `<script>` block in the output, replacing the external `<script src="...Chart.js...">` tag in `shell.html`.

The replacement should happen before the version-stamping step. Strip the `src=` script tag from `shell.html`'s content string and prepend the inline script.

Do NOT inline PDF.js — it's large (~1 MB worker + library) and only needed for bank statement scanning which requires network anyway.

### Task 5 — Initialise git repository

In the project folder `D:\Claude\Home Planner\`:

1. Run `git init`
2. Create `.gitignore` with:
   ```
   App_V*.html
   __pycache__/
   *.pyc
   chart.umd.min.js
   ```
   Note: We gitignore the built HTML files because they're large generated artefacts. Source files are what get committed. `chart.umd.min.js` is a downloaded dependency.
3. Run `git add .` and `git commit -m "Initial commit — source files, working build pipeline"`
4. Tag the commit: `git tag v6.28-source`

---

## Conventions to follow (do not violate these)

- Never use `alert()`, `confirm()`, or `prompt()` — the app uses `hhAlert()`, `hhConfirm()`, `hhToast()`
- Never hardcode hex colours in CSS — use CSS custom properties
- All currency formatting: `fmt(n)` for `$0.00`, `fmtC(n)` for `$1,000`
- `saveState()` must be called after every mutation to the `state` object
- The app is Ontario/Canada specific — do not introduce US tax logic

---

## Success criteria for Phase 1

- [ ] `python build.py` runs without errors and produces `App_V6_29.html`
- [ ] `python build.py --dev` produces an unminified version for debugging  
- [ ] Output file is under 600 KB (from 977 KB)
- [ ] Opening `App_V6_29.html` in a browser: app loads, charts render (Chart.js inline), all pages navigate correctly
- [ ] Version badge in the app shows the correct version number
- [ ] `git log` shows the initial commit and v6.28-source tag
- [ ] No JavaScript errors in browser console on load

---

## After Phase 1 is complete

Phase 2 focuses on sharing — GitHub Pages deploy, shareable URL config, QR code generation. The Phase 2 plan document is `Phase_2_Sharing.md` in this folder.
